// ======================================================
// CONFIGURACIÓN BÁSICA Y ENDPOINTS
// ======================================================
const APPKEY   = "blocklygames";
const LOGIN_URL = "/views/login-inv.html";

// Rutas del backend para este módulo
const api = {
  identity: (uid) => `/investigator/player/${uid}/identity`,
  overview: (uid) => `/investigator/player/${uid}/overview`,
  sessionsSeries: (uid, from, to) => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to)   p.set("to", to);
    return `/investigator/player/${uid}/sessions/series?` + p.toString();
  },
  gameSummary: (uid, gid) => `/investigator/player/${uid}/games/${gid}/summary`,
  gameLevels:  (uid, gid) => `/investigator/player/${uid}/games/${gid}/levels`,
  attempts:    (uid, gid, nid, limit=20, offset=0) =>
    `/investigator/player/${uid}/games/${gid}/levels/${nid}/attempts?limit=${limit}&offset=${offset}`,
  events:      (iid, limit=50, offset=0) =>
    `/investigator/attempts/${iid}/events?limit=${limit}&offset=${offset}`,
  games:       () => `/investigator/catalog/games`,
};

// Paleta centralizada para todos los charts
const CHART_COLORS = {
  exito:  'rgba(80, 230, 150, 0.85)',
  fallo:  'rgba(255, 120, 120, 0.85)',
  aband:  'rgba(255, 190, 110, 0.85)',
  bar:    'rgba(90, 169, 255, 0.9)',
  line:   'rgba(230, 230, 255, 0.95)'
};


// ======================================================
// HELPERS DE SESIÓN Y FETCH AUTENTICADO
// ======================================================

// Lee la info guardada en localStorage (sesión actual)
function getState(){
  try {
    return JSON.parse(localStorage.getItem(APPKEY) || "{}");
  } catch {
    return {};
  }
}

// Valida que haya sesión de investigador; si no, redirige al login
function requireSession(){
  const s = getState();
  if (!s?.sesion_id || s?.rol !== "investigador") {
    location.href = LOGIN_URL;
    throw new Error("Sin sesión");
  }
  return s;
}

// fetch con encabezado Authorization pre-configurado
async function authFetch(url, opts = {}){
  const { sesion_id } = requireSession();
  const headers = new Headers(opts.headers || {});
  headers.set("Authorization", `Bearer ${sesion_id}`);

  if (!headers.has("Content-Type") && opts.method && opts.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...opts, headers });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }

  return { res, data };
}


// ======================================================
// HELPERS GENERALES (DOM, FORMATEO, ETC.)
// ======================================================

// Atajo para querySelector
function q(sel){ return document.querySelector(sel); }

// Formato fecha/hora completo (se usa en el header)
function fmtDate(d){
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleString();
}

// Formato fecha breve: dd/mm/yyyy - hh:mm
function fmtDateShort(d){
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return d;

  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  const hh = String(dt.getHours()).padStart(2, "0");
  const mi = String(dt.getMinutes()).padStart(2, "0");

  return `${dd}/${mm}/${yyyy} - ${hh}:${mi}`;
}

// Convierte un estado a una etiqueta de color (COMPLETADO / ABANDONADO / etc.)
function renderEstadoPill(estadoRaw){
  const text = (estadoRaw || '—').toString();
  const estado = text.toUpperCase();

  let cls = "tag tag--neutral";
  if (estado === "COMPLETADO") {
    cls = "tag tag--success";
  } else if (estado === "ABANDONADO") {
    cls = "tag tag--warning";
  } else if (estado === "FALLO" || estado === "ERROR") {
    cls = "tag tag--danger";
  }

  return `<span class="${cls}">${text}</span>`;
}

// Formatos numéricos y porcentajes seguros
function pct(n){ return isFinite(n) ? `${Number(n).toFixed(2)}%` : "0.00%"; }
function num(n, dec=2){ return isFinite(n) ? Number(n).toFixed(dec) : "0.00"; }

