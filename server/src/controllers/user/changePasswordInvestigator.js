// =======================================================
// Cambio de contraseña para investigadores autenticados
// 
// =======================================================
import bcrypt from "bcryptjs";
import { pool } from "../../config/db/db.js";

/**
 * Cambia la contraseña de un investigador autenticado.
 * Ruta sugerida: POST /investigator/users/investigator/password
 * Header: Authorization: Bearer <sesion_id>
 * Body: { password_actual, password_nueva }
 *
 * requireInvestigatorAuth debe rellenar req.auth.usuario_id
 */
export const changePasswordInvestigator = async (req, res) => {
  try {
    const { usuario_id } = req.auth || {};
    const { password_actual, password_nueva } = req.body || {};

    // Validación de sesión y datos mínimos del cuerpo
    if (!usuario_id) {
      return res
        .status(401)
        .json({ ok: false, msg: "Sesión inválida" });
    }

    if (!password_actual || !password_nueva) {
      return res
        .status(400)
        .json({ ok: false, msg: "Datos incompletos" });
    }

    if (password_nueva.length < 8) {
      return res.status(400).json({
        ok: false,
        msg: "Nueva password mínimo 8 caracteres",
      });
    }

    // Consulta del hash actual en la vista de autenticación
    const [rows] = await pool.query(
        `
        SELECT password_hash
        FROM vw_auth
        WHERE usuario_id = ? AND rol = 'investigador'
        LIMIT 1
        `,
        [usuario_id]
    );

    // Validación de existencia de registro y hash
    if (!rows.length || !rows[0].password_hash) {
      return res
        .status(401)
        .json({ ok: false, msg: "Sesión inválida" });
    }

    // Comparación de la contraseña actual contra el hash almacenado
    const okPass = await bcrypt.compare(
      password_actual,
      rows[0].password_hash
    );

    if (!okPass) {
      return res
        .status(401)
        .json({ ok: false, msg: "Password actual incorrecta" });
    }

    // Generación de nuevo hash y actualización vía SP
    const newHash = await bcrypt.hash(password_nueva, 10);
    await pool.query(
      "CALL sp_change_password_investigador(?, ?)",
      [usuario_id, newHash]
    );

    return res.json({ ok: true });
  } catch (err) {
    // Manejo de errores lógicos lanzados desde la base de datos
    if (err && err.sqlState === "45000") {
      return res
        .status(400)
        .json({ ok: false, msg: err.message || "Operación no permitida" });
    }

    // Manejo de errores genéricos del servidor
    console.error("changePasswordInvestigator error:", err);
    return res
      .status(500)
      .json({ ok: false, msg: "Error cambiando password" });
  }
};
