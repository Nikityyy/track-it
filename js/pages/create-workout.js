let _draftTimer = null;
let _draftSaveTimer = null;
let _savedSuccessfully = false;
let _editorRenderToken = 0;
let _draftBaselineSnapshot = null;
let _lastDraftSnapshot = null;

const DRAFT_AUTO_OPEN_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function getDraftPath(draft) {
  return draft && draft.isEdit && draft.editId ? `/edit/${draft.editId}?draft=1` : '/create?draft=1';
}

/* Ask what to do when a different unsaved workout is still open.
 * Resolves true to discard it and continue, false to go back to it. */
function askAboutOpenDraft(draft) {
  return new Promise(resolve => {
    showModal({
      title: 'Ungespeichertes Workout',
      bodyText: `„${draft.workout.name || 'Unbenanntes Workout'}“ ist noch nicht gespeichert. Möchtest du es fortsetzen oder verwerfen?`,
      confirmText: 'Verwerfen',
      cancelText: 'Fortsetzen',
      danger: true,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false)
    });
  });
}

async function renderCreateWorkoutPage(params) {
  const app = document.getElementById('app-content');
  const token = ++_editorRenderToken;
  let isEdit = !!(params && params.id);
  const isDraftResume = window.location.hash.includes('draft=1');
  const types = await getWorkoutTypes();
  let draft = await getDraft();
  let workout = null;
  let editId = params && params.id ? params.id : null;
  let fromDraft = false;

  if (draft && draft.workout && !isDraftResume) {
    const sameWorkout = isEdit && draft.isEdit && draft.editId === editId;
    if (sameWorkout) {
      // Unsaved changes to this very workout: continue with them
      workout = draft.workout;
      fromDraft = true;
      showToast('Ungespeicherte Änderungen wiederhergestellt');
    } else {
      const discard = await askAboutOpenDraft(draft);
      if (token !== _editorRenderToken) return;
      if (!discard) {
        Router.navigate(getDraftPath(draft), { replace: true });
        return;
      }
      await clearDraft();
      draft = null;
    }
  }

  if (isEdit && !workout) {
    if (isDraftResume && draft?.isEdit && draft.editId === editId && draft.workout) {
      workout = draft.workout;
      fromDraft = true;
    } else {
      workout = await getWorkout(editId);
    }
    if (!workout) {
      if (token !== _editorRenderToken) return;
      app.innerHTML = `<div class="page"><div class="empty-state"><p class="empty-state-text">Workout nicht gefunden.</p></div></div>`;
      return;
    }
  } else if (!isEdit && isDraftResume && draft?.workout) {
    workout = draft.workout;
    fromDraft = true;
    if (draft.isEdit && draft.editId) {
      isEdit = true;
      editId = draft.editId;
    }
  }

  // "Wiederholen": a past workout's structure, with empty values
  const repeatFrom = !workout && !isEdit ? new URLSearchParams(window.location.hash.split('?')[1] || '').get('from') : null;
  if (repeatFrom) {
    const source = await getWorkout(repeatFrom);
    if (source) {
      workout = buildRepeatWorkout(source);
      showToast('Übungen aus „' + (source.name || source.type) + '“ übernommen');
    }
    // A reload should not rebuild the template over unsaved changes
    try { history.replaceState(history.state, '', '#/create'); } catch (e) { /* ignore */ }
  }

  if (!workout) {
    workout = createEmptyWorkout(types.length > 0 ? types[0].name : '');
  }

  // The user may have navigated away while we were loading
  if (token !== _editorRenderToken) return;

  renderWorkoutForm(workout, types, isEdit, {
    editId,
    resetHistory: true,
    formHistory: fromDraft && draft ? draft.formHistory : null
  });

  // A draft is only worth keeping once the form differs from what was opened.
  // Anything resumed from a draft already is one.
  const opened = collectWorkoutFromForm();
  _draftBaselineSnapshot = fromDraft || !opened ? null : comparableWorkoutSnapshot(opened);
  _lastDraftSnapshot = fromDraft && opened ? comparableWorkoutSnapshot(opened) : null;
  window._hasUnsavedChanges = fromDraft;

  startAutoDraft();
  acquireWakeLock();

  // Exercise name suggestions come from everything logged so far
  _exerciseIndex = null;
  getAllWorkouts().then(all => {
    if (token === _editorRenderToken) _exerciseIndex = buildExerciseIndex(all);
  }).catch(() => {});
}

