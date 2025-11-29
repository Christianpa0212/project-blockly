// =======================================================
// Middleware de autenticación para investigadores
// -------------------------------------------------------
// - Valida la sesión del investigador a partir de headers.
// - Verifica estado, rol y tiempo de inactividad.
// - Refresca el último ping y expone datos en req.auth.
// =======================================================
import { pool } from "../../config/db/db.js";

// Tiempo máximo de inactividad permitido para investigadores (segundos)
const INVESTIGATOR_IDLE_TIMEOUT_SEC = 900; // 15 minutos

// Extrae el session_id desde los encabezados Authorization o x-session-id
function readSessionId(req) {
  const auth = req.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const sid = req.get("x-session-id");
  return sid ? String(sid).trim() : null;
}

// Middleware principal de protección de rutas para investigadores
export const requireInvestigatorAuth = async (req, res, next) => {
  try {
    // Obtiene el identificador de sesión desde los headers
    const sessionId = readSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ ok: false, msg: "Falta session_id" });
    }

    // Consulta de la sesión y datos asociados desde la vista de autenticación
    const [rows] = await pool.query(
      `
      SELECT
        sesion_id,
        usuario_id,
        inicio_en,
        fin_en,
        ultimo_ping,
        idle_seconds,
        segundos_totales,
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

    // Validación de rol específico de investigador
    if (String(sesion.rol).toLowerCase() !== "investigador") {
      return res.status(403).json({ ok: false, msg: "Solo investigadores" });
    }

    // Verificación de tiempo de inactividad y cierre por timeout
    if (
      sesion.idle_seconds !== null &&
      sesion.idle_seconds > INVESTIGATOR_IDLE_TIMEOUT_SEC
    ) {
      await pool.query(
        `
        UPDATE SESION
        SET
          fin_en = NOW(),
          segundos_totales = TIMESTAMPDIFF(SECOND, inicio_en, NOW())
        WHERE id = ?
        `,
        [sessionId]
      );

      return res
        .status(401)
        .json({ ok: false, msg: "Sesión expirada por inactividad" });
    }

    // Refresco del último ping de actividad de la sesión
    await pool.query(
      `UPDATE SESION SET ultimo_ping = NOW() WHERE id = ?`,
      [sessionId]
    );

    // Datos de sesión disponibles para los controladores posteriores
    req.auth = {
      sesion_id: sesion.sesion_id,
      usuario_id: sesion.usuario_id,
      rol_id: sesion.rol_id,
      rol: sesion.rol,
    };

    next();
  } catch (err) {
    console.error("requireInvestigatorAuth error:", err);
    res.status(500).json({ ok: false, msg: "Error de autenticación" });
  }
};
