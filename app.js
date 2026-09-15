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

  // "16 Nov 2026" / "16 set 2026" / "16 des 2026"
  m = text.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})$/);
  if (m) {
    const months = {
      gen: 0, feb: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6,
      ago: 7, set: 8, oct: 9, nov: 10, des: 11,
      ene: 0, dic: 11, jan: 0, apr: 3, may: 4, aug: 7,
      sep: 8, dec: 11
    };
    const month = months[m[2].slice(0, 3).toLowerCase()];
    if (month !== undefined) {
      const d = new Date(Number(m[3]), month, Number(m[1]));
      return isValidDate(d) ? startOfDay(d) : null;
    }
  }

  // yyyy-mm-dd
  m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isValidDate(d) ? startOfDay(d) : null;
  }

  return null;
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
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function formatDate(date) {
  if (!date) return "";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function formatMonth(date) {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function daysBetween(a, b) {
  const ms = startOfDay(b) - startOfDay(a);
  return Math.round(ms / 86400000);
}

function parseWords(value) {
  let s = cleanText(value).replace(/[^\d.,-]/g, "");
  if (!s) return 0;

  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    s = s.replace(/,/g, "");
  } else if (s.includes(".") && /^-?\d+\.\d{3}$/.test(s)) {
    s = s.replace(".", "");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}


/* ---------- Extraction from an HTML document ---------- */

function normaliseAssignee(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "Sin asignar";

  const key = text.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if ([
    "sin asignar", "sin assignar", "no asignada", "no asignado",
    "unassigned", "none", "-", "—"
  ].includes(key)) {
    return "Sin asignar";
  }

  return text;
}

function attributeValue(card, labels) {
  const normalLabel = v => cleanText(v)
    .replace(/[\s:：]+$/g, "")
    .toLowerCase();

  const wanted = new Set(labels.map(normalLabel));
  const attributes = card.querySelector("p.attributes");
  if (!attributes) return "";

  for (const b of attributes.querySelectorAll("b, strong, label")) {
    if (!wanted.has(normalLabel(b.textContent))) continue;

    const parts = [];
    let node = b.nextSibling;

    // EXACT same strategy as the extension:
    // read siblings after the label until the next <br>.
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE &&
          node.tagName === "BR") {
        break;
      }
      parts.push(node.textContent || "");
      node = node.nextSibling;
    }

    const value = cleanText(
      parts.join(" ").replace(/^[\s:：-]+/, "")
    );
    if (value) return value;

    // Same fallback as the extension.
    const parent = b.parentElement;
    if (parent) {
      const clone = parent.cloneNode(true);
      clone.querySelectorAll("b, strong, label")
        .forEach(x => x.remove());

      const fallback = cleanText(clone.textContent)
        .replace(/^[\s:：-]+/, "");
      if (fallback) return fallback;
    }
  }

  return "";
}

