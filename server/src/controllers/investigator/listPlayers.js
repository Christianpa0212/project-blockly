// =======================================================
// Listado general de jugadores
// -------------------------------------------------------
// Obtiene desde la vista vw_list_players la información
// agregada por jugador y la expone como respuesta JSON.
// =======================================================
import { pool } from "../../config/db/db.js";

// Controlador: devuelve la lista de jugadores con métricas básicas
export const listPlayers = async (req, res) => {
  try {
    // Consulta de jugadores con sus métricas principales
    const [rows] = await pool.query(`
      SELECT
        usuario_id,
        pin,
        nombre,
        apellidos,
        total_sesiones,
        ultima_sesion,
        niveles_completados,
        total_niveles
      FROM vw_list_players
      ORDER BY ultima_sesion DESC, usuario_id ASC
    `);

    // Respuesta con la colección de registros obtenidos
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("listPlayers error:", err);
    return res.status(500).json({ ok: false, msg: "Error al listar jugadores" });
  }
};
