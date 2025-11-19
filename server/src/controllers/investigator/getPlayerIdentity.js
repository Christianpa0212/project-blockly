// =======================================================
// Identidad y métricas generales de un jugador
// -------------------------------------------------------
// Consulta la vista vw_list_players para obtener datos
// de identificación y resumen de progreso de un jugador
// a partir de su usuario_id.
// =======================================================
import { pool } from '../../config/db/db.js';

export const getPlayerIdentity = async (req, res) => {
  try {
    const { usuarioId } = req.params;

    const [rows] = await pool.query(
      `
      SELECT
        usuario_id,
        pin,
        jugador,
        total_sesiones,
        ultima_sesion,
        niveles_completados,
        total_niveles
      FROM vw_list_players
      WHERE usuario_id = ?
      `,
      [usuarioId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Jugador no encontrado" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("getPlayerIdentity error:", err);
    res.status(500).json({ error: "Error interno" });
  }
};