// Convierte segundos a mm:ss (para tiempos por intento)
function secToMmSs(seconds){
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// Convierte segundos a hh:mm:ss (para tiempos por sesión o nivel)
function secToHhMmSs(seconds){
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// A partir de total y porcentaje, calcula cantidad aproximada (redondeo)
function countFromPct(total, pctVal){
  const t = Number(total);
  const p = Number(pctVal);
  if (!isFinite(t) || !isFinite(p) || t <= 0) return 0;
  return Math.round(t * p / 100);
}


// ===============================================
// Traducciones legibles para Maze / Bird
// ===============================================
const BLOCK_LABELS = {
  // Maze
  AVANZAR:                 "AVANZAR",
  GIRAR_DERECHA:           "GIRAR A LA DERECHA",
  GIRAR_IZQUIERDA:         "GIRAR A LA IZQUIERDA",
  REPETIR_HASTA_META:      "HACER HASTA LA META",
  SENSOR_CAMINO_ADELANTE:  "SENSOR: ¿HAY CAMINO HACIA ADELANTE?",
  SENSOR_CAMINO_DERECHA:   "SENSOR: ¿HAY CAMINO HACIA LA DERECHA?",
  SENSOR_CAMINO_IZQUIERDA: "SENSOR: ¿HAY CAMINO HACIA LA IZQUIERDA?",
  SI_CAMINO_HACER:         "SI HAY CAMINO HACIA ADELANTE, HACER",
  SI_CAMINO_SINO:          "SI HAY CAMINO HACIA ADELANTE, HACER; SI NO, HACER",

  // Bird
  BIRD_CAMBIO_DIRECCION:   "CAMBIAR DIRECCIÓN DEL PÁJARO",
  BIRD_COND_SIN_GUSANO:    "CONDICIÓN: ¿NO HAY GUSANO?",
  BIRD_COMPARADOR_POSICION:"COMPARAR POSICIÓN DEL PÁJARO",
  BIRD_OPERADOR_LOGICO:    "OPERADOR LÓGICO"
};

// Valores internos de dirección → español
const DIR_VALUE_LABELS = {
  isPathForward: "adelante",
  isPathRight:   "a la derecha",
  isPathLeft:    "a la izquierda"
};

// Campos de edición → español
const EDIT_FIELD_LABELS = {
  DIR: "la dirección"
};

// Devuelve un nombre de bloque legible
function friendlyBlockName(raw){
  if (!raw) return "bloque";
  const key = String(raw).trim().toUpperCase();
  if (BLOCK_LABELS[key]) return BLOCK_LABELS[key];
  // Fallback: "SI_CAMINO_SINO" -> "SI CAMINO SINO"
  return key.replace(/_/g, " ");
}

// Devuelve un nombre de campo editado legible
function friendlyEditField(edit){
  const raw =
    (edit && (edit.nombre || edit.elemento)) ?
      String(edit.nombre || edit.elemento).trim() : "";

  if (!raw) return "el valor";

  const key = raw.toUpperCase();
  if (EDIT_FIELD_LABELS[key]) return EDIT_FIELD_LABELS[key];

  return raw.toLowerCase();
}

// Devuelve el valor viejo/nuevo en español si aplica
function friendlyEditValue(fieldKey, value){
  if (value == null) return "";
  const raw = String(value);

  // Caso especial: DIR + isPathForward/isPathLeft/isPathRight
  if (fieldKey === "DIR" && DIR_VALUE_LABELS[raw]) {
    return DIR_VALUE_LABELS[raw];
  }

  return raw;
}

function describeEvent(ev){
  const tipoRaw = ev.tipo_accion || "";
  const tipo = String(tipoRaw).toUpperCase();

  const rawBlock = ev.tipo_bloque;
  const hasBlock = !!rawBlock;
  const bloque = friendlyBlockName(rawBlock);

  // Intentamos leer details_json (puede venir como objeto o string)
  let details = {};
  try {
    if (ev.details_json) {
      details = typeof ev.details_json === "string"
        ? JSON.parse(ev.details_json)
        : ev.details_json;
    }
  } catch {
    details = {};
  }

  switch (tipo) {
    // 1) Nuevo bloque
    case "NUEVO_BLOQUE":
      return hasBlock
        ? `Se arrastró un nuevo bloque "${bloque}" al área de trabajo.`
        : "Se arrastró un nuevo bloque al área de trabajo.";

    // 2) Movimiento de bloque
    case "MOVIMIENTO_BLOQUE":
      return hasBlock
        ? `Se movió el bloque "${bloque}" a otra posición dentro del área de trabajo.`
        : "Se movió un bloque a otra posición dentro del área de trabajo.";

    // 3) Conexión de bloques
    case "CONEXION_BLOQUE": {
      const con = (details && details.con) || {};
      const hijoRaw  = con.hijo_tipo_bloque  || rawBlock;
      const padreRaw = con.padre_tipo_bloque || null;

      const hijo  = friendlyBlockName(hijoRaw);
      const padre = padreRaw ? friendlyBlockName(padreRaw) : "otro bloque";

      return `Se conectó el bloque "${hijo}" al bloque "${padre}".`;
    }

    // 4) Eliminación de bloque
    case "ELIMINACION_BLOQUE":
      return hasBlock
        ? `Se eliminó el bloque "${bloque}" del área de trabajo.`
        : "Se eliminó un bloque del área de trabajo.";

    // 5) Edición de bloque (aquí usamos details_json.edit)
    case "EDICION_BLOQUE": {
      const edit = (details && details.edit) || {};
      const campoKey = edit && (edit.nombre || edit.elemento)
        ? String(edit.nombre || edit.elemento).trim()
        : "";
      const campo = friendlyEditField(edit);
      const oldVal = friendlyEditValue(campoKey, edit.old);
      const newVal = friendlyEditValue(campoKey, edit.new);

      // Ejemplo Maze:
      //   DIR: isPathForward -> isPathLeft
      // Texto:
      //   "cambiando la dirección de "adelante" a "a la izquierda"."
      if (oldVal && newVal && oldVal !== newVal) {
        return hasBlock
          ? `Se editó el bloque "${bloque}", cambiando ${campo} de "${oldVal}" a "${newVal}".`
          : `Se editó un bloque, cambiando ${campo} de "${oldVal}" a "${newVal}".`;
      }

      return hasBlock
        ? `Se editó el bloque "${bloque}".`
        : "Se editó un bloque.";
    }

    // Cualquier otro tipo que aparezca en el futuro
    default:
      return tipo
        ? (hasBlock
            ? `Se registró la acción "${tipo}" sobre el bloque "${bloque}".`
            : `Se registró la acción "${tipo}".`)
        : "Se registró una acción sobre un bloque.";
  }
}



// Muestra/oculta mensajes de estado (OK / error / vacío)
function show(el, text, cls){
  el.classList.remove("ok", "err");
  el.style.display = text ? "block" : "none";
  if (cls) el.classList.add(cls);
  el.textContent = text || "";
}

// Lee parámetros de la URL (ej. ?usuario_id=123)
function getParam(name){
  const u = new URL(location.href);
  return u.searchParams.get(name);
}


// ======================================================
// REFERENCIAS A ELEMENTOS DEL DOM
// ======================================================

// Topbar / header
const btnLogout   = q("#btnLogout");
const statusHeader = q("#statusHeader");
const playerName  = q("#playerName");
const playerPin   = q("#playerPin");
const chipSes     = q("#chipSesiones");
const chipUlt     = q("#chipUltima");

// KPIs overview (bloque "Resumen general")
const kpiNiveles  = q("#kpiNiveles");
const kpiIntentos = q("#kpiIntentos");
const kpiTpi      = q("#kpiTpi");
const kpiTps      = q("#kpiTps");
const kpiExito    = q("#kpiExito");
const kpiFallo    = q("#kpiFallo");
const kpiAband    = q("#kpiAband");

// Selectores y filtros del bloque de series por sesión
const fFrom        = q("#fFrom");
const fTo          = q("#fTo");
const btnFiltrarSes = q("#btnFiltrarSes");

// Selector de juego + KPIs por juego
const selJuego        = q("#selJuego");
const gjNivComp       = q("#gjNivComp");
const gjIntentos      = q("#gjIntentos");
const gjPromIntNivel  = q("#gjPromIntNivel");
const gjPromSegNivel  = q("#gjPromSegNivel");
const gjPromSegIntento = q("#gjPromSegIntento");
const gjPctExito      = q("#gjPctExito");
const gjPctFallo      = q("#gjPctFallo");
const gjPctAband      = q("#gjPctAband");

// Tabla de niveles por juego
const tbNiveles     = q("#tbNiveles");
const statusNiveles = q("#statusNiveles");

// Modales: intentos del nivel
const dlgAttempts     = q("#dlgAttempts");
const dlgLevelTitle   = q("#dlgLevelTitle");
const tbAttempts      = q("#tbAttempts");
const statusAttempts  = q("#statusAttempts");
const btnCloseAttempts = q("#btnCloseAttempts");
const btnPrevAtt      = q("#btnPrevAtt");
const btnNextAtt      = q("#btnNextAtt");
const lblPageAtt      = q("#lblPageAtt");

// Modales: eventos del intento
const dlgEvents      = q("#dlgEvents");
const dlgAttemptTitle = q("#dlgAttemptTitle");
const tbEvents       = q("#tbEvents");
const statusEvents   = q("#statusEvents");
const btnPrevEv      = q("#btnPrevEv");
const btnNextEv      = q("#btnNextEv");
const lblPageEv      = q("#lblPageEv");
const codeBox        = q("#codeBox");
const btnCloseEvents = q("#btnCloseEvents");

// Charts globales
let chartEstado, chartJuego, chartSesiones;

// Estado de paginación
let attemptsPage = { limit:20, offset:0, total:0, usuarioId:null, juegoId:null, nivelId:null };
let eventsPage   = { limit:50, offset:0, total:0, intentoId:null };


// ======================================================
// EVENTOS BÁSICOS DE LA INTERFAZ
// ======================================================

// Cierra sesión del investigador
btnLogout.addEventListener("click", () => {
  localStorage.removeItem(APPKEY);
  location.href = LOGIN_URL;
});

// Refiltra la serie por sesión según rango de fechas
btnFiltrarSes.addEventListener("click", () => loadSessionsSeries());

// Cambio de juego seleccionado -> refrescar KPIs + niveles
selJuego.addEventListener("change", () => loadGameSummaryAndLevels());

// Cerrar modal de intentos
btnCloseAttempts.addEventListener("click", () =>
  dlgAttempts.close?.() || dlgAttempts.removeAttribute("open")
);

// Navegación de páginas de intentos
btnPrevAtt.addEventListener("click", async () => {
  if (attemptsPage.offset <= 0) return;
  attemptsPage.offset = Math.max(attemptsPage.offset - attemptsPage.limit, 0);
  await loadAttemptsPage();
});

btnNextAtt.addEventListener("click", async () => {
  if (attemptsPage.offset + attemptsPage.limit >= attemptsPage.total) return;
  attemptsPage.offset += attemptsPage.limit;
  await loadAttemptsPage();
});

// Cerrar modal de eventos
btnCloseEvents.addEventListener("click", () =>
  dlgEvents.close?.() || dlgEvents.removeAttribute("open")
);

// Navegación de páginas de eventos (por si más adelante hay muchos)
btnPrevEv.addEventListener("click", async () => {
  if (eventsPage.offset <= 0) return;
  eventsPage.offset = Math.max(eventsPage.offset - eventsPage.limit, 0);
  await loadEventsPage();
});

btnNextEv.addEventListener("click", async () => {
  if (eventsPage.offset + eventsPage.limit >= eventsPage.total) return;
  eventsPage.offset += eventsPage.limit;
  await loadEventsPage();
});


// ======================================================
// INICIALIZACIÓN
// ======================================================

requireSession();  // valida que hay sesión de investigador

const usuarioId = getParam("usuario_id");
if (!usuarioId) {
  alert("Falta usuario_id en la URL.");
  location.href = "/views/dashboard.html";
  throw new Error("Sin usuario_id");
}

// Arranque del módulo
init();

async function init(){
  await loadIdentity();        // header del jugador
  await loadOverview();        // KPIs globales + charts globales
  await loadGames();           // catálogo de juegos + selección por defecto
  await loadSessionsSeries();  // serie por sesión (barras + línea)
}


// ======================================================
// CARGA DE DATOS DESDE EL BACKEND
// ======================================================

// Identidad básica del jugador (nombre, PIN, sesiones, última sesión)
async function loadIdentity(){
  show(statusHeader, "Cargando identidad…", "ok");
  const { data } = await authFetch(api.identity(usuarioId));

  playerName.textContent = data.jugador || "Jugador";
  playerPin.textContent  = `PIN ${data.pin ?? "—"}`;
  chipSes.textContent    = data.total_sesiones ?? 0;
  chipUlt.textContent    = fmtDate(data.ultima_sesion);

  show(statusHeader, "", "");
}

async function loadOverview(){
  const { data } = await authFetch(api.overview(usuarioId));

  // En muchos casos el backend ya viene como { kpis, intentos_por_juego, ... }
  const k = data.kpis || data || {};

  const totalIntentos = Number(
    k.intentos_totales ??
    k.total_intentos ??
    0
  );

  // ==========================
  // KPIs globales
  // ==========================
  kpiNiveles.textContent  = k.niveles_completados ?? 0;
  kpiIntentos.textContent = totalIntentos;

  kpiTpi.textContent = secToMmSs(k.seg_prom_por_intento);
  kpiTps.textContent = secToHhMmSs(k.seg_prom_por_sesion);

  const pctEx = Number(k.pct_intentos_exito    || 0);
  const pctFa = Number(k.pct_intentos_fallo    || 0);
  const pctAb = Number(k.pct_intentos_abandono || 0);

  const cntEx = countFromPct(totalIntentos, pctEx);
  const cntFa = countFromPct(totalIntentos, pctFa);
  const cntAb = countFromPct(totalIntentos, pctAb);

  kpiExito.textContent = `${cntEx} (${pct(pctEx)})`;
  kpiFallo.textContent = `${cntFa} (${pct(pctFa)})`;
  kpiAband.textContent = `${cntAb} (${pct(pctAb)})`;

  // Pastel global
  renderPieEstado([pctEx, pctFa, pctAb], totalIntentos);

  // ==========================
  // INTENTOS POR JUEGO
  // ==========================

  // 1) De dónde viene el arreglo de juegos en tu JSON
  const juegosRaw =
    data.intentos_por_juego   // nombre que tú comentaste
    || data.juegos
    || data.resumen_por_juego
    || data.rows
    || [];

  // Si quieres inspeccionar qué llega exactamente, descomenta:
  // console.log("overview juegosRaw:", juegosRaw);

  // 2) Labels (nombre del juego en el eje X)
  const juegosLabels = juegosRaw.map(r =>
    r.juego          // ej: { juego: "maze", ... }
    ?? r.nombre_juego
    ?? r.game_name
    ?? "Juego"
  );

  // Helper genérico para leer números con varios nombres posibles
  const pickNum = (row, keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null) {
        const v = Number(row[k]);
        if (!isNaN(v)) return v;
      }
    }
    return 0;
  };

  // 3) Para cada juego, primero intento leer conteos directos;
  //    si no existen, los calculo a partir de totales * porcentaje.

  const exitoJuego = juegosRaw.map(r => {
    // 3.1 Conteo directo si existe
    const direct = pickNum(r, [
      "intentos_exito_juego",
      "intentos_exito",
      "intentos_exitosos",
      "cnt_exito",
      "total_exito"
    ]);
    if (direct > 0) return direct;

    // 3.2 Fallback: total * porcentaje
    const totalJ = pickNum(r, [
      "intentos_totales_juego",
      "total_intentos_juego",
      "intentos_totales",
      "total_intentos"
    ]);
    const pctJ = pickNum(r, [
      "pct_exito_juego",
      "pct_intentos_exito_juego",
      "pct_exito"
    ]);
    if (totalJ > 0 && pctJ > 0) {
      return Math.round(totalJ * pctJ / 100);
    }
    return 0;
  });

  const falloJuego = juegosRaw.map(r => {
    const direct = pickNum(r, [
      "intentos_fallo_juego",
      "intentos_fallo",
      "intentos_fallidos",
      "cnt_fallo",
      "total_fallo"
    ]);
    if (direct > 0) return direct;

    const totalJ = pickNum(r, [
      "intentos_totales_juego",
      "total_intentos_juego",
      "intentos_totales",
      "total_intentos"
    ]);
    const pctJ = pickNum(r, [
      "pct_fallo_juego",
      "pct_intentos_fallo_juego",
      "pct_fallo"
    ]);
    if (totalJ > 0 && pctJ > 0) {
      return Math.round(totalJ * pctJ / 100);
    }
    return 0;
  });

  const abandJuego = juegosRaw.map(r => {
    const direct = pickNum(r, [
      "intentos_abandono_juego",
      "intentos_abandono",
      "intentos_abandonados",
      "cnt_abandono",
      "total_abandono"
    ]);
    if (direct > 0) return direct;

    const totalJ = pickNum(r, [
      "intentos_totales_juego",
      "total_intentos_juego",
      "intentos_totales",
      "total_intentos"
    ]);
    const pctJ = pickNum(r, [
      "pct_abandono_juego",
      "pct_intentos_abandono_juego",
      "pct_abandono"
    ]);
    if (totalJ > 0 && pctJ > 0) {
      return Math.round(totalJ * pctJ / 100);
    }
    return 0;
  });

  // 4) Si TODO está en cero pero sí hay intentos_totales_juego,
  //    uso los totales como fallback para que al menos se vea altura.
  const allZero =
    exitoJuego.every(v => v === 0) &&
    falloJuego.every(v => v === 0) &&
    abandJuego.every(v => v === 0);

  if (allZero) {
    const totales = juegosRaw.map(r =>
      pickNum(r, [
        "intentos_totales_juego",
        "total_intentos_juego",
        "intentos_totales",
        "total_intentos"
      ])
    );
    renderBarrasJuego(juegosLabels, totales, new Array(totales.length).fill(0), new Array(totales.length).fill(0));
  } else {
    renderBarrasJuego(juegosLabels, exitoJuego, falloJuego, abandJuego);
  }
}



