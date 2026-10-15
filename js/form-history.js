const MAX_HISTORY_STATES = 30;

let _formHistory = [];
let _formHistoryIndex = -1;
let _historyTimer = null;
let _isRestoringHistory = false;

function initFormHistory(workout, savedState) {
  if (savedState && Array.isArray(savedState.items) && savedState.items.length > 0) {
    let items = savedState.items.map(cloneWorkout);
    let index = savedState.index || 0;
    if (items.length > MAX_HISTORY_STATES) {
      const excess = items.length - MAX_HISTORY_STATES;
      items = items.slice(excess);
      index = Math.max(0, index - excess);
    }
    _formHistory = items;
    _formHistoryIndex = Math.max(0, Math.min(index, _formHistory.length - 1));
  } else {
    _formHistory = [cloneWorkout(workout)];
    _formHistoryIndex = 0;
  }
  updateUndoRedoButtons();
}

function getFormHistoryState() {
  return {
    index: _formHistoryIndex,
    items: _formHistory.map(cloneWorkout)
  };
}

function scheduleHistoryRecord() {
  if (_isRestoringHistory) return;
  clearTimeout(_historyTimer);
  _historyTimer = setTimeout(recordFormHistory, 250);
}

function recordFormHistory() {
  if (_isRestoringHistory) return;
  const current = collectWorkoutFromForm();
  if (!current) return;
  const currentSnapshot = comparableWorkoutSnapshot(current);
  if (_formHistoryIndex >= 0 && comparableWorkoutSnapshot(_formHistory[_formHistoryIndex]) === currentSnapshot) return;

  _formHistory = _formHistory.slice(0, _formHistoryIndex + 1);
  _formHistory.push(cloneWorkout(current));
  if (_formHistory.length > MAX_HISTORY_STATES) {
    _formHistory.shift();
  }
  _formHistoryIndex = _formHistory.length - 1;
  updateUndoRedoButtons();
  if (typeof scheduleDraftSave === 'function') scheduleDraftSave();
}

function undoFormChange() {
  if (_formHistoryIndex <= 0) return;
  if (typeof window !== 'undefined' && window.haptic) window.haptic.trigger(20);
  restoreHistoryAt(_formHistoryIndex - 1);
}

function redoFormChange() {
  if (_formHistoryIndex >= _formHistory.length - 1) return;
  if (typeof window !== 'undefined' && window.haptic) window.haptic.trigger(20);
  restoreHistoryAt(_formHistoryIndex + 1);
}

function restoreHistoryAt(index) {
  const form = document.getElementById('workout-form');
  if (!form) return;

  const typesSelect = document.getElementById('workout-type');
  const types = typesSelect
    ? Array.from(typesSelect.options).map(o => ({ id: o.value, name: o.value }))
    : [];
  const isEdit = form.dataset.isEdit === 'true';
  const editId = form.dataset.editId || null;
  const targetWorkout = cloneWorkout(_formHistory[index]);

  _isRestoringHistory = true;
  _formHistoryIndex = index;

  const scrollX = typeof window !== 'undefined' ? window.scrollX : 0;
  const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;

  let activeInfo = null;
  if (typeof document !== 'undefined' && document.activeElement && form.contains(document.activeElement)) {
    const active = document.activeElement;
    activeInfo = {
      id: active.id || null,
      className: active.className || '',
      exerciseIndex: active.closest('.exercise-card')?.dataset.index,
      setIndex: active.closest('.set-row')?.dataset.index,
      selectionStart: typeof active.selectionStart === 'number' ? active.selectionStart : null,
      selectionEnd: typeof active.selectionEnd === 'number' ? active.selectionEnd : null
    };
  }

  const restoredInPlace = tryRestoreValuesInPlace(targetWorkout);
  if (!restoredInPlace) {
    renderWorkoutForm(targetWorkout, types, isEdit, {
      editId,
      resetHistory: false
    });

    if (typeof window !== 'undefined') {
      window.scrollTo(scrollX, scrollY);
    }

    if (activeInfo && typeof document !== 'undefined') {
      let targetEl = null;
      if (activeInfo.id) {
        targetEl = document.getElementById(activeInfo.id);
      } else if (activeInfo.exerciseIndex !== undefined) {
        const card = document.querySelector(`.exercise-card[data-index="${activeInfo.exerciseIndex}"]`);
        if (card) {
          if (activeInfo.setIndex !== undefined) {
            const row = card.querySelector(`.set-row[data-index="${activeInfo.setIndex}"]`);
            if (row) {
              if (activeInfo.className.includes('set-reps')) targetEl = row.querySelector('.set-reps');
              else if (activeInfo.className.includes('set-rpe')) targetEl = row.querySelector('.set-rpe');
              else if (activeInfo.className.includes('set-break')) targetEl = row.querySelector('.set-break');
            }
          } else if (activeInfo.className.includes('exercise-name')) {
            targetEl = card.querySelector('.exercise-name');
          }
        }
      }

      if (targetEl && typeof targetEl.focus === 'function') {
        targetEl.focus({ preventScroll: true });
        if (activeInfo.selectionStart !== null && typeof targetEl.setSelectionRange === 'function') {
          try {
            targetEl.setSelectionRange(activeInfo.selectionStart, activeInfo.selectionEnd);
          } catch {}
        }
      }
    }
  }

  _isRestoringHistory = false;
  updateUndoRedoButtons();
  if (typeof scheduleDraftSave === 'function') scheduleDraftSave();
}

