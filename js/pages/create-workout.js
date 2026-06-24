let _draftTimer = null;

async function renderCreateWorkoutPage(params) {
  const app = document.getElementById('app-content');
  let isEdit = !!(params && params.id);
  const isDraftResume = window.location.hash.includes('draft=1');
  const types = await getWorkoutTypes();
  const draft = await getDraft();
  let workout = null;
  let editId = params && params.id ? params.id : null;

  if (isEdit) {
    if (isDraftResume && draft?.isEdit && draft.editId === editId && draft.workout) {
      workout = draft.workout;
    } else {
      workout = await getWorkout(editId);
    }
    if (!workout) {
      app.innerHTML = `<div class="page"><div class="empty-state"><p class="empty-state-text">Workout nicht gefunden.</p></div></div>`;
      return;
    }
    if (!draft || !draft.isEdit || draft.editId !== editId) {
      await saveDraft({ workout: cloneWorkout(workout), isEdit: true, editId });
    }
  } else if (isDraftResume && draft?.workout) {
    workout = draft.workout;
    if (draft.isEdit && draft.editId) {
      isEdit = true;
      editId = draft.editId;
    }
  }

  if (!workout) {
    workout = createEmptyWorkout(types.length > 0 ? types[0].name : '');
  }

  renderWorkoutForm(workout, types, isEdit, {
    editId,
    resetHistory: true,
    formHistory: draft && draft.workout === workout ? draft.formHistory : null
  });
  startAutoDraft();
}

function cloneWorkout(workout) {
  return JSON.parse(JSON.stringify(workout));
}

function startAutoDraft() {
  stopAutoDraft();
  _draftTimer = setInterval(() => {
    const workout = collectWorkoutFromForm();
    if (workout) saveDraft({ ...getDraftMeta(), workout, formHistory: getFormHistoryState() });
  }, 3000);
}

function saveCurrentDraft() {
  const workout = collectWorkoutFromForm();
  if (workout) saveDraft({ ...getDraftMeta(), workout, formHistory: getFormHistoryState() });
}

function stopAutoDraft(shouldSave = true) {
  if (shouldSave) saveCurrentDraft();
  if (_draftTimer) {
    clearInterval(_draftTimer);
    _draftTimer = null;
  }
}

function getDraftMeta() {
  const form = document.getElementById('workout-form');
  if (!form) return {};
  return {
    isEdit: form.dataset.isEdit === 'true',
    editId: form.dataset.editId || null
  };
}

