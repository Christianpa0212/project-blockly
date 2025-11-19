// =======================================================
// Registro de investigadores
//
// =======================================================
import bcrypt from "bcryptjs";
import { pool } from "../../config/db/db.js";

/**
 * Crea un nuevo investigador.
 * Ruta: POST /users/create-investigator
 * Body: { pin, nombre, apellidos, password }
 */
export const registerInvestigator = async (req, res) => {
  try {
    const { pin, nombre, apellidos, password } = req.body || {};

    // Validación general de parámetros de entrada
    if (!pin || !/^\d{4}$/.test(String(pin))) {
      return res
        .status(400)
        .json({ ok: false, msg: "PIN inválido (deben ser 4 dígitos)" });
    }

    if (!nombre || !apellidos) {
      return res
        .status(400)
        .json({ ok: false, msg: "Nombre y apellidos requeridos" });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        ok: false,
        msg: "Password mínimo 8 caracteres",
      });
    }

    // Generación del hash de la password
    const hash = await bcrypt.hash(password, 10);

    // Ejecución del SP de creación de investigador
    const [sp] = await pool.query(
      "CALL sp_create_investigador(?, ?, ?, ?)",
      [pin, nombre, apellidos, hash]
    );

    // Obtención del identificador de usuario creado
    const usuario_id = sp?.[0]?.[0]?.usuario_id || null;

    return res.json({ ok: true, usuario_id });
  } catch (err) {
    // Manejo de errores de negocio provenientes del SP
    if (err && err.sqlState === "45000") {
      return res
        .status(409)
        .json({ ok: false, msg: err.message || "Conflicto de datos" });
    }

    // Manejo de errores de servidor
    console.error("registerInvestigator error:", err);
    return res
      .status(500)
      .json({ ok: false, msg: "Error registrando investigador" });
  }
};