function tryRestoreValuesInPlace(workout) {
  if (typeof document === 'undefined') return false;
  const form = document.getElementById('workout-form');
  if (!form) return false;

  const exerciseCards = Array.from(document.querySelectorAll('.exercise-card'));
  const expectedExercises = workout.exercises || [];
  if (exerciseCards.length !== expectedExercises.length) return false;

  for (let i = 0; i < exerciseCards.length; i++) {
    const card = exerciseCards[i];
    const ex = expectedExercises[i];
    const modeBtn = card.querySelector('.mode-btn.btn-primary');
    const currentMode = modeBtn ? modeBtn.dataset.mode : 'normal';
    if (currentMode !== (ex.mode || 'normal')) return false;

    const setRows = Array.from(card.querySelectorAll('.sets-container .set-row'));
    if (setRows.length !== (ex.sets || []).length) return false;
  }

  const finisherToggle = document.getElementById('finisher-toggle');
  const hasFinisherInWorkout = Boolean(workout.finisher && workout.finisher.type);
  const isToggleChecked = Boolean(finisherToggle && finisherToggle.checked);
  if (hasFinisherInWorkout !== isToggleChecked) return false;

  if (hasFinisherInWorkout) {
    const finisherBlock = document.querySelector('.finisher-block');
    if (!finisherBlock || finisherBlock.dataset.finisherType !== workout.finisher.type) return false;
    const entries = Array.from(document.querySelectorAll('.finisher-entry'));
    const expectedEntries = workout.finisher.entries || [];
    if (entries.length !== expectedEntries.length) return false;

    for (let i = 0; i < entries.length; i++) {
      const entryEl = entries[i];
      const entryData = expectedEntries[i];
      if (workout.finisher.type === 'NORMAL') {
        const entrySets = Array.from(entryEl.querySelectorAll('.finisher-sets-container .set-row'));
        if (entrySets.length !== (entryData.sets || []).length) return false;
      }
    }
  }

  // Restore workout meta values
  const typeSelect = document.getElementById('workout-type');
  if (typeSelect && typeSelect.value !== workout.type) {
    typeSelect.value = workout.type;
  }

  const nameInput = document.getElementById('workout-name');
  if (nameInput && nameInput.value !== workout.name) {
    nameInput.value = workout.name;
  }

  const dateInput = document.getElementById('workout-date');
  if (dateInput && typeof formatDateInputValue === 'function') {
    const dateVal = formatDateInputValue(workout.date);
    if (dateInput.value !== dateVal) dateInput.value = dateVal;
  }

  const timeInput = document.getElementById('workout-time');
  if (timeInput && typeof formatTimeInputValue === 'function') {
    const timeVal = formatTimeInputValue(workout.date);
    if (timeInput.value !== timeVal) timeInput.value = timeVal;
  }

  const notesInput = document.getElementById('workout-notes');
  if (notesInput && notesInput.value !== (workout.notes || '')) {
    notesInput.value = workout.notes || '';
  }

  // Restore exercise cards & sets
  for (let i = 0; i < exerciseCards.length; i++) {
    const card = exerciseCards[i];
    const ex = expectedExercises[i];

    const exNameInput = card.querySelector('.exercise-name');
    if (exNameInput && exNameInput.value !== (ex.name || '')) {
      exNameInput.value = ex.name || '';
    }

    const setRows = Array.from(card.querySelectorAll('.sets-container .set-row'));
    for (let si = 0; si < setRows.length; si++) {
      restoreSetRowValues(setRows[si], ex.sets[si], si);
    }
  }

  // Restore finisher values
  if (hasFinisherInWorkout) {
    const finisherNameInput = document.getElementById('finisher-name');
    if (finisherNameInput && finisherNameInput.value !== (workout.finisher.name || '')) {
      finisherNameInput.value = workout.finisher.name || '';
    }

    const entries = Array.from(document.querySelectorAll('.finisher-entry'));
    const expectedEntries = workout.finisher.entries || [];
    for (let i = 0; i < entries.length; i++) {
      const entryEl = entries[i];
      const entryData = expectedEntries[i];

      const entryNameInput = entryEl.querySelector('.finisher-entry-name');
      if (entryNameInput && entryNameInput.value !== (entryData.name || '')) {
        entryNameInput.value = entryData.name || '';
      }

      const isSkipped = Boolean(entryData.skipped);
      entryEl.classList.toggle('skipped', isSkipped);
      const skipBtn = entryEl.querySelector('.skip-btn');
      if (skipBtn) skipBtn.classList.toggle('active', isSkipped);

      if (workout.finisher.type === 'NORMAL') {
        const entrySets = Array.from(entryEl.querySelectorAll('.finisher-sets-container .set-row'));
        for (let si = 0; si < entrySets.length; si++) {
          restoreSetRowValues(entrySets[si], entryData.sets[si], si);
        }
      } else {
        const resInput = entryEl.querySelector('.finisher-result');
        if (resInput && resInput.value !== (entryData.result || '')) {
          resInput.value = entryData.result || '';
        }
        const rpeInput = entryEl.querySelector('.finisher-rpe');
        if (rpeInput && parseInt(rpeInput.value, 10) !== (entryData.rpe ?? 5)) {
          rpeInput.value = entryData.rpe ?? 5;
        }
        const noteInput = entryEl.querySelector('.finisher-note');
        if (noteInput && noteInput.value !== (entryData.note || '')) {
          noteInput.value = entryData.note || '';
        }
      }
    }
  }

  if (typeof updateExerciseIndices === 'function') {
    updateExerciseIndices();
  }

  return true;
}

