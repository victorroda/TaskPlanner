"use strict";


/******************************************************************
 * CONFIGURACIÓN
 ******************************************************************/

const CONFIG = {

    CSV_FILENAME:
        "tasques_GVA.csv",

    WORDS_PER_DAY:
        8000,

    DAY_WIDTH:
        32,

    PERSON_WIDTH:
        170,

    ROW_BASE_HEIGHT:
        80,

    TASK_HEIGHT:
        32,

    TASK_VERTICAL_GAP:
        8

};


/******************************************************************
 * ELEMENTOS DOM
 ******************************************************************/

const fileInput =
    document.getElementById(
        "fileInput"
    );


const processFileButton =
    document.getElementById(
        "processFileButton"
    );


const processUrlButton =
    document.getElementById(
        "processUrlButton"
    );


const urlInput =
    document.getElementById(
        "urlInput"
    );


const statusBox =
    document.getElementById(
        "status"
    );


const ganttContainer =
    document.getElementById(
        "ganttContainer"
    );


const gantt =
    document.getElementById(
        "gantt"
    );


const summary =
    document.getElementById(
        "summary"
    );


const tooltip =
    document.getElementById(
        "tooltip"
    );


/******************************************************************
 * FECHAS
 ******************************************************************/

function normalizeDate(date) {

    return new Date(

        date.getFullYear(),

        date.getMonth(),

        date.getDate()

    );

}


function today() {

    return normalizeDate(
        new Date()
    );

}


function addDays(
    date,
    days
) {

    const result =
        new Date(date);

    result.setDate(
        result.getDate() + days
    );

    return result;

}


function daysBetween(
    start,
    end
) {

    const MS_PER_DAY =
        24 *
        60 *
        60 *
        1000;


    return (
        end.getTime() -
        start.getTime()
    ) / MS_PER_DAY;

}


function isBusinessDay(
    date
) {

    const day =
        date.getDay();


    return (
        day !== 0 &&
        day !== 6
    );

}


/******************************************************************
 * PARSEAR FECHA
 ******************************************************************/

function parseDate(
    dateString
) {

    if (!dateString) {

        return null;

    }


    const months = {

        /*
         * Catalán
         */

        gen: 0,
        feb: 1,
        mar: 2,
        abr: 3,
        mai: 4,
        jun: 5,
        jul: 6,
        ago: 7,
        set: 8,
        oct: 9,
        nov: 10,
        des: 11,

        /*
         * Español
         */

        ene: 0,
        dic: 11,

        /*
         * Inglés
         */

        jan: 0,
        apr: 3,
        may: 4,
        aug: 7,
        sep: 8,
        dec: 11

    };


    const text =
        dateString.trim();


    /*
     * Formato:
     *
     * 16 Nov 2026
     */

    const match =
        text.match(
            /^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\.?\s+(\d{4})/
        );


    if (match) {

        const day =
            parseInt(
                match[1],
                10
            );


        const monthName =
            match[2]
                .toLowerCase()
                .substring(
                    0,
                    3
                );


        const year =
            parseInt(
                match[3],
                10
            );


        if (
            months[monthName] !==
            undefined
        ) {

            return new Date(
                year,
                months[monthName],
                day
            );

        }

    }


    /*
     * Fallback
     */

    const fallback =
        new Date(text);


    if (
        !isNaN(
            fallback.getTime()
        )
    ) {

        return normalizeDate(
            fallback
        );

    }


    return null;

}


/******************************************************************
 * FORMATO DE FECHA PARA MOSTRAR
 ******************************************************************/

function formatDate(
    date
) {

    return date.toLocaleDateString(
        "es-ES",
        {
            day:
                "2-digit",

            month:
                "2-digit",

            year:
                "numeric"
        }
    );

}


/******************************************************************
 * FORMATO DE FECHA PARA CSV
 *
 * SIEMPRE:
 *
 * dd/mm/aaaa
 *
 * Ejemplo:
 *
 * 16 Nov 2026
 *
 * →
 *
 * 16/11/2026
 ******************************************************************/

