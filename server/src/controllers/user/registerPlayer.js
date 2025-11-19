// =======================================================
// Registro de jugadores
// 
// =======================================================
import { pool } from "../../config/db/db.js";

/**
 * Registra un jugador nuevo usando el SP correspondiente.
 * Ruta: POST /users/player
 * Body: { pin, nombre, apellidos, fecha_nac }
 */
export const registerPlayer = async (req, res) => {
  const { pin, nombre, apellidos, fecha_nac } = req.body || {};

  try {
    // Llamada al SP de creación de jugador
    const [result] = await pool.query(
      "CALL sp_create_jugador(?, ?, ?, ?)",
      [pin, nombre, apellidos, fecha_nac]
    );

    // El SP debería regresar el usuario creado en result[0][0]
    return res.json({ ok: true, data: result[0][0] });
  } catch (error) {
    // Registro de error y respuesta genérica de servidor
    console.error("Error al registrar jugador:", error);
    return res
      .status(500)
      .json({ ok: false, error: error.message });
  }
};
