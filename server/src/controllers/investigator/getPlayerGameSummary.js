// =======================================================
// Resumen de un jugador en un juego
// -------------------------------------------------------
// Obtiene, desde la vista vw_player_game_summary, métricas
// agregadas por juego para un jugador: niveles completados,
// intentos, tiempos promedio y porcentajes por estado.
// =======================================================
import { pool } from '../../config/db/db.js';

export const getPlayerGameSummary = async (req, res) => {
  try {
    const { usuarioId, juegoId } = req.params;

    const [rows] = await pool.query(
      `SELECT
         usuario_id, jugador, juego_id, juego,
         niveles_completados_juego, intentos_totales_juego,
         prom_intentos_por_nivel,
         seg_prom_nivel_hasta_completar,
         seg_prom_intento_juego,
         pct_exito_juego, pct_fallo_juego, pct_abandono_juego,
         ultima_actividad_juego
       FROM vw_player_game_summary
       WHERE usuario_id = ? AND juego_id = ?
       LIMIT 1`,
      [usuarioId, juegoId]
    );

    if (!rows.length) {
      return res.json({
        usuario_id: Number(usuarioId),
        juego_id: Number(juegoId),
        juego: null,
        niveles_completados_juego: 0,
        intentos_totales_juego: 0,
        prom_intentos_por_nivel: 0,
        seg_prom_nivel_hasta_completar: 0,
        seg_prom_intento_juego: 0,
        pct_exito_juego: 0,
        pct_fallo_juego: 0,
        pct_abandono_juego: 0,
        ultima_actividad_juego: null
      });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('getPlayerGameSummary', err);
    res.status(500).json({ error: 'Error interno' });
  }
};
