let _draftTimer = null;

async function renderCreateWorkoutPage(params) {
  const app = document.getElementById('app-content');
  const isEdit = params && params.id;
  const isDraftResume = window.location.hash.includes('draft=1');

  let workout = null;
  let types = await getWorkoutTypes();

  if (isEdit) {
    workout = await getWorkout(params.id);
    if (!workout) {
      app.innerHTML = `<div class="page"><div class="empty-state"><p class="empty-state-text">Workout nicht gefunden.</p></div></div>`;
      return;
    }
    // Save a draft copy for editing
    await saveDraft({ workout: JSON.parse(JSON.stringify(workout)), isEdit: true, editId: params.id });
  } else if (isDraftResume) {
    const draft = await getDraft();
    if (draft && draft.workout) {
      workout = draft.workout;
      // Check if this was an edit draft
      if (draft.isEdit && draft.editId) {
        // Keep the edit context
      }
    }
  }

  if (!workout) {
    const defaultType = types.length > 0 ? types[0].name : '';
    workout = createEmptyWorkout(defaultType);
  }

  renderWorkoutForm(workout, types, isEdit);
  startAutoDraft();
}

function startAutoDraft() {
  stopAutoDraft();
  _draftTimer = setInterval(() => {
    const workout = collectWorkoutFromForm();
    if (workout) {
      const draft = getDraftMeta();
      saveDraft({ ...draft, workout });
    }
  }, 3000);
}

