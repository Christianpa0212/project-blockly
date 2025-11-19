// =======================================================
// Rutas de autenticación (login / logout)
// - Expone endpoints para investigadores y jugadores.
// - Centraliza el acceso a los controladores de auth.
// =======================================================
import { Router } from "express";
import { loginInvestigator } from "../../controllers/auth/investigator.js";
import { loginPlayer } from "../../controllers/auth/player.js";
import { logoutUsers } from "../../controllers/auth/logout.js";

const router = Router();

// Login de investigador: POST /auth/login-inv
router.post("/login-inv", loginInvestigator);

// Login de jugador: POST /auth/login-play
router.post("/login-play", loginPlayer);

// Cierre de sesión genérico: POST /auth/logout
router.post("/logout", logoutUsers);

export default router;
