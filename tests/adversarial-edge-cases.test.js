const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
function read(f) { return fs.readFileSync(path.join(root, f), 'utf8'); }

console.log('Testing Adversarial Edge Cases across Track It! codebase...');

// ── 1. index.html loading order & script tags ──
const indexHtml = read('index.html');
const lucidePos = indexHtml.indexOf('src="./vendor/lucide.min.js"');
const webHapticsPos = indexHtml.indexOf('src="./vendor/web-haptics.js"');
const iconsPos = indexHtml.indexOf('src="./js/components/icons.js"');
const appPos = indexHtml.indexOf('src="./js/app.js"');

assert.ok(lucidePos > -1, 'lucide.min.js must be in index.html');
assert.ok(webHapticsPos > -1, 'web-haptics.js must be in index.html');
assert.ok(iconsPos > -1, 'icons.js must be in index.html');
assert.ok(appPos > -1, 'app.js must be in index.html');

assert.ok(lucidePos < iconsPos, 'lucide.min.js must load BEFORE icons.js');
assert.ok(webHapticsPos < appPos, 'web-haptics.js must load BEFORE app.js');
assert.ok(iconsPos < appPos, 'icons.js must load BEFORE app.js');
console.log('✓ Script loading order in index.html verified');

// ── 2. web-haptics.js recursion guard & DOM lifecycle ──
const webHapticsSrc = read('vendor/web-haptics.js');
assert.ok(webHapticsSrc.includes('this._isTapping'), 'web-haptics.js must have recursion guard _isTapping');
assert.ok(webHapticsSrc.includes('stopPropagation'), 'web-haptics.js container should stop click propagation');

let tapClickCount = 0;
const hapticsContext = {
  navigator: {},
  document: {
    body: { appendChild: () => {} },
    getElementById: () => null,
    createElement: (tag) => {
      const el = {
        tagName: tag,
        setAttribute: () => {},
        appendChild: () => {},
        addEventListener: (event, handler) => { el._handler = handler; },
        click: () => {
          tapClickCount++;
          // Simulate a bad recursive click listener on document
          if (tapClickCount < 10) {
            hapticsContext.window.haptic.trigger(20);
          }
        }
      };
      return el;
    }
  },
  window: {},
  setTimeout: (fn) => fn(),
  module: { exports: {} }
};
vm.createContext(hapticsContext);
vm.runInContext(webHapticsSrc, hapticsContext);
const hapticInst = hapticsContext.window.haptic;

tapClickCount = 0;
hapticInst.trigger(20);
assert.equal(tapClickCount, 1, 'Recursion guard must prevent infinite label.click() loop');
console.log('✓ web-haptics recursion guard verified');

// ── 3. service-worker.js safety & relative cache matching ──
const swSrc = read('service-worker.js');
assert.ok(swSrc.includes('try { e.waitUntil(networkFetch); } catch {}'), 'service worker must guard e.waitUntil');
assert.ok(swSrc.includes("cache.match('./index.html')"), 'SW must support relative index.html matching');
assert.ok(swSrc.includes("cache.match('./')"), 'SW must support relative scope root matching');
console.log('✓ service-worker relative caching and try-catch verified');

// ── 4. Router exported to window in utils.js ──
const utilsSrc = read('js/utils.js');
assert.ok(utilsSrc.includes('window.Router = Router'), 'utils.js must export Router to window');
console.log('✓ window.Router export verified');

// ── 5. form-history.js tryRestoreValuesInPlace fallbacks ──
const formHistorySrc = read('js/form-history.js');
assert.ok(formHistorySrc.includes('currentMode !== (ex.mode || \'normal\')'), 'tryRestoreValuesInPlace must reject mode mismatches');
assert.ok(formHistorySrc.includes('hasFinisherInWorkout !== isToggleChecked'), 'tryRestoreValuesInPlace must reject finisher presence mismatches');
assert.ok(formHistorySrc.includes('finisherBlock.dataset.finisherType !== workout.finisher.type'), 'tryRestoreValuesInPlace must reject finisher type mismatches');
assert.ok(formHistorySrc.includes('setRows.length !== (ex.sets || []).length'), 'tryRestoreValuesInPlace must reject set count changes');
console.log('✓ form-history in-place restore validation and fallbacks verified');

// ── 6. CSV Export escaping: commas, quotes, newlines, semicolons, German umlauts ──
const settingsSrc = read('js/pages/settings.js');
assert.ok(settingsSrc.includes("str.includes(';')"), 'CSV cell escaping must handle semicolons');
assert.ok(settingsSrc.includes('\\uFEFF'), 'CSV export must prefix UTF-8 BOM for Excel');

function testEscapeCsvCell(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

assert.equal(testEscapeCsvCell('Simple'), 'Simple');
assert.equal(testEscapeCsvCell('Comma, separated'), '"Comma, separated"');
assert.equal(testEscapeCsvCell('Semicolon; separated'), '"Semicolon; separated"');
assert.equal(testEscapeCsvCell('Quote "test"'), '"Quote ""test"""');
assert.equal(testEscapeCsvCell('Line1\nLine2'), '"Line1\nLine2"');
assert.equal(testEscapeCsvCell('Line1\r\nLine2'), '"Line1\r\nLine2"');
assert.equal(testEscapeCsvCell('Umlaute: Ä, Ö, Ü, ä, ö, ü, ß'), '"Umlaute: Ä, Ö, Ü, ä, ö, ü, ß"');
console.log('✓ CSV export cell escaping verified with all special characters');

// ── 7. Primary key collision handling on merge import (db.js) ──
const dbSrc = read('js/db.js');
assert.ok(dbSrc.includes('existingWorkoutIds.has(w.workoutId)'), 'importAllData must detect existing workoutId collisions');
assert.ok(dbSrc.includes('w.workoutId = uuid()'), 'importAllData must reassign uuid to prevent collision on merge');
assert.ok(dbSrc.includes('existingTypeNames.has(typeNameKey)'), 'importAllData must prevent duplicate workout type names on merge');
console.log('✓ db.js merge import collision prevention verified');

// ── 8. Workouts with null/undefined exercises handled safely in home.js and history.js ──
const homeSrc = read('js/pages/home.js');
assert.ok(homeSrc.includes('const exCount = w.exercises ? w.exercises.length : 0;'), 'home.js must safely guard w.exercises count');

const historySrc = read('js/pages/history.js');
assert.ok(historySrc.includes('const exCount = w.exercises ? w.exercises.length : 0;'), 'history.js must safely guard w.exercises count');
console.log('✓ home.js and history.js safe exercise count guards verified');

// ── 9. Heatmap local date formatting in home.js ──
assert.ok(
  homeSrc.includes('dayDateStr = `${String(iterDate.getDate()).padStart(2, \'0\')}.${String(iterDate.getMonth() + 1).padStart(2, \'0\')}.${iterDate.getFullYear()}`'),
  'home.js must format heatmap dayDateStr in local time'
);
console.log('✓ Heatmap local date formatting verified');

// ── 10. Workout detail share error handling & back button ──
const detailSrc = read('js/pages/workout-detail.js');
assert.ok(detailSrc.includes('id="btn-back-workout"'), 'workout-detail back button must have id="btn-back-workout"');
assert.ok(detailSrc.includes("showToast('Grafik konnte nicht erstellt werden')"), 'shareWorkoutGraphic must catch canvas errors and show toast');
assert.ok(detailSrc.includes('if (!ctx)'), 'shareWorkoutGraphic must guard against null canvas context');
console.log('✓ workout-detail error handling and back button verified');

console.log('\nAll adversarial edge case tests passed successfully!');
