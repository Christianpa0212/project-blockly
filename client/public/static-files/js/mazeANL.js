/* ============================================================
   Abandono + navegación + lock de edición (mi versión)
   - "Juegos de Blockly" => "Regresar a inicio" (confirm si TRY_STATUS==='open')
   - Bloquear saltos manuales de nivel (?level=) y flechas
   - Bloquear SIEMPRE back/forward del navegador
   - beforeunload: SIEMPRE muestra aviso global (si intento está 'open')
   - Idioma: oculto select; Skin: deshabilito controles (no oculto pegman)
   - Tras FALLAR => TRY_STATUS='failed'  + overlay (no métricas, no alert)
   - Tras GANAR  => TRY_STATUS='completed' + overlay (no métricas, no alert)
   - Al REINICIAR => TRY_STATUS='open' y se libera overlay
   - Extra: bloquear arrastre de bloques mientras TRY_STATUS!=='open'
============================================================ */
(function () {
  // Evitar doble inyección
  if (window.__TRY_NAV_LOCK__) return;
  window.__TRY_NAV_LOCK__ = true;

  // ----------------------------------------------------------
  // Estado base global
  // ----------------------------------------------------------
  if (!('TRY_STATUS' in window)) window.TRY_STATUS = 'open'; // open|failed|completed|abandoned
  if (!('SKIP_ABANDON' in window)) window.SKIP_ABANDON = false;
  if (!('INTERACTION_LOCKED' in window)) window.INTERACTION_LOCKED = false;
  if (!('SKIP_BEFOREUNLOAD_ONCE' in window)) window.SKIP_BEFOREUNLOAD_ONCE = false;
  // Flag extra: saltar solo una vez el beforeunload cuando venimos del diálogo de éxito
  if (!('SKIP_NEXT_BEFOREUNLOAD' in window)) window.SKIP_NEXT_BEFOREUNLOAD = false;

  // Flag interno: evitar doble envío de ABANDONADO desde este script
  let abandonSent = false;

  const intentoAbierto = () => window.TRY_STATUS === 'open';
  const isLevelHref = (href) => /[&?]level=\d+/i.test(href || '');
  const isIndexHref = (href) => /(^|\/)index(\.html)?(\?|#|$)/i.test(href || '');

  // ----------------------------------------------------------
  // Helpers intento
  // ----------------------------------------------------------
  function getIntentoId() {
    const raw = localStorage.getItem('intento_id');
    return raw ? parseInt(raw, 10) : null;
  }

  function codigoPlanoActual() {
    try {
      if (!window.Blockly || !Blockly.mainWorkspace) return [];
      return Blockly.JavaScript.workspaceToCode(Blockly.mainWorkspace)
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  // ----------------------------------------------------------
  // /player/try/end ABANDONADO
  // ----------------------------------------------------------
  function enviarAbandono() {
    // Sólo si el intento sigue open, y no lo hemos mandado ya
    if (abandonSent || !intentoAbierto()) return;

    const intento_id = getIntentoId();
    if (!intento_id) {
      // Sin intento_id, al menos marcamos en front
      window.TRY_STATUS = 'abandoned';
      return;
    }

    abandonSent = true;
    window.TRY_STATUS = 'abandoned';

    const bloques = (window.Blockly && Blockly.mainWorkspace)
      ? Blockly.mainWorkspace.getAllBlocks().length
      : 0;

    // Leer sesión para enviar Authorization
    let sesion = null;
    try {
      sesion = JSON.parse(localStorage.getItem('blocklygames') || 'null');
    } catch {
      sesion = null;
    }

    const headers = { 'Content-Type': 'application/json' };
    if (sesion && sesion.sesion_id) {
      headers.Authorization = `Bearer ${sesion.sesion_id}`;
    }

    fetch('/player/try/end', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        intento_id,
        estado_id: 4,              // ABANDONADO
        num_bloques: bloques,
        codigo_js: codigoPlanoActual(),
        es_reinicio: 0
      })
    }).catch(() => {
      // Silencioso: no rompemos la UI si falla el fetch
    });
  }
  window.enviarAbandono = enviarAbandono;

  // ----------------------------------------------------------
  // Overlay para bloquear todo el editor (workspace + toolbox)
  // ----------------------------------------------------------
  function getEditorContainer() {
    try {
      if (window.Blockly && Blockly.mainWorkspace) {
        const svg = Blockly.mainWorkspace.getParentSvg();
        if (svg) {
          const inj = svg.closest && svg.closest('.injectionDiv');
          if (inj) return inj;
          if (svg.parentElement) return svg.parentElement;
        }
      }
    } catch {}
    return (
      document.querySelector('.injectionDiv') ||
      document.querySelector('.blocklyDiv') ||
      document.querySelector('.blocklyWorkspace') ||
      document.body
    );
  }

  function lockWorkspace() {
    if (window.INTERACTION_LOCKED) return;
    const host = getEditorContainer();
    if (!host) return;

    const stylePos = getComputedStyle(host).position;
    if (stylePos === 'static' || !stylePos) host.style.position = 'relative';

    let shield = document.getElementById('__blockly_shield__');
    if (!shield) {
      shield = document.createElement('div');
      shield.id = '__blockly_shield__';
      shield.style.position = 'absolute';
      shield.style.inset = '0';
      shield.style.pointerEvents = 'auto';
      shield.style.background = 'rgba(0,0,0,0)'; // invisible
      shield.style.zIndex = '9999';
      host.appendChild(shield);
    }
    window.INTERACTION_LOCKED = true;
  }

  function unlockWorkspace() {
    const s = document.getElementById('__blockly_shield__');
    if (s && s.parentNode) s.parentNode.removeChild(s);
    window.INTERACTION_LOCKED = false;
  }

  // ----------------------------------------------------------
  // HARD GUARDS GLOBALES: cancelan gestos mientras INTERACTION_LOCKED
  // ----------------------------------------------------------
  let __guardsBound = false;
  const __guardTypes = [
    'mousedown','mousemove','mouseup','click','dblclick','wheel',
    'touchstart','touchmove','touchend','pointerdown','pointermove','pointerup',
    'contextmenu','keydown','keyup'
  ];

  function isWhitelistedTarget(t) {
    // Permitimos Reset
    const resetBtn = document.getElementById('resetButton') ||
      Array.from(document.querySelectorAll('button,[role="button"]'))
        .find(b => /reset|reiniciar|stop|detener/i.test(b.innerText || b.id || ''));
    if (resetBtn && (t === resetBtn || resetBtn.contains(t))) return true;

    // Permitimos el breadcrumb a inicio
    const idx = window.__INDEX_ANCHOR;
    if (idx && (t === idx || (idx.contains && idx.contains(t)))) return true;

    // ⚠️ NUEVO: permitimos cualquier click dentro del diálogo de Blockly
    const dialog = document.getElementById('dialog');
    if (dialog && (t === dialog || dialog.contains(t))) return true;

    return false;
  }


  function globalGuardHandler(e) {
    if (!window.INTERACTION_LOCKED) return;
    if (isWhitelistedTarget(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function ensureGlobalGuards(bind) {
    if (bind) {
      if (__guardsBound) return;
      __guardTypes.forEach(t => document.addEventListener(t, globalGuardHandler, true));
      __guardsBound = true;
    } else {
      if (!__guardsBound) return;
      __guardTypes.forEach(t => document.removeEventListener(t, globalGuardHandler, true));
      __guardsBound = false;
    }
  }

  // ----------------------------------------------------------
  // Guard de ARRASTRE SOLO en el workspace (TRY_STATUS!=='open')
  // ----------------------------------------------------------
  (function () {
    function workspaceRoot() {
      try {
        if (window.Blockly && Blockly.mainWorkspace) {
          const svg = Blockly.mainWorkspace.getParentSvg();
          if (svg && svg.parentElement) return svg.parentElement; // injectionDiv
        }
      } catch {}
      return (
        document.querySelector('.injectionDiv') ||
        document.querySelector('.blocklyDiv') ||
        null
      );
    }

    const dragTypes = [
      'pointerdown','pointermove','pointerup',
      'mousedown','mousemove','mouseup',
      'touchstart','touchmove','touchend',
      'dragstart','drag','dragend','wheel'
    ];

    function dragGuardHandler(e) {
      // Bloqueo arrastre/movimientos dentro del workspace cuando NO está abierto
      if (window.TRY_STATUS !== 'open') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }

    function bindDragGuard() {
      const root = workspaceRoot();
      if (!root || root.__dragGuardBound) return;
      dragTypes.forEach(t => root.addEventListener(t, dragGuardHandler, true)); // captura
      root.__dragGuardBound = true;
    }

    function unbindDragGuard() {
      const root = workspaceRoot();
      if (!root || !root.__dragGuardBound) return;
      dragTypes.forEach(t => root.removeEventListener(t, dragGuardHandler, true));
      root.__dragGuardBound = false;
    }

    // expongo para usarlos desde strictLockUI/strictUnlockUI
    window.__bindDragGuard = bindDragGuard;
    window.__unbindDragGuard = unbindDragGuard;

    // primera pasada (si ya existe el workspace)
    bindDragGuard();
  })();

  // ----------------------------------------------------------
  // Lock "duro" de edición
  // ----------------------------------------------------------
  function strictLockUI() {
    // overlay + guards globales + bloqueo de arrastre
    lockWorkspace();
    ensureGlobalGuards(true);
    if (window.__bindDragGuard) window.__bindDragGuard();
    window.INTERACTION_LOCKED = true;

    // deshabilitar toolbox (sin ocultarla)
    const tb = document.querySelector('.blocklyToolboxDiv, .blocklyFlyout');
    if (tb) {
      tb.dataset._locked = '1';
      tb.style.pointerEvents = 'none';
      tb.style.userSelect = 'none';
    }

    // deshabilitar botón Run (solo Reset o Inicio)
    const runBtn = document.getElementById('runButton') ||
      Array.from(document.querySelectorAll('button,[role="button"]'))
        .find(b => /run|ejecutar|play/i.test(b.innerText || b.id || ''));
    if (runBtn) {
      runBtn.dataset._locked = '1';
      runBtn.setAttribute('aria-disabled','true');
      runBtn.setAttribute('disabled','disabled');
      runBtn.style.pointerEvents = 'none';
      runBtn.style.cursor = 'not-allowed';
    }

    // inmovilizar/inhabilitar bloques existentes
    try {
      if (window.Blockly && Blockly.mainWorkspace) {
        Blockly.mainWorkspace.getAllBlocks(false).forEach(b => {
          if (b.setMovable)   b.setMovable(false);
          if (b.setEditable)  b.setEditable(false);
          if (b.setDeletable) b.setDeletable(false);
          if (b.setDisabled)  b.setDisabled(true);
        });
      }
    } catch {}
  }

  function strictUnlockUI() {
    // quitar overlay + guards + arrastre
    ensureGlobalGuards(false);
    if (window.__unbindDragGuard) window.__unbindDragGuard();
    unlockWorkspace();
    window.INTERACTION_LOCKED = false;

    // re-habilitar toolbox
    const tb = document.querySelector('.blocklyToolboxDiv, .blocklyFlyout');
    if (tb && tb.dataset._locked === '1') {
      tb.style.pointerEvents = '';
      tb.style.userSelect = '';
      delete tb.dataset._locked;
    }

    // re-habilitar Run
    const runBtn = document.getElementById('runButton') ||
      Array.from(document.querySelectorAll('button,[role="button"]'))
        .find(b => /run|ejecutar|play/i.test(b.innerText || b.id || ''));
    if (runBtn && runBtn.dataset._locked === '1') {
      runBtn.removeAttribute('aria-disabled');
      runBtn.removeAttribute('disabled');
      runBtn.style.pointerEvents = '';
      runBtn.style.cursor = '';
      delete runBtn.dataset._locked;
    }

    // restaurar bloques a edición normal
    try {
      if (window.Blockly && Blockly.mainWorkspace) {
        Blockly.mainWorkspace.getAllBlocks(false).forEach(b => {
          if (b.setMovable)   b.setMovable(true);
          if (b.setEditable)  b.setEditable(true);
          if (b.setDeletable) b.setDeletable(true);
          if (b.setDisabled)  b.setDisabled(false);
        });
      }
    } catch {}
  }

  // ----------------------------------------------------------
  // UI: breadcrumb, niveles, idioma, skin
  // ----------------------------------------------------------
  function lockAnchor(a) {
    if (!a || a.dataset.locked === '1') return;
    a.dataset.locked = '1';
    if (!a.dataset.hrefOriginal && a.hasAttribute('href')) {
      a.dataset.hrefOriginal = a.getAttribute('href');
    }
    a.setAttribute('href', 'javascript:void(0)');
    a.setAttribute('aria-disabled', 'true');
    a.setAttribute('tabindex', '-1');
  }

  function lockLevels(root = document) {
    root.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || a.href || '';
      if (isLevelHref(href)) lockAnchor(a);
    });
    root.querySelectorAll('button,[role="button"],.prev,.next').forEach(el => {
      const t = (el.innerText || '').toLowerCase();
      if (/^(\s*[<>]\s*)$/.test(t) || /anterior|siguiente|prev|next|←|→/.test(t)) {
        el.dataset.locked = '1';
        el.setAttribute('aria-disabled', 'true');
        el.style.pointerEvents = 'none';
        el.style.cursor = 'not-allowed';
      }
    });
    if (!document.getElementById('__lock_levels_css__')) {
      const s = document.createElement('style');
      s.id = '__lock_levels_css__';
      s.textContent =
        `a[href*="level="]{pointer-events:none!important;cursor:not-allowed!important}`;
      document.head.appendChild(s);
    }
  }

  function setupBreadcrumb(root = document) {
    let a = Array.from(root.querySelectorAll('a[href]'))
      .find(x => isIndexHref(x.getAttribute('href') || x.href || ''));
    if (!a) return null;

    a.textContent = 'Regresar a inicio';
    a.setAttribute('href', '/views/index.html');
    if (a.dataset.locked === '1') {
      if (a.dataset.hrefOriginal) a.setAttribute('href', a.dataset.hrefOriginal);
      a.dataset.locked = '0';
      a.removeAttribute('aria-disabled');
      a.removeAttribute('tabindex');
    }

    window.__INDEX_ANCHOR = a;
    return a;
  }

  function disableLanguageAndSkin(root = document) {
    // Idioma: oculto selects (heurística)
    const selLangs = Array.from(root.querySelectorAll('select')).filter(sel => {
      const opts = Array.from(sel.options || []);
      return opts.some(o =>
        /español|english|français|deutsch|portugu[eé]s|中文|日本語|русский/i.test(o.text || '')
      );
    });
    selLangs.forEach(sel => {
      sel.classList.add('__hide_ui__');
      sel.style.display = 'none';
      sel.setAttribute('aria-hidden', 'true');
      if (!sel.dataset.bound) {
        sel.dataset.bound = '1';
        sel.addEventListener('change', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          sel.value = sel.value;
        }, true);
      }
    });

    // Skin: desactivo controles, no oculto el pegman
    const pegBtn = root.querySelector('#pegmanButton');
    if (pegBtn && !pegBtn.dataset.skinLocked) {
      pegBtn.dataset.skinLocked = '1';
      pegBtn.setAttribute('aria-disabled', 'true');
      pegBtn.style.cursor = 'default';
      pegBtn.style.pointerEvents = 'none';
      const blockEvt = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      };
      pegBtn.addEventListener('click', blockEvt, true);
      pegBtn.addEventListener('mousedown', blockEvt, true);
      pegBtn.addEventListener('mouseup', blockEvt, true);
      pegBtn.addEventListener('touchstart', blockEvt, true);
      pegBtn.addEventListener('touchend', blockEvt, true);
    }
    const pegMenus =
      root.querySelectorAll('[id*="pegman"][role="menu"], [id*="pegmanMenu"], .pegmanMenu');
    pegMenus.forEach(m => {
      m.style.display = 'none';
      m.setAttribute('aria-hidden', 'true');
      m.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }, true);
    });
  }

  // ----------------------------------------------------------
  // Captura global de <a>: bloqueo niveles y breadcrumb con confirm
  // ----------------------------------------------------------
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;

    const href = a.getAttribute('href') || a.href || '';

    // Bloqueo cambios de nivel (?level=)
    if (isLevelHref(href)) {
      lockAnchor(a);
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }

    // Breadcrumb "Regresar a inicio"
    if (isIndexHref(href) || (window.__INDEX_ANCHOR && a === window.__INDEX_ANCHOR)) {
      const idx = window.__INDEX_ANCHOR || setupBreadcrumb(document);

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const goto = '/views/index.html';

      if (window.TRY_STATUS === 'open') {
        const ok = confirm('Vas a salir del nivel. Se marcará ABANDONADO. ¿Deseas continuar?');
        if (!ok) return;
        try {
          window.enviarAbandono && window.enviarAbandono();
          // Abandono ya enviado de forma controlada; en unload no queremos otro.
          window.SKIP_ABANDON = true;
        } catch (_) {}
      }

      // evitamos segundo diálogo de beforeunload en esta navegación controlada
      window.SKIP_BEFOREUNLOAD_ONCE = true;
      setTimeout(() => { window.location.href = goto; }, 50);
      return;
    }
  }, true);

  // ----------------------------------------------------------
  // Back/Forward del navegador: bloqueados
  // ----------------------------------------------------------
  try { history.pushState({ holdMaze: true }, '', location.href); } catch(_) {}

  window.addEventListener('popstate', () => {
    if (intentoAbierto()) {
      const ok = confirm('Vas a salir del nivel. Se marcará ABANDONADO. ¿Deseas continuar?');
      if (ok) {
        // Abandono controlado por back/forward
        enviarAbandono();
        window.SKIP_ABANDON = true;
        window.SKIP_BEFOREUNLOAD_ONCE = true;
        setTimeout(() => { window.location.href = '/views/index.html'; }, 80);
      } else {
        // Reforzamos el pushState para seguir bloqueando atrás/adelante
        try { history.pushState({ holdMaze: true }, '', location.href); } catch(_) {}
      }
    } else {
      // Intento ya cerrado: aún así mantenemos el bloqueo del historial
      try { history.pushState({ holdMaze: true }, '', location.href); } catch(_) {}
    }
  });

  // ----------------------------------------------------------
  // Al cerrar pestaña/ventana o recargar:
  // - beforeunload: sólo muestra aviso (si intento está open)
  // - unload: marca ABANDONADO si realmente se va y no está SKIP_ABANDON
  // ----------------------------------------------------------
  window.addEventListener('beforeunload', (e) => {
    // 1) Navegación interna que ya mostró confirm personalizado (breadcrumb, back, etc.)
    if (window.SKIP_BEFOREUNLOAD_ONCE) {
      window.SKIP_BEFOREUNLOAD_ONCE = false;
      return;
    }

    // 2) Navegación interna desde el diálogo de éxito (Aceptar / Regresar a inicio)
    if (window.SKIP_NEXT_BEFOREUNLOAD) {
      window.SKIP_NEXT_BEFOREUNLOAD = false;
      return;
    }

    // Si no hay intento abierto, no mostramos nada
    if (!intentoAbierto()) return;

    const msg =
      'En caso de que tu intento esté abierto, se marcará como ABANDONADO. ¿Deseas continuar?';

    // IMPORTANTE: aquí NO llamamos a enviarAbandono ni modificamos flags de abandono
    e.preventDefault();
    e.returnValue = msg;
    return msg;
  });

  // Cuando la página REALMENTE se va (salir o recargar),
  // aquí sí intentamos marcar ABANDONADO.
  // - Sólo si el intento sigue open
  // - Sólo si no se ha pedido SKIP_ABANDON
  function handleRealLeave(e) {
    if (!intentoAbierto()) return;
    if (window.SKIP_ABANDON) return;

    try {
      enviarAbandono();
    } catch (_) {}
  }

  // Sólo usamos unload (no pagehide) para evitar falsos positivos en cancelaciones
  window.addEventListener('unload', handleRealLeave, { capture: true });

  // ====== Popup de ÉXITO: botón propio "Regresar a inicio" + "Aceptar" ======
  function setupSuccessDialogButtons() {
    // Contenedor general del diálogo de Blockly Games
    const dialog = document.getElementById('dialog');
    if (!dialog) return;

    // Contenedor específico de los botones del popup de éxito
    const btnContainer = dialog.querySelector('#dialogDoneButtons');
    if (!btnContainer) return;

    const buttons = Array.from(btnContainer.querySelectorAll('button'));
    if (!buttons.length) return;

    // Referencias a los botones originales de Blockly
    const originalCancel = buttons[0]; // el que antes era "Cancelar"
    const btnOk =
      btnContainer.querySelector('#doneOk') ||
      buttons[1] ||
      null;

    // 1) OCULTAR el botón original de "Cancelar"
    if (originalCancel && !originalCancel.dataset.hiddenByTryNav) {
      originalCancel.dataset.hiddenByTryNav = '1';
      originalCancel.style.display = 'none';
      originalCancel.setAttribute('aria-hidden', 'true');
      originalCancel.disabled = true;
      originalCancel.tabIndex = -1;
    }

    // 2) CREAR nuestro propio botón "Regresar a inicio" (si no existe ya)
    let customHome = btnContainer.querySelector('button.__try_home_btn__');
    if (!customHome) {
      customHome = document.createElement('button');
      customHome.type = 'button';
      customHome.className = originalCancel
        ? originalCancel.className           // reutilizamos estilos del original
        : (btnOk ? btnOk.className : '');
      customHome.classList.add('__try_home_btn__');
      customHome.textContent = 'Regresar a inicio';

      // Lo insertamos antes del botón "Aceptar" si existe, si no al final
      if (btnOk && btnOk.parentNode === btnContainer) {
        btnContainer.insertBefore(customHome, btnOk);
      } else {
        btnContainer.appendChild(customHome);
      }

      // Handler: ir al inicio sí o sí
      customHome.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();

        // Evitar el beforeunload global en esta navegación controlada
        window.SKIP_NEXT_BEFOREUNLOAD = true;

        // Redirigir al inicio
        window.location.href = '/views/index.html';
      }, true);
    }

    // 3) Configurar botón "Aceptar" / "Siguiente nivel"
    if (btnOk && !btnOk.dataset.successWiredOk) {
      btnOk.dataset.successWiredOk = '1';

      const levelParam   = new URLSearchParams(window.location.search).get('level');
      const currentLevel = levelParam ? parseInt(levelParam, 10) : NaN;
      const isLastLevel  = !isNaN(currentLevel) && currentLevel >= 10;

      if (isLastLevel) {
        // En el último nivel ocultamos "Aceptar"
        btnOk.style.display = 'none';
        btnOk.setAttribute('aria-hidden', 'true');
        btnOk.disabled = true;
      } else {
        // Sólo saltamos el beforeunload global al pasar al siguiente nivel
        btnOk.addEventListener('click', function () {
          window.SKIP_NEXT_BEFOREUNLOAD = true;
        }, true);
      }
    }
  }




  // ----------------------------------------------------------
  // Detectar ÉXITO o FALLA (versión original, sin cambios agresivos)
  // ----------------------------------------------------------
  const successHints = [
    'congratulations','felicidades','nivel completado','good job','you win'
  ];
  const failHints = [
    'inténtalo de nuevo','intentar de nuevo','try again','fallaste','oh no','vuelve a intentarlo'
  ];

  const moState = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes && m.addedNodes.forEach(n => {
        if (!(n instanceof HTMLElement)) return;
        const txt = (n.innerText || '').toLowerCase();

        if (txt && successHints.some(h => txt.includes(h))) {
          window.TRY_STATUS = 'completed';
          strictLockUI();
        }
        if (txt && failHints.some(h => txt.includes(h))) {
          window.TRY_STATUS = 'failed';
          strictLockUI();
        }
      });
    }
  });

  moState.observe(document.documentElement, { childList: true, subtree: true });

  // ----------------------------------------------------------
  // Hook en Run/Reset
  // ----------------------------------------------------------
  function hookRunReset(root = document) {
    const runBtn =
      document.getElementById('runButton') ||
      Array.from(root.querySelectorAll('button,[role="button"]'))
        .find(b => /run|ejecutar|play/i.test(b.innerText || b.id || ''));
    const resetBtn =
      document.getElementById('resetButton') ||
      Array.from(root.querySelectorAll('button,[role="button"]'))
        .find(b => /reset|reiniciar|stop|detener/i.test(b.innerText || b.id || ''));

    if (runBtn && !runBtn.dataset.hooked) {
      runBtn.dataset.hooked = '1';
      runBtn.addEventListener('click', (e) => {
        // Si no está open, no dejamos ejecutar hasta Reset
        if (window.TRY_STATUS !== 'open') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return;
        }
      }, true);
    }
    if (resetBtn && !resetBtn.dataset.hooked) {
      resetBtn.dataset.hooked = '1';
      resetBtn.addEventListener('click', () => {
        // El usuario reintenta: libero edición y vuelvo a estado 'open'
        strictUnlockUI();
        window.TRY_STATUS = 'open';
        window.SKIP_ABANDON = false; // limpiamos flag para siguiente intento
      }, true);
    }
  }

  // ----------------------------------------------------------
  // Primera pasada + observers de UI
  // ----------------------------------------------------------
  function firstPass() {
    setupBreadcrumb(document);
    lockLevels(document);
    disableLanguageAndSkin(document);
    hookRunReset(document);
    setupSuccessDialogButtons();

    // si ya no estamos en open (por re-render), aplico lock (incluye bloqueo arrastre)
    if (!intentoAbierto()) strictLockUI();
    // asegurar guard de arrastre si el workspace apareció después
    if (window.__bindDragGuard) window.__bindDragGuard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', firstPass, { once: true });
  } else {
    firstPass();
  }

  const moUI = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes && m.addedNodes.forEach(n => {
        if (n.nodeType === 1) {
          setupBreadcrumb(n);
          lockLevels(n);
          disableLanguageAndSkin(n);
          hookRunReset(n);

          // Si aparece el diálogo de éxito en algún momento, configuramos sus botones
          if (n.id === 'dialogDone' || (n.querySelector && n.querySelector('#dialogDone'))) {
            setupSuccessDialogButtons();
          }

          // si se reinyecta el workspace, reengancho el guard de arrastre
          if (window.__bindDragGuard) window.__bindDragGuard();
        }
      });
    }
  });

  moUI.observe(document.documentElement, { childList: true, subtree: true });

})();