function stopAutoDraft() {
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

function renderWorkoutForm(workout, types, isEdit) {
  const app = document.getElementById('app-content');

  app.innerHTML = `
    <div class="page page-create">
      <div class="page-header">
        <a href="#${isEdit ? '/workout/' + workout.workoutId : '/'}" class="btn-icon" aria-label="Zurück">${icon('chevronLeft', 20)}</a>
        <h2 class="page-title">${isEdit ? 'Workout bearbeiten' : 'Neues Workout'}</h2>
      </div>

      <form id="workout-form" data-workout-id="${workout.workoutId}" data-is-edit="${!!isEdit}" data-edit-id="${isEdit ? workout.workoutId : ''}">
        <!-- Workout Meta -->
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
        </div>

        <!-- Exercises -->
        <div class="form-section">
          <div class="section-header">
            <h3 class="section-title">Übungen</h3>
            <button type="button" class="btn btn-ghost btn-sm" id="add-exercise">${icon('plus', 14)} Übung hinzufügen</button>
          </div>
          <div id="exercises-container">
            ${workout.exercises.map((ex, i) => renderExerciseCard(ex, i)).join('')}
          </div>
        </div>

        <!-- Finisher -->
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

        <!-- Actions -->
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" id="btn-cancel">Abbrechen</button>
          <button type="button" class="btn btn-primary" id="btn-save-workout">
            ${icon('save', 16)} ${isEdit ? 'Speichern' : 'Workout speichern'}
          </button>
        </div>
      </form>
    </div>
  `;

  bindFormEvents(workout);
}

function renderExerciseCard(exercise, index) {
  return `
    <div class="card exercise-card" data-exercise-id="${exercise.exerciseId}" data-index="${index}">
      <div class="exercise-card-header">
        <input type="text" class="input exercise-name" value="${escapeHtml(exercise.name)}" placeholder="Übungsname" aria-label="Übungsname">
        <button type="button" class="btn-icon btn-danger-icon remove-exercise" aria-label="Übung entfernen">${icon('trash', 16)}</button>
      </div>
      <div class="exercise-mode-toggle">
        <button type="button" class="btn btn-sm ${exercise.mode === 'normal' ? 'btn-primary' : 'btn-ghost'} mode-btn" data-mode="normal">Normal</button>
        <button type="button" class="btn btn-sm ${exercise.mode === 'lr' ? 'btn-primary' : 'btn-ghost'} mode-btn" data-mode="lr">Links/Rechts</button>
      </div>
      <div class="sets-header">
        <div class="sets-header-col">Satz</div>
        <div class="sets-header-col">Wdh</div>
        <div class="sets-header-col">RPE</div>
        <div class="sets-header-col"></div>
      </div>
      <div class="sets-container">
        ${exercise.sets.map((set, si) => renderSetRow(set, si)).join('')}
      </div>
      <button type="button" class="btn btn-ghost btn-sm w-full mt-2 add-set">${icon('plus', 14)} Satz hinzufügen</button>
    </div>
  `;
}

function renderSetRow(set, index) {
  let sideStr = '';
  if (set.label.includes('links')) sideStr = 'L';
  else if (set.label.includes('rechts')) sideStr = 'R';
  let match = set.label.match(/\d+/);
  let numStr = match ? match[0] : (index + 1);

  return `
    <div class="set-row" data-set-id="${set.setId}" data-index="${index}">
      <div class="set-label" data-raw-label="${escapeHtml(set.label)}">
        <div class="set-badge">${numStr}${sideStr ? `<div class="side">${sideStr}</div>` : ''}</div>
      </div>
      <div class="stepper stepper-sm stepper-minimal">
        <button type="button" class="stepper__btn stepper-dec" data-target="reps" aria-label="Weniger">−</button>
        <input type="number" class="stepper__input set-reps" value="${set.reps}" min="0" aria-label="Wiederholungen">
        <button type="button" class="stepper__btn stepper-inc" data-target="reps" aria-label="Mehr">+</button>
      </div>
      <div class="stepper stepper-sm stepper-minimal">
        <button type="button" class="stepper__btn stepper-dec" data-target="rpe" aria-label="Weniger">−</button>
        <input type="number" class="stepper__input set-rpe" value="${set.rpe}" min="1" max="10" aria-label="RPE">
        <button type="button" class="stepper__btn stepper-inc" data-target="rpe" aria-label="Mehr">+</button>
      </div>
      <div class="set-actions">
        <button type="button" class="btn-icon set-note-btn ${set.note ? 'has-note' : ''}" aria-label="Notiz">
          ${icon('fileText', 14)}
        </button>
        <input type="hidden" class="set-note" value="${escapeHtml(set.note)}">
        <button type="button" class="btn-icon btn-danger-icon remove-set" aria-label="Satz entfernen">${icon('minus', 14)}</button>
      </div>
    </div>
  `;
}

function renderFinisherBlock(finisher) {
  const type = finisher.type || 'AMRAP';
  const entries = finisher.entries || [createEmptyFinisherEntry()];

  return `
    <div class="finisher-block" data-finisher-type="${type}">
      <div class="form-row">
        <label class="form-label">Finisher-Typ</label>
        <div class="finisher-type-toggle">
          <button type="button" class="btn btn-sm ${type === 'AMRAP' ? 'btn-primary' : 'btn-ghost'} finisher-type-btn" data-type="AMRAP">AMRAP</button>
          <button type="button" class="btn btn-sm ${type === 'EMOM' ? 'btn-primary' : 'btn-ghost'} finisher-type-btn" data-type="EMOM">EMOM</button>
          <button type="button" class="btn btn-sm ${type === 'NORMAL' ? 'btn-primary' : 'btn-ghost'} finisher-type-btn" data-type="NORMAL">Normal</button>
        </div>
      </div>
      <div id="finisher-entries">
        ${entries.map((entry, i) => renderFinisherEntry(entry, i, type)).join('')}
      </div>
      <button type="button" class="btn btn-ghost btn-sm" id="add-finisher-entry">${icon('plus', 14)} Eintrag hinzufügen</button>
    </div>
  `;
}

function renderFinisherEntry(entry, index, type) {
  if (type === 'NORMAL') {
    const sets = entry.sets && entry.sets.length > 0 ? entry.sets : [{ setId: uuid(), label: 'Satz 1', reps: 0, rpe: 5, note: '' }];
    return `
      <div class="card finisher-entry" data-entry-id="${entry.id}" data-index="${index}">
        <div class="finisher-entry-header">
          <input type="text" class="input finisher-entry-name" value="${escapeHtml(entry.name)}" placeholder="Übungsname" aria-label="Finisher Name">
          <button type="button" class="btn-icon btn-danger-icon remove-finisher-entry" aria-label="Eintrag entfernen">${icon('trash', 16)}</button>
        </div>
        <div class="sets-header">
          <div class="sets-header-col">Satz</div>
          <div class="sets-header-col">Wdh</div>
          <div class="sets-header-col">RPE</div>
          <div class="sets-header-col"></div>
        </div>
        <div class="finisher-sets-container">
          ${sets.map((s, si) => renderSetRow(s, si)).join('')}
        </div>
        <button type="button" class="btn btn-ghost btn-sm w-full mt-2 add-finisher-set">${icon('plus', 14)} Satz hinzufügen</button>
      </div>
    `;
  }

  // AMRAP / EMOM
  return `
    <div class="card finisher-entry" data-entry-id="${entry.id}" data-index="${index}">
      <div class="finisher-entry-header">
        <input type="text" class="input finisher-entry-name" value="${escapeHtml(entry.name)}" placeholder="Übungsname" aria-label="Finisher Name">
        <button type="button" class="btn-icon btn-danger-icon remove-finisher-entry" aria-label="Eintrag entfernen">${icon('trash', 16)}</button>
      </div>
      <div class="amrap-grid">
        <div class="amrap-col">
          <label class="set-field-label">Ergebnis</label>
          <input type="text" class="input input-sm finisher-result" value="${escapeHtml(entry.result || '')}" placeholder="z. B. 40 Wdh" aria-label="Ergebnis">
        </div>
        <div class="amrap-col">
          <label class="set-field-label">RPE</label>
          <div class="stepper stepper-sm">
            <button type="button" class="stepper__btn stepper-dec" data-target="frpe" aria-label="Weniger">−</button>
            <input type="number" class="stepper__input finisher-rpe" value="${entry.rpe}" min="1" max="10" aria-label="RPE">
            <button type="button" class="stepper__btn stepper-inc" data-target="frpe" aria-label="Mehr">+</button>
          </div>
        </div>
        <div class="amrap-action">
          <button type="button" class="btn-icon set-note-btn ${entry.note ? 'has-note' : ''}" aria-label="Notiz">
            ${icon('fileText', 14)}
          </button>
          <input type="hidden" class="finisher-note" value="${escapeHtml(entry.note)}">
        </div>
      </div>
    </div>
  `;
}

function bindFormEvents(workout) {
  const form = document.getElementById('workout-form');
  if (!form) return;

  // Type change → update name
  const typeSelect = document.getElementById('workout-type');
  typeSelect.addEventListener('change', () => {
    const nameInput = document.getElementById('workout-name');
    nameInput.value = generateWorkoutName(typeSelect.value);
  });

  // Add exercise
  document.getElementById('add-exercise').addEventListener('click', () => {
    const container = document.getElementById('exercises-container');
    const newEx = createEmptyExercise();
    const index = container.children.length;
    container.insertAdjacentHTML('beforeend', renderExerciseCard(newEx, index));
  });

  // Delegated stepper clicks (exercises + finisher — handled at document level)
  document.addEventListener('click', (e) => {
    // Note modal
    const noteBtn = e.target.closest('.set-note-btn');
    if (noteBtn) {
      const hiddenInput = noteBtn.nextElementSibling;
      const currentVal = hiddenInput.value || '';
      const bodyHtml = `<textarea id="edit-note-textarea" class="input" rows="4" style="resize: none; width: 100%;" placeholder="Notiz eingeben...">${escapeHtml(currentVal)}</textarea>`;

      showModal({
        title: 'Notiz',
        body: bodyHtml,
        confirmText: 'Speichern',
        cancelText: 'Abbrechen',
        onConfirm: () => {
          const ta = document.getElementById('edit-note-textarea');
          if (ta) {
            const newVal = ta.value;
            hiddenInput.value = newVal;
            hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            noteBtn.classList.toggle('has-note', !!newVal);
          }
        }
      });
      // Focus textarea
      setTimeout(() => {
        const ta = document.getElementById('edit-note-textarea');
        if (ta) {
          ta.focus();
          ta.setSelectionRange(ta.value.length, ta.value.length);
        }
      }, 50);
      return;
    }

    const btn = e.target.closest('.stepper__btn');
    if (!btn) return;
    const stepper = btn.closest('.stepper');
    if (!stepper) return;
    const input = stepper.querySelector('input');
    if (!input) return;
    const isInc = btn.classList.contains('stepper-inc');
    const current = parseInt(input.value) || 0;
    const min = input.min !== '' ? parseInt(input.min) : -Infinity;
    const max = input.max !== '' ? parseInt(input.max) : Infinity;
    const next = isInc ? Math.min(current + 1, max) : Math.max(current - 1, min);
    input.value = next;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Enforce min/max on manual stepper input typing
  document.addEventListener('change', (e) => {
    if (e.target.classList && e.target.classList.contains('stepper__input')) {
      const input = e.target;
      let val = parseInt(input.value);
      if (isNaN(val)) val = 0;
      const min = input.min !== '' ? parseInt(input.min) : -Infinity;
      const max = input.max !== '' ? parseInt(input.max) : Infinity;
      val = Math.max(min, Math.min(val, max));
      input.value = val;
    }
  });

  // Delegated events on exercises container
  document.getElementById('exercises-container').addEventListener('click', (e) => {
    const card = e.target.closest('.exercise-card');
    if (!card) return;

    // Remove exercise
    if (e.target.closest('.remove-exercise')) {
      const container = document.getElementById('exercises-container');
      if (container.children.length > 1) {
        card.remove();
      } else {
        showToast('Mindestens eine Übung erforderlich');
      }
      return;
    }

    // Mode toggle
    const modeBtn = e.target.closest('.mode-btn');
    if (modeBtn) {
      const newMode = modeBtn.dataset.mode;
      card.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.toggle('btn-primary', b.dataset.mode === newMode);
        b.classList.toggle('btn-ghost', b.dataset.mode !== newMode);
      });
      // Rebuild sets with new labels
      rebuildSetsForMode(card, newMode);
      return;
    }

    // Add set
    if (e.target.closest('.add-set')) {
      const setsContainer = card.querySelector('.sets-container');
      const currentSets = setsContainer.querySelectorAll('.set-row');
      const mode = card.querySelector('.mode-btn.btn-primary')?.dataset.mode || 'normal';

      if (mode === 'lr') {
        // Add a pair (left + right)
        const pairNum = Math.floor(currentSets.length / 2) + 1;
        const leftSet = { setId: uuid(), label: `Satz ${pairNum} (links)`, reps: 0, rpe: 5, note: '' };
        const rightSet = { setId: uuid(), label: `Satz ${pairNum} (rechts)`, reps: 0, rpe: 5, note: '' };
        setsContainer.insertAdjacentHTML('beforeend', renderSetRow(leftSet, currentSets.length));
        setsContainer.insertAdjacentHTML('beforeend', renderSetRow(rightSet, currentSets.length + 1));
      } else {
        const newSet = createEmptySet(currentSets.length, 'normal');
        setsContainer.insertAdjacentHTML('beforeend', renderSetRow(newSet, currentSets.length));
      }
      return;
    }

    // Remove set
    if (e.target.closest('.remove-set')) {
      const setsContainer = card.querySelector('.sets-container');
      if (setsContainer.querySelectorAll('.set-row').length > 1) {
        e.target.closest('.set-row').remove();
        // Rebuild labels
        const mode = card.querySelector('.mode-btn.btn-primary')?.dataset.mode || 'normal';
        rebuildSetLabelsInDOM(setsContainer, mode);
      } else {
        showToast('Mindestens ein Satz erforderlich');
      }
    }
  });

  // Finisher toggle
  document.getElementById('finisher-toggle').addEventListener('change', (e) => {
    const container = document.getElementById('finisher-container');
    if (e.target.checked) {
      const finisher = workout.finisher && workout.finisher.type
        ? workout.finisher
        : { type: 'AMRAP', entries: [createEmptyFinisherEntry()] };
      container.innerHTML = renderFinisherBlock(finisher);
      bindFinisherEvents();
    } else {
      container.innerHTML = '';
    }
  });

  // If finisher is already active, bind events
  if (document.querySelector('.finisher-block')) {
    bindFinisherEvents();
  }

  // Cancel
  document.getElementById('btn-cancel').addEventListener('click', async () => {
    stopAutoDraft();
    const isEditMode = form.dataset.isEdit === 'true';
    if (isEditMode) {
      Router.navigate('/workout/' + form.dataset.editId);
    } else {
      await clearDraft();
      Router.navigate('/');
    }
  });

  // Save
  document.getElementById('btn-save-workout').addEventListener('click', async () => {
    stopAutoDraft();
    const w = collectWorkoutFromForm();
    if (!w) return;

    // Validate
    if (!w.name.trim()) {
      showToast('Bitte gib einen Namen ein');
      return;
    }

    const isEditMode = form.dataset.isEdit === 'true';
    if (isEditMode) {
      const existing = await getWorkout(form.dataset.editId);
      if (existing) {
        w.workoutId = existing.workoutId;
        w.createdAt = existing.createdAt;
      }
    }

    w.updatedAt = new Date().toISOString();
    await saveWorkout(w);
    await clearDraft();
    showToast(isEditMode ? 'Workout gespeichert' : 'Workout erstellt');
    Router.navigate('/workout/' + w.workoutId);
  });
}

function bindFinisherEvents() {
  const container = document.getElementById('finisher-container');
  if (!container) return;

  // Type toggle
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
      // Re-render entries for new type
      const entries = collectFinisherEntries();
      const entriesContainer = document.getElementById('finisher-entries');
      entriesContainer.innerHTML = entries.map((entry, i) => renderFinisherEntry(entry, i, newType)).join('');
      return;
    }

    // Add finisher entry
    if (e.target.closest('#add-finisher-entry')) {
      const type = container.querySelector('.finisher-block')?.dataset.finisherType || 'AMRAP';
      const entriesEl = document.getElementById('finisher-entries');
      const newEntry = createEmptyFinisherEntry();
      entriesEl.insertAdjacentHTML('beforeend', renderFinisherEntry(newEntry, entriesEl.children.length, type));
      return;
    }

    // Remove finisher entry
    if (e.target.closest('.remove-finisher-entry')) {
      const entry = e.target.closest('.finisher-entry');
      const entriesEl = document.getElementById('finisher-entries');
      if (entriesEl.children.length > 1) {
        entry.remove();
      } else {
        showToast('Mindestens ein Eintrag erforderlich');
      }
      return;
    }

    // Add finisher set (NORMAL type)
    if (e.target.closest('.add-finisher-set')) {
      const entry = e.target.closest('.finisher-entry');
      const setsContainer = entry.querySelector('.finisher-sets-container');
      const count = setsContainer.querySelectorAll('.set-row').length;
      const newSet = { setId: uuid(), label: `Satz ${count + 1}`, reps: 0, rpe: 5, note: '' };
      setsContainer.insertAdjacentHTML('beforeend', renderSetRow(newSet, count));
      return;
    }

    // Remove set in finisher
    if (e.target.closest('.remove-set')) {
      const setRow = e.target.closest('.set-row');
      const setsContainer = setRow.closest('.finisher-sets-container');
      if (setsContainer && setsContainer.querySelectorAll('.set-row').length > 1) {
        setRow.remove();
        rebuildSetLabelsInDOM(setsContainer, 'normal');
      }
    }
  });
}

