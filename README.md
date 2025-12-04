# Blockly Games | UG

Plataforma educativa basada en **Blockly Games** que registra el progreso y la telemetría de los estudiantes, y ofrece un **panel de investigación** para docentes/analistas de la Universidad de Guanajuato.

Incluye:

- Módulo de **jugador** (estudiante) con login por PIN y juegos Maze / Bird.
- Módulo de **investigador** con estadísticas detalladas por jugador, juego, nivel e intento.
- Registro de **sesiones**, **intentos** y **acciones de bloques** (crear, mover, conectar, editar, eliminar).

---

## 1. Descripción general

**Blockly Games | UG** permite que niñas y niños jueguen los desafíos de Blockly (Maze y Bird) mientras, en segundo plano, se registra:

- qué niveles intentan,
- cuántos intentos realizan,
- cuánto tiempo tardan,
- y qué bloques utilizan y cómo los manipulan.

Los investigadores acceden a un panel web donde pueden:

- ver el listado de jugadores,
- revisar resúmenes globales,
- analizar intentos por juego y nivel,
- y explorar la secuencia de eventos de un intento concreto.

---

## 2. Arquitectura

- **Backend:** Node.js + Express  
  - Gestión de jugadores, investigadores, sesiones, intentos y acciones.
  - APIs para el panel de estadísticas.
  - Conexión a MySQL mediante un pool compartido.

- **Base de datos:** MySQL  
  - Tablas de usuarios, roles, juegos, niveles, estados, sesiones, intentos, progreso y acciones.
  - Vistas para agregados y reportes del módulo de investigación.

- **Frontend:** HTML + CSS + JavaScript  
  - Páginas de login, panel del jugador y panel de investigación.
  - Integración con los juegos originales de **Blockly Maze** y **Blockly Bird**.
  - Scripts propios para llamar a las APIs y enviar telemetría.

---

## 3. Funcionalidades principales

### Jugador

- Login con **PIN de 4 dígitos**.
- Selección de juego (Maze / Bird).
- Inicio de nivel ⇒ creación de **intento** asociado a la sesión.
- Finalización del nivel (éxito, fallo, abandono) ⇒ actualización de intento y progreso.
- Registro automático de eventos de bloques mientras juega.

### Investigador

- Login con investigador por default con el PIN: **1234** y contraseña: **password**.
- Login con **PIN + contraseña**.
- Alta de nuevos investigadores.
- Cambio de contraseña propia.
- Listado de jugadores con:
  - niveles completados,
  - número de sesiones,
  - última sesión.
- Estadísticas por jugador:
  - resúmenes globales (% éxito/fallo/abandono, tiempos promedio),
  - desglose por juego y nivel,
  - lista de intentos por nivel,
  - detalle de eventos y código generado por intento.

---

## 4. Requisitos

Para ejecutar **Blockly Games | UG** se recomienda contar con:

- **Node.js** (versión LTS recomendada, por ejemplo 18.x o superior).
- **MySQL** (versión reciente y estable, por ejemplo 8.x o compatible).

---

## 5. Código fuente

Repositorio del proyecto:

> https://github.com/Christianpa0212/project-blockly.git

Estructura principal:

- `server/` → backend (Node.js + Express).
- `client/` → frontend (páginas del jugador, panel de investigador y juegos Blockly).

---

## 6. Base de datos

En el repositorio se incluye un **dump completo de MySQL** con:

- la estructura de tablas,
- datos iniciales (catálogos),
- vistas y elementos necesarios para el módulo de investigación.

Este archivo puede importarse directamente en cualquier servidor MySQL para crear la base de datos de **Blockly Games | UG**.  
No se requieren pasos especiales más allá de disponer de MySQL y ejecutar el dump con la herramienta preferida (CLI, Workbench, etc.).

---

## 7. Configuración del backend

En `server/.env` se definen las variables de entorno básicas:

- `PORT` – puerto HTTP del servidor.
- `DB_HOST`, `DB_PORT` – host y puerto de MySQL.
- `DB_USER`, `DB_PASSWORD` – credenciales de la base de datos.
- `DB_NAME` – nombre de la base de datos creada a partir del dump.

Antes de ejecutar **Blockly Games | UG** ajusta estos valores a tu entorno local.

---

## 8. Ejecución

Desde la carpeta `server/`:

### Modo desarrollo

npm install
npm run dev

### Modo producción simple

npm install
node server.js

Una vez iniciado el servidor, las rutas principales son:

http://localhost:<PORT>/ → login de jugador.

http://localhost:<PORT>/login-inv → login de investigador.

(El valor de <PORT> se define en el archivo .env.)

## 9. Estructura relevante del proyecto

```text
project-blockly/
├─ client/
│  └─ public/
│     ├─ views/           # Páginas: login jugador, login investigador, panel jugador, dashboard, maze, bird
│     ├─ static-files/
│     │  ├─ css/          # Estilos personalizados
│     │  ├─ img/          # Logotipos e imágenes
│     │  └─ js/           # Scripts de login, panel, integración con Maze/Bird, telemetría
│     ├─ maze/, bird/     # Archivos originales de Blockly Games
│     └─ ...
└─ server/
   ├─ src/
   │  ├─ config/          # env + conexión a MySQL
   │  ├─ routes/          # Rutas generales y de autenticación
   │  ├─ middlewares/     # Middlewares de auth (jugador/investigador)
   │  └─ controllers/     # Auth, user, player, investigator
   ├─ .env                # Configuración de entorno
   └─ server.js           # Arranque de Express