function restoreSetRowValues(row, set, index) {
  const isSkipped = Boolean(set.skipped);
  row.classList.toggle('skipped', isSkipped);

  const skipBtn = row.querySelector('.skip-btn');
  if (skipBtn) skipBtn.classList.toggle('active', isSkipped);

  row.querySelectorAll('.stepper__btn, .stepper__input').forEach(el => {
    el.disabled = isSkipped;
  });

  const timerBtn = row.querySelector('.rest-timer-btn');
  if (timerBtn) timerBtn.disabled = isSkipped;

  const repsInput = row.querySelector('.set-reps');
  if (repsInput && parseInt(repsInput.value, 10) !== (set.reps || 0)) {
    repsInput.value = set.reps ?? 0;
  }

  const rpeInput = row.querySelector('.set-rpe');
  if (rpeInput && rpeInput.value !== String(set.rpe ?? '')) {
    rpeInput.value = set.rpe ?? '';
  }

  const breakInput = row.querySelector('.set-break');
  if (breakInput && parseInt(breakInput.value, 10) !== (set.breakSeconds || 0)) {
    breakInput.value = set.breakSeconds ?? 0;
  }

  const noteInput = row.querySelector('.set-note');
  if (noteInput && noteInput.value !== (set.note || '')) {
    noteInput.value = set.note || '';
  }

  const noteBtn = row.querySelector('.set-note-btn');
  if (noteBtn) {
    noteBtn.classList.toggle('has-note', Boolean(set.note));
  }

  const label = set.label || `Satz ${index + 1}`;
  const labelEl = row.querySelector('.set-label');
  if (labelEl) {
    labelEl.dataset.rawLabel = label;
    const sideStr = label.includes('links') ? 'L' : label.includes('rechts') ? 'R' : '';
    const match = label.match(/\d+/);
    const numStr = match ? match[0] : (index + 1);
    const badge = labelEl.querySelector('.set-badge');
    if (badge) {
      badge.innerHTML = `${numStr}${sideStr ? `<div class="side">${sideStr}</div>` : ''}`;
    }
  }
}

function updateUndoRedoButtons() {
  const undo = document.getElementById('btn-undo');
  const redo = document.getElementById('btn-redo');
  if (undo) undo.disabled = _formHistoryIndex <= 0;
  if (redo) redo.disabled = _formHistoryIndex >= _formHistory.length - 1;
}

function comparableWorkoutSnapshot(workout) {
  const copy = cloneWorkout(workout);
  delete copy.updatedAt;
  return JSON.stringify(copy);
}
