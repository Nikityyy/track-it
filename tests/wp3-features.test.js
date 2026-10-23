const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

console.log('Testing WP3: Pages & Interactive Features for Track It!...');

// Helper to read file content
function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

// ── 1. Test modal.js (U3: Focus cancel on danger modal) ──
const modalSrc = read('js/components/modal.js');
assert.ok(modalSrc.includes('if (danger)'), 'modal.js should branch on danger flag');
assert.ok(modalSrc.includes("overlay.querySelector('.modal-cancel').focus("), 'modal.js should focus cancel button when danger is true');

// Execute modal.js in VM to test focus behavior
let cancelFocused = false;
let confirmFocused = false;
const modalContext = {
  Node: class Node {},
  document: {
    querySelector: () => null,
    getElementById: () => null,
    documentElement: { classList: { toggle: () => {} } },
    activeElement: null,
    dispatchEvent: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: () => {
      const el = {
        className: '',
        setAttribute: () => {},
        classList: { add: () => {}, remove: () => {} },
        innerHTML: '',
        addEventListener: () => {},
        querySelector: (sel) => {
          if (sel === '.modal-cancel') return { focus: () => { cancelFocused = true; }, addEventListener: () => {} };
          if (sel === '.modal-confirm') return { focus: () => { confirmFocused = true; }, addEventListener: () => {} };
          if (sel === '.modal-close') return { addEventListener: () => {} };
          if (sel === '.modal-body') return { textContent: '', appendChild: () => {} };
          return null;
        },
        querySelectorAll: () => []
      };
      return el;
    },
    body: { appendChild: () => {} }
  },
  window: { scrollY: 0 },
  escapeHtml: (s) => s,
  icon: () => '<svg></svg>',
  requestAnimationFrame: (cb) => cb(),
  setTimeout: () => 1
};
vm.createContext(modalContext);
vm.runInContext(modalSrc, modalContext);

modalContext.showModal({ title: 'Danger Modal', bodyText: 'Are you sure?', danger: true });
assert.ok(cancelFocused, 'Cancel button should be focused when danger is true');
assert.ok(!confirmFocused, 'Confirm button should not be focused when danger is true');

cancelFocused = false;
confirmFocused = false;
modalContext.showModal({ title: 'Standard Modal', bodyText: 'Proceed?', danger: false });
assert.ok(confirmFocused, 'Confirm button should be focused when danger is false');
assert.ok(!cancelFocused, 'Cancel button should not be focused when danger is false');

console.log('✓ [U3] modal.js danger focus behavior verified');

// ── 2. Test create-workout.js ──
const createWorkoutSrc = read('js/pages/create-workout.js');

// [U1]: Cancel confirmation when draft or changes exist
assert.ok(createWorkoutSrc.includes("document.getElementById('btn-cancel')"), 'Cancel button listener should exist');
assert.ok(createWorkoutSrc.includes('getDraft'), 'btn-cancel should check getDraft()');
assert.ok(createWorkoutSrc.includes("title: 'Entwurf verwerfen?'") || createWorkoutSrc.includes('Entwurf verwerfen'), 'btn-cancel should show modal to confirm discarding draft');

// [U11]: Exercise reordering chevrons in exercise-card-header
assert.ok(createWorkoutSrc.includes('exercise-move-up'), 'exercise card header should contain .exercise-move-up button');
assert.ok(createWorkoutSrc.includes('exercise-move-down'), 'exercise card header should contain .exercise-move-down button');
assert.ok(createWorkoutSrc.includes('.exercise-move-up'), 'exercises container should have handler for .exercise-move-up');
assert.ok(createWorkoutSrc.includes('.exercise-move-down'), 'exercises container should have handler for .exercise-move-down');

// [U12]: Smart set deletion
assert.ok(
  createWorkoutSrc.includes('set.reps === 0 || set.reps === \'0\'') &&
  createWorkoutSrc.includes('set.rpe === 5 || set.rpe === \'5\'') &&
  createWorkoutSrc.includes('set.breakSeconds === 0 || set.breakSeconds === \'0\'') &&
  createWorkoutSrc.includes('!set.note'),
  'Smart set deletion condition should check reps, rpe, breakSeconds, and note'
);