// Serie de intentos por sesión + tiempo promedio (con filtros de fecha)
async function loadSessionsSeries(){
  const from = fFrom.value || null;
  const to   = fTo.value   || null;

  const { data } = await authFetch(api.sessionsSeries(usuarioId, from, to));

  // Extraemos arreglos por campo
  let labels = data.map(r => new Date(r.sesion_inicio).toLocaleDateString());
  let exito  = data.map(r => Number(r.intentos_exito           || 0));
  let fallo  = data.map(r => Number(r.intentos_fallo           || 0));
  let aband  = data.map(r => Number(r.intentos_abandono        || 0));
  let tpi    = data.map(r => Number(r.seg_prom_intento_sesion  || 0));

  // Para evitar gráficos ilegibles, limitamos a las últimas 50 sesiones
  const MAX = 50;
  if (labels.length > MAX) {
    const start = labels.length - MAX;
    labels = labels.slice(start);
    exito  = exito.slice(start);
    fallo  = fallo.slice(start);
    aband  = aband.slice(start);
    tpi    = tpi.slice(start);
  }

  renderSesiones(labels, exito, fallo, aband, tpi);
}

// Carga catálogo de juegos y selecciona uno por defecto (Maze si existe)
async function loadGames(){
  const { data } = await authFetch(api.games());

  selJuego.innerHTML = data
    .map(d => `<option value="${d.juego_id}">${d.juego}</option>`)
    .join("");

  // Preferimos "maze" si está disponible, si no, el primero.
  const maze = [...selJuego.options]
    .find(o => o.textContent.toLowerCase().includes("maze"));
  selJuego.value = maze ? maze.value : selJuego.options[0]?.value;

  await loadGameSummaryAndLevels();
}