function formatCSVDate(
    dateString
) {

    const date =
        parseDate(
            dateString
        );


    if (!date) {

        return dateString || "";

    }


    const day =
        String(
            date.getDate()
        )
        .padStart(
            2,
            "0"
        );


    const month =
        String(
            date.getMonth() + 1
        )
        .padStart(
            2,
            "0"
        );


    const year =
        date.getFullYear();


    return (
        day +
        "/" +
        month +
        "/" +
        year
    );

}


/******************************************************************
 * FORMATO DE MES
 ******************************************************************/

function formatMonth(
    date
) {

    return date.toLocaleDateString(
        "es-ES",
        {
            month:
                "short",

            year:
                "numeric"
        }
    );

}


/******************************************************************
 * PALABRAS
 ******************************************************************/

function parseWords(
    value
) {

    if (!value) {

        return 0;

    }


    let text =
        String(value)
            .trim()
            .replace(
                /[^\d.,]/g,
                ""
            );


    /*
     * Formato europeo:
     *
     * 12.345,67
     */

    if (
        text.includes(".") &&
        text.includes(",")
    ) {

        text =
            text
                .replace(
                    /\./g,
                    ""
                )
                .replace(
                    ",",
                    "."
                );

    }

    else if (
        text.includes(".")
    ) {

        text =
            text.replace(
                /\./g,
                ""
            );

    }


    return (
        parseFloat(text) ||
        0
    );

}


/******************************************************************
 * FORMATO NÚMERO
 ******************************************************************/

function formatNumber(
    value
) {

    return Number(
        value
    ).toLocaleString(
        "es-ES"
    );

}


/******************************************************************
 * ESCAPAR HTML
 ******************************************************************/

function escapeHTML(
    text
) {

    return String(
        text || ""
    )

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


/******************************************************************
 * ESTADO
 ******************************************************************/

function setStatus(
    message,
    type = ""
) {

    statusBox.textContent =
        message;


    statusBox.className =
        "";


    if (type) {

        statusBox.classList.add(
            type
        );

    }

}


/******************************************************************
 * EXTRAER ATRIBUTO
 ******************************************************************/

function getAttributeValue(
    card,
    label
) {

    const elements =
        card.querySelectorAll(
            "b"
        );


    for (
        const element of elements
    ) {

        const text =
            element.textContent
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();


        if (
            text
                .toLowerCase()
                .includes(
                    label.toLowerCase()
                )
        ) {

            let result =
                "";


            let node =
                element.nextSibling;


            while (node) {

                if (
                    node.nodeType ===
                    Node.TEXT_NODE
                ) {

                    result +=
                        node.textContent;

                }

                else if (
                    node.nodeType ===
                    Node.ELEMENT_NODE
                ) {

                    if (
                        node.tagName ===
                        "BR"
                    ) {

                        break;

                    }


                    result +=
                        node.textContent;

                }


                node =
                    node.nextSibling;

            }


            result =
                result
                    .replace(
                        /^[:\s]+/,
                        ""
                    )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();


            if (result) {

                return result;

            }

        }

    }


    /*
     * Fallback
     */

    const attributes =
        card.querySelector(
            ".attributes"
        );


    if (!attributes) {

        return "";

    }


    const text =
        attributes.innerText;


    const regex =
        new RegExp(

            label.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            ) +

            "\\s*:\\s*([^\\n]+)",

            "i"

        );


    const match =
        text.match(
            regex
        );


    return match
        ? match[1].trim()
        : "";

}


/******************************************************************
 * EXTRAER TAREAS
 ******************************************************************/