// [F13]: Workout notes textarea & collection
assert.ok(createWorkoutSrc.includes('<textarea id="workout-notes" class="input" placeholder="Notizen zum Workout (optional)..." rows="3">'), 'renderWorkoutForm should contain #workout-notes textarea');
assert.ok(createWorkoutSrc.includes("document.getElementById('workout-notes')?.value.trim()"), 'collectWorkoutFromForm should collect workout.notes');

// [D12]: Sticky form actions
assert.ok(createWorkoutSrc.includes('form-actions-sticky'), 'form-actions should have form-actions-sticky class');

console.log('✓ [U1, U11, U12, F13, D12] create-workout.js features verified');

// ── 3. Test home.js ──
const homeSrc = read('js/pages/home.js');

// [U2]: Discard draft confirmation modal
assert.ok(homeSrc.includes("document.getElementById('discard-draft')"), 'discard-draft button listener should exist');
assert.ok(homeSrc.includes("title: 'Entwurf verwerfen'") || homeSrc.includes('Entwurf verwerfen'), 'discard-draft should prompt showModal');
assert.ok(homeSrc.includes('danger: true'), 'discard-draft modal should be marked danger');

// [U14]: Empty state create button
assert.ok(homeSrc.includes('<a href="#/create" class="btn btn-primary mt-2">Workout erstellen</a>'), 'home.js empty-state should contain link to #/create');

// [F12]: Frequency Heatmap Calendar & streak counter
assert.ok(homeSrc.includes('heatmap-widget'), 'home.js should contain heatmap widget');
assert.ok(homeSrc.includes('heatmap-weekdays'), 'home.js should contain heatmap weekdays header');
assert.ok(homeSrc.includes('heatmap-streak') || homeSrc.includes('Streak'), 'home.js should contain streak indicator');
assert.ok(homeSrc.includes('github-graph') && homeSrc.includes('<span>Mo</span>') && homeSrc.includes('<span>Mi</span>') && homeSrc.includes('<span>Fr</span>'), 'home.js heatmap should have GitHub-style horizontal contribution graph with Mo, Mi, Fr day labels');

// [D6]: Theme-adaptive charts
assert.ok(homeSrc.includes('getComputedStyle(document.documentElement)'), 'Canvas charts should read computed CSS variables');
assert.ok(homeSrc.includes('renderDoughnutChart'), 'renderDoughnutChart function should exist');
assert.ok(homeSrc.includes('renderBarChart'), 'renderBarChart function should exist');

console.log('✓ [U2, U14, F12, D6] home.js features verified');

// ── 4. Test history.js ──
const historySrc = read('js/pages/history.js');

// [U5]: Search by exercise name
assert.ok(
  historySrc.includes('w.name.toLowerCase().includes(query)') &&
  historySrc.includes('w.exercises') &&
  historySrc.includes('ex.name'),
  'Search handler in history.js should search workout name, type, and exercise names'
);

// [D9]: workout-card-v2 design
assert.ok(historySrc.includes('workout-card-v2'), 'history.js should render workout-card-v2 cards');
assert.ok(historySrc.includes('workout-card-accent'), 'history.js cards should have accent bar');
assert.ok(historySrc.includes('workout-card-chips'), 'history.js cards should have meta chips');

// [U14]: Empty state and search filter reset
assert.ok(historySrc.includes('<a href="#/create" class="btn btn-primary mt-2">Workout erstellen</a>'), 'history.js empty state should have create workout button');
assert.ok(historySrc.includes('btn-reset-filter') || historySrc.includes('Filter zurücksetzen'), 'history.js should show filter reset button when 0 results found');

console.log('✓ [U5, D9, U14] history.js features verified');

// ── 5. Test workout-detail.js ──
const detailSrc = read('js/pages/workout-detail.js');

// [U13]: Smart Back Navigation
assert.ok(
  detailSrc.includes("Router.back('/history')") && !detailSrc.includes('onclick='),
  'Back button should use smart history back navigation'
);

// [F13]: Display workout notes
assert.ok(detailSrc.includes('detail-notes'), 'workout-detail.js should render detail-notes card');
assert.ok(detailSrc.includes('workout.notes'), 'workout-detail.js should check workout.notes');

// [F15]: Shareable Graphic Workout Card
assert.ok(detailSrc.includes('btn-share-workout'), 'workout-detail.js should have a share workout button');
assert.ok(detailSrc.includes('shareWorkoutGraphic'), 'workout-detail.js should implement shareWorkoutGraphic');
assert.ok(detailSrc.includes('navigator.share'), 'shareWorkoutGraphic should check navigator.share');
assert.ok(detailSrc.includes('Track It!') || detailSrc.includes('TRACK IT!'), 'Canvas graphic should include Track It! branding');

