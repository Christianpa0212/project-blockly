// ===============================
// Config
// ===============================
const APPKEY = "blocklygames";
const API_PLAYERS  = "/investigator/research/players";    
const API_REGISTER = "/user/register-player";  
const API_PASS     = "/user/change-password-investigator"; 
const LOGIN_URL = "/views/login-inv.html";
const PLAYER_URL = (id) => `/views/player.html?usuario_id=${encodeURIComponent(id)}`;
const PIN_RE = /^\d{4}$/;

// ===============================
// Helpers de sesión y fetch
// ===============================
function getState(){
  try { return JSON.parse(localStorage.getItem(APPKEY) || "{}"); } catch { return {}; }
}
function requireSession(){
  const s = getState();
  if (!s?.sesion_id || s?.rol !== "investigador") {
    location.href = LOGIN_URL;
    throw new Error("Sin sesión");
  }
  return s;
}
async function authFetch(url, opts = {}){
  const { sesion_id } = requireSession();
  const headers = new Headers(opts.headers || {});
  headers.set("Authorization", `Bearer ${sesion_id}`);
  if (!headers.has("Content-Type") && (opts.method && opts.method !== "GET")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...opts, headers });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : null;
  return { res, data };
}
function fmtDate(d){
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleString();
}
function q(sel){ return document.querySelector(sel); }
function show(el, text, cls){
  el.classList.remove("ok","err");
  el.style.display = text ? "block" : "none";
  if (cls) el.classList.add(cls);
  el.textContent = text || "";
}

// ===============================
// DOM refs
// ===============================
const btnNewInvestigator = q("#btnNewInvestigator");
const btnChangePass = q("#btnChangePass");
const btnLogout = q("#btnLogout");
const txtSearch = q("#txtSearch");
const playersStatus = q("#playersStatus");
const tbody = q("#playersTbody");

// Modal: nuevo investigador
const dlg = q("#dlgInvestigator");
const form = q("#formInvestigator");
const invPin = q("#invPin");
const invNombre = q("#invNombre");
const invApellidos = q("#invApellidos");
const invPassword = q("#invPassword");
const invMsg = q("#invMsg");
const btnCancel = q("#btnCancel");
const btnSave = q("#btnSave");

// Modal: cambiar contraseña
const dlgPass = q("#dlgChangePass");
const formPass = q("#formChangePass");
const curPass = q("#curPass");
const newPass = q("#newPass");
const newPass2 = q("#newPass2");
const passMsg = q("#passMsg");
const btnPassCancel = q("#btnPassCancel");
const btnPassSave = q("#btnPassSave");

// ===============================
// Init UI
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  try { if (dlg.open) dlg.close(); } catch(e) {}
  try { if (dlgPass.open) dlgPass.close(); } catch(e) {}
});

// Abrir modal: nuevo investigador
btnNewInvestigator.addEventListener("click", () => {
  invPin.value = invNombre.value = invApellidos.value = invPassword.value = "";
  show(invMsg, "",""); 
  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "");
  invPin.focus();
});

// Cerrar modal: nuevo investigador
btnCancel.addEventListener("click", () => {
  if (dlg.open && typeof dlg.close === "function") dlg.close();
  else dlg.removeAttribute("open");
});
dlg.addEventListener("click", (e) => {
  if (e.target === dlg) {
    if (dlg.open && typeof dlg.close === "function") dlg.close();
    else dlg.removeAttribute("open");
  }
});

// Abrir modal: cambiar contraseña
btnChangePass.addEventListener("click", () => {
  curPass.value = newPass.value = newPass2.value = "";
  show(passMsg, "", "");
  if (typeof dlgPass.showModal === "function") dlgPass.showModal();
  else dlgPass.setAttribute("open", "");
  curPass.focus();
});

// Cerrar modal: cambiar contraseña
btnPassCancel.addEventListener("click", () => {
  if (dlgPass.open && typeof dlgPass.close === "function") dlgPass.close();
  else dlgPass.removeAttribute("open");
});
dlgPass.addEventListener("click", (e) => {
  if (e.target === dlgPass) {
    if (dlgPass.open && typeof dlgPass.close === "function") dlgPass.close();
    else dlgPass.removeAttribute("open");
  }
});

// Fallback: cerrar con Esc cuando se usa atributo [open]
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (dlg.hasAttribute("open") && !dlg.open) dlg.removeAttribute("open");
    if (dlgPass.hasAttribute("open") && !dlgPass.open) dlgPass.removeAttribute("open");
  }
});

// Logout
btnLogout.addEventListener("click", () => {
  // opcional: llamar /session/end
  localStorage.removeItem(APPKEY);
  location.href = LOGIN_URL;
});

