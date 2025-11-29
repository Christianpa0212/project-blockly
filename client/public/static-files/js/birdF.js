// === Reporter de acciones (Bird) → API (/action/*) 
// Pauso métricas si INTERACTION_LOCKED = true (fallo/éxito bloqueados)

const ACTION = {
  NUEVO_BLOQUE: 1,
  MOVIMIENTO_BLOQUE: 2,
  CONEXION_BLOQUE: 3,
  EDICION_BLOQUE: 4,
  ELIMINACION_BLOQUE: 5,
};

// IMPORTANTE: estos IDs deben existir en TIPO_BLOQUE.
// 7, 8, 9 ya los tienes para IF / IF-ELSE / REPETIR_HASTA_META (Maze).
// Los 10–14 son los nuevos que debes dar de alta para Bird.
const TB = {
  IF: 7,                  // (SI_CAMINO_HACER → lo reutilizamos para IF genérico)
  IFELSE: 8,              // (SI_CAMINO_SINO → IF/ELSE genérico)
  REPETIR_HASTA: 9,       // (REPETIR_HASTA_META) para loops tipo while/until

  BIRD_CAMBIO_DIRECCION:   10, // bird_heading
  BIRD_COND_SIN_GUSANO:    11, // bird_noWorm
  BIRD_POSICION:           12, // bird_position
  BIRD_COMPARADOR_POS:     13, // bird_compare
  BIRD_OPERADOR_LOGICO:    14, // bird_and
};

// ============== Mapeo de bloques (Bird) ==============

function tipoBloqueIdFromBlock(b) {
  if (!b) return null;
  const t = b.type;

  // Bloques específicos de Bird
  if (t === 'bird_heading')  return TB.BIRD_CAMBIO_DIRECCION;
  if (t === 'bird_noWorm')   return TB.BIRD_COND_SIN_GUSANO;
  if (t === 'bird_position') return TB.BIRD_POSICION;
  if (t === 'bird_compare')  return TB.BIRD_COMPARADOR_POS;
  if (t === 'bird_and')      return TB.BIRD_OPERADOR_LOGICO;
  if (t === 'bird_ifElse')   return TB.IFELSE;

  // Si Bird usa el bloque estándar de bucle while/until
  if (t === 'controls_whileUntil') return TB.REPETIR_HASTA;

  // Otros bloques genéricos (math_number, etc.) → no los clasificamos
  return null;
}

// Para DELETE: sólo necesitamos el type del XML viejo
function getTypeFromXML(xml) {
  try {
    if (!xml) return null;
    if (xml.getAttribute) return xml.getAttribute('type');
    const m = String(xml).match(/type="([^"]+)"/);
    return m ? m[1] : null;
  } catch { return null; }
}

function tipoBloqueIdFromType(type) {
  if (!type) return null;

  if (type === 'bird_heading')        return TB.BIRD_CAMBIO_DIRECCION;
  if (type === 'bird_noWorm')         return TB.BIRD_COND_SIN_GUSANO;
  if (type === 'bird_position')       return TB.BIRD_POSICION;
  if (type === 'bird_compare')        return TB.BIRD_COMPARADOR_POS;
  if (type === 'bird_and')            return TB.BIRD_OPERADOR_LOGICO;
  if (type === 'bird_ifElse')         return TB.IFELSE;
  if (type === 'controls_whileUntil') return TB.REPETIR_HASTA;

  return null;
}

// ============== Utilidades (igual que en mazeF.js) ==============

const postJSON = (url, body) => {
  let sesion = null;
  try {
    sesion = JSON.parse(localStorage.getItem('blocklygames') || 'null');
  } catch {
    sesion = null;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (sesion && sesion.sesion_id) {
    headers.Authorization = `Bearer ${sesion.sesion_id}`;
  }

  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  }).catch(() => null);
};

const getIntentoId = () => {
  const raw = localStorage.getItem('intento_id');
  return raw ? parseInt(raw, 10) : null;
};

// Esperar workspace (sin tocar main.js de Bird)
function whenReady(cb) {
  let tries = 0;
  const it = setInterval(() => {
    tries++;
    const ws =
      (window.BlocklyInterface && BlocklyInterface.workspace) ||
      (window.Blockly && Blockly.mainWorkspace);

    if (ws && getIntentoId()) {
      clearInterval(it);
      cb(ws);
    }
    if (tries > 100) {
      clearInterval(it);
      console.warn('[Bird Acciones] no se pudo inicializar');
    }
  }, 150);
}

// ============== Listener principal (clon de mazeF.js) ==============