function extractTasks(
    html
) {

    const parser =
        new DOMParser();


    const doc =
        parser.parseFromString(
            html,
            "text/html"
        );


    const cards =
        doc.querySelectorAll(
            ".issue-card[data-id]"
        );


    const tasks =
        new Map();


    cards.forEach(
        card => {

            const dataId =
                card.getAttribute(
                    "data-id"
                );


            if (!dataId) {

                return;

            }


            /*
             * ID
             */

            let taskId =
                "";


            const issueId =
                card.querySelector(
                    ".issue-id"
                );


            if (issueId) {

                const match =
                    issueId.textContent
                        .match(
                            /#(\d+)/
                        );


                if (match) {

                    taskId =
                        match[1];

                }

            }


            /*
             * NOMBRE
             */

            let name =
                "";


            const nameLink =
                card.querySelector(
                    ".name a"
                );


            if (nameLink) {

                name =
                    nameLink.textContent
                        .replace(
                            /\s+/g,
                            " "
                        )
                        .trim();

            }


            /*
             * URL
             */

            let url =
                "";


            if (nameLink) {

                url =
                    nameLink.getAttribute(
                        "href"
                    ) ||
                    nameLink.href ||
                    "";

            }


            /*
             * FECHA
             */

            const dueDate =
                getAttributeValue(
                    card,
                    "Data real de venciment"
                );


            /*
             * PALABRAS
             */

            const words =
                getAttributeValue(
                    card,
                    "Nombre de paraules Salt pro"
                );


            /*
             * PERSONA
             */

            let person =
                "";


            const assigned =
                card.querySelector(
                    ".assigned-user .user a"
                );


            if (assigned) {

                person =
                    assigned.textContent
                        .replace(
                            /\s+/g,
                            " "
                        )
                        .trim();

            }


            /*
             * DEDUPLICACIÓN
             */

            if (
                !tasks.has(
                    dataId
                )
            ) {

                tasks.set(

                    dataId,

                    {

                        task:
                            taskId,

                        name:
                            name,

                        dueDate:
                            dueDate,

                        words:
                            words,

                        person:
                            person,

                        url:
                            url

                    }

                );

            }

        }
    );


    return Array.from(
        tasks.values()
    );

}


/******************************************************************
 * CALCULAR INICIO DE TAREA
 ******************************************************************/

function calculateTaskStart(
    end,
    duration
) {

    let cursor =
        new Date(end);


    let remaining =
        duration;


    while (
        remaining >
        0.000000001
    ) {

        /*
         * Día laborable anterior.
         */

        let previousDay =
            addDays(
                normalizeDate(cursor),
                -1
            );


        /*
         * Saltar fin de semana.
         */

        while (
            !isBusinessDay(
                previousDay
            )
        ) {

            previousDay =
                addDays(
                    previousDay,
                    -1
                );

        }


        /*
         * Día completo.
         */

        if (
            remaining >= 1
        ) {

            cursor =
                new Date(
                    previousDay
                );


            remaining -= 1;


            continue;

        }


        /*
         * Fracción de día.
         */

        cursor =
            new Date(

                previousDay.getTime() +

                (
                    1 -
                    remaining
                ) *

                24 *
                60 *
                60 *
                1000

            );


        remaining =
            0;

    }


    return cursor;

}


/******************************************************************
 * CREAR LISTA DE DÍAS
 ******************************************************************/

function createDateList(
    startDate,
    endDate
) {

    const dates =
        [];


    let current =
        normalizeDate(
            startDate
        );


    const end =
        normalizeDate(
            endDate
        );


    while (
        current <=
        end
    ) {

        dates.push(
            new Date(current)
        );


        current =
            addDays(
                current,
                1
            );

    }


    return dates;

}


/******************************************************************
 * CABECERA DE MESES
 ******************************************************************/

