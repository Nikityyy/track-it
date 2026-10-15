const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

// 1. Test index.html requirements
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(indexHtml.includes('src="./vendor/lucide.min.js"'), 'lucide.min.js should be local');
assert.ok(indexHtml.includes('src="./vendor/web-haptics.js"'), 'web-haptics.js should be local');
assert.ok(!indexHtml.includes('https://cdn.jsdelivr.net'), 'No CDN scripts in index.html');
assert.ok(!indexHtml.includes('https://esm.sh'), 'No esm.sh scripts in index.html');
assert.ok(indexHtml.includes('viewport-fit=cover'), 'Viewport meta should contain viewport-fit=cover');
assert.ok(!indexHtml.includes('user-scalable=no'), 'Viewport meta should not contain user-scalable=no');
assert.ok(indexHtml.includes('./fonts/archivo-latin.woff2'), 'Archivo should be preloaded from the local fonts folder');
assert.ok(!indexHtml.includes('fonts.googleapis.com'), 'Fonts must be self-hosted so the app works offline');

const descMatches = indexHtml.match(/<meta name="description"/g);
assert.equal(descMatches ? descMatches.length : 0, 1, 'There should be exactly one description meta tag');

// 2. Test service-worker.js requirements
const swContent = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
assert.ok(/CACHE_NAME = 'trackit-[0-9a-f]{10}'/.test(swContent), 'Cache name should be the content stamp (npm run stamp)');
assert.ok(swContent.includes("'./fonts/archivo-latin.woff2'") && swContent.includes("'./fonts/archivo-latin-ext.woff2'"), 'PRECACHE_URLS should contain the self-hosted fonts');
assert.ok(swContent.includes("'./vendor/lucide.min.js'"), 'PRECACHE_URLS should contain vendor/lucide.min.js');
assert.ok(swContent.includes("'./vendor/web-haptics.js'"), 'PRECACHE_URLS should contain vendor/web-haptics.js');
assert.ok(swContent.includes('cache.match(e.request, { ignoreSearch: true })'), 'Should serve the app from the versioned cache');
assert.ok(!swContent.match(/'\/(css|js|vendor|icons|manifest)/), 'No root-relative paths in service-worker precache');
assert.ok(!indexHtml.match(/src\s*=\s*['"]\/(?!#)/), 'No root-relative script/img src in index.html');
assert.ok(!indexHtml.match(/href\s*=\s*['"]\/(?!#)/), 'No root-relative link href in index.html');

// 3. Test WebHaptics
const hapticsSource = fs.readFileSync(path.join(root, 'vendor/web-haptics.js'), 'utf8');
let vibrateCalledWith = null;
const hapticsContext = {
  navigator: {
    vibrate: (pattern) => {
      vibrateCalledWith = pattern;
      return true;
    }
  },
  document: {
    body: {
      appendChild: () => {}
    },
    getElementById: () => null,
    createElement: (tag) => ({
      tagName: tag,
      setAttribute: () => {},
      appendChild: () => {},
      click: () => {}
    })
  },
  window: {},
  setTimeout: (fn) => fn(),
  module: { exports: {} }
};
vm.createContext(hapticsContext);
vm.runInContext(hapticsSource, hapticsContext);
const haptic = hapticsContext.window.haptic;
assert.ok(haptic, 'window.haptic should exist');

haptic.trigger(40);
assert.equal(vibrateCalledWith, 40);

haptic.trigger('success');
assert.deepEqual(Array.from(vibrateCalledWith), [20, 60, 40]);

haptic.trigger('error');
assert.deepEqual(Array.from(vibrateCalledWith), [60, 40, 60, 40, 60]);

haptic.trigger('warning');
assert.deepEqual(Array.from(vibrateCalledWith), [40, 60, 40]);

// Test WebHaptics in headless env without crash
const headlessContext = { module: { exports: {} } };
vm.createContext(headlessContext);
vm.runInContext(hapticsSource, headlessContext);
const HeadlessWebHaptics = headlessContext.module.exports.WebHaptics;
const instance = new HeadlessWebHaptics();
assert.equal(instance.trigger(20), true);

// Test WebHaptics iOS Taptic Engine switch-in-label and style requirements
assert.ok(hapticsSource.includes("label.appendChild(input)"), 'iOS switch input should be appended inside label');
assert.ok(hapticsSource.includes("container.appendChild(label)"), 'label containing switch should be appended to container');
assert.ok(!hapticsSource.includes("display: none"), 'Should never use display:none for iOS switch container');
assert.ok(
  hapticsSource.includes("opacity: 0; pointer-events: none; position: fixed; top: -100px; left: -100px; width: 1px; height: 1px; overflow: hidden;"),
  'Switch container must use exact non-display-none hidden styles'
);

// 4. Test Form History Ring Buffer (30 max)
const formHistorySource = fs.readFileSync(path.join(root, 'js/form-history.js'), 'utf8');
const historyContext = {
  console,
  document: {
    getElementById: () => null,
    querySelectorAll: () => []
  },
  cloneWorkout: (w) => JSON.parse(JSON.stringify(w)),
  collectWorkoutFromForm: () => null,
  updateUndoRedoButtons: () => {},
  setTimeout: () => {},
  clearTimeout: () => {}
};
vm.createContext(historyContext);
vm.runInContext(formHistorySource, historyContext);

// Initialize with 40 states
const dummyItems = Array.from({ length: 40 }, (_, i) => ({ workoutId: `w-${i}` }));
historyContext.initFormHistory({ workoutId: 'w-default' }, { items: dummyItems, index: 39 });
const state = historyContext.getFormHistoryState();
assert.equal(state.items.length, 30, 'Form history items should be capped at 30');
assert.equal(state.items[0].workoutId, 'w-10', 'Oldest 10 states should have been dropped');
assert.equal(state.index, 29, 'Index should be adjusted to 29');

// 5. Test Rest Timer formatting & no NaN
const restTimerSource = fs.readFileSync(path.join(root, 'js/rest-timer.js'), 'utf8');
const timerContext = {
  console,
  Math,
  Number,
  parseInt,
  formatDuration: (s) => `${s}s`,
  Date,
  setInterval: () => 123,
  clearInterval: () => {}
};
vm.createContext(timerContext);
vm.runInContext(restTimerSource, timerContext);

// Test rest timer via handleRestTimerButton
const mockInput = { value: '' };
const mockBtn = { title: '', classList: { add: () => {}, remove: () => {} }, setAttribute: () => {} };
const mockRow = {
  classList: { contains: () => false },
  querySelector: (sel) => {
    if (sel === '.set-break') return mockInput;
    return null;
  }
};
mockBtn.closest = () => mockRow;
mockInput.value = 'invalid';

timerContext.handleRestTimerButton(mockBtn);
assert.equal(mockInput.value, '0', 'Input value should be cleanly 0 and not NaN');
assert.ok(!mockInput.value.includes('NaN'), 'No NaN in input value');

// Test huge value overflow cap
timerContext.pauseActiveRestTimer(false);
mockInput.value = '9999999';
timerContext.handleRestTimerButton(mockBtn);
assert.equal(mockInput.value, '86400', 'Huge elapsed time should be capped at 86400s (24h)');
timerContext.pauseActiveRestTimer(false);

console.log('All WP1 feature tests passed successfully!');
