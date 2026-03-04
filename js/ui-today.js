// js/ui-today.js
import { openDB, metaGet, metaSet, uuid, putManual, listSessionsByDate, listManualByDate } from "./db.js";
import { SUBJECTS, MANUAL_CATEGORIES, prettySubject } from "./subjects.js";
import { toDateKey, formatHMS, formatHMFromSec } from "./time.js";
import { getActive, startTimer, pauseTimer, stopTimer, getLastSubject } from "./timer.js";

const $ = (id) => document.getElementById(id);

let db = null;
let tickTimer = null;

function toast(msg){
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1600);
}

function fillSelect(sel, arr, value){
  sel.innerHTML = "";
  for(const s of arr){
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = prettySubject(s);
    sel.appendChild(opt);
  }
  if(value && arr.includes(value)) sel.value = value;
}

function fillSelectRaw(sel, arr, value){
  sel.innerHTML = "";
  for(const s of arr){
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  }
  if(value && arr.includes(value)) sel.value = value;
}

function setRunningUI(isRunning){
  const dot = $("runDot");
  const lab = $("runLabel");
  dot.className = "dot " + (isRunning ? "run" : "stop");
  lab.textContent = isRunning ? "計測中" : "停止中";

  $("btnStart").disabled = isRunning;
  $("btnPause").disabled = !isRunning;
  $("btnStop").disabled = !isRunning;
  $("selSubject").disabled = isRunning;
}

async function refreshTodaySummary(){
  const today = toDateKey(Date.now());
  $("todayKey").textContent = today;

  const sessions = await listSessionsByDate(db, today);
  const manuals  = await listManualByDate(db, today);

  let autoSec = 0;
  for(const s of sessions){
    autoSec += Number(s.durationSec || 0);
    // 計測中（endAt=null）のセッションはUI表示で補正（activeTimer側で加算）
    if(!s.endAt){
      // 加算は tick 側でやる（ここでは0扱い）
    }
  }

  let manualSec = 0;
  for(const m of manuals){
    manualSec += Number(m.minutes || 0) * 60;
  }

  // 教科別
  const by = new Map();
  for(const s of sessions){
    const k = s.subject || "その他";
    by.set(k, (by.get(k) || 0) + Number(s.durationSec || 0));
  }
  for(const m of manuals){
    const k = m.subject || "その他";
    by.set(k, (by.get(k) || 0) + Number(m.minutes || 0) * 60);
  }

  $("todayAuto").textContent = formatHMFromSec(autoSec);
  $("todayManual").textContent = formatHMFromSec(manualSec);
  $("todayTotal").textContent = formatHMFromSec(autoSec + manualSec);

  const tbody = $("tbodyBySubject");
  tbody.innerHTML = "";
  const rows = [...by.entries()].sort((a,b)=> b[1]-a[1]);
  if(rows.length === 0){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="2" class="muted">データなし</td>`;
    tbody.appendChild(tr);
    return;
  }
  for(const [sub, sec] of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${prettySubject(sub)}</td><td>${formatHMFromSec(sec)}</td>`;
    tbody.appendChild(tr);
  }
}

async function startTick(){
  if(tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(async () => {
    const active = await getActive(db);
    const now = Date.now();

    if(active?.isRunning){
      const elapsed = Math.floor((now - active.startAt) / 1000);
      $("timeNow").textContent = formatHMS(elapsed);
      $("timeHint").textContent = `教科：${prettySubject(active.subject)}（計測中）`;
      setRunningUI(true);
    }else{
      $("timeNow").textContent = "00:00:00";
      $("timeHint").textContent = "教科を選んで開始してください。";
      setRunningUI(false);
    }
    // 集計は重くないが、頻繁すぎると無駄なので 5秒に1回だけ
  }, 500);

  // 集計は別で低頻度
  setInterval(() => refreshTodaySummary().catch(()=>{}), 5000);
}

async function main(){
  db = await openDB();

  // PWA SW register
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }

  // セレクト
  const last = await getLastSubject(db);
  fillSelect($("selSubject"), SUBJECTS, last || SUBJECTS[0]);
  fillSelect($("selManualSubject"), SUBJECTS, last || SUBJECTS[0]);
  fillSelectRaw($("selManualCategory"), MANUAL_CATEGORIES, MANUAL_CATEGORIES[0]);

  // 起動時：計測中復元
  const active = await getActive(db);
  setRunningUI(!!active?.isRunning);

  $("todayKey").textContent = toDateKey(Date.now());

  // handlers
  $("btnStart").addEventListener("click", async () => {
    const subject = $("selSubject").value;
    await startTimer(db, subject);
    toast("計測を開始しました");
    await refreshTodaySummary();
  });

  $("btnPause").addEventListener("click", async () => {
    const r = await pauseTimer(db);
    toast(r ? "一時停止しました" : "停止対象がありません");
    await refreshTodaySummary();
  });

  $("btnStop").addEventListener("click", async () => {
    const r = await stopTimer(db);
    toast(r ? "終了しました" : "停止対象がありません");
    await refreshTodaySummary();
  });

  $("btnAddManual").addEventListener("click", async () => {
    const cat = $("selManualCategory").value;
    const subject = $("selManualSubject").value;
    const minutes = Number($("inpMinutes").value || 0);
    const note = String($("inpManualNote").value || "").trim();
    if(!Number.isFinite(minutes) || minutes <= 0){
      toast("分数（1以上）を入力してください");
      return;
    }
    const date = toDateKey(Date.now());
    await putManual(db, { id: uuid(), date, category: cat, subject, minutes, note });
    $("inpMinutes").value = "";
    $("inpManualNote").value = "";
    toast("手動入力を追加しました");
    await refreshTodaySummary();
  });

  await refreshTodaySummary();
  await startTick();
}

main().catch((e) => {
  console.error(e);
  alert("初期化に失敗しました。コンソールをご確認ください。");
});
