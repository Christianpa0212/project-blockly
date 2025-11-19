// =======================================================
// Inicio de intento de juego
// -------------------------------------------------------
// Abre un nuevo intento para una sesión, juego y nivel
// específicos, delegando la creación al procedimiento
// almacenado sp_start_intento.
// =======================================================

import { pool } from '../../config/db/db.js';

// Controlador para crear un nuevo intento
export const startTry = async (req, res) => {
  const { sesion_id, juego_id, nivel_id } = req.body;

  try {
    // Validación mínima de campos requeridos
    if (!sesion_id || !juego_id || !nivel_id) {
      return res.status(400).json({ ok: false, error: "Faltan campos obligatorios." });
    }

    // Llamada al procedimiento almacenado que crea el intento
    const [rows] = await pool.query("CALL sp_start_intento(?, ?, ?)", [sesion_id, juego_id, nivel_id]);
    const intento_id = rows?.[0]?.[0]?.intento_id;

    // Verificación del identificador de intento retornado
    if (!intento_id) {
      return res.status(500).json({ ok: false, error: "No se pudo crear el intento." });
    }

    // Respuesta con el identificador del intento recién creado
    res.json({ ok: true, message: "Intento iniciado correctamente.", intento_id });
  } catch (error) {
    console.error("Error al iniciar intento:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
};
