// =======================================================
// Rutas para módulo de investigación
// -------------------------------------------------------
// Expone endpoints para listar jugadores, consultar la
// identidad y overview de un jugador, series de sesiones,
// resúmenes por juego, niveles, intentos y catálogos.
// =======================================================
import { Router } from "express";

import { listPlayers } from "../../controllers/investigator/listPlayers.js";
import { getPlayerIdentity } from "../../controllers/investigator/getPlayerIdentity.js";
import { getPlayerOverview } from "../../controllers/investigator/getPlayerOverview.js";
import { getPlayerSessionsSeries } from "../../controllers/investigator/getPlayerSessionsSeries.js";
import { getPlayerGameSummary } from "../../controllers/investigator/getPlayerGameSummary.js";
import { getPlayerGameLevels } from "../../controllers/investigator/getPlayerGameLevels.js";
import { getLevelAttempts } from "../../controllers/investigator/getLevelAttempts.js";
import { getAttemptEvents } from "../../controllers/investigator/getAttemptEvents.js";
import { getGamesCatalog } from "../../controllers/investigator/getGamesCatalog.js";
import { getLevelsCatalogByGame } from "../../controllers/investigator/getLevelsCatalogByGame.js";

const router = Router();

// Listado de jugadores para el panel de investigación
router.get("/research/players", listPlayers);

// Datos de cabecera y bloque general del jugador
router.get("/player/:usuarioId/identity", getPlayerIdentity);
router.get("/player/:usuarioId/overview", getPlayerOverview);
router.get("/player/:usuarioId/sessions/series", getPlayerSessionsSeries);

// Resumen por juego y niveles del jugador
router.get("/player/:usuarioId/games/:juegoId/summary", getPlayerGameSummary);
router.get("/player/:usuarioId/games/:juegoId/levels", getPlayerGameLevels);

// Intentos por nivel y eventos asociados a un intento
router.get("/player/:usuarioId/games/:juegoId/levels/:nivelId/attempts", getLevelAttempts);
router.get("/attempts/:intentoId/events", getAttemptEvents);

// Catálogos auxiliares de juegos y niveles
router.get("/catalog/games", getGamesCatalog);
router.get("/catalog/games/:juegoId/levels", getLevelsCatalogByGame);

export default router;
