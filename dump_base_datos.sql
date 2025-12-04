-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: db:3306
-- Generation Time: Dec 04, 2025 at 03:04 AM
-- Server version: 8.0.41
-- PHP Version: 8.2.29

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `blockly_db`
--

DELIMITER $$
--
-- Procedures
--
CREATE DEFINER=`root`@`%` PROCEDURE `sp_change_password_investigador` (IN `p_usuario_id` BIGINT UNSIGNED, IN `p_new_password` VARCHAR(100))   BEGIN
  DECLARE v_rol_investigador INT UNSIGNED;
  DECLARE v_es_investigador INT;

  IF p_usuario_id IS NULL OR p_usuario_id = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'usuario_id inválido.';
  END IF;

  IF p_new_password IS NULL OR CHAR_LENGTH(p_new_password) < 50 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'password hash requerido (longitud >= 50).';
  END IF;

  SELECT id INTO v_rol_investigador
  FROM ROL
  WHERE tipo = 'investigador'
  LIMIT 1;

  IF v_rol_investigador IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No existe el rol "investigador".';
  END IF;

  -- Verificar que el usuario exista y sea investigador
  SELECT COUNT(*)
    INTO v_es_investigador
  FROM USUARIO
  WHERE id = p_usuario_id AND rol_id = v_rol_investigador;

  IF v_es_investigador = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El usuario no existe o no es investigador.';
  END IF;

  UPDATE USUARIO
     SET password = p_new_password
   WHERE id = p_usuario_id;
END$$

CREATE DEFINER=`root`@`%` PROCEDURE `sp_create_investigador` (IN `p_pin` CHAR(4), IN `p_nombre` VARCHAR(80), IN `p_apellidos` VARCHAR(120), IN `p_password` VARCHAR(100))   BEGIN
  DECLARE v_rol_investigador INT UNSIGNED;
  DECLARE v_usuario_id BIGINT UNSIGNED;

  /* Validaciones */
  IF p_pin IS NULL OR CHAR_LENGTH(p_pin) <> 4 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PIN inválido (debe ser 4 dígitos).';
  END IF;

  IF p_nombre IS NULL OR p_apellidos IS NULL OR p_nombre = '' OR p_apellidos = '' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Nombre y apellidos son requeridos.';
  END IF;

  IF p_password IS NULL OR CHAR_LENGTH(p_password) < 50 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'password hash requerido (longitud >= 50).';
  END IF;

  /* Rol investigador */
  SELECT id INTO v_rol_investigador
  FROM ROL
  WHERE tipo = 'investigador'
  LIMIT 1;

  IF v_rol_investigador IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No existe el rol "investigador".';
  END IF;

  /* PIN único */
  IF EXISTS (SELECT 1 FROM USUARIO WHERE pin = p_pin) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PIN ya está en uso.';
  END IF;

  /* Insert (fecha_nac = NULL por diseño) */
  INSERT INTO USUARIO (rol_id, pin, password, nombre, apellidos, fecha_nac)
  VALUES (v_rol_investigador, p_pin, p_password, p_nombre, p_apellidos, NULL);

  SET v_usuario_id = LAST_INSERT_ID();

  /* Retorno */
  SELECT v_usuario_id AS usuario_id;
END$$

CREATE DEFINER=`root`@`%` PROCEDURE `sp_create_jugador` (IN `p_pin` VARCHAR(8), IN `p_nombre` VARCHAR(120), IN `p_apellidos` VARCHAR(120), IN `p_fecha_nac` DATE)   BEGIN
  DECLARE v_usuario_id BIGINT;

  -- 1️⃣ Insertar nuevo usuario tipo jugador
  INSERT INTO USUARIO (rol_id, pin, nombre, apellidos, fecha_nac)
  VALUES (1, p_pin, p_nombre, p_apellidos, p_fecha_nac);

  SET v_usuario_id = LAST_INSERT_ID();

  -- 2️⃣ Inicializar progreso SOLO para niveles 1–10 de TODOS los juegos
  --    (un registro por juego_id + numero, aunque el id real sea 1..10, 11..20, etc.)
  INSERT INTO PROGRESO (usuario_id, juego_id, nivel_id, estado_id, reinicios, intentos, segundos_totales)
  SELECT
      v_usuario_id,
      n.juego_id,
      n.id AS nivel_id,
      1 AS estado_id,      -- 1 = PENDIENTE
      0 AS reinicios,
      0 AS intentos,
      0 AS segundos_totales
  FROM NIVEL n
  INNER JOIN (
      -- Para cada juego y cada número de nivel (1..10),
      -- tomamos SIEMPRE el id mínimo de NIVEL (evita duplicados como tu id=21)
      SELECT juego_id, numero, MIN(id) AS id_min
      FROM NIVEL
      WHERE numero BETWEEN 1 AND 10
      GROUP BY juego_id, numero
  ) x
    ON n.id = x.id_min
  ORDER BY n.juego_id, n.numero;

  -- 3️⃣ Retornar datos del jugador recién creado
  SELECT 
      u.id AS usuario_id,
      u.pin,
      u.nombre,
      u.apellidos,
      u.fecha_nac,
      u.creado_en,
      'Jugador registrado con progreso inicializado' AS mensaje
  FROM USUARIO u
  WHERE u.id = v_usuario_id;
END$$

CREATE DEFINER=`root`@`%` PROCEDURE `sp_end_intento` (IN `p_intento_id` BIGINT UNSIGNED, IN `p_estado_id` TINYINT UNSIGNED, IN `p_num_bloques` INT UNSIGNED, IN `p_codigo_js` JSON, IN `p_es_reinicio` TINYINT UNSIGNED)   BEGIN
  DECLARE v_inicio      DATETIME;
  DECLARE v_fin         DATETIME;
  DECLARE v_duracion_ms INT;
  DECLARE v_sesion_id   BIGINT;
  DECLARE v_juego_id    SMALLINT;
  DECLARE v_nivel_id    INT;
  DECLARE v_usuario_id  BIGINT;
  DECLARE v_total_ms    BIGINT;

  -- 1) Obtener datos base del intento
  SELECT inicio_en, sesion_id, juego_id, nivel_id
    INTO v_inicio, v_sesion_id, v_juego_id, v_nivel_id
  FROM INTENTO
  WHERE id = p_intento_id;

  -- 2) Calcular duración (ms)
  SET v_fin         = NOW();
  SET v_duracion_ms = TIMESTAMPDIFF(MICROSECOND, v_inicio, v_fin) / 1000;

  -- 3) Obtener usuario desde la sesión
  SELECT usuario_id INTO v_usuario_id
  FROM SESION
  WHERE id = v_sesion_id;

  -- 4) Actualizar intento
  UPDATE INTENTO
  SET
    estado_id           = p_estado_id,
    numero_bloques_total = p_num_bloques,
    codigo_js           = p_codigo_js,
    duracion_ms         = v_duracion_ms,
    fin_en              = v_fin
  WHERE id = p_intento_id;

  -- 5) Calcular tiempo ACUMULADO en ese nivel (todos los intentos terminados)
  SELECT IFNULL(SUM(i.duracion_ms), 0)
    INTO v_total_ms
  FROM INTENTO i
  INNER JOIN SESION s ON s.id = i.sesion_id
  WHERE s.usuario_id = v_usuario_id
    AND i.juego_id   = v_juego_id
    AND i.nivel_id   = v_nivel_id
    AND i.duracion_ms > 0;  -- solo intentos que ya tienen duración

  -- 6) Actualizar PROGRESO según el estado final del intento
  IF p_estado_id = 3 THEN
    -- COMPLETADO
    UPDATE PROGRESO
    SET estado_id       = 3,
        segundos_totales = v_total_ms / 1000
    WHERE usuario_id = v_usuario_id
      AND juego_id   = v_juego_id
      AND nivel_id   = v_nivel_id;

  ELSEIF p_estado_id = 5 THEN
    -- FALLADO
    UPDATE PROGRESO
    SET estado_id       = 5,
        reinicios       = reinicios + IFNULL(p_es_reinicio, 0),
        segundos_totales = v_total_ms / 1000
    WHERE usuario_id = v_usuario_id
      AND juego_id   = v_juego_id
      AND nivel_id   = v_nivel_id;

  ELSEIF p_estado_id = 4 THEN
    -- ABANDONADO
    UPDATE PROGRESO
    SET estado_id       = 4,
        segundos_totales = v_total_ms / 1000
    WHERE usuario_id = v_usuario_id
      AND juego_id   = v_juego_id
      AND nivel_id   = v_nivel_id;
  END IF;
