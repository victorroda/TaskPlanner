/* ============================================================
   GVA PLANNING
   - Reads local HTML files
   - Accepts task data from the Chrome/Edge extension via #data=
   - Gantt: 8000 words / business day
   - Due date is the END of that day: right edge = next calendar day
   ============================================================ */

const CONFIG = {
  CSV_FILENAME: "tasques_GVA.csv",
  WORDS_PER_DAY: 8000,
  DAY_WIDTH: 32,
  PERSON_WIDTH: 170,
  ROW_BASE_HEIGHT: 80,
  TASK_HEIGHT: 32,
  TASK_VERTICAL_GAP: 8
};

const MONTHS = {
  gen: 0, feb: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7,
  set: 8, oct: 9, nov: 10, des: 11,
  ene: 0, dic: 11, jan: 0, apr: 3, may: 4, aug: 7, sep: 8, dec: 11
};

const MONTH_NAMES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "set", "oct", "nov", "des"
];

let tasks = [];
let globalStart = null;
let globalEnd = null;

const htmlFile = document.getElementById("htmlFile");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");
const statusEl = document.getElementById("status");
const ganttContainer = document.getElementById("ganttContainer");
const tooltip = document.getElementById("tooltip");

async function getTasksFromExtension() {
  const hash = window.location.hash || "";

  try {
    if (hash.startsWith("#data-gzip=")) {
      const encoded = decodeURIComponent(hash.slice("#data-gzip=".length));
      const binary = atob(encoded);
      const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));

      if (!("DecompressionStream" in window)) {
        throw new Error("Este navegador no soporta la descompresión de datos.");
      }

      const ds = new DecompressionStream("gzip");
      const writer = ds.writable.getWriter();
      writer.write(bytes);
      writer.close();

      const json = await new Response(ds.readable).text();
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : null;
    }

    if (hash.startsWith("#data=")) {
      const encoded = decodeURIComponent(hash.slice("#data=".length));
      const json = decodeURIComponent(escape(atob(encoded)));
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : null;
    }

    return null;
  } catch (error) {
    console.error("No se pudieron leer los datos de la extensión:", error);
    return { __error: "Error leyendo los datos enviados por la extensión." };
  }
}

function setStatus(text, type = "") {
  statusEl.textContent = text;
  statusEl.className = "status" + (type ? " " + type : "");
}

function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function parseDate(value) {
  if (!value) return null;

  const text = cleanText(value)
    .replace(/\./g, "")
    .replace(/,/g, "");

  // dd/mm/yyyy
  let m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isValidDate(d) ? startOfDay(d) : null;
  }

  // "16 Nov 2026"
  m = text.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (month !== undefined) {
      const d = new Date(Number(m[3]), month, Number(m[1]));
      return isValidDate(d) ? startOfDay(d) : null;
    }
  }

  // "2026-11-16"
  m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isValidDate(d) ? startOfDay(d) : null;
  }

  const d = new Date(text);
  return isValidDate(d) ? startOfDay(d) : null;
}

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return startOfDay(d);
}

function isBusinessDay(date) {
  const d = date.getDay();
  return d !== 0 && d !== 6;
}



/*
 * Convert a duration in working days into a calendar start date.
 * The due date is the final working day and weekends consume zero duration.
 *
 * A fractional day is represented as a fraction of a single working-day
 * column. Therefore 0.18 days = 18% of one day, not 18% of 24 hours spread
 * across several calendar days.
 */
