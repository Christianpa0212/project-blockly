// =======================================================
// Enrutador principal de la API
// - Agrupa rutas de autenticación.
// - Protege rutas de investigador y jugador con middleware.
// - Expone rutas globales no protegidas.
// =======================================================
import { Router } from "express";

// Rutas de Autenticacion
import authRoutes from "./auth/authRoutes.js";

// Middleware auth para investigadores
import { requireInvestigatorAuth } from "../middlewares/auth/investigator.js";

//Rutas para investigadores
import investigatorRoutes from "./general/investigator.js";   

// Middleware auth para jugadores
import { requirePlayerAuth } from "../middlewares/auth/player.js";

//Rutas para jugadores
import playerRoutes from "./general/player.js";

//Rutas globales no protegidas
import globalRoutes from "./general/global.js";

const router = Router();

//Rutas de Autenticacion
router.use("/auth", authRoutes);

// Rutas protegidas para investigadores
router.use("/investigator", requireInvestigatorAuth, investigatorRoutes);

// Rutas protegidas para jugadores
router.use("/player", requirePlayerAuth, playerRoutes);

// Rutas globales no protegidas
router.use("/", globalRoutes);

export const routes = router;
