const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = {
  console,
  crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
  indexedDB: {},
  localStorage: (() => {
    const store = {};
    return { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  })()
};
vm.createContext(context);
for (const file of ['js/utils.js', 'js/copy.js', 'js/exercises.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

console.log('Testing exercise index, suggestions and left/right order...');

// ── 1. Same exercise at different weights groups together ──
assert.equal(context.exerciseKey('Bankdrücken 72.5kg'), context.exerciseKey('bankdrucken 70 kg'));
assert.equal(context.exerciseBaseName('Bankdrücken 72.5kg'), 'Bankdrücken');
assert.deepEqual(JSON.parse(JSON.stringify(context.exerciseWeight('Curls 12,5 kg'))), { value: 12.5, unit: 'kg' });
assert.equal(context.exerciseWeight('Klimmzüge'), null);
assert.equal(context.exerciseKey('Straße'), context.exerciseKey('strasse'));
for (const variant of ['Bankdrücken (72.5kg)', 'Bankdrücken @ 72.5 kg', 'Bankdrücken - 72.5kg', 'Bankdrücken 60-70kg', 'Bankdrücken 72.5 KG', 'Bankdrücken 160lbs']) {
  assert.equal(context.exerciseBaseName(variant), 'Bankdrücken', `weight notation "${variant}" groups with Bankdrücken`);
}
assert.equal(context.exerciseBaseName('Klimmzüge +10kg'), 'Klimmzüge', 'added weight on a bodyweight exercise groups with it');
assert.equal(context.exerciseBaseName('Curls 2x 12.5kg'), 'Curls');
// Weight first, equipment, then the name: "15kg KH | Bizeps Curls"
assert.equal(context.exerciseKey('15kg KH | Bizeps Curls'), context.exerciseKey('17,5kg KH | Bizeps Curls'));
assert.equal(context.exerciseBaseName('17.5 kg KH | Bizeps Curls'), 'KH | Bizeps Curls');
assert.equal(context.exerciseWeight('17,5kg KH | Bizeps Curls').value, 17.5);
assert.equal(context.exerciseBaseName('20kg | Kabelrudern'), 'Kabelrudern', 'no stray separator when the weight comes first');
assert.equal(context.exerciseWeight('Bankdrücken 60-70kg').value, 70, 'a range reads as its top weight');
assert.equal(context.exerciseWeight('Bankdrücken 72.5'), null, 'a number without a unit is not taken as a weight');
console.log('✓ Exercise keys ignore weight, case and accents');

const day = d => new Date(Date.now() - d * 86400000).toISOString();
const S = (label, reps, rpe) => ({ setId: label, label, reps, rpe, breakSeconds: 0, note: '', skipped: false });
const workouts = [
  { workoutId: 'a', type: 'Push', name: 'Push A', date: day(1), exercises: [
    { name: 'Bankdrücken 72.5kg', mode: 'normal', sets: [S('Satz 1', 8, 8)] },
    { name: 'Schrägbank KH 26kg', mode: 'normal', sets: [S('Satz 1', 10, 8)] }] },
  { workoutId: 'b', type: 'Push', name: 'Push B', date: day(8), exercises: [{ name: 'Bankdrücken 70kg', mode: 'normal', sets: [S('Satz 1', 9, 8)] }] },
  { workoutId: 'c', type: 'Pull', name: 'Pull A', date: day(3), exercises: [{ name: 'Klimmzüge', mode: 'normal', sets: [S('Satz 1', 9, 9)] }] },
  { workoutId: 'd', type: 'Beine', name: 'Beine', date: day(2), exercises: [{ name: 'Bulgarian Split Squat', mode: 'lr', sets: [S('Satz 1 (links)', 10, 8), S('Satz 1 (rechts)', 9, 9)] }] }
];
const index = context.buildExerciseIndex(workouts);
const bench = index.get(context.exerciseKey('Bankdrücken'));
assert.equal(bench.count, 2, 'two bench sessions at two weights are one exercise');
assert.equal(bench.latestName, 'Bankdrücken 72.5kg', 'latest name is the most recent spelling with its weight');
assert.equal(JSON.stringify(bench.sessions.map(s => s.workoutId)), JSON.stringify(['a', 'b']), 'sessions newest first');
console.log('✓ Index groups sessions');

// ── 2. Suggestions ──
const names = (q, opts = {}) => context.suggestExercises(index, q, opts).map(i => i.name);
assert.equal(names('ba')[0], 'Bankdrücken', 'most done first');
assert.ok(names('ba').includes('Schrägbank KH'), 'word-inside match is still offered');
assert.ok(!names('ba', { exclude: ['Bankdrücken 72.5kg'] }).includes('Bankdrücken'), 'exercises already in the workout are left out');
assert.equal(names('bankdrucken').length, 0, 'a fully typed name is not suggested again');
assert.equal(names('')[0], 'Bankdrücken', 'empty field: most done first');

const sorted = context.buildExerciseIndex([
  { workoutId: 'e1', type: 'Push', name: 'Push', date: day(2), exercises: [{ name: 'Dips', mode: 'normal', sets: [S('Satz 1', 8, 8)] }, { name: 'Liegestütze', mode: 'normal', sets: [S('Satz 1', 8, 8)] }] },
  { workoutId: 'e2', type: 'Push', name: 'Push', date: day(5), exercises: [{ name: 'Dips', mode: 'normal', sets: [S('Satz 1', 8, 8)] }, { name: 'Liegestütze', mode: 'normal', sets: [S('Satz 1', 8, 8)] }] },
  { workoutId: 'e3', type: 'Push', name: 'Push', date: day(9), exercises: [{ name: 'Dips', mode: 'normal', sets: [S('Satz 1', 8, 8)] }, { name: 'Pike Push-ups', mode: 'normal', sets: [S('Satz 1', 8, 8)] }] },
  { workoutId: 'e4', type: 'Push', name: 'Push', date: day(1), exercises: [{ name: 'Seilspringen', mode: 'normal', sets: [S('Satz 1', 8, 8)] }] },
  { workoutId: 'e5', type: 'Beine', name: 'Beine', date: day(45), exercises: [{ name: 'Kniebeugen', mode: 'normal', sets: [S('Satz 1', 8, 8)] }, { name: 'Kniebeugen 80kg', mode: 'normal', sets: [S('Satz 1', 8, 8)] }, { name: 'Kniebeugen 85kg', mode: 'normal', sets: [S('Satz 1', 8, 8)] }] }
]);
const sortedNames = context.suggestExercises(sorted, '').map(i => i.name);
assert.equal(JSON.stringify(sortedNames), JSON.stringify(['Dips', 'Liegestütze', 'Seilspringen', 'Pike Push-ups']), 'most done first, then the most recent');
assert.ok(!context.suggestExercises(sorted, '').some(i => i.name === 'Kniebeugen'), 'not done for over a month: hidden when field is empty');
assert.equal(context.suggestExercises(sorted, 'knie')[0].name, 'Kniebeugen', 'not done for over a month: surfaced when user actively searches');
assert.equal(context.highlightMatch('Bankdrücken 72.5kg', 'ba'), '<mark>Ba</mark>nkdrücken 72.5kg');
console.log('✓ Suggestions rank and filter');

// ── 2b. Workout-type prioritization, slot position & search across older history ──
const splitWorkouts = [
  { workoutId: 'p1', type: 'Push', name: 'Push', date: day(2), exercises: [
    { name: 'Bankdrücken 75kg', mode: 'normal', sets: [S('Satz 1', 8, 8)] },
    { name: 'Schrägbank KH 26kg', mode: 'normal', sets: [S('Satz 1', 10, 8)] },
    { name: 'Trizepsdrücken 25kg', mode: 'normal', sets: [S('Satz 1', 12, 8)] }
  ] },
  { workoutId: 'p2', type: 'Push', name: 'Push', date: day(6), exercises: [
    { name: 'Bankdrücken 72.5kg', mode: 'normal', sets: [S('Satz 1', 8, 8)] },
    { name: 'Schrägbank KH 24kg', mode: 'normal', sets: [S('Satz 1', 10, 8)] },
    { name: 'Trizepsdrücken 25kg', mode: 'normal', sets: [S('Satz 1', 12, 8)] }
  ] },
  { workoutId: 'l1', type: 'Pull', name: 'Pull', date: day(1), exercises: [
    { name: 'Klimmzüge', mode: 'normal', sets: [S('Satz 1', 10, 8)] },
    { name: 'Rudern Kabel 50kg', mode: 'normal', sets: [S('Satz 1', 10, 8)] }
  ] },
  { workoutId: 'l2', type: 'Pull', name: 'Pull', date: day(3), exercises: [
    { name: 'Klimmzüge', mode: 'normal', sets: [S('Satz 1', 10, 8)] },
    { name: 'Rudern Kabel 50kg', mode: 'normal', sets: [S('Satz 1', 10, 8)] }
  ] },
  { workoutId: 'l3', type: 'Pull', name: 'Pull', date: day(5), exercises: [
    { name: 'Klimmzüge', mode: 'normal', sets: [S('Satz 1', 10, 8)] },
    { name: 'Rudern Kabel 45kg', mode: 'normal', sets: [S('Satz 1', 10, 8)] }
  ] },
  { workoutId: 'old1', type: 'Push', name: 'Push Alt', date: day(60), exercises: [
    { name: 'Schulterdrücken 40kg', mode: 'normal', sets: [S('Satz 1', 8, 8)] }
  ] }
];
const splitIndex = context.buildExerciseIndex(splitWorkouts);

// Selecting Push puts Push exercises ahead of more-frequent Pull exercises, and falls back to Pull below
const pushSlot0 = context.suggestExercises(splitIndex, '', { workoutType: 'Push', position: 0, source: 'exercise', limit: 5 });
assert.equal(pushSlot0[0].name, 'Bankdrücken', 'slot 0 in Push prefers Push opener');
assert.equal(pushSlot0[0].matchType, 'type');
assert.equal(pushSlot0[0].typeCount, 2);
assert.equal(JSON.stringify(pushSlot0.slice(0, 3).map(i => i.name)), JSON.stringify(['Bankdrücken', 'Schrägbank KH', 'Trizepsdrücken']), 'all Push exercises come before Pull');
assert.equal(pushSlot0[3].matchType, 'other', 'remaining slots filled with other types');
assert.ok(!pushSlot0.some(i => i.name === 'Schulterdrücken'), 'older >1 month Push exercise stays hidden when input is empty');

// Slot 2 in Push favors Trizepsdrücken (usually done 3rd) over Bankdrücken (usually done 1st)
const pushSlot2 = context.suggestExercises(splitIndex, '', { workoutType: 'Push', position: 2, source: 'exercise', limit: 5 });
assert.equal(pushSlot2[0].name, 'Trizepsdrücken', 'slot 2 prefers exercise typically done 3rd in Push');

// Searching surfaces the >1 month Push exercise and puts Push matches before other types
const searchOld = context.suggestExercises(splitIndex, 'sch', { workoutType: 'Push', limit: 5 });
assert.equal(JSON.stringify(searchOld.map(i => i.name)), JSON.stringify(['Schrägbank KH', 'Schulterdrücken']), 'recent Push match ranks first, older Push match surfaces on search');
assert.equal(searchOld[1].isOlder, true);

// Searching across types still prioritizes active workoutType first
const searchCross = context.suggestExercises(splitIndex, 'r', { workoutType: 'Push', limit: 5 });
assert.equal(searchCross[0].matchType, 'type', 'type-matched search result precedes other workout types');
assert.ok(searchCross.some(i => i.name === 'Rudern Kabel' && i.matchType === 'other'), 'matching exercise from another type still appears below');

// Suggestion age formatting
const refNow = new Date('2026-06-15T12:00:00Z');
assert.equal(context.formatSuggestionAge('2026-06-15T08:00:00Z', refNow), 'heute');
assert.equal(context.formatSuggestionAge('2026-06-14T18:00:00Z', refNow), 'gestern');
assert.equal(context.formatSuggestionAge('2026-06-10T10:00:00Z', refNow), 'vor 5 T.');
assert.equal(context.formatSuggestionAge('2026-05-25T10:00:00Z', refNow), 'vor 3 W.');
assert.equal(context.formatSuggestionAge('2026-04-01T10:00:00Z', refNow), 'vor 3 M.');
console.log('✓ Type-aware, slot-aware & search-all suggestions');

// ── 2c. Default mode & set count inference ──
const defaultsIndex = context.buildExerciseIndex([
  { workoutId: 'd1', type: 'Push', name: 'Push', date: day(1), exercises: [
    { name: 'Bankdrücken 75kg', mode: 'normal', sets: [S('Satz 1', 8, 8), S('Satz 2', 8, 8), S('Satz 3', 8, 9), S('Satz 4', 7, 9)] }
  ] },
  { workoutId: 'd2', type: 'Push', name: 'Push', date: day(4), exercises: [
    { name: 'Bankdrücken 75kg', mode: 'normal', sets: [S('Satz 1', 8, 8), S('Satz 2', 8, 8), S('Satz 3', 8, 9)] }
  ] },
  { workoutId: 'd3', type: 'Push', name: 'Push', date: day(7), exercises: [
    { name: 'Bankdrücken 72.5kg', mode: 'normal', sets: [S('Satz 1', 8, 8), S('Satz 2', 8, 8), S('Satz 3', 8, 9)] }
  ] },
  { workoutId: 'd4', type: 'Beine', name: 'Beine', date: day(2), exercises: [
    { name: 'Ausfallschritte', mode: 'lr', equipment: 'dumbbells', sets: [
      S('Satz 1 (links)', 10, 8), S('Satz 1 (rechts)', 10, 8),
      S('Satz 2 (links)', 10, 8), S('Satz 2 (rechts)', 10, 8),
      S('Satz 3 (links)', 10, 9), S('Satz 3 (rechts)', 10, 9)
    ] }
  ] },
  { workoutId: 'd5', type: 'Beine', name: 'Beine', date: day(6), exercises: [
    { name: 'Ausfallschritte', mode: 'lr', equipment: 'dumbbells', sets: [
      S('Satz 1 (links)', 10, 8), S('Satz 1 (rechts)', 10, 8),
      S('Satz 2 (links)', 10, 8), S('Satz 2 (rechts)', 10, 8)
    ] }
  ] }
]);
const benchDef = context.suggestExercises(defaultsIndex, '', { workoutType: 'Push' }).find(i => i.name === 'Bankdrücken');
assert.equal(benchDef.defaultMode, 'normal');
assert.equal(benchDef.defaultSets, 3, 'most frequent set count (3× twice vs 4× once) wins');
assert.equal(benchDef.defaultEquipment, null);

const lungeDef = context.suggestExercises(defaultsIndex, '', { workoutType: 'Beine' }).find(i => i.name === 'Ausfallschritte');
assert.equal(lungeDef.defaultMode, 'lr', 'infers Links/Rechts mode');
assert.equal(lungeDef.defaultSets, 3, 'tied 3 pairs vs 2 pairs breaks in favor of most recent (3 pairs)');
assert.equal(lungeDef.defaultEquipment, 'dumbbells', 'remembers equipment type (2 Kurzhanteln)');
console.log('✓ Default mode, equipment and set count inference');

// ── 3. Left/right order ──
assert.equal(context.getLrOrder(), 'left');
assert.equal(context.createEmptySet(0, 'lr').label, 'Satz 1 (links)');
context.setLrOrder('right');
assert.equal(context.createEmptySet(0, 'lr').label, 'Satz 1 (rechts)', 'right-first setting starts pairs on the right');
assert.equal(context.createEmptySet(1, 'lr').label, 'Satz 1 (links)');
context.setLrOrder('left');

const rightFirst = {
  name: 'Beine', date: day(0), notes: '', finisher: null,
  exercises: [{ name: 'Ausfallschritt', mode: 'lr', sets: [
    { ...S('Satz 1 (rechts)', 10, 8), breakSeconds: 0 },
    { ...S('Satz 1 (links)', 8, 9), breakSeconds: 90, note: 'links schwächer' }
  ] }]
};
assert.equal(
  context.workoutCopyText(rightFirst),
  '# Beine\nAusfallschritt: R: 10 · L: 8 · RPE R: 8 · L: 9 · P 1:30\nNotiz: S1 L: links schwächer\n',
  'copy text reads sides from the labels, in the order they were done'
);
console.log('✓ Left/right order and copy text');

console.log('\nAll exercise tests passed successfully!');
