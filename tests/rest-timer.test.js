const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

console.log('Testing rest timer and end-of-workout pause...');

// ── Fake environment: a clock we control, storage, and set rows ──
let clock = Date.parse('2026-11-05T17:00:00Z');
const store = {};
const rows = [];
const toasts = [];
let draftSaves = 0;
const context = {
  console, Math, Number, parseInt, JSON, String, Array,
  Date: { now: () => clock },
  setInterval: () => 1,
  clearInterval: () => {},
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { querySelectorAll: () => rows },
  showToast: m => toasts.push(m),
  scheduleDraftSave: () => { draftSaves++; },
  formatDuration: s => `${s}s`,
  crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' }
};
vm.createContext(context);
for (const file of ['js/utils.js', 'js/rest-timer.js']) vm.runInContext(read(file), context, { filename: file });

function makeRow(setId, value = '0') {
  const input = { value };
  const btn = { classList: { add: () => {}, remove: () => {}, contains: () => false }, setAttribute: () => {}, title: '' };
  const row = {
    dataset: { setId }, isConnected: true, input, btn,
    classList: { contains: () => false },
    querySelector: sel => (sel === '.set-break' ? input : sel === '.rest-timer-btn' ? btn : null)
  };
  btn.closest = () => row;
  return row;
}
const state = () => context.getRestTimerState();
const active = () => vm.runInContext('_activeRestTimer', context);
const MIN = 60 * 1000;

// ── 1. A running rest ticks along, is in the draft, and stays "seen" ──
const a = makeRow('set-a'); rows.length = 0; rows.push(a);
context.handleRestTimerButton(a.btn);
assert.equal(state().setId, 'set-a', 'the running rest is what goes into the draft');
assert.ok(draftSaves > 0, 'starting a rest saves the draft');
clock += 90 * 1000;
context.tickRestTimer();
assert.equal(a.input.value, '90', 'the rest counts the seconds');
assert.equal(state().seenAt, clock, 'every tick records that the app was running');
console.log('✓ Running rest ticks, goes into the draft and is marked as seen');

// ── 2. The app was frozen far longer than any rest: it ends where it was last seen ──
clock += 33 * MIN;
context.tickRestTimer();
assert.equal(a.input.value, '90', 'a rest abandoned while the phone lay around keeps the time up to then, not 2000 s');
assert.equal(active(), null, 'the timer is stopped');
assert.equal(state(), null, 'and the draft no longer carries it');
assert.equal(toasts.length, 1, 'the user is told');
console.log('✓ Abandoned rest stops where it was last seen');

// ── 3. Reopening after a long absence does not resume it either ──
const b = makeRow('set-b'); rows.length = 0; rows.push(b);
clock += MIN;
context.resumeRestTimer({ setId: 'set-b', startedAt: clock, elapsedBefore: 10, seenAt: clock + 60 * 1000 });
assert.equal(active() && active().setId, 'set-b', 'seen a minute ago is not abandoned');
context.pauseActiveRestTimer(false);
clock += 33 * MIN;
b.input.value = '0';
context.resumeRestTimer({ setId: 'set-b', startedAt: clock - 40 * MIN, elapsedBefore: 10, seenAt: clock - 39 * MIN });
assert.equal(b.input.value, '70', 'elapsedBefore plus the minute until the app was last seen');
assert.equal(active(), null);
assert.equal(state(), null);
console.log('✓ A reopened abandoned rest ends at the last-seen time');

// ── 4. A rest that was only briefly away carries on ──
const c = makeRow('set-c'); rows.length = 0; rows.push(c);
const seen = clock;
clock += 4 * MIN;
context.resumeRestTimer({ setId: 'set-c', startedAt: seen, elapsedBefore: 0, seenAt: seen });
assert.equal(c.input.value, '240', 'four minutes away is still the same rest');
assert.ok(active(), 'and it keeps running');
context.pauseActiveRestTimer(false);
assert.equal(state(), null);
console.log('✓ A short absence continues the rest');

// ── 5. States without seenAt are not thrown away ──
const d = makeRow('set-d'); rows.length = 0; rows.push(d);
context.resumeRestTimer({ setId: 'set-d', startedAt: clock - 3 * MIN, elapsedBefore: 0 });
assert.ok(active(), 'a state in progress without seenAt carries on');
context.pauseActiveRestTimer(false);
console.log('✓ Old-format state still resumes');

// ── 6. A timer whose set vanished does not tick on or linger ──
const e = makeRow('set-e'); rows.length = 0; rows.push(e);
context.handleRestTimerButton(e.btn);
e.isConnected = false;
context.tickRestTimer();
assert.equal(active(), null, 'timer of a removed set stops');
assert.equal(state(), null, 'and leaves the draft (it would show as a running pause on the home screen)');
rows.length = 0;
context.resumeRestTimer({ setId: 'not-in-this-form', startedAt: clock, elapsedBefore: 0, seenAt: clock });
assert.equal(active(), null, 'a timer for a set that is not in the form is dropped');
console.log('✓ Orphaned timer is dropped');

