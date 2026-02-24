const DB_NAME = 'trackit-db';
const DB_VERSION = 1;

const STORES = {
  workouts: 'workouts',
  workoutTypes: 'workoutTypes',
  drafts: 'drafts',
  settings: 'settings'
};

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORES.workouts)) {
        db.createObjectStore(STORES.workouts, { keyPath: 'workoutId' });
      }
      if (!db.objectStoreNames.contains(STORES.workoutTypes)) {
        db.createObjectStore(STORES.workoutTypes, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.drafts)) {
        db.createObjectStore(STORES.drafts, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

/* generic helpers */
async function _tx(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = fn(store);
    tx.oncomplete = () => resolve(result._result);
    tx.onerror = (e) => reject(e.target.error);
    // capture async result
    if (result instanceof IDBRequest) {
      result.onsuccess = () => { result._result = result.result; };
    }
  });
}

async function dbPut(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(data);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function dbGet(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function dbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function dbDelete(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function dbClear(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

/* ── Workouts ── */
async function saveWorkout(workout) {
  workout.updatedAt = new Date().toISOString();
  await dbPut(STORES.workouts, workout);
}

async function getWorkout(id) {
  return dbGet(STORES.workouts, id);
}

async function getAllWorkouts() {
  const all = await dbGetAll(STORES.workouts);
  return all.sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function deleteWorkout(id) {
  return dbDelete(STORES.workouts, id);
}

/* ── Workout Types ── */
async function getWorkoutTypes() {
  const types = await dbGetAll(STORES.workoutTypes);
  if (types.length === 0) {
    const defaults = [
      { id: uuid(), name: 'Push' },
      { id: uuid(), name: 'Pull' },
      { id: uuid(), name: 'Beine' },
      { id: uuid(), name: 'Arme' },
      { id: uuid(), name: 'Ganzkörper' }
    ];
    for (const t of defaults) await dbPut(STORES.workoutTypes, t);
    return defaults;
  }
  return types;
}

async function saveWorkoutType(type) {
  return dbPut(STORES.workoutTypes, type);
}

async function deleteWorkoutType(id) {
  return dbDelete(STORES.workoutTypes, id);
}

/* ── Drafts ── */
async function saveDraft(draft) {
  await dbPut(STORES.drafts, { key: 'current', ...draft, savedAt: new Date().toISOString() });
}

async function getDraft() {
  return dbGet(STORES.drafts, 'current');
}

async function clearDraft() {
  return dbDelete(STORES.drafts, 'current');
}

/* ── Export / Import ── */
async function exportAllData() {
  const workouts = await dbGetAll(STORES.workouts);
  const types = await dbGetAll(STORES.workoutTypes);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    workoutTypes: types,
    workouts: workouts
  };
}

async function importAllData(data) {
  if (!data || !data.workouts) throw new Error('Ungültiges Datenformat');
  // Clear existing
  await dbClear(STORES.workouts);
  await dbClear(STORES.workoutTypes);
  // Import types
  if (data.workoutTypes) {
    for (const t of data.workoutTypes) await dbPut(STORES.workoutTypes, t);
  }
  // Import workouts
  for (const w of data.workouts) await dbPut(STORES.workouts, w);
}
