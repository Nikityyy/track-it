const DB_NAME = 'trackit-db';
const DB_VERSION = 2;

const STORES = {
  workouts: 'workouts',
  workoutTypes: 'workoutTypes',
  drafts: 'drafts',
  settings: 'settings'
};

let _db = null;

function requestStoragePersistence() {
  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
    navigator.storage.persist().catch(() => {});
  }
}

function openDB() {
  if (_db) return Promise.resolve(_db);
  requestStoragePersistence();
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const tx = req.transaction || e.target.transaction;
      let workoutStore;
      if (!db.objectStoreNames.contains(STORES.workouts)) {
        workoutStore = db.createObjectStore(STORES.workouts, { keyPath: 'workoutId' });
      } else if (tx) {
        workoutStore = tx.objectStore(STORES.workouts);
      }
      if (workoutStore) {
        if (!workoutStore.indexNames.contains('by_date')) {
          workoutStore.createIndex('by_date', 'date', { unique: false });
        }
        if (!workoutStore.indexNames.contains('by_type')) {
          workoutStore.createIndex('by_type', 'type', { unique: false });
        }
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

async function saveWorkout(workout) {
  migrateWorkout(workout);
  workout.updatedAt = new Date().toISOString();
  await dbPut(STORES.workouts, workout);
}

async function getWorkout(id) {
  const workout = await dbGet(STORES.workouts, id);
  if (workout) migrateWorkout(workout);
  return workout;
}

async function getAllWorkouts() {
  const all = await dbGetAll(STORES.workouts);
  all.forEach(migrateWorkout);
  return all.sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function deleteWorkout(id) {
  return dbDelete(STORES.workouts, id);
}

async function getWorkoutTypes() {
  const types = await dbGetAll(STORES.workoutTypes);
  if (types.length === 0) {
    const defaults = [
      { id: uuid(), name: 'Push', order: 1 },
      { id: uuid(), name: 'Pull', order: 2 },
      { id: uuid(), name: 'Beine', order: 3 },
      { id: uuid(), name: 'Arme', order: 4 },
      { id: uuid(), name: 'Ganzkörper', order: 5 }
    ];
    for (const t of defaults) await dbPut(STORES.workoutTypes, t);
    return defaults;
  }
  let needsSave = false;
  types.forEach((t, i) => {
    if (typeof t.order !== 'number') {
      t.order = i + 1;
      needsSave = true;
    }
  });
  if (needsSave) {
    for (const t of types) await dbPut(STORES.workoutTypes, t);
  }
  return types.sort((a, b) => a.order - b.order);
}

async function saveWorkoutType(type) {
  return dbPut(STORES.workoutTypes, type);
}

async function deleteWorkoutType(id) {
  return dbDelete(STORES.workoutTypes, id);
}

async function saveDraft(draft) {
  await dbPut(STORES.drafts, { key: 'current', ...draft, savedAt: new Date().toISOString() });
}

async function getDraft() {
  return dbGet(STORES.drafts, 'current');
}

async function clearDraft() {
  return dbDelete(STORES.drafts, 'current');
}

async function exportAllData() {
  const workouts = await dbGetAll(STORES.workouts);
  const types = await dbGetAll(STORES.workoutTypes);
  const settings = await dbGetAll(STORES.settings);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    workoutTypes: types,
    workouts: workouts,
    settings: settings.filter(s => s.key !== 'lastImportBackup')
  };
}

async function importAllData(data, options = {}) {
  const analysis = analyzeImportData(data);
  if (analysis.errors.length > 0) {
    throw new Error(`Import enthält ${analysis.summary.rejected} ungültige Einträge und wurde nicht gestartet`);
  }
  const normalized = {
    workoutTypes: analysis.workoutTypes,
    workouts: analysis.workouts
  };
  const backup = await exportAllData();
  await dbPut(STORES.settings, {
    key: 'lastImportBackup',
    createdAt: new Date().toISOString(),
    data: backup
  });

  const db = await openDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.workouts, STORES.workoutTypes], 'readwrite');
      const workoutStore = tx.objectStore(STORES.workouts);
      const typeStore = tx.objectStore(STORES.workoutTypes);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaktion abgebrochen'));

      if (!options.merge) {
        workoutStore.clear();
        typeStore.clear();
        for (const t of normalized.workoutTypes) typeStore.put(t);
        for (const w of normalized.workouts) workoutStore.put(w);
      } else {
        const existingWorkoutIds = new Set((backup.workouts || []).map(w => w.workoutId));
        const existingTypeNames = new Set((backup.workoutTypes || []).map(t => String(t.name).trim().toLowerCase()));
        const existingTypeIds = new Set((backup.workoutTypes || []).map(t => t.id));

        for (const t of normalized.workoutTypes) {
          const typeNameKey = String(t.name).trim().toLowerCase();
          if (existingTypeNames.has(typeNameKey)) {
            continue;
          }
          if (existingTypeIds.has(t.id)) {
            t.id = uuid();
          }
          existingTypeIds.add(t.id);
          existingTypeNames.add(typeNameKey);
          typeStore.put(t);
        }

        for (const w of normalized.workouts) {
          if (existingWorkoutIds.has(w.workoutId)) {
            w.workoutId = uuid();
          }
          existingWorkoutIds.add(w.workoutId);
          workoutStore.put(w);
        }
      }
    });
  } catch (err) {
    if (!options.merge) {
      await restoreImportBackup(backup);
    }
    throw new Error('Import fehlgeschlagen. Vorherige Daten wurden wiederhergestellt: ' + err.message);
  }
}

