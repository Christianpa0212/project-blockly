// =======================================================
// Cierre de intento de juego
// -------------------------------------------------------
// Finaliza un intento existente (éxito, fallo, abandono,
// reinicio, etc.) delegando el cierre al procedimiento
// almacenado sp_end_intento.
// =======================================================

import { pool } from '../../config/db/db.js';

// Controlador para finalizar un intento activo
export const endTry = async (req, res) => {
  try {
    const { intento_id, estado_id, num_bloques, codigo_js, es_reinicio } = req.body;

    // Validación mínima de campos obligatorios
    if (!intento_id || !estado_id) {
      return res.status(400).json({ ok: false, error: "Faltan campos obligatorios." });
    }

    // Serialización del código asociado al intento
    const codigoFinal = JSON.stringify(codigo_js || []);

    // Llamada al procedimiento almacenado de cierre de intento
    await pool.query("CALL sp_end_intento(?, ?, ?, ?, ?)", [
      intento_id,
      estado_id,
      num_bloques || 0,
      codigoFinal,
      es_reinicio ? 1 : 0
    ]);

    // Respuesta de cierre exitoso
    res.json({ ok: true, message: "Intento finalizado correctamente." });
  } catch (error) {
    console.error("Error al finalizar intento:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
};
