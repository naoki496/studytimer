// js/timer.js
import { uuid, metaGet, metaSet, putSession, getSession } from "./db.js";
import { toDateKey, splitByDay } from "./time.js";

const ACTIVE_KEY = "activeTimer";
const LAST_SUBJECT_KEY = "lastSubject";

export async function getActive(db){
  return await metaGet(db, ACTIVE_KEY);
}
export async function clearActive(db){
  await metaSet(db, ACTIVE_KEY, null);
}
export async function setLastSubject(db, subject){
  await metaSet(db, LAST_SUBJECT_KEY, subject);
}
export async function getLastSubject(db){
  return await metaGet(db, LAST_SUBJECT_KEY);
}

export async function startTimer(db, subject){
  const now = Date.now();
  const id = uuid();
  const date = toDateKey(now);

  // 先にセッション作成（endAt=null）
  await putSession(db, {
    id,
    date,
    subject,
    startAt: now,
    endAt: null,
    durationSec: 0,
    note: ""
  });

  await metaSet(db, ACTIVE_KEY, {
    isRunning: true,
    sessionId: id,
    subject,
    startAt: now
  });
  await setLastSubject(db, subject);

  return { sessionId: id, startAt: now };
}

/**
 * stopTimer: activeTimer のセッションを確定
 * - 日跨ぎは splitByDay して複数セッションに分割
 * - 既存セッションを "当日部分" にし、跨いだ分は新規セッションとして追加
 */
export async function stopTimer(db){
  const active = await getActive(db);
  if(!active?.isRunning) return null;

  const now = Date.now();
  const sess = await getSession(db, active.sessionId);
  if(!sess) {
    await clearActive(db);
    return null;
  }
  const startAt = sess.startAt;
  const endAt = now;

  const parts = splitByDay(startAt, endAt);
  if(parts.length === 0){
    await clearActive(db);
    return null;
  }

  // 既存IDに最初のパートを割当
  const first = parts[0];
  sess.date = first.date;
  sess.endAt = first.endAt;
  sess.durationSec = first.durationSec;
  await putSession(db, sess);

  // 残りを追加
  for(let i=1;i<parts.length;i++){
    const p = parts[i];
    await putSession(db, {
      id: uuid(),
      date: p.date,
      subject: sess.subject,
      startAt: p.startAt,
      endAt: p.endAt,
      durationSec: p.durationSec,
      note: ""
    });
  }

  await clearActive(db);
  return { endAt, parts: parts.length };
}

/**
 * pauseTimer: stopTimer と同じ（=分割して確定）
 * 再開は startTimer で新規セッション
 */
export async function pauseTimer(db){
  return await stopTimer(db);
}
