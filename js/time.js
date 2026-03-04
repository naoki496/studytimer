// js/time.js
export function pad2(n){ return String(n).padStart(2,"0"); }

export function toDateKey(d){
  const dt = (d instanceof Date) ? d : new Date(d);
  return `${dt.getFullYear()}-${pad2(dt.getMonth()+1)}-${pad2(dt.getDate())}`;
}

export function toMonthKey(d){
  const dt = (d instanceof Date) ? d : new Date(d);
  return `${dt.getFullYear()}-${pad2(dt.getMonth()+1)}`;
}

export function startOfDay(dateKey){
  // local time
  const [y,m,dd] = dateKey.split("-").map(Number);
  return new Date(y, m-1, dd, 0,0,0,0).getTime();
}
export function endOfDay(dateKey){
  const [y,m,dd] = dateKey.split("-").map(Number);
  return new Date(y, m-1, dd, 23,59,59,999).getTime();
}

export function formatHMS(sec){
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  const ss = s%60;
  return `${pad2(h)}:${pad2(m)}:${pad2(ss)}`;
}
export function formatHMFromSec(sec){
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  return `${h}時間${m}分`;
}

export function epochToLocalHM(ms){
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * startAt..endAt を「日付またぎしない」セッション配列に分割
 * return: [{date, startAt, endAt, durationSec}]
 */
export function splitByDay(startAt, endAt){
  if(!(Number.isFinite(startAt) && Number.isFinite(endAt)) || endAt <= startAt){
    return [];
  }
  const out = [];
  let curStart = startAt;

  while(curStart < endAt){
    const dk = toDateKey(curStart);
    const dayEnd = endOfDay(dk);
    const curEnd = Math.min(endAt, dayEnd);
    out.push({
      date: dk,
      startAt: curStart,
      endAt: curEnd,
      durationSec: Math.floor((curEnd - curStart) / 1000)
    });
    curStart = curEnd + 1; // 次のmsへ
  }
  return out;
}