function extractIssueId(card) {
  const clean = v => String(v ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const dataId = card.getAttribute("data-id");
  if (/^\d+$/.test(clean(dataId))) return clean(dataId);

  for (const el of card.querySelectorAll(
    ".issue-id, a[href*='/issues/'], [class*='issue-id']"
  )) {
    const textMatch = clean(el.textContent).match(/#(\d+)/);
    if (textMatch) return textMatch[1];

    const href = el.getAttribute?.("href") || "";
    const hrefMatch = href.match(/\/issues\/(\d+)/);
    if (hrefMatch) return hrefMatch[1];
  }

  const m = clean(card.textContent).match(/#(\d+)/);
  return m ? m[1] : "";
}

function getAssigned(card) {
  // EXACT same selectors/order as the working extension.
  const selectors = [
    ".assigned-user .user a[href*='/people/']",
    ".assigned-user a[href*='/people/']",
    ".assigned-user .user a",
    "[class*='assigned-user'] a[href*='/people/']",
    "[class*='assigned'] a[href*='/people/']"
  ];

  for (const selector of selectors) {
    const a = card.querySelector(selector);
    const value = cleanText(a?.textContent);
    if (value) return value;
  }

  return "";
}

function getTaskName(card) {
  return cleanText(
    card.querySelector("p.name a, p.name")?.textContent
  ) || cleanText(
    card.querySelector(".issue-name, .subject, [class*='subject']")
      ?.textContent
  );
}

function extractTaskFromCard(card) {
  const taskId = extractIssueId(card);

  const name = getTaskName(card);

  const dueDate = attributeValue(card, [
    "Data real de venciment",
    "Fecha real de vencimiento",
    "Real due date",
    "Due date"
  ]);

  const wordsText = attributeValue(card, [
    "Nombre de paraules Salt pro",
    "Número de palabras Salt pro",
    "Salt pro words",
    "Words"
  ]);

  const issueLink =
    card.querySelector("p.name a[href*='/issues/']") ||
    card.querySelector("a[href*='/issues/']");

  return {
    taskId,
    title: name,
    name,
    dueDate,
    words: parseWords(wordsText),
    assigned: normaliseAssignee(getAssigned(card)),
    url: issueLink?.href || ""
  };
}

function extractTasksFromDocument(doc) {
  // EXACT same card selector as the extension.
  const cards = Array.from(doc.querySelectorAll(".issue-card"));
  const seen = new Set();
  const result = [];

  for (const card of cards) {
    const task = extractTaskFromCard(card);

    if (!task.taskId || seen.has(task.taskId)) continue;

    seen.add(task.taskId);
    result.push(task);
  }

  console.log("[GVA Planning] Lector local: tarjetas:", cards.length,
              "tareas únicas:", result.length);

  return result;
}

/* ---------- Extension input ---------- */

function getTasksFromExtension() {
  const hash = window.location.hash || "";
  if (!hash.startsWith("#data=")) return null;

  try {
    const encoded = decodeURIComponent(hash.slice("#data=".length));
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const json = new TextDecoder("utf-8").decode(bytes);
    const parsed = JSON.parse(json);

    if (!Array.isArray(parsed) || !parsed.length) return null;

    console.log("[GVA Planning] Datos de extensión recibidos:", parsed.length);
    return parsed;
  } catch (error) {
    console.error("[GVA Planning] Error leyendo datos de la extensión:", error);
    return null;
  }
}

/* ---------- Normalisation ---------- */

function normaliseTasks(rawTasks) {
  const seen = new Set();

  return rawTasks
    .map(t => ({
      taskId: String(t.taskId || t.id || "").trim(),
      title: cleanText(t.title || ""),
      name: cleanText(t.name || t.title || ""),
      dueDate: cleanText(t.dueDate || ""),
      words: Number(t.words) || parseWords(t.words),
      assigned: cleanText(t.assigned || t.person || ""),
      url: t.url || ""
    }))
    .filter(t => {
      if (!t.taskId || seen.has(t.taskId)) return false;
      seen.add(t.taskId);
      return true;
    });
}

function prepareTasks(rawTasks) {
  tasks = normaliseTasks(rawTasks)
    .map(task => {
      const due = parseDate(task.dueDate);
      const duration = task.words / CONFIG.WORDS_PER_DAY;

      return {
        ...task,
        due,
        duration
      };
    })
    .filter(task => task.due);

  if (!tasks.length) {
    throw new Error("No hay tareas con una fecha de vencimiento válida.");
  }

  // "Current day" as requested for the timeline.
  const today = startOfDay(new Date());

  const latestDue = tasks.reduce(
    (max, task) => task.due > max ? task.due : max,
    tasks[0].due
  );

  globalStart = today;
  globalEnd = latestDue;

  // If all tasks are already overdue, still make a useful timeline.
  if (globalStart > globalEnd) {
    globalStart = tasks.reduce(
      (min, task) => task.due < min ? task.due : min,
      tasks[0].due
    );
  }

  tasks.sort((a, b) => {
    const pa = a.assigned || "Sin asignar";
    const pb = b.assigned || "Sin asignar";
    return pa.localeCompare(pb, "es") || a.due - b.due || a.taskId.localeCompare(b.taskId);
  });
}

/* ---------- Gantt calculations ---------- */

/*
 * Returns the start datetime of a task by walking backwards over
 * business days. Duration is measured in business days.
 *
 * The due date itself is a full business day available to the task.
 * The visual right edge is always the beginning of the following day.
 */
function calculateTaskStart(due, duration) {
  if (duration <= 0) return startOfDay(due);

  // The right boundary of a task is the end of its due date
  // (i.e. 00:00 of the following calendar day).
  let remaining = duration;
  let cursor = startOfDay(due);

  while (remaining > 0) {
    // Skip weekends completely.
    while (!isBusinessDay(cursor)) {
      cursor = addDays(cursor, -1);
    }

    if (remaining <= 1) {
      // Fractional part of the final working day.
      return new Date(cursor.getTime() + (1 - remaining) * 86400000);
    }

    remaining -= 1;
    cursor = addDays(cursor, -1);
  }

  return startOfDay(due);
}

function assignTaskGeometry(task) {
  task.start = calculateTaskStart(task.due, task.duration);

  // IMPORTANT: the end is not always due + 1 visually. The task must
  // occupy exactly its business-day duration. Its right boundary is
  // still the end of the due date, while weekends between start and end
  // simply contain no working time.
  task.end = addDays(task.due, 1);
}

/* ---------- Gantt rendering ---------- */



function buildDateArray(start, end) {
  const dates = [];
  let d = startOfDay(start);

  while (d <= end) {
    dates.push(new Date(d));
    d = addDays(d, 1);
  }

  return dates;
}

function createDayHeader(date) {
  const el = document.createElement("div");
  el.className = "day-header";

  if (!isBusinessDay(date)) el.classList.add("weekend");
  if (date.getDay() === 1) el.classList.add("monday");

  el.textContent = date.getDate();
  el.title = formatDate(date);

  return el;
}

function createMonthCells(dates) {
  const cells = [];
  let currentMonth = null;
  let currentCount = 0;

  function flush() {
    if (!currentMonth) return;
    const cell = document.createElement("div");
    cell.className = "month-cell";
    cell.style.flexBasis = `${currentCount * CONFIG.DAY_WIDTH}px`;
    cell.style.width = `${currentCount * CONFIG.DAY_WIDTH}px`;
    cell.textContent = `${MONTH_NAMES[currentMonth.month]} ${currentMonth.year}`;
    cells.push(cell);
  }

  for (const date of dates) {
    const key = `${date.getFullYear()}-${date.getMonth()}`;

    if (!currentMonth || currentMonth.key !== key) {
      flush();
      currentMonth = {
        key,
        month: date.getMonth(),
        year: date.getFullYear()
      };
      currentCount = 1;
    } else {
      currentCount++;
    }
  }

  flush();
  return cells;
}

function createTimelineGrid(dates, height) {
  const grid = document.createElement("div");
  grid.className = "timeline-grid";
  grid.style.height = `${height}px`;

  dates.forEach(date => {
    const col = document.createElement("div");
    col.className = "day-column";
    grid.appendChild(col);
  });

  dates.forEach((date, index) => {
    if (!isBusinessDay(date)) {
      const weekend = document.createElement("div");
      weekend.className = "weekend-column";
      weekend.style.left = `${index * CONFIG.DAY_WIDTH}px`;
      weekend.style.width = `${CONFIG.DAY_WIDTH}px`;
      grid.appendChild(weekend);
    }

    if (date.getDay() === 1) {
      const line = document.createElement("div");
      line.className = "monday-line";
      line.style.left = `${index * CONFIG.DAY_WIDTH}px`;
      grid.appendChild(line);
    }
  });

  return grid;
}

const PERSON_COLORS = [
  "#536dfe", "#26a69a", "#ab47bc", "#ef5350", "#ffa726",
  "#42a5f5", "#66bb6a", "#ec407a", "#7e57c2", "#29b6f6",
  "#8d6e63", "#5c6bc0", "#26c6da", "#9ccc65", "#ff7043"
];

function getPersonColor(person) {
  const name = cleanText(person);
  if (!name || name === "Sin asignar") return "#9e9e9e";

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }

  return PERSON_COLORS[Math.abs(hash) % PERSON_COLORS.length];
}

function businessTimeCoordinate(date) {
  // Horizontal coordinate measured in working-day units from globalStart.
  // Weekends have zero width in this coordinate, while the calendar itself
  // still displays them.
  let d = startOfDay(globalStart);
  let units = 0;

  while (d < date) {
    if (isBusinessDay(d)) {
      const next = addDays(d, 1);
      const fraction = Math.max(
        0,
        Math.min(1, (Math.min(date, next) - d) / 86400000)
      );
      units += fraction;
    }
    d = addDays(d, 1);
  }

  return units;
}

function calendarPixelPosition(date) {
  // Keep the visible calendar grid unchanged. Convert the working-time
  // interval to calendar coordinates, inserting weekend space.
  return (date - startOfDay(globalStart)) / 86400000 * CONFIG.DAY_WIDTH;
}

function businessDurationInCalendarDays(start, duration) {
  // Convert a duration expressed in working days into the corresponding
  // calendar interval while skipping weekends.
  if (duration <= 0) return 0;

  let remaining = duration;
  let cursor = new Date(start);

  while (remaining > 0) {
    // A fractional start may fall inside a working day.
    if (!isBusinessDay(cursor)) {
      cursor = addDays(startOfDay(cursor), 1);
      continue;
    }

    const dayStart = startOfDay(cursor);
    const elapsed = (cursor - dayStart) / 86400000;
    const available = 1 - elapsed;

    if (remaining <= available) {
      return (cursor - startOfDay(start)) / 86400000 + remaining;
    }

    remaining -= available;
    cursor = addDays(dayStart, 1);

    while (!isBusinessDay(cursor)) {
      cursor = addDays(cursor, 1);
    }
  }

  return (cursor - startOfDay(start)) / 86400000;
}

function calendarPixelPosition(date) {
  return ((date - startOfDay(globalStart)) / 86400000) * CONFIG.DAY_WIDTH;
}

function calendarPixelPosition(date) {
  return ((date - startOfDay(globalStart)) / 86400000) * CONFIG.DAY_WIDTH;
}

function calendarPixelPosition(date) {
  return ((date - startOfDay(globalStart)) / 86400000) * CONFIG.DAY_WIDTH;
}

function createTaskBar(task, timelineWidth) {
  const bar = document.createElement("div");
  bar.className = "task-bar";

  // The right edge is determined ONLY by the due-date boundary.
  const rightPosition = calendarPixelPosition(addDays(task.due, 1));

  // Duration is calculated backwards in working days.
  const leftPosition = calendarPixelPosition(
    calculateTaskStart(task.due, task.duration)
  );

  // Visual minimum: tasks below 0.5 working days are drawn with the
  // width of 0.5 working days so they remain easy to see. Their real
  // scheduling duration remains unchanged in task.duration.
  const visualDuration = Math.max(task.duration, 0.5);
  const visualStart = calculateTaskStart(task.due, visualDuration);
  const visualLeft = calendarPixelPosition(visualStart);
  const width = Math.max(1, rightPosition - visualLeft);

  // Inline box model prevents the text/content from changing the geometry.
  bar.style.boxSizing = "border-box";
  bar.style.minWidth = "0";
  bar.style.maxWidth = `${width}px`;
  bar.style.left = `${rightPosition - width}px`;
  bar.style.width = `${width}px`;

  bar.style.background = getPersonColor(task.assigned || "Sin asignar");

  const idSpan = document.createElement("span");
  idSpan.className = "task-id";
  idSpan.textContent = `#${task.taskId}`;

  const titleSpan = document.createElement("span");
  titleSpan.textContent = task.name || task.title || "";

  bar.appendChild(idSpan);
  bar.appendChild(titleSpan);

  return bar;
}
function buildTooltip(task) {
  return `
    <div><strong>Tarea:</strong> #${escapeHtml(task.taskId)}</div>
    <div><strong>Nombre:</strong> ${escapeHtml(task.name || task.title || "")}</div>
    <div><strong>Persona:</strong> ${escapeHtml(task.assigned || "Sin asignar")}</div>
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
    const person = task.assigned || "Sin asignar";
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
    // Assign overlapping tasks to independent vertical lanes.
    // The lane affects only TOP; LEFT always comes from the task dates.
    const sortedTasks = [...personTasks].sort((a, b) =>
      a.start - b.start || a.end - b.end
    );

    const lanes = [];
    const laneByTask = new Map();

    for (const task of sortedTasks) {
      let lane = 0;
      while (lane < lanes.length && lanes[lane] > task.start) lane++;

      if (lane === lanes.length) lanes.push(task.end);
      else lanes[lane] = task.end;

      laneByTask.set(task, lane);
    }

    const laneCount = Math.max(1, lanes.length);
    const rowHeight = Math.max(
      CONFIG.ROW_BASE_HEIGHT,
      20 + laneCount * (CONFIG.TASK_HEIGHT + CONFIG.TASK_VERTICAL_GAP)
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

    personTasks.forEach(task => {
      const bar = createTaskBar(task, timelineWidth);
      const lane = laneByTask.get(task) ?? 0;
      bar.style.top =
        `${10 + lane * (CONFIG.TASK_HEIGHT + CONFIG.TASK_VERTICAL_GAP)}px`;

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
  const people = new Set(tasks.map(t => t.assigned || "Sin asignar"));
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
const extensionTasks = getTasksFromExtension();

if (extensionTasks) {
  displayTasks(extensionTasks, "extension");
} else {
  setStatus("Esperando datos…");
}