// KPIs y niveles del juego actualmente seleccionado
async function loadGameSummaryAndLevels(){
  const juegoId = selJuego.value;

  // Resumen del juego + lista de niveles en paralelo
  const [{ data: gj }, { data: lv }] = await Promise.all([
    authFetch(api.gameSummary(usuarioId, juegoId)),
    authFetch(api.gameLevels(usuarioId, juegoId))
  ]);

  const niveles = lv || [];
  const totalIntentosJuego = gj?.intentos_totales_juego ?? 0;

  // 1) Niveles completados (solo de este juego)
  const nivelesCompletados = niveles
    .filter(r => (r.estado || "").toString().toUpperCase() === "COMPLETADO")
    .length;
  gjNivComp.textContent = nivelesCompletados;

  // 2) Intentos totales del juego
  gjIntentos.textContent = totalIntentosJuego;

  // 3) Promedio de intentos por nivel
  gjPromIntNivel.textContent = num(gj?.prom_intentos_por_nivel);

  // 4) Promedio de tiempo por nivel (hh:mm:ss)
  gjPromSegNivel.textContent = secToHhMmSs(gj?.seg_prom_nivel_hasta_completar);

  // 5) Promedio de tiempo por intento (mm:ss)
  gjPromSegIntento.textContent = secToMmSs(gj?.seg_prom_intento_juego);

  // 6–8) % éxito / fallo / abandono + cantidades
  const pctEx = Number(gj?.pct_exito_juego    || 0);
  const pctFa = Number(gj?.pct_fallo_juego    || 0);
  const pctAb = Number(gj?.pct_abandono_juego || 0);

  const cntEx = countFromPct(totalIntentosJuego, pctEx);
  const cntFa = countFromPct(totalIntentosJuego, pctFa);
  const cntAb = countFromPct(totalIntentosJuego, pctAb);

  gjPctExito.textContent = `${cntEx} (${pct(pctEx)})`;
  gjPctFallo.textContent = `${cntFa} (${pct(pctFa)})`;
  gjPctAband.textContent = `${cntAb} (${pct(pctAb)})`;

  // Tabla de niveles del juego
  renderLevelsTable(niveles);
}


