// Al cargar la página del Maze, se valida la sesión y se inicia un intento en el backend.
window.addEventListener("load", () => {
  // 1) Leer la sesión del jugador guardada en localStorage
  let sesion = null;
  try {
    sesion = JSON.parse(localStorage.getItem("blocklygames") || "null");
  } catch {
    sesion = null;
  }

  // 2) Si no hay sesión válida, avisar y redirigir al login
  if (!sesion || !sesion.sesion_id) {
    alert("No hay sesión activa. Redirigiendo...");
    // login.html está dentro de /views
    location.href = "/views/login.html";
    return;
  }

  // 3) Tomar el nivel actual desde la URL (?level=1). Si no viene, usar 1.
  const params = new URLSearchParams(window.location.search);
  const nivel_id = parseInt(params.get("level"), 10) || 1;

  // 4) Datos que requiere el backend para iniciar el intento
  const datos = {
    sesion_id: sesion.sesion_id,
    juego_id: 1,     // ID del juego 'maze' en BD
    nivel_id: nivel_id,
  };

  console.log("📤 Enviando datos de inicio:", datos);

  // 5) Llamar a /player/try/start; si responde OK, guardar intento_id y flags
  fetch("/player/try/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // necesario para pasar por requirePlayerAuth
      "Authorization": `Bearer ${sesion.sesion_id}`,
    },
    body: JSON.stringify(datos),
  })
    .then(async (r) => {
      const data = await r.json().catch(() => null);
      if (!r.ok || !data || data.ok === false) {
        throw new Error(data && data.error ? data.error : "Error al iniciar intento");
      }
      return data;
    })
    .then((res) => {
      console.log("Intento iniciado:", res.intento_id);
      localStorage.setItem("intento_id", res.intento_id);
      window.TRY_STATUS = "open";   // open|paused|closed|abandoned
      window.SKIP_ABANDON = false;
    })
    .catch((err) => {
      console.error("Error al iniciar intento:", err);
    });
});
