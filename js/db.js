// js/db.js
const DB_NAME = "study_timer_db";
const DB_VER = 1;

function reqToPromise(req){
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function openDB(){
  const req = indexedDB.open(DB_NAME, DB_VER);
  req.onupgradeneeded = () => {
    const db = req.result;

    if(!db.objectStoreNames.contains("sessions")){
      const s = db.createObjectStore("sessions", { keyPath: "id" });
      s.createIndex("date", "date", { unique:false });
      s.createIndex("subject", "subject", { unique:false });
      s.createIndex("startAt", "startAt", { unique:false });
    }
    if(!db.objectStoreNames.contains("manual_entries")){
      const m = db.createObjectStore("manual_entries", { keyPath: "id" });
      m.createIndex("date", "date", { unique:false });
      m.createIndex("subject", "subject", { unique:false });
    }
    if(!db.objectStoreNames.contains("meta")){
      db.createObjectStore("meta", { keyPath: "key" });
    }
  };
  return reqToPromise(req);
}

export async function tx(db, storeName, mode, fn){
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    let ret;
    try { ret = fn(store, t); }
    catch(e){ reject(e); return; }
    t.oncomplete = () => resolve(ret);
    t.onerror = () => reject(t.error);
  });
}

export function uuid(){
  // crypto.randomUUID() が使えれば優先
  if (crypto?.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function metaGet(db, key){
  const req = await tx(db, "meta", "readonly", (s) => s.get(key));
  return req?.value ?? null;
}
export async function metaSet(db, key, value){
  await tx(db, "meta", "readwrite", (s) => s.put({ key, value }));
}

export async function putSession(db, obj){
  await tx(db, "sessions", "readwrite", (s) => s.put(obj));
}
export async function getSession(db, id){
  return await tx(db, "sessions", "readonly", (s) => s.get(id));
}
export async function deleteSession(db, id){
  await tx(db, "sessions", "readwrite", (s) => s.delete(id));
}
export async function listSessionsByDate(db, dateKey){
  return await tx(db, "sessions", "readonly", (s) => {
    const idx = s.index("date");
    const req = idx.getAll(dateKey);
    return req;
  }).then((req) => new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

export async function putManual(db, obj){
  await tx(db, "manual_entries", "readwrite", (s) => s.put(obj));
}
export async function getManual(db, id){
  return await tx(db, "manual_entries", "readonly", (s) => s.get(id));
}
export async function deleteManual(db, id){
  await tx(db, "manual_entries", "readwrite", (s) => s.delete(id));
}
export async function listManualByDate(db, dateKey){
  return await tx(db, "manual_entries", "readonly", (s) => {
    const idx = s.index("date");
    const req = idx.getAll(dateKey);
    return req;
  }).then((req) => new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

// 月次集計用：dateが "YYYY-MM-" で始まるものを全取得（簡易走査）
export async function listAllSessions(db){
  return await tx(db, "sessions", "readonly", (s) => s.getAll());
}
export async function listAllManual(db){
  return await tx(db, "manual_entries", "readonly", (s) => s.getAll());
}
