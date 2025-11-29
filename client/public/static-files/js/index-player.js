const APPKEY = 'blocklygames';
const JUEGO_ID_MAZE = 1;
const JUEGO_ID_BIRD = 2;

// Endpoint correcto, montado en /player
const NEXT_LEVEL_URL = '/player/progress/next';

// ==============================
// Sesión
// ==============================
function readSession() {
  try { return JSON.parse(localStorage.getItem(APPKEY) || 'null'); }
  catch { return null; }
}

let session = readSession();

if (!session || !session.sesion_id || !session.usuario_id) {
  // index.html está en /views, login también
  location.replace('./login.html');
} else {
  const full = [session.nombre, session.apellidos].filter(Boolean).join(' ');
  document.getElementById('userFullname').textContent = full || `Jugador ${session.usuario_id}`;
  document.getElementById('pinBadge').textContent = `PIN: ${session.pin || '—'}`;
}

// ==============================
// Navegar a Maze
// ==============================
async function goMaze() {
  try {
    if (!session?.sesion_id) return location.replace('./login.html');

    const params = new URLSearchParams({
      sesion_id: session.sesion_id,
      juego_id: JUEGO_ID_MAZE.toString(),
    });

    const res = await fetch(`${NEXT_LEVEL_URL}?${params.toString()}`, {
      headers: {
        // Necesario para requirePlayerAuth en /player/*
        Authorization: `Bearer ${session.sesion_id}`,
      },
    });

    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json')
      ? await res.json()
      : { ok: false, error: 'Respuesta no-JSON' };

    if (!res.ok || data.ok === false) {
      throw new Error(data.error || 'No se pudo resolver el nivel');
    }

    const level = data.nivel_id || 1;
    location.href = `../maze.html?lang=es&level=${encodeURIComponent(level)}&skin=0`;
  } catch (err) {
    console.error('Error obteniendo siguiente nivel:', err);
    alert('No se pudo abrir el juego. Intenta de nuevo.');
  }
}

// ==============================
// Navegar a Bird
// ==============================
async function goBird() {
  try {
    if (!session?.sesion_id) return location.replace('./login.html');

    const params = new URLSearchParams({
      sesion_id: session.sesion_id,
      juego_id: JUEGO_ID_BIRD.toString(),
    });

    const res = await fetch(`${NEXT_LEVEL_URL}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${session.sesion_id}`,
      },
    });

    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json')
      ? await res.json()
      : { ok: false, error: 'Respuesta no-JSON' };

    if (!res.ok || data.ok === false) {
      throw new Error(data.error || 'No se pudo resolver el nivel');
    }

    // ********** CAMBIO IMPORTANTE AQUÍ **********
    // data.nivel = { id: (11..20), numero: (1..10) }

    const nivel = data.nivel || {};
    const levelNumero = nivel.numero || 1;   // <-- ESTE se usa en ?level=
    const nivelId = nivel.id;                // <-- ESTE es el PK de NIVEL (11..20)

    if (!nivelId) {
      throw new Error('La respuesta no contiene nivel.id');
    }

    // Guardamos el id real del nivel para BIRD, para usarlo en /player/try/start
    localStorage.setItem('bird_nivel_id', String(nivelId));

    // El juego BIRD debe recibir el número lógico de nivel (1..10), no el id de BD (11..20)
    location.href = `../bird.html?lang=es&level=${encodeURIComponent(levelNumero)}&skin=0`;
  } catch (err) {
    console.error('Error obteniendo siguiente nivel (Birdsi):', err);
    alert('No se pudo abrir el juego. Intenta de nuevo.');
  }
}


// ==============================
// Logout
// ==============================
async function logout() {
  try {
    if (session?.sesion_id) {
      await fetch('/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sesion_id: session.sesion_id }),
      });
    }
  } catch (e) {
    console.error('Error cerrando sesión:', e);
  } finally {
    localStorage.removeItem(APPKEY);
    localStorage.removeItem('partida');
    // como index y login están en /views:
    location.replace('./login.html');
  }
}

window.goMaze = goMaze;
window.goBird = goBird;
window.logout = logout;
