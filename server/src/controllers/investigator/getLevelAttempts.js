// =======================================================
// Intentos por nivel de un jugador
// -------------------------------------------------------
// Obtiene, para un jugador, juego y nivel, el listado de
// intentos desde la vista vw_player_level_attempts, con
// soporte de paginación.
// =======================================================
import { pool } from '../../config/db/db.js';

export const getLevelAttempts = async (req, res) => {
  try {
    const { usuarioId, juegoId, nivelId } = req.params;
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    // Conteo total de intentos para el nivel solicitado
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM vw_player_level_attempts
       WHERE usuario_id = ? AND juego_id = ? AND nivel_id = ?`,
      [usuarioId, juegoId, nivelId]
    );

    // Página de intentos con sus métricas principales
    const [rows] = await pool.query(
      `SELECT
         usuario_id, juego_id, nivel_id, intento_id,
         sesion_id, estado_id, estado,
         seg_duracion_intento, bloques_total,
         fecha_intento, codigo_js
       FROM vw_player_level_attempts
       WHERE usuario_id = ? AND juego_id = ? AND nivel_id = ?
       ORDER BY fecha_intento ASC
       LIMIT ? OFFSET ?`,
      [usuarioId, juegoId, nivelId, limit, offset]
    );

    res.json({ total, items: rows, limit, offset });
  } catch (err) {
    console.error('getLevelAttempts', err);
    res.status(500).json({ error: 'Error interno' });
  }
};
