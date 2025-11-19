// =======================================================
// Eventos de un intento
// -------------------------------------------------------
// Obtiene el log de eventos de un intento desde la vista
// vw_attempt_event_log, con soporte de paginación.
// =======================================================
import { pool } from '../../config/db/db.js';

export const getAttemptEvents = async (req, res) => {
  try {
    const { intentoId } = req.params;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    // Conteo total de eventos del intento
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM vw_attempt_event_log
       WHERE intento_id = ?`,
      [intentoId]
    );

    // Página de eventos ordenados por secuencia
    const [rows] = await pool.query(
      `SELECT
         intento_id, accion_id, n_orden,
         tipo_accion_id, tipo_accion,
         timestamp_evento,
         tipo_bloque_id, tipo_bloque,
         details_json
       FROM vw_attempt_event_log
       WHERE intento_id = ?
       ORDER BY n_orden ASC
       LIMIT ? OFFSET ?`,
      [intentoId, limit, offset]
    );

    res.json({ total, items: rows, limit, offset });
  } catch (err) {
    console.error('getAttemptEvents', err);
    res.status(500).json({ error: 'Error interno' });
  }
};