function renderWorkoutForm(workout, types, isEdit, options = {}) {
  const app = document.getElementById('app-content');
  const editId = options.editId || workout.workoutId;
  const createdAt = workout.createdAt || workout.date || new Date().toISOString();
  const originalDate = workout.date || createdAt;

  app.innerHTML = `
    <div class="page page-create">
      <div class="page-header">
        <a href="#${isEdit ? '/workout/' + editId : '/'}" class="btn-icon" aria-label="Zurück">${icon('chevronLeft', 20)}</a>
        <h2 class="page-title">${isEdit ? 'Workout bearbeiten' : 'Neues Workout'}</h2>
      </div>

      <form id="workout-form" data-workout-id="${escapeHtml(workout.workoutId)}" data-is-edit="${!!isEdit}" data-edit-id="${isEdit ? escapeHtml(editId) : ''}" data-created-at="${escapeHtml(createdAt)}" data-original-date="${escapeHtml(originalDate)}">
        <div class="form-section">
          <div class="form-row">
            <label class="form-label" for="workout-type">Typ</label>
            <select id="workout-type" class="select" aria-label="Workout Typ">
              ${types.map(t => `<option value="${escapeHtml(t.name)}" ${t.name === workout.type ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-row">
            <label class="form-label" for="workout-name">Name</label>
            <input type="text" id="workout-name" class="input" value="${escapeHtml(workout.name)}" aria-label="Workout Name">
          </div>
          <div class="form-row">
            <label class="form-label" for="workout-date">Datum</label>
            <input type="date" id="workout-date" class="input" value="${formatDateInputValue(workout.date)}" aria-label="Workout Datum">
          </div>
          <div class="form-row">
            <label class="form-label" for="workout-time">Uhrzeit</label>
            <input type="time" id="workout-time" class="input" value="${formatTimeInputValue(workout.date)}" aria-label="Workout Uhrzeit">
          </div>
        </div>

        <div class="form-section">
          <div class="section-header">
            <h3 class="section-title">Übungen</h3>
            <button type="button" class="btn btn-ghost btn-sm" id="add-exercise">${icon('plus', 14)} Übung hinzufügen</button>
          </div>
          <div id="exercises-container">
            ${workout.exercises.map((ex, i) => renderExerciseCard(ex, i)).join('')}
          </div>
          <button type="button" class="btn btn-ghost btn-sm w-full mt-2" id="add-exercise-bottom">${icon('plus', 14)} Übung hinzufügen</button>
        </div>

        <div class="form-section">
          <div class="section-header">
            <h3 class="section-title">Finisher</h3>
            <label class="toggle-label">
              <input type="checkbox" id="finisher-toggle" ${workout.finisher && workout.finisher.type ? 'checked' : ''}>
              <span class="toggle-text">Aktiviert</span>
            </label>
          </div>
          <div id="finisher-container">
            ${workout.finisher && workout.finisher.type ? renderFinisherBlock(workout.finisher) : ''}
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="btn-undo" disabled>${icon('undo', 16)} Undo</button>
          <button type="button" class="btn btn-ghost" id="btn-redo" disabled>${icon('redo', 16)} Redo</button>
          <button type="button" class="btn btn-ghost" id="btn-cancel">Abbrechen</button>
          <button type="button" class="btn btn-primary" id="btn-save-workout">${icon('save', 16)} ${isEdit ? 'Speichern' : 'Workout speichern'}</button>
        </div>
      </form>
    </div>
  `;

  bindFormEvents(workout);
  if (options.resetHistory) initFormHistory(workout, options.formHistory);
  updateSetDeleteStates();
  updateUndoRedoButtons();
}

function renderExerciseCard(exercise, index) {
  return `
    <div class="card exercise-card" data-exercise-id="${escapeHtml(exercise.exerciseId)}" data-index="${index}">
      <div class="exercise-card-header">
        <input type="text" class="input exercise-name" value="${escapeHtml(exercise.name)}" placeholder="Übungsname" aria-label="Übungsname">
        <button type="button" class="btn-icon btn-danger-icon remove-exercise" aria-label="Übung entfernen">${icon('trash', 16)}</button>
      </div>
      <div class="exercise-mode-toggle">
        <button type="button" class="btn btn-sm ${exercise.mode === 'normal' ? 'btn-primary' : 'btn-ghost'} mode-btn" data-mode="normal">Normal</button>
        <button type="button" class="btn btn-sm ${exercise.mode === 'lr' ? 'btn-primary' : 'btn-ghost'} mode-btn" data-mode="lr">Links/Rechts</button>
      </div>
      ${renderSetsHeader()}
      <div class="sets-container">${exercise.sets.map((set, si) => renderSetRow(set, si, exercise.sets.length <= 1)).join('')}</div>
      <button type="button" class="btn btn-ghost btn-sm w-full mt-2 add-set">${icon('plus', 14)} Satz hinzufügen</button>
    </div>
  `;
}

function renderSetsHeader() {
  return `
    <div class="sets-header">
      <div class="sets-header-col">Satz</div>
      <div class="sets-header-col">Wdh</div>
      <div class="sets-header-col">RPE</div>
      <div class="sets-header-col">Pause</div>
      <div class="sets-header-col"></div>
    </div>
  `;
}

function renderSetRow(set, index, disableRemove = false) {
  const label = set.label || `Satz ${index + 1}`;
  const sideStr = label.includes('links') ? 'L' : label.includes('rechts') ? 'R' : '';
  const match = label.match(/\d+/);
  const numStr = match ? match[0] : (index + 1);
  const isSkipped = !!set.skipped;

  return `
    <div class="set-row${isSkipped ? ' skipped' : ''}" data-set-id="${escapeHtml(set.setId || uuid())}" data-index="${index}">
      <div class="set-label" data-raw-label="${escapeHtml(label)}">
        <div class="set-badge">${numStr}${sideStr ? `<div class="side">${sideStr}</div>` : ''}</div>
      </div>
      ${renderNumberStepper('reps', 'set-reps', set.reps || 0, 0, '', isSkipped, 'Wiederholungen')}
      ${renderNumberStepper('rpe', 'set-rpe', set.rpe || 5, 1, 10, isSkipped, 'RPE')}
      ${renderNumberStepper('break', 'set-break', set.breakSeconds || 0, 0, '', isSkipped, 'Pause in Sekunden', 15)}
      <div class="set-actions">
        ${renderRestTimerButton(isSkipped)}
        <button type="button" class="btn-icon skip-btn${isSkipped ? ' active' : ''}" aria-label="Überspringen" title="Überspringen">${icon('skipForward', 14)}</button>
        <button type="button" class="btn-icon set-note-btn ${set.note ? 'has-note' : ''}" aria-label="Notiz">${icon('fileText', 14)}</button>
        <input type="hidden" class="set-note" value="${escapeHtml(set.note || '')}">
        <button type="button" class="btn-icon btn-danger-icon remove-set" aria-label="Satz entfernen"${disableRemove ? ' disabled' : ''}>${icon('minus', 14)}</button>
      </div>
    </div>
  `;
}

function renderNumberStepper(target, inputClass, value, min, max, disabled, label, step = 1) {
  const maxAttr = max === '' ? '' : ` max="${max}"`;
  return `
    <div class="stepper stepper-sm stepper-minimal stepper-${target}">
      <button type="button" class="stepper__btn stepper-dec" data-target="${target}" data-step="${step}" aria-label="Weniger"${disabled ? ' disabled' : ''}>-</button>
      <input type="number" class="stepper__input ${inputClass}" value="${value}" min="${min}"${maxAttr} step="${step}" aria-label="${label}"${disabled ? ' disabled' : ''}>
      <button type="button" class="stepper__btn stepper-inc" data-target="${target}" data-step="${step}" aria-label="Mehr"${disabled ? ' disabled' : ''}>+</button>
    </div>
  `;
}

function renderFinisherBlock(finisher) {
  const type = finisher.type || 'NORMAL';
  const entries = finisher.entries || [createEmptyFinisherEntry()];
  return `
    <div class="finisher-block" data-finisher-type="${escapeHtml(type)}">
      <div class="form-row">
        <label class="form-label" for="finisher-name">Finisher-Name</label>
        <input type="text" id="finisher-name" class="input" value="${escapeHtml(finisher.name || '')}" placeholder="Optional" aria-label="Finisher Name">
      </div>
      <div class="form-row">
        <label class="form-label">Finisher-Typ</label>
        <div class="finisher-type-toggle">
          <button type="button" class="btn btn-sm ${type === 'NORMAL' ? 'btn-primary' : 'btn-ghost'} finisher-type-btn" data-type="NORMAL">Normal</button>
          <button type="button" class="btn btn-sm ${type === 'AMRAP' ? 'btn-primary' : 'btn-ghost'} finisher-type-btn" data-type="AMRAP">AMRAP</button>
          <button type="button" class="btn btn-sm ${type === 'EMOM' ? 'btn-primary' : 'btn-ghost'} finisher-type-btn" data-type="EMOM">EMOM</button>
        </div>
      </div>
      <div id="finisher-entries">${entries.map((entry, i) => renderFinisherEntry(entry, i, type)).join('')}</div>
      <button type="button" class="btn btn-ghost btn-sm w-full mt-2" id="add-finisher-entry">${icon('plus', 14)} Übung hinzufügen</button>
    </div>
  `;
}

function renderFinisherEntry(entry, index, type) {
  const isSkipped = !!entry.skipped;
  if (type === 'NORMAL') {
    const sets = entry.sets && entry.sets.length > 0
      ? entry.sets
      : [{ setId: uuid(), label: 'Satz 1', reps: 0, rpe: 5, breakSeconds: 0, note: '', skipped: false }];
    return `
      <div class="card finisher-entry${isSkipped ? ' skipped' : ''}" data-entry-id="${escapeHtml(entry.id || uuid())}" data-index="${index}">
        ${renderFinisherEntryHeader(entry, isSkipped)}
        <div class="exercise-mode-toggle">
          <button type="button" class="btn btn-sm ${entry.mode === 'lr' ? 'btn-ghost' : 'btn-primary'} mode-btn" data-mode="normal">Normal</button>
          <button type="button" class="btn btn-sm ${entry.mode === 'lr' ? 'btn-primary' : 'btn-ghost'} mode-btn" data-mode="lr">Links/Rechts</button>
        </div>
        ${renderSetsHeader()}
        <div class="finisher-sets-container">${sets.map((s, si) => renderSetRow(s, si, sets.length <= 1)).join('')}</div>
        <button type="button" class="btn btn-ghost btn-sm w-full mt-2 add-finisher-set">${icon('plus', 14)} Satz hinzufügen</button>
      </div>
    `;
  }

  return `
    <div class="card finisher-entry${isSkipped ? ' skipped' : ''}" data-entry-id="${escapeHtml(entry.id || uuid())}" data-index="${index}">
      ${renderFinisherEntryHeader(entry, isSkipped)}
      <div class="amrap-grid">
        <div class="amrap-col">
          <label class="set-field-label">Ergebnis</label>
          <input type="text" class="input input-sm finisher-result" value="${escapeHtml(entry.result || '')}" placeholder="z. B. 40 Wdh" aria-label="Ergebnis"${isSkipped ? ' disabled' : ''}>
        </div>
        <div class="amrap-col">
          <label class="set-field-label">RPE</label>
          ${renderNumberStepper('frpe', 'finisher-rpe', entry.rpe || 5, 1, 10, isSkipped, 'RPE')}
        </div>
        <div class="amrap-action">
          <button type="button" class="btn-icon set-note-btn ${entry.note ? 'has-note' : ''}" aria-label="Notiz">${icon('fileText', 14)}</button>
          <input type="hidden" class="finisher-note" value="${escapeHtml(entry.note || '')}">
        </div>
      </div>
    </div>
  `;
}

function renderFinisherEntryHeader(entry, isSkipped) {
  return `
    <div class="finisher-entry-header">
      <input type="text" class="input finisher-entry-name" value="${escapeHtml(entry.name || '')}" placeholder="Übungsname" aria-label="Finisher Name"${isSkipped ? ' disabled' : ''}>
      <button type="button" class="btn-icon skip-btn finisher-skip-btn${isSkipped ? ' active' : ''}" aria-label="Überspringen" title="Überspringen">${icon('skipForward', 14)}</button>
      <button type="button" class="btn-icon btn-danger-icon remove-finisher-entry" aria-label="Eintrag entfernen">${icon('trash', 16)}</button>
    </div>
  `;
}

function bindFormEvents(workout) {
  const form = document.getElementById('workout-form');
  if (!form) return;

  document.getElementById('workout-type').addEventListener('change', () => {
    document.getElementById('workout-name').value = generateWorkoutName(document.getElementById('workout-type').value);
    scheduleHistoryRecord();
  });

  form.addEventListener('input', scheduleHistoryRecord);
  form.addEventListener('change', (e) => {
    clampNumberInput(e.target);
    scheduleHistoryRecord();
  });

  document.getElementById('btn-undo').addEventListener('click', undoFormChange);
  document.getElementById('btn-redo').addEventListener('click', redoFormChange);

  const addExercise = () => {
    const container = document.getElementById('exercises-container');
    container.insertAdjacentHTML('beforeend', renderExerciseCard(createEmptyExercise(), container.children.length));
    if (window.haptic) window.haptic.trigger(40);
    recordFormHistory();
  };
  document.getElementById('add-exercise').addEventListener('click', addExercise);
  document.getElementById('add-exercise-bottom').addEventListener('click', addExercise);

  form.addEventListener('click', (e) => {
    const restBtn = e.target.closest('.rest-timer-btn');
    if (restBtn) {
      e.stopPropagation();
      handleRestTimerButton(restBtn);
      return;
    }

    const noteBtn = e.target.closest('.set-note-btn');
    if (noteBtn) {
      e.stopPropagation();
      if (window.haptic) window.haptic.trigger(40);
      handleNoteClick(noteBtn);
      return;
    }

    const skipBtn = e.target.closest('.skip-btn');
    if (skipBtn) {
      e.stopPropagation();
      handleSkipToggle(skipBtn);
      recordFormHistory();
      return;
    }

    const stepBtn = e.target.closest('.stepper__btn');
    if (stepBtn && !stepBtn.disabled) {
      handleStepperClick(stepBtn);
      recordFormHistory();
    }
  });

  document.getElementById('exercises-container').addEventListener('click', (e) => {
    const card = e.target.closest('.exercise-card');
    if (!card) return;

    if (e.target.closest('.remove-exercise')) {
      confirmRemove('Übung entfernen', 'Diese Übung wirklich entfernen?', () => {
        const container = document.getElementById('exercises-container');
        if (container.children.length > 1) {
          card.remove();
          recordFormHistory();
        } else {
          showToast('Mindestens eine Übung erforderlich');
        }
      });
      return;
    }

    const modeBtn = e.target.closest('.mode-btn');
    if (modeBtn) {
      setMode(card, modeBtn.dataset.mode);
      recordFormHistory();
      return;
    }

    if (e.target.closest('.add-set')) {
      addSetToCard(card);
      updateSetDeleteStates(card);
      recordFormHistory();
      return;
    }

    const removeSetBtn = e.target.closest('.remove-set');
    if (removeSetBtn && !removeSetBtn.disabled) {
      const row = removeSetBtn.closest('.set-row');
      confirmRemove('Satz entfernen', 'Diesen Satz wirklich entfernen?', () => {
        removeSetFromCard(card, row);
        recordFormHistory();
      });
    }
  });

  document.getElementById('finisher-toggle').addEventListener('change', (e) => {
    const container = document.getElementById('finisher-container');
    if (e.target.checked) {
      const finisher = workout.finisher && workout.finisher.type
        ? workout.finisher
        : { type: 'NORMAL', name: '', entries: [createEmptyFinisherEntry()] };
      container.innerHTML = renderFinisherBlock(finisher);
      bindFinisherEvents();
      updateSetDeleteStates(container);
    } else {
      container.innerHTML = '';
    }
    recordFormHistory();
  });

  if (document.querySelector('.finisher-block')) bindFinisherEvents();

  document.getElementById('btn-cancel').addEventListener('click', async () => {
    pauseActiveRestTimer(false);
    stopAutoDraft(false);
    if (form.dataset.isEdit === 'true') {
      await clearDraft();
      Router.navigate('/workout/' + form.dataset.editId);
    } else {
      await clearDraft();
      Router.navigate('/');
    }
  });

  document.getElementById('btn-save-workout').addEventListener('click', async () => {
    pauseActiveRestTimer(false);
    const w = collectWorkoutFromForm();
    if (!w) return;
    if (!w.name.trim()) {
      showToast('Bitte gib einen Namen ein');
      return;
    }
    stopAutoDraft(false);

    const isEditMode = form.dataset.isEdit === 'true';
    if (isEditMode) {
      const existing = await getWorkout(form.dataset.editId);
      if (existing) {
        w.workoutId = existing.workoutId;
        w.createdAt = existing.createdAt || w.createdAt;
      }
    }

    await saveWorkout(w);
    await clearDraft();
    if (window.haptic) window.haptic.trigger('success');
    showToast(isEditMode ? 'Workout gespeichert' : 'Workout erstellt');
    Router.navigate('/workout/' + w.workoutId);
  });
}

function bindFinisherEvents() {
  const container = document.getElementById('finisher-container');
  if (!container || container.dataset.bound === 'true') return;
  container.dataset.bound = 'true';

  container.addEventListener('click', (e) => {
    const typeBtn = e.target.closest('.finisher-type-btn');
    if (typeBtn) {
      const newType = typeBtn.dataset.type;
      container.querySelectorAll('.finisher-type-btn').forEach(b => {
        b.classList.toggle('btn-primary', b.dataset.type === newType);
        b.classList.toggle('btn-ghost', b.dataset.type !== newType);
      });
      const block = container.querySelector('.finisher-block');
      if (block) block.dataset.finisherType = newType;
      const entries = collectFinisherEntries();
      document.getElementById('finisher-entries').innerHTML = entries.map((entry, i) => renderFinisherEntry(entry, i, newType)).join('');
      recordFormHistory();
      return;
    }

    if (e.target.closest('#add-finisher-entry')) {
      const type = container.querySelector('.finisher-block')?.dataset.finisherType || 'NORMAL';
      const entriesEl = document.getElementById('finisher-entries');
      entriesEl.insertAdjacentHTML('beforeend', renderFinisherEntry(createEmptyFinisherEntry(), entriesEl.children.length, type));
      recordFormHistory();
      return;
    }

    const removeEntry = e.target.closest('.remove-finisher-entry');
    if (removeEntry) {
      confirmRemove('Finisher-Eintrag entfernen', 'Diesen Finisher-Eintrag wirklich entfernen?', () => {
        const entry = removeEntry.closest('.finisher-entry');
        const entriesEl = document.getElementById('finisher-entries');
        if (entriesEl.children.length > 1) {
          entry.remove();
          recordFormHistory();
        } else {
          showToast('Mindestens ein Eintrag erforderlich');
        }
      });
      return;
    }

    const modeBtn = e.target.closest('.mode-btn');
    if (modeBtn) {
      const card = modeBtn.closest('.finisher-entry');
      if (card) {
        setMode(card, modeBtn.dataset.mode);
        recordFormHistory();
      }
      return;
    }

    if (e.target.closest('.add-finisher-set')) {
      addSetToCard(e.target.closest('.finisher-entry'));
      updateSetDeleteStates(e.target.closest('.finisher-entry'));
      recordFormHistory();
      return;
    }

    const removeSetBtn = e.target.closest('.remove-set');
    if (removeSetBtn && !removeSetBtn.disabled) {
      const row = removeSetBtn.closest('.set-row');
      confirmRemove('Satz entfernen', 'Diesen Satz wirklich entfernen?', () => {
        removeSetFromCard(row.closest('.finisher-entry'), row);
        recordFormHistory();
      });
    }
  });
}

function handleStepperClick(btn) {
  if (window.haptic) window.haptic.trigger(20);
  const input = btn.closest('.stepper')?.querySelector('input');
  if (!input || input.disabled) return;
  const step = parseInt(btn.dataset.step || input.step || '1') || 1;
  const current = parseInt(input.value) || 0;
  const min = input.min !== '' ? parseInt(input.min) : -Infinity;
  const max = input.max !== '' ? parseInt(input.max) : Infinity;
  if (btn.dataset.target === 'break') {
    input.value = btn.classList.contains('stepper-inc')
      ? Math.min(Math.ceil((current + 1) / step) * step, max)
      : Math.max(Math.floor((current - 1) / step) * step, min);
  } else {
    input.value = btn.classList.contains('stepper-inc')
      ? Math.min(current + step, max)
      : Math.max(current - step, min);
  }
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function clampNumberInput(input) {
  if (!input.classList || !input.classList.contains('stepper__input')) return;
  let val = parseInt(input.value);
  if (isNaN(val)) val = 0;
  const min = input.min !== '' ? parseInt(input.min) : -Infinity;
  const max = input.max !== '' ? parseInt(input.max) : Infinity;
  input.value = Math.max(min, Math.min(val, max));
}

function handleNoteClick(noteBtn) {
  const hiddenInput = noteBtn.parentElement.querySelector('input[type="hidden"]') || noteBtn.nextElementSibling;
  if (!hiddenInput) return;
  const textarea = document.createElement('textarea');
  textarea.id = 'edit-note-textarea';
  textarea.className = 'input';
  textarea.rows = 4;
  textarea.style.resize = 'none';
  textarea.style.width = '100%';
  textarea.placeholder = 'Notiz eingeben...';
  textarea.value = hiddenInput.value || '';

  showModal({
    title: 'Notiz',
    body: textarea,
    confirmText: 'Speichern',
    cancelText: 'Abbrechen',
    onConfirm: () => {
      hiddenInput.value = textarea.value;
      hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
      noteBtn.classList.toggle('has-note', !!textarea.value);
      recordFormHistory();
    }
  });
  setTimeout(() => textarea.focus(), 50);
}

function handleSkipToggle(skipBtn) {
  const row = skipBtn.closest('.set-row') || skipBtn.closest('.finisher-entry');
  if (!row) return;
  const isNowSkipped = !row.classList.contains('skipped');
  row.classList.toggle('skipped', isNowSkipped);
  skipBtn.classList.toggle('active', isNowSkipped);
  row.querySelectorAll('input:not([type="hidden"]), .stepper__btn').forEach(el => {
    if (!el.classList.contains('skip-btn') && !el.classList.contains('finisher-skip-btn')) {
      el.disabled = isNowSkipped;
    }
  });
}

function confirmRemove(title, bodyText, onConfirm) {
  if (window.haptic) window.haptic.trigger('error');
  showModal({
    title,
    bodyText,
    confirmText: 'Entfernen',
    cancelText: 'Abbrechen',
    danger: true,
    onConfirm
  });
}

function setMode(card, newMode) {
  card.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('btn-primary', b.dataset.mode === newMode);
    b.classList.toggle('btn-ghost', b.dataset.mode !== newMode);
  });
  rebuildSetsForMode(card, newMode);
}

function addSetToCard(card) {
  if (!card) return;
  if (window.haptic) window.haptic.trigger(40);
  const setsContainer = getSetsContainer(card);
  const count = setsContainer.querySelectorAll('.set-row').length;
  const mode = card.querySelector('.mode-btn.btn-primary')?.dataset.mode || 'normal';
  if (mode === 'lr') {
    const pairNum = Math.floor(count / 2) + 1;
    setsContainer.insertAdjacentHTML('beforeend', renderSetRow({ setId: uuid(), label: `Satz ${pairNum} (links)`, reps: 0, rpe: 5, breakSeconds: 0, note: '', skipped: false }, count));
    setsContainer.insertAdjacentHTML('beforeend', renderSetRow({ setId: uuid(), label: `Satz ${pairNum} (rechts)`, reps: 0, rpe: 5, breakSeconds: 0, note: '', skipped: false }, count + 1));
  } else {
    setsContainer.insertAdjacentHTML('beforeend', renderSetRow(createEmptySet(count, 'normal'), count));
  }
  updateSetDeleteStates(card);
}

function removeSetFromCard(card, row) {
  const setsContainer = getSetsContainer(card);
  if (row && setsContainer.querySelectorAll('.set-row').length > 1) {
    row.remove();
    rebuildSetLabelsInDOM(setsContainer, card.querySelector('.mode-btn.btn-primary')?.dataset.mode || 'normal');
    updateSetDeleteStates(card);
  } else {
    showToast('Mindestens ein Satz erforderlich');
  }
}

function updateSetDeleteStates(scope = document) {
  scope.querySelectorAll('.sets-container, .finisher-sets-container').forEach(container => {
    const rows = container.querySelectorAll('.set-row');
    const shouldDisable = rows.length <= 1;
    rows.forEach(row => {
      const btn = row.querySelector('.remove-set');
      if (btn) btn.disabled = shouldDisable;
    });
  });
}

function getSetsContainer(card) {
  return card.querySelector('.finisher-sets-container') || card.querySelector('.sets-container');
}

function rebuildSetsForMode(card, newMode) {
  const setsContainer = getSetsContainer(card);
  const values = Array.from(setsContainer.querySelectorAll('.set-row')).map(row => ({
    reps: parseInt(row.querySelector('.set-reps')?.value) || 0,
    rpe: parseInt(row.querySelector('.set-rpe')?.value) || 5,
    breakSeconds: parseInt(row.querySelector('.set-break')?.value) || 0,
    note: row.querySelector('.set-note')?.value || '',
    skipped: row.classList.contains('skipped')
  }));

  setsContainer.innerHTML = '';
  if (newMode === 'lr') {
    values.forEach((val, i) => {
      setsContainer.insertAdjacentHTML('beforeend', renderSetRow({ setId: uuid(), label: `Satz ${i + 1} (links)`, ...val }, i * 2));
      setsContainer.insertAdjacentHTML('beforeend', renderSetRow({ setId: uuid(), label: `Satz ${i + 1} (rechts)`, ...val }, i * 2 + 1));
    });
  } else {
    const count = Math.ceil(values.length / 2);
    for (let i = 0; i < count; i++) {
      const val = values[i * 2] || { reps: 0, rpe: 5, breakSeconds: 0, note: '', skipped: false };
      setsContainer.insertAdjacentHTML('beforeend', renderSetRow({ setId: uuid(), label: `Satz ${i + 1}`, ...val }, i));
    }
  }
  updateSetDeleteStates(card);
}

function rebuildSetLabelsInDOM(container, mode) {
  container.querySelectorAll('.set-row').forEach((row, i) => {
    const label = mode === 'lr' ? `Satz ${Math.floor(i / 2) + 1} (${i % 2 === 0 ? 'links' : 'rechts'})` : `Satz ${i + 1}`;
    const labelEl = row.querySelector('.set-label');
    labelEl.dataset.rawLabel = label;
    const sideStr = label.includes('links') ? 'L' : label.includes('rechts') ? 'R' : '';
    const numStr = label.match(/\d+/)?.[0] || (i + 1);
    labelEl.innerHTML = `<div class="set-badge">${numStr}${sideStr ? `<div class="side">${sideStr}</div>` : ''}</div>`;
  });
}

function collectWorkoutFromForm() {
  const form = document.getElementById('workout-form');
  if (!form) return null;
  const originalDate = form.dataset.originalDate || new Date().toISOString();
  const createdAt = form.dataset.createdAt || originalDate;

  const exercises = Array.from(document.querySelectorAll('.exercise-card')).map(card => ({
    exerciseId: card.dataset.exerciseId || uuid(),
    name: card.querySelector('.exercise-name').value,
    mode: card.querySelector('.mode-btn.btn-primary')?.dataset.mode || 'normal',
    sets: Array.from(card.querySelectorAll('.sets-container .set-row')).map(collectSetFromRow)
  }));

  let finisher = null;
  const finisherToggle = document.getElementById('finisher-toggle');
  const block = document.querySelector('.finisher-block');
  if (finisherToggle?.checked && block) {
    finisher = {
      type: block.dataset.finisherType || 'NORMAL',
      name: document.getElementById('finisher-name')?.value || '',
      entries: collectFinisherEntries()
    };
  }

  return {
    workoutId: form.dataset.workoutId,
    type: document.getElementById('workout-type').value,
    name: document.getElementById('workout-name').value,
    date: dateTimeInputToISO(
      document.getElementById('workout-date').value,
      document.getElementById('workout-time').value,
      originalDate
    ),
    exercises,
    finisher,
    createdAt,
    updatedAt: new Date().toISOString()
  };
}

function collectSetFromRow(row) {
  return {
    setId: row.dataset.setId || uuid(),
    label: row.querySelector('.set-label').dataset.rawLabel || row.querySelector('.set-label').textContent,
    reps: parseInt(row.querySelector('.set-reps')?.value) || 0,
    rpe: parseInt(row.querySelector('.set-rpe')?.value) || 5,
    breakSeconds: parseInt(row.querySelector('.set-break')?.value) || 0,
    note: row.querySelector('.set-note')?.value || '',
    skipped: row.classList.contains('skipped')
  };
}

function collectFinisherEntries() {
  const finisherType = document.querySelector('.finisher-block')?.dataset.finisherType || 'NORMAL';
  return Array.from(document.querySelectorAll('.finisher-entry')).map(el => {
    const entry = {
      id: el.dataset.entryId || uuid(),
      name: el.querySelector('.finisher-entry-name')?.value || '',
      rpe: 5,
      note: '',
      result: '',
      sets: [],
      skipped: el.classList.contains('skipped'),
      mode: el.querySelector('.mode-btn.btn-primary')?.dataset.mode || 'normal'
    };

    if (finisherType === 'NORMAL') {
      entry.sets = Array.from(el.querySelectorAll('.finisher-sets-container .set-row')).map(collectSetFromRow);
    } else {
      entry.result = el.querySelector('.finisher-result')?.value || '';
      entry.rpe = parseInt(el.querySelector('.finisher-rpe')?.value) || 5;
      entry.note = el.querySelector('.finisher-note')?.value || '';
    }
    return entry;
  });
}
