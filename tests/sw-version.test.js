const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { computeStamp, precacheFiles } = require('../scripts/stamp-sw.js');

const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const sw = read('service-worker.js');
const indexHtml = read('index.html');
const appJs = read('js/app.js');

console.log('Testing service worker versioning and updates...');

// 1. The stamp matches the current files, so every change ships as a new version
const current = (sw.match(/const CACHE_NAME = '([^']+)';/) || [])[1];
assert.equal(current, computeStamp(), 'service-worker.js is out of date: run `npm run stamp`');
console.log('✓ Service worker stamp matches the app files');

// 2. Everything index.html loads is precached, so offline launches are complete
const cached = new Set(precacheFiles(sw));
const referenced = [...indexHtml.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g)].map(m => m[1])
  .concat([...indexHtml.matchAll(/<script src="\.\/([^"]+)"><\\\/script>/g)].map(m => m[1]));
for (const file of referenced) {
  assert.ok(cached.has(file), `${file} is used by index.html but not precached`);
  assert.ok(fs.existsSync(path.join(root, file)), `${file} does not exist`);
}
for (const file of cached) {
  assert.ok(fs.existsSync(path.join(root, file)), `precached ${file} does not exist`);
}
console.log('✓ Precache list complete and valid');

// 3. A new version installs fresh and takes over; the page reloads into it
assert.ok(sw.includes("cache: 'reload'"), 'install must bypass the HTTP cache');
assert.ok(sw.includes('self.skipWaiting()') && sw.includes('self.clients.claim()'), 'new worker must take over right away');
assert.ok(!/cache\.put\(/.test(sw), 'the versioned cache must never be patched file by file');
assert.ok(appJs.includes("updateViaCache: 'none'"), 'worker script must not come from the HTTP cache');
assert.ok(appJs.includes('registration.update()') && appJs.includes("visibilityState === 'visible'"), 'updates are checked when the app returns to the foreground');
assert.ok(appJs.includes("'controllerchange'") && appJs.includes('saveCurrentDraft()'), 'the page saves the open workout and reloads when a new version takes over');
console.log('✓ Update flow in place');

console.log('\nAll service worker tests passed successfully!');
