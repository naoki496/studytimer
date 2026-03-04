// js/ui-log.js
import { openDB, listSessionsByDate, listManualByDate, getSession, putSession, deleteSession, getManual, putManual, deleteManual } from "./db.js";
import { SUBJECTS, MANUAL_CATEGORIES, prettySubject } from "./subjects.js";
import { toDateKey, epochToLocalHM, formatHMFromSec, startOfDay, endOfDay } from "./time.js";

const $ = (id) => document.getElementById(id);

let db = null;

function toast(msg){
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1600);
}

function setDateInput(dateKey){
  $("inpDate").value = dateKey;
}

function shiftDate(dateKey, deltaDays){
  const [y,m,d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return toDateKey(dt);
}

function makeSelect(options, value){
  const sel = document.createElement("select");
  sel.className = "select";
  for(const o of options){
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = options === SUBJECTS ? prettySubject(o) : o;
    sel.appendChild(opt);
  }
  if(value && options.includes(value)) sel.value = value;
  return sel;
}

function makeInput(type, value){
  const inp = document.createElement("input");
  inp.className = "input";
  inp.type = type;
  inp.value = value ?? "";
  return inp;
}

async function render(dateKey){
  const sessions = await listSessionsByDate(db, dateKey);
  const manual = await listManualByDate(db, dateKey);

  // sessions
  const tbS = $("tbodySessions");
  tbS.innerHTML = "";
  if(sessions.length === 0){
    tbS.innerHTML = `<tr><td colspan="5" class="muted">データなし</td></tr>`;
  }else{
    // startAtで並び替え
    sessions.sort((a,b)=> (a.startAt||0)-(b.startAt||0));
    for(const s of sessions){
      const tr = document.createElement("tr");

      const start = s.startAt ? epochToLocalHM(s.startAt) : "-";
      const end = s.endAt ? epochToLocalHM(s.endAt) : "（計測中）";
      const dur = formatHMFromSec(Number(s.durationSec||0));

      tr.innerHTML = `
        <td>${prettySubject(s.subject)}</td>
        <td>${start}</td>
        <td>${end}</td>
        <td>${dur}</td>
        <td class="actions"></td>
      `;
      const act = tr.querySelector(".actions");

      const btnEdit = document.createElement("button");
      btnEdit.className = "btn";
      btnEdit.textContent = "編集";
      btnEdit.addEventListener("click", async () => {
        await editSession(s.id, dateKey);
      });

      const btnDel = document.createElement("button");
      btnDel.className = "btn btnDanger";
      btnDel.textContent = "削除";
      btnDel.style.marginLeft = "6px";
      btnDel.addEventListener("click", async () => {
        if(confirm("このセッションを削除しますか？")){
          await deleteSession(db, s.id);
          toast("削除しました");
          await render(dateKey);
        }
      });

      act.appendChild(btnEdit);
      act.appendChild(btnDel);

      tbS.appendChild(tr);
    }
  }

  // manual
  const tbM = $("tbodyManual");
  tbM.innerHTML = "";
  if(manual.length === 0){
    tbM.innerHTML = `<tr><td colspan="4" class="muted">データなし</td></tr>`;
  }else{
    for(const m of manual){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${m.category || "-"}</td>
        <td>${prettySubject(m.subject)}</td>
        <td>${Number(m.minutes||0)}</td>
        <td class="actions"></td>
      `;
      const act = tr.querySelector(".actions");

      const btnEdit = document.createElement("button");
      btnEdit.className = "btn";
      btnEdit.textContent = "編集";
      btnEdit.addEventListener("click", async () => {
        await editManual(m.id, dateKey);
      });

      const btnDel = document.createElement("button");
      btnDel.className = "btn btnDanger";
      btnDel.textContent = "削除";
      btnDel.style.marginLeft = "6px";
      btnDel.addEventListener("click", async () => {
        if(confirm("この手動入力を削除しますか？")){
          await deleteManual(db, m.id);
          toast("削除しました");
          await render(dateKey);
        }
      });

      act.appendChild(btnEdit);
      act.appendChild(btnDel);

      tbM.appendChild(tr);
    }
  }
}

async function editSession(id, dateKey){
  const s = await getSession(db, id);
  if(!s) return;

  // 計測中(endAt=null)は編集不可（安全優先）
  if(!s.endAt){
    alert("計測中のセッションは編集できません。いったん終了してください。");
    return;
  }

  const subSel = makeSelect(SUBJECTS, s.subject);
  const startInp = makeInput("time", epochToLocalHM(s.startAt));
  const endInp = makeInput("time", epochToLocalHM(s.endAt));

  const wrap = document.createElement("div");
  wrap.append("教科：", subSel, document.createElement("br"));
  wrap.append("開始：", startInp, document.createElement("br"));
  wrap.append("終了：", endInp, document.createElement("br"));

  const ok = confirm(
    "編集画面を開きます。\n\n" +
    "この後、入力欄が表示されます（OKで続行）。"
  );
  if(!ok) return;

  // 簡易モーダル代わり：prompt
  const subject = prompt("教科（そのままOK）", subSel.value) ?? subSel.value;
  const st = prompt("開始（HH:MM）", startInp.value) ?? startInp.value;
  const en = prompt("終了（HH:MM）", endInp.value) ?? endInp.value;

  // 時刻を当日のepochへ
  const dayStart = startOfDay(dateKey);
  const [sh, sm] = st.split(":").map(Number);
  const [eh, em] = en.split(":").map(Number);

  if(!Number.isFinite(sh) || !Number.isFinite(sm) || !Number.isFinite(eh) || !Number.isFinite(em)){
    toast("時刻の形式が不正です");
    return;
  }

  const newStart = dayStart + (sh*3600 + sm*60)*1000;
  const newEnd   = dayStart + (eh*3600 + em*60)*1000;

  if(newEnd <= newStart){
    toast("終了は開始より後にしてください");
    return;
  }
  if(newStart < dayStart || newEnd > endOfDay(dateKey)){
    toast("日付外の時刻は設定できません（当日内のみ）");
    return;
  }

  s.subject = SUBJECTS.includes(subject) ? subject : s.subject;
  s.startAt = newStart;
  s.endAt = newEnd;
  s.durationSec = Math.floor((newEnd - newStart)/1000);
  await putSession(db, s);

  toast("更新しました");
  await render(dateKey);
}

async function editManual(id, dateKey){
  const m = await getManual(db, id);
  if(!m) return;

  const category = prompt("カテゴリ", m.category || MANUAL_CATEGORIES[0]) ?? (m.category || MANUAL_CATEGORIES[0]);
  const subject  = prompt("教科", m.subject || SUBJECTS[0]) ?? (m.subject || SUBJECTS[0]);
  const minutes  = Number(prompt("分（数字）", String(m.minutes || 0)) ?? m.minutes);

  if(!Number.isFinite(minutes) || minutes <= 0){
    toast("分数が不正です");
    return;
  }

  m.category = MANUAL_CATEGORIES.includes(category) ? category : m.category;
  m.subject  = SUBJECTS.includes(subject) ? subject : m.subject;
  m.minutes  = minutes;
  await putManual(db, m);

  toast("更新しました");
  await render(dateKey);
}

async function main(){
  db = await openDB();
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }

  const today = toDateKey(Date.now());
  setDateInput(today);

  $("btnToday").addEventListener("click", async ()=> {
    setDateInput(toDateKey(Date.now()));
    await render($("inpDate").value);
  });

  $("btnPrev").addEventListener("click", async ()=> {
    setDateInput(shiftDate($("inpDate").value, -1));
    await render($("inpDate").value);
  });

  $("btnNext").addEventListener("click", async ()=> {
    setDateInput(shiftDate($("inpDate").value, +1));
    await render($("inpDate").value);
  });

  $("inpDate").addEventListener("change", async ()=> {
    await render($("inpDate").value);
  });

  await render(today);
}

main().catch((e)=> {
  console.error(e);
  alert("初期化に失敗しました。");
});
