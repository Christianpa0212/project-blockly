// =======================================================
// Serie temporal de sesiones por jugador
// -------------------------------------------------------
// Devuelve, para un jugador dado, la lista de sesiones
// con métricas de tiempo e intentos, opcionalmente
// filtradas por rango de fechas.
// =======================================================
import { pool } from '../../config/db/db.js';

export const getPlayerSessionsSeries = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const { from, to } = req.query;

    // Construcción dinámica del WHERE según filtros opcionales
    const where = ['usuario_id = ?'];
    const params = [usuarioId];

    if (from) { where.push('sesion_inicio >= ?'); params.push(`${from} 00:00:00`); }
    if (to)   { where.push('sesion_inicio <= ?'); params.push(`${to} 23:59:59`); }

    // Consulta de la vista de series de tiempo por sesión
    const [rows] = await pool.query(
      `SELECT
         usuario_id,
         sesion_id,
         sesion_inicio,
         sesion_fin,
         sesion_segundos,
         intentos_totales_sesion,
         intentos_exito,
         intentos_fallo,
         intentos_abandono,
         seg_prom_intento_sesion
       FROM vw_player_sessions_timeseries
       WHERE ${where.join(' AND ')}
       ORDER BY sesion_inicio ASC`,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error('getPlayerSessionsSeries', err);
    res.status(500).json({ error: 'Error interno' });
  }
};