// ======================================================
// GRÁFICAS (CHART.JS)
// ======================================================

// Pastel global de distribución por estado
function renderPieEstado(values, totalIntentos){
  if (chartEstado) chartEstado.destroy();

  const labels = ['Éxito', 'Fallo', 'Abandono'];

  chartEstado = new Chart(document.getElementById("chartEstado"), {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        // Los valores que recibe son porcentajes (ej. 9.86, 35.21, etc.)
        data: values,
        backgroundColor: [
          CHART_COLORS.exito,
          CHART_COLORS.fallo,
          CHART_COLORS.aband
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins:{
        legend:{
          position:'bottom',
          labels:{ color:'#e8edf7', font:{ size:11 } }
        },
        tooltip:{
          callbacks:{
            // Tooltip: "Éxito: 7 intentos (9.86%)"
            label(context){
              const i     = context.dataIndex;
              const label = labels[i] || '';
              const pctVal = Number(context.parsed) || 0;
              const count = countFromPct(totalIntentos, pctVal);
              return `${label}: ${count} intentos (${pctVal.toFixed(2)}%)`;
            }
          }
        }
      }
    }
  });
}

// Barras apiladas de intentos por juego
function renderBarrasJuego(labels, exito, fallo, aband){
  if (chartJuego) chartJuego.destroy();

  // Totales por juego (para usar en el footer del tooltip)
  const totals = labels.map((_, i) =>
    (exito[i] || 0) + (fallo[i] || 0) + (aband[i] || 0)
  );

  chartJuego = new Chart(document.getElementById("chartJuego"), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Éxito',
          data: exito,
          backgroundColor: CHART_COLORS.exito,
          stack: 'juegos',
          maxBarThickness: 28,
          categoryPercentage: 0.6,
          barPercentage: 0.9
        },
        {
          type: 'bar',
          label: 'Fallo',
          data: fallo,
          backgroundColor: CHART_COLORS.fallo,
          stack: 'juegos',
          maxBarThickness: 28,
          categoryPercentage: 0.6,
          barPercentage: 0.9
        },
        {
          type: 'bar',
          label: 'Aband.',
          data: aband,
          backgroundColor: CHART_COLORS.aband,
          stack: 'juegos',
          maxBarThickness: 28,
          categoryPercentage: 0.6,
          barPercentage: 0.9
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#e8edf7', font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            // Cada barra: "Éxito: 10 intentos"
            label(ctx) {
              const v = ctx.parsed.y || 0;
              const label = ctx.dataset.label || '';
              return `${label}: ${v} intentos`;
            },
            // Footer: "Total: 20 intentos — Éxito 50.0%, Fallo 30.0%, Aband. 20.0%"
            footer(items) {
              if (!items.length) return '';
              const idx = items[0].dataIndex;
              const total = totals[idx] || 0;
              if (!total) return `Total: 0 intentos`;

              const ex = exito[idx] || 0;
              const fa = fallo[idx] || 0;
              const ab = aband[idx] || 0;

              const pctEx = (ex * 100 / total).toFixed(1);
              const pctFa = (fa * 100 / total).toFixed(1);
              const pctAb = (ab * 100 / total).toFixed(1);

              return `Total: ${total} intentos — Éxito ${pctEx}%, Fallo ${pctFa}%, Aband. ${pctAb}%`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: '#e8edf7', font: { size: 11 } },
          grid: { display: false }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { color: '#e8edf7', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,.08)' },
          title: {
            display: true,
            text: 'Intentos por juego',
            color: '#e8edf7',
            font: { size: 11 }
          }
        }
      }
    }
  });
}