/* ── Exercise name suggestions ──
 * A small list under the focused name field: likely exercises before you
 * type, best matches while you type. Tapping one fills the name as you last
 * wrote it (with its weight). */
let _exerciseIndex = null;
let _suggestFor = null;

function nameSuggestTarget(el) {
  return el && el.matches && el.matches('.exercise-name, .finisher-entry-name') ? el : null;
}

function showNameSuggestions(input) {
  if (!_exerciseIndex || !input.isConnected) return hideNameSuggestions();
  const others = Array.from(document.querySelectorAll('.exercise-name, .finisher-entry-name'))
    .filter(el => el !== input).map(el => el.value).filter(Boolean);
  const items = suggestExercises(_exerciseIndex, input.value, {
    type: document.getElementById('workout-type')?.value || '',
    exclude: others,
    limit: 5
  });
  if (!items.length) return hideNameSuggestions();

  const header = input.closest('.exercise-card-header, .finisher-entry-header');
  let panel = document.getElementById('name-suggest');
  if (!panel || panel.parentElement !== header) {
    panel?.remove();
    panel = document.createElement('div');
    panel.id = 'name-suggest';
    panel.className = 'name-suggest';
    panel.setAttribute('role', 'listbox');
    header.appendChild(panel);
  }
  _suggestFor = input;
  const heading = input.value.trim() ? '' : '<div class="name-suggest-heading">Zuletzt trainiert</div>';
  panel.innerHTML = heading + items.map((item, i) => `
    <button type="button" class="name-suggest-item" role="option" data-index="${i}" data-value="${escapeHtml(item.latestName)}">
      <span class="name-suggest-name">${highlightMatch(item.latestName, input.value)}</span>
      <span class="name-suggest-meta">${item.count}×</span>
    </button>`).join('');
  requestAnimationFrame(() => panel.classList.add('is-open'));
}

function hideNameSuggestions() {
  _suggestFor = null;
  document.getElementById('name-suggest')?.remove();
}

function pickNameSuggestion(button) {
  const input = _suggestFor;
  if (!input) return;
  input.value = button.dataset.value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  if (window.haptic) window.haptic.trigger(15);
  hideNameSuggestions();
  input.blur();
}

/* Keep the screen on while a workout is being logged (iOS 16.4+, Android).
 * The system drops the lock whenever the app is hidden; it is re-acquired
 * when the editor becomes visible again. */
let _wakeLock = null;

async function acquireWakeLock() {
  if (typeof navigator === 'undefined' || !navigator.wakeLock || _wakeLock) return;
  if (document.visibilityState !== 'visible' || !document.getElementById('workout-form')) return;
  try {
    _wakeLock = await navigator.wakeLock.request('screen');
    _wakeLock.addEventListener('release', () => { _wakeLock = null; });
    // Left the editor while the request was pending
    if (!document.getElementById('workout-form')) releaseWakeLock();
  } catch (e) {
    _wakeLock = null; // denied (e.g. low power mode): nothing to do
  }
}

function releaseWakeLock() {
  if (_wakeLock) {
    _wakeLock.release().catch(() => {});
    _wakeLock = null;
  }
}

function buildRepeatWorkout(source) {
  const emptySet = (set, i, mode) => ({
    ...createEmptySet(i, mode),
    label: set && set.label ? set.label : createEmptySet(i, mode).label,
    skipped: false
  });
  const base = createEmptyWorkout(source.type || '');
  const generated = /^.+ – \d{2}\.\d{2}\.\d{4}$/.test(source.name || '');
  return {
    ...base,
    name: generated || !source.name ? base.name : source.name,
    exercises: (source.exercises || []).length
      ? source.exercises.map(ex => ({
        exerciseId: uuid(),
        name: ex.name || '',
        mode: ex.mode === 'lr' ? 'lr' : 'normal',
        sets: (ex.sets && ex.sets.length ? ex.sets : [null]).map((set, i) => emptySet(set, i, ex.mode))
      }))
      : base.exercises,
    finisher: source.finisher && source.finisher.type ? {
      type: source.finisher.type,
      name: source.finisher.name || '',
      entries: (source.finisher.entries || []).map(entry => ({
        ...createEmptyFinisherEntry(),
        name: entry.name || '',
        mode: entry.mode === 'lr' ? 'lr' : 'normal',
        skipped: false,
        sets: (entry.sets || []).map((set, i) => emptySet(set, i, entry.mode))
      }))
    } : null,
    notes: ''
  };
}