// ── 6b. Leaving the editor keeps the timer in the draft ──
const f = makeRow('set-f'); rows.length = 0; rows.push(f);
context.handleRestTimerButton(f.btn);
context.suspendActiveRestTimer();
assert.equal(active(), null, 'not ticking while the editor is away');
assert.equal(state().setId, 'set-f', 'but the draft still carries it');
context.pauseActiveRestTimer(false);
assert.equal(state(), null, 'and a stop clears it');
console.log('✓ Timer survives leaving the editor');

// ── 6c. A stale record in the old separate key cannot bring a finished set back ──
store['trackit-rest-timer'] = JSON.stringify({ setId: 'set-a', startedAt: clock - 5 * MIN, elapsedBefore: 0 });
const legacy = context.takeLegacyRestTimer();
assert.equal(legacy.setId, 'set-a', 'a rest from before the update is picked up once');
assert.equal(store['trackit-rest-timer'], undefined, 'and the old key is gone');
assert.equal(context.takeLegacyRestTimer(), null);
const editorSrc = read('js/pages/create-workout.js');
assert.ok(editorSrc.includes('restTimer: getRestTimerState()'), 'the draft is saved together with the timer');
assert.ok(editorSrc.includes('draft.restTimer !== undefined ? draft.restTimer : takeLegacyRestTimer()'), 'only drafts without a timer field look at the old key');
assert.ok(!/localStorage\.setItem\(\s*(REST_TIMER|'trackit-rest-timer)/.test(read('js/rest-timer.js')), 'the timer is no longer written to a key of its own');
console.log('✓ Timer state lives in the draft');

// ── 7. A timer only counts for sets of the draft it is shown with ──
const workout = { exercises: [{ sets: [{ setId: 'x1' }, { setId: 'x2' }] }], finisher: { type: 'NORMAL', entries: [{ sets: [{ setId: 'f1' }] }] } };
assert.equal(context.restTimerBelongsToWorkout({ setId: 'x2' }, workout), true);
assert.equal(context.restTimerBelongsToWorkout({ setId: 'f1' }, workout), true);
assert.equal(context.restTimerBelongsToWorkout({ setId: 'other-workout' }, workout), false);
assert.equal(context.restTimerBelongsToWorkout(null, workout), false);
console.log('✓ Timer of another workout is not shown');

// ── 8. The last set of a workout has no pause ──
const S = (id, pause) => ({ setId: id, breakSeconds: pause });
const plain = context.clearEndOfWorkoutPause({ exercises: [{ sets: [S('a', 90), S('b', 90)] }, { sets: [S('c', 90), S('d', 2000)] }], finisher: null });
assert.deepEqual(plain.exercises.map(ex => ex.sets.map(s => s.breakSeconds)), [[90, 90], [90, 0]], 'only the very last set loses its pause');

const lr = context.clearEndOfWorkoutPause({ exercises: [{ sets: [S('l1', 30), S('r1', 90), S('l2', 30), S('r2', 120)] }], finisher: null });
assert.deepEqual(lr.exercises[0].sets.map(s => s.breakSeconds), [30, 90, 30, 0], 'the pause between left and right stays');

const withFinisher = context.clearEndOfWorkoutPause({ exercises: [{ sets: [S('a', 90), S('b', 120)] }], finisher: { type: 'NORMAL', entries: [{ sets: [S('f1', 60), S('f2', 75)] }] } });
assert.equal(withFinisher.exercises[0].sets[1].breakSeconds, 120, 'the rest before a finisher stays');
assert.equal(withFinisher.finisher.entries[0].sets[1].breakSeconds, 0, 'the finisher ends the workout');
assert.equal(withFinisher.finisher.entries[0].sets[0].breakSeconds, 60);

const amrap = context.clearEndOfWorkoutPause({ exercises: [{ sets: [S('a', 90), S('b', 120)] }], finisher: { type: 'AMRAP', entries: [{ result: '40', sets: [] }] } });
assert.equal(amrap.exercises[0].sets[1].breakSeconds, 120, 'an AMRAP finisher has no sets; the rest before it stays');
assert.doesNotThrow(() => context.clearEndOfWorkoutPause(null));
console.log('✓ Last set of the workout has no pause');

// ── 9. The setting: no pause on the last set unless switched on ──
assert.equal(context.getLastSetPause(), false, 'off by default: the last set has no pause');
context.setLastSetPause(true);
assert.equal(context.getLastSetPause(), true);
context.setLastSetPause(false);
assert.equal(context.getLastSetPause(), false);
console.log('✓ Last-set pause setting defaults to off');

// ── 10. The editor uses it when saving and keeps the last set's timer off ──
const editor = editorSrc;
assert.ok(editor.includes('if (w && !getLastSetPause()) clearEndOfWorkoutPause(w);'), 'saving clears the pause of the last set unless the setting allows it');
assert.ok(editor.includes('function updateLastSetPause()'), 'the editor switches the pause controls off on the last set');
assert.ok(read('js/rest-timer.js').includes("classList.contains('no-pause')"), 'no rest timer starts on a no-pause set');
console.log('✓ Save applies it');

console.log('\nAll rest timer tests passed successfully!');