// Gráfico combinado por sesión: barras apiladas + línea de tiempo promedio
function renderSesiones(labels, exito, fallo, aband, tpi){
  if (chartSesiones) chartSesiones.destroy();

  chartSesiones = new Chart(document.getElementById("chartSesiones"), {
    data: {
      labels,
      datasets: [
        {
          type:'bar',
          label:'Éxito',
          data: exito,
          backgroundColor: CHART_COLORS.exito,
          stack:'int',
          maxBarThickness: 22,
          categoryPercentage:0.7,
          barPercentage:0.9
        },
        {
          type:'bar',
          label:'Fallo',
          data: fallo,
          backgroundColor: CHART_COLORS.fallo,
          stack:'int',
          maxBarThickness: 22,
          categoryPercentage:0.7,
          barPercentage:0.9
        },
        {
          type:'bar',
          label:'Aband.',
          data: aband,
          backgroundColor: CHART_COLORS.aband,
          stack:'int',
          maxBarThickness: 22,
          categoryPercentage:0.7,
          barPercentage:0.9
        },
        {
          type:'line',
          label:'Tiempo promedio / intento',
          data: tpi,
          borderColor: CHART_COLORS.line,
          yAxisID:'y1',
          tension:0.25,
          pointRadius:2,
          pointHitRadius:6
        }
      ]
    },
    options:{
      responsive: true,
      maintainAspectRatio: false,
      plugins:{
        legend:{
          position:'bottom',
          labels:{ color:'#e8edf7', font:{ size:11 } }
        },
        tooltip:{
          callbacks:{
            label(context){
              const ds  = context.dataset;
              const val = context.parsed.y;

              // Línea -> tiempo promedio mm:ss
              if (ds.type === 'line') {
                return `${ds.label}: ${secToMmSs(val)}`;
              }

              // Barras -> cantidad de intentos
              return `${ds.label}: ${val} intentos`;
            }
          }
        }
      },
      scales:{
        x:{
          stacked:true,
          ticks:{
            color:'#e8edf7',
            font:{ size:10 },
            maxRotation:0,
            autoSkip:true,
            maxTicksLimit:12
          },
          grid:{ display:false }
        },
        y:{
          stacked:true,
          beginAtZero:true,
          ticks:{ color:'#e8edf7', font:{ size:11 } },
          grid:{ color:'rgba(255,255,255,.08)' },
          title:{
            display:true,
            text:'Intentos',
            color:'#e8edf7',
            font:{ size:11 }
          }
        },
        y1:{
          position:'right',
          grid:{ drawOnChartArea:false },
          ticks:{
            color:'#e8edf7',
            font:{ size:11 },
            callback: (value) => secToMmSs(value)
          },
          title:{
            display:true,
            text:'Tiempo promedio / intento (mm:ss)',
            color:'#e8edf7',
            font:{ size:11 }
          }
        }
      }
    }
  });
}


