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
for (const file of ['js/utils.js', 'js/copy.js', 'js/exercises.js', 'js/plates.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

console.log('Testing plate inventory, per-side combinations and workout solver...');

// ── 1. Default plate config & sanitization ──
const cfg = context.getPlateConfig();
assert.equal(cfg.plates.length, 4, 'default has 4 plate denominations');
assert.equal(cfg.barWeights.barbell, 0, 'barbell weight defaults to 0 (plates only)');
assert.equal(cfg.barWeights.dumbbell, 0, 'dumbbell weight defaults to 0 (plates only)');

const saved = context.savePlateConfig({
  plates: [
    { weight: 2.5, count: 4 },
    { weight: 2, count: 4 },
    { weight: 1.5, count: 4 },
    { weight: 1.25, count: 4 }
  ],
  barWeights: { barbell: 0, dumbbell: 0 }
});
assert.equal(saved.plates[0].weight, 2.5);

// ── 2. Per-side enumeration respects inventory caps ──
const combos15 = context.enumeratePlateCombos(7500, saved.plates, 2);
assert.equal(combos15.exact, true, '15kg Langhantel (7.5kg/side) is exact');
for (const combo of combos15.combos) {
  const sum = combo.reduce((acc, p) => acc + p.weight * p.count, 0);
  assert.equal(sum, 7.5, 'every combo sums to 7.5kg per side');
  for (const p of combo) {
    const owned = saved.plates.find(x => x.weight === p.weight).count;
    assert.ok(p.count * 2 <= owned, `combo never uses more ${p.weight}kg plates than owned`);
  }
}

// 2 Kurzhanteln (4 sides total) with 4 of each plate: max 1 of each plate per side
const combos2kh8 = context.enumeratePlateCombos(4000, saved.plates, 4);
assert.equal(combos2kh8.exact, true, '8kg per dumbbell (4kg/side × 4 sides) is exact via 2.5 + 1.5');
assert.equal(
  JSON.stringify(combos2kh8.combos[0].map(p => [p.weight, p.count])),
  JSON.stringify([[2.5, 1], [1.5, 1]])
);

// 2 Kurzhanteln 10kg (5kg/side) cannot be made with only 4 of each plate
const combos2kh10 = context.enumeratePlateCombos(5000, saved.plates, 4);
assert.equal(combos2kh10.exact, false, '10kg × 2 KH exceeds 4 plates per size (5kg/side unreachable)');
assert.ok(combos2kh10.actualGrams < 5000);

// ── 3. Optional bar weight subtraction ──
const withBarCfg = {
  plates: saved.plates,
  barWeights: { barbell: 7.5, dumbbell: 2 }
};
const withBarPlan = context.solveWorkoutPlates([
  { name: 'Langhantel Curls 15kg', equipment: 'barbell' }
], withBarCfg)[0];
assert.equal(withBarPlan.exact, true);
assert.equal(withBarPlan.actualPerSide, 3.75, '15kg minus 7.5kg bar = 3.75kg per side');

// ── 4. Workout-wide solver minimizes swaps & avoids cross-handle conflicts ──
// Barbell 15kg has two exact combos:
//   A: 2×2.5 + 2×1.25 (uses 4×2.5, 4×1.25)
//   B: 1×2.5 + 1×2 + 2×1.5 (uses 2×2.5, 2×2, 4×1.5)
// Next exercise: 2 Kurzhanteln 7kg (3.5kg/side × 4 sides = 1×2 + 1×1.5 -> uses 4×2, 4×1.5).
// Picking A on the barbell leaves 4×2 + 4×1.5 completely free so BOTH handles stay loaded at once!
// Then Barbell 12.5kg (6.25kg/side = 2×2.5 + 1×1.25) reuses A with just -1×1.25 per side!
const workoutPlans = context.solveWorkoutPlates([
  { name: 'Bizeps Curls 15kg', equipment: 'barbell' },
  { name: 'Schrägbank 7kg', equipment: 'dumbbells' },
  { name: 'Trizepsdrücken 12.5kg', equipment: 'barbell' }
], saved);

assert.equal(workoutPlans[0].parallelOk, true);
assert.equal(workoutPlans[1].parallelOk, true, 'barbell + 2 dumbbells coexist without plate conflict');
assert.equal(
  JSON.stringify(workoutPlans[0].perSide.map(p => [p.weight, p.count])),
  JSON.stringify([[2.5, 2], [1.25, 2]]),
  'picks 2×2.5 + 2×1.25 for 15kg barbell so 2 and 1.5 stay free for 2×7kg dumbbells'
);
assert.deepEqual(
  JSON.parse(JSON.stringify(workoutPlans[2].swaps)),
  { added: 0, removed: 1 },
  'going from 15kg to 12.5kg on barbell only removes 1×1.25 plate per side'
);

const underBar = context.solveWorkoutPlates([
  { name: 'Curls 5kg', equipment: 'barbell' }
], withBarCfg)[0];
assert.equal(underBar.exact, false, 'a target below the empty bar weight is unreachable');
assert.equal(underBar.actualWeight, 7.5);

const sharedHandles = context.solveWorkoutPlates([
  { name: 'Curls 5kg', equipment: 'dumbbell' },
  { name: 'Press 5kg', equipment: 'dumbbells' }
], { plates: [{ weight: 2.5, count: 4 }] });
assert.equal(sharedHandles[1].parallelOk, true, 'switching to a pair can reuse the single dumbbell');

const partialUnload = context.solveWorkoutPlates([
  { name: 'Rudern 8kg', equipment: 'barbell' },
  { name: 'Curls 5kg', equipment: 'dumbbells' },
  { name: 'Rudern 3kg', equipment: 'barbell' }
], { plates: [{ weight: 2.5, count: 4 }, { weight: 1.5, count: 2 }] });
assert.equal(partialUnload[1].parallelOk, false, 'conflict calls out the need to transfer plates');
assert.equal(partialUnload[2].parallelOk, true, 'untouched 1.5 kg plates can stay loaded');
assert.equal(partialUnload[2].swaps.added + partialUnload[2].swaps.removed, 0);

// ── 5. Visual HTML helpers ──
const eqHtml = context.renderEquipmentSelector('dumbbells');
assert.ok(eqHtml.includes('data-equipment="barbell"') && eqHtml.includes('data-equipment="dumbbells"'));
assert.match(eqHtml, /data-equipment="dumbbells" aria-pressed="true"/);
const barHtml = context.renderPlateBarVisual(workoutPlans[0], true);
assert.ok(barHtml.includes('plate-bar-graphic') && barHtml.includes('2,5'));
const plateHeights = workoutPlans[1].plateHeights;
assert.ok(plateHeights.get(2.5) > plateHeights.get(2));
assert.ok(plateHeights.get(2) > plateHeights.get(1.5));
assert.ok(plateHeights.get(1.5) > plateHeights.get(1.25));
assert.equal(workoutPlans[0].plateHeights, plateHeights, 'plate sizes stay consistent across the workout');

console.log('✓ All plate solver & visual tests passed!');