END$$

CREATE DEFINER=`root`@`%` PROCEDURE `sp_end_sesion` (IN `p_sesion_id` BIGINT)   BEGIN
  DECLARE v_inicio DATETIME;

  SELECT inicio_en INTO v_inicio
  FROM SESION
  WHERE id = p_sesion_id;

  UPDATE SESION
  SET fin_en = NOW(),
      segundos_totales = TIMESTAMPDIFF(SECOND, v_inicio, NOW())
  WHERE id = p_sesion_id;
END$$

CREATE DEFINER=`root`@`%` PROCEDURE `sp_start_intento` (IN `p_sesion_id` BIGINT UNSIGNED, IN `p_juego_id` SMALLINT UNSIGNED, IN `p_nivel_id` INT UNSIGNED)   BEGIN
    DECLARE v_usuario_id BIGINT UNSIGNED;

    -- 1 Obtener usuario desde la sesión
    SELECT usuario_id INTO v_usuario_id
    FROM SESION
    WHERE id = p_sesion_id;

    -- 2 Crear nuevo intento (estado = EN_PROCESO)
    INSERT INTO INTENTO (sesion_id, juego_id, nivel_id, estado_id, inicio_en)
    VALUES (p_sesion_id, p_juego_id, p_nivel_id, 2, NOW());

    -- 3 Asegurar progreso existente o crearlo
    IF NOT EXISTS (
        SELECT 1 FROM PROGRESO
        WHERE usuario_id = v_usuario_id
          AND juego_id = p_juego_id
          AND nivel_id = p_nivel_id
    ) THEN
        INSERT INTO PROGRESO (usuario_id, juego_id, nivel_id, estado_id, reinicios, intentos, segundos_totales)
        VALUES (v_usuario_id, p_juego_id, p_nivel_id, 2, 0, 1, 0);
    ELSE
        -- 4 Actualizar progreso existente (marcar como EN_PROCESO y sumar intento)
        UPDATE PROGRESO
        SET estado_id = 2,
            intentos = intentos + 1
        WHERE usuario_id = v_usuario_id
          AND juego_id = p_juego_id
          AND nivel_id = p_nivel_id;
    END IF;

    -- 5 Retornar el ID del intento creado
    SELECT LAST_INSERT_ID() AS intento_id;
END$$

CREATE DEFINER=`root`@`%` PROCEDURE `sp_start_sesion` (IN `p_usuario_id` BIGINT)   BEGIN
  INSERT INTO SESION (usuario_id, inicio_en, ultimo_ping)
  VALUES (p_usuario_id, NOW(), NOW());

  SELECT LAST_INSERT_ID() AS sesion_id;
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `ACCION`
--