function createMonthHeader(
    dates
) {

    const row =
        document.createElement(
            "div"
        );


    row.className =
        "month-row";


    const spacer =
        document.createElement(
            "div"
        );


    spacer.className =
        "month-spacer";


    row.appendChild(
        spacer
    );


    let index =
        0;


    while (
        index <
        dates.length
    ) {

        const first =
            dates[index];


        let end =
            index + 1;


        while (

            end <
                dates.length &&

            dates[end].getMonth() ===
                first.getMonth() &&

            dates[end].getFullYear() ===
                first.getFullYear()

        ) {

            end++;

        }


        const count =
            end - index;


        const label =
            document.createElement(
                "div"
            );


        label.className =
            "month-label";


        label.style.width =
            (
                count *
                CONFIG.DAY_WIDTH
            ) +
            "px";


        label.style.minWidth =
            (
                count *
                CONFIG.DAY_WIDTH
            ) +
            "px";


        label.textContent =
            formatMonth(
                first
            );


        row.appendChild(
            label
        );


        index =
            end;

    }


    return row;

}


/******************************************************************
 * CABECERA DE DÍAS
 ******************************************************************/

function createDayHeader(
    dates
) {

    const header =
        document.createElement(
            "div"
        );


    header.className =
        "gantt-header";


    const personHeader =
        document.createElement(
            "div"
        );


    personHeader.className =
        "person-header";


    personHeader.textContent =
        "Persona";


    header.appendChild(
        personHeader
    );


    const days =
        document.createElement(
            "div"
        );


    days.className =
        "days-header";


    const currentDay =
        today();


    dates.forEach(
        date => {

            const cell =
                document.createElement(
                    "div"
                );


            cell.className =
                "day-header";


            /*
             * Hoy
             */

            if (
                date.getTime() ===
                currentDay.getTime()
            ) {

                cell.classList.add(
                    "today"
                );

            }


            /*
             * Fin de semana
             */

            if (
                !isBusinessDay(
                    date
                )
            ) {

                cell.classList.add(
                    "weekend"
                );

            }


            const number =
                document.createElement(
                    "div"
                );


            number.className =
                "day-number";


            number.textContent =
                date.getDate();


            const weekday =
                document.createElement(
                    "div"
                );


            weekday.className =
                "weekday";


            weekday.textContent =
                date
                    .toLocaleDateString(
                        "es-ES",
                        {
                            weekday:
                                "short"
                        }
                    )
                    .replace(
                        ".",
                        ""
                    )
                    .substring(
                        0,
                        3
                    );


            cell.appendChild(
                number
            );


            cell.appendChild(
                weekday
            );


            days.appendChild(
                cell
            );

        }
    );


    header.appendChild(
        days
    );


    return header;

}


/******************************************************************
 * FONDO DE FINES DE SEMANA
 ******************************************************************/

function addWeekendBackgrounds(
    timeline,
    dates
) {

    dates.forEach(
        (
            date,
            index
        ) => {

            if (
                !isBusinessDay(
                    date
                )
            ) {

                const weekend =
                    document.createElement(
                        "div"
                    );


                weekend.className =
                    "weekend-column";


                weekend.style.left =
                    (
                        index *
                        CONFIG.DAY_WIDTH
                    ) +
                    "px";


                weekend.style.width =
                    CONFIG.DAY_WIDTH +
                    "px";


                timeline.appendChild(
                    weekend
                );

            }


            /*
             * Línea de lunes
             */

            if (
                date.getDay() ===
                1
            ) {

                const line =
                    document.createElement(
                        "div"
                    );


                line.className =
                    "monday-line";


                line.style.left =
                    (
                        index *
                        CONFIG.DAY_WIDTH
                    ) +
                    "px";


                timeline.appendChild(
                    line
                );

            }

        }
    );

}


/******************************************************************
 * ASIGNAR NIVELES
 ******************************************************************/

function assignLevels(
    tasks
) {

    const sorted =
        [...tasks].sort(
            (
                a,
                b
            ) => {

                const endDifference =
                    a.end.getTime() -
                    b.end.getTime();


                if (
                    endDifference !== 0
                ) {

                    return endDifference;

                }


                return (
                    a.start.getTime() -
                    b.start.getTime()
                );

            }
        );


    const levels =
        [];


    sorted.forEach(
        task => {

            let level =
                0;


            while (true) {

                if (
                    !levels[level]
                ) {

                    levels[level] =
                        [];

                }


                const collision =
                    levels[level]
                        .some(
                            other => {

                                return (

                                    task.start <
                                        other.end &&

                                    task.end >
                                        other.start

                                );

                            }
                        );


                if (!collision) {

                    levels[level].push(
                        task
                    );


                    task.level =
                        level;


                    break;

                }


                level++;

            }

        }
    );


    return sorted;

}


