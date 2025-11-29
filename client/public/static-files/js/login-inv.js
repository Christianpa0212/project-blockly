// ===============================
// Configuración
// ===============================
const API_LOGIN = "/auth/login-inv";
const APPKEY = "blocklygames";
const DASHBOARD_URL = "/views/dashboard.html";
const PIN_RE = /^\d{4}$/;

// ===============================
// Helpers DOM
// ===============================
const $ = (s) => document.querySelector(s);
const pinInputs = [...document.querySelectorAll("#pinGroupInv input")];
const passInput = $("#passwordInv");
const form = $("#formLoginInv");
const btn = $("#btnLoginInv");
const msgErr = $("#msgErrorInv");
const msgOk = $("#msgOkInv");

const getPin = (inputs) => inputs.map((i) => i.value).join("");

function clearMsgs() {
  msgErr.style.display = "none";
  msgOk.style.display = "none";
}
function showErr(text) {
  msgOk.style.display = "none";
  msgErr.textContent = text;
  msgErr.style.display = "block";
}
function showOk(text) {
  msgErr.style.display = "none";
  msgOk.textContent = text;
  msgOk.style.display = "block";
}

// ===============================
// UX: Autofocus por dígito PIN
// ===============================
pinInputs.forEach((input, i) => {
  input.addEventListener("input", () => {
    if (input.value && i < pinInputs.length - 1) pinInputs[i + 1].focus();
  });
});

// Enter en password envía el form
passInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") form.requestSubmit();
});

// ===============================
// Envío de login (PIN + password)
// ===============================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMsgs();

  const pin = getPin(pinInputs);
  const password = (passInput.value || "").trim();

  if (!PIN_RE.test(pin)) return showErr("PIN inválido (debe ser 4 dígitos).");
  if (!password) return showErr("La contraseña es requerida.");

  btn.disabled = true;
  showOk("Validando credenciales…");

  // Helper para leer JSON o mostrar HTML de error
  const toJsonSafe = async (res) => {
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const text = await res.text();
      throw new Error("Respuesta no válida del servidor.");
    }
    return res.json();
  };

  try {
    const res = await fetch(API_LOGIN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, password })
    });

    const data = await toJsonSafe(res);
    if (!res.ok || !data?.ok || !data?.sesion_id) {
      throw new Error(data?.msg || "No fue posible iniciar sesión.");
    }

    // Guardamos sesión para llamadas protegidas
    const state = JSON.parse(localStorage.getItem(APPKEY) || "{}");
    state.sesion_id = data.sesion_id;
    state.rol = "investigador";
    localStorage.setItem(APPKEY, JSON.stringify(state));

    showOk("Sesión iniciada. Redirigiendo…");
    setTimeout(() => (location.href = DASHBOARD_URL), 500);
  } catch (err) {
    showErr(err.message || "Error de red o servidor.");
  } finally {
    btn.disabled = false;
  }
});
