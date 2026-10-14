let _activeRestTimer = null;

function renderRestTimerButton(isSkipped) {
  return `
    <button type="button" class="btn-icon rest-timer-btn" aria-label="Pause starten" title="Pause starten/pausieren"${isSkipped ? ' disabled' : ''}>
      ${icon('timer', 14)}
    </button>
  `;
}

/* A running rest timer is persisted as { setId, startedAt, elapsedBefore }.
 * Elapsed time is always derived from the wall clock, so the timer keeps
 * counting while the app is closed and picks up where it should on reopen. */
const REST_TIMER_STORAGE_KEY = 'trackit-rest-timer';

function persistRestTimer(state) {
  try {
    if (state) localStorage.setItem(REST_TIMER_STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(REST_TIMER_STORAGE_KEY);
  } catch (e) { /* storage unavailable: timer still runs in memory */ }
}

function readPersistedRestTimer() {
  try {
    const raw = localStorage.getItem(REST_TIMER_STORAGE_KEY);
    const state = raw ? JSON.parse(raw) : null;
    if (!state || !state.setId || !Number.isFinite(state.startedAt)) return null;
    return state;
  } catch (e) {
    return null;
  }
}

function startRestTimer(row, btn, elapsedBefore, startedAt) {
  const input = row.querySelector('.set-break');
  _activeRestTimer = {
    row,
    btn,
    input,
    elapsedBefore,
    startedAt,
    interval: setInterval(updateActiveRestTimer, 1000)
  };
  btn.classList.add('active');
  btn.setAttribute('aria-label', 'Pause pausieren');
  btn.title = 'Pause pausieren';
  persistRestTimer({ setId: row.dataset?.setId, startedAt, elapsedBefore });
  updateActiveRestTimer();
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
  startRestTimer(row, btn, elapsedBefore, Date.now());
}

function pauseActiveRestTimer(shouldRecord) {
  if (!_activeRestTimer) {
    persistRestTimer(null);
    return;
  }
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
  persistRestTimer(null);
  if (shouldRecord && typeof recordFormHistory === 'function') {
    recordFormHistory();
  }
}

/* Leaving the editor (or the page being torn down): stop ticking in memory
 * but keep the persisted state, so the timer is still running on return. */
function suspendActiveRestTimer() {
  if (!_activeRestTimer) return;
  updateActiveRestTimer();
  if (_activeRestTimer.interval) clearInterval(_activeRestTimer.interval);
  _activeRestTimer = null;
}

/* Re-attach a persisted timer to its set row after the editor renders. */
function resumePersistedRestTimer() {
  const state = readPersistedRestTimer();
  if (!state) return;
  if (_activeRestTimer && _activeRestTimer.row && _activeRestTimer.row.isConnected) return;
  if (_activeRestTimer) suspendActiveRestTimer();

  const row = Array.from(document.querySelectorAll('.set-row'))
    .find(r => r.dataset.setId === String(state.setId));
  const btn = row?.querySelector('.rest-timer-btn');
  if (!row || !btn || row.classList.contains('skipped')) {
    persistRestTimer(null);
    return;
  }
  startRestTimer(row, btn, Math.max(0, Number(state.elapsedBefore) || 0), state.startedAt);
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
