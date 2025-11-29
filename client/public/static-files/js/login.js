// ===============================
// Configuración general
// ===============================
const API = {
  startSession: "/auth/login-play",
  register: "/user/register-player"
};

const PIN_RE = /^\d{4}$/;
const APPKEY = "blocklygames";

// ===============================
// Elementos del login principal
// ===============================
const pinInputs = [...document.querySelectorAll("#pinGroup input")];
const msgErr = document.getElementById("msgError");
const msgOk = document.getElementById("msgOk");
const btnSubmit = document.getElementById("btnSubmit");

// ===============================
// Funciones auxiliares generales
// ===============================
const getPin = (inputs) => inputs.map((i) => i.value).join("");
const showError = (msg, target = msgErr, okTarget = msgOk) => {
  okTarget.style.display = "none";
  target.textContent = msg;
  target.style.display = "block";
};
const showOk = (msg, target = msgOk, errTarget = msgErr) => {
  errTarget.style.display = "none";
  target.textContent = msg;
  target.style.display = "block";
};
const clearMessages = () => {
  msgErr.style.display = "none";
  msgOk.style.display = "none";
};

// ===============================
// Lógica de inicio de sesión
// ===============================
document.getElementById("formLogin").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessages();

  const pin = getPin(pinInputs);
  if (!PIN_RE.test(pin)) return showError("PIN inválido (4 dígitos)");

  btnSubmit.disabled = true;
  showOk("Iniciando sesión…");

  // Helper para parsear JSON solo si el server envía JSON
  const toJsonSafe = async (res) => {
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const text = await res.text(); // útil para depurar HTML de error
      throw new Error("Respuesta no-JSON del servidor: " + text.slice(0, 120));
    }
    return res.json();
  };

  try {
    // ÚNICA llamada: el backend acepta { pin } en /session/start
    const res = await fetch(API.startSession, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin })
    });

    const data = await toJsonSafe(res);
    if (!res.ok || !data.ok || !data.sesion_id || !data.usuario) {
      throw new Error(data.error || "No se pudo iniciar sesión.");
    }

    const { usuario } = data;

    // Guarda la sesión
    localStorage.setItem(APPKEY, JSON.stringify({
      usuario_id: usuario.usuario_id,
      sesion_id: data.sesion_id,
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      pin: usuario.pin
    }));

    showOk(`¡Bienvenido ${usuario.nombre}!`);
    setTimeout(() => (location.href = "../views/index.html"), 800);

  } catch (err) {
    showError(err.message);
  } finally {
    btnSubmit.disabled = false;
  }
});



// ===============================
// Modal de registro
// ===============================
const modal = document.getElementById("modalRegister");
const formRegister = document.getElementById("formRegister");
const msgRegError = document.getElementById("msgRegError");
const msgRegOk = document.getElementById("msgRegOk");
const btnRegister = document.getElementById("btnRegister");
const btnCancel = document.getElementById("btnCancelRegister");
const regInputs = [...document.querySelectorAll("#regPinGroup input")];

// Mostrar modal de registro
document.getElementById("btnCreate").onclick = () => {
  modal.classList.remove("hidden");
  formRegister.reset();
  msgRegError.style.display = "none";
  msgRegOk.style.display = "none";
};

// Cerrar modal (cancelar)
btnCancel.onclick = () => {
  modal.classList.add("hidden");
};

// ===============================
// Registro de nuevo jugador
// ===============================
formRegister.addEventListener("submit", async (e) => {
  e.preventDefault();
  msgRegError.style.display = "none";
  msgRegOk.style.display = "none";

  const nombre = document.getElementById("regNombre").value.trim();
  const apellidos = document.getElementById("regApellidos").value.trim();
  const fecha_nac = document.getElementById("regFecha").value;
  const pin = getPin(regInputs);

  if (!PIN_RE.test(pin)) return showError("PIN inválido", msgRegError, msgRegOk);
  if (!nombre || !apellidos || !fecha_nac)
    return showError("Todos los campos son obligatorios", msgRegError, msgRegOk);

  btnRegister.disabled = true;
  showOk("Registrando jugador…", msgRegOk, msgRegError);

  try {
    const res = await fetch(API.register, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, nombre, apellidos, fecha_nac })
    });

    const data = await res.json();
    if (!res.ok || !data.ok)
      throw new Error(data.error || "Error al registrar jugador");

    showOk("Jugador registrado correctamente", msgRegOk, msgRegError);

    // Cerrar modal automáticamente después de 1.5s
    setTimeout(() => {
      modal.classList.add("hidden");
      formRegister.reset();
    }, 1500);
  } catch (err) {
    showError(err.message, msgRegError, msgRegOk);
  } finally {
    btnRegister.disabled = false;
  }
});

// ===============================
// UX: Navegación y accesibilidad
// ===============================

// Autofoco automático en inputs PIN (login)
pinInputs.forEach((input, i) => {
  input.addEventListener("input", () => {
    if (input.value && i < pinInputs.length - 1) pinInputs[i + 1].focus();
  });
});

// Autofoco en registro PIN (modal)
regInputs.forEach((input, i) => {
  input.addEventListener("input", () => {
    if (input.value && i < regInputs.length - 1) regInputs[i + 1].focus();
  });
});

// Cerrar modal con tecla ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.classList.contains("hidden")) {
    modal.classList.add("hidden");
  }
});

// Cerrar modal al hacer clic fuera (overlay)
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.classList.add("hidden");
  }
});
