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
assert.equal(names('ba')[0], 'Bankdrücken', 'prefix match ranks first');
assert.ok(names('ba').includes('Schrägbank KH'), 'word-inside match is still offered');
assert.ok(!names('ba', { exclude: ['Bankdrücken 72.5kg'] }).includes('Bankdrücken'), 'exercises already in the workout are left out');
assert.equal(names('bankdrucken').length, 0, 'a fully typed name is not suggested again');
assert.equal(names('', { type: 'Pull' })[0], 'Klimmzüge', 'empty field: exercises of the selected type first');
assert.equal(context.highlightMatch('Bankdrücken 72.5kg', 'ba'), '<mark>Ba</mark>nkdrücken 72.5kg');
console.log('✓ Suggestions rank and filter');

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
