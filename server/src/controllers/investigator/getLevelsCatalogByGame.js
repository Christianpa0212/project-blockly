// =======================================================
// Catálogo de niveles por juego
// -------------------------------------------------------
// Devuelve los niveles asociados a un juego dado, con su
// identificador y número de nivel, ordenados de forma
// ascendente.
// =======================================================
import { pool } from '../../config/db/db.js';

export const getLevelsCatalogByGame = async (req, res) => {
  try {
    const { juegoId } = req.params;
    const [rows] = await pool.query(
      `SELECT id AS nivel_id, numero AS nivel
       FROM NIVEL
       WHERE juego_id = ?
       ORDER BY numero ASC`,
      [juegoId]
    );
    res.json(rows);
  } catch (err) {
    console.error('getLevelsCatalogByGame', err);
    res.status(500).json({ error: 'Error interno' });
  }
};
