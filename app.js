/* =========================================================================
   RESET — Wireframe interactivo · lógica
   Equipo: Santino Mosca Jacob · Rodrigo Masek · Facundo De Vichenzo

   Todo es SIMULADO: no hay servidor ni pagos reales. Cuentas, sesión y
   entradas se guardan en el navegador (localStorage). Si el navegador no
   deja guardar (modo privado, archivo bloqueado), se usa memoria y el
   wireframe funciona igual: sólo se pierde lo guardado al cerrar.

   Índice:
     1. Datos del evento (paquetes, fechas, cupos)
     2. Almacenamiento y sesión
     3. Utilidades (formato, avisos, errores de campo)
     4. Ruteo entre pantallas (incluye las reglas del wireflow)
     5. Pantallas: login, registro, paquetes, fecha, cantidad, compra,
        entrada (QR) y Mi cuenta
     6. Interacciones del inicio (scroll, pestañas, carrusel)
     7. Arranque
   ========================================================================= */
(function () {
  'use strict';

  // Con JS activo se quita la marca: sin JS, el CSS muestra todo sin animar.
  document.documentElement.classList.remove('no-js');

  /* ------------------------------------------------------------------ */
  /* 1. Datos del evento                                                 */
  /* ------------------------------------------------------------------ */

  // Precios DE EJEMPLO (el documento del evento no los define). Cada
  // paquete vale por un día: por eso el paso "Elegir fecha" tiene sentido.
  var PACKS = [
    { id: 'general', name: 'Pase General', price: 35000,
      items: ['The Nexus, Analog Arcade y Safe Zone', 'Charlas del Meta-Cast', 'Puntos en la app'] },
    { id: 'competidor', name: 'Pase Competidor', price: 48000,
      items: ['Todo el Pase General', 'Inscripción a la Copa Cooperativa', 'Speedrun Challenge'] },
    { id: 'pro', name: 'Pase Pro', price: 72000,
      items: ['Todo el Pase Competidor', 'Butaca preferencial en la Main Arena', 'Sesión en el Upgrade Hub'] }
  ];

  // Cupos simulados para mostrar las dos ramas de error del userflow:
  // sábado agotado ("¿Fecha disponible? No") y domingo con 4 lugares
  // ("¿Cupo disponible? No" si se piden 5 o 6).
  var DATES = [
    { id: 'vie', title: 'Viernes 18', long: 'viernes 18 de septiembre', hours: '12:00 a 20:00 h', capacity: 120 },
    { id: 'sab', title: 'Sábado 19', long: 'sábado 19 de septiembre', hours: '12:00 a 21:00 h', capacity: 0 },
    { id: 'dom', title: 'Domingo 20', long: 'domingo 20 de septiembre', hours: '12:00 a 20:00 h', capacity: 4 }
  ];

  var MAX_QTY = 6;
  var STEPS = [
    { label: 'Paquete', route: 'paquetes' },
    { label: 'Fecha', route: 'fecha' },
    { label: 'Cantidad', route: 'cantidad' },
    { label: 'Compra', route: 'compra' }
  ];

  var DEMO_USER = { name: 'Demo', email: 'demo@reset.gg', password: 'reset1234' };

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ */
  /* 2. Almacenamiento y sesión                                          */
  /* ------------------------------------------------------------------ */

  var KEYS = {
    users: 'reset_wf_users',
    session: 'reset_wf_session',
    tickets: 'reset_wf_tickets',
    draft: 'reset_wf_draft',
    notes: 'reset_wf_notes'
  };

  // Respaldo en memoria por si localStorage está bloqueado.
  var memory = {};
  var store = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem(key);
        if (raw !== null) return JSON.parse(raw);
      } catch (e) { /* sin localStorage: se usa la memoria */ }
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : fallback;
    },
    set: function (key, value) {
      memory[key] = value;
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* idem */ }
    },
    remove: function (key) {
      delete memory[key];
      try { window.localStorage.removeItem(key); } catch (e) { /* idem */ }
    }
  };

  function users() { return store.get(KEYS.users, []); }
  function findUser(email) {
    var e = String(email || '').trim().toLowerCase();
    return users().filter(function (u) { return u.email === e; })[0] || null;
  }
  function saveUser(user) {
    var list = users().filter(function (u) { return u.email !== user.email; });
    list.push(user);
    store.set(KEYS.users, list);
  }
  function currentUser() {
    var email = store.get(KEYS.session, null);
    return email ? findUser(email) : null;
  }
  function startSession(user) { store.set(KEYS.session, user.email); applyAuth(); }
  function endSession() {
    store.remove(KEYS.session);
    store.remove(KEYS.draft);   // la compra a medio hacer es de esa persona
    applyAuth();
  }

  // La cuenta de prueba existe siempre (se anota en la pantalla de login).
  if (!findUser(DEMO_USER.email)) saveUser(DEMO_USER);

  function draft() { return store.get(KEYS.draft, {}); }
  function saveDraft(patch) {
    var d = draft();
    Object.keys(patch).forEach(function (k) { d[k] = patch[k]; });
    store.set(KEYS.draft, d);
    return d;
  }

  function ticketsOf(user) {
    return store.get(KEYS.tickets, []).filter(function (t) { return t.email === user.email; });
  }

  /* ------------------------------------------------------------------ */
  /* 3. Utilidades                                                       */
  /* ------------------------------------------------------------------ */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function byId(list, id) { return list.filter(function (x) { return x.id === id; })[0] || null; }

  // Montos según el capítulo 8 de "Diseño de contenidos": miles separados
  // con espacio fino (no con punto) y el signo pegado a la cifra: $35 000
  function money(n) {
    return '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2)
      .map(function (p) { return p.charAt(0).toUpperCase(); }).join('') || '?';
  }

  // Aviso temporal (toast): confirma que una acción salió bien.
  function toast(text) {
    var box = $('.c-toasts');
    var el = document.createElement('div');
    el.className = 'c-toast';
    el.innerHTML = '<span>' + escapeHtml(text) + '</span>' +
      '<button class="c-toast__close" type="button" aria-label="Cerrar aviso">✕</button>';
    el.querySelector('button').addEventListener('click', function () { el.remove(); });
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, 5000);
  }

  // Mensaje que se muestra UNA vez al entrar a una pantalla (por ejemplo,
  // "iniciá sesión para obtener tu ticket" cuando la regla del wireflow
  // te manda al login).
  var pendingFlash = null;
  function flash(screen, text) { pendingFlash = { screen: screen, text: text }; }

  function showAlert(el, html) {
    el.innerHTML = html;
    el.hidden = false;
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: false });
  }
  function hideAlert(el) { if (el) { el.hidden = true; el.innerHTML = ''; } }

  // Errores al lado del campo (capítulo 3): nunca "revisá los campos en rojo".
  function setFieldError(input, message) {
    var field = input.closest('.c-field');
    var err = field.querySelector('.c-field__error');
    field.classList.add('is-invalid');
    field.classList.remove('is-valid');
    input.setAttribute('aria-invalid', 'true');
    err.textContent = message;
    err.hidden = false;
  }
  function clearFieldError(input) {
    var field = input.closest('.c-field');
    var err = field.querySelector('.c-field__error');
    field.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
    if (err) { err.hidden = true; err.textContent = ''; }
  }
  function markValid(input) {
    clearFieldError(input);
    input.closest('.c-field').classList.add('is-valid');
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* ------------------------------------------------------------------ */
  /* 4. Ruteo entre pantallas                                            */
  /* ------------------------------------------------------------------ */

  var SCREENS = ['inicio', 'login', 'registro', 'paquetes', 'fecha', 'cantidad', 'compra', 'entrada', 'cuenta'];
  // Regla del wireflow: para obtener un ticket hay que tener sesión.
  var PROTECTED = ['paquetes', 'fecha', 'cantidad', 'compra', 'entrada', 'cuenta'];
  var TITLES = {
    inicio: 'Inicio', login: 'Iniciar sesión', registro: 'Crear cuenta', paquetes: 'Elegí tu paquete',
    fecha: 'Elegí tu fecha', cantidad: 'Cantidad de personas', compra: 'Finalizar compra',
    entrada: 'Tu entrada', cuenta: 'Mi cuenta'
  };

  var currentScreen = null;
  var pendingScrollTo = null;

  function parseHash() {
    var raw = decodeURIComponent(window.location.hash.replace(/^#/, ''));
    var parts = raw.split('/');
    return { name: parts[0] || 'inicio', param: parts[1] || null };
  }

  function go(hash) {
    if (window.location.hash === hash) route();
    else window.location.hash = hash;
  }
  function redirect(hash) { window.location.replace(hash); }

  function route() {
    var r = parseHash();
    var name = r.name;
    var user = currentUser();
    closeMenu();

    // Un ancla de una sección del inicio (#cronograma, #informacion…).
    if (SCREENS.indexOf(name) === -1) {
      var target = document.getElementById(name);
      if (target && target.closest('#screen-inicio')) {
        pendingScrollTo = name;
      }
      name = 'inicio';
    }

    // Sin sesión no se entra a la compra ni a la cuenta: al login.
    if (PROTECTED.indexOf(name) !== -1 && !user) {
      flash('login', name === 'cuenta'
        ? 'Iniciá sesión para ver tu cuenta y tus entradas'
        : 'Para obtener tu ticket, iniciá sesión o creá una cuenta');
      redirect('#login');
      return;
    }
    // Con sesión, el login no tiene sentido: al inicio.
    if ((name === 'login' || name === 'registro') && user) { redirect('#inicio'); return; }

    // Los pasos de la compra van en orden: no se saltea ninguno.
    var d = draft();
    if (name === 'fecha' && !byId(PACKS, d.pack)) {
      flash('paquetes', 'Primero elegí tu paquete');
      redirect('#paquetes'); return;
    }
    if ((name === 'cantidad' || name === 'compra') && !byId(PACKS, d.pack)) {
      flash('paquetes', 'Primero elegí tu paquete');
      redirect('#paquetes'); return;
    }
    if (name === 'cantidad' || name === 'compra') {
      var date = byId(DATES, d.date);
      if (!date || date.capacity === 0) { redirect('#fecha'); return; }
    }
    if (name === 'compra') {
      var dd = byId(DATES, d.date);
      if (!d.qty || d.qty > dd.capacity) { redirect('#cantidad'); return; }
    }

    show(name, r.param);
  }

  function show(name, param) {
    var previous = currentScreen;
    $all('.screen').forEach(function (s) { s.hidden = s.getAttribute('data-screen') !== name; });
    currentScreen = name;

    var header = $('.c-header');
    var variant = name === 'inicio' ? 'home' : (name === 'login' || name === 'registro') ? 'none' : 'flow';
    header.setAttribute('data-variant', variant);
    document.body.classList.toggle('is-auth-screen', variant === 'none');
    document.title = 'RESET — ' + (TITLES[name] || 'Wireframe');

    var screen = $('#screen-' + name);
    renderFlash(screen, name);

    var renderers = {
      paquetes: renderPacks, fecha: renderDates, cantidad: renderQty, compra: renderCheckout,
      entrada: renderTicket, cuenta: renderAccount
    };
    if (renderers[name]) renderers[name](screen, param);
    $all('[data-stepper]', screen).forEach(renderStepper);

    // Posición: al cambiar de pantalla se arranca arriba; si hay un ancla
    // pendiente, se baja hasta ella.
    if (pendingScrollTo) {
      var el = document.getElementById(pendingScrollTo);
      pendingScrollTo = null;
      if (el) setTimeout(function () { el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); }, 30);
    } else if (previous !== name) {
      window.scrollTo(0, 0);
      // Accesibilidad: el lector de pantalla arranca por el título nuevo.
      var h1 = screen.querySelector('h1');
      if (h1 && name !== 'inicio') { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    }
    if (name === 'inicio') { onScroll(); updateCarousel(); }
  }

  function renderFlash(screen, name) {
    var box = screen.querySelector('[data-flash]');
    if (!box) return;
    if (pendingFlash && pendingFlash.screen === name) {
      box.textContent = pendingFlash.text;
      box.hidden = false;
    } else {
      box.hidden = true;
      box.textContent = '';
    }
    pendingFlash = null;
  }

  // Indicador de progreso de la compra (heurística 1: estado del sistema).
  // Los pasos ya hechos son enlaces para volver (heurística 3: control).
  function renderStepper(ol) {
    var current = Number(ol.getAttribute('data-stepper'));
    ol.innerHTML = STEPS.map(function (s, i) {
      var n = i + 1;
      var dot = '<span class="c-stepper__dot" aria-hidden="true">' + (n < current ? '✓' : n) + '</span>' +
        '<span class="c-stepper__label">' + s.label + '</span>';
      if (n < current) {
        return '<li class="c-stepper__item is-done"><a href="#' + s.route + '">' + dot +
          '<span class="visually-hidden"> (hecho, volver a este paso)</span></a></li>';
      }
      if (n === current) {
        return '<li class="c-stepper__item is-current" aria-current="step">' + dot +
          '<span class="visually-hidden"> (paso ' + n + ' de 4)</span></li>';
      }
      return '<li class="c-stepper__item">' + dot + '</li>';
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Estado de autenticación en el header                                */
  /* ------------------------------------------------------------------ */

  function applyAuth() {
    var user = currentUser();
    document.body.classList.toggle('is-auth', !!user);
    $all('[data-user-name]').forEach(function (el) { el.textContent = user ? user.name : ''; });
    $all('[data-user-email]').forEach(function (el) { el.textContent = user ? user.email : ''; });
    $all('[data-user-initials]').forEach(function (el) { el.textContent = user ? initials(user.name) : '?'; });
  }

  var menuToggle = $('[data-avatar-toggle]');
  var menu = $('#avatar-menu');
  function closeMenu() {
    if (!menu.hidden) { menu.hidden = true; menuToggle.setAttribute('aria-expanded', 'false'); }
  }
  menuToggle.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = menu.hidden;
    menu.hidden = !open;
    menuToggle.setAttribute('aria-expanded', String(open));
    if (open) { var first = menu.querySelector('.c-menu__item'); if (first) first.focus(); }
  });
  document.addEventListener('click', function (e) {
    if (!menu.hidden && !e.target.closest('.c-avatar-menu')) closeMenu();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !menu.hidden) { closeMenu(); menuToggle.focus(); }
  });

  // "Saltar al contenido": va al <main> sin pasar por el ruteo (si no, el
  // ancla #main se tomaría como una pantalla y mandaría al inicio).
  $('.skip-link').addEventListener('click', function (e) {
    e.preventDefault();
    var main = $('#main');
    main.setAttribute('tabindex', '-1');
    main.focus();
  });

  // Enlaces que además de navegar bajan hasta una sección ("Mis entradas").
  document.addEventListener('click', function (e) {
    var link = e.target.closest('[data-scroll-to]');
    if (!link) return;
    pendingScrollTo = link.getAttribute('data-scroll-to');
    if (window.location.hash === link.getAttribute('href')) { e.preventDefault(); route(); }
  });

  $all('[data-action="logout"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      endSession();
      toast('Cerraste sesión. Tus entradas siguen guardadas en tu cuenta');
      go('#inicio');
    });
  });

  /* ------------------------------------------------------------------ */
  /* 5a. Iniciar sesión                                                  */
  /* ------------------------------------------------------------------ */

  // Mostrar/ocultar contraseña (prevención de errores al escribir).
  $all('[data-toggle-pass]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = document.getElementById(btn.getAttribute('data-toggle-pass'));
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Ocultar' : 'Mostrar';
      btn.setAttribute('aria-pressed', String(show));
    });
  });

  // Al corregir un campo, el error desaparece enseguida.
  $all('.c-form input').forEach(function (input) {
    input.addEventListener('input', function () {
      if (input.getAttribute('aria-invalid') === 'true') clearFieldError(input);
    });
  });

  // Después de iniciar sesión se vuelve al INICIO (regla del wireflow),
  // donde ahora aparece "Obtener ticket".
  function welcome(user, created) {
    startSession(user);
    toast(created
      ? 'Cuenta creada. Te damos la bienvenida, ' + user.name + '. Ya podés obtener tu ticket'
      : 'Hola, ' + user.name + '. Ya podés obtener tu ticket');
    go('#inicio');
  }

  $('#form-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('#login-email');
    var pass = $('#login-pass');
    var ok = true;

    var value = email.value.trim().toLowerCase();
    if (!value) { setFieldError(email, 'Escribí tu mail'); ok = false; }
    else if (!EMAIL_RE.test(value)) { setFieldError(email, 'Revisá el mail: le falta la @ o el dominio (ejemplo: nombre@mail.com)'); ok = false; }
    if (!pass.value) { setFieldError(pass, 'Escribí tu contraseña'); ok = false; }
    if (!ok) { $('[aria-invalid="true"]', this).focus(); return; }

    var user = findUser(value);
    if (!user) {
      setFieldError(email, 'No encontramos una cuenta con este mail. Revisalo o creá una cuenta nueva');
      email.focus(); return;
    }
    if (user.password !== pass.value) {
      setFieldError(pass, 'La contraseña no coincide con la de este mail. Probá de nuevo');
      pass.focus(); return;
    }
    this.reset();
    welcome(user, false);
  });

  // Ingreso con otra cuenta: simulado, crea un usuario de prueba.
  $all('[data-social]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var provider = btn.getAttribute('data-social');
      var email = provider.toLowerCase() + '.demo@reset.gg';
      var user = findUser(email);
      if (!user) { user = { name: 'Jugador ' + provider, email: email, password: null }; saveUser(user); }
      welcome(user, false);
    });
  });

  /* ------------------------------------------------------------------ */
  /* 5b. Registrarse                                                     */
  /* ------------------------------------------------------------------ */

  var regRules = {
    'reg-name': function (v) { return v.trim().length >= 2 ? '' : 'Escribí tu nombre (al menos 2 letras)'; },
    'reg-email': function (v) {
      var e = v.trim().toLowerCase();
      if (!e) return 'Escribí tu mail';
      if (!EMAIL_RE.test(e)) return 'Revisá el mail: le falta la @ o el dominio (ejemplo: nombre@mail.com)';
      if (findUser(e)) return 'Ya hay una cuenta con este mail. Iniciá sesión con él';
      return '';
    },
    'reg-pass': function (v) { return v.length >= 8 ? '' : 'La contraseña necesita al menos 8 caracteres'; },
    'reg-pass2': function (v) { return v && v === $('#reg-pass').value ? '' : 'Las contraseñas no coinciden'; }
  };

  // Validación al salir de cada campo: el error aparece antes de enviar.
  Object.keys(regRules).forEach(function (id) {
    var input = document.getElementById(id);
    input.addEventListener('blur', function () {
      if (!input.value) return;            // no retar por un campo que todavía no se tocó
      var msg = regRules[id](input.value);
      if (msg) setFieldError(input, msg); else markValid(input);
    });
  });

  $('#form-registro').addEventListener('submit', function (e) {
    e.preventDefault();
    var firstBad = null;
    Object.keys(regRules).forEach(function (id) {
      var input = document.getElementById(id);
      var msg = regRules[id](input.value);
      if (msg) { setFieldError(input, msg); firstBad = firstBad || input; } else markValid(input);
    });
    if (firstBad) { firstBad.focus(); return; }

    var user = {
      name: $('#reg-name').value.trim(),
      email: $('#reg-email').value.trim().toLowerCase(),
      password: $('#reg-pass').value
    };
    saveUser(user);
    this.reset();
    $all('.c-field', this).forEach(function (f) { f.classList.remove('is-valid'); });
    welcome(user, true);
  });

  /* ------------------------------------------------------------------ */
  /* 5c. Elegir paquete                                                  */
  /* ------------------------------------------------------------------ */

  function renderPacks(screen) {
    var box = screen.querySelector('[data-options="pack"]');
    var chosen = draft().pack;
    box.innerHTML = PACKS.map(function (p) {
      var sel = p.id === chosen;
      return '<div role="listitem"><button type="button" class="c-option' + (sel ? ' is-selected' : '') +
        '" data-pack="' + p.id + '" aria-pressed="' + sel + '">' +
        '<div class="c-ph c-ph--icon"><span class="c-ph__label">[ÍCONO]</span></div>' +
        '<span class="c-option__title">' + p.name + '</span>' +
        '<span class="c-option__price">' + money(p.price) + '</span>' +
        '<span class="c-option__meta">por persona, por día</span>' +
        '<ul class="c-option__list">' + p.items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>' +
        '<span class="c-option__cta">Elegir ' + p.name + '</span></button></div>';
    }).join('');

    $all('[data-pack]', box).forEach(function (btn) {
      btn.addEventListener('click', function () {
        saveDraft({ pack: btn.getAttribute('data-pack') });
        $all('[data-pack]', box).forEach(function (b) {
          b.classList.toggle('is-selected', b === btn);
          b.setAttribute('aria-pressed', String(b === btn));
        });
        // Breve pausa para que se vea el estado "Elegido" antes de avanzar.
        setTimeout(function () { go('#fecha'); }, reduceMotion ? 0 : 280);
      });
    });
  }

  // Línea de "lo que ya elegiste" con enlace para cambiarlo
  // (heurística 6: reconocer antes que recordar).
  function summaryLine(parts) {
    return parts.map(function (p) {
      return '<span>' + p.label + ': <strong>' + escapeHtml(p.value) + '</strong> ' +
        '<a href="#' + p.route + '">Cambiar<span class="visually-hidden"> ' + p.label.toLowerCase() + '</span></a></span>';
    }).join(' · ');
  }

  /* ------------------------------------------------------------------ */
  /* 5d. Elegir fecha                                                    */
  /* ------------------------------------------------------------------ */

  function availabilityText(date) {
    if (date.capacity === 0) return 'Agotada';
    if (date.capacity <= 10) return 'Quedan ' + date.capacity + ' lugares';
    return 'Disponible';
  }

  function renderDates(screen) {
    var d = draft();
    var pack = byId(PACKS, d.pack);
    screen.querySelector('[data-summary-line]').innerHTML =
      summaryLine([{ label: 'Paquete', value: pack.name, route: 'paquetes' }]);
    var errorBox = screen.querySelector('[data-error]');
    hideAlert(errorBox);

    var box = screen.querySelector('[data-options="date"]');
    box.innerHTML = DATES.map(function (date) {
      var sel = date.id === d.date;
      var off = date.capacity === 0;
      return '<div role="listitem"><button type="button" class="c-option' + (sel ? ' is-selected' : '') +
        (off ? ' is-unavailable' : '') + '" data-date="' + date.id + '" aria-pressed="' + sel + '"' +
        (off ? ' aria-disabled="true"' : '') + '>' +
        '<span class="c-badge' + (off ? '' : ' c-badge--outline') + '">' + availabilityText(date) + '</span>' +
        '<span class="c-option__title">' + date.title + '</span>' +
        '<span class="c-option__meta">de septiembre de 2026 · ' + date.hours + '</span>' +
        '<span class="c-option__cta">' + (off ? 'Sin lugares' : 'Elegir esta fecha') + '</span></button></div>';
    }).join('');

    $all('[data-date]', box).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var date = byId(DATES, btn.getAttribute('data-date'));
        // Rama "¿Fecha disponible? No" del userflow: avisar y quedarse acá.
        if (date.capacity === 0) {
          showAlert(errorBox, 'No quedan lugares para el ' + date.long + '. Elegí otra fecha');
          return;
        }
        hideAlert(errorBox);
        saveDraft({ date: date.id });
        $all('[data-date]', box).forEach(function (b) {
          b.classList.toggle('is-selected', b === btn);
          b.setAttribute('aria-pressed', String(b === btn));
        });
        setTimeout(function () { go('#cantidad'); }, reduceMotion ? 0 : 280);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 5e. Cantidad de personas                                            */
  /* ------------------------------------------------------------------ */

  function renderQty(screen) {
    var d = draft();
    var pack = byId(PACKS, d.pack);
    var date = byId(DATES, d.date);
    var qty = Math.min(Math.max(Number(d.qty) || 1, 1), MAX_QTY);
    saveDraft({ qty: qty });

    screen.querySelector('[data-summary-line]').innerHTML = summaryLine([
      { label: 'Paquete', value: pack.name, route: 'paquetes' },
      { label: 'Fecha', value: date.title, route: 'fecha' }
    ]);
    hideAlert(screen.querySelector('[data-error]'));
    updateQty(screen, qty);
  }

  function updateQty(screen, qty) {
    var pack = byId(PACKS, draft().pack);
    screen.querySelector('#qty-value').textContent = qty;
    screen.querySelector('[data-qty-subtotal]').textContent = money(pack.price * qty);
    screen.querySelector('[data-qty="-1"]').disabled = qty <= 1;
    screen.querySelector('[data-qty="1"]').disabled = qty >= MAX_QTY;
  }

  $all('[data-qty]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var screen = $('#screen-cantidad');
      var qty = Math.min(Math.max((Number(draft().qty) || 1) + Number(btn.getAttribute('data-qty')), 1), MAX_QTY);
      saveDraft({ qty: qty });
      hideAlert(screen.querySelector('[data-error]'));
      updateQty(screen, qty);
    });
  });

  $('[data-action="to-checkout"]').addEventListener('click', function () {
    var screen = $('#screen-cantidad');
    var d = draft();
    var date = byId(DATES, d.date);
    // Rama "¿Cupo disponible? No" del userflow.
    if (d.qty > date.capacity) {
      showAlert(screen.querySelector('[data-error]'),
        'Para el ' + date.long + ' quedan ' + date.capacity + ' lugares. ' +
        '<button type="button" data-fix-qty="' + date.capacity + '">Bajar a ' + date.capacity + ' personas</button> ' +
        'o <a href="#fecha">elegir otra fecha</a>');
      var fix = screen.querySelector('[data-fix-qty]');
      fix.addEventListener('click', function () {
        saveDraft({ qty: date.capacity });
        hideAlert(screen.querySelector('[data-error]'));
        updateQty(screen, date.capacity);
      });
      return;
    }
    go('#compra');
  });

  /* ------------------------------------------------------------------ */
  /* 5f. Página de compra                                                */
  /* ------------------------------------------------------------------ */

  function renderCheckout(screen) {
    var d = draft();
    var pack = byId(PACKS, d.pack);
    var date = byId(DATES, d.date);
    var total = pack.price * d.qty;

    var row = function (label, value, route) {
      return '<dt>' + label + '</dt><dd>' + escapeHtml(value) +
        (route ? '<a href="#' + route + '">Cambiar<span class="visually-hidden"> ' + label.toLowerCase() + '</span></a>' : '') + '</dd>';
    };
    screen.querySelector('[data-summary]').innerHTML =
      row('Paquete', pack.name, 'paquetes') +
      row('Fecha', date.title + ' de septiembre', 'fecha') +
      row('Personas', String(d.qty), 'cantidad') +
      row('Precio por persona', money(pack.price));
    screen.querySelector('[data-total]').textContent = money(total);
    hideAlert(screen.querySelector('[data-error]'));

    // Se sugiere el nombre de la cuenta como titular (menos para escribir).
    var holder = $('#pay-holder');
    var user = currentUser();
    if (!holder.value && user && user.name) holder.value = user.name;
    syncMethod();
  }

  function syncMethod() {
    var method = ($('input[name="method"]:checked') || {}).value;
    var wallet = method === 'billetera';
    $('[data-card-fields]').hidden = wallet;
    $('[data-wallet]').hidden = !wallet;
  }
  $all('input[name="method"]').forEach(function (r) { r.addEventListener('change', syncMethod); });

  // Formato mientras se escribe: grupos de 4 en la tarjeta, barra en el vencimiento.
  $('#pay-number').addEventListener('input', function () {
    var digits = this.value.replace(/\D/g, '').slice(0, 16);
    this.value = digits.replace(/(.{4})(?=.)/g, '$1 ');
  });
  $('#pay-exp').addEventListener('input', function () {
    var digits = this.value.replace(/\D/g, '').slice(0, 4);
    this.value = digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits;
  });
  $('#pay-cvv').addEventListener('input', function () { this.value = this.value.replace(/\D/g, '').slice(0, 4); });

  var payRules = {
    'pay-number': function (v) {
      var n = v.replace(/\D/g, '');
      if (!n) return 'Escribí el número de la tarjeta';
      return n.length === 16 ? '' : 'El número tiene que tener 16 cifras (tiene ' + n.length + ')';
    },
    'pay-exp': function (v) {
      var m = /^(\d{2})\/(\d{2})$/.exec(v);
      if (!m) return 'Escribí el vencimiento como figura en la tarjeta: MM/AA';
      var month = Number(m[1]), year = 2000 + Number(m[2]);
      if (month < 1 || month > 12) return 'El mes tiene que ir de 01 a 12';
      var now = new Date();
      if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
        return 'Esta tarjeta está vencida. Usá otra tarjeta';
      }
      return '';
    },
    'pay-cvv': function (v) { return /^\d{3,4}$/.test(v) ? '' : 'Escribí los 3 números del dorso de la tarjeta'; },
    'pay-holder': function (v) { return v.trim().length >= 3 ? '' : 'Escribí el nombre como figura en la tarjeta'; }
  };
  Object.keys(payRules).forEach(function (id) {
    var input = document.getElementById(id);
    input.addEventListener('blur', function () {
      if (!input.value) return;
      var msg = payRules[id](input.value);
      if (msg) setFieldError(input, msg); else markValid(input);
    });
  });

  var paying = false;
  $('#form-pago').addEventListener('submit', function (e) {
    e.preventDefault();
    if (paying) return;                       // evita el doble cobro por doble clic
    var screen = $('#screen-compra');
    var errorBox = screen.querySelector('[data-error]');
    hideAlert(errorBox);

    var wallet = $('input[name="method"]:checked').value === 'billetera';
    if (!wallet) {
      var firstBad = null;
      Object.keys(payRules).forEach(function (id) {
        var input = document.getElementById(id);
        var msg = payRules[id](input.value);
        if (msg) { setFieldError(input, msg); firstBad = firstBad || input; } else markValid(input);
      });
      if (firstBad) { firstBad.focus(); return; }
    }

    var button = $('[data-pay-button]');
    paying = true;
    button.disabled = true;
    button.classList.add('is-loading');
    button.textContent = 'Procesando pago…';

    setTimeout(function () {
      paying = false;
      button.disabled = false;
      button.classList.remove('is-loading');
      button.textContent = 'Confirmar y pagar';

      // Rama "¿Pago válido? No": tarjeta de prueba terminada en 0000.
      var number = $('#pay-number').value.replace(/\D/g, '');
      if (!wallet && /0000$/.test(number)) {
        showAlert(errorBox, '<strong>El banco rechazó el pago.</strong> No se cobró nada. ' +
          'Probá con otra tarjeta o elegí otro medio de pago');
        setFieldError($('#pay-number'), 'Esta tarjeta fue rechazada');
        return;
      }
      completePurchase();
    }, reduceMotion ? 300 : 1200);
  });

  function newTicketCode() {
    var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin O/0 ni I/1: se confunden
    var code = '';
    for (var i = 0; i < 4; i++) code += abc.charAt(Math.floor(Math.random() * abc.length));
    return 'RST-' + code;
  }

  var justPurchased = null;
  function completePurchase() {
    var d = draft();
    var user = currentUser();
    var pack = byId(PACKS, d.pack);
    var ticket = {
      id: newTicketCode(), email: user.email, holder: user.name,
      pack: d.pack, date: d.date, qty: d.qty, total: pack.price * d.qty,
      createdAt: new Date().toISOString()
    };
    var all = store.get(KEYS.tickets, []);
    all.push(ticket);
    store.set(KEYS.tickets, all);      // la entrada queda asociada a la cuenta
    store.remove(KEYS.draft);
    // Los datos de la tarjeta NO se guardan en ningún lado.
    $('#form-pago').reset();
    $all('#form-pago .c-field').forEach(function (f) { f.classList.remove('is-valid', 'is-invalid'); });
    justPurchased = ticket.id;
    go('#entrada/' + ticket.id);
  }

  /* ------------------------------------------------------------------ */
  /* 5g. Entrada con QR                                                  */
  /* ------------------------------------------------------------------ */

  // QR SIMULADO: un dibujo con la forma de un QR (los tres cuadrados de
  // las esquinas + módulos generados a partir del código de la entrada).
  // Siempre da el mismo dibujo para el mismo código. No se puede escanear:
  // en un wireframe alcanza con mostrar DÓNDE va y QUÉ tamaño tiene.
  function drawQR(canvas, text) {
    var N = 25, quiet = 2, total = N + quiet * 2;
    var ctx = canvas.getContext('2d');
    var cell = Math.floor(canvas.width / total);
    var offset = Math.floor((canvas.width - cell * total) / 2);
    var seed = 0;
    for (var i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
    function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1b1b1b';
    function mod(x, y) { ctx.fillRect(offset + (x + quiet) * cell, offset + (y + quiet) * cell, cell, cell); }
    function inFinder(x, y) {
      return (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
    }
    function finder(fx, fy) {
      for (var y = 0; y < 7; y++) for (var x = 0; x < 7; x++) {
        var edge = x === 0 || y === 0 || x === 6 || y === 6;
        var core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (edge || core) mod(fx + x, fy + y);
      }
    }
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      if (!inFinder(x, y) && rand() > 0.52) mod(x, y);
    }
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
  }

  function ticketTitle(t) {
    var pack = byId(PACKS, t.pack), date = byId(DATES, t.date);
    return (pack ? pack.name : t.pack) + ' · ' + (date ? date.title + ' de septiembre' : t.date);
  }

  function renderTicket(screen, id) {
    var user = currentUser();
    var ticket = ticketsOf(user).filter(function (t) { return t.id === id; })[0];
    if (!ticket) {
      toast('No encontramos esa entrada en tu cuenta');
      redirect('#cuenta');
      return;
    }
    // "¡Compra confirmada!" sólo al llegar desde el pago, no al consultarla.
    screen.querySelector('[data-success]').hidden = justPurchased !== ticket.id;
    justPurchased = null;

    var pack = byId(PACKS, ticket.pack), date = byId(DATES, ticket.date);
    screen.querySelector('[data-ticket-data]').innerHTML =
      '<dt>Código</dt><dd>' + ticket.id + '</dd>' +
      '<dt>Paquete</dt><dd>' + pack.name + '</dd>' +
      '<dt>Fecha</dt><dd>' + date.title + ' de septiembre · ' + date.hours + '</dd>' +
      '<dt>Personas</dt><dd>' + ticket.qty + '</dd>' +
      '<dt>Titular</dt><dd>' + escapeHtml(ticket.holder) + '</dd>' +
      '<dt>Total</dt><dd>' + money(ticket.total) + '</dd>';
    var canvas = screen.querySelector('[data-qr]');
    canvas.setAttribute('aria-label', 'Código QR de la entrada ' + ticket.id);
    drawQR(canvas, ticket.id);
  }

  /* ------------------------------------------------------------------ */
  /* 5h. Mi cuenta                                                       */
  /* ------------------------------------------------------------------ */

  function renderAccount(screen) {
    var user = currentUser();
    var list = ticketsOf(user).slice().reverse();     // la más nueva primero
    var ul = screen.querySelector('[data-ticket-list]');
    screen.querySelector('[data-empty]').hidden = list.length > 0;
    ul.innerHTML = list.map(function (t) {
      return '<li class="c-ticket-row" data-component="TicketRow">' +
        '<canvas class="c-ticket-row__qr" width="58" height="58" data-mini-qr="' + t.id + '" aria-hidden="true"></canvas>' +
        '<div><h3>' + escapeHtml(ticketTitle(t)) + '</h3>' +
        '<p>' + t.qty + (t.qty === 1 ? ' persona' : ' personas') + ' · Código ' + t.id + '</p></div>' +
        '<a class="c-button c-button--secondary c-button--sm" href="#entrada/' + t.id + '">Ver QR<span class="visually-hidden"> de ' + t.id + '</span></a></li>';
    }).join('');
    $all('[data-mini-qr]', ul).forEach(function (c) { drawQR(c, c.getAttribute('data-mini-qr')); });
  }

  /* ------------------------------------------------------------------ */
  /* 6. Interacciones del inicio                                         */
  /* ------------------------------------------------------------------ */

  // 6a. Barra de nivel + objetos 3D que se mueven con el scroll.
  var xpFill = $('[data-xp-fill]');
  var xpLabel = $('[data-xp-label]');
  var parallaxEls = $all('[data-parallax]');
  var ticking = false;

  function onScroll() {
    if (currentScreen !== 'inicio') return;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
    xpFill.style.width = (p * 100).toFixed(1) + '%';
    xpLabel.textContent = p >= 0.98 ? 'Nivel 10 · ¡completo!' : 'Nivel ' + Math.floor(p * 10) + ' de 10';

    if (reduceMotion) return;
    var vh = window.innerHeight;
    parallaxEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var factor = Number(el.getAttribute('data-parallax')) || 0.2;
      var offset = (r.top + r.height / 2 - vh / 2) / vh;      // −1 … 1 aprox.
      var rot = Math.max(-28, Math.min(28, offset * -120 * factor));   // nunca de canto
      el.style.setProperty('--rot', rot.toFixed(1) + 'deg');
      el.style.setProperty('--shift', (offset * 80 * factor).toFixed(1) + 'px');
    });
  }
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { ticking = false; onScroll(); });
  }, { passive: true });
  window.addEventListener('resize', onScroll);

  // 6b. Aparición de bloques al entrar en pantalla.
  var reveals = $all('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); revealObs.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { revealObs.observe(el); });
  }

  // 6c. Scroll narrativo de la encuesta: el dato que está en el centro de la
  // pantalla es el activo; el control rota y la batería baja.
  var steps = $all('.story__step');
  var storyObj = $('[data-story-object]');
  function setStory(i) {
    var step = steps[i];
    steps.forEach(function (s, j) { s.classList.toggle('is-active', j === i); });
    $('[data-story-battery]').style.width = step.getAttribute('data-battery') + '%';
    $('[data-story-label]').textContent = step.getAttribute('data-label');
    $('[data-story-count]').textContent = (i + 1) + ' / ' + steps.length;
    if (!reduceMotion) storyObj.style.setProperty('--rot', ((i - 2) * 14) + 'deg');
  }
  if ('IntersectionObserver' in window) {
    var storyObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) setStory(Number(en.target.getAttribute('data-step')));
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(function (s) { storyObs.observe(s); });
  } else {
    steps.forEach(function (s) { s.classList.add('is-active'); });
  }

  // 6d. "Información" / "Cronograma" se marcan en el menú según dónde estás.
  var navLinks = $all('[data-nav]');
  if ('IntersectionObserver' in window) {
    var navObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var link = $('[data-nav="' + en.target.id + '"]');
        if (link) link.classList.toggle('is-current', en.isIntersecting);
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    navLinks.forEach(function (a) {
      var sec = document.getElementById(a.getAttribute('data-nav'));
      if (sec) navObs.observe(sec);
    });
  }

  // 6e. Pestañas accesibles (clic + flechas del teclado).
  $all('[data-tabs]').forEach(function (tabs) {
    var list = $all('[role="tab"]', tabs);
    function select(tab, focus) {
      list.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    }
    list.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab, false); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight') next = list[(i + 1) % list.length];
        if (e.key === 'ArrowLeft') next = list[(i - 1 + list.length) % list.length];
        if (e.key === 'Home') next = list[0];
        if (e.key === 'End') next = list[list.length - 1];
        if (next) { e.preventDefault(); select(next, true); }
      });
    });
  });

  // 6f. Carrusel de actividades: flechas + contador "1–3 de 12".
  var track = $('[data-carousel-track]');
  var prevBtn = $('[data-carousel-prev]');
  var nextBtn = $('[data-carousel-next]');
  var countEl = $('[data-carousel-count]');
  function carouselInfo() {
    var cards = track.children;
    var step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth;
    if (!step || step <= 0) return null;     // el inicio está oculto: no hay medidas
    var perView = Math.max(1, Math.round(track.clientWidth / step));
    var first = Math.round(track.scrollLeft / step);
    return { step: step, perView: perView, first: first, total: cards.length };
  }
  function updateCarousel() {
    var c = carouselInfo();
    if (!c) return;
    var last = Math.min(c.first + c.perView, c.total);
    countEl.textContent = (c.perView === 1 ? (c.first + 1) : (c.first + 1) + '–' + last) + ' de ' + c.total;
    prevBtn.disabled = track.scrollLeft <= 2;
    nextBtn.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  }
  prevBtn.addEventListener('click', function () { var c = carouselInfo(); if (c) track.scrollBy({ left: -c.step * c.perView }); });
  nextBtn.addEventListener('click', function () { var c = carouselInfo(); if (c) track.scrollBy({ left: c.step * c.perView }); });
  track.addEventListener('scroll', function () { window.requestAnimationFrame(updateCarousel); }, { passive: true });
  window.addEventListener('resize', updateCarousel);

  // 6g. Herramientas del wireframe (pie): anotaciones y reinicio de la demo.
  var notesBtn = $('[data-action="toggle-notes"]');
  function applyNotes(on) {
    document.body.classList.toggle('show-notes', on);
    notesBtn.setAttribute('aria-pressed', String(on));
    notesBtn.textContent = on ? 'Anotaciones: visibles' : 'Anotaciones: ocultas';
  }
  notesBtn.addEventListener('click', function () {
    var on = !document.body.classList.contains('show-notes');
    store.set(KEYS.notes, on);
    applyNotes(on);
  });
  $('[data-action="reset-demo"]').addEventListener('click', function () {
    if (!window.confirm('¿Reiniciar la demo? Se borran las cuentas y las entradas de prueba')) return;
    Object.keys(KEYS).forEach(function (k) { store.remove(KEYS[k]); });
    saveUser(DEMO_USER);
    applyAuth();
    toast('Demo reiniciada');
    go('#inicio');
  });

  /* ------------------------------------------------------------------ */
  /* 7. Arranque                                                         */
  /* ------------------------------------------------------------------ */

  applyNotes(store.get(KEYS.notes, true));
  applyAuth();
  window.addEventListener('hashchange', route);
  route();
  updateCarousel();
})();
