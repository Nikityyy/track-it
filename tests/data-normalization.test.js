const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = {
  console,
  crypto: {
    randomUUID: () => '00000000-0000-4000-8000-000000000000'
  },
  indexedDB: {}
};
vm.createContext(context);

for (const file of ['js/utils.js', 'js/db.js']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInContext(source, context, { filename: file });
}

const oldWorkout = {
  workoutId: 'old-1',
  type: 'Push',
  name: 'Old Push',
  date: '2024-01-15T10:30:00.000Z',
  exercises: [
    {
      exerciseId: 'ex-1',
      name: 'Bench',
      sets: [
        { setId: 'set-1', label: 'Satz 1', reps: 8, rpe: 7 }
      ]
    }
  ],
  finisher: {
    type: 'NORMAL',
    name: 'Carry',
    entries: [
      {
        id: 'fin-1',
        name: 'Farmer Walk',
        sets: [
          { setId: 'fin-set-1', label: 'Satz 1', reps: 1, rpe: 8 }
        ]
      }
    ]
  }
};

const normalized = context.validateAndNormalizeImportData({
  workoutTypes: [{ id: 'push', name: 'Push' }],
  workouts: [oldWorkout]
});
const analysis = context.analyzeImportData({
  workoutTypes: [{ id: 'push', name: 'Push' }],
  workouts: [oldWorkout]
});

assert.equal(normalized.workouts.length, 1);
assert.equal(analysis.summary.valid, 1);
assert.equal(analysis.summary.rejected, 0);
assert.equal(analysis.summary.repaired > 0, true);
assert.equal(normalized.workouts[0].date, oldWorkout.date);
assert.equal(normalized.workouts[0].createdAt, oldWorkout.date);
assert.equal(normalized.workouts[0].exercises[0].mode, 'normal');
assert.equal(normalized.workouts[0].exercises[0].sets[0].breakSeconds, 0);
assert.equal(normalized.workouts[0].exercises[0].sets[0].skipped, false);
assert.equal(normalized.workouts[0].finisher.name, 'Carry');
assert.equal(normalized.workouts[0].finisher.entries[0].sets[0].breakSeconds, 0);

assert.throws(
  () => context.validateAndNormalizeImportData({ workouts: 'nope' }),
  /workouts muss ein Array/
);

const badAnalysis = context.analyzeImportData({ workouts: [null, oldWorkout] });
assert.equal(badAnalysis.summary.valid, 1);
assert.equal(badAnalysis.summary.rejected, 1);

console.log('data-normalization tests passed');
