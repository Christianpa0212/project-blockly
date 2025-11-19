// =======================================================
// Resumen general de jugador (overview)
// -------------------------------------------------------
// Recupera, desde la vista vw_player_overview_general, los
// KPIs globales de un jugador y el desglose de intentos
// por juego para alimentar el dashboard de estadísticas.
// =======================================================
import { pool } from '../../config/db/db.js';

export const getPlayerOverview = async (req, res) => {
  try {
    const { usuarioId } = req.params;

    // La vista devuelve una fila por juego del jugador (o ninguna si no hay actividad)
    const [rows] = await pool.query(
      `SELECT
         usuario_id,
         jugador,
         niveles_completados,
         intentos_totales,
         intentos_exito,
         intentos_fallo,
         intentos_abandono,
         pct_intentos_exito,
         pct_intentos_fallo,
         pct_intentos_abandono,
         seg_prom_nivel_hasta_completar,
         seg_prom_por_intento,
         juego_id,
         juego,
         intentos_totales_juego,
         intentos_exito_juego,
         intentos_fallo_juego,
         intentos_abandono_juego,
         ultima_sesion,
         seg_prom_por_sesion
       FROM vw_player_overview_general
       WHERE usuario_id = ?
       ORDER BY juego_id`,
      [usuarioId]
    );

    // Jugador sin intentos / sin datos en la vista
    if (!rows.length) {
      return res.json({
        usuario_id: Number(usuarioId),
        jugador: null,
        kpis: {
          niveles_completados: 0,
          intentos_totales: 0,
          intentos_exito: 0,
          intentos_fallo: 0,
          intentos_abandono: 0,
          pct_intentos_exito: 0,
          pct_intentos_fallo: 0,
          pct_intentos_abandono: 0,
          seg_prom_nivel_hasta_completar: 0,
          seg_prom_por_intento: 0,
          ultima_sesion: null,
          seg_prom_por_sesion: 0,
        },
        intentos_por_juego: [],
      });
    }

    // KPIs globales del jugador (se toman de la primera fila)
    const k = rows[0];

    // Colección de intentos por juego para gráficas y tarjetas
    const intentosPorJuego = rows
      .filter((r) => r.juego_id != null)
      .map((r) => ({
        juego_id: r.juego_id,
        juego: r.juego,
        intentos_totales: r.intentos_totales_juego ?? 0,
        intentos_totales_juego: r.intentos_totales_juego ?? 0,
        intentos_exito_juego: r.intentos_exito_juego ?? 0,
        intentos_fallo_juego: r.intentos_fallo_juego ?? 0,
        intentos_abandono_juego: r.intentos_abandono_juego ?? 0,
      }));

    res.json({
      usuario_id: k.usuario_id,
      jugador: k.jugador,
      kpis: {
        niveles_completados: k.niveles_completados ?? 0,
        intentos_totales: k.intentos_totales ?? 0,
        intentos_exito: k.intentos_exito ?? 0,
        intentos_fallo: k.intentos_fallo ?? 0,
        intentos_abandono: k.intentos_abandono ?? 0,
        pct_intentos_exito: k.pct_intentos_exito ?? 0,
        pct_intentos_fallo: k.pct_intentos_fallo ?? 0,
        pct_intentos_abandono: k.pct_intentos_abandono ?? 0,
        seg_prom_nivel_hasta_completar: k.seg_prom_nivel_hasta_completar ?? 0,
        seg_prom_por_intento: k.seg_prom_por_intento ?? 0,
        seg_prom_por_sesion: k.seg_prom_por_sesion ?? 0,
        ultima_sesion: k.ultima_sesion,
      },
      intentos_por_juego: intentosPorJuego,
    });
  } catch (err) {
    console.error("getPlayerOverview", err);
    res.status(500).json({ error: "Error interno" });
  }
};