/******************************************************************
 * MOSTRAR TOOLTIP
 ******************************************************************/

function showTooltip(
    task,
    event
) {

    tooltip.innerHTML =

        "<b>Tarea:</b> " +
        escapeHTML(
            task.task
        ) +

        "<br>" +

        "<b>Nombre:</b> " +
        escapeHTML(
            task.name
        ) +

        "<br>" +

        "<b>Persona:</b> " +
        escapeHTML(
            task.person
        ) +

        "<br>" +

        "<b>Palabras:</b> " +
        formatNumber(
            task.wordsNumber
        ) +

        "<br>" +

        "<b>Duración:</b> " +
        task.duration
            .toFixed(2)
            .replace(
                ".",
                ","
            ) +

        " días laborables" +

        "<br>" +

        "<b>Vencimiento:</b> " +
        formatDate(
            task.due
        );


    tooltip.style.display =
        "block";


    moveTooltip(
        event
    );

}


/******************************************************************
 * MOVER TOOLTIP
 ******************************************************************/

function moveTooltip(
    event
) {

    tooltip.style.left =
        (
            event.clientX +
            15
        ) +
        "px";


    tooltip.style.top =
        (
            event.clientY +
            15
        ) +
        "px";

}


/******************************************************************
 * CREAR BARRA
 ******************************************************************/

function createTaskBar(
    task,
    globalStart,
    timelineWidth,
    colorIndex
) {

    /*
     * ============================================================
     * EXTREMO DERECHO
     * ============================================================
     *
     * El vencimiento determina directamente
     * la posición del borde derecho.
     */

    const endDays =
        daysBetween(
            globalStart,
            task.end
        );


    /*
     * Redondeo deliberado:
     *
     * todas las tareas con el mismo vencimiento
     * terminan en exactamente el mismo píxel.
     */

    const rightPosition =
        Math.round(
            endDays *
            CONFIG.DAY_WIDTH
        );


    /*
     * ============================================================
     * ANCHURA VISUAL
     * ============================================================
     */

    const visualDays =
        daysBetween(
            task.start,
            task.end
        );


    let width =
        Math.round(
            visualDays *
            CONFIG.DAY_WIDTH
        );


    width =
        Math.max(
            4,
            width
        );


    /*
     * ============================================================
     * BARRA
     * ============================================================
     */

    const bar =
        document.createElement(
            "div"
        );


    bar.className =
        "task-bar " +
        "person-color-" +
        (
            colorIndex % 8
        );


    /*
     * NO usamos left para determinar
     * el extremo derecho.
     */

    bar.style.left =
        "auto";


    bar.style.right =
        (
            timelineWidth -
            rightPosition
        ) +
        "px";


    /*
     * Recorte si empieza antes de hoy.
     */

    let visibleWidth =
        width;


    if (
        task.start <
        globalStart
    ) {

        visibleWidth =
            rightPosition;

    }


    visibleWidth =
        Math.max(
            4,
            Math.round(
                visibleWidth
            )
        );


    bar.style.width =
        visibleWidth +
        "px";


    /*
     * POSICIÓN VERTICAL
     */

    bar.style.top =
        (
            10 +
            task.level *
            (
                CONFIG.TASK_HEIGHT +
                CONFIG.TASK_VERTICAL_GAP
            )
        ) +
        "px";


    /*
     * ============================================================
     * TEXTO
     * ============================================================
     */

    const id =
        document.createElement(
            "span"
        );


    id.className =
        "task-id";


    id.textContent =
        task.task;


    bar.appendChild(
        id
    );


    const duration =
        document.createElement(
            "span"
        );


    duration.className =
        "task-duration";


    duration.textContent =
        task.duration
            .toFixed(2)
            .replace(
                ".",
                ","
            ) +
        " d";


    bar.appendChild(
        duration
    );


    /*
     * ============================================================
     * TOOLTIP
     * ============================================================
     */

    bar.addEventListener(
        "mouseenter",
        event => {

            showTooltip(
                task,
                event
            );

        }
    );


    bar.addEventListener(
        "mousemove",
        moveTooltip
    );


    bar.addEventListener(
        "mouseleave",
        () => {

            tooltip.style.display =
                "none";

        }
    );


    /*
     * ============================================================
     * DOBLE CLIC
     * ============================================================
     */

    if (
        task.url
    ) {

        bar.addEventListener(
            "dblclick",
            () => {

                window.open(
                    task.url,
                    "_blank"
                );

            }
        );

    }


    return bar;

}


