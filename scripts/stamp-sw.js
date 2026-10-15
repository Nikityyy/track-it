#!/usr/bin/env node
/* Stamp the service worker with a hash of every file it precaches.
 *
 * Browsers only install a new service worker when service-worker.js itself
 * changes. Hashing the app's files into CACHE_NAME means every change to the
 * app ships as a new version automatically.
 *
 *   node scripts/stamp-sw.js          write the new stamp
 *   node scripts/stamp-sw.js --print  only print what it should be
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const swPath = path.join(root, 'service-worker.js');

function precacheFiles(swSource) {
  const list = swSource.match(/const PRECACHE_URLS = \[([\s\S]*?)\];/);
  if (!list) throw new Error('PRECACHE_URLS not found in service-worker.js');
  return [...list[1].matchAll(/'([^']+)'/g)]
    .map(m => m[1])
    .filter(url => url !== './')
    .map(url => url.replace(/^\.\//, ''));
}

function computeStamp() {
  const swSource = fs.readFileSync(swPath, 'utf8');
  const hash = crypto.createHash('sha256');
  for (const file of precacheFiles(swSource)) {
    hash.update(file);
    hash.update(fs.readFileSync(path.join(root, file)));
  }
  // The worker's own logic counts too (without its stamp line)
  hash.update(swSource.replace(/const CACHE_NAME = '[^']*';/, ''));
  return 'trackit-' + hash.digest('hex').slice(0, 10);
}

module.exports = { computeStamp, precacheFiles };

if (require.main === module) {
  const stamp = computeStamp();
  if (process.argv.includes('--print')) {
    console.log(stamp);
  } else {
    const source = fs.readFileSync(swPath, 'utf8');
    fs.writeFileSync(swPath, source.replace(/const CACHE_NAME = '[^']*';/, `const CACHE_NAME = '${stamp}';`));
    console.log('service-worker.js stamped:', stamp);
  }
}
