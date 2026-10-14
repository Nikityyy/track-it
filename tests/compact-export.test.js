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

for (const file of ['js/utils.js', 'js/db.js', 'js/markdown.js']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInContext(source, context, { filename: file });
}

console.log('Testing compact export and empty RPE...');

function set(label, reps, rpe, breakSeconds, extra = {}) {
  return { setId: label, label, reps, rpe, breakSeconds, note: '', skipped: false, ...extra };
}

// ── 1. Normal format ──
const normalWorkout = {
  name: 'Push Tag',
  type: 'Push',
  date: '2026-10-14T10:00:00.000Z',
  notes: 'Guter Tag',
  exercises: [{
    name: 'Bankdrücken',
    mode: 'normal',
    sets: [
      set('Satz 1', 10, 7, 90, { note: 'leicht' }),
      set('Satz 2', 9, 8, 120),
      set('Satz 3', 8, 9, 45, { note: 'Grind' })
    ]
  }],
  finisher: null
};
assert.equal(
  context.exportWorkoutCompact(normalWorkout),
  '# Push Tag\n' +
  'Bankdrücken: 10/9/8 · RPE 7/8/9 · P 1:30/2:00/0:45\n' +
  'Notiz: S1: leicht; S3: Grind\n' +
  'Notizen: Guter Tag\n'
);

const withoutNotes = { ...normalWorkout, name: '', notes: '   ', exercises: [{
  name: 'Dips', mode: 'normal', sets: [set('Satz 1', 12, 8, 60)]
}] };
const withoutNotesOut = context.exportWorkoutCompact(withoutNotes);
assert.equal(withoutNotesOut, `# Push – ${context.formatDateDE(normalWorkout.date)}\nDips: 12 · RPE 8 · P 1:00\n`);
assert.ok(!withoutNotesOut.includes('Notiz'), 'Notiz/Notizen lines must be omitted when empty');
console.log('✓ Compact format (normal) verified');

// ── 2. L=R merged ──
const lrSame = {
  ...normalWorkout,
  notes: '',
  exercises: [{
    name: 'Bulgarian Split Squat',
    mode: 'lr',
    sets: [
      set('Satz 1 (links)', 10, 8, 0),
      set('Satz 1 (rechts)', 10, 8, 90),
      set('Satz 2 (links)', 9, 9, 0),
      set('Satz 2 (rechts)', 9, 9, 75)
    ]
  }]
};
assert.equal(
  context.exportWorkoutCompact(lrSame),
  '# Push Tag\nBulgarian Split Squat (L=R): 10/9 · RPE 8/9 · P 1:30/1:15\n'
);
console.log('✓ Compact format L=R merged verified');

// ── 3. L≠R separate ──
const lrDiff = {
  ...lrSame,
  exercises: [{
    name: 'Bulgarian Split Squat',
    mode: 'lr',
    sets: [
      set('Satz 1 (links)', 10, 8, 0),
      set('Satz 1 (rechts)', 9, 8, 90),
      set('Satz 2 (links)', 9, 9, 0),
      set('Satz 2 (rechts)', 9, 10, 75)
    ]
  }]
};
assert.equal(
  context.exportWorkoutCompact(lrDiff),
  '# Push Tag\nBulgarian Split Squat: L: 10/9 · R: 9/9 · RPE L: 8/9 · R: 8/10 · P 1:30/1:15\n'
);
console.log('✓ Compact format L≠R separate verified');

// ── 4. Skipped set ──
const skipped = {
  ...normalWorkout,
  notes: '',
  exercises: [{
    name: 'Bankdrücken',
    mode: 'normal',
    sets: [
      set('Satz 1', 10, 8, 90),
      set('Satz 2', 0, 8, 0, { skipped: true }),
      set('Satz 3', 8, 9, 0)
    ]
  }]
};
assert.equal(
  context.exportWorkoutCompact(skipped),
  '# Push Tag\nBankdrücken: 10/x/8 · RPE 8/x/9 · P 1:30/x/–\n'
);
console.log('✓ Compact format skipped set verified');