/******************************************************************
 * CREAR FILA DE PERSONA
 ******************************************************************/

function createPersonRow(
    person,
    tasks,
    globalStart,
    timelineDates,
    colorIndex
) {

    const row =
        document.createElement(
            "div"
        );


    row.className =
        "person-row";


    /*
     * PERSONA
     */

    const personName =
        document.createElement(
            "div"
        );


    personName.className =
        "person-name";


    personName.textContent =
        person;


    row.appendChild(
        personName
    );


    /*
     * TIMELINE
     */

    const timeline =
        document.createElement(
            "div"
        );


    timeline.className =
        "timeline";


    const timelineWidth =
        timelineDates.length *
        CONFIG.DAY_WIDTH;


    timeline.style.width =
        timelineWidth +
        "px";


    /*
     * Fines de semana
     */

    addWeekendBackgrounds(
        timeline,
        timelineDates
    );


    /*
     * ============================================================
     * PREPARAR TAREAS
     * ============================================================
     */

    const prepared =
        tasks

            .map(
                task => {

                    const due =
                        parseDate(
                            task.dueDate
                        );


                    if (!due) {

                        return null;

                    }


                    const words =
                        parseWords(
                            task.words
                        );


                    const duration =
                        words /
                        CONFIG.WORDS_PER_DAY;


                    /*
                     * El final está en el comienzo
                     * del día posterior al vencimiento.
                     */

                    const end =
                        addDays(
                            due,
                            1
                        );


                    /*
                     * Calculamos el inicio
                     * hacia atrás.
                     */

                    const start =
                        calculateTaskStart(
                            end,
                            duration
                        );


                    return {

                        ...task,

                        due:
                            due,

                        wordsNumber:
                            words,

                        duration:
                            duration,

                        start:
                            start,

                        end:
                            end

                    };

                }
            )

            .filter(
                Boolean
            );


    /*
     * NIVELES
     */

    assignLevels(
        prepared
    );


    /*
     * ALTURA
     */

    const maxLevel =
        prepared.length
            ? Math.max(
                ...prepared.map(
                    task =>
                        task.level
                )
            )
            : 0;


    const rowHeight =
        Math.max(

            CONFIG.ROW_BASE_HEIGHT,

            20 +
            (
                maxLevel + 1
            ) *
            (
                CONFIG.TASK_HEIGHT +
                CONFIG.TASK_VERTICAL_GAP
            )

        );


    timeline.style.height =
        rowHeight +
        "px";


    row.style.height =
        rowHeight +
        "px";


    /*
     * ============================================================
     * BARRAS
     * ============================================================
     */

    prepared.forEach(
        task => {

            if (
                task.end <=
                globalStart
            ) {

                return;

            }


            const bar =
                createTaskBar(

                    task,

                    globalStart,

                    timelineWidth,

                    colorIndex

                );


            timeline.appendChild(
                bar
            );

        }
    );


    row.appendChild(
        timeline
    );


    return row;

}


/******************************************************************
 * GENERAR GANTT
 ******************************************************************/

