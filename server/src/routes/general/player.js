// =======================================================
// Rutas para módulo de jugador
// -------------------------------------------------------
// Gestiona el ciclo de intentos (inicio y fin), registro
// de acciones de Blockly y consulta del siguiente nivel
// a jugar según el progreso.
// =======================================================
import { Router } from "express";

import { startTry } from "../../controllers/player/startTry.js";
import { endTry } from "../../controllers/player/endTry.js";

import {
  addAction,
  moveAction,
  editAction,
  connectAction,
} from "../../controllers/player/actionControllers.js";

import { getNextLevel } from "../../controllers/player/readProgress.js";

const router = Router();

// Inicio y cierre de intentos de juego
router.post("/try/start", startTry);
router.post("/try/end", endTry);

// Registro de acciones realizadas en el workspace de Blockly
router.post("/action/new", addAction);
router.post("/action/move", moveAction);
router.post("/action/edit", editAction);
router.post("/action/connect", connectAction);

// Cálculo del siguiente nivel según el progreso del jugador
router.get("/progress/next", getNextLevel);

export default router;
