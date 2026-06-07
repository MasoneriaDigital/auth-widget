/*!
 * Masonería Digital — Auth Widget v1
 * Injects a sign-up / sign-in icon next to the hamburger button on any Webflow
 * page, with a modal styled after the Desafío 33 trivia look. Reads config from
 * the script tag's data-* attributes:
 *   data-supabase-url        (required)
 *   data-supabase-anon-key   (required)
 *   data-trivia-url          (optional, default "/desafio33")
 */
(function () {
  'use strict';

  // -- config ---------------------------------------------------------------
  var thisScript = document.currentScript ||
    (function () {
      var ss = document.getElementsByTagName('script');
      for (var i = ss.length - 1; i >= 0; i--) {
        if (ss[i].src && ss[i].src.indexOf('auth-widget') !== -1) return ss[i];
      }
      return null;
    })();

  var SUPABASE_URL = thisScript && thisScript.getAttribute('data-supabase-url');
  var SUPABASE_ANON_KEY = thisScript && thisScript.getAttribute('data-supabase-anon-key');
  var TRIVIA_URL = (thisScript && thisScript.getAttribute('data-trivia-url')) || '/desafio33';
  // Where the email confirmation / password-reset links should land. Must be a
  // public production URL (NOT localhost), and must be listed in Supabase
  // Auth → URL Configuration → Redirect URLs.
  var SITE_URL = (thisScript && thisScript.getAttribute('data-site-url')) || 'https://www.masoneria.digital';
  SITE_URL = SITE_URL.replace(/\/+$/, '') + '/';

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[md-auth] Missing data-supabase-url / data-supabase-anon-key. Aborting.');
    return;
  }

  // -- styles ---------------------------------------------------------------
  var CSS = [
    "@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&family=Montserrat:wght@400;500;600&display=swap');",

    // Trigger button (sits next to the hamburger)
    "#md-auth-trigger{position:absolute;display:inline-flex;align-items:center;gap:8px;background:transparent;border:1px solid rgba(194,61,224,.35);color:#f2f2f3;border-radius:999px;padding:8px 12px;font-family:Montserrat,sans-serif;font-size:13px;font-weight:500;cursor:pointer;z-index:1200;transition:background .25s,border-color .25s,transform .15s;line-height:1}",
    "#md-auth-trigger:hover{background:rgba(194,61,224,.12);border-color:rgba(194,61,224,.7)}",
    "#md-auth-trigger:active{transform:scale(.97)}",
    "#md-auth-trigger .md-auth-icon{width:18px;height:18px;display:block;flex-shrink:0}",
    "#md-auth-trigger.logged-in{padding:5px 12px 5px 5px}",
    "#md-auth-trigger .md-auth-avatar{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#c23de0 0%,#B8A36A 100%);color:#fff;font-weight:600;font-size:12px;letter-spacing:.5px;font-family:Montserrat,sans-serif}",
    "#md-auth-trigger .md-auth-username{font-weight:500;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    // hide username text on small screens to save space
    "@media (max-width:480px){#md-auth-trigger .md-auth-username{display:none}#md-auth-trigger.logged-in{padding:4px}}",

    // Modal
    ".md-auth-modal{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;font-family:Montserrat,sans-serif;color:#f2f2f3}",
    ".md-auth-modal.open{display:flex;animation:md-auth-fade .25s ease-out}",
    "@keyframes md-auth-fade{from{opacity:0}to{opacity:1}}",
    "@keyframes md-auth-scale{from{transform:scale(.96);opacity:0}to{transform:scale(1);opacity:1}}",
    ".md-auth-backdrop{position:absolute;inset:0;background:rgba(8,8,10,.78);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}",
    ".md-auth-card{position:relative;width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow-y:auto;background:#1f1f21;border:1px solid rgba(194,61,224,.4);border-radius:14px;padding:28px 26px 26px;box-shadow:0 20px 60px rgba(0,0,0,.55),0 0 0 1px rgba(184,163,106,.12) inset;animation:md-auth-scale .25s ease-out}",
    ".md-auth-close{position:absolute;top:10px;right:12px;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;background:transparent;border:none;color:#a7a7ad;font-size:22px;line-height:1;cursor:pointer;border-radius:8px;transition:background .2s,color .2s}",
    ".md-auth-close:hover{background:rgba(255,255,255,.06);color:#fff}",

    // Views
    ".md-auth-view{display:none}",
    ".md-auth-view.active{display:block}",
    ".md-auth-title{font-family:'Cinzel',serif;font-weight:600;font-size:22px;letter-spacing:.04em;color:#B8A36A;text-align:center;text-transform:uppercase;margin:0 0 10px}",
    ".md-auth-title-success{color:#7fcf8f}",
    ".md-auth-sub{text-align:center;color:#c8c8cd;font-size:14px;line-height:1.5;margin:0 0 22px}",

    // Forms
    ".md-auth-card form{display:flex;flex-direction:column;gap:14px}",
    ".md-auth-card label{display:block;font-size:13px;color:#d7d7dc;font-weight:500}",
    ".md-auth-card label > span{display:block;margin-bottom:6px}",
    ".md-auth-card input[type=email],.md-auth-card input[type=password],.md-auth-card input[type=text]{box-sizing:border-box;width:100%;padding:11px 14px;background:rgba(31,31,33,.7);border:1px solid #4a4a52;border-radius:8px;color:#f2f2f3;font:inherit;font-size:14px;transition:border-color .2s,box-shadow .2s;outline:none}",
    ".md-auth-card input:focus{border-color:#B8A36A;box-shadow:0 0 0 3px rgba(184,163,106,.18)}",
    ".md-auth-card input::placeholder{color:#7a7a82}",
    ".md-auth-checkbox{display:flex !important;align-items:center;gap:10px;color:#a7a7ad;font-size:13px;font-weight:400;margin-top:2px;cursor:pointer}",
    ".md-auth-checkbox input{width:16px;height:16px;accent-color:#c23de0;cursor:pointer;margin:0}",
    ".md-auth-checkbox > span{margin:0 !important}",

    // Buttons
    ".md-auth-btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:11px 14px;background:rgba(194,61,224,.22);border:1px solid rgba(194,61,224,.55);border-radius:8px;color:#fff;font:inherit;font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;text-decoration:none;transition:background .2s,transform .15s,border-color .2s;margin-top:4px}",
    ".md-auth-btn-primary:hover{background:rgba(194,61,224,.32);border-color:rgba(194,61,224,.85)}",
    ".md-auth-btn-primary:active{transform:scale(.98)}",
    ".md-auth-btn-primary[disabled]{opacity:.55;cursor:not-allowed}",
    ".md-auth-btn-block{width:100%}",
    ".md-auth-btn-ghost{display:inline-block;width:100%;padding:9px;background:transparent;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#a7a7ad;font:inherit;font-size:12px;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;margin-top:14px;transition:color .2s,border-color .2s}",
    ".md-auth-btn-ghost:hover{color:#fff;border-color:rgba(255,255,255,.25)}",

    // Links / sublinks
    ".md-auth-links{display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.06);text-align:center}",
    ".md-auth-links a{color:#f2f2f3;font-size:13px;text-decoration:none;border-bottom:1px solid transparent;transition:color .2s,border-color .2s}",
    ".md-auth-links a:hover{color:#B8A36A;border-color:#B8A36A}",
    ".md-auth-muted{color:#7a7a82;font-size:12px}",

    // Check-email view
    ".md-auth-email-display{text-align:center;color:#c23de0;font-size:15px;margin:6px 0 16px;word-break:break-all}",
    ".md-auth-fineprint{text-align:center;color:#8a8a92;font-size:12px;line-height:1.55;margin:0 0 18px}",

    // Profile view
    ".md-auth-profile-header{display:flex;align-items:center;gap:14px;margin-bottom:18px}",
    ".md-auth-avatar-lg{width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#c23de0 0%,#B8A36A 100%);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:20px;font-family:Montserrat,sans-serif;flex-shrink:0;letter-spacing:.5px;box-shadow:0 4px 12px rgba(194,61,224,.3)}",
    ".md-auth-profile-name{font-family:'Cinzel',serif;font-weight:600;font-size:17px;color:#f2f2f3;line-height:1.2}",
    ".md-auth-profile-email{font-size:12px;color:#8a8a92;margin-top:3px;word-break:break-all}",
    ".md-auth-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px}",
    ".md-auth-stat{background:rgba(255,255,255,.03);border:1px solid rgba(184,163,106,.18);border-radius:10px;padding:11px 6px;text-align:center}",
    ".md-auth-stat-value{font-family:'Cinzel',serif;font-weight:600;font-size:18px;color:#B8A36A;line-height:1}",
    ".md-auth-stat-label{font-size:10px;color:#a7a7ad;margin-top:5px;letter-spacing:.02em;line-height:1.3}",
    ".md-auth-unlock-teaser{margin-top:18px;padding:14px;background:rgba(194,61,224,.06);border:1px dashed rgba(194,61,224,.35);border-radius:10px}",
    ".md-auth-unlock-title{font-family:'Cinzel',serif;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#c23de0;margin-bottom:8px;text-align:center}",
    ".md-auth-unlock-list{margin:0;padding:0;list-style:none;font-size:12px;color:#c8c8cd;line-height:1.7}",
    ".md-auth-unlock-list li{padding-left:0}",

    // Toast
    ".md-auth-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,20px);background:#1f1f21;border:1px solid #4a4a52;color:#f2f2f3;padding:11px 18px;border-radius:10px;font:14px Montserrat,sans-serif;font-weight:500;z-index:100000;opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;box-shadow:0 8px 28px rgba(0,0,0,.5);max-width:calc(100vw - 32px)}",
    ".md-auth-toast.show{opacity:1;transform:translate(-50%,0);pointer-events:auto}",
    ".md-auth-toast-success{border-color:#7fcf8f;color:#cfe8d4}",
    ".md-auth-toast-error{border-color:#cf6f6f;color:#f0d4d4}",

    // The nav link we inject inside the menu (inherits .nav-link styles from Webflow but tinted)
    "#md-auth-nav-link{cursor:pointer}",

    // Library (bookmarks) section in the profile
    ".md-auth-library{margin-top:18px}",
    ".md-auth-library-title{font-family:'Cinzel',serif;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#B8A36A;margin-bottom:8px;display:flex;align-items:center;gap:6px}",
    ".md-auth-library-count{color:#8a8a92;font-family:Montserrat,sans-serif;font-size:11px;letter-spacing:0;text-transform:none}",
    ".md-auth-library-list{display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto}",
    ".md-auth-library-empty{color:#7a7a82;font-size:12px;text-align:center;padding:8px 0}",
    ".md-auth-library-item{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.03);border:1px solid rgba(184,163,106,.18);border-radius:8px;padding:8px 10px}",
    ".md-auth-library-item a{flex:1;color:#e7e7ea;font-size:13px;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".md-auth-library-item a:hover{color:#B8A36A}",
    ".md-auth-library-remove{background:none;border:none;color:#8a8a92;cursor:pointer;font-size:16px;line-height:1;padding:2px 4px;border-radius:6px}",
    ".md-auth-library-remove:hover{color:#cf6f6f;background:rgba(207,111,111,.1)}",

    // Floating article actions (bookmark + share) on article pages
    "#md-article-actions{position:fixed;right:18px;bottom:18px;z-index:1200;display:flex;flex-direction:column;gap:8px;align-items:flex-end}",
    ".md-fab{display:inline-flex;align-items:center;gap:8px;background:#1f1f21;color:#f2f2f3;border:1px solid rgba(194,61,224,.45);border-radius:999px;padding:10px 16px;font:600 13px Montserrat,sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.45);transition:background .2s,border-color .2s,transform .15s}",
    ".md-fab:hover{background:rgba(194,61,224,.14);border-color:rgba(194,61,224,.8)}",
    ".md-fab:active{transform:scale(.97)}",
    "#md-bookmark-fab.saved{border-color:rgba(184,163,106,.8);color:#B8A36A}",
    "@media (max-width:480px){.md-fab{padding:10px 14px;font-size:12px}}",

    // Notification bell + panel
    "#md-bell{position:fixed;left:18px;bottom:18px;z-index:1200;width:48px;height:48px;border-radius:50%;background:#1f1f21;color:#f2f2f3;border:1px solid rgba(194,61,224,.45);cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.45);display:inline-flex;align-items:center;justify-content:center;font-size:20px;transition:background .2s,border-color .2s,transform .15s}",
    "#md-bell:hover{background:rgba(194,61,224,.14);border-color:rgba(194,61,224,.8)}",
    "#md-bell:active{transform:scale(.95)}",
    "#md-bell-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:#c23de0;color:#fff;font:700 11px Montserrat,sans-serif;display:none;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.4)}",
    "#md-bell-badge.show{display:inline-flex}",
    "#md-notif-panel{position:fixed;left:18px;bottom:74px;z-index:1201;width:min(320px,calc(100vw - 36px));background:#1f1f21;border:1px solid rgba(194,61,224,.4);border-radius:14px;box-shadow:0 18px 48px rgba(0,0,0,.55);padding:16px;display:none;font-family:Montserrat,sans-serif;color:#f2f2f3;animation:md-auth-scale .2s ease-out}",
    "#md-notif-panel.open{display:block}",
    ".md-notif-title{font-family:'Cinzel',serif;font-size:13px;letter-spacing:.06em;color:#B8A36A;text-transform:uppercase;margin-bottom:10px}",
    ".md-notif-item{font-size:13px;color:#d7d7dc;line-height:1.5;padding:8px 0;border-top:1px solid rgba(255,255,255,.07)}",
    ".md-notif-item:first-of-type{border-top:none}",
    ".md-notif-item a{color:#B8A36A;text-decoration:none}",
    ".md-notif-cta{display:block;text-align:center;margin-top:12px;padding:10px;border-radius:8px;background:rgba(194,61,224,.22);border:1px solid rgba(194,61,224,.55);color:#fff;font-weight:600;font-size:12px;letter-spacing:.06em;text-transform:uppercase;text-decoration:none}",
    ".md-notif-cta:hover{background:rgba(194,61,224,.32)}",
    ".md-notif-close{position:absolute;top:8px;right:10px;background:none;border:none;color:#a7a7ad;font-size:18px;cursor:pointer}"
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('md-auth-styles')) return;
    var s = document.createElement('style');
    s.id = 'md-auth-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // -- SDK loader -----------------------------------------------------------
  function loadSupabaseSDK() {
    return new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) {
        resolve();
        return;
      }
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.crossOrigin = 'anonymous';
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Failed to load supabase-js')); };
      document.head.appendChild(s);
    });
  }

  // -- shared cross-subdomain cookie storage --------------------------------
  // Mirrors src/integrations/supabase/cookieStorage.ts EXACTLY (same key, cookie
  // domain, base64+chunk scheme) so the auth widget (www.masoneria.digital) and
  // the trivia app (desafio33.masoneria.digital) share one Supabase session via a
  // cookie scoped to .masoneria.digital. Off-domain → falls back to localStorage.
  var MD_COOKIE_DOMAIN = '.masoneria.digital';
  var MD_COOKIE_MAX = 3200;
  function mdOnMasoneria() {
    return typeof location !== 'undefined' && /(^|\.)masoneria\.digital$/i.test(location.hostname);
  }
  function mdCookieAttrs(maxAge) {
    var a = '; path=/; max-age=' + maxAge + '; SameSite=Lax';
    if (typeof location !== 'undefined' && location.protocol === 'https:') a += '; Secure';
    if (mdOnMasoneria()) a += '; domain=' + MD_COOKIE_DOMAIN;
    return a;
  }
  function mdWriteCookie(name, value) { document.cookie = name + '=' + value + mdCookieAttrs(60 * 60 * 24 * 30); }
  function mdDelCookie(name) { document.cookie = name + '=' + mdCookieAttrs(0); }
  function mdReadCookie(name) {
    var esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var m = document.cookie.match(new RegExp('(?:^|; )' + esc + '=([^;]*)'));
    return m ? m[1] : null;
  }
  function mdB64encode(s) { return btoa(unescape(encodeURIComponent(s))); }
  function mdB64decode(s) { return decodeURIComponent(escape(atob(s))); }
  function mdClearChunks(key) {
    mdDelCookie(key);
    var i = 0;
    while (mdReadCookie(key + '.' + i) !== null) { mdDelCookie(key + '.' + i); i++; }
  }
  var MD_USE_LS = !mdOnMasoneria();
  var MD_COOKIE_STORAGE = {
    getItem: function (key) {
      if (MD_USE_LS) { try { return localStorage.getItem(key); } catch (e) { return null; } }
      var head = mdReadCookie(key);
      if (head === null) return null;
      if (head === 'chunked') {
        var b64 = '', i = 0, part;
        while ((part = mdReadCookie(key + '.' + i)) !== null) { b64 += part; i++; }
        if (!b64) return null;
        try { return mdB64decode(b64); } catch (e) { return null; }
      }
      try { return mdB64decode(head); } catch (e) { return null; }
    },
    setItem: function (key, value) {
      if (MD_USE_LS) { try { localStorage.setItem(key, value); } catch (e) {} return; }
      mdClearChunks(key);
      var b64 = mdB64encode(value);
      if (b64.length <= MD_COOKIE_MAX) { mdWriteCookie(key, b64); return; }
      mdWriteCookie(key, 'chunked');
      for (var j = 0, idx = 0; j < b64.length; j += MD_COOKIE_MAX, idx++) {
        mdWriteCookie(key + '.' + idx, b64.slice(j, j + MD_COOKIE_MAX));
      }
    },
    removeItem: function (key) {
      if (MD_USE_LS) { try { localStorage.removeItem(key); } catch (e) {} return; }
      mdClearChunks(key);
    }
  };

  // -- helpers --------------------------------------------------------------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function initials(name) {
    if (!name) return '?';
    var parts = String(name).trim().split(/\s+/).slice(0, 2);
    return parts.map(function (p) { return p.charAt(0); }).join('').toUpperCase() || '?';
  }

  function toast(msg, type) {
    var t = document.getElementById('md-auth-toast-el');
    if (!t) {
      t = document.createElement('div');
      t.id = 'md-auth-toast-el';
      t.className = 'md-auth-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'md-auth-toast md-auth-toast-' + (type || 'info') + ' show';
    if (t._timer) clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove('show'); }, 4500);
  }

  // -- state ----------------------------------------------------------------
  var supa = null;
  var session = null;
  var profile = null;
  var triggerEl = null;
  var navLinkEl = null;
  var modalEl = null;
  var hamburgerEl = null;

  // -- templates ------------------------------------------------------------
  var ICON_USER_SVG =
    '<svg class="md-auth-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
    '<circle cx="12" cy="7" r="4"/></svg>';

  var MODAL_HTML =
    '<div class="md-auth-backdrop"></div>' +
    '<div class="md-auth-card" role="dialog" aria-modal="true" aria-labelledby="md-auth-current-title">' +
      '<button class="md-auth-close" type="button" aria-label="Cerrar">&times;</button>' +

      // login
      '<div class="md-auth-view md-auth-view-login active">' +
        '<h2 class="md-auth-title">Entrar</h2>' +
        '<p class="md-auth-sub">Accede para guardar tu progreso y desbloquear contenido reservado.</p>' +
        '<form id="md-auth-form-login" novalidate>' +
          '<label><span>Email</span><input type="email" id="md-auth-login-email" required autocomplete="email"/></label>' +
          '<label><span>Palabra de paso</span><input type="password" id="md-auth-login-password" required minlength="6" autocomplete="current-password"/></label>' +
          '<button type="submit" class="md-auth-btn-primary">Entrar</button>' +
        '</form>' +
        '<div class="md-auth-links">' +
          '<a href="#" data-md-auth-goto="forgot">¿Olvidaste tu palabra de paso?</a>' +
          '<span class="md-auth-muted">¿Aún no tienes cuenta?</span>' +
          '<a href="#" data-md-auth-goto="signup">Regístrate</a>' +
        '</div>' +
      '</div>' +

      // signup
      '<div class="md-auth-view md-auth-view-signup">' +
        '<h2 class="md-auth-title">Crear cuenta</h2>' +
        '<p class="md-auth-sub">Únete a la Cámara Profana. Gana monedas, sube en el ranking y accede a contenido iniciático.</p>' +
        '<form id="md-auth-form-signup" novalidate>' +
          '<label><span>Nombre de usuario</span><input type="text" id="md-auth-signup-username" required maxlength="40" autocomplete="username"/></label>' +
          '<label><span>Email</span><input type="email" id="md-auth-signup-email" required autocomplete="email"/></label>' +
          '<label><span>Palabra de paso</span><input type="password" id="md-auth-signup-password" required minlength="6" autocomplete="new-password"/></label>' +
          '<label class="md-auth-checkbox"><input type="checkbox" id="md-auth-signup-comms"/><span>Acepto recibir comunicaciones</span></label>' +
          '<button type="submit" class="md-auth-btn-primary">Crear cuenta</button>' +
        '</form>' +
        '<div class="md-auth-links">' +
          '<span class="md-auth-muted">¿Ya tienes cuenta?</span>' +
          '<a href="#" data-md-auth-goto="login">Entrar</a>' +
        '</div>' +
      '</div>' +

      // forgot
      '<div class="md-auth-view md-auth-view-forgot">' +
        '<h2 class="md-auth-title">Recuperar acceso</h2>' +
        '<p class="md-auth-sub">Te enviaremos un enlace para crear una nueva palabra de paso.</p>' +
        '<form id="md-auth-form-forgot" novalidate>' +
          '<label><span>Email</span><input type="email" id="md-auth-forgot-email" required autocomplete="email"/></label>' +
          '<button type="submit" class="md-auth-btn-primary">Enviar enlace</button>' +
        '</form>' +
        '<div class="md-auth-links">' +
          '<a href="#" data-md-auth-goto="login">Volver a entrar</a>' +
        '</div>' +
      '</div>' +

      // check-email (post-signup)
      '<div class="md-auth-view md-auth-view-check-email">' +
        '<h2 class="md-auth-title md-auth-title-success">Casi listo</h2>' +
        '<p class="md-auth-sub">Te hemos enviado un enlace de confirmación a:</p>' +
        '<p class="md-auth-email-display" id="md-auth-confirm-email-display"></p>' +
        '<p class="md-auth-fineprint">Haz clic en el enlace del email para activar tu cuenta. Al volver al sitio, ya estarás dentro.<br/>Si no lo ves en tu bandeja, revisa la carpeta de spam o promociones.</p>' +
        '<button type="button" class="md-auth-btn-primary" data-md-auth-goto="login">Entendido</button>' +
      '</div>' +

      // profile (logged-in)
      '<div class="md-auth-view md-auth-view-profile">' +
        '<div class="md-auth-profile-header">' +
          '<div class="md-auth-avatar-lg" id="md-auth-profile-avatar">?</div>' +
          '<div>' +
            '<div class="md-auth-profile-name" id="md-auth-profile-username">—</div>' +
            '<div class="md-auth-profile-email" id="md-auth-profile-email">—</div>' +
          '</div>' +
        '</div>' +
        '<div class="md-auth-stats">' +
          '<div class="md-auth-stat"><div class="md-auth-stat-value" id="md-auth-profile-coins">0</div><div class="md-auth-stat-label">🪙 Monedas profanas</div></div>' +
          '<div class="md-auth-stat"><div class="md-auth-stat-value" id="md-auth-profile-games">0</div><div class="md-auth-stat-label">🎯 Partidas</div></div>' +
          '<div class="md-auth-stat"><div class="md-auth-stat-value" id="md-auth-profile-ranking">#—</div><div class="md-auth-stat-label">🏆 Ranking</div></div>' +
        '</div>' +
        '<a id="md-auth-profile-trivia-link" class="md-auth-btn-primary md-auth-btn-block" href="' + escapeHTML(TRIVIA_URL) + '">⚔ Jugar Desafío 33</a>' +
        '<button id="md-auth-invite-btn" type="button" class="md-auth-btn-ghost" style="margin-top:10px">✉ Invita a alguien para competir</button>' +
        '<div class="md-auth-library">' +
          '<div class="md-auth-library-title">📚 Mi biblioteca <span id="md-auth-reads-count" class="md-auth-library-count"></span></div>' +
          '<div id="md-auth-library-list" class="md-auth-library-list"><div class="md-auth-library-empty">Cargando…</div></div>' +
        '</div>' +
        '<div class="md-auth-unlock-teaser">' +
          '<div class="md-auth-unlock-title">Cómo ganar monedas</div>' +
          '<ul class="md-auth-unlock-list">' +
            '<li>📚 Lee un artículo hasta el final → +20</li>' +
            '<li>↗ Comparte un artículo → +10</li>' +
            '<li>⚔ Juega al Desafío 33 → gana medallas</li>' +
            '<li>✉ Invita a un amigo a competir</li>' +
          '</ul>' +
        '</div>' +
        '<button id="md-auth-logout-btn" type="button" class="md-auth-btn-ghost">Cerrar sesión</button>' +
      '</div>' +

      // invite (logged-in: invitar a un amigo)
      '<div class="md-auth-view md-auth-view-invite">' +
        '<h2 class="md-auth-title">Invitar a competir</h2>' +
        '<p class="md-auth-sub">Convoca a alguien a la Cámara Profana. Le llegará una invitación personal para unirse al Desafío 33.</p>' +
        '<form id="md-auth-form-invite" novalidate>' +
          '<label><span>Nombre del invitado</span><input type="text" id="md-auth-invite-name" required maxlength="60" autocomplete="name"/></label>' +
          '<label><span>Email del invitado</span><input type="email" id="md-auth-invite-email" required autocomplete="off"/></label>' +
          '<button type="submit" class="md-auth-btn-primary">Enviar invitación</button>' +
        '</form>' +
        '<div class="md-auth-links">' +
          '<a href="#" data-md-auth-goto="profile">Volver a mi perfil</a>' +
        '</div>' +
      '</div>' +

      // set-password (al llegar desde un invite o un reset de contraseña)
      '<div class="md-auth-view md-auth-view-set-password">' +
        '<h2 class="md-auth-title md-auth-title-success">Crea tu palabra de paso</h2>' +
        '<p class="md-auth-sub" id="md-auth-set-password-sub">Elige una palabra de paso para activar tu acceso y poder volver a entrar cuando quieras.</p>' +
        '<form id="md-auth-form-set-password" novalidate>' +
          '<label><span>Nueva palabra de paso</span><input type="password" id="md-auth-set-password-1" required minlength="6" autocomplete="new-password"/></label>' +
          '<label><span>Repite la palabra de paso</span><input type="password" id="md-auth-set-password-2" required minlength="6" autocomplete="new-password"/></label>' +
          '<button type="submit" class="md-auth-btn-primary">Guardar y entrar</button>' +
        '</form>' +
      '</div>' +
    '</div>';

  // -- positioning ----------------------------------------------------------
  function positionTrigger() {
    if (!triggerEl || !hamburgerEl) return;
    var navbar = hamburgerEl.closest('.navbar, .w-nav') || hamburgerEl.parentElement;
    if (!navbar) return;
    var hRect = hamburgerEl.getBoundingClientRect();
    var nRect = navbar.getBoundingClientRect();
    var top = (hRect.top - nRect.top) + (hRect.height - triggerEl.offsetHeight) / 2;
    var rightFromNavRight = nRect.right - hRect.left + 10;
    triggerEl.style.top = Math.max(0, top) + 'px';
    triggerEl.style.right = rightFromNavRight + 'px';
  }

  function watchPosition() {
    positionTrigger();
    window.addEventListener('resize', positionTrigger);
    window.addEventListener('scroll', positionTrigger, { passive: true });
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(positionTrigger);
      if (hamburgerEl) ro.observe(hamburgerEl);
    }
    // Webflow can re-layout on nav open/close; re-position shortly after clicks
    document.addEventListener('click', function () {
      setTimeout(positionTrigger, 50);
      setTimeout(positionTrigger, 450);
    });
  }

  // -- header UI ------------------------------------------------------------
  function insertHeaderUI() {
    hamburgerEl = document.querySelector('.menu-button.w-nav-button') ||
                  document.querySelector('.w-nav-button');
    if (!hamburgerEl) {
      console.warn('[md-auth] hamburger button not found; aborting UI injection');
      return false;
    }

    // Trigger (sits next to the hamburger inside the navbar)
    triggerEl = document.createElement('button');
    triggerEl.id = 'md-auth-trigger';
    triggerEl.type = 'button';
    triggerEl.className = 'logged-out';
    triggerEl.setAttribute('aria-label', 'Entrar o registrarse');
    triggerEl.innerHTML = ICON_USER_SVG;

    var navbar = hamburgerEl.closest('.navbar, .w-nav') || hamburgerEl.parentNode;
    // make sure navbar can host an absolute child
    var navbarStyle = window.getComputedStyle(navbar);
    if (navbarStyle.position === 'static') navbar.style.position = 'relative';
    navbar.appendChild(triggerEl);

    triggerEl.addEventListener('click', function () {
      if (session) openModal('profile'); else openModal('login');
    });

    // Nav link inside the expanded menu
    var navOverlay = document.querySelector('.nav-color-overlay') ||
                     document.querySelector('.nav-menu.w-nav-menu');
    if (navOverlay) {
      navLinkEl = document.createElement('a');
      navLinkEl.href = '#';
      navLinkEl.className = 'nav-link';
      navLinkEl.id = 'md-auth-nav-link';
      navLinkEl.textContent = 'Registrarse / Entrar';
      navLinkEl.addEventListener('click', function (e) {
        e.preventDefault();
        // Close the Webflow menu if open, then open our modal
        var btn = document.querySelector('.menu-button.w-nav-button.w--open');
        if (btn) btn.click();
        setTimeout(function () {
          openModal(session ? 'profile' : 'login');
        }, btn ? 220 : 0);
      });
      var navContentBlock = navOverlay.querySelector('.nav-content-block');
      if (navContentBlock) navOverlay.insertBefore(navLinkEl, navContentBlock);
      else navOverlay.appendChild(navLinkEl);
    }

    // Modal
    modalEl = document.createElement('div');
    modalEl.className = 'md-auth-modal';
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.innerHTML = MODAL_HTML;
    document.body.appendChild(modalEl);

    wireModal();
    watchPosition();
    return true;
  }

  function wireModal() {
    // Close on backdrop click or close button
    modalEl.addEventListener('click', function (e) {
      if (e.target === modalEl ||
          e.target.classList.contains('md-auth-backdrop') ||
          e.target.classList.contains('md-auth-close')) {
        closeModal();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modalEl.classList.contains('open')) closeModal();
    });

    // View navigation
    $$('[data-md-auth-goto]', modalEl).forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        showView(el.getAttribute('data-md-auth-goto'));
      });
    });

    // Login form
    $('#md-auth-form-login', modalEl).addEventListener('submit', function (e) {
      e.preventDefault();
      handleLogin();
    });
    // Signup form
    $('#md-auth-form-signup', modalEl).addEventListener('submit', function (e) {
      e.preventDefault();
      handleSignup();
    });
    // Forgot form
    $('#md-auth-form-forgot', modalEl).addEventListener('submit', function (e) {
      e.preventDefault();
      handleForgot();
    });
    // Logout
    $('#md-auth-logout-btn', modalEl).addEventListener('click', handleLogout);
    // Invite: open the invite view
    $('#md-auth-invite-btn', modalEl).addEventListener('click', function () {
      showView('invite');
    });
    // Invite form
    $('#md-auth-form-invite', modalEl).addEventListener('submit', function (e) {
      e.preventDefault();
      handleInvite();
    });
    // Set-password form (invite / recovery arrival)
    $('#md-auth-form-set-password', modalEl).addEventListener('submit', function (e) {
      e.preventDefault();
      handleSetPassword();
    });
  }

  function openModal(view) {
    modalEl.classList.add('open');
    modalEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    showView(view);
    setTimeout(function () {
      var first = modalEl.querySelector('.md-auth-view.active input:not([type=checkbox])');
      if (first) first.focus();
    }, 60);
  }

  function closeModal() {
    modalEl.classList.remove('open');
    modalEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function showView(name) {
    $$('.md-auth-view', modalEl).forEach(function (v) { v.classList.remove('active'); });
    var v = $('.md-auth-view-' + name, modalEl);
    if (v) v.classList.add('active');
    if (name === 'profile') renderProfileView();
  }

  // -- auth handlers --------------------------------------------------------
  function handleLogin() {
    var btn = $('#md-auth-form-login button[type=submit]', modalEl);
    btn.disabled = true;
    btn.textContent = 'Entrando…';
    supa.auth.signInWithPassword({
      email: $('#md-auth-login-email', modalEl).value.trim(),
      password: $('#md-auth-login-password', modalEl).value
    }).then(function (res) {
      btn.disabled = false;
      btn.textContent = 'Entrar';
      if (res.error) {
        var msg = res.error.message || 'No se pudo entrar.';
        if (/Invalid login credentials/i.test(msg)) msg = 'Email o palabra de paso incorrectos.';
        else if (/Email not confirmed/i.test(msg)) msg = 'Tu email aún no está verificado. Revisa tu bandeja.';
        toast(msg, 'error');
      } else {
        toast('Bienvenido de vuelta.', 'success');
      }
    });
  }

  function handleSignup() {
    var btn = $('#md-auth-form-signup button[type=submit]', modalEl);
    var username = $('#md-auth-signup-username', modalEl).value.trim();
    var email = $('#md-auth-signup-email', modalEl).value.trim();
    var password = $('#md-auth-signup-password', modalEl).value;
    var comms = $('#md-auth-signup-comms', modalEl).checked;
    if (!username) { toast('El nombre de usuario es obligatorio.', 'error'); return; }
    btn.disabled = true;
    btn.textContent = 'Creando cuenta…';
    supa.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { username: username, accepts_communications: comms },
        emailRedirectTo: SITE_URL
      }
    }).then(function (res) {
      btn.disabled = false;
      btn.textContent = 'Crear cuenta';
      if (res.error) {
        var msg = res.error.message || 'No se pudo crear la cuenta.';
        if (/already registered/i.test(msg)) msg = 'Ya existe una cuenta con ese email. Inicia sesión.';
        toast(msg, 'error');
      } else {
        $('#md-auth-confirm-email-display', modalEl).textContent = email;
        showView('check-email');
      }
    });
  }

  function handleForgot() {
    var btn = $('#md-auth-form-forgot button[type=submit]', modalEl);
    var email = $('#md-auth-forgot-email', modalEl).value.trim();
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    supa.auth.resetPasswordForEmail(email, {
      redirectTo: SITE_URL
    }).then(function (res) {
      btn.disabled = false;
      btn.textContent = 'Enviar enlace';
      if (res.error) {
        toast(res.error.message || 'No se pudo enviar el email.', 'error');
      } else {
        toast('Email de recuperación enviado. Revisa tu bandeja.', 'success');
        showView('login');
      }
    });
  }

  function handleInvite() {
    var btn = $('#md-auth-form-invite button[type=submit]', modalEl);
    var name = $('#md-auth-invite-name', modalEl).value.trim();
    var email = $('#md-auth-invite-email', modalEl).value.trim();
    if (!name) { toast('El nombre del invitado es obligatorio.', 'error'); return; }
    if (!email) { toast('El email del invitado es obligatorio.', 'error'); return; }
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    supa.functions.invoke('invite-user', {
      body: { name: name, email: email }
    }).then(function (res) {
      btn.disabled = false;
      btn.textContent = 'Enviar invitación';
      // supa.functions.invoke surfaces non-2xx as res.error; the JSON body is in res.data
      var data = res.data || {};
      if (res.error || data.error) {
        var msg = data.error || 'No se pudo enviar la invitación.';
        toast(msg, 'error');
      } else {
        toast(data.message || ('Invitación enviada a ' + email + '.'), 'success');
        $('#md-auth-invite-name', modalEl).value = '';
        $('#md-auth-invite-email', modalEl).value = '';
        showView('profile');
      }
    }).catch(function () {
      btn.disabled = false;
      btn.textContent = 'Enviar invitación';
      toast('No se pudo enviar la invitación.', 'error');
    });
  }

  // Modo con el que se abrió set-password: 'invite' o 'recovery'.
  var setPasswordMode = null;

  function handleSetPassword() {
    var btn = $('#md-auth-form-set-password button[type=submit]', modalEl);
    var p1 = $('#md-auth-set-password-1', modalEl).value;
    var p2 = $('#md-auth-set-password-2', modalEl).value;
    if (p1.length < 6) { toast('La palabra de paso debe tener al menos 6 caracteres.', 'error'); return; }
    if (p1 !== p2) { toast('Las palabras de paso no coinciden.', 'error'); return; }
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    // En invitaciones el nombre llegó en metadata.name; lo promovemos a username
    // (estándar del registro normal) para que se muestre y persista bien.
    var meta = (session && session.user && session.user.user_metadata) || {};
    var inviteName = meta.name || meta.full_name || null;
    var attrs = { password: p1 };
    if (setPasswordMode === 'invite' && inviteName && !meta.username) {
      attrs.data = { username: inviteName };
    }

    supa.auth.updateUser(attrs).then(function (res) {
      btn.disabled = false;
      btn.textContent = 'Guardar y entrar';
      if (res.error) {
        var msg = res.error.message || 'No se pudo guardar la palabra de paso.';
        if (/should be different|same as the old/i.test(msg)) msg = 'Elige una palabra de paso distinta a la anterior.';
        toast(msg, 'error');
        return;
      }
      var wasRecovery = setPasswordMode === 'recovery';
      setPasswordMode = null;
      toast(wasRecovery ? 'Palabra de paso actualizada.' : '¡Bienvenido! Tu cuenta está activa.', 'success');
      $('#md-auth-set-password-1', modalEl).value = '';
      $('#md-auth-set-password-2', modalEl).value = '';

      // Si promovimos un nombre, asegúralo también en la fila de profiles
      // (por si el trigger de signup la creó sin username para los invitados).
      var ensureProfile = (attrs.data && attrs.data.username && session && session.user)
        ? supa.from('profiles').update({ username: attrs.data.username }).eq('id', session.user.id).then(function(){}, function(){})
        : Promise.resolve();

      ensureProfile.then(function () {
        return refreshProfile();
      }).then(function () {
        renderTrigger();
        showView('profile');
      });
    });
  }

  // Detecta si la URL actual viene de un enlace de invite o de recovery.
  // Supabase añade los tokens en el hash (#access_token=...&type=recovery|invite)
  // o, con el flujo PKCE, ?code=... — en ese caso nos apoyamos en el evento
  // PASSWORD_RECOVERY de onAuthStateChange.
  function detectArrivalType() {
    var hash = window.location.hash || '';
    var qs = window.location.search || '';
    var m = /[#&?]type=(\w+)/.exec(hash) || /[?&]type=(\w+)/.exec(qs);
    var type = m ? m[1] : null;
    if (type === 'recovery' || type === 'invite' || type === 'signup') return type;
    return null;
  }

  function openSetPassword(mode) {
    setPasswordMode = mode;
    var sub = $('#md-auth-set-password-sub', modalEl);
    if (sub) {
      sub.textContent = mode === 'recovery'
        ? 'Introduce tu nueva palabra de paso para volver a entrar.'
        : 'Elige una palabra de paso para activar tu acceso y poder volver a entrar cuando quieras.';
    }
    var title = modalEl.querySelector('.md-auth-view-set-password .md-auth-title');
    if (title) title.textContent = mode === 'recovery' ? 'Nueva palabra de paso' : 'Crea tu palabra de paso';
    openModal('set-password');
  }

  function handleLogout() {
    supa.auth.signOut().then(function () {
      closeModal();
      toast('Sesión cerrada.', 'success');
    });
  }

  // -- profile sync ---------------------------------------------------------
  function refreshProfile() {
    if (!session || !session.user) {
      profile = null;
      return Promise.resolve();
    }
    return supa.from('profiles')
      .select('username,total_score,games_played,profane_coins')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(function (res) {
        if (!res.error) profile = res.data || null;
        if (profile) {
          return supa.from('profiles')
            .select('id', { count: 'exact', head: true })
            .gt('total_score', profile.total_score || 0)
            .then(function (r2) {
              profile.ranking = (r2.count || 0) + 1;
            });
        }
      })
      .catch(function () { /* swallow */ });
  }

  // Mejor nombre disponible para mostrar. Orden: perfil → metadata.username
  // (registro normal) → metadata.name (invitados) → parte local del email.
  function userDisplayName() {
    if (!session || !session.user) return 'Usuario';
    var meta = session.user.user_metadata || {};
    return (profile && profile.username) ||
           meta.username ||
           meta.name ||
           meta.full_name ||
           (session.user.email ? session.user.email.split('@')[0] : 'Usuario');
  }

  function renderTrigger() {
    if (!triggerEl) return;
    if (session && session.user) {
      var name = userDisplayName();
      triggerEl.classList.remove('logged-out');
      triggerEl.classList.add('logged-in');
      triggerEl.setAttribute('aria-label', 'Abrir mi perfil');
      triggerEl.innerHTML =
        '<span class="md-auth-avatar">' + escapeHTML(initials(name)) + '</span>' +
        '<span class="md-auth-username">' + escapeHTML(name) + '</span>';
      if (navLinkEl) navLinkEl.textContent = 'Mi perfil';
    } else {
      triggerEl.classList.remove('logged-in');
      triggerEl.classList.add('logged-out');
      triggerEl.setAttribute('aria-label', 'Entrar o registrarse');
      triggerEl.innerHTML = ICON_USER_SVG;
      if (navLinkEl) navLinkEl.textContent = 'Registrarse / Entrar';
    }
    positionTrigger();
  }

  function renderProfileView() {
    if (!profile) {
      // still render available info from session
      var fallbackName = userDisplayName();
      $('#md-auth-profile-avatar', modalEl).textContent = initials(fallbackName);
      $('#md-auth-profile-username', modalEl).textContent = fallbackName;
      $('#md-auth-profile-email', modalEl).textContent = (session && session.user && session.user.email) || '';
      $('#md-auth-profile-coins', modalEl).textContent = '0';
      $('#md-auth-profile-games', modalEl).textContent = '0';
      $('#md-auth-profile-ranking', modalEl).textContent = '#—';
      loadLibrary();
      return;
    }
    $('#md-auth-profile-avatar', modalEl).textContent = initials(profile.username || userDisplayName());
    $('#md-auth-profile-username', modalEl).textContent = profile.username || userDisplayName();
    $('#md-auth-profile-email', modalEl).textContent = (session.user && session.user.email) || '';
    $('#md-auth-profile-coins', modalEl).textContent = String(profile.profane_coins != null ? profile.profane_coins : 0);
    $('#md-auth-profile-games', modalEl).textContent = String(profile.games_played != null ? profile.games_played : 0);
    $('#md-auth-profile-ranking', modalEl).textContent = '#' + (profile.ranking || '—');
    loadLibrary();
  }

  // -- blog gamification (read-to-earn + bookmarks) -------------------------
  var blogArticle = null;          // { slug, title, url } if on an article page
  var readAwarded = false;         // guard so we only award once per page load
  var bookmarkFab = null;          // floating bookmark button element
  var shareFab = null;             // floating share button element
  var isBookmarked = false;
  var pageLoadedAt = Date.now();
  var bellEl = null, bellBadgeEl = null, notifPanelEl = null, notifAutoShown = false;

  function getArticle() {
    var p = window.location.pathname || '';
    var m = p.match(/^\/blog\/([^\/?#]+)\/?$/i);
    if (!m) return null;
    var slug = decodeURIComponent(m[1]);
    var h1 = document.querySelector('h1');
    var title = (h1 && h1.textContent.trim()) || (document.title || slug);
    return { slug: slug, title: title.slice(0, 280), url: (window.location.href || '').split(/[?#]/)[0] };
  }

  function awardReadIfBottom() {
    if (readAwarded || !supa || !session || !session.user || !blogArticle) return;
    var doc = document.documentElement;
    var full = Math.max(doc.scrollHeight, document.body.scrollHeight);
    var scrolled = window.scrollY + window.innerHeight;
    var pageIsTall = full > window.innerHeight + 50;
    // Must reach near the bottom (within 250px) on tall pages.
    if (pageIsTall && scrolled < full - 250) return;
    // Dwell guard: at least 12s on the page (avoid instant-scroll farming).
    if (Date.now() - pageLoadedAt < 12000) return;
    readAwarded = true;
    supa.rpc('award_article_read', {
      p_slug: blogArticle.slug, p_title: blogArticle.title, p_url: blogArticle.url
    }).then(function (res) {
      if (res.error) { readAwarded = false; return; }
      var row = Array.isArray(res.data) ? res.data[0] : res.data;
      if (row && row.points_awarded > 0) {
        toast('📚 +' + row.points_awarded + ' monedas por leer este artículo', 'success');
      }
    }).catch(function () { readAwarded = false; });
  }

  function setFabSaved(saved) {
    isBookmarked = saved;
    if (!bookmarkFab) return;
    bookmarkFab.textContent = saved ? '★ En tu biblioteca' : '☆ Guardar en mi biblioteca';
    if (saved) bookmarkFab.classList.add('saved'); else bookmarkFab.classList.remove('saved');
  }

  function refreshBookmarkState() {
    if (!bookmarkFab || !blogArticle) return;
    if (!session || !session.user) { setFabSaved(false); return; }
    supa.from('bookmarks').select('slug')
      .eq('user_id', session.user.id).eq('slug', blogArticle.slug).maybeSingle()
      .then(function (res) { setFabSaved(!!(res && res.data)); });
  }

  function toggleBookmark() {
    if (!session || !session.user) {
      openModal('login');
      toast('Inicia sesión para guardar en tu biblioteca', 'info');
      return;
    }
    if (!blogArticle) return;
    if (isBookmarked) {
      supa.from('bookmarks').delete()
        .eq('user_id', session.user.id).eq('slug', blogArticle.slug)
        .then(function (res) { if (!res.error) { setFabSaved(false); toast('Quitado de tu biblioteca', 'info'); } });
    } else {
      supa.from('bookmarks').insert({
        user_id: session.user.id, slug: blogArticle.slug, title: blogArticle.title, url: blogArticle.url
      }).then(function (res) {
        if (!res.error) { setFabSaved(true); toast('★ Guardado en tu biblioteca', 'success'); }
        else if (/duplicate|unique/i.test(res.error.message || '')) { setFabSaved(true); }
      });
    }
  }

  function handleShare() {
    if (!blogArticle) return;
    var shareUrl = blogArticle.url;
    var shareTitle = blogArticle.title;
    var afterShare = function () {
      if (!session || !session.user) return; // points only for logged-in users
      supa.rpc('award_article_share', {
        p_slug: blogArticle.slug, p_title: shareTitle, p_url: shareUrl
      }).then(function (res) {
        if (res.error) return;
        var row = Array.isArray(res.data) ? res.data[0] : res.data;
        if (row && row.points_awarded > 0) toast('↗ +' + row.points_awarded + ' monedas por compartir', 'success');
      }).catch(function () {});
    };
    if (navigator.share) {
      navigator.share({ title: shareTitle, url: shareUrl })
        .then(afterShare)
        .catch(function () { /* user cancelled — no points */ });
    } else {
      // Fallback: copy link, then open WhatsApp share.
      try {
        if (navigator.clipboard) navigator.clipboard.writeText(shareUrl);
      } catch (e) {}
      window.open('https://wa.me/?text=' + encodeURIComponent(shareTitle + ' ' + shareUrl), '_blank');
      afterShare();
    }
  }

  function setupBlogGamification() {
    blogArticle = getArticle();
    if (!blogArticle) return;
    // Floating actions group: bookmark + share
    if (!bookmarkFab) {
      var group = document.createElement('div');
      group.id = 'md-article-actions';

      shareFab = document.createElement('button');
      shareFab.id = 'md-share-fab';
      shareFab.className = 'md-fab';
      shareFab.type = 'button';
      shareFab.textContent = '↗ Compartir';
      shareFab.addEventListener('click', handleShare);

      bookmarkFab = document.createElement('button');
      bookmarkFab.id = 'md-bookmark-fab';
      bookmarkFab.className = 'md-fab';
      bookmarkFab.type = 'button';
      bookmarkFab.textContent = '☆ Guardar en mi biblioteca';
      bookmarkFab.addEventListener('click', toggleBookmark);

      group.appendChild(shareFab);
      group.appendChild(bookmarkFab);
      document.body.appendChild(group);
    }
    refreshBookmarkState();
    // Read tracking
    window.addEventListener('scroll', awardReadIfBottom, { passive: true });
    setTimeout(awardReadIfBottom, 13000);
  }

  // -- notifications bell ---------------------------------------------------
  function renderBell() {
    if (bellEl) return;
    bellEl = document.createElement('button');
    bellEl.id = 'md-bell';
    bellEl.type = 'button';
    bellEl.setAttribute('aria-label', 'Notificaciones');
    bellEl.innerHTML = '🔔<span id="md-bell-badge"></span>';
    bellEl.addEventListener('click', function () { toggleNotifPanel(); });
    document.body.appendChild(bellEl);
    bellBadgeEl = bellEl.querySelector('#md-bell-badge');

    notifPanelEl = document.createElement('div');
    notifPanelEl.id = 'md-notif-panel';
    document.body.appendChild(notifPanelEl);

    document.addEventListener('click', function (e) {
      if (notifPanelEl && notifPanelEl.classList.contains('open') &&
          !notifPanelEl.contains(e.target) && e.target !== bellEl && !bellEl.contains(e.target)) {
        notifPanelEl.classList.remove('open');
      }
    });
  }

  function setBellVisible(visible) {
    if (!bellEl) return;
    bellEl.style.display = visible ? 'inline-flex' : 'none';
  }

  // Compute notifications: bookmarked-but-unread articles + a Desafío 33 nudge.
  function refreshNotifications(autoOpen) {
    if (!session || !session.user) { setBellVisible(false); return; }
    renderBell();
    setBellVisible(true);
    Promise.all([
      supa.from('bookmarks').select('slug,title,url').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(50),
      supa.from('article_reads').select('slug').eq('user_id', session.user.id)
    ]).then(function (out) {
      var bms = (out[0] && out[0].data) || [];
      var readSet = {};
      ((out[1] && out[1].data) || []).forEach(function (r) { readSet[r.slug] = true; });
      var unread = bms.filter(function (b) { return !readSet[b.slug]; });
      buildNotifPanel(unread);
      if (bellBadgeEl) {
        if (unread.length > 0) { bellBadgeEl.textContent = String(unread.length); bellBadgeEl.classList.add('show'); }
        else { bellBadgeEl.classList.remove('show'); }
      }
      if (autoOpen && !notifAutoShown) { notifAutoShown = true; if (notifPanelEl) notifPanelEl.classList.add('open'); }
    }).catch(function () {});
  }

  function buildNotifPanel(unread) {
    if (!notifPanelEl) return;
    var html = '<button class="md-notif-close" type="button" aria-label="Cerrar">&times;</button>';
    html += '<div class="md-notif-title">🔔 Tus recordatorios</div>';
    if (unread.length > 0) {
      html += '<div class="md-notif-item">Tienes <strong>' + unread.length + '</strong> artículo' + (unread.length > 1 ? 's' : '') + ' en tu biblioteca por leer:';
      unread.slice(0, 3).forEach(function (b) {
        html += '<br/>· <a href="' + (b.url || ('/blog/' + b.slug)) + '">' + escapeHTML(b.title || b.slug) + '</a>';
      });
      html += '</div>';
    } else {
      html += '<div class="md-notif-item">No tienes artículos pendientes en tu biblioteca. Guarda los que quieras leer luego con “Guardar en mi biblioteca”.</div>';
    }
    html += '<div class="md-notif-item">¿Listo para subir en el ranking? Pon a prueba tu conocimiento masónico.</div>';
    html += '<a class="md-notif-cta" href="' + escapeHTML(TRIVIA_URL) + '">⚔ Jugar al Desafío 33</a>';
    notifPanelEl.innerHTML = html;
    var closeBtn = notifPanelEl.querySelector('.md-notif-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { notifPanelEl.classList.remove('open'); });
  }

  function toggleNotifPanel() {
    if (!notifPanelEl) return;
    if (notifPanelEl.classList.contains('open')) notifPanelEl.classList.remove('open');
    else { refreshNotifications(false); notifPanelEl.classList.add('open'); }
  }

  function loadLibrary() {
    var listEl = $('#md-auth-library-list', modalEl);
    var countEl = $('#md-auth-reads-count', modalEl);
    if (!listEl || !session || !session.user) return;
    supa.from('article_reads').select('slug', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .then(function (r) { if (countEl) countEl.textContent = '· ' + (r.count || 0) + ' leídos'; });
    supa.from('bookmarks').select('slug,title,url')
      .eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(50)
      .then(function (res) {
        if (res.error) { listEl.innerHTML = '<div class="md-auth-library-empty">No se pudo cargar tu biblioteca.</div>'; return; }
        var rows = res.data || [];
        if (rows.length === 0) {
          listEl.innerHTML = '<div class="md-auth-library-empty">Aún no has guardado artículos. Pulsa “Guardar en mi biblioteca” en cualquier artículo del blog.</div>';
          return;
        }
        listEl.innerHTML = '';
        rows.forEach(function (b) {
          var item = document.createElement('div');
          item.className = 'md-auth-library-item';
          var a = document.createElement('a');
          a.href = b.url || ('/blog/' + b.slug);
          a.textContent = b.title || b.slug;
          a.title = b.title || b.slug;
          var rm = document.createElement('button');
          rm.className = 'md-auth-library-remove';
          rm.type = 'button';
          rm.innerHTML = '&times;';
          rm.title = 'Quitar de la biblioteca';
          rm.addEventListener('click', function () {
            supa.from('bookmarks').delete()
              .eq('user_id', session.user.id).eq('slug', b.slug)
              .then(function (r) {
                if (!r.error) { item.remove(); if (blogArticle && blogArticle.slug === b.slug) setFabSaved(false); }
              });
          });
          item.appendChild(a);
          item.appendChild(rm);
          listEl.appendChild(item);
        });
      });
  }

  // -- init -----------------------------------------------------------------
  function init() {
    injectStyles();
    // Capturamos el tipo de llegada AHORA: detectSessionInUrl limpiará el hash enseguida.
    var arrivalType = detectArrivalType();
    var arrivalHandled = false;
    loadSupabaseSDK().then(function () {
      supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storageKey: 'md-auth-session',
          // Shared with the trivia app across *.masoneria.digital (cookie scoped
          // to .masoneria.digital). Off-domain → falls back to localStorage.
          storage: MD_COOKIE_STORAGE
        }
      });

      if (!insertHeaderUI()) return;

      // Blog gamification: bookmark button + read-to-earn on /blog/<slug> pages.
      setupBlogGamification();

      supa.auth.onAuthStateChange(function (event, newSession) {
        var wasLoggedOut = !session;
        session = newSession;

        // --- Llegada desde un enlace que exige fijar contraseña ---
        // Recovery → Supabase emite el evento PASSWORD_RECOVERY.
        // Invite → llega como SIGNED_IN; lo distinguimos por el type de la URL.
        if (!arrivalHandled && newSession) {
          if (event === 'PASSWORD_RECOVERY' || arrivalType === 'recovery') {
            arrivalHandled = true;
            refreshProfile().then(function () {
              renderTrigger();
              openSetPassword('recovery');
            });
            return;
          }
          if (arrivalType === 'invite' && event === 'SIGNED_IN') {
            arrivalHandled = true;
            refreshProfile().then(function () {
              renderTrigger();
              openSetPassword('invite');
            });
            return;
          }
        }

        refreshProfile().then(function () {
          renderTrigger();
          refreshBookmarkState();
          // Auto-open the notifications panel on a fresh login.
          refreshNotifications(event === 'SIGNED_IN' && wasLoggedOut);
          if (event === 'SIGNED_IN' && wasLoggedOut && modalEl.classList.contains('open') &&
              !modalEl.querySelector('.md-auth-view-set-password.active')) {
            // Just signed in via the modal — close it.
            closeModal();
            toast('¡Sesión iniciada!', 'success');
          }
        });
      });

      supa.auth.getSession().then(function (res) {
        session = (res && res.data && res.data.session) || null;
        return refreshProfile();
      }).then(function () {
        renderTrigger();
        refreshBookmarkState();
        refreshNotifications(false);
      });
    }).catch(function (err) {
      console.error('[md-auth]', err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