console.log('✓ [U13, F13, F15] workout-detail.js features verified');

// ── 6. Test settings.js ──
const settingsSrc = read('js/pages/settings.js');

// [D6]: Theme Switcher
assert.ok(settingsSrc.includes('theme-select'), 'settings.js should have theme-select dropdown');
assert.ok(settingsSrc.includes('Dunkel (Standard)'), 'settings.js should offer Dunkel option');
assert.ok(settingsSrc.includes('OLED Schwarz'), 'settings.js should offer OLED option');
assert.ok(settingsSrc.includes('Hell'), 'settings.js should offer Hell option');
assert.ok(settingsSrc.includes('trackit-theme'), 'settings.js should save theme to localStorage');
assert.ok(settingsSrc.includes("setAttribute('data-theme'"), 'settings.js should apply data-theme immediately');

// [U4]: Safe workout type rename
assert.ok(
  settingsSrc.includes('Möchtest du den Namen für alle bestehenden Workouts aktualisieren oder nur für zukünftige Workouts?'),
  'settings.js should prompt modal with exact rename question'
);
assert.ok(settingsSrc.includes('Alle aktualisieren'), 'Rename modal should have "Alle aktualisieren" confirm button');
assert.ok(settingsSrc.includes('Nur zukünftige'), 'Rename modal should have "Nur zukünftige" cancel button');

// [F10]: CSV Export
assert.ok(settingsSrc.includes('btn-export-csv'), 'settings.js should have CSV export button');
assert.ok(settingsSrc.includes('compileWorkoutsToCsv'), 'settings.js should compile workouts to CSV');
assert.ok(settingsSrc.includes('Datum, Workout, Typ, Übung, Satz, Wdh, RPE, Pause, Notiz') || settingsSrc.includes('Datum,Workout,Typ,Übung,Satz,Wdh,RPE,Pause,Notiz') || settingsSrc.includes('\'Datum\', \'Workout\', \'Typ\', \'Übung\', \'Satz\', \'Wdh\', \'RPE\', \'Pause\', \'Notiz\''), 'CSV should include all required column headers');

// [T9]: Merge JSON Import
assert.ok(settingsSrc.includes('import-merge-checkbox'), 'settings.js should have merge import checkbox');
assert.ok(settingsSrc.includes('Bestehende Workouts behalten (Zusammenführen)'), 'Checkbox label should mention merging');
assert.ok(settingsSrc.includes('{ merge: isMerge }'), 'importAllData should receive merge option');

console.log('✓ [D6, U4, F10, T9] settings.js features verified');

// ── 7. Test CSS styles for WP3 additions ──
const stylesCss = read('css/styles.css');
assert.ok(stylesCss.includes('.detail-notes'), 'styles.css should style .detail-notes');
assert.ok(stylesCss.includes('.heatmap-widget'), 'styles.css should style .heatmap-widget');
assert.ok(stylesCss.includes('.heatmap-weekdays'), 'styles.css should style .heatmap-weekdays');
assert.ok(stylesCss.includes('.heatmap-cell'), 'styles.css should style .heatmap-cell');

console.log('✓ CSS styles for WP3 verified');

// ── 8. App and index static check ──
const appSrc = read('js/app.js');
assert.ok(appSrc.includes('trackit-theme'), 'app.js should initialize theme on DOMContentLoaded');

// ── 9. Exercise Move Buttons, Set Row Hover Removal, and Action Bar Gap ──
const createWorkoutSrcLatest = read('js/pages/create-workout.js');
assert.ok(createWorkoutSrcLatest.includes('upBtn.disabled = isTop;'), 'updateExerciseIndices must disable up button on top exercise');
assert.ok(createWorkoutSrcLatest.includes('downBtn.disabled = isBottom;'), 'updateExerciseIndices must disable down button on bottom exercise');
assert.ok(!stylesCss.includes('.set-row:hover {'), 'styles.css must NOT have .set-row:hover background');
assert.ok(/\.form-actions-sticky\s*\{[^}]*flex-wrap:\s*nowrap;/.test(stylesCss), 'sticky form actions must stay on one row on mobile');

console.log('All WP3 feature tests passed successfully!');