async function getLastImportBackup() {
  const backup = await dbGet(STORES.settings, 'lastImportBackup');
  return backup ? backup.data : null;
}

function migrateWorkout(w) {
  if (!w || typeof w !== 'object') return;
  if (!w.workoutId) w.workoutId = uuid();
  if (w.notes === undefined) w.notes = '';
  if (!w.createdAt) w.createdAt = w.date || new Date().toISOString();
  if (!w.date) w.date = w.createdAt;
  if (!w.updatedAt) w.updatedAt = w.createdAt;
  if (!Array.isArray(w.exercises) || w.exercises.length === 0) {
    w.exercises = [createEmptyExercise()];
  }
  for (const ex of w.exercises) {
    if (!ex.exerciseId) ex.exerciseId = uuid();
    if (!ex.mode) ex.mode = 'normal';
    if (!Array.isArray(ex.sets) || ex.sets.length === 0) ex.sets = [createEmptySet(0, ex.mode)];
    for (let i = 0; i < ex.sets.length; i++) {
      migrateSet(ex.sets[i], i, ex.mode);
    }
  }
  if (w.finisher) {
    if (w.finisher.name === undefined) w.finisher.name = '';
    if (!Array.isArray(w.finisher.entries)) w.finisher.entries = [];
    for (const entry of w.finisher.entries) {
      if (!entry.id) entry.id = uuid();
      if (entry.skipped === undefined) entry.skipped = false;
      if (!entry.mode) entry.mode = 'normal';
      if (!Array.isArray(entry.sets)) entry.sets = [];
      for (let i = 0; i < entry.sets.length; i++) {
        migrateSet(entry.sets[i], i, entry.mode);
      }
    }
  }
}

function migrateSet(set, index, mode) {
  const fallback = createEmptySet(index, mode);
  if (!set.setId) set.setId = uuid();
  if (!set.label) set.label = fallback.label;
  if (set.reps === undefined) set.reps = 0;
  if (set.rpe === undefined) set.rpe = 5;
  if (set.breakSeconds === undefined) set.breakSeconds = 0;
  if (set.note === undefined) set.note = '';
  if (set.skipped === undefined) set.skipped = false;
}

async function restoreImportBackup(backup) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.workouts, STORES.workoutTypes], 'readwrite');
    const workoutStore = tx.objectStore(STORES.workouts);
    const typeStore = tx.objectStore(STORES.workoutTypes);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Wiederherstellung abgebrochen'));

    workoutStore.clear();
    typeStore.clear();
    for (const t of backup.workoutTypes || []) typeStore.put(t);
    for (const w of backup.workouts || []) workoutStore.put(w);
  });
}

function validateAndNormalizeImportData(data) {
  const analysis = analyzeImportData(data);
  if (analysis.errors.length > 0) {
    throw new Error(`Import enthält ${analysis.summary.rejected} ungültige Einträge`);
  }
  return {
    workoutTypes: analysis.workoutTypes,
    workouts: analysis.workouts
  };
}

function analyzeImportData(data) {
  if (!data || !Array.isArray(data.workouts)) {
    throw new Error('Ungültiges Datenformat: workouts muss ein Array sein');
  }

  const workoutTypes = [];
  const workouts = [];
  const errors = [];
  let repaired = 0;

  if (Array.isArray(data.workoutTypes)) {
    data.workoutTypes.forEach((type, index) => {
      try {
        const normalized = normalizeWorkoutType(type);
        if (JSON.stringify(normalized) !== JSON.stringify(type)) repaired++;
        workoutTypes.push(normalized);
      } catch (err) {
        errors.push(`Workout-Typ ${index + 1}: ${err.message}`);
      }
    });
  }

  data.workouts.forEach((workout, index) => {
    try {
      const normalized = normalizeWorkout(workout);
      if (JSON.stringify(normalized) !== JSON.stringify(workout)) repaired++;
      workouts.push(normalized);
    } catch (err) {
      errors.push(`Workout ${index + 1}: ${err.message}`);
    }
  });

  return {
    workoutTypes,
    workouts,
    errors,
    summary: {
      valid: workouts.length,
      repaired,
      rejected: errors.length,
      typeErrors: errors.filter(err => err.startsWith('Workout-Typ ')).length
    }
  };
}