function rebuildSetsForMode(card, newMode) {
  const setsContainer = card.querySelector('.sets-container');
  const currentSets = Array.from(setsContainer.querySelectorAll('.set-row'));

  // Collect values (stepper inputs use .stepper__input.set-reps / .set-rpe)
  const values = currentSets.map(row => ({
    reps: parseInt(row.querySelector('.set-reps').value) || 0,
    rpe: parseInt(row.querySelector('.set-rpe').value) || 5,
    note: row.querySelector('.set-note').value || ''
  }));

  // Clear and rebuild
  setsContainer.innerHTML = '';

  if (newMode === 'lr') {
    // Convert to pairs — take first values and duplicate
    const pairCount = Math.max(1, Math.ceil(values.length / 2));
    for (let p = 0; p < pairCount; p++) {
      const vi = p * 2;
      const leftVal = values[vi] || { reps: 0, rpe: 5, note: '' };
      const rightVal = values[vi + 1] || { reps: 0, rpe: 5, note: '' };
      const leftSet = { setId: uuid(), label: `Satz ${p + 1} (links)`, ...leftVal };
      const rightSet = { setId: uuid(), label: `Satz ${p + 1} (rechts)`, ...rightVal };
      setsContainer.insertAdjacentHTML('beforeend', renderSetRow(leftSet, p * 2));
      setsContainer.insertAdjacentHTML('beforeend', renderSetRow(rightSet, p * 2 + 1));
    }
  } else {
    // Normal mode
    const count = Math.max(1, values.length);
    for (let i = 0; i < count; i++) {
      const val = values[i] || { reps: 0, rpe: 5, note: '' };
      const set = { setId: uuid(), label: `Satz ${i + 1}`, ...val };
      setsContainer.insertAdjacentHTML('beforeend', renderSetRow(set, i));
    }
  }
}

