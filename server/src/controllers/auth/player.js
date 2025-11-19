// =============================================
// Autenticación y sesión para jugadores
// =============================================
import { pool } from "../../config/db/db.js";

/**
 * POST /auth/player/login
 * Permite iniciar sesión con PIN o con usuario_id.
 * Devuelve sesion_id y datos básicos del jugador.
 */
export const loginPlayer = async (req, res) => {
  try {
    let { usuario_id, pin } = req.body ?? {};

    // Validación rápida de PIN cuando no se proporciona usuario_id
    if (!usuario_id && typeof pin === "string") {
      pin = pin.trim();
      if (!/^\d{4}$/.test(pin)) {
        return res
          .status(400)
          .json({ ok: false, error: "PIN inválido (deben ser 4 dígitos)" });
      }
    }

    // Helper: búsqueda de jugador por PIN en la vista genérica
    const getJugadorByPin = async (p) => {
      const [rows] = await pool.query(
        `
        SELECT
          usuario_id,
          pin,
          nombre,
          apellidos
        FROM vw_auth
        WHERE pin = ? AND rol = 'jugador'
        LIMIT 1
        `,
        [p]
      );
      return rows?.[0] ?? null;
    };

    // Helper: búsqueda de jugador por usuario_id en la vista genérica
    const getJugadorByUsuarioId = async (id) => {
      const [rows] = await pool.query(
        `
        SELECT
          usuario_id,
          pin,
          nombre,
          apellidos
        FROM vw_auth
        WHERE usuario_id = ? AND rol = 'jugador'
        LIMIT 1
        `,
        [id]
      );
      return rows?.[0] ?? null;
    };

    // Resolución del jugador en función de lo que se reciba (PIN o usuario_id)
    let jugador = null;

    if (!usuario_id) {
      jugador = await getJugadorByPin(pin);
      if (!jugador) {
        return res
          .status(404)
          .json({ ok: false, error: "Jugador no encontrado" });
      }
      usuario_id = jugador.usuario_id;
    } else {
      jugador = await getJugadorByUsuarioId(usuario_id);
      if (!jugador) {
        return res.status(404).json({
          ok: false,
          error: "Usuario no válido o no es jugador",
        });
      }
    }

    // Apertura de sesión para el jugador mediante procedimiento almacenado
    const [spRows] = await pool.query("CALL sp_start_sesion(?)", [usuario_id]);
    const sesion_id =
      spRows?.[0]?.[0]?.sesion_id ?? spRows?.[0]?.sesion_id ?? null;

    if (!sesion_id) {
      return res
        .status(500)
        .json({ ok: false, error: "No se pudo crear la sesión" });
    }

    // Respuesta con identificador de sesión y datos básicos del jugador
    res.json({
      ok: true,
      sesion_id,
      usuario: {
        usuario_id: jugador.usuario_id,
        pin: jugador.pin,
        nombre: jugador.nombre,
        apellidos: jugador.apellidos,
      },
    });
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    res
      .status(500)
      .json({ ok: false, error: "Error interno al iniciar sesión" });
  }
};
