// =======================================================
// Módulo de conexión a base de datos (MySQL)
// -------------------------------------------------------
// - Usa mysql2 en su versión basada en promesas.
// - Toma la configuración desde el objeto env.
// - Expone un pool compartido para toda la aplicación.
// =======================================================

import mysql from "mysql2/promise";
import { env } from "../env/env.js";

// =======================================================
// Pool de conexiones
// -------------------------------------------------------
// Se crea un pool global que será reutilizado por todos
// los módulos que necesiten acceder a la base de datos.
// Esto evita abrir/cerrar conexiones manualmente en cada
// operación y ayuda a controlar mejor los recursos.
// =======================================================
export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
