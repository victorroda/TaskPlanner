(() => {
"use strict";

const CONFIG = {
  WORDS_PER_DAY: 8000,
  DAY_WIDTH: 72
};

let tasks = [];
let timelineDates = [];
let timelineStart = null;
let timelineEnd = null;

const $ = id => document.getElementById(id);

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normaliseAssignee(value) {
  const s = cleanText(value);
  return s || "Sense assignar";
}

function parseWords(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function parseDate(value) {
  const s = cleanText(value);
  if (!s) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d,m,y] = s.split("/").map(Number);
    const dt = new Date(y,m-1,d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const months = {
    gen:0,feb:1,mar:2,abr:3,mai:4,jun:5,jul:6,ago:7,set:8,sep:8,oct:9,nov:10,des:11,dec:11,
    january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11,
    enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,octubre:9,noviembre:10,diciembre:11
  };
  const m = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/);
  if (m && months[m[2]] !== undefined) {
    const dt = new Date(Number(m[3]), months[m[2]], Number(m[1]));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return String(date.getDate()).padStart(2,"0") + "/" +
         String(date.getMonth()+1).padStart(2,"0") + "/" +
         date.getFullYear();
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate()+n);
  return d;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function calculateTaskStart(dueDate, businessDays) {
  const due = new Date(dueDate);
  const duration = Math.max(0, Number(businessDays) || 0);
  if (duration <= 0) return due;

  // A due date is the last working day occupied by the task.
  // For a fractional one-day task, place its start fractionally within that day.
  if (duration <= 1) {
    return new Date(due.getTime() - duration * 86400000);
  }

  let remaining = duration;
  let cursor = new Date(due);

  if (isWeekend(cursor)) {
    while (isWeekend(cursor)) cursor.setDate(cursor.getDate()-1);
  }

  const whole = Math.floor(remaining);
  const fraction = remaining - whole;

  // Consume the due working day plus previous working days.
  let consumed = 0;
  while (consumed < whole - 1e-9) {
    cursor.setDate(cursor.getDate()-1);
    if (!isWeekend(cursor)) consumed += 1;
  }

  if (fraction > 1e-9) {
    cursor.setTime(cursor.getTime() - fraction * 86400000);
  }
  return cursor;
}

function prepareTasks(rawTasks) {
  return (Array.isArray(rawTasks) ? rawTasks : [])
    .map(t => {
      const due = parseDate(t.dueDate || t.due || "");
      const words = parseWords(t.words);
      return {
        taskId: cleanText(t.taskId || t.id || ""),
        title: cleanText(t.title || t.name || ""),
        name: cleanText(t.name || t.title || ""),
        dueDateObj: due,
        dueDate: due ? formatDate(due) : "",
        words,
        assigned: normaliseAssignee(t.assigned || t.person || ""),
        url: cleanText(t.url || ""),
        duration: words / CONFIG.WORDS_PER_DAY
      };
    })
    .filter(t => t.taskId && t.dueDateObj);
}

function buildDateArray(start, end) {
  const result = [];
  const cursor = new Date(start);
  cursor.setHours(0,0,0,0);
  const finalDate = new Date(end);
  finalDate.setHours(0,0,0,0);
  while (cursor <= finalDate) {
    result.push(new Date(cursor));
    cursor.setDate(cursor.getDate()+1);
  }
  return result;
}

function monthName(date) {
  return date.toLocaleDateString("ca-ES",{month:"long",year:"numeric"});
}

function createMonthCells(dates) {
  const cells = [];
  if (!dates.length) return cells;
  let start = 0;
  while (start < dates.length) {
    const key = dates[start].getFullYear()+"-"+dates[start].getMonth();
    let end = start;
    while (end+1 < dates.length &&
           dates[end+1].getFullYear()+"-"+dates[end+1].getMonth() === key) end++;
    cells.push({start,end,label:monthName(dates[start])});
    start = end+1;
  }
  return cells;
}

function createDayHeader(dates) {
  const el = document.createElement("div");
  el.className = "timeline-header";
  el.style.width = (dates.length * CONFIG.DAY_WIDTH) + "px";
  dates.forEach((d,i) => {
    const day = document.createElement("div");
    day.className = "day" + (isWeekend(d) ? " weekend" : "");
    day.style.left = (i*CONFIG.DAY_WIDTH)+"px";
    day.style.width = CONFIG.DAY_WIDTH+"px";
    day.textContent = d.getDate();
    el.appendChild(day);
  });
  createMonthCells(dates).forEach(m => {
    const month = document.createElement("div");
    month.className = "month";
    month.style.left = (m.start*CONFIG.DAY_WIDTH)+"px";
    month.style.width = ((m.end-m.start+1)*CONFIG.DAY_WIDTH)+"px";
    month.textContent = m.label;
    el.appendChild(month);
  });
  return el;
}

function createTimelineGrid(dates) {
  const el = document.createElement("div");
  el.className = "timeline-cell";
  el.style.width = (dates.length * CONFIG.DAY_WIDTH) + "px";
  el.style.setProperty("--dayw", CONFIG.DAY_WIDTH+"px");
  dates.forEach((d,i) => {
    if (isWeekend(d)) {
      const bg = document.createElement("div");
      bg.className = "weekend-bg";
      bg.style.left = (i*CONFIG.DAY_WIDTH)+"px";
      bg.style.width = CONFIG.DAY_WIDTH+"px";
      el.appendChild(bg);
    }
  });
  return el;
}

function colorForPerson(person) {
  if (person === "Sense assignar") return "#777";
  let hash = 0;
  for (let i=0;i<person.length;i++) hash = ((hash<<5)-hash)+person.charCodeAt(i)|0;
  const hue = Math.abs(hash)%360;
  return `hsl(${hue} 55% 42%)`;
}

function createTaskBar(task) {
  const bar = document.createElement("div");
  bar.className = "task-bar";
  const leftDays = (task.start.getTime()-timelineStart.getTime())/86400000;
  const widthDays = (task.end.getTime()-task.start.getTime())/86400000;
  bar.style.left = Math.max(0,leftDays*CONFIG.DAY_WIDTH)+"px";
  bar.style.width = Math.max(3,widthDays*CONFIG.DAY_WIDTH)+"px";
  bar.style.background = colorForPerson(task.assigned);
  bar.title =
    "Tasca: " + task.taskId +
    "\nNom: " + task.name +
    "\nPersona: " + task.assigned +
    "\nParaules: " + task.words.toLocaleString("ca-ES") +
    "\nDuració: " + task.duration.toFixed(2) + " dies laborables" +
    "\nVenciment: " + task.dueDate;
  bar.textContent = task.taskId + " · " + task.name;
  return bar;
}

function assignTaskGeometry() {
  tasks.forEach(t => {
    t.start = calculateTaskStart(t.dueDateObj, t.duration);
    // End boundary is the beginning of the day after the due date.
    t.end = addDays(t.dueDateObj,1);
  });
}

function renderGantt() {
  const container = $("gantt");
  container.innerHTML = "";
  if (!tasks.length) return;

  const today = new Date();
  today.setHours(0,0,0,0);
  const lastDue = new Date(Math.max(...tasks.map(t=>t.dueDateObj.getTime())));
  lastDue.setHours(0,0,0,0);

  timelineStart = today;
  timelineEnd = addDays(lastDue,1);
  timelineDates = buildDateArray(timelineStart,timelineEnd);

  assignTaskGeometry();

  const people = [...new Set(tasks.map(t=>t.assigned))].sort((a,b) =>
    a.localeCompare(b,"ca",{sensitivity:"base"}));

  const header = document.createElement("div");
  header.className = "gantt-header";
  const ph = document.createElement("div");
  ph.className = "person-header";
  ph.textContent = "Persona";
  header.appendChild(ph);
  header.appendChild(createDayHeader(timelineDates));
  container.appendChild(header);

  people.forEach(person => {
    const row = document.createElement("div");
    row.className = "gantt-row";

    const pc = document.createElement("div");
    pc.className = "person-cell";
    pc.textContent = person;
    row.appendChild(pc);

    const timeline = createTimelineGrid(timelineDates);
    tasks.filter(t=>t.assigned===person).forEach(t => timeline.appendChild(createTaskBar(t)));
    row.appendChild(timeline);

    container.appendChild(row);
  });
}

function updateSummary() {
  $("taskCount").textContent = tasks.length;
  $("peopleCount").textContent = new Set(tasks.map(t=>t.assigned)).size;
  $("wordCount").textContent = tasks.reduce((s,t)=>s+t.words,0).toLocaleString("ca-ES");
  $("summary").hidden = false;
}

function setStatus(text, type="") {
  const el = $("status");
  el.textContent = text;
  el.className = "status" + (type ? " "+type : "");
}

function displayTasks(rawTasks, source) {
  try {
    const prepared = prepareTasks(rawTasks);
    if (!prepared.length) throw new Error("No s'han pogut preparar les tasques rebudes.");
    tasks = prepared;
    updateSummary();
    renderGantt();
    $("planner").hidden = false;
    $("csvBtn").disabled = false;
    setStatus(`${tasks.length} tasques carregades (${source}).`,"ok");
  } catch (e) {
    console.error(e);
    setStatus("Error preparant les tasques: " + e.message,"error");
  }
}

function decodeBase64Utf8(encoded) {
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary,c=>c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function getTasksFromExtension() {
  const hash = window.location.hash || "";
  console.log("[GVA Planning] hash:", hash ? hash.slice(0,80)+"…" : "(empty)");

  try {
    if (hash.startsWith("#data-gzip=")) {
      console.log("[GVA Planning] gzip payload detected");
      const encoded = decodeURIComponent(hash.slice("#data-gzip=".length));
      const binary = atob(encoded);
      const bytes = Uint8Array.from(binary,c=>c.charCodeAt(0));
      console.log("[GVA Planning] gzip bytes:", bytes.length);

      if (!("DecompressionStream" in window)) {
        throw new Error("DecompressionStream no està disponible.");
      }

      const ds = new DecompressionStream("gzip");
      const decompressed = await new Response(
        new Blob([bytes]).stream().pipeThrough(ds)
      ).text();

      console.log("[GVA Planning] decompressed chars:", decompressed.length);
      const parsed = JSON.parse(decompressed);
      console.log("[GVA Planning] JSON tasks:", Array.isArray(parsed) ? parsed.length : "not array");
      return Array.isArray(parsed) ? parsed : null;
    }

    if (hash.startsWith("#data=")) {
      console.log("[GVA Planning] plain payload detected");
      const encoded = decodeURIComponent(hash.slice("#data=".length));
      const json = decodeBase64Utf8(encoded);
      const parsed = JSON.parse(json);
      console.log("[GVA Planning] JSON tasks:", Array.isArray(parsed) ? parsed.length : "not array");
      return Array.isArray(parsed) ? parsed : null;
    }

    console.log("[GVA Planning] no data payload in hash");
    return null;
  } catch (error) {
    console.error("[GVA Planning] transfer error:", error);
    setStatus("Error llegint les dades de l'extensió: " + error.message,"error");
    return null;
  }
}

function extractTasksFromHtml(html) {
  const doc = new DOMParser().parseFromString(html,"text/html");
  const cards = [...doc.querySelectorAll(".issue-card[data-id]")];
  const result = [];

  cards.forEach(card => {
    const id = cleanText(card.getAttribute("data-id"));
    if (!id || result.some(t=>t.taskId===id)) return;

    const text = cleanText(card.textContent);
    const nameEl =
      card.querySelector(".subject a") ||
      card.querySelector(".issue-subject a") ||
      card.querySelector(".issue-card-subject a");
    const name = cleanText(nameEl?.textContent || text.replace(/^.*?#\d+\s*/,""));

    let due = "";
    const dueEl = [...card.querySelectorAll("*")].find(el =>
      /due|venc|data.*venc|fecha/i.test(cleanText(el.textContent)) &&
      /\d{1,2}\s+[A-Za-zÀ-ÿ]+\s+\d{4}/.test(cleanText(el.textContent))
    );
    if (dueEl) {
      const m = cleanText(dueEl.textContent).match(/(\d{1,2}\s+[A-Za-zÀ-ÿ]+\s+\d{4})/);
      if (m) due = m[1];
    }

    const wordsMatch = text.match(/(?:words?|paraules?|palabras?)\s*:?\s*([\d.,]+)/i);
    const words = wordsMatch ? parseWords(wordsMatch[1]) : 0;

    const userEl = card.querySelector(".assigned-user .user a");
    const assigned = cleanText(userEl?.textContent || "");

    result.push({taskId:id,name,title:name,dueDate:due,words,assigned});
  });

  return result;
}

function downloadCsv() {
  const header = ["Task ID","Name","Data real de venciment","Nombre de paraules Salt pro","Persona assignada"];
  const rows = tasks.map(t => [
    t.taskId,t.name,t.dueDate,String(t.words),t.assigned
  ]);
  const csv = [header,...rows].map(row =>
    row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(";")
  ).join("\r\n");
  const blob = new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "GVA_Planning.csv";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

$("fileInput").addEventListener("change", async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    setStatus("Llegint HTML local…");
    displayTasks(extractTasksFromHtml(await file.text()),"HTML local");
  } catch (err) {
    setStatus("Error llegint l'HTML: "+err.message,"error");
  }
});

$("csvBtn").addEventListener("click",downloadCsv);

(async function initialise() {
  const extensionTasks = await getTasksFromExtension();
  if (Array.isArray(extensionTasks)) {
    displayTasks(extensionTasks,"extensió");
  } else if (!window.location.hash) {
    setStatus("Esperant dades…");
  }
})();
})();