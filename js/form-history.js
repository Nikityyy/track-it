let _formHistory = [];
let _formHistoryIndex = -1;
let _historyTimer = null;
let _isRestoringHistory = false;

function initFormHistory(workout, savedState) {
  if (savedState && Array.isArray(savedState.items) && savedState.items.length > 0) {
    _formHistory = savedState.items.map(cloneWorkout);
    _formHistoryIndex = Math.max(0, Math.min(savedState.index || 0, _formHistory.length - 1));
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
  _formHistoryIndex = _formHistory.length - 1;
  updateUndoRedoButtons();
}

function undoFormChange() {
  if (_formHistoryIndex <= 0) return;
  restoreHistoryAt(_formHistoryIndex - 1);
}

function redoFormChange() {
  if (_formHistoryIndex >= _formHistory.length - 1) return;
  restoreHistoryAt(_formHistoryIndex + 1);
}

function restoreHistoryAt(index) {
  const form = document.getElementById('workout-form');
  const types = Array.from(document.getElementById('workout-type').options).map(o => ({ id: o.value, name: o.value }));
  const isEdit = form.dataset.isEdit === 'true';
  const editId = form.dataset.editId || null;
  _isRestoringHistory = true;
  _formHistoryIndex = index;
  renderWorkoutForm(cloneWorkout(_formHistory[index]), types, isEdit, {
    editId,
    resetHistory: false
  });
  _isRestoringHistory = false;
  updateUndoRedoButtons();
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