function generateGantt(
    tasks
) {

    gantt.innerHTML =
        "";


    /*
     * Tareas con fecha válida
     */

    const validTasks =
        tasks

            .map(
                task => {

                    const due =
                        parseDate(
                            task.dueDate
                        );


                    if (!due) {

                        return null;

                    }


                    return {

                        ...task,

                        due:
                            due

                    };

                }
            )

            .filter(
                Boolean
            );


    if (
        !validTasks.length
    ) {

        gantt.innerHTML =
            "<p>" +
            "No hay tareas con fecha válida." +
            "</p>";


        ganttContainer.style.display =
            "block";


        return;

    }


    /*
     * Hoy
     */

    const globalStart =
        today();


    /*
     * Último vencimiento
     */

    let lastDue =
        new Date(
            globalStart
        );


    validTasks.forEach(
        task => {

            if (
                task.due >
                lastDue
            ) {

                lastDue =
                    new Date(
                        task.due
                    );

            }

        }
    );


    /*
     * Días visibles
     */

    const dates =
        createDateList(
            globalStart,
            lastDue
        );


    /*
     * ============================================================
     * AGRUPAR POR PERSONA
     * ============================================================
     */

    const groups =
        new Map();


    validTasks.forEach(
        task => {

            const person =
                task.person ||
                "Sin asignar";


            if (
                !groups.has(
                    person
                )
            ) {

                groups.set(
                    person,
                    []
                );

            }


            groups
                .get(person)
                .push(
                    task
                );

        }
    );


    /*
     * Personas ordenadas
     */

    const people =
        Array.from(
            groups.keys()
        )
        .sort(
            (
                a,
                b
            ) =>
                a.localeCompare(
                    b
                )
        );


    /*
     * CABECERAS
     */

    gantt.appendChild(
        createMonthHeader(
            dates
        )
    );


    gantt.appendChild(
        createDayHeader(
            dates
        )
    );


    /*
     * FILAS
     */

    people.forEach(
        (
            person,
            index
        ) => {

            const row =
                createPersonRow(

                    person,

                    groups.get(
                        person
                    ),

                    globalStart,

                    dates,

                    index

                );


            gantt.appendChild(
                row
            );

        }
    );


    /*
     * ============================================================
     * RESUMEN
     * ============================================================
     */

    const totalWords =
        validTasks.reduce(
            (
                total,
                task
            ) => {

                return (
                    total +
                    parseWords(
                        task.words
                    )
                );

            },
            0
        );


    const totalEffort =
        totalWords /
        CONFIG.WORDS_PER_DAY;


    summary.innerHTML =

        "<strong>Hoy:</strong> " +
        formatDate(
            globalStart
        ) +

        " &nbsp; | &nbsp; " +

        "<strong>Último vencimiento:</strong> " +
        formatDate(
            lastDue
        ) +

        " &nbsp; | &nbsp; " +

        "<strong>Tareas:</strong> " +
        validTasks.length +

        " &nbsp; | &nbsp; " +

        "<strong>Personas:</strong> " +
        people.length +

        " &nbsp; | &nbsp; " +

        "<strong>Palabras:</strong> " +
        formatNumber(
            totalWords
        ) +

        " &nbsp; | &nbsp; " +

        "<strong>Esfuerzo:</strong> " +
        totalEffort
            .toFixed(1)
            .replace(
                ".",
                ","
            ) +

        " días laborables";


    ganttContainer.style.display =
        "block";

}


/******************************************************************
 * CSV
 ******************************************************************/

function createCSV(
    tasks
) {

    const headers = [

        "Tasca",

        "Nom",

        "Data real de venciment",

        "Nombre de paraules Salt pro",

        "Persona assignada",

        "URL"

    ];


    let csv =
        "\uFEFF";


    csv +=

        headers
            .map(
                csvEscape
            )
            .join(";") +

        "\r\n";


    tasks.forEach(
        task => {

            /*
             * AQUÍ CONVERTIMOS LA FECHA
             *
             * 16 Nov 2026
             *
             * →
             *
             * 16/11/2026
             */

            const csvDate =
                formatCSVDate(
                    task.dueDate
                );


            csv +=

                [

                    task.task,

                    task.name,

                    csvDate,

                    task.words,

                    task.person,

                    task.url

                ]

                    .map(
                        csvEscape
                    )

                    .join(";") +

                "\r\n";

        }
    );


    return csv;

}


