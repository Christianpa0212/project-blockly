// =======================================================
// Punto de entrada del servidor HTTP (Express)
// -------------------------------------------------------
// - Crea y configura la app de Express.
// - Aplica middlewares globales (logs, JSON).
// - Sirve el frontend estático.
// - Registra el enrutador principal.
// - Inicia la escucha en el puerto configurado.
// =======================================================

import express from "express";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

// Configuración de entorno (puerto, BD, etc.)
import { env } from "./src/config/env/env.js";

// Enrutador principal de la aplicación
import { routes } from "./src/routes/routes.js";

// =======================================================
// Resolución de rutas de archivos (modo ES Modules)
// -------------------------------------------------------
// Se obtiene __filename y __dirname de forma compatible
// con ES modules para poder montar correctamente la ruta
// de los archivos estáticos del frontend.
// =======================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =======================================================
// Inicialización de la aplicación Express
// =======================================================
const app = express();

// Middleware de logging de peticiones HTTP
app.use(morgan("combined"));

// Middleware para parsear cuerpos JSON en peticiones
app.use(express.json());

// =======================================================
// Servir archivos estáticos del frontend
// -------------------------------------------------------
// Se expone la carpeta public del cliente como contenido
// estático. Gracias a "extensions: ['html']" se pueden
// resolver rutas sin poner explícitamente la extensión.
// =======================================================
app.use(
  express.static(path.join(__dirname, "../client/public"), {
    extensions: ["html"],
  })
);

// =======================================================
// Registro de rutas de la API / backend
// -------------------------------------------------------
// Se monta el enrutador principal en la raíz. A partir de
// aquí, todas las rutas definidas en routes.js cuelgan de "/"
// =======================================================
app.use("/", routes);

// =======================================================
// Arranque del servidor HTTP
// -------------------------------------------------------
// Se inicia la escucha en el puerto definido en env.port.
// =======================================================
app.listen(env.port, () => {
  const port = env.port;
  console.log(`Server running in:  http://localhost:${port}`);
});
