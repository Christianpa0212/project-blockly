// =======================================================
// Rutas globales
// -------------------------------------------------------
// Punto de entrada para rutas generales no protegidas,
// como el registro de usuarios (jugadores / investigadores).
// =======================================================
import { Router } from "express";

import { registerPlayer } from "../../controllers/user/registerPlayer.js";
import { registerInvestigator } from "../../controllers/user/registerInvestigator.js";
import { changePasswordInvestigator } from "../../controllers/user/changePasswordInvestigator.js";

const router = Router();

/**
 * Registro de jugadores
 * POST /user/register-player
 */
router.post("/user/register-player", registerPlayer);

/**
 * Registro de investigadores
 * POST /user/register-investigator
 */
router.post("/user/register-investigator", registerInvestigator);

/**
 * Cambio de contraseña de investigador
 * POST /user/change-password-investigator
 */
router.post("/user/change-password-investigator", changePasswordInvestigator);

export default router;