/******************************************************************
 * ESCAPAR CSV
 ******************************************************************/

function csvEscape(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    const text =
        String(value);


    if (
        text.includes(";") ||
        text.includes('"') ||
        text.includes("\n") ||
        text.includes("\r")
    ) {

        return (

            '"' +

            text.replace(
                /"/g,
                '""'
            ) +

            '"'

        );

    }


    return text;

}


/******************************************************************
 * DESCARGAR CSV
 ******************************************************************/

function downloadCSV(
    csv
) {

    const blob =
        new Blob(

            [csv],

            {
                type:
                    "text/csv;charset=utf-8;"
            }

        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;


    link.download =
        CONFIG.CSV_FILENAME;


    document.body.appendChild(
        link
    );


    link.click();


    document.body.removeChild(
        link
    );


    URL.revokeObjectURL(
        url
    );

}


/******************************************************************
 * PROCESAR HTML
 ******************************************************************/

function processHTML(
    html,
    source
) {

    try {

        setStatus(
            "Procesando " +
            source +
            "..."
        );


        const tasks =
            extractTasks(
                html
            );


        if (!tasks.length) {

            ganttContainer.style.display =
                "none";


            setStatus(
                "No se han encontrado tareas.",
                "error"
            );


            return;

        }


        /*
         * CSV
         */

        const csv =
            createCSV(
                tasks
            );


        downloadCSV(
            csv
        );


        /*
         * GANTT
         */

        generateGantt(
            tasks
        );


        /*
         * ESTADO
         */

        setStatus(

            "Proceso completado correctamente.\n\n" +

            "Tareas encontradas: " +
            tasks.length +

            "\nCSV generado: " +
            CONFIG.CSV_FILENAME,

            "success"

        );


        console.log(
            "Tareas extraídas:",
            tasks
        );


        console.table(
            tasks
        );

    }

    catch (error) {

        console.error(
            error
        );


        setStatus(

            "Se ha producido un error:\n\n" +
            error.message,

            "error"

        );

    }

}


/******************************************************************
 * FICHERO LOCAL
 ******************************************************************/

processFileButton.addEventListener(
    "click",
    () => {

        const file =
            fileInput.files[0];


        if (!file) {

            setStatus(
                "Selecciona primero un fichero HTML.",
                "error"
            );


            return;

        }


        const reader =
            new FileReader();


        reader.onload =
            event => {

                processHTML(

                    event.target.result,

                    file.name

                );

            };


        reader.onerror =
            () => {

                setStatus(
                    "No se ha podido leer el fichero.",
                    "error"
                );

            };


        reader.readAsText(
            file,
            "UTF-8"
        );

    }
);


/******************************************************************
 * URL
 ******************************************************************/

processUrlButton.addEventListener(
    "click",
    async () => {

        const url =
            urlInput.value.trim();


        if (!url) {

            setStatus(
                "Introduce una URL.",
                "error"
            );


            return;

        }


        try {

            setStatus(
                "Leyendo URL..."
            );


            const response =
                await fetch(

                    url,

                    {
                        credentials:
                            "include"
                    }

                );


            if (!response.ok) {

                throw new Error(

                    "HTTP " +
                    response.status +
                    " " +
                    response.statusText

                );

            }


            const html =
                await response.text();


            processHTML(
                html,
                url
            );

        }

        catch (error) {

            console.error(
                error
            );


            setStatus(

                "No se ha podido leer la URL.\n\n" +

                error.message +

                "\n\n" +

                "Si aparece un error de CORS, " +
                "utiliza el fichero HTML guardado.",

                "error"

            );

        }

    }
);

