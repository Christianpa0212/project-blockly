// =============================================
// Cierre de sesión para cualquier usuario
// =============================================
import { pool } from '../../config/db/db.js';

/**
 * POST /auth/logout
 * Recibe un sesion_id y marca el cierre de sesión
 * mediante el procedimiento almacenado correspondiente.
 */
export const logoutUsers = async (req, res) => {
  const { sesion_id } = req.body;
  try {
    // Llamada al procedimiento de cierre de sesión
    await pool.query("CALL sp_end_sesion(?)", [sesion_id]);

    // Respuesta de cierre correcto
    res.json({ ok: true, message: "Sesión finalizada correctamente" });
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
};