function leaveWorkoutEditor() {
  _editorRenderToken++;
  releaseWakeLock();
  if (typeof suspendActiveRestTimer === 'function') suspendActiveRestTimer();
  stopAutoDraft();
}

function cloneWorkout(workout) {
  return JSON.parse(JSON.stringify(workout));
}

function startAutoDraft() {
  stopAutoDraft(false);
  _savedSuccessfully = false;
  // Safety net; the real saves happen on every change and when the app is hidden
  _draftTimer = setInterval(saveCurrentDraft, 3000);
}

function scheduleDraftSave() {
  clearTimeout(_draftSaveTimer);
  _draftSaveTimer = setTimeout(saveCurrentDraft, 400);
}

function saveCurrentDraft() {
  clearTimeout(_draftSaveTimer);
  _draftSaveTimer = null;
  if (_savedSuccessfully) return;
  const workout = collectWorkoutFromForm();
  if (!workout) return;
  const snapshot = comparableWorkoutSnapshot(workout);

  if (_draftBaselineSnapshot !== null && snapshot === _draftBaselineSnapshot) {
    // Back to exactly what was opened: nothing to keep
    if (_lastDraftSnapshot !== null) {
      _lastDraftSnapshot = null;
      window._hasUnsavedChanges = false;
      clearDraft();
    }
    return;
  }
  if (snapshot === _lastDraftSnapshot) return;

  _lastDraftSnapshot = snapshot;
  window._hasUnsavedChanges = true;
  saveDraft({ ...getDraftMeta(), workout, formHistory: getFormHistoryState() });
}

function stopAutoDraft(shouldSave = true) {
  if (shouldSave && !_savedSuccessfully) saveCurrentDraft();
  clearTimeout(_draftSaveTimer);
  _draftSaveTimer = null;
  if (_draftTimer) {
    clearInterval(_draftTimer);
    _draftTimer = null;
  }
}

