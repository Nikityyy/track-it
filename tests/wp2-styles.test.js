const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const designTokensCss = fs.readFileSync(path.join(rootDir, 'design-tokens.css'), 'utf8');
const stylesCss = fs.readFileSync(path.join(rootDir, 'css', 'styles.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

console.log('Testing WP2: Design Tokens, CSS Styles & Mobile Ergonomics...');

// 1. Design Tokens
assert(designTokensCss.includes('--color-accent: #ff6b1f;'), 'Missing --color-accent token');
assert(designTokensCss.includes('--color-accent-hover: #ff8540;'), 'Missing --color-accent-hover token');
assert(designTokensCss.includes('--on-accent: #1a0b02;'), 'Missing --on-accent token');
assert(designTokensCss.includes('--color-success: #5cc48a;'), 'Missing --color-success token');
assert(designTokensCss.includes('--color-warning: #e8a23a;'), 'Missing --color-warning token');
assert(designTokensCss.includes('--color-danger: #ff6a5c;'), 'Missing --color-danger token');
assert(designTokensCss.includes('--color-info: #7ea6f0;'), 'Missing --color-info token');
assert(designTokensCss.includes("font-family: 'Archivo';"), 'Missing self-hosted Archivo @font-face');

assert(designTokensCss.includes('--space-2xs: 2px;'), 'Missing --space-2xs');
assert(designTokensCss.includes('--space-xs: 4px;'), 'Missing --space-xs');
assert(designTokensCss.includes('--space-sm: 8px;'), 'Missing --space-sm');
assert(designTokensCss.includes('--space-md: 12px;'), 'Missing --space-md');
assert(designTokensCss.includes('--space-lg: 16px;'), 'Missing --space-lg');
assert(designTokensCss.includes('--space-xl: 24px;'), 'Missing --space-xl');
assert(designTokensCss.includes('--space-2xl: 32px;'), 'Missing --space-2xl');

assert(designTokensCss.includes('[data-theme="light"]'), 'Missing [data-theme="light"] override block');
assert(designTokensCss.includes('--bg: #f0efeb;'), 'Missing light mode --bg');
assert(designTokensCss.includes('--surface: #ffffff;'), 'Missing light mode --surface');
assert(designTokensCss.includes('--surface-2: #e4e2dc;'), 'Missing light mode --surface-2');
assert(designTokensCss.includes('--surface-hover: #d8d6cf;'), 'Missing light mode --surface-hover');
assert(designTokensCss.includes('--text-primary: #16140f;'), 'Missing light mode --text-primary');
assert(designTokensCss.includes('--text-muted: #5c584f;'), 'Missing light mode --text-muted');
assert(designTokensCss.includes('--muted-border: #d6d3cb;'), 'Missing light mode --muted-border');
assert(designTokensCss.includes('--muted-border-hover: #bdb9ae;'), 'Missing light mode --muted-border-hover');
assert(designTokensCss.includes('--shadow: rgba(22, 20, 15, 0.08);'), 'Missing light mode --shadow');

assert(designTokensCss.includes('[data-theme="oled"]'), 'Missing [data-theme="oled"] override block');
assert(designTokensCss.includes('--surface: #0b0a09;'), 'Missing oled mode --surface');
assert(designTokensCss.includes('--surface-2: #171614;'), 'Missing oled mode --surface-2');
assert(designTokensCss.includes('--surface-hover: #22201d;'), 'Missing oled mode --surface-hover');
assert(designTokensCss.includes('--text-primary: #f5f2eb;'), 'Missing oled mode --text-primary');
assert(designTokensCss.includes('--muted-border: #1f1d1a;'), 'Missing oled mode --muted-border');

console.log('✓ Design tokens verified successfully');

// 2. Safe Areas
assert(
  stylesCss.includes('padding-top: max(calc(var(--space-sm) * 1.5), var(--inset-top));') &&
  stylesCss.includes('--inset-top: env(safe-area-inset-top, 0px);'),
  'Missing .app-header safe-area padding-top'
);
assert(
  stylesCss.includes('padding-bottom: max(calc(var(--space-sm) * 4), env(safe-area-inset-bottom, 0px));'),
  'Missing .app-content safe-area padding-bottom'
);
assert(
  stylesCss.includes('bottom: max(calc(var(--space-sm) * 3), calc(env(safe-area-inset-bottom, 0px) + 16px));'),
  'Missing #toast-container safe-area bottom'
);
assert(indexHtml.includes('viewport-fit=cover'), 'index.html missing viewport-fit=cover');

console.log('✓ Safe area rules verified successfully');

// 3. Touch Hitboxes (>= 44x44px target)
assert(stylesCss.includes('.btn-icon::after'), 'Missing .btn-icon::after hitbox');
assert(stylesCss.includes('.nav-link::after'), 'Missing .nav-link::after hitbox');
assert(stylesCss.includes('.stepper__btn::after'), 'Missing .stepper__btn::after hitbox');
assert(stylesCss.includes('.remove-set::after'), 'Missing .remove-set::after hitbox');
assert(stylesCss.includes('.skip-btn::after'), 'Missing .skip-btn::after hitbox');
assert(stylesCss.includes('min-width: 44px;'), 'Missing min-width: 44px hitbox');
assert(stylesCss.includes('min-height: 44px;'), 'Missing min-height: 44px hitbox');
// Touch Hitbox Bleed / Overlap prevention for stepper buttons
assert(
  stylesCss.includes('.stepper__btn::after') &&
  stylesCss.includes('min-width: 100%;') &&
  stylesCss.includes('width: 100%;') &&
  stylesCss.includes('transform: translateY(-50%);'),
  'Stepper button hitbox should be constrained vertically without horizontal bleed'
);

console.log('✓ Touch hitboxes verified successfully');

// 4. Set row & Stepper widths (fluid & mobile 2-tier layout)
assert(stylesCss.includes('.stepper-break .stepper__input'), 'Missing .stepper-break .stepper__input sizing');
assert(/\.sets-header-col:nth-child\(5\)\s*\{\s*display:\s*none;/.test(stylesCss), 'Missing mobile sets-header-col 5 hidden');
assert(stylesCss.includes('/* Fluid Set Rows on Mobile (U6 & D4) */'), 'Missing mobile fluid set row block');
// Desktop stepper dimensions and active tap feedback
assert(stylesCss.includes('width: 32px;'), 'Missing desktop stepper button 32px width');
assert(stylesCss.includes('transform: scale(0.92);'), 'Missing stepper button tap active feedback');
// Mobile stepper dimensions and input font size
assert(/height:\s*34px;/.test(stylesCss), 'Missing mobile stepper height 34px');
assert(/width:\s*28px;/.test(stylesCss), 'Missing mobile stepper button width 28px');
assert(!/stepper-sm\s+\.stepper__input\s*\{[^}]*font-size:\s*14px;/.test(stylesCss), 'Old 14px stepper input size should not exist');
assert(/stepper-sm\s+\.stepper__input\s*\{[^}]*font-size:\s*16px;/.test(stylesCss), 'Mobile stepper input must be at least 16px');
assert(stylesCss.includes('@media (max-width: 360px)'), 'Missing narrow mobile screen optimization for <= 360px');

// Verify all input font-sizes are at least 16px (eliminating iOS auto-zoom)
const baseInputRuleMatch = stylesCss.match(/input,\s*select,\s*textarea,\s*\.input,\s*\.select,\s*\.stepper__input\s*\{[^}]*font-size:\s*16px;/);
assert(baseInputRuleMatch, 'Base inputs and steppers must declare font-size: 16px');
const mobileBlock = stylesCss.slice(stylesCss.indexOf('@media (max-width: 480px)'));
assert(
  mobileBlock.includes('input,\n    select,\n    textarea,\n    .input,\n    .select,\n    .stepper__input {\n        font-size: 16px;\n    }') ||
  mobileBlock.includes('font-size: 16px;'),
  'Mobile inputs and steppers must declare font-size: 16px on <= 480px'
);

console.log('✓ Fluid set rows and stepper widths verified successfully');

// 5. Removed Landscape Lockout (D5)
assert(
  !stylesCss.includes('Bitte drehe dein Gerät ins Hochformat'),
  'Landscape lockout overlay was NOT removed'
);

console.log('✓ Landscape lockout overlay removal verified successfully');

// 6. Detail Table Headers (D10)
assert(stylesCss.includes('.detail-sets-header'), 'Missing .detail-sets-header CSS class');
assert(
  stylesCss.includes('grid-template-columns: minmax(72px, 1fr) minmax(56px, 0.65fr) minmax(52px, 0.55fr) minmax(74px, 0.85fr) minmax(0, 1.35fr);'),
  'detail-sets-header desktop columns do not match detail-set-row'
);

console.log('✓ Detail table header rules verified successfully');

// 7. Sticky Save Bar (D12)
assert(stylesCss.includes('.form-actions-sticky'), 'Missing .form-actions-sticky CSS class');
assert(stylesCss.includes('position: sticky;'), 'Missing position: sticky on form actions');

console.log('✓ Sticky save bar verified successfully');

// 8. Theme support for native controls & scrollbars
assert(stylesCss.includes('scrollbar-color:'), 'Missing Firefox scrollbar-color rule');
assert(stylesCss.includes('::-webkit-scrollbar-thumb'), 'Missing webkit scrollbar thumb');
assert(stylesCss.includes('--scrollbar-thumb'), 'Missing --scrollbar-thumb token usage');

console.log('✓ Theme support for controls and scrollbars verified successfully');
console.log('All WP2 tests passed successfully!');
