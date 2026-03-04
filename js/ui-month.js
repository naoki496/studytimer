// js/ui-month.js
import { openDB, listAllSessions, listAllManual } from "./db.js";
import { prettySubject } from "./subjects.js";
import { toMonthKey, formatHMFromSec } from "./time.js";

const $ = (id) => document.getElementById(id);

let db = null;

function toast(msg){
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1600);
}

function setMonthInput(monthKey){
  $("inpMonth").value = monthKey;
}

function shiftMonth(monthKey, delta){
  const [y,m] = monthKey.split("-").map(Number);
  const dt = new Date(y, m-1, 1);
  dt.setMonth(dt.getMonth() + delta);
  return toMonthKey(dt);
}

async function render(monthKey){
  const sessions = await listAllSessions(db);
  const manuals  = await listAllManual(db);

  let autoSec = 0;
  let manualSec = 0;

  const by = new Map();

  for(const s of sessions){
    if(!s.date || !String(s.date).startsWith(monthKey)) continue;
    const sec = Number(s.durationSec || 0);
    autoSec += sec;
    const k = s.subject || "その他";
    by.set(k, (by.get(k) || 0) + sec);
  }

  for(const m of manuals){
    if(!m.date || !String(m.date).startsWith(monthKey)) continue;
    const sec = Number(m.minutes || 0) * 60;
    manualSec += sec;
    const k = m.subject || "その他";
    by.set(k, (by.get(k) || 0) + sec);
  }

  $("mAuto").textContent = formatHMFromSec(autoSec);
  $("mManual").textContent = formatHMFromSec(manualSec);
  $("mTotal").textContent = formatHMFromSec(autoSec + manualSec);

  const tbody = $("tbodyMonthBySub");
  tbody.innerHTML = "";

  const rows = [...by.entries()].sort((a,b)=> b[1]-a[1]);
  if(rows.length === 0){
    tbody.innerHTML = `<tr><td colspan="2" class="muted">データなし</td></tr>`;
    return;
  }

  for(const [sub, sec] of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${prettySubject(sub)}</td><td>${formatHMFromSec(sec)}</td>`;
    tbody.appendChild(tr);
  }
}

async function main(){
  db = await openDB();
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }

  const now = new Date();
  const thisMonth = toMonthKey(now);
  setMonthInput(thisMonth);

  $("btnThisMonth").addEventListener("click", async ()=> {
    setMonthInput(toMonthKey(new Date()));
    await render($("inpMonth").value);
  });
  $("btnPrevMonth").addEventListener("click", async ()=> {
    setMonthInput(shiftMonth($("inpMonth").value, -1));
    await render($("inpMonth").value);
  });
  $("btnNextMonth").addEventListener("click", async ()=> {
    setMonthInput(shiftMonth($("inpMonth").value, +1));
    await render($("inpMonth").value);
  });
  $("inpMonth").addEventListener("change", async ()=> {
    await render($("inpMonth").value);
  });

  await render(thisMonth);
  toast("月次を更新しました");
}

main().catch((e)=> {
  console.error(e);
  alert("初期化に失敗しました。");
});