// Closing or backgrounding the app (iOS gives no unload event for PWAs)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.getElementById('workout-form')) return;
    if (document.visibilityState === 'hidden') saveCurrentDraft();
    else acquireWakeLock();
  });
  window.addEventListener('pagehide', () => {
    if (document.getElementById('workout-form')) saveCurrentDraft();
  });
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
        <button type="button" class="btn-icon" id="btn-back-editor" aria-label="Zurück">${icon('chevronLeft', 20)}</button>
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
            ${workout.exercises.map((ex, i) => renderExerciseCard(ex, i, workout.exercises.length)).join('')}
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

        <div class="form-section">
          <div class="section-header">
            <h3 class="section-title">Notizen</h3>
          </div>
          <textarea id="workout-notes" class="input" placeholder="Notizen zum Workout (optional)..." rows="3">${escapeHtml(workout.notes || '')}</textarea>
        </div>

        <div class="form-actions form-actions-sticky">
          <button type="button" class="btn btn-ghost btn-round" id="btn-undo" aria-label="Rückgängig" title="Rückgängig" disabled>${icon('undo', 18)}</button>
          <button type="button" class="btn btn-ghost btn-round" id="btn-redo" aria-label="Wiederholen" title="Wiederholen" disabled>${icon('redo', 18)}</button>
          <button type="button" class="btn btn-ghost" id="btn-cancel">Abbrechen</button>
          <button type="button" class="btn btn-primary" id="btn-save-workout">Speichern</button>
        </div>
      </form>
    </div>
  `;

  bindFormEvents(workout);
  if (options.resetHistory) initFormHistory(workout, options.formHistory);
  updateExerciseIndices();
  updateSetDeleteStates();
  updateUndoRedoButtons();
  if (typeof resumePersistedRestTimer === 'function') resumePersistedRestTimer();
}

function renderExerciseCard(exercise, index, totalCount = 1) {
  const isTop = index === 0;
  const isBottom = index === totalCount - 1;
  return `
    <div class="card exercise-card" data-exercise-id="${escapeHtml(exercise.exerciseId)}" data-index="${index}">
      <div class="exercise-card-header">
        <input type="text" class="input exercise-name" value="${escapeHtml(exercise.name)}" placeholder="Übungsname" aria-label="Übungsname">
        <button type="button" class="btn-icon exercise-move-up${isTop ? ' disabled' : ''}" aria-label="Nach oben verschieben" title="Nach oben"${isTop ? ' disabled aria-disabled="true"' : ''}>${icon('chevronUp', 16)}</button>
        <button type="button" class="btn-icon exercise-move-down${isBottom ? ' disabled' : ''}" aria-label="Nach unten verschieben" title="Nach unten"${isBottom ? ' disabled aria-disabled="true"' : ''}>${icon('chevronDown', 16)}</button>
        <button type="button" class="btn-icon btn-danger-icon remove-exercise" aria-label="Übung entfernen">${icon('trash', 16)}</button>
      </div>
      <div class="exercise-mode-toggle">
        <button type="button" class="btn btn-sm ${exercise.mode === 'normal' ? 'btn-primary' : 'btn-ghost'} mode-btn" data-mode="normal">Normal</button>
        <button type="button" class="btn btn-sm ${exercise.mode === 'lr' ? 'btn-primary' : 'btn-ghost'} mode-btn" data-mode="lr">Links/Rechts</button>
        ${renderLrSwapButton(exercise.sets)}
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
      ${renderNumberStepper('rpe', 'set-rpe', set.rpe ?? '', 1, 10, isSkipped, 'RPE')}
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
      <button type="button" class="stepper__btn stepper-dec" data-target="${target}" data-step="${step}" aria-label="Weniger"${disabled ? ' disabled' : ''}>−</button>
      <input type="number" class="stepper__input ${inputClass}" value="${value}"${target === 'rpe' ? ' placeholder="RPE"' : ''} min="${min}"${maxAttr} step="${step}" aria-label="${label}"${disabled ? ' disabled' : ''}>
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
      : [{ setId: uuid(), label: 'Satz 1', reps: 0, rpe: null, breakSeconds: 0, note: '', skipped: false }];
    return `
      <div class="card finisher-entry${isSkipped ? ' skipped' : ''}" data-entry-id="${escapeHtml(entry.id || uuid())}" data-index="${index}">
        ${renderFinisherEntryHeader(entry, isSkipped)}
        <div class="exercise-mode-toggle">
          <button type="button" class="btn btn-sm ${entry.mode === 'lr' ? 'btn-ghost' : 'btn-primary'} mode-btn" data-mode="normal">Normal</button>
          <button type="button" class="btn btn-sm ${entry.mode === 'lr' ? 'btn-primary' : 'btn-ghost'} mode-btn" data-mode="lr">Links/Rechts</button>
          ${renderLrSwapButton(entry.sets)}
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

  form.addEventListener('input', (e) => {
    scheduleHistoryRecord();
    scheduleDraftSave();
    if (nameSuggestTarget(e.target) && e.isTrusted !== false && document.activeElement === e.target) showNameSuggestions(e.target);
  });
  form.addEventListener('focusin', (e) => {
    if (nameSuggestTarget(e.target)) showNameSuggestions(e.target);
  });
  form.addEventListener('focusout', (e) => {
    if (nameSuggestTarget(e.target)) setTimeout(() => { if (document.activeElement !== _suggestFor) hideNameSuggestions(); }, 300);
  });
  form.addEventListener('keydown', (e) => {
    if (!_suggestFor || e.target !== _suggestFor) return;
    if (e.key === 'Escape') hideNameSuggestions();
    if (e.key === 'Enter') {
      const first = document.querySelector('#name-suggest .name-suggest-item');
      if (first && _suggestFor.value.trim()) { e.preventDefault(); pickNameSuggestion(first); }
    }
  });
  // Pick on touch-down: instant, and the field keeps focus until we choose
  form.addEventListener('pointerdown', (e) => {
    const item = e.target.closest && e.target.closest('.name-suggest-item');
    if (!item) return;
    e.preventDefault();
    pickNameSuggestion(item);
  });
  form.addEventListener('click', (e) => {
    const item = e.target.closest && e.target.closest('.name-suggest-item');
    if (item && _suggestFor) pickNameSuggestion(item);
  }, true);
  form.addEventListener('change', (e) => {
    clampNumberInput(e.target);
    scheduleHistoryRecord();
    scheduleDraftSave();
  });

  // Leaving keeps the workout as a draft; nothing is lost, so no prompt
  document.getElementById('btn-back-editor').addEventListener('click', () => {
    Router.back(form.dataset.isEdit === 'true' ? '/workout/' + form.dataset.editId : '/');
  });

  document.getElementById('btn-undo').addEventListener('click', undoFormChange);
  document.getElementById('btn-redo').addEventListener('click', redoFormChange);

  const addExercise = () => {
    window._hasUnsavedChanges = true;
    const container = document.getElementById('exercises-container');
    container.insertAdjacentHTML('beforeend', renderExerciseCard(createEmptyExercise(), container.children.length, container.children.length + 1));
    updateExerciseIndices();
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

    const moveUpBtn = e.target.closest('.exercise-move-up');
    if (moveUpBtn && !moveUpBtn.disabled && !moveUpBtn.classList.contains('disabled')) {
      const prev = card.previousElementSibling;
      if (prev && prev.classList.contains('exercise-card')) {
        card.parentElement.insertBefore(card, prev);
        window._hasUnsavedChanges = true;
        if (window.haptic) window.haptic.trigger(20);
        updateExerciseIndices();
        recordFormHistory();
      }
      return;
    }

    const moveDownBtn = e.target.closest('.exercise-move-down');
    if (moveDownBtn && !moveDownBtn.disabled && !moveDownBtn.classList.contains('disabled')) {
      const next = card.nextElementSibling;
      if (next && next.classList.contains('exercise-card')) {
        card.parentElement.insertBefore(next, card);
        window._hasUnsavedChanges = true;
        if (window.haptic) window.haptic.trigger(20);
        updateExerciseIndices();
        recordFormHistory();
      }
      return;
    }

    if (e.target.closest('.remove-exercise')) {
      confirmRemove('Übung entfernen', 'Diese Übung wirklich entfernen?', () => {
        const container = document.getElementById('exercises-container');
        if (container.children.length > 1) {
          card.remove();
          updateExerciseIndices();
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

    if (e.target.closest('.lr-swap')) {
      swapLrOrder(card);
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
      const set = collectSetFromRow(row);
      const isDefault = (set.reps === 0 || set.reps === '0') &&
        (set.rpe == null || set.rpe === 5 || set.rpe === '5') &&
        (set.breakSeconds === 0 || set.breakSeconds === '0') &&
        !set.note;

      if (isDefault) {
        if (window.haptic) window.haptic.trigger(40);
        removeSetFromCard(card, row);
        recordFormHistory();
      } else {
        confirmRemove('Satz entfernen', 'Diesen Satz wirklich entfernen?', () => {
          removeSetFromCard(card, row);
          recordFormHistory();
        });
      }
      return;
    }
  });

  document.getElementById('finisher-toggle').addEventListener('change', (e) => {
    if (window.haptic) window.haptic.trigger(e.target.checked ? 40 : 20);
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
    // A change from the last moment may still be waiting for its debounced save
    saveCurrentDraft();
    const draft = await getDraft();
    const hasActiveDraftOrChanges = window._hasUnsavedChanges || (draft && draft.workout);

    const performCancel = async () => {
      pauseActiveRestTimer(false);
      stopAutoDraft(false);
      _savedSuccessfully = true;
      window._hasUnsavedChanges = false;
      await clearDraft();
      Router.back(form.dataset.isEdit === 'true' ? '/workout/' + form.dataset.editId : '/');
    };

    if (hasActiveDraftOrChanges) {
      showModal({
        title: 'Entwurf verwerfen?',
        bodyText: 'Möchtest du die ungespeicherten Änderungen wirklich verwerfen oder weiter bearbeiten?',
        confirmText: 'Verwerfen',
        cancelText: 'Weiter bearbeiten',
        danger: true,
        onConfirm: performCancel
      });
    } else {
      await performCancel();
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
    _savedSuccessfully = true;
    window._hasUnsavedChanges = false;

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
    // Replace the editor in history: back from the workout must not reopen it
    const detailHash = '#/workout/' + w.workoutId;
    if (Router.previousHash() === detailHash) {
      Router.back('/workout/' + w.workoutId);
    } else {
      Router.navigate('/workout/' + w.workoutId, { replace: true });
    }
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

    const swapBtn = e.target.closest('.lr-swap');
    if (swapBtn) {
      const entry = swapBtn.closest('.finisher-entry');
      if (entry) {
        swapLrOrder(entry);
        recordFormHistory();
      }
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
      const set = collectSetFromRow(row);
      const isDefault = (set.reps === 0 || set.reps === '0') &&
        (set.rpe == null || set.rpe === 5 || set.rpe === '5') &&
        (set.breakSeconds === 0 || set.breakSeconds === '0') &&
        !set.note;

      if (isDefault) {
        if (window.haptic) window.haptic.trigger(40);
        removeSetFromCard(row.closest('.finisher-entry'), row);
        recordFormHistory();
      } else {
        confirmRemove('Satz entfernen', 'Diesen Satz wirklich entfernen?', () => {
          removeSetFromCard(row.closest('.finisher-entry'), row);
          recordFormHistory();
        });
      }
    }
  });
}

function updateExerciseIndices() {
  const cards = document.querySelectorAll('#exercises-container .exercise-card');
  const total = cards.length;
  cards.forEach((c, idx) => {
    c.dataset.index = idx;
    const upBtn = c.querySelector('.exercise-move-up');
    const downBtn = c.querySelector('.exercise-move-down');
    if (upBtn) {
      const isTop = idx === 0;
      upBtn.disabled = isTop;
      upBtn.classList.toggle('disabled', isTop);
      if (isTop) upBtn.setAttribute('aria-disabled', 'true');
      else upBtn.removeAttribute('aria-disabled');
    }
    if (downBtn) {
      const isBottom = idx === total - 1;
      downBtn.disabled = isBottom;
      downBtn.classList.toggle('disabled', isBottom);
      if (isBottom) downBtn.setAttribute('aria-disabled', 'true');
      else downBtn.removeAttribute('aria-disabled');
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
  if (input.classList.contains('set-rpe') && input.value === '') return;
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
  if (window.haptic) window.haptic.trigger(isNowSkipped ? 'warning' : 20);
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
  if (window.haptic) window.haptic.trigger('selection');
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
  const rows = setsContainer.querySelectorAll('.set-row');
  if (mode === 'lr') {
    const pairNum = Math.floor(count / 2) + 1;
    // New pairs follow this exercise's own order; RPE carries over per side
    const [firstSide, secondSide] = getContainerSides(setsContainer);
    const firstRpe = count >= 2 ? readRpeInput(rows[count - 2]) : null;
    const secondRpe = count >= 1 ? readRpeInput(rows[count - 1]) : null;
    setsContainer.insertAdjacentHTML('beforeend', renderSetRow({ setId: uuid(), label: `Satz ${pairNum} (${firstSide})`, reps: 0, rpe: firstRpe, breakSeconds: 0, note: '', skipped: false }, count));
    setsContainer.insertAdjacentHTML('beforeend', renderSetRow({ setId: uuid(), label: `Satz ${pairNum} (${secondSide})`, reps: 0, rpe: secondRpe, breakSeconds: 0, note: '', skipped: false }, count + 1));
  } else {
    const newSet = createEmptySet(count, 'normal');
    newSet.rpe = count >= 1 ? readRpeInput(rows[count - 1]) : null;
    setsContainer.insertAdjacentHTML('beforeend', renderSetRow(newSet, count));
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
    rpe: readRpeInput(row),
    breakSeconds: parseInt(row.querySelector('.set-break')?.value) || 0,
    note: row.querySelector('.set-note')?.value || '',
    skipped: row.classList.contains('skipped')
  }));

  setsContainer.innerHTML = '';
  if (newMode === 'lr') {
    const [firstSide, secondSide] = lrSides();
    values.forEach((val, i) => {
      setsContainer.insertAdjacentHTML('beforeend', renderSetRow({ setId: uuid(), label: `Satz ${i + 1} (${firstSide})`, ...val }, i * 2));
      setsContainer.insertAdjacentHTML('beforeend', renderSetRow({ setId: uuid(), label: `Satz ${i + 1} (${secondSide})`, ...val }, i * 2 + 1));
    });
  } else {
    const count = Math.ceil(values.length / 2);
    for (let i = 0; i < count; i++) {
      const val = values[i * 2] || { reps: 0, rpe: null, breakSeconds: 0, note: '', skipped: false };
      setsContainer.insertAdjacentHTML('beforeend', renderSetRow({ setId: uuid(), label: `Satz ${i + 1}`, ...val }, i));
    }
  }
  updateSetDeleteStates(card);
  updateLrSwapButton(card);
}

/* Order of an L/R exercise = the side of its first set; the setting decides
 * only for exercises that have no sides yet. */
function getContainerSides(container) {
  const first = container.querySelector('.set-row .set-label');
  const label = first ? first.dataset.rawLabel || '' : '';
  if (label.includes('rechts')) return ['rechts', 'links'];
  if (label.includes('links')) return ['links', 'rechts'];
  return lrSides();
}

function renderLrSwapButton(sets) {
  const firstLabel = sets && sets[0] ? String(sets[0].label || '') : '';
  const rightFirst = firstLabel.includes('rechts') || (!firstLabel.includes('links') && getLrOrder() === 'right');
  return `<button type="button" class="btn btn-sm btn-ghost lr-swap" aria-label="Seitenreihenfolge tauschen" title="Seitenreihenfolge tauschen">${rightFirst ? 'R → L' : 'L → R'} <span aria-hidden="true">⇄</span></button>`;
}

function updateLrSwapButton(card) {
  const btn = card.querySelector('.lr-swap');
  if (!btn) return;
  const [firstSide] = getContainerSides(getSetsContainer(card));
  btn.innerHTML = `${firstSide === 'rechts' ? 'R → L' : 'L → R'} <span aria-hidden="true">⇄</span>`;
}

/* Swap which side comes first in every pair. Rows move, so each set keeps
 * its values and its side; only the order changes. */
function swapLrOrder(card) {
  const container = getSetsContainer(card);
  const rows = Array.from(container.querySelectorAll('.set-row'));
  for (let i = 0; i + 1 < rows.length; i += 2) {
    container.insertBefore(rows[i + 1], rows[i]);
  }
  container.querySelectorAll('.set-row').forEach((row, i) => {
    const labelEl = row.querySelector('.set-label');
    const own = (labelEl.dataset.rawLabel || '').includes('rechts') ? 'rechts' : 'links';
    writeSetLabel(row, `Satz ${Math.floor(i / 2) + 1} (${own})`, i);
  });
  if (window.haptic) window.haptic.trigger(20);
  updateLrSwapButton(card);
}

function writeSetLabel(row, label, i) {
  const labelEl = row.querySelector('.set-label');
  labelEl.dataset.rawLabel = label;
  row.dataset.index = i;
  const sideStr = label.includes('links') ? 'L' : label.includes('rechts') ? 'R' : '';
  const numStr = label.match(/\d+/)?.[0] || (i + 1);
  labelEl.innerHTML = `<div class="set-badge">${numStr}${sideStr ? `<div class="side">${sideStr}</div>` : ''}</div>`;
}

function rebuildSetLabelsInDOM(container, mode) {
  const sides = mode === 'lr' ? getContainerSides(container) : null;
  container.querySelectorAll('.set-row').forEach((row, i) => {
    const label = mode === 'lr' ? `Satz ${Math.floor(i / 2) + 1} (${sides[i % 2]})` : `Satz ${i + 1}`;
    writeSetLabel(row, label, i);
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
    notes: document.getElementById('workout-notes')?.value.trim() || '',
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
    rpe: readRpeInput(row),
    breakSeconds: parseInt(row.querySelector('.set-break')?.value) || 0,
    note: row.querySelector('.set-note')?.value || '',
    skipped: row.classList.contains('skipped')
  };
}

function readRpeInput(row) {
  const value = parseInt(row?.querySelector('.set-rpe')?.value, 10);
  return Number.isFinite(value) ? value : null;
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
