let _activeRestTimer = null;
// While the editor is left (home screen) the timer is not ticking, but the
// draft still has to carry it so "Weiter trainieren" picks it up
let _suspendedRestTimer = null;

function renderRestTimerButton(isSkipped) {
  return `
    <button type="button" class="btn-icon rest-timer-btn" aria-label="Pause starten" title="Pause starten/pausieren"${isSkipped ? ' disabled' : ''}>
      ${icon('timer', 14)}
    </button>
  `;
}

/* A running rest timer is { setId, startedAt, elapsedBefore, seenAt } and is
 * stored inside the draft (js/pages/create-workout.js saveCurrentDraft), in
 * the same write as the set values it belongs to. Elapsed time is always
 * derived from the wall clock, so the timer keeps counting while the app is
 * closed and picks up where it should on reopen.
 *
 * It used to live in a key of its own. A write to it that never reached the
 * disk (phone locked right after tapping) left an old state behind that no
 * longer matched the draft, and a set that was long finished came back as a
 * running pause, counting for as long as the phone had been away.
 *
 * seenAt is the last moment the app was running with the timer: a rest only
 * ever lasts minutes, so when the app was away longer than that the rest was
 * abandoned, and the timer stops where it was last seen instead of counting
 * on and ending up as the set's pause. */
const REST_TIMER_MAX_AWAY_MS = 15 * 60 * 1000;
const LEGACY_REST_TIMER_KEY = 'trackit-rest-timer';

/* The timer as it goes into the draft: null when none is running. */
function getRestTimerState() {
  const timer = _activeRestTimer;
  if (timer) {
    return { setId: timer.setId, startedAt: timer.startedAt, elapsedBefore: timer.elapsedBefore, seenAt: timer.seenAt };
  }
  return _suspendedRestTimer;
}

/* Versions before the timer moved into the draft kept it in a key of its own.
 * Taken once (and removed) so a rest in progress survives the update. */
