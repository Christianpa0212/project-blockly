// =======================================================
// Middleware de autenticación para jugadores
// -------------------------------------------------------
// - Lee el sesion_id desde Authorization o x-session-id.
// - Verifica que la sesión exista y no esté finalizada.
// - Verifica que el rol sea "jugador".
// - Actualiza último ping y expone datos en req.auth.
// =======================================================
import { pool } from "../../config/db/db.js";

// Lee el session_id desde los encabezados Authorization o x-session-id
function readSessionId(req) {
  const auth = req.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const sid = req.get("x-session-id");
  return sid ? String(sid).trim() : null;
}

// Middleware principal de protección de rutas para jugadores
export const requirePlayerAuth = async (req, res, next) => {
  try {
    // 1) Obtener el identificador de sesión desde headers
    const sessionId = readSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ ok: false, msg: "Falta session_id" });
    }

    // 2) Consultar datos básicos de sesión desde la vista de autenticación
    const [rows] = await pool.query(
      `
      SELECT
        sesion_id,
        usuario_id,
        inicio_en,
        fin_en,
        ultimo_ping,
        rol_id,
        rol
      FROM vw_auth_middlewares
      WHERE sesion_id = ?
      LIMIT 1
      `,
      [sessionId]
    );

    // Sesión inexistente
    if (!rows.length) {
      return res.status(401).json({ ok: false, msg: "Sesión no encontrada" });
    }

    const sesion = rows[0];

    // Sesión ya cerrada en la base de datos
    if (sesion.fin_en) {
      return res.status(401).json({ ok: false, msg: "Sesión finalizada" });
    }

    // 3) Validar que el rol corresponda a un jugador
    if (String(sesion.rol).toLowerCase() !== "jugador") {
      return res.status(403).json({ ok: false, msg: "Solo jugadores" });
    }

    // 4) Actualizar último ping de actividad (sin cerrar la sesión)
    await pool.query(
      `UPDATE SESION SET ultimo_ping = NOW() WHERE id = ?`,
      [sessionId]
    );

    // 5) Exponer datos de sesión para los controladores siguientes
    req.auth = {
      sesion_id: sesion.sesion_id,
      usuario_id: sesion.usuario_id,
      rol_id: sesion.rol_id,
      rol: sesion.rol,
    };

    next();
  } catch (err) {
    console.error("requirePlayerAuth error:", err);
    res.status(500).json({ ok: false, msg: "Error de autenticación" });
  }
};
