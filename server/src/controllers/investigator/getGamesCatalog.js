// =======================================================
// Catálogo de juegos
// -------------------------------------------------------
// Devuelve el listado de juegos registrados en la tabla
// JUEGO, con sus identificadores y nombres.
// =======================================================
import { pool } from '../../config/db/db.js';

export const getGamesCatalog = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id AS juego_id, nombre AS juego FROM JUEGO ORDER BY id ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('getGamesCatalog', err);
    res.status(500).json({ error: 'Error interno' });
  }
};
