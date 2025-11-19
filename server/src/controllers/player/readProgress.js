// =======================================================
// Lectura de progreso y cálculo de siguiente nivel
// -------------------------------------------------------
// Determina, para una sesión y juego dados, cuál es el
// siguiente nivel que corresponde jugar según estado
// de progreso del usuario.
// =======================================================

import { pool } from "../../config/db/db.js";

// Controlador: GET /level/next?sesion_id=...&juego_id=...
export const getNextLevel = async (req, res) => {
  try {
    const { sesion_id, juego_id } = req.query;

    // Validación básica de parámetros requeridos
    if (!sesion_id || !juego_id) {
      return res.status(400).json({ ok: false, error: "Faltan parámetros: sesion_id, juego_id" });
    }

    // Obtiene el usuario asociado a la sesión
    const [[sesion]] = await pool.query(
      "SELECT usuario_id FROM SESION WHERE id = ? LIMIT 1",
      [sesion_id]
    );
    if (!sesion) return res.status(404).json({ ok: false, error: "Sesión no encontrada" });
    const usuario_id = sesion.usuario_id;

    // Recupera los niveles del juego en orden
    const [niveles] = await pool.query(
      "SELECT id AS nivel_id, numero FROM NIVEL WHERE juego_id = ? ORDER BY numero ASC, id ASC",
      [juego_id]
    );
    if (!niveles.length) return res.json({ ok: true, nivel_id: null });

    // Obtiene el estado de progreso del usuario para cada nivel
    const [progreso] = await pool.query(
      "SELECT nivel_id, estado_id FROM PROGRESO WHERE usuario_id = ? AND juego_id = ?",
      [usuario_id, juego_id]
    );
    const mapEstado = new Map(progreso.map(r => [r.nivel_id, r.estado_id]));

    // Busca el primer nivel que no está completado (estado distinto de 3)
    let elegido = null;
    for (const n of niveles) {
      if (mapEstado.get(n.nivel_id) !== 3) {
        elegido = n.nivel_id;
        break;
      }
    }

    // Si todos están completados, se devuelve el último nivel
    if (!elegido) elegido = niveles[niveles.length - 1].nivel_id;

    res.json({ ok: true, nivel_id: elegido });
  } catch (err) {
    console.error("getNextLevel error:", err);
    res.status(500).json({ ok: false, error: "Error interno" });
  }
};