async function onWorkspaceEvent(e) {
  // Si está bloqueado (fallo/éxito), no registro métricas
  if (window.INTERACTION_LOCKED) return;

  const intento_id = getIntentoId();
  if (!intento_id || !window.Blockly) return;

  const ws =
    (window.BlocklyInterface && BlocklyInterface.workspace) ||
    Blockly.mainWorkspace;

  const getBlock = (id) => (id ? ws.getBlockById(id) : null);

  // CREATE → /player/action/new (1)
  if (e.type === Blockly.Events.CREATE) {
    const ids = e.ids || (e.blockId ? [e.blockId] : []);
    for (const id of ids) {
      const b = getBlock(id);
      const tipo_bloque_id = tipoBloqueIdFromBlock(b);

      // Bloques internos (math_number, etc.) → no los registramos
      if (!tipo_bloque_id) continue;

      await postJSON('/player/action/new', {
        intento_id,
        tipo_accion_id: ACTION.NUEVO_BLOQUE,
        tipo_bloque_id,
      });
    }
    return;
  }


  // DELETE → /player/action/new (5)
  if (e.type === Blockly.Events.DELETE) {
    const t = getTypeFromXML(e.oldXml);
    const tipo_bloque_id = tipoBloqueIdFromType(t);

    if (!tipo_bloque_id) return; // no registramos deletes de bloques sin clasificar

    await postJSON('/player/action/new', {
      intento_id,
      tipo_accion_id: ACTION.ELIMINACION_BLOQUE,
      tipo_bloque_id,
    });
    return;
  }


  // CHANGE → /player/action/edit (4)
  if (e.type === Blockly.Events.CHANGE) {
    const b = getBlock(e.blockId);
    const tipo_bloque_id = tipoBloqueIdFromBlock(b);

    if (!tipo_bloque_id) return; //ignorar cambios en bloques sin clasificar

    await postJSON('/player/action/edit', {
      intento_id,
      tipo_bloque_id,
      elemento: e.element ?? null,
      nombre: e.name ?? null,
      valor_anterior: e.oldValue ?? null,
      valor_nuevo: e.newValue ?? null,
    });
    return;
  }


  // MOVE → /player/action/move (2) + /player/action/connect (3)
  if (e.type === Blockly.Events.MOVE) {
    const b = getBlock(e.blockId);
    const tipo_bloque_id = tipoBloqueIdFromBlock(b);

    // --- Movimiento de bloque (solo para bloques clasificados) ---
    if (tipo_bloque_id) {
      let desde_x = null, desde_y = null, hasta_x = null, hasta_y = null;

      if (e.oldCoordinate && typeof e.oldCoordinate.x === 'number') {
        desde_x = e.oldCoordinate.x;
        desde_y = e.oldCoordinate.y;
      }
      if (e.newCoordinate && typeof e.newCoordinate.x === 'number') {
        hasta_x = e.newCoordinate.x;
        hasta_y = e.newCoordinate.y;
      }
      if ((hasta_x === null || hasta_y === null) && b && b.getRelativeToSurfaceXY) {
        const cur = b.getRelativeToSurfaceXY();
        if (cur) {
          hasta_x = cur.x;
          hasta_y = cur.y;
        }
      }

      if (desde_x !== null || desde_y !== null || hasta_x !== null || hasta_y !== null) {
        await postJSON('/player/action/move', {
          intento_id,
          tipo_bloque_id,
          desde_x,
          desde_y,
          hasta_x,
          hasta_y,
        });
      }
    }

    // --- Conexión / desconexión ---
    const becameConnected = !!(e.newParentId || e.newInputName);
    const wasConnected   = !!(e.oldParentId || e.oldInputName);

    if (becameConnected || wasConnected) {
      const parentId = e.newParentId || e.oldParentId || null;
      const parentBlock = getBlock(parentId);

      const padre_tipo_bloque_id = tipoBloqueIdFromBlock(parentBlock);
      const hijo_tipo_bloque_id  = tipo_bloque_id;

      // Si ninguno de los dos es un bloque "importante", no registramos
      if (!padre_tipo_bloque_id && !hijo_tipo_bloque_id) return;

      await postJSON('/player/action/connect', {
        intento_id,
        padre_tipo_bloque_id,
        hijo_tipo_bloque_id,
      });
    }

    return;
  }

}

// Conectar el listener cuando haya workspace e intento_id
whenReady((ws) => {
  ws.addChangeListener(onWorkspaceEvent);
  console.log('[Bird Acciones] listener conectado');
});