CREATE TABLE `ACCION` (
  `id` bigint UNSIGNED NOT NULL,
  `intento_id` bigint UNSIGNED NOT NULL,
  `tipo_accion_id` tinyint UNSIGNED NOT NULL,
  `tipo_bloque_id` smallint UNSIGNED DEFAULT NULL,
  `numero_secuencia` int UNSIGNED NOT NULL,
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `CONEXION_BLOQUE`
--

CREATE TABLE `CONEXION_BLOQUE` (
  `accion_id` bigint UNSIGNED NOT NULL,
  `padre_tipo_bloque_id` smallint UNSIGNED DEFAULT NULL,
  `hijo_tipo_bloque_id` smallint UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `EDICION_BLOQUE`
--

CREATE TABLE `EDICION_BLOQUE` (
  `accion_id` bigint UNSIGNED NOT NULL,
  `elemento` varchar(32) DEFAULT NULL,
  `nombre` varchar(64) DEFAULT NULL,
  `valor_anterior` text,
  `valor_nuevo` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ESTADO`
--

CREATE TABLE `ESTADO` (
  `id` tinyint UNSIGNED NOT NULL,
  `tipo` varchar(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `ESTADO`
--

INSERT INTO `ESTADO` (`id`, `tipo`) VALUES
(4, 'ABANDONO'),
(3, 'COMPLETADO'),
(2, 'EN_PROCESO'),
(5, 'FALLADO'),
(1, 'PENDIENTE');

-- --------------------------------------------------------

--
-- Table structure for table `INTENTO`
--

CREATE TABLE `INTENTO` (
  `id` bigint UNSIGNED NOT NULL,
  `sesion_id` bigint UNSIGNED NOT NULL,
  `juego_id` smallint UNSIGNED NOT NULL,
  `nivel_id` int UNSIGNED NOT NULL,
  `estado_id` tinyint UNSIGNED DEFAULT NULL,
  `numero_bloques_total` int UNSIGNED NOT NULL DEFAULT '0',
  `duracion_ms` int UNSIGNED NOT NULL DEFAULT '0',
  `codigo_js` json DEFAULT NULL,
  `inicio_en` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fin_en` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `JUEGO`
--

CREATE TABLE `JUEGO` (
  `id` smallint UNSIGNED NOT NULL,
  `nombre` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `JUEGO`
--

INSERT INTO `JUEGO` (`id`, `nombre`) VALUES
(2, 'bird'),
(1, 'maze');

-- --------------------------------------------------------

--
-- Table structure for table `MOVIMIENTO_BLOQUE`
--

CREATE TABLE `MOVIMIENTO_BLOQUE` (
  `accion_id` bigint UNSIGNED NOT NULL,
  `desde_x` int NOT NULL,
  `desde_y` int NOT NULL,
  `hasta_x` int NOT NULL,
  `hasta_y` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `NIVEL`
--

CREATE TABLE `NIVEL` (
  `id` int UNSIGNED NOT NULL,
  `juego_id` smallint UNSIGNED NOT NULL,
  `numero` int UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `NIVEL`
--

INSERT INTO `NIVEL` (`id`, `juego_id`, `numero`) VALUES
(1, 1, 1),
(2, 1, 2),
(3, 1, 3),
(4, 1, 4),
(5, 1, 5),
(6, 1, 6),
(7, 1, 7),
(8, 1, 8),
(9, 1, 9),
(10, 1, 10),
(11, 2, 1),
(12, 2, 2),
(13, 2, 3),
(14, 2, 4),
(15, 2, 5),
(16, 2, 6),
(17, 2, 7),
(18, 2, 8),
(19, 2, 9),
(20, 2, 10);

-- --------------------------------------------------------

--
-- Table structure for table `PROGRESO`
--

CREATE TABLE `PROGRESO` (
  `id` bigint UNSIGNED NOT NULL,
  `usuario_id` bigint UNSIGNED NOT NULL,
  `juego_id` smallint UNSIGNED NOT NULL,
  `nivel_id` int UNSIGNED NOT NULL,
  `estado_id` tinyint UNSIGNED DEFAULT NULL,
  `reinicios` int UNSIGNED NOT NULL DEFAULT '0',
  `intentos` int UNSIGNED NOT NULL DEFAULT '0',
  `segundos_totales` int UNSIGNED NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ROL`
--

CREATE TABLE `ROL` (
  `id` int UNSIGNED NOT NULL,
  `tipo` varchar(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `ROL`
--

INSERT INTO `ROL` (`id`, `tipo`) VALUES
(2, 'investigador'),
(1, 'jugador');

-- --------------------------------------------------------

--
-- Table structure for table `SESION`
--

CREATE TABLE `SESION` (
  `id` bigint UNSIGNED NOT NULL,
  `usuario_id` bigint UNSIGNED NOT NULL,
  `inicio_en` datetime NOT NULL,
  `fin_en` datetime DEFAULT NULL,
  `ultimo_ping` datetime DEFAULT NULL,
  `segundos_totales` int UNSIGNED DEFAULT '0',
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `SESION`
--

INSERT INTO `SESION` (`id`, `usuario_id`, `inicio_en`, `fin_en`, `ultimo_ping`, `segundos_totales`, `creado_en`) VALUES
(74, 7, '2025-11-20 22:32:42', '2025-11-20 22:37:07', '2025-11-20 22:34:53', 265, '2025-11-20 22:32:42'),
(75, 7, '2025-11-20 22:38:48', NULL, '2025-11-20 22:38:49', 0, '2025-11-20 22:38:48'),
(76, 7, '2025-11-20 22:38:55', '2025-11-20 22:43:45', '2025-11-20 22:38:57', 290, '2025-11-20 22:38:55'),
(77, 7, '2025-11-20 22:43:52', '2025-11-20 23:05:35', '2025-11-20 22:44:04', 1303, '2025-11-20 22:43:52'),
(79, 7, '2025-11-21 03:18:34', '2025-11-21 03:53:12', '2025-11-21 03:19:05', 2078, '2025-11-21 03:18:34'),
(82, 7, '2025-11-25 06:01:19', NULL, '2025-11-25 06:03:16', 0, '2025-11-25 06:01:19'),
(84, 7, '2025-11-26 00:06:57', NULL, '2025-11-26 00:07:46', 0, '2025-11-26 00:06:57'),
(86, 7, '2025-11-26 00:13:59', NULL, '2025-11-26 00:17:23', 0, '2025-11-26 00:13:59'),
(87, 7, '2025-11-26 00:17:45', NULL, '2025-11-26 00:17:48', 0, '2025-11-26 00:17:45'),
(89, 7, '2025-11-26 00:28:00', NULL, '2025-11-26 00:28:32', 0, '2025-11-26 00:28:00'),
(91, 7, '2025-11-26 00:44:45', '2025-11-26 00:48:29', '2025-11-26 00:45:00', 224, '2025-11-26 00:44:45'),
(114, 7, '2025-11-26 05:36:45', NULL, '2025-11-26 05:36:50', 0, '2025-11-26 05:36:45'),
(115, 7, '2025-11-26 05:40:53', NULL, '2025-11-26 05:44:04', 0, '2025-11-26 05:40:53'),
(117, 7, '2025-11-26 07:04:36', NULL, '2025-11-26 07:04:51', 0, '2025-11-26 07:04:36'),
(122, 7, '2025-11-26 07:47:30', NULL, '2025-11-26 07:48:43', 0, '2025-11-26 07:47:30'),
(125, 7, '2025-11-27 02:23:24', NULL, '2025-11-27 02:23:24', 0, '2025-11-27 02:23:24'),
(126, 7, '2025-11-27 02:25:05', '2025-11-27 02:28:21', '2025-11-27 02:25:24', 196, '2025-11-27 02:25:05'),
(127, 7, '2025-11-27 02:28:50', NULL, '2025-11-27 02:32:45', 0, '2025-11-27 02:28:50'),
(129, 7, '2025-11-27 02:33:19', NULL, '2025-11-27 02:33:32', 0, '2025-11-27 02:33:19'),
(133, 7, '2025-11-27 03:03:52', NULL, '2025-11-27 03:03:56', 0, '2025-11-27 03:03:52'),
(134, 7, '2025-11-27 03:22:21', '2025-11-27 03:41:37', '2025-11-27 03:22:36', 1156, '2025-11-27 03:22:21'),
(135, 7, '2025-11-27 03:41:45', NULL, '2025-11-27 03:56:30', 0, '2025-11-27 03:41:45'),
(137, 7, '2025-11-27 03:59:58', NULL, '2025-11-27 04:00:16', 0, '2025-11-27 03:59:58'),
(139, 7, '2025-11-27 04:05:00', NULL, '2025-11-27 04:05:15', 0, '2025-11-27 04:05:00'),
(141, 7, '2025-11-27 04:08:00', '2025-11-27 04:17:40', '2025-11-27 04:08:12', 580, '2025-11-27 04:08:00'),
(142, 7, '2025-11-27 04:17:55', NULL, '2025-11-27 04:18:13', 0, '2025-11-27 04:17:55'),
(144, 7, '2025-11-27 04:23:26', NULL, '2025-11-27 04:23:45', 0, '2025-11-27 04:23:26'),
(151, 7, '2025-11-29 00:12:15', NULL, '2025-11-29 00:16:06', 0, '2025-11-29 00:12:15'),
(152, 7, '2025-11-29 00:25:22', NULL, '2025-11-29 00:25:22', 0, '2025-11-29 00:25:22'),
(153, 7, '2025-11-29 00:25:31', NULL, '2025-11-29 00:49:28', 0, '2025-11-29 00:25:31');

-- --------------------------------------------------------

--
-- Table structure for table `TIPO_ACCION`
--

CREATE TABLE `TIPO_ACCION` (
  `id` tinyint UNSIGNED NOT NULL,
  `tipo` varchar(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `TIPO_ACCION`
--

INSERT INTO `TIPO_ACCION` (`id`, `tipo`) VALUES
(3, 'CONEXION_BLOQUE'),
(4, 'EDICION_BLOQUE'),
(5, 'ELIMINACION_BLOQUE'),
(2, 'MOVIMIENTO_BLOQUE'),
(1, 'NUEVO_BLOQUE');

-- --------------------------------------------------------

--
-- Table structure for table `TIPO_BLOQUE`
--

CREATE TABLE `TIPO_BLOQUE` (
  `id` smallint UNSIGNED NOT NULL,
  `tipo` varchar(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `TIPO_BLOQUE`
--

INSERT INTO `TIPO_BLOQUE` (`id`, `tipo`) VALUES
(1, 'AVANZAR'),
(10, 'BIRD_CAMBIO_DIRECCION'),
(12, 'BIRD_COMPARADOR_POSICION'),
(11, 'BIRD_COND_SIN_GUSANO'),
(13, 'BIRD_OPERADOR_LOGICO'),
(3, 'GIRAR_DERECHA'),
(2, 'GIRAR_IZQUIERDA'),
(9, 'REPETIR_HASTA_META'),
(4, 'SENSOR_CAMINO_ADELANTE'),
(6, 'SENSOR_CAMINO_DERECHA'),
(5, 'SENSOR_CAMINO_IZQUIERDA'),
(7, 'SI_CAMINO_HACER'),
(8, 'SI_CAMINO_SINO');

-- --------------------------------------------------------

--
-- Table structure for table `USUARIO`
--

CREATE TABLE `USUARIO` (
  `id` bigint UNSIGNED NOT NULL,
  `rol_id` int UNSIGNED NOT NULL,
  `pin` char(4) NOT NULL,
  `password` varchar(100) DEFAULT NULL,
  `nombre` varchar(80) NOT NULL,
  `apellidos` varchar(120) NOT NULL,
  `fecha_nac` date DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `USUARIO`
--

INSERT INTO `USUARIO` (`id`, `rol_id`, `pin`, `password`, `nombre`, `apellidos`, `fecha_nac`, `creado_en`) VALUES
(7, 2, '1234', '$2b$10$Eudf10rzX/8OsmX8pH8hr.SXB104kAMx/sxz0ZG9YVtsyk1AHTPTi', 'Prueba', 'Investigador', NULL, '2025-10-29 00:00:21');

-- --------------------------------------------------------

--
-- Stand-in structure for view `vw_attempt_event_log`
-- (See below for the actual view)
--
CREATE TABLE `vw_attempt_event_log` (
`accion_id` bigint unsigned
,`details_json` json
,`intento_id` bigint unsigned
,`n_orden` bigint unsigned
,`timestamp_evento` datetime
,`tipo_accion` varchar(32)
,`tipo_accion_id` tinyint unsigned
,`tipo_bloque` varchar(64)
,`tipo_bloque_id` smallint unsigned
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `vw_auth`
-- (See below for the actual view)
--
CREATE TABLE `vw_auth` (
`apellidos` varchar(120)
,`creado_en` datetime
,`fecha_nac` date
,`nombre` varchar(80)
,`password_hash` varchar(100)
,`pin` char(4)
,`rol` varchar(64)
,`rol_id` int unsigned
,`usuario_id` bigint unsigned
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `vw_auth_middlewares`
-- (See below for the actual view)
--
CREATE TABLE `vw_auth_middlewares` (
`fin_en` datetime
,`idle_seconds` bigint
,`inicio_en` datetime
,`rol` varchar(64)
,`rol_id` int unsigned
,`segundos_totales` int unsigned
,`sesion_id` bigint unsigned
,`ultimo_ping` datetime
,`usuario_id` bigint unsigned
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `vw_list_players`
-- (See below for the actual view)
--
CREATE TABLE `vw_list_players` (
`apellidos` varchar(120)
,`jugador` varchar(201)
,`niveles_completados` bigint
,`nombre` varchar(80)
,`pin` char(4)
,`total_niveles` bigint
,`total_sesiones` bigint
,`ultima_sesion` datetime
,`usuario_id` bigint unsigned
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `vw_player_game_levels`
-- (See below for the actual view)
--
CREATE TABLE `vw_player_game_levels` (
`estado` varchar(32)
,`fecha_primer_intento` datetime
,`fecha_ultimo_intento` datetime
,`intentos_totales` int unsigned
,`juego_id` smallint unsigned
,`nivel` int unsigned
,`nivel_id` int unsigned
,`seg_prom_por_intento` decimal(13,2)
,`tiempo_acumulado_seg` int unsigned
,`usuario_id` bigint unsigned
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `vw_player_game_summary`
-- (See below for the actual view)
--
CREATE TABLE `vw_player_game_summary` (
`intentos_totales_juego` bigint
,`juego` varchar(50)
,`juego_id` smallint unsigned
,`jugador` varchar(201)
,`niveles_completados_juego` decimal(23,0)
,`pct_abandono_juego` decimal(29,2)
,`pct_exito_juego` decimal(29,2)
,`pct_fallo_juego` decimal(29,2)
,`prom_intentos_por_nivel` decimal(13,2)
,`seg_prom_intento_juego` decimal(13,2)
,`seg_prom_nivel_hasta_completar` decimal(13,2)
,`ultima_actividad_juego` datetime
,`usuario_id` bigint unsigned
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `vw_player_level_attempts`
-- (See below for the actual view)
--
CREATE TABLE `vw_player_level_attempts` (
`bloques_total` int unsigned
,`codigo_js` json
,`estado` varchar(32)
,`estado_id` tinyint unsigned
,`fecha_intento` datetime
,`intento_id` bigint unsigned
,`juego_id` smallint unsigned
,`nivel_id` int unsigned
,`seg_duracion_intento` decimal(13,2)
,`sesion_id` bigint unsigned
,`usuario_id` bigint unsigned
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `vw_player_overview_general`
-- (See below for the actual view)
--
CREATE TABLE `vw_player_overview_general` (
`intentos_abandono` decimal(23,0)
,`intentos_abandono_juego` decimal(23,0)
,`intentos_exito` decimal(23,0)
,`intentos_exito_juego` decimal(23,0)
,`intentos_fallo` decimal(23,0)
,`intentos_fallo_juego` decimal(23,0)
,`intentos_totales` bigint
,`intentos_totales_juego` bigint
,`juego` varchar(50)
,`juego_id` smallint unsigned
,`jugador` varchar(201)
,`niveles_completados` decimal(23,0)
,`pct_intentos_abandono` decimal(29,2)
,`pct_intentos_exito` decimal(29,2)
,`pct_intentos_fallo` decimal(29,2)
,`seg_prom_nivel_hasta_completar` decimal(13,2)
,`seg_prom_por_intento` decimal(13,2)
,`seg_prom_por_sesion` decimal(13,2)
,`ultima_sesion` datetime
,`usuario_id` bigint unsigned
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `vw_player_sessions_timeseries`
-- (See below for the actual view)
--
CREATE TABLE `vw_player_sessions_timeseries` (
`intentos_abandono` decimal(23,0)
,`intentos_exito` decimal(23,0)
,`intentos_fallo` decimal(23,0)
,`intentos_totales_sesion` bigint
,`seg_prom_intento_sesion` decimal(13,2)
,`sesion_fin` datetime
,`sesion_id` bigint unsigned
,`sesion_inicio` datetime
,`sesion_segundos` int unsigned
,`usuario_id` bigint unsigned
);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `ACCION`
--
ALTER TABLE `ACCION`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_intento_seq` (`intento_id`,`numero_secuencia`),
  ADD KEY `idx_accion_intento` (`intento_id`),
  ADD KEY `idx_accion_tipo` (`tipo_accion_id`),
  ADD KEY `idx_accion_bloque` (`tipo_bloque_id`);

--
-- Indexes for table `CONEXION_BLOQUE`
--
ALTER TABLE `CONEXION_BLOQUE`
  ADD PRIMARY KEY (`accion_id`),
  ADD KEY `padre_tipo_bloque_id` (`padre_tipo_bloque_id`),
  ADD KEY `hijo_tipo_bloque_id` (`hijo_tipo_bloque_id`);

--
-- Indexes for table `EDICION_BLOQUE`
--
ALTER TABLE `EDICION_BLOQUE`
  ADD PRIMARY KEY (`accion_id`);

--
-- Indexes for table `ESTADO`
--
ALTER TABLE `ESTADO`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `tipo` (`tipo`);

--
-- Indexes for table `INTENTO`
--
ALTER TABLE `INTENTO`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_intento_sesion` (`sesion_id`,`inicio_en`),
  ADD KEY `idx_intento_juego_nivel` (`juego_id`,`nivel_id`),
  ADD KEY `idx_intento_estado` (`estado_id`),
  ADD KEY `nivel_id` (`nivel_id`);

--
-- Indexes for table `JUEGO`
--
ALTER TABLE `JUEGO`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nombre` (`nombre`);

--
-- Indexes for table `MOVIMIENTO_BLOQUE`
--
ALTER TABLE `MOVIMIENTO_BLOQUE`
  ADD PRIMARY KEY (`accion_id`);

--
-- Indexes for table `NIVEL`
--
ALTER TABLE `NIVEL`
  ADD PRIMARY KEY (`id`),
  ADD KEY `juego_id` (`juego_id`);

--
-- Indexes for table `PROGRESO`
--
ALTER TABLE `PROGRESO`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_usuario_juego_nivel` (`usuario_id`,`juego_id`,`nivel_id`),
  ADD KEY `idx_progreso_usuario` (`usuario_id`),
  ADD KEY `idx_progreso_juego_nivel` (`juego_id`,`nivel_id`),
  ADD KEY `idx_progreso_estado` (`estado_id`),
  ADD KEY `fk_progreso_nivel` (`nivel_id`);

--
-- Indexes for table `ROL`
--
ALTER TABLE `ROL`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `tipo` (`tipo`);

--
-- Indexes for table `SESION`
--
ALTER TABLE `SESION`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sesion_usuario` (`usuario_id`,`inicio_en`);

--
-- Indexes for table `TIPO_ACCION`
--
ALTER TABLE `TIPO_ACCION`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `tipo` (`tipo`);

--
-- Indexes for table `TIPO_BLOQUE`
--
ALTER TABLE `TIPO_BLOQUE`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `tipo` (`tipo`);

--
-- Indexes for table `USUARIO`
--
ALTER TABLE `USUARIO`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `pin` (`pin`),
  ADD KEY `rol_id` (`rol_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `ACCION`
--
ALTER TABLE `ACCION`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4036;

--
-- AUTO_INCREMENT for table `ESTADO`
--
ALTER TABLE `ESTADO`
  MODIFY `id` tinyint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `INTENTO`
--
ALTER TABLE `INTENTO`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=539;

--
-- AUTO_INCREMENT for table `JUEGO`
--
ALTER TABLE `JUEGO`
  MODIFY `id` smallint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `NIVEL`
--
ALTER TABLE `NIVEL`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `PROGRESO`
--
ALTER TABLE `PROGRESO`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=482;

--
-- AUTO_INCREMENT for table `ROL`
--
ALTER TABLE `ROL`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `SESION`
--
ALTER TABLE `SESION`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=154;

--
-- AUTO_INCREMENT for table `TIPO_ACCION`
--
ALTER TABLE `TIPO_ACCION`
  MODIFY `id` tinyint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `TIPO_BLOQUE`
--
ALTER TABLE `TIPO_BLOQUE`
  MODIFY `id` smallint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `USUARIO`
--
ALTER TABLE `USUARIO`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

-- --------------------------------------------------------

--
-- Structure for view `vw_attempt_event_log`
--
DROP TABLE IF EXISTS `vw_attempt_event_log`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`%` SQL SECURITY DEFINER VIEW `vw_attempt_event_log`  AS SELECT `a`.`intento_id` AS `intento_id`, `a`.`id` AS `accion_id`, row_number() OVER (PARTITION BY `a`.`intento_id` ORDER BY `a`.`creado_en`,`a`.`numero_secuencia`,`a`.`id` ) AS `n_orden`, `a`.`tipo_accion_id` AS `tipo_accion_id`, `ta`.`tipo` AS `tipo_accion`, convert_tz(`a`.`creado_en`,'+00:00','-06:00') AS `timestamp_evento`, `a`.`tipo_bloque_id` AS `tipo_bloque_id`, `tb`.`tipo` AS `tipo_bloque`, json_object('mov',(case when (`a`.`tipo_accion_id` = 2) then json_object('desde_x',`mv`.`desde_x`,'desde_y',`mv`.`desde_y`,'hasta_x',`mv`.`hasta_x`,'hasta_y',`mv`.`hasta_y`) else NULL end),'con',(case when (`a`.`tipo_accion_id` = 3) then json_object('padre_tipo_bloque_id',`cx`.`padre_tipo_bloque_id`,'padre_tipo_bloque',`tb_padre`.`tipo`,'hijo_tipo_bloque_id',`cx`.`hijo_tipo_bloque_id`,'hijo_tipo_bloque',`tb_hijo`.`tipo`) else NULL end),'edit',(case when (`a`.`tipo_accion_id` = 4) then json_object('elemento',`ed`.`elemento`,'nombre',`ed`.`nombre`,'old',`ed`.`valor_anterior`,'new',`ed`.`valor_nuevo`) else NULL end)) AS `details_json` FROM (((((((`ACCION` `a` left join `TIPO_ACCION` `ta` on((`ta`.`id` = `a`.`tipo_accion_id`))) left join `TIPO_BLOQUE` `tb` on((`tb`.`id` = `a`.`tipo_bloque_id`))) left join `MOVIMIENTO_BLOQUE` `mv` on((`mv`.`accion_id` = `a`.`id`))) left join `CONEXION_BLOQUE` `cx` on((`cx`.`accion_id` = `a`.`id`))) left join `TIPO_BLOQUE` `tb_padre` on((`tb_padre`.`id` = `cx`.`padre_tipo_bloque_id`))) left join `TIPO_BLOQUE` `tb_hijo` on((`tb_hijo`.`id` = `cx`.`hijo_tipo_bloque_id`))) left join `EDICION_BLOQUE` `ed` on((`ed`.`accion_id` = `a`.`id`))) ;

-- --------------------------------------------------------

--
-- Structure for view `vw_auth`
--
DROP TABLE IF EXISTS `vw_auth`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`%` SQL SECURITY DEFINER VIEW `vw_auth`  AS SELECT `u`.`id` AS `usuario_id`, `u`.`pin` AS `pin`, `u`.`password` AS `password_hash`, `u`.`nombre` AS `nombre`, `u`.`apellidos` AS `apellidos`, `u`.`fecha_nac` AS `fecha_nac`, convert_tz(`u`.`creado_en`,'+00:00','-06:00') AS `creado_en`, `r`.`id` AS `rol_id`, `r`.`tipo` AS `rol` FROM (`USUARIO` `u` join `ROL` `r` on((`r`.`id` = `u`.`rol_id`))) ;

-- --------------------------------------------------------

--
-- Structure for view `vw_auth_middlewares`
--
DROP TABLE IF EXISTS `vw_auth_middlewares`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`%` SQL SECURITY DEFINER VIEW `vw_auth_middlewares`  AS SELECT `s`.`id` AS `sesion_id`, `s`.`usuario_id` AS `usuario_id`, `s`.`inicio_en` AS `inicio_en`, `s`.`fin_en` AS `fin_en`, `s`.`ultimo_ping` AS `ultimo_ping`, timestampdiff(SECOND,`s`.`ultimo_ping`,now()) AS `idle_seconds`, `s`.`segundos_totales` AS `segundos_totales`, `u`.`rol_id` AS `rol_id`, `r`.`tipo` AS `rol` FROM ((`SESION` `s` join `USUARIO` `u` on((`u`.`id` = `s`.`usuario_id`))) join `ROL` `r` on((`r`.`id` = `u`.`rol_id`))) ;

-- --------------------------------------------------------

--
-- Structure for view `vw_list_players`
--
DROP TABLE IF EXISTS `vw_list_players`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`%` SQL SECURITY DEFINER VIEW `vw_list_players`  AS SELECT `u`.`id` AS `usuario_id`, `u`.`pin` AS `pin`, `u`.`nombre` AS `nombre`, `u`.`apellidos` AS `apellidos`, concat(`u`.`nombre`,' ',`u`.`apellidos`) AS `jugador`, coalesce(`ses`.`total_sesiones`,0) AS `total_sesiones`, `ses`.`ultima_sesion` AS `ultima_sesion`, coalesce(`prog`.`niveles_completados`,0) AS `niveles_completados`, coalesce(`niv`.`total_niveles`,0) AS `total_niveles` FROM ((((`USUARIO` `u` join `ROL` `r` on(((`r`.`id` = `u`.`rol_id`) and (`r`.`tipo` = 'jugador')))) left join (select `s`.`usuario_id` AS `usuario_id`,count(0) AS `total_sesiones`,convert_tz(max(`s`.`inicio_en`),'+00:00','-06:00') AS `ultima_sesion` from `SESION` `s` group by `s`.`usuario_id`) `ses` on((`ses`.`usuario_id` = `u`.`id`))) left join (select `p`.`usuario_id` AS `usuario_id`,count(0) AS `niveles_completados` from `PROGRESO` `p` where (`p`.`estado_id` = 3) group by `p`.`usuario_id`) `prog` on((`prog`.`usuario_id` = `u`.`id`))) join (select count(0) AS `total_niveles` from `NIVEL`) `niv`) ORDER BY `ses`.`ultima_sesion` DESC, `u`.`id` ASC ;

-- --------------------------------------------------------

--
-- Structure for view `vw_player_game_levels`
--
DROP TABLE IF EXISTS `vw_player_game_levels`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`%` SQL SECURITY DEFINER VIEW `vw_player_game_levels`  AS WITH   `base` as (select `p`.`usuario_id` AS `usuario_id`,`p`.`juego_id` AS `juego_id`,`p`.`nivel_id` AS `nivel_id`,`n`.`numero` AS `nivel_numero`,`p`.`estado_id` AS `estado_id`,`p`.`intentos` AS `intentos`,`p`.`segundos_totales` AS `segundos_totales`,min(`i`.`inicio_en`) AS `primer_intento_en`,max(coalesce(`i`.`fin_en`,`i`.`inicio_en`)) AS `ultimo_intento_en` from ((`PROGRESO` `p` join `NIVEL` `n` on((`n`.`id` = `p`.`nivel_id`))) left join `INTENTO` `i` on(((`i`.`juego_id` = `p`.`juego_id`) and (`i`.`nivel_id` = `p`.`nivel_id`) and `i`.`sesion_id` in (select `s`.`id` from `SESION` `s` where (`s`.`usuario_id` = `p`.`usuario_id`))))) group by `p`.`usuario_id`,`p`.`juego_id`,`p`.`nivel_id`,`n`.`numero`,`p`.`estado_id`,`p`.`intentos`,`p`.`segundos_totales`) select `b`.`usuario_id` AS `usuario_id`,`b`.`juego_id` AS `juego_id`,`b`.`nivel_id` AS `nivel_id`,`b`.`nivel_numero` AS `nivel`,`e`.`tipo` AS `estado`,`b`.`intentos` AS `intentos_totales`,`b`.`segundos_totales` AS `tiempo_acumulado_seg`,(case when (`b`.`intentos` > 0) then round((`b`.`segundos_totales` / `b`.`intentos`),2) else 0 end) AS `seg_prom_por_intento`,convert_tz(`b`.`primer_intento_en`,'+00:00','-06:00') AS `fecha_primer_intento`,convert_tz(`b`.`ultimo_intento_en`,'+00:00','-06:00') AS `fecha_ultimo_intento` from (`base` `b` left join `ESTADO` `e` on((`e`.`id` = `b`.`estado_id`)))  ;

-- --------------------------------------------------------

--
-- Structure for view `vw_player_game_summary`
--
DROP TABLE IF EXISTS `vw_player_game_summary`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`%` SQL SECURITY DEFINER VIEW `vw_player_game_summary`  AS WITH   `it` as (select `s`.`usuario_id` AS `usuario_id`,`i`.`juego_id` AS `juego_id`,`i`.`nivel_id` AS `nivel_id`,`i`.`estado_id` AS `estado_id`,`i`.`duracion_ms` AS `duracion_ms`,`i`.`fin_en` AS `fin_en` from (`INTENTO` `i` join `SESION` `s` on((`s`.`id` = `i`.`sesion_id`)))), `pr` as (select `p`.`usuario_id` AS `usuario_id`,`p`.`juego_id` AS `juego_id`,`p`.`nivel_id` AS `nivel_id`,`p`.`estado_id` AS `estado_id`,`p`.`intentos` AS `intentos`,`p`.`segundos_totales` AS `segundos_totales` from `PROGRESO` `p`), `it_game` as (select `it`.`usuario_id` AS `usuario_id`,`it`.`juego_id` AS `juego_id`,count(0) AS `intentos_totales_juego`,sum((case when (`it`.`estado_id` = 3) then 1 else 0 end)) AS `intentos_exito_juego`,sum((case when (`it`.`estado_id` = 5) then 1 else 0 end)) AS `intentos_fallo_juego`,sum((case when (`it`.`estado_id` = 4) then 1 else 0 end)) AS `intentos_abandono_juego`,(avg(nullif(`it`.`duracion_ms`,0)) / 1000) AS `seg_prom_intento_juego`,max(`it`.`fin_en`) AS `ultima_actividad_juego` from `it` group by `it`.`usuario_id`,`it`.`juego_id`), `pr_game` as (select `pr`.`usuario_id` AS `usuario_id`,`pr`.`juego_id` AS `juego_id`,sum((case when (`pr`.`estado_id` = 3) then 1 else 0 end)) AS `niveles_completados_juego`,avg(nullif(`pr`.`intentos`,0)) AS `prom_intentos_por_nivel`,avg(nullif((case when (`pr`.`estado_id` = 3) then `pr`.`segundos_totales` end),0)) AS `seg_prom_nivel_hasta_completar` from `pr` group by `pr`.`usuario_id`,`pr`.`juego_id`) select `u`.`id` AS `usuario_id`,concat(`u`.`nombre`,' ',`u`.`apellidos`) AS `jugador`,`j`.`id` AS `juego_id`,`j`.`nombre` AS `juego`,coalesce(`pg`.`niveles_completados_juego`,0) AS `niveles_completados_juego`,coalesce(`ig`.`intentos_totales_juego`,0) AS `intentos_totales_juego`,round(coalesce(`pg`.`prom_intentos_por_nivel`,0),2) AS `prom_intentos_por_nivel`,round(coalesce(`pg`.`seg_prom_nivel_hasta_completar`,0),2) AS `seg_prom_nivel_hasta_completar`,round(coalesce(`ig`.`seg_prom_intento_juego`,0),2) AS `seg_prom_intento_juego`,round(((100 * coalesce(`ig`.`intentos_exito_juego`,0)) / nullif(`ig`.`intentos_totales_juego`,0)),2) AS `pct_exito_juego`,round(((100 * coalesce(`ig`.`intentos_fallo_juego`,0)) / nullif(`ig`.`intentos_totales_juego`,0)),2) AS `pct_fallo_juego`,round(((100 * coalesce(`ig`.`intentos_abandono_juego`,0)) / nullif(`ig`.`intentos_totales_juego`,0)),2) AS `pct_abandono_juego`,convert_tz(`ig`.`ultima_actividad_juego`,'+00:00','-06:00') AS `ultima_actividad_juego` from ((((`USUARIO` `u` join `ROL` `r` on(((`r`.`id` = `u`.`rol_id`) and (`r`.`tipo` = 'jugador')))) join `it_game` `ig` on((`ig`.`usuario_id` = `u`.`id`))) join `JUEGO` `j` on((`j`.`id` = `ig`.`juego_id`))) left join `pr_game` `pg` on(((`pg`.`usuario_id` = `u`.`id`) and (`pg`.`juego_id` = `j`.`id`))))  ;

-- --------------------------------------------------------

--
-- Structure for view `vw_player_level_attempts`
--
DROP TABLE IF EXISTS `vw_player_level_attempts`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`%` SQL SECURITY DEFINER VIEW `vw_player_level_attempts`  AS SELECT `s`.`usuario_id` AS `usuario_id`, `i`.`juego_id` AS `juego_id`, `i`.`nivel_id` AS `nivel_id`, `i`.`id` AS `intento_id`, `i`.`sesion_id` AS `sesion_id`, `i`.`estado_id` AS `estado_id`, `e`.`tipo` AS `estado`, round((nullif(`i`.`duracion_ms`,0) / 1000),2) AS `seg_duracion_intento`, `i`.`numero_bloques_total` AS `bloques_total`, convert_tz(`i`.`inicio_en`,'+00:00','-06:00') AS `fecha_intento`, `i`.`codigo_js` AS `codigo_js` FROM ((`INTENTO` `i` join `SESION` `s` on((`s`.`id` = `i`.`sesion_id`))) left join `ESTADO` `e` on((`e`.`id` = `i`.`estado_id`))) ;

-- --------------------------------------------------------

--
-- Structure for view `vw_player_overview_general`
--
DROP TABLE IF EXISTS `vw_player_overview_general`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`%` SQL SECURITY DEFINER VIEW `vw_player_overview_general`  AS WITH   `it` as (select `s`.`usuario_id` AS `usuario_id`,`i`.`juego_id` AS `juego_id`,`i`.`estado_id` AS `estado_id`,`i`.`duracion_ms` AS `duracion_ms` from (`INTENTO` `i` join `SESION` `s` on((`s`.`id` = `i`.`sesion_id`)))), `pr` as (select `p`.`usuario_id` AS `usuario_id`,`p`.`juego_id` AS `juego_id`,`p`.`nivel_id` AS `nivel_id`,`p`.`estado_id` AS `estado_id`,`p`.`intentos` AS `intentos`,`p`.`segundos_totales` AS `segundos_totales` from `PROGRESO` `p`), `ses` as (select `s`.`usuario_id` AS `usuario_id`,count(0) AS `total_sesiones`,avg(nullif(`s`.`segundos_totales`,0)) AS `avg_seg_por_sesion` from `SESION` `s` group by `s`.`usuario_id`), `it_user` as (select `it`.`usuario_id` AS `usuario_id`,count(0) AS `intentos_totales`,sum((case when (`it`.`estado_id` = 3) then 1 else 0 end)) AS `intentos_exito`,sum((case when (`it`.`estado_id` = 5) then 1 else 0 end)) AS `intentos_fallo`,sum((case when (`it`.`estado_id` = 4) then 1 else 0 end)) AS `intentos_abandono`,(avg(nullif(`it`.`duracion_ms`,0)) / 1000) AS `seg_prom_por_intento` from `it` group by `it`.`usuario_id`), `pr_user` as (select `pr`.`usuario_id` AS `usuario_id`,sum((case when (`pr`.`estado_id` = 3) then 1 else 0 end)) AS `niveles_completados`,avg(nullif(`pr`.`segundos_totales`,0)) AS `seg_prom_nivel_hasta_completar` from `pr` group by `pr`.`usuario_id`), `it_game` as (select `it`.`usuario_id` AS `usuario_id`,`it`.`juego_id` AS `juego_id`,count(0) AS `intentos_totales_juego`,sum((case when (`it`.`estado_id` = 3) then 1 else 0 end)) AS `intentos_exito_juego`,sum((case when (`it`.`estado_id` = 5) then 1 else 0 end)) AS `intentos_fallo_juego`,sum((case when (`it`.`estado_id` = 4) then 1 else 0 end)) AS `intentos_abandono_juego` from `it` group by `it`.`usuario_id`,`it`.`juego_id`), `ses_max` as (select `SESION`.`usuario_id` AS `usuario_id`,max(`SESION`.`inicio_en`) AS `ultima_sesion` from `SESION` group by `SESION`.`usuario_id`) select `u`.`id` AS `usuario_id`,concat(`u`.`nombre`,' ',`u`.`apellidos`) AS `jugador`,coalesce(`pru`.`niveles_completados`,0) AS `niveles_completados`,coalesce(`itu`.`intentos_totales`,0) AS `intentos_totales`,coalesce(`itu`.`intentos_exito`,0) AS `intentos_exito`,coalesce(`itu`.`intentos_fallo`,0) AS `intentos_fallo`,coalesce(`itu`.`intentos_abandono`,0) AS `intentos_abandono`,round(((100 * coalesce(`itu`.`intentos_exito`,0)) / nullif(`itu`.`intentos_totales`,0)),2) AS `pct_intentos_exito`,round(((100 * coalesce(`itu`.`intentos_fallo`,0)) / nullif(`itu`.`intentos_totales`,0)),2) AS `pct_intentos_fallo`,round(((100 * coalesce(`itu`.`intentos_abandono`,0)) / nullif(`itu`.`intentos_totales`,0)),2) AS `pct_intentos_abandono`,round(coalesce(`pru`.`seg_prom_nivel_hasta_completar`,0),2) AS `seg_prom_nivel_hasta_completar`,round(coalesce(`itu`.`seg_prom_por_intento`,0),2) AS `seg_prom_por_intento`,`j`.`id` AS `juego_id`,`j`.`nombre` AS `juego`,coalesce(`itg`.`intentos_totales_juego`,0) AS `intentos_totales_juego`,coalesce(`itg`.`intentos_exito_juego`,0) AS `intentos_exito_juego`,coalesce(`itg`.`intentos_fallo_juego`,0) AS `intentos_fallo_juego`,coalesce(`itg`.`intentos_abandono_juego`,0) AS `intentos_abandono_juego`,convert_tz(`ses_max`.`ultima_sesion`,'+00:00','-06:00') AS `ultima_sesion`,round(coalesce(`ses`.`avg_seg_por_sesion`,0),2) AS `seg_prom_por_sesion` from (((((((`USUARIO` `u` join `ROL` `r` on(((`r`.`id` = `u`.`rol_id`) and (`r`.`tipo` = 'jugador')))) left join `it_user` `itu` on((`itu`.`usuario_id` = `u`.`id`))) left join `pr_user` `pru` on((`pru`.`usuario_id` = `u`.`id`))) left join `ses` on((`ses`.`usuario_id` = `u`.`id`))) left join `ses_max` on((`ses_max`.`usuario_id` = `u`.`id`))) left join `it_game` `itg` on((`itg`.`usuario_id` = `u`.`id`))) left join `JUEGO` `j` on((`j`.`id` = `itg`.`juego_id`)))  ;

-- --------------------------------------------------------

--
-- Structure for view `vw_player_sessions_timeseries`
--
DROP TABLE IF EXISTS `vw_player_sessions_timeseries`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`%` SQL SECURITY DEFINER VIEW `vw_player_sessions_timeseries`  AS SELECT `s`.`usuario_id` AS `usuario_id`, `s`.`id` AS `sesion_id`, convert_tz(`s`.`inicio_en`,'+00:00','-06:00') AS `sesion_inicio`, convert_tz(`s`.`fin_en`,'+00:00','-06:00') AS `sesion_fin`, `s`.`segundos_totales` AS `sesion_segundos`, count(`i`.`id`) AS `intentos_totales_sesion`, sum((case when (`i`.`estado_id` = 3) then 1 else 0 end)) AS `intentos_exito`, sum((case when (`i`.`estado_id` = 5) then 1 else 0 end)) AS `intentos_fallo`, sum((case when (`i`.`estado_id` = 4) then 1 else 0 end)) AS `intentos_abandono`, round((avg(nullif(`i`.`duracion_ms`,0)) / 1000),2) AS `seg_prom_intento_sesion` FROM (((`SESION` `s` join `USUARIO` `u` on((`u`.`id` = `s`.`usuario_id`))) join `ROL` `r` on(((`r`.`id` = `u`.`rol_id`) and (`r`.`tipo` = 'jugador')))) left join `INTENTO` `i` on((`i`.`sesion_id` = `s`.`id`))) GROUP BY `s`.`usuario_id`, `s`.`id`, `s`.`inicio_en`, `s`.`fin_en`, `s`.`segundos_totales` ;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `ACCION`
--
ALTER TABLE `ACCION`
  ADD CONSTRAINT `ACCION_ibfk_1` FOREIGN KEY (`intento_id`) REFERENCES `INTENTO` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ACCION_ibfk_2` FOREIGN KEY (`tipo_accion_id`) REFERENCES `TIPO_ACCION` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ACCION_ibfk_3` FOREIGN KEY (`tipo_bloque_id`) REFERENCES `TIPO_BLOQUE` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `CONEXION_BLOQUE`
--
ALTER TABLE `CONEXION_BLOQUE`
  ADD CONSTRAINT `CONEXION_BLOQUE_ibfk_1` FOREIGN KEY (`accion_id`) REFERENCES `ACCION` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CONEXION_BLOQUE_ibfk_2` FOREIGN KEY (`padre_tipo_bloque_id`) REFERENCES `TIPO_BLOQUE` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `CONEXION_BLOQUE_ibfk_3` FOREIGN KEY (`hijo_tipo_bloque_id`) REFERENCES `TIPO_BLOQUE` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `EDICION_BLOQUE`
--
ALTER TABLE `EDICION_BLOQUE`
  ADD CONSTRAINT `EDICION_BLOQUE_ibfk_1` FOREIGN KEY (`accion_id`) REFERENCES `ACCION` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `INTENTO`
--
ALTER TABLE `INTENTO`
  ADD CONSTRAINT `INTENTO_ibfk_1` FOREIGN KEY (`sesion_id`) REFERENCES `SESION` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `INTENTO_ibfk_2` FOREIGN KEY (`juego_id`) REFERENCES `JUEGO` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `INTENTO_ibfk_3` FOREIGN KEY (`nivel_id`) REFERENCES `NIVEL` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `INTENTO_ibfk_4` FOREIGN KEY (`estado_id`) REFERENCES `ESTADO` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `MOVIMIENTO_BLOQUE`
--
ALTER TABLE `MOVIMIENTO_BLOQUE`
  ADD CONSTRAINT `MOVIMIENTO_BLOQUE_ibfk_1` FOREIGN KEY (`accion_id`) REFERENCES `ACCION` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `NIVEL`
--
ALTER TABLE `NIVEL`
  ADD CONSTRAINT `NIVEL_ibfk_1` FOREIGN KEY (`juego_id`) REFERENCES `JUEGO` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `PROGRESO`
--
ALTER TABLE `PROGRESO`
  ADD CONSTRAINT `fk_progreso_estado` FOREIGN KEY (`estado_id`) REFERENCES `ESTADO` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_progreso_juego` FOREIGN KEY (`juego_id`) REFERENCES `JUEGO` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_progreso_nivel` FOREIGN KEY (`nivel_id`) REFERENCES `NIVEL` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_progreso_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `USUARIO` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `SESION`
--
ALTER TABLE `SESION`
  ADD CONSTRAINT `SESION_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `USUARIO` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `USUARIO`
--
ALTER TABLE `USUARIO`
  ADD CONSTRAINT `USUARIO_ibfk_1` FOREIGN KEY (`rol_id`) REFERENCES `ROL` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
