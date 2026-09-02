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
  const elapsedBefore = Math.max(0, parseInt(input?.value, 10) || 0);
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
  if (_activeRestTimer.interval) {
    clearInterval(_activeRestTimer.interval);
  }
  if (_activeRestTimer.btn) {
    _activeRestTimer.btn.classList.remove('active');
    _activeRestTimer.btn.setAttribute('aria-label', 'Pause fortsetzen');
    _activeRestTimer.btn.title = 'Pause fortsetzen';
  }
  _activeRestTimer = null;
  if (shouldRecord && typeof recordFormHistory === 'function') {
    recordFormHistory();
  }
}

function updateActiveRestTimer() {
  if (!_activeRestTimer || !_activeRestTimer.input) return;

  const elapsedBefore = Number.isFinite(_activeRestTimer.elapsedBefore)
    ? Math.max(0, _activeRestTimer.elapsedBefore)
    : 0;
  const startedAt = Number.isFinite(_activeRestTimer.startedAt)
    ? _activeRestTimer.startedAt
    : Date.now();
  const diffSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  let elapsed = elapsedBefore + diffSeconds;

  if (!Number.isFinite(elapsed) || Number.isNaN(elapsed) || elapsed < 0) {
    elapsed = 0;
  }

  // Prevent layout overflow: cap at 24 hours (86400s)
  elapsed = Math.min(86400, Math.round(elapsed));

  _activeRestTimer.input.value = String(elapsed);
  const formatted = typeof formatDuration === 'function' ? formatDuration(elapsed) : `${elapsed} s`;
  if (_activeRestTimer.btn) {
    _activeRestTimer.btn.title = `Pause läuft: ${formatted || '0 s'}`;
  }
}