// ── 5. Empty RPE ──
const emptyRpe = {
  ...normalWorkout,
  notes: '',
  exercises: [{
    name: 'Klimmzüge',
    mode: 'normal',
    sets: [set('Satz 1', 8, null, 120), set('Satz 2', 7, 9, 0)]
  }],
  finisher: {
    type: 'AMRAP',
    name: '',
    entries: [{ id: 'f1', name: 'Burpees', result: '5 Runden', rpe: null, note: '', sets: [] }]
  }
};
assert.equal(
  context.exportWorkoutCompact(emptyRpe),
  '# Push Tag\nKlimmzüge: 8/7 · RPE –/9 · P 2:00/–\nFinisher Burpees: 5 Runden · RPE –\n'
);
const emptyRpeMd = context.exportWorkoutMarkdown(emptyRpe);
assert.ok(emptyRpeMd.includes('| Satz 1 | 8 | – |'), 'Markdown export must show empty RPE as –');
assert.ok(!emptyRpeMd.includes('null'), 'Markdown export must never print null');
const newSet = context.createEmptySet(0, 'normal');
assert.equal(newSet.rpe, null, 'first set of an exercise must have no RPE');
assert.equal(context.createEmptySet(1, 'lr').rpe, null);
console.log('✓ Empty RPE verified');

// ── 6. Weight decimal normalization ──
const decimals = {
  ...normalWorkout,
  notes: '',
  exercises: [{ name: 'Curls 20.5kg', mode: 'normal', sets: [set('Satz 1', 12, 8, 60)] },
              { name: 'Rudern 2x 12.5 kg', mode: 'normal', sets: [set('Satz 1', 10, 7, 60)] }]
};
assert.equal(
  context.exportWorkoutCompact(decimals),
  '# Push Tag\nCurls 20,5kg: 12 · RPE 8 · P 1:00\nRudern 2x 12,5 kg: 10 · RPE 7 · P 1:00\n'
);
assert.equal(decimals.exercises[0].name, 'Curls 20.5kg', 'export must not mutate the workout');
console.log('✓ Weight decimal normalization verified');

// ── 7. Finisher only when present ──
const finisherNormal = {
  ...normalWorkout,
  notes: '',
  exercises: [{ name: 'Dips', mode: 'normal', sets: [set('Satz 1', 12, 8, 60)] }],
  finisher: {
    type: 'EMOM',
    name: 'Ende',
    entries: [
      { id: 'f1', name: 'Kettlebell Swings', result: '10 min', rpe: 9, note: '', sets: [] },
      { id: 'f2', name: 'Plank', result: '', rpe: 7, note: '', sets: [], skipped: true }
    ]
  }
};
assert.equal(
  context.exportWorkoutCompact(finisherNormal),
  '# Push Tag\nDips: 12 · RPE 8 · P 1:00\nFinisher Kettlebell Swings: 10 min · RPE 9\nFinisher Plank: x\n'
);
assert.ok(!context.exportWorkoutCompact({ ...finisherNormal, finisher: null }).includes('Finisher'));
console.log('✓ Finisher lines verified');

// ── 8. Old data with rpe 5 stays unchanged, null is accepted ──
const oldWorkout = {
  workoutId: 'old-1',
  type: 'Push',
  name: 'Alt',
  date: '2024-01-15T10:30:00.000Z',
  exercises: [{
    exerciseId: 'ex-1',
    name: 'Bench',
    mode: 'normal',
    sets: [
      { setId: 's1', label: 'Satz 1', reps: 8, rpe: 5, breakSeconds: 0, note: '', skipped: false },
      { setId: 's2', label: 'Satz 2', reps: 8, rpe: null, breakSeconds: 0, note: '', skipped: false }
    ]
  }]
};
const normalized = context.validateAndNormalizeImportData({ workouts: [oldWorkout] });
assert.equal(normalized.workouts[0].exercises[0].sets[0].rpe, 5, 'stored rpe 5 must stay 5');
assert.equal(normalized.workouts[0].exercises[0].sets[1].rpe, null, 'null rpe must stay null');

const migrated = JSON.parse(JSON.stringify(oldWorkout));
context.migrateWorkout(migrated);
assert.equal(migrated.exercises[0].sets[0].rpe, 5, 'migration must keep rpe 5');
assert.equal(migrated.exercises[0].sets[1].rpe, null, 'migration must keep null rpe');
assert.deepEqual(migrated.exercises, oldWorkout.exercises, 'migration must not change complete sets');
console.log('✓ Old data with rpe 5 unchanged verified');

console.log('\nAll compact export tests passed successfully!');
