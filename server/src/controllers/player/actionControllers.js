// =======================================================
// Controladores de acciones de Blockly
// -------------------------------------------------------
// Define los tipos de acción y expone funciones para
// registrar acciones asociadas a un intento:
// - Acciones sin detalle (nuevo/eliminación de bloque).
// - Movimiento de bloques con coordenadas.
// - Conexiones entre bloques.
// - Ediciones sobre bloques.
// =======================================================

import { pool } from '../../config/db/db.js';

const ACTION = {
  NUEVO_BLOQUE: 1,
  MOVIMIENTO_BLOQUE: 2,
  CONEXION_BLOQUE: 3,
  EDICION_BLOQUE: 4,
  ELIMINACION_BLOQUE: 5,
  CORRER_INTENTO: 6,
  REINICIAR_INTENTO: 7,
  ABANDONAR_INTENTO: 8,
};

// =======================================================
// Utilidad de inserción de acciones con transacción
// -------------------------------------------------------
// Gestiona la secuencia por intento y realiza el insert
// en ACCION y en la tabla de detalle correspondiente
// según el tipo de acción (movimiento, conexión, edición).
// =======================================================
async function insertActionTx({ intento_id, tipo_accion_id, tipo_bloque_id = null, detalle = null }) {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Bloquea el intento para mantener el orden de secuencia
    const [row] = await conn.query('SELECT id FROM INTENTO WHERE id = ? FOR UPDATE', [intento_id]);
    if (!row?.length) throw new Error('INTENTO no existe');

    // Calcula el siguiente número de secuencia para el intento
    const [seqRows] = await conn.query(
      'SELECT COALESCE(MAX(numero_secuencia), 0) + 1 AS next_seq FROM ACCION WHERE intento_id = ?',
      [intento_id]
    );
    const nextSeq = seqRows?.[0]?.next_seq || 1;

    // Inserta la acción principal
    const [ins] = await conn.query(
      'INSERT INTO ACCION (intento_id, tipo_accion_id, tipo_bloque_id, numero_secuencia, creado_en) VALUES (?,?,?,?,NOW())',
      [intento_id, tipo_accion_id, tipo_bloque_id, nextSeq]
    );
    const accion_id = ins.insertId;

    // Inserta detalle según el tipo de acción
    if (tipo_accion_id === ACTION.MOVIMIENTO_BLOQUE) {
      const { desde_x = null, desde_y = null, hasta_x = null, hasta_y = null } = detalle || {};
      await conn.query(
        'INSERT INTO MOVIMIENTO_BLOQUE (accion_id, desde_x, desde_y, hasta_x, hasta_y) VALUES (?,?,?,?,?)',
        [accion_id, desde_x, desde_y, hasta_x, hasta_y]
      );
    } else if (tipo_accion_id === ACTION.CONEXION_BLOQUE) {
      const { padre_tipo_bloque_id = null, hijo_tipo_bloque_id = null } = detalle || {};
      await conn.query(
        'INSERT INTO CONEXION_BLOQUE (accion_id, padre_tipo_bloque_id, hijo_tipo_bloque_id) VALUES (?,?,?)',
        [accion_id, padre_tipo_bloque_id, hijo_tipo_bloque_id]
      );
    } else if (tipo_accion_id === ACTION.EDICION_BLOQUE) {
      const { elemento = null, nombre = null, valor_anterior = null, valor_nuevo = null } = detalle || {};
      await conn.query(
        'INSERT INTO EDICION_BLOQUE (accion_id, elemento, nombre, valor_anterior, valor_nuevo) VALUES (?,?,?,?,?)',
        [accion_id, elemento, nombre, valor_anterior, valor_nuevo]
      );
    }
    // Acciones 1,5,6,7,8 no generan detalle adicional

    await conn.commit();
    return { accion_id, numero_secuencia: nextSeq };
  } catch (err) {
    try { if (conn) await conn.rollback(); } catch {}
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

/* ======================================================
   Controladores públicos de acciones
   ====================================================== */

// =======================================================
// addAction
// -------------------------------------------------------
// POST /action/new
// Registra acciones sin detalle (nuevo/eliminación de bloque)
// para un intento dado.
// =======================================================
export const addAction = async (req, res) => {
  try {
    const { intento_id, tipo_accion_id, tipo_bloque_id = null } = req.body || {};
    if (!intento_id || !tipo_accion_id) {
      return res.status(400).json({ ok: false, error: 'Faltan intento_id o tipo_accion_id' });
    }

    const allowed = new Set([
      ACTION.NUEVO_BLOQUE,
      ACTION.ELIMINACION_BLOQUE,
    ]);
    if (!allowed.has(tipo_accion_id)) {
      return res.status(400).json({ ok: false, error: 'tipo_accion_id no permitido en /action/new' });
    }

    const out = await insertActionTx({
      intento_id,
      tipo_accion_id,
      tipo_bloque_id,
    });
    res.json({ ok: true, ...out });
  } catch (err) {
    console.error('addAction error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

// =======================================================
// moveAction
// -------------------------------------------------------
// POST /action/move
// Registra el movimiento de un bloque con coordenadas
// de origen y destino asociadas a un intento.
// =======================================================
export const moveAction = async (req, res) => {
  try {
    const { intento_id, tipo_bloque_id = null, desde_x, desde_y, hasta_x, hasta_y } = req.body || {};
    if (!intento_id) return res.status(400).json({ ok: false, error: 'Falta intento_id' });

    const faltantes = ['desde_x', 'desde_y', 'hasta_x', 'hasta_y'].filter(k => !(k in (req.body || {})));
    if (faltantes.length) return res.status(400).json({ ok: false, error: `Faltan: ${faltantes.join(', ')}` });

    const out = await insertActionTx({
      intento_id,
      tipo_accion_id: ACTION.MOVIMIENTO_BLOQUE,
      tipo_bloque_id,
      detalle: { desde_x, desde_y, hasta_x, hasta_y },
    });
    res.json({ ok: true, ...out });
  } catch (err) {
    console.error('moveAction error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

// =======================================================
// connectAction
// -------------------------------------------------------
// POST /action/connect
// Registra la conexión entre dos bloques para un intento,
// indicando tipo de bloque padre e hijo.
// =======================================================
export const connectAction = async (req, res) => {
  try {
    const { intento_id, padre_tipo_bloque_id = null, hijo_tipo_bloque_id = null } = req.body || {};
    if (!intento_id) return res.status(400).json({ ok: false, error: 'Falta intento_id' });

    const faltantes = ['padre_tipo_bloque_id', 'hijo_tipo_bloque_id'].filter(k => !(k in (req.body || {})));
    if (faltantes.length) return res.status(400).json({ ok: false, error: `Faltan: ${faltantes.join(', ')}` });

    const out = await insertActionTx({
      intento_id,
      tipo_accion_id: ACTION.CONEXION_BLOQUE,
      tipo_bloque_id: null,
      detalle: { padre_tipo_bloque_id, hijo_tipo_bloque_id },
    });
    res.json({ ok: true, ...out });
  } catch (err) {
    console.error('connectAction error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

// =======================================================
// editAction
// -------------------------------------------------------
// POST /action/edit
// Registra cambios realizados sobre un bloque (edición),
// incluyendo elemento, nombre y valores anterior/nuevo.
// =======================================================
export const editAction = async (req, res) => {
  try {
    const { intento_id, tipo_bloque_id = null, elemento, nombre, valor_anterior = null, valor_nuevo = null } = req.body || {};
    if (!intento_id) return res.status(400).json({ ok: false, error: 'Falta intento_id' });
    if (!elemento || !nombre) return res.status(400).json({ ok: false, error: 'Falta elemento o nombre' });

    const out = await insertActionTx({
      intento_id,
      tipo_accion_id: ACTION.EDICION_BLOQUE,
      tipo_bloque_id,
      detalle: { elemento, nombre, valor_anterior, valor_nuevo },
    });
    res.json({ ok: true, ...out });
  } catch (err) {
    console.error('editAction error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