function calculateTaskStart(dueDate, businessDays) {
  const duration = Math.max(0, Number(businessDays) || 0);
  if (duration === 0) return new Date(dueDate);

  let remaining = duration;
  let cursor = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

  // Find the final working day (normally the due date).
  while (!isBusinessDay(cursor)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  // If the whole task fits in this working day, place it at the end of it.
  if (remaining <= 1) {
    const start = new Date(cursor);
    start.setTime(start.getTime() + (1 - remaining) * 86400000);
    return start;
  }

  remaining -= 1;

  // Consume previous complete working days, skipping weekends.
  while (remaining > 1e-10) {
    cursor.setDate(cursor.getDate() - 1);
    while (!isBusinessDay(cursor)) cursor.setDate(cursor.getDate() - 1);

    if (remaining <= 1) {
      const start = new Date(cursor);
      start.setTime(start.getTime() + (1 - remaining) * 86400000);
      return start;
    }

    remaining -= 1;
  }

  return cursor;
}

function assignTaskGeometry(task) {
  const due = parseDate(task.dueDate);
  if (!due) return null;

  const businessDays = Math.max(
    0,
    (Number(task.words) || 0) / CONFIG.WORDS_PER_DAY
  );

  task.start = calculateTaskStart(due, businessDays);

  // Visual right edge is the boundary immediately after the due date.
  task.end = addDays(due, 1);
  task.businessDays = businessDays;
  return task;
}

function createTaskBar(task, timelineStart, timelineDays) {
  const bar = document.createElement("div");
  bar.className = "task-bar";

  // The visual timeline is a normal calendar. Weekends remain visible.
  // The task START is already calculated in working days; the width is the
  // actual calendar span between start and the end-of-due-day boundary.
  const leftDays = (task.start - timelineStart) / 86400000;
  const widthDays = (task.end - task.start) / 86400000;

  bar.style.left = `${leftDays * CONFIG.DAY_WIDTH}px`;
  bar.style.width = `${Math.max(1, widthDays * CONFIG.DAY_WIDTH)}px`;
  bar.style.right = "auto";
  bar.style.backgroundColor = colorForPerson(task.assigned);
  bar.innerHTML = `<span>${escapeHtml(task.name)}</span>`;

  bar.addEventListener("mouseenter", event => showTooltip(event, task));
  bar.addEventListener("mousemove", moveTooltip);
  bar.addEventListener("mouseleave", hideTooltip);
  return bar;
}

function buildTooltip(task) {
  return `
    <div><strong>Tarea:</strong> #${escapeHtml(task.taskId)}</div>
    <div><strong>Nombre:</strong> ${escapeHtml(task.name || task.title || "")}</div>
    <div><strong>Persona:</strong> ${escapeHtml(normaliseAssignee(task.assigned))}</div>
    <div><strong>Palabras:</strong> ${formatNumber(task.words)}</div>
    <div><strong>Duración:</strong> ${formatDuration(task.duration)}</div>
    <div><strong>Vencimiento:</strong> ${escapeHtml(formatDate(task.due))}</div>
  `;
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString("es-ES");
}

function formatDuration(days) {
  if (!Number.isFinite(days)) return "—";
  if (days < 0.01) return "< 0,01 días";
  return `${days.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })} días laborables`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderGantt() {
  tasks.forEach(assignTaskGeometry);

  const dates = buildDateArray(globalStart, globalEnd);
  const timelineWidth = dates.length * CONFIG.DAY_WIDTH;

  const groups = new Map();

  for (const task of tasks) {
    const person = normaliseAssignee(task.assigned);
    if (!groups.has(person)) groups.set(person, []);
    groups.get(person).push(task);
  }

  const inner = document.createElement("div");
  inner.className = "gantt-inner";
  inner.style.width = `${CONFIG.PERSON_WIDTH + timelineWidth}px`;

  const scroll = document.createElement("div");
  scroll.className = "gantt-scroll";

  // Day header
  const header = document.createElement("div");
  header.className = "gantt-header";
  header.style.width = `${CONFIG.PERSON_WIDTH + timelineWidth}px`;

  const personHeader = document.createElement("div");
  personHeader.className = "person-header";
  personHeader.textContent = "Persona";
  header.appendChild(personHeader);

  dates.forEach(date => header.appendChild(createDayHeader(date)));

  // Month row
  const monthRow = document.createElement("div");
  monthRow.className = "month-row";
  monthRow.style.width = `${CONFIG.PERSON_WIDTH + timelineWidth}px`;

  const monthSpacer = document.createElement("div");
  monthSpacer.className = "month-spacer";
  monthRow.appendChild(monthSpacer);

  createMonthCells(dates).forEach(cell => monthRow.appendChild(cell));

  // Body
  const body = document.createElement("div");
  body.className = "gantt-body";
  body.style.width = `${CONFIG.PERSON_WIDTH + timelineWidth}px`;

  for (const [person, personTasks] of groups) {
    const rowHeight = Math.max(
      CONFIG.ROW_BASE_HEIGHT,
      20 + personTasks.length * (CONFIG.TASK_HEIGHT + CONFIG.TASK_VERTICAL_GAP)
    );

    const row = document.createElement("div");
    row.className = "person-row";
    row.style.height = `${rowHeight}px`;

    const name = document.createElement("div");
    name.className = "person-name";
    name.textContent = person;

    const timeline = document.createElement("div");
    timeline.className = "timeline-row";
    timeline.style.width = `${timelineWidth}px`;
    timeline.style.height = `${rowHeight}px`;

    timeline.appendChild(createTimelineGrid(dates, rowHeight));

    personTasks.forEach((task, index) => {
      const bar = createTaskBar(task, globalStart, dates.length);
      bar.style.top = `${10 + index * (CONFIG.TASK_HEIGHT + CONFIG.TASK_VERTICAL_GAP)}px`;

      bar.addEventListener("mouseenter", event => {
        tooltip.innerHTML = buildTooltip(task);
        tooltip.classList.remove("hidden");
        positionTooltip(event);
      });

      bar.addEventListener("mousemove", positionTooltip);
      bar.addEventListener("mouseleave", () => tooltip.classList.add("hidden"));

      if (task.url) {
        bar.addEventListener("dblclick", () => {
          window.open(task.url, "_blank", "noopener,noreferrer");
        });
      }

      timeline.appendChild(bar);
    });

    row.appendChild(name);
    row.appendChild(timeline);
    body.appendChild(row);
  }

  inner.appendChild(header);
  inner.appendChild(monthRow);
  inner.appendChild(body);
  scroll.appendChild(inner);

  ganttContainer.innerHTML = "";
  ganttContainer.appendChild(scroll);
}

function positionTooltip(event) {
  const margin = 14;
  let x = event.clientX + margin;
  let y = event.clientY + margin;

  const rect = tooltip.getBoundingClientRect();

  if (x + rect.width > window.innerWidth - margin) {
    x = event.clientX - rect.width - margin;
  }

  if (y + rect.height > window.innerHeight - margin) {
    y = event.clientY - rect.height - margin;
  }

  tooltip.style.left = `${Math.max(margin, x)}px`;
  tooltip.style.top = `${Math.max(margin, y)}px`;
}

/* ---------- Summary ---------- */

function updateSummary() {
  const people = new Set(tasks.map(t => normaliseAssignee(t.assigned)));
  const words = tasks.reduce((sum, t) => sum + (Number(t.words) || 0), 0);
  const latest = tasks.reduce(
    (max, t) => !max || t.due > max ? t.due : max,
    null
  );

  document.getElementById("taskCount").textContent = tasks.length;
  document.getElementById("personCount").textContent = people.size;
  document.getElementById("wordCount").textContent = formatNumber(words);
  document.getElementById("lastDueDate").textContent = formatDate(latest);

  downloadCsvBtn.disabled = false;
}

/* ---------- CSV ---------- */

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function makeCSV() {
  const headers = [
    "Tasca",
    "Nom",
    "Data real de venciment",
    "Nombre de paraules Salt pro",
    "Persona assignada"
  ];

  const lines = [
    headers.map(csvEscape).join(";"),
    ...tasks.map(task => [
      task.taskId,
      task.name || task.title || "",
      formatDate(task.due),
      task.words || "",
      task.assigned || ""
    ].map(csvEscape).join(";"))
  ];

  return "\ufeff" + lines.join("\r\n");
}

function downloadCSV() {
  const blob = new Blob([makeCSV()], {
    type: "text/csv;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = CONFIG.CSV_FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- Main loading pipeline ---------- */

function displayTasks(rawTasks, source = "HTML") {
  try {
    prepareTasks(rawTasks);
    updateSummary();
    renderGantt();

    if (source === "extension") {
      document.getElementById("extensionInfo").classList.remove("hidden");
      setStatus(
        `✓ ${tasks.length} tareas recibidas desde la extensión. Lectura 100 % local.`,
        "success"
      );
    } else {
      document.getElementById("extensionInfo").classList.add("hidden");
      setStatus(`✓ ${tasks.length} tareas cargadas correctamente.`, "success");
    }
  } catch (error) {
    console.error(error);
    setStatus("Error: " + error.message, "error");
  }
}

htmlFile.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;

  setStatus("Leyendo archivo HTML local…");

  try {
    const html = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const extracted = extractTasksFromDocument(doc);

    if (!extracted.length) {
      throw new Error("No se encontraron tarjetas .issue-card[data-id] en el archivo.");
    }

    displayTasks(extracted, "HTML");
  } catch (error) {
    console.error(error);
    setStatus("Error: " + error.message, "error");
  }
});


downloadCsvBtn.addEventListener("click", downloadCSV);

/* ---------- Initialisation ---------- */

// Priority 1: data passed by the extension.
// This happens before any URL loading and therefore does not call GVA.
(async function initialise() {
  const extensionTasks = await getTasksFromExtension();

  if (extensionTasks && extensionTasks.__error) {
    setStatus(extensionTasks.__error, "error");
    return;
  }

  if (Array.isArray(extensionTasks)) {
    displayTasks(extensionTasks, "extension");
  } else {
    setStatus("Esperando datos…");
  }
})();
