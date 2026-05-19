/**
 * IndexedDB wrapper - USER DATA ONLY (sessions, meals logged, body weight, prefs, user meal favorites).
 * Static catalogs live in static_data.js.
 */
// NOTE: use a fresh DB name to avoid upgrade-blocked issues from prior versions
const DB_NAME = 'fit-tracker-v2';
const DB_VER = 3;
const STORES = {
  sessions:   { keyPath: 'id', autoIncrement: true, indexes: [['date', 'date']] },
  meals:      { keyPath: 'id', autoIncrement: true, indexes: [['date', 'date']] },
  user_meals: { keyPath: 'id', autoIncrement: true },
  body:       { keyPath: 'date' },
  prefs:      { keyPath: 'key' },
  cardio:     { keyPath: 'id', autoIncrement: true, indexes: [['date', 'date']] },
  plans:      { keyPath: 'id', autoIncrement: true },
};

let _db = null;
let _opening = null;

export function db() {
  if (_db) return Promise.resolve(_db);
  if (_opening) return _opening;
  _opening = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = e => {
      const d = e.target.result;
      for (const [name, opts] of Object.entries(STORES)) {
        if (d.objectStoreNames.contains(name)) continue;
        const s = d.createObjectStore(name, { keyPath: opts.keyPath, autoIncrement: !!opts.autoIncrement });
        for (const [iname, ipath] of (opts.indexes || [])) {
          s.createIndex(iname, ipath, { unique: false });
        }
      }
    };
    r.onsuccess = () => { _db = r.result; res(_db); };
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('DB blocked - close other tabs'));
  });
  return _opening;
}

async function tx(store, mode = 'readonly') {
  const d = await db();
  return d.transaction(store, mode).objectStore(store);
}

function afterWrite() {
  import('./lib/backup.js').then(m => m.touchLocalBackup()).catch(() => {});
}

export async function put(store, value) {
  const s = await tx(store, 'readwrite');
  return new Promise((res, rej) => {
    const r = s.put(value);
    r.onsuccess = () => { afterWrite(); res(r.result); };
    r.onerror = () => rej(r.error);
  });
}

export async function get(store, key) {
  const s = await tx(store);
  return new Promise((res, rej) => {
    const r = s.get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function getAll(store) {
  const s = await tx(store);
  return new Promise((res, rej) => {
    const r = s.getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function getByIndex(store, indexName, value) {
  const s = await tx(store);
  return new Promise((res, rej) => {
    const idx = s.index(indexName);
    const r = idx.getAll(value);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function del(store, key) {
  const s = await tx(store, 'readwrite');
  return new Promise((res, rej) => {
    const r = s.delete(key);
    r.onsuccess = () => { afterWrite(); res(); };
    r.onerror = () => rej(r.error);
  });
}

export async function pref(key, value) {
  if (value === undefined) {
    const r = await get('prefs', key);
    return r ? r.value : undefined;
  }
  await put('prefs', { key, value });
  return value;
}

export async function exportAllData() {
  const storeNames = Object.keys(STORES);
  const out = { version: DB_VER, exported_at: new Date().toISOString() };
  for (const name of storeNames) {
    out[name] = await getAll(name);
  }
  return out;
}

export async function importAllData(data) {
  const storeNames = Object.keys(STORES);
  for (const name of storeNames) {
    if (!data[name]) continue;
    const s = await tx(name, 'readwrite');
    await new Promise((res, rej) => { const r = s.clear(); r.onsuccess = res; r.onerror = rej; });
    for (const item of data[name]) {
      const s2 = await tx(name, 'readwrite');
      await new Promise((res, rej) => { const r = s2.put(item); r.onsuccess = res; r.onerror = rej; });
    }
  }
}