function normalizeWorkoutType(type) {
  if (!type || typeof type !== 'object') throw new Error('Ungültiger Workout-Typ');
  const name = String(type.name || '').trim();
  if (!name) throw new Error('Workout-Typ ohne Namen gefunden');
  return {
    id: String(type.id || uuid()),
    name,
    order: typeof type.order === 'number' ? type.order : 999
  };
}

function normalizeWorkout(workout) {
  if (!workout || typeof workout !== 'object') throw new Error('Ungültiges Workout gefunden');
  const now = new Date().toISOString();
  const createdAt = normalizeDate(workout.createdAt, normalizeDate(workout.date, now));
  const date = normalizeDate(workout.date, createdAt);
  return {
    workoutId: String(workout.workoutId || uuid()),
    type: String(workout.type || ''),
    name: String(workout.name || workout.type || 'Workout'),
    date,
    notes: String(workout.notes || ''),
    exercises: normalizeExercises(workout.exercises),
    finisher: normalizeFinisher(workout.finisher),
    createdAt,
    updatedAt: normalizeDate(workout.updatedAt, createdAt)
  };
}

function normalizeExercises(exercises) {
  if (!Array.isArray(exercises) || exercises.length === 0) {
    return [createEmptyExercise()];
  }
  return exercises.map(ex => {
    if (!ex || typeof ex !== 'object') throw new Error('Ungültige Übung gefunden');
    const mode = ex.mode === 'lr' ? 'lr' : 'normal';
    const sets = Array.isArray(ex.sets) && ex.sets.length > 0 ? ex.sets : [createEmptySet(0, mode)];
    return {
      exerciseId: String(ex.exerciseId || uuid()),
      name: String(ex.name || ''),
      mode,
      sets: sets.map((set, i) => normalizeSet(set, i, mode))
    };
  });
}

function normalizeSet(set, index, mode) {
  const safeSet = set && typeof set === 'object' ? set : {};
  const fallback = createEmptySet(index, mode);
  return {
    setId: String(safeSet.setId || uuid()),
    label: String(safeSet.label || fallback.label),
    reps: normalizeNumber(safeSet.reps, 0, 0),
    rpe: normalizeNumber(safeSet.rpe, 5, 1, 10),
    breakSeconds: normalizeNumber(safeSet.breakSeconds, 0, 0),
    note: String(safeSet.note || ''),
    skipped: Boolean(safeSet.skipped)
  };
}

function normalizeFinisher(finisher) {
  if (!finisher || typeof finisher !== 'object' || !finisher.type) return null;
  const type = ['AMRAP', 'EMOM', 'NORMAL'].includes(finisher.type) ? finisher.type : 'NORMAL';
  const entries = Array.isArray(finisher.entries) && finisher.entries.length > 0
    ? finisher.entries
    : [createEmptyFinisherEntry()];
  return {
    type,
    name: String(finisher.name || ''),
    entries: entries.map(entry => normalizeFinisherEntry(entry, type))
  };
}

function normalizeFinisherEntry(entry, type) {
  const safeEntry = entry && typeof entry === 'object' ? entry : {};
  const mode = safeEntry.mode === 'lr' ? 'lr' : 'normal';
  const sets = Array.isArray(safeEntry.sets) && safeEntry.sets.length > 0
    ? safeEntry.sets.map((set, i) => normalizeSet(set, i, mode))
    : [];
  return {
    id: String(safeEntry.id || uuid()),
    name: String(safeEntry.name || ''),
    result: String(safeEntry.result || ''),
    rpe: normalizeNumber(safeEntry.rpe, 5, 1, 10),
    note: String(safeEntry.note || ''),
    sets: type === 'NORMAL' ? (sets.length ? sets : [normalizeSet(null, 0, mode)]) : sets,
    skipped: Boolean(safeEntry.skipped),
    mode
  };
}

function normalizeDate(value, fallback) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

function normalizeNumber(value, fallback, min, max) {
  let num = Number(value);
  if (!Number.isFinite(num)) num = fallback;
  if (min !== undefined) num = Math.max(min, num);
  if (max !== undefined) num = Math.min(max, num);
  return Math.round(num);
}
