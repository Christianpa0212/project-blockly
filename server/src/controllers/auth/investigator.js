// =============================================
// Autenticación de investigadores (login)
// =============================================
import bcrypt from "bcryptjs";
import { pool } from "../../config/db/db.js";

/**
 * POST /auth/investigator/login
 * Recibe PIN y password, valida credenciales,
 * abre sesión y devuelve el sesion_id.
 */
export const loginInvestigator = async (req, res) => {
  try {
    const { pin, password } = req.body || {};

    // Validación básica de datos de entrada
    if (!pin || !/^\d{4}$/.test(String(pin))) {
      return res
        .status(400)
        .json({ ok: false, msg: "PIN inválido (4 dígitos)" });
    }
    if (!password) {
      return res
        .status(400)
        .json({ ok: false, msg: "Password requerida" });
    }

    // Búsqueda del investigador en la vista genérica de autenticación
    const [rows] = await pool.query(
      `
      SELECT
        usuario_id,
        password_hash,
        rol
      FROM vw_auth
      WHERE pin = ? AND rol = 'investigador'
      LIMIT 1
      `,
      [pin]
    );

    if (!rows.length || !rows[0].password_hash) {
      return res
        .status(401)
        .json({ ok: false, msg: "Credenciales inválidas" });
    }

    // Verificación de password usando bcrypt
    const okPass = await bcrypt.compare(password, rows[0].password_hash);
    if (!okPass) {
      return res
        .status(401)
        .json({ ok: false, msg: "Credenciales inválidas" });
    }

    // Apertura de sesión mediante el procedimiento almacenado
    const usuarioId = rows[0].usuario_id;
    const [sp] = await pool.query("CALL sp_start_sesion(?)", [usuarioId]);
    const sesion_id = sp?.[0]?.[0]?.sesion_id;

    if (!sesion_id) {
      return res
        .status(500)
        .json({ ok: false, msg: "No se pudo iniciar sesión" });
    }

    // Respuesta exitosa con el identificador de sesión
    return res.json({ ok: true, sesion_id });
  } catch (err) {
    console.error("loginInvestigador error:", err);
    return res
      .status(500)
      .json({ ok: false, msg: "Error en login" });
  }
};
