// === Reporter de acciones (Maze) → API (/action/*) 
// Pauso métricas si INTERACTION_LOCKED = true (fallo/éxito bloqueados)

const ACTION = {
  NUEVO_BLOQUE: 1,
  MOVIMIENTO_BLOQUE: 2,
  CONEXION_BLOQUE: 3,
  EDICION_BLOQUE: 4,
  ELIMINACION_BLOQUE: 5,
};

const TB = {
  AVANZAR: 1,
  GIRAR_DER: 3,
  GIRAR_IZQ: 2,
  REPETIR_HASTA: 9,           // "hasta meta"
  SENSOR_ADELANTE: 4,
  SENSOR_DER: 6,
  SENSOR_IZQ: 5,
  IF: 7,
  IFELSE: 8,
};

function tipoBloqueIdFromBlock(b) {
  if (!b) return null;
  const t = b.type;
  const get = (name) => (b.getField && b.getField(name) ? b.getFieldValue(name) : null);
  const DIR = get('DIR');

  if (t === 'maze_moveForward') return TB.AVANZAR;
  if (t === 'maze_turn') {
    if (DIR === 'turnLeft')  return TB.GIRAR_IZQ;
    if (DIR === 'turnRight') return TB.GIRAR_DER;
    return null;
  }
  if (t === 'maze_isPath') {
    if (DIR === 'isPathForward') return TB.SENSOR_ADELANTE;
    if (DIR === 'isPathLeft')    return TB.SENSOR_IZQ;
    if (DIR === 'isPathRight')   return TB.SENSOR_DER;
    return null;
  }
  if (t === 'maze_if')     return TB.IF;
  if (t === 'maze_ifElse') return TB.IFELSE;
  if (t === 'maze_forever')return TB.REPETIR_HASTA;
  return null;
}

// Para DELETE: leer type + DIR desde el XML viejo
function getTypeFromXML(xml) {
  try {
    if (!xml) return null;
    if (xml.getAttribute) return xml.getAttribute('type');
    const m = String(xml).match(/type="([^"]+)"/);
    return m ? m[1] : null;
  } catch { return null; }
}
function getFieldFromXML(xml, name) {
  try {
    const s = typeof xml === 'string' ? xml : new XMLSerializer().serializeToString(xml);
    const re = new RegExp(`<field\\s+name="${name}">([^<]*)</field>`);
    const m = s.match(re);
    return m ? m[1] : null;
  } catch { return null; }
}
function tipoBloqueIdFromTypeDir(type, dir) {
  if (type === 'maze_moveForward') return TB.AVANZAR;
  if (type === 'maze_turn') {
    if (dir === 'turnLeft')  return TB.GIRAR_IZQ;
    if (dir === 'turnRight') return TB.GIRAR_DER;
    return null;
  }
  if (type === 'maze_isPath') {
    if (dir === 'isPathForward') return TB.SENSOR_ADELANTE;
    if (dir === 'isPathLeft')    return TB.SENSOR_IZQ;
    if (dir === 'isPathRight')   return TB.SENSOR_DER;
    return null;
  }
  if (type === 'maze_if')     return TB.IF;
  if (type === 'maze_ifElse') return TB.IFELSE;
  if (type === 'maze_forever')return TB.REPETIR_HASTA;
  return null;
}

// Utilidades
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

// Esperar workspace (sin tocar main.js)
function whenReady(cb) {
  let tries = 0;
  const it = setInterval(() => {
    tries++;
    const ws = (window.BlocklyInterface && BlocklyInterface.workspace) || (window.Blockly && Blockly.mainWorkspace);
    if (ws && getIntentoId()) { clearInterval(it); cb(ws); }
    if (tries > 100) { clearInterval(it); console.warn('[Acciones] no se pudo inicializar'); }
  }, 150);
}

// Listener principal
async function onWorkspaceEvent(e) {
  // Si está bloqueado (fallo/éxito), no registro métricas
  if (window.INTERACTION_LOCKED) return;

  const intento_id = getIntentoId();
  if (!intento_id || !window.Blockly) return;

  const ws = (window.BlocklyInterface && BlocklyInterface.workspace) || Blockly.mainWorkspace;
  const getBlock = (id) => (id ? ws.getBlockById(id) : null);

  // CREATE → /player/action/new (1)
  if (e.type === Blockly.Events.CREATE) {
    const ids = e.ids || (e.blockId ? [e.blockId] : []);
    for (const id of ids) {
      const b = getBlock(id);
      await postJSON('/player/action/new', {
        intento_id,
        tipo_accion_id: ACTION.NUEVO_BLOQUE,
        tipo_bloque_id: tipoBloqueIdFromBlock(b),
      });
    }
    return;
  }

  // DELETE → /player/action/new (5)
  if (e.type === Blockly.Events.DELETE) {
    const t = getTypeFromXML(e.oldXml);
    const dir = getFieldFromXML(e.oldXml, 'DIR');
    await postJSON('/player/action/new', {
      intento_id,
      tipo_accion_id: ACTION.ELIMINACION_BLOQUE,
      tipo_bloque_id: tipoBloqueIdFromTypeDir(t, dir),
    });
    return;
  }

  // CHANGE → /player/action/edit (4)
  if (e.type === Blockly.Events.CHANGE) {
    const b = getBlock(e.blockId);
    await postJSON('/player/action/edit', {
      intento_id,
      tipo_bloque_id: tipoBloqueIdFromBlock(b),
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

    // Movimiento (coordenadas)
    let desde_x = null, desde_y = null, hasta_x = null, hasta_y = null;
    if (e.oldCoordinate && typeof e.oldCoordinate.x === 'number') {
      desde_x = e.oldCoordinate.x; desde_y = e.oldCoordinate.y;
    }
    if (e.newCoordinate && typeof e.newCoordinate.x === 'number') {
      hasta_x = e.newCoordinate.x; hasta_y = e.newCoordinate.y;
    }
    if ((hasta_x === null || hasta_y === null) && b && b.getRelativeToSurfaceXY) {
      const cur = b.getRelativeToSurfaceXY(); if (cur) { hasta_x = cur.x; hasta_y = cur.y; }
    }
    if (desde_x !== null || desde_y !== null || hasta_x !== null || hasta_y !== null) {
      await postJSON('/player/action/move', { intento_id, tipo_bloque_id, desde_x, desde_y, hasta_x, hasta_y });
    }

    // Conexión / desconexión
    const becameConnected = !!(e.newParentId || e.newInputName);
    const wasConnected   = !!(e.oldParentId || e.oldInputName);
    if (becameConnected || wasConnected) {
      const parentId = e.newParentId || e.oldParentId || null;
      const parentBlock = getBlock(parentId);
      await postJSON('/player/action/connect', {
        intento_id,
        padre_tipo_bloque_id: tipoBloqueIdFromBlock(parentBlock),
        hijo_tipo_bloque_id:  tipo_bloque_id,
      });
    }
    return;
  }
}

// Conectar el listener cuando haya workspace e intento_id
whenReady((ws) => {
  ws.addChangeListener(onWorkspaceEvent);
  console.log('[Acciones] listener conectado');
});