// ===============================
// Registrar investigador (POST protegido)
// ===============================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  show(invMsg, "", "");
  const pin = (invPin.value || "").trim();
  const nombre = (invNombre.value || "").trim();
  const apellidos = (invApellidos.value || "").trim();
  const password = (invPassword.value || "").trim();

  if (!PIN_RE.test(pin)) return show(invMsg, "PIN inválido (4 dígitos).", "err");
  if (!nombre || !apellidos) return show(invMsg, "Nombre y apellidos requeridos.", "err");
  if (!password || password.length < 8) return show(invMsg, "Password mínimo 8 caracteres.", "err");

  btnSave.disabled = true;
  try{
    const { res, data } = await authFetch(API_REGISTER, {
      method: "POST",
      body: JSON.stringify({ pin, nombre, apellidos, password })
    });
    if (!res.ok || !data?.ok) throw new Error(data?.msg || "No se pudo crear el investigador.");
    show(invMsg, "Investigador creado con éxito.", "ok");
    setTimeout(()=> {
      if (dlg.open && typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }, 700);
  }catch(err){
    show(invMsg, err.message || "Error de red o servidor.", "err");
  }finally{
    btnSave.disabled = false;
  }
});

// ===============================
// Cambiar contraseña (POST protegido)
// ===============================
formPass.addEventListener("submit", async (e) => {
  e.preventDefault();
  show(passMsg, "", "");

  const a = (curPass.value || "").trim();
  const b = (newPass.value || "").trim();
  const c = (newPass2.value || "").trim();

  if (!a) return show(passMsg, "La contraseña actual es requerida.", "err");
  if (!b || b.length < 8) return show(passMsg, "La nueva contraseña debe tener mínimo 8 caracteres.", "err");
  if (b !== c) return show(passMsg, "La confirmación no coincide.", "err");

  btnPassSave.disabled = true;
  try{
    const { res, data } = await authFetch(API_PASS, {
      method: "POST",
      body: JSON.stringify({ password_actual: a, password_nueva: b })
    });
    if (!res.ok || !data?.ok) throw new Error(data?.msg || "No se pudo actualizar la contraseña.");
    show(passMsg, "Contraseña actualizada.", "ok");
    setTimeout(()=> {
      if (dlgPass.open && typeof dlgPass.close === "function") dlgPass.close();
      else dlgPass.removeAttribute("open");
    }, 700);
  }catch(err){
    show(passMsg, err.message || "Error de red o servidor.", "err");
  }finally{
    btnPassSave.disabled = false;
  }
});

// ===============================
// Cargar jugadores (GET /research/players)
// ===============================
async function loadPlayers(){
  show(playersStatus, "Cargando jugadores…", "ok");
  try{
    const { res, data } = await authFetch(API_PLAYERS);
    if (!res.ok || !data?.ok) throw new Error(data?.msg || "No se pudo cargar la lista.");
    const rows = data.data || [];
    renderPlayers(rows);
    show(playersStatus, rows.length ? "" : "No hay jugadores registrados por ahora.", "");
  }catch(err){
    show(playersStatus, err.message || "No se pudo cargar la lista.", "err");
  }
}

function renderPlayers(rows){
  tbody.innerHTML = rows.map(r => {
    const nombre = `${r.nombre || ""} ${r.apellidos || ""}`.trim() || "—";
    const sesiones = r.total_sesiones ?? 0;
    const ultima = r.ultima_sesion ? fmtDate(r.ultima_sesion) : "—";

    const nivelesCompletados = r.niveles_completados ?? 0;
    const totalNiveles = r.total_niveles ?? 0;
    const nivelesLabel = totalNiveles
      ? `${nivelesCompletados}/${totalNiveles}`
      : `${nivelesCompletados}`;

    return `
      <tr>
        <td><code>${r.pin || "—"}</code></td>
        <td>${nombre}</td>
        <td>${nivelesLabel}</td>
        <td>${sesiones}</td>
        <td>${ultima}</td>
        <td>
          <button class="btn btn-ghost btn-sm" data-user="${r.usuario_id}">Ver estadísticas</button>
        </td>
      </tr>`;
  }).join("");

  tbody.querySelectorAll("button[data-user]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-user");
      location.href = PLAYER_URL(id);
    });
  });
}


// Buscar en tabla
txtSearch.addEventListener("input", () => {
  const qv = txtSearch.value.toLowerCase().trim();
  [...tbody.querySelectorAll("tr")].forEach(tr => {
    const txt = tr.textContent.toLowerCase();
    tr.style.display = txt.includes(qv) ? "" : "none";
  });
});

// ===============================
// Init
// ===============================
requireSession(); // redirige si no hay sesión o rol incorrecto
loadPlayers();