// ======================================================
// RENDER DE TABLAS Y MODALES
// ======================================================

// Tabla de niveles del juego seleccionado
function renderLevelsTable(rows){
  tbNiveles.innerHTML = (rows || []).map(r => `
    <tr>
      <!-- 1. Nivel -->
      <td class="col-nivel">${r.nivel ?? '—'}</td>

      <!-- 2. Estado con etiqueta de color -->
      <td>${renderEstadoPill(r.estado)}</td>

      <!-- 3. Tiempo acumulado (mm:ss) -->
      <td>${secToMmSs(r.tiempo_acumulado_seg ?? 0)}</td>

      <!-- 4. Promedio tiempo por intento (mm:ss) -->
      <td>${secToMmSs(r.seg_prom_por_intento ?? 0)}</td>

      <!-- 5. Primer intento -->
      <td>${fmtDateShort(r.fecha_primer_intento)}</td>

      <!-- 6. Último intento -->
      <td>${fmtDateShort(r.fecha_ultimo_intento)}</td>

      <!-- 7. Intentos totales por nivel -->
      <td class="col-intentos">${r.intentos_totales ?? 0}</td>

      <!-- 8. Acción: abre modal de intentos -->
      <td>
        <button class="btn btn-ghost btn-sm" data-cta="ver" data-nivel="${r.nivel_id}">
          Ver intentos
        </button>
      </td>
    </tr>
  `).join("");

  // Click en "Ver intentos" -> abre modal de intentos
  tbNiveles.querySelectorAll("button[data-cta='ver']").forEach(btn => {
    btn.addEventListener("click", () =>
      openAttemptsModal(Number(btn.dataset.nivel))
    );
  });

  show(statusNiveles, rows?.length ? "" : "Sin actividad en los niveles.", "");
}


