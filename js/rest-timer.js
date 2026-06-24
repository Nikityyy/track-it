let _activeRestTimer = null;

function renderRestTimerButton(isSkipped) {
  return `
    <button type="button" class="btn-icon rest-timer-btn" aria-label="Pause starten" title="Pause starten/pausieren"${isSkipped ? ' disabled' : ''}>
      ${icon('timer', 14)}
    </button>
  `;
}

function handleRestTimerButton(btn) {
  const row = btn.closest('.set-row');
  if (!row || row.classList.contains('skipped')) return;

  if (_activeRestTimer && _activeRestTimer.row === row) {
    pauseActiveRestTimer(true);
    return;
  }

  pauseActiveRestTimer(true);
  const input = row.querySelector('.set-break');
  const elapsedBefore = Math.max(0, parseInt(input?.value) || 0);
  _activeRestTimer = {
    row,
    btn,
    input,
    elapsedBefore,
    startedAt: Date.now(),
    interval: setInterval(updateActiveRestTimer, 1000)
  };
  btn.classList.add('active');
  btn.setAttribute('aria-label', 'Pause pausieren');
  btn.title = 'Pause pausieren';
  updateActiveRestTimer();
}

function pauseActiveRestTimer(shouldRecord) {
  if (!_activeRestTimer) return;
  updateActiveRestTimer();
  clearInterval(_activeRestTimer.interval);
  _activeRestTimer.btn.classList.remove('active');
  _activeRestTimer.btn.setAttribute('aria-label', 'Pause fortsetzen');
  _activeRestTimer.btn.title = 'Pause fortsetzen';
  _activeRestTimer = null;
  if (shouldRecord) recordFormHistory();
}

function updateActiveRestTimer() {
  if (!_activeRestTimer || !_activeRestTimer.input) return;
  const elapsed = _activeRestTimer.elapsedBefore + Math.floor((Date.now() - _activeRestTimer.startedAt) / 1000);
  _activeRestTimer.input.value = elapsed;
  _activeRestTimer.btn.title = `Pause läuft: ${formatDuration(elapsed) || '0 s'}`;
}