function takeLegacyRestTimer() {
  try {
    const raw = localStorage.getItem(LEGACY_REST_TIMER_KEY);
    localStorage.removeItem(LEGACY_REST_TIMER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveDraftSoon() {
  if (typeof scheduleDraftSave === 'function') scheduleDraftSave();
}

function startRestTimer(row, btn, elapsedBefore, startedAt) {
  const input = row.querySelector('.set-break');
  _suspendedRestTimer = null;
  _activeRestTimer = {
    row,
    btn,
    input,
    elapsedBefore,
    startedAt,
    setId: row.dataset?.setId,
    seenAt: Date.now(),
    interval: setInterval(tickRestTimer, 1000)
  };
  btn.classList.add('active');
  btn.setAttribute('aria-label', 'Pause pausieren');
  btn.title = 'Pause pausieren';
  updateActiveRestTimer();
  saveDraftSoon();
}

/* Once a second. Notices when the app was frozen for too long (the phone was
 * locked and put away) or when its set is gone, and stops the timer then. */
function tickRestTimer() {
  const timer = _activeRestTimer;
  if (!timer) return;
  if (timer.row && timer.row.isConnected === false) {
    // The set was removed or rebuilt (a mode switch): nothing left to time
    if (timer.interval) clearInterval(timer.interval);
    _activeRestTimer = null;
    saveDraftSoon();
    return;
  }
  const now = Date.now();
  if (now - timer.seenAt > REST_TIMER_MAX_AWAY_MS) {
    pauseActiveRestTimer(true, timer.seenAt);
    if (typeof showToast === 'function') showToast('Pause beendet: du warst länger weg');
    return;
  }
  timer.seenAt = now;
  updateActiveRestTimer();
}

function handleRestTimerButton(btn) {
  const row = btn.closest('.set-row');
  if (!row || row.classList.contains('skipped') || row.classList.contains('no-pause')) return;

  if (_activeRestTimer && _activeRestTimer.row === row) {
    if (typeof window !== 'undefined' && window.haptic) window.haptic.trigger(20);
    pauseActiveRestTimer(true);
    return;
  }
  // Starting the clock is the moment that matters most: a firmer tap
  if (typeof window !== 'undefined' && window.haptic) window.haptic.trigger(40);

  pauseActiveRestTimer(true);
  const input = row.querySelector('.set-break');
  const elapsedBefore = Math.max(0, parseInt(input?.value, 10) || 0);
  startRestTimer(row, btn, elapsedBefore, Date.now());
}

function pauseActiveRestTimer(shouldRecord, endedAt) {
  if (!_activeRestTimer) {
    if (_suspendedRestTimer) {
      _suspendedRestTimer = null;
      saveDraftSoon();
    }
    return;
  }
  updateActiveRestTimer(endedAt);
  if (_activeRestTimer.interval) {
    clearInterval(_activeRestTimer.interval);
  }
  if (_activeRestTimer.btn) {
    _activeRestTimer.btn.classList.remove('active');
    _activeRestTimer.btn.setAttribute('aria-label', 'Pause fortsetzen');
    _activeRestTimer.btn.title = 'Pause fortsetzen';
  }
  _activeRestTimer = null;
  _suspendedRestTimer = null;
  if (shouldRecord && typeof recordFormHistory === 'function') {
    recordFormHistory();
  }
  saveDraftSoon();
}

/* Leaving the editor (or the page being torn down): stop ticking in memory
 * but keep the state, so the draft still has the timer on return. */
function suspendActiveRestTimer() {
  if (!_activeRestTimer) return;
  updateActiveRestTimer();
  _suspendedRestTimer = getRestTimerState();
  if (_activeRestTimer.interval) clearInterval(_activeRestTimer.interval);
  _activeRestTimer = null;
}

/* Re-attach a timer from the draft to its set row after the editor renders. */
function resumeRestTimer(state) {
  if (_activeRestTimer && _activeRestTimer.row && _activeRestTimer.row.isConnected) return;
  if (_activeRestTimer) {
    updateActiveRestTimer();
    if (_activeRestTimer.interval) clearInterval(_activeRestTimer.interval);
    _activeRestTimer = null;
  }
  _suspendedRestTimer = null;
  if (!state || !state.setId || !Number.isFinite(state.startedAt)) return;

  const row = Array.from(document.querySelectorAll('.set-row'))
    .find(r => r.dataset.setId === String(state.setId));
  const btn = row?.querySelector('.rest-timer-btn');
  if (!row || !btn || row.classList.contains('skipped') || row.classList.contains('no-pause')) {
    saveDraftSoon();
    return;
  }
  const elapsedBefore = Math.max(0, Number(state.elapsedBefore) || 0);
  // States without seenAt count as seen just now
  const seenAt = Number.isFinite(state.seenAt) ? state.seenAt : Date.now();
  if (Date.now() - seenAt > REST_TIMER_MAX_AWAY_MS) {
    // Abandoned while the app was away: the rest ended when it was last seen
    const input = row.querySelector('.set-break');
    if (input) input.value = String(restTimerElapsed(elapsedBefore, state.startedAt, seenAt));
    if (typeof showToast === 'function') showToast('Pause beendet: du warst länger weg');
    saveDraftSoon();
    return;
  }
  startRestTimer(row, btn, elapsedBefore, state.startedAt);
}

/* Seconds on the clock at a given moment, never NaN, capped at 24 hours. */
function restTimerElapsed(elapsedBefore, startedAt, at) {
  const before = Number.isFinite(elapsedBefore) ? Math.max(0, elapsedBefore) : 0;
  const start = Number.isFinite(startedAt) ? startedAt : at;
  const diffSeconds = Math.max(0, Math.floor((at - start) / 1000));
  const elapsed = before + diffSeconds;
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
  return Math.min(86400, Math.round(elapsed));
}

/* The home screen shows the running rest too. The moment its clock should
 * show: now, or when the app was last seen if it was away too long. */
function restTimerClockAt(state) {
  const now = Date.now();
  const seenAt = state && Number.isFinite(state.seenAt) ? state.seenAt : now;
  return now - seenAt > REST_TIMER_MAX_AWAY_MS ? seenAt : now;
}

/* Is the timer one of this workout's sets? (A timer for a set that is not in
 * the draft is nobody's pause.) */
function restTimerBelongsToWorkout(state, workout) {
  if (!state || !workout) return false;
  const sets = [];
  for (const ex of workout.exercises || []) sets.push(...(ex.sets || []));
  for (const entry of (workout.finisher && workout.finisher.entries) || []) sets.push(...(entry.sets || []));
  return sets.some(set => set && String(set.setId) === String(state.setId));
}

function updateActiveRestTimer(at) {
  if (!_activeRestTimer || !_activeRestTimer.input) return;

  const elapsed = restTimerElapsed(_activeRestTimer.elapsedBefore, _activeRestTimer.startedAt, Number.isFinite(at) ? at : Date.now());

  _activeRestTimer.input.value = String(elapsed);
  const formatted = typeof formatDuration === 'function' ? formatDuration(elapsed) : `${elapsed} s`;
  if (_activeRestTimer.btn) {
    _activeRestTimer.btn.title = `Pause läuft: ${formatted || '0 s'}`;
  }
}