// ---------- Modal: intentos del nivel ----------

// Abre el modal de intentos para un nivel específico
async function openAttemptsModal(nivelId){
  attemptsPage = {
    ...attemptsPage,
    offset:0,
    usuarioId,
    juegoId: selJuego.value,
    nivelId
  };

  await loadAttemptsPage();
  dlgLevelTitle.textContent = `#${nivelId}`;
  dlgAttempts.showModal?.() || dlgAttempts.setAttribute("open", "");
}

// Carga una página de intentos para el nivel actual
async function loadAttemptsPage(){
  show(statusAttempts, "Cargando intentos…", "ok");

  const { data } = await authFetch(
    api.attempts(
      attemptsPage.usuarioId,
      attemptsPage.juegoId,
      attemptsPage.nivelId,
      attemptsPage.limit,
      attemptsPage.offset
    )
  );

  attemptsPage.total = data.total || 0;

  renderAttempts(data.items || []);

  const page  = Math.floor(attemptsPage.offset / attemptsPage.limit) + 1;
  const pages = Math.max(Math.ceil(attemptsPage.total / attemptsPage.limit), 1);
  lblPageAtt.textContent = `${page}/${pages}`;

  show(
    statusAttempts,
    attemptsPage.total ? "" : "No hay intentos en este nivel.",
    ""
  );
}

// Dibuja las filas de intentos dentro del modal
function renderAttempts(items){
  tbAttempts.innerHTML = (items || []).map((r, i) => {
    // Número consecutivo del intento dentro del nivel (considerando paginación)
    const numIntento = attemptsPage.offset + i + 1;

    return `
      <tr>
        <!-- # consecutivo en la tabla -->
        <td>${numIntento}</td>

        <!-- Estado del intento -->
        <td>${renderEstadoPill(r.estado)}</td>

        <!-- Duración del intento (mm:ss) -->
        <td>${secToMmSs(r.seg_duracion_intento ?? 0)}</td>

        <!-- Bloques utilizados en el intento -->
        <td>${r.bloques_total ?? 0}</td>

        <!-- Fecha y hora del intento -->
        <td>${fmtDateShort(r.fecha_intento)}</td>

        <!-- Acción: ver secuencia de eventos + código generado -->
        <td>
          <button
            class="btn btn-ghost btn-sm"
            data-ev="${r.intento_id}"
            data-idx="${numIntento}"
            data-code="${encodeURIComponent(r.codigo_js || '')}"
          >
            Eventos / Código
          </button>
        </td>
      </tr>
    `;
  }).join("");

  // Botones "Eventos / Código"
  tbAttempts.querySelectorAll("button[data-ev]").forEach(b => {
    b.addEventListener("click", () =>
      openEventsModal(
        Number(b.dataset.ev),                     // intento_id real
        decodeURIComponent(b.dataset.code),       // código JS
        Number(b.dataset.idx)                     // número de intento dentro del nivel
      )
    );
  });
}



// Abre el modal de eventos para un intento concreto
async function openEventsModal(intentoId, codigoJs, intentoNumero){
  // Reiniciamos la paginación de eventos para este intento
  eventsPage = { ...eventsPage, offset: 0, intentoId };

  // En el encabezado mostramos el número de intento dentro del nivel
  const numero = intentoNumero ?? intentoId;
  dlgAttemptTitle.textContent = `#${numero}`;

  // Código generado por Blockly
  codeBox.textContent = (codigoJs || "").trim() || "—";

  await loadEventsPage();
  dlgEvents.showModal?.() || dlgEvents.setAttribute("open", "");
}


// Carga una página de eventos del intento actual
async function loadEventsPage(){
  show(statusEvents, "Cargando eventos…", "ok");

  const { data } = await authFetch(
    api.events(eventsPage.intentoId, eventsPage.limit, eventsPage.offset)
  );

  eventsPage.total = data.total || 0;

  renderEvents(data.items || []);

  const page  = Math.floor(eventsPage.offset / eventsPage.limit) + 1;
  const pages = Math.max(Math.ceil(eventsPage.total / eventsPage.limit), 1);
  lblPageEv.textContent = `${page}/${pages}`;

  show(
    statusEvents,
    eventsPage.total ? "" : "Sin eventos registrados para este intento.",
    ""
  );
}

// Construye la tabla de eventos con frases legibles
function renderEvents(items){
  tbEvents.innerHTML = (items || []).map(r => {
    const fecha = fmtDateShort(r.timestamp_evento);
    return `
      <tr title="${fecha}">
        <!-- # de orden dentro del intento -->
        <td>${r.n_orden}</td>

        <!-- Descripción narrativa del evento -->
        <td>${describeEvent(r)}</td>
      </tr>
    `;
  }).join("");
}


