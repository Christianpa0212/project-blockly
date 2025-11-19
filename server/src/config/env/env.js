// =======================================================
// Carga y gestión de variables de entorno
// -------------------------------------------------------
// - Utiliza dotenv para leer el archivo .env.
// - Expone un objeto env que concentra la configuración
//   de la app (puerto y conexión a BD).
// - Permite desacoplar el código de process.env directo.
// =======================================================

import dotenv from "dotenv";

// Lee el archivo .env y carga sus valores en process.env
dotenv.config();

// =======================================================
// Objeto de configuración de entorno
// -------------------------------------------------------
// Este objeto se usa como fuente única de configuración
// en el resto de la aplicación (server, DB, etc.).
// =======================================================
export const env = {
  // Puerto HTTP en el que se levantará el servidor
  port: process.env.PORT || 3000,

  // Parámetros de conexión a la base de datos
  db: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  }
};