function rebuildSetLabelsInDOM(container, mode) {
  const rows = container.querySelectorAll('.set-row');
  rows.forEach((row, i) => {
    const labelEl = row.querySelector('.set-label');
    let label = '';
    if (mode === 'lr') {
      const pairNum = Math.floor(i / 2) + 1;
      const side = i % 2 === 0 ? 'links' : 'rechts';
      label = `Satz ${pairNum} (${side})`;
    } else {
      label = `Satz ${i + 1}`;
    }
    labelEl.dataset.rawLabel = label;
    let match = label.match(/\d+/);
    let numStr = match ? match[0] : (i + 1);
    let sideStr = '';
    if (label.includes('links')) sideStr = 'L';
    else if (label.includes('rechts')) sideStr = 'R';
    labelEl.innerHTML = `<div class="set-badge">${numStr}${sideStr ? `<div class="side">${sideStr}</div>` : ''}</div>`;
  });
}

function collectWorkoutFromForm() {
  const form = document.getElementById('workout-form');
  if (!form) return null;

  const workoutId = form.dataset.workoutId;
  const type = document.getElementById('workout-type').value;
  const name = document.getElementById('workout-name').value;

  // Exercises
  const exerciseCards = document.querySelectorAll('.exercise-card');
  const exercises = Array.from(exerciseCards).map(card => {
    const mode = card.querySelector('.mode-btn.btn-primary')?.dataset.mode || 'normal';
    const sets = Array.from(card.querySelectorAll('.sets-container .set-row')).map((row, i) => ({
      setId: row.dataset.setId || uuid(),
      label: row.querySelector('.set-label').dataset.rawLabel || row.querySelector('.set-label').textContent,
      reps: parseInt(row.querySelector('.set-reps')?.value) || 0,
      rpe: parseInt(row.querySelector('.set-rpe')?.value) || 5,
      note: row.querySelector('.set-note')?.value || ''
    }));
    return {
      exerciseId: card.dataset.exerciseId || uuid(),
      name: card.querySelector('.exercise-name').value,
      mode,
      sets
    };
  });

  // Finisher
  let finisher = null;
  const finisherToggle = document.getElementById('finisher-toggle');
  if (finisherToggle && finisherToggle.checked) {
    const block = document.querySelector('.finisher-block');
    if (block) {
      const type = block.dataset.finisherType || 'AMRAP';
      const entries = collectFinisherEntries();
      finisher = { type, entries };
    }
  }

  return {
    workoutId,
    type,
    name,
    date: new Date().toISOString(),
    exercises,
    finisher,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function collectFinisherEntries() {
  const entriesEls = document.querySelectorAll('.finisher-entry');
  const finisherType = document.querySelector('.finisher-block')?.dataset.finisherType || 'AMRAP';

  return Array.from(entriesEls).map(el => {
    const entry = {
      id: el.dataset.entryId || uuid(),
      name: el.querySelector('.finisher-entry-name')?.value || '',
      rpe: 5,
      note: '',
      result: '',
      sets: []
    };

    if (finisherType === 'NORMAL') {
      const setsContainer = el.querySelector('.finisher-sets-container');
      if (setsContainer) {
        entry.sets = Array.from(setsContainer.querySelectorAll('.set-row')).map((row, i) => ({
          setId: row.dataset.setId || uuid(),
          label: row.querySelector('.set-label').dataset.rawLabel || row.querySelector('.set-label').textContent,
          reps: parseInt(row.querySelector('.set-reps')?.value) || 0,
          rpe: parseInt(row.querySelector('.set-rpe')?.value) || 5,
          note: row.querySelector('.set-note')?.value || ''
        }));
      }
    } else {
      entry.result = el.querySelector('.finisher-result')?.value || '';
      entry.rpe = parseInt(el.querySelector('.finisher-rpe')?.value) || 5;
      entry.note = el.querySelector('.finisher-note')?.value || '';
    }

    return entry;
  });
}
