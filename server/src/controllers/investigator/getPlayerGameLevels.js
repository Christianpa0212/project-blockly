// =======================================================
// Niveles de un jugador para un juego
// -------------------------------------------------------
// Recupera, desde la vista vw_player_game_levels, el detalle
// por nivel de un jugador en un juego específico, incluyendo
// intentos, tiempos y fechas de actividad.
// =======================================================
import { pool } from '../../config/db/db.js';

export const getPlayerGameLevels = async (req, res) => {
  try {
    const { usuarioId, juegoId } = req.params;

    const [rows] = await pool.query(
      `SELECT
         usuario_id,
         juego_id,
         nivel_id,
         nivel,
         estado,
         intentos_totales,
         tiempo_acumulado_seg,
         seg_prom_por_intento,
         fecha_primer_intento,
         fecha_ultimo_intento
       FROM vw_player_game_levels
       WHERE usuario_id = ? AND juego_id = ?
       ORDER BY nivel ASC`,
      [usuarioId, juegoId]
    );

    res.json(rows);
  } catch (err) {
    console.error("getPlayerGameLevels", err);
    res.status(500).json({ error: "Error interno" });
  }
};
