/*
 * Upgrade levels (called "spice" in the code).
 *
 *   0  none        clean academic theme       plain.css (also what you get without JavaScript)
 *   1  medium      dark Web 2.0               web2.css
 *   2  high        dark Web 1.0               retro.css + retro.js
 *   3  extra high  extreme Web 1.0 site       extreme.css + retro.js + extreme.js
 *
 * A new visit gets none, medium or high with equal probability. Extra high has to be
 * earned: it unlocks (for this browser) only by catching the running man (runner.js), and
 * until then it isn't offered anywhere and can't be reached through the address either.
 * The level is remembered in localStorage, so it stays the same while you click around
 * (new tabs too). After 30 minutes without a page view, the next visit rolls again.
 * ?spice=0..3 in the address picks a level directly (3 only once unlocked).
 *
 * This file also builds the "upgrade" control on every page (it looks and works
 * differently at each level, with chilli peppers at medium and extra high) and keeps
 * the site-wide visit counter.
 *
 * Load it in <head> straight after <link id="plain-css" href="plain.css">: it adds the
 * chosen level's stylesheet before anything is drawn, so no other theme flashes up first.
 */
(function () {
  'use strict';

  var NAMES = ['none', 'medium', 'high', 'extra high'];
  var STORE_KEY = 'spice';
  var UNLOCK_KEY = 'spice-unlocked';
  var IDLE_MS = 30 * 60 * 1000;

  // Visit counter: the free Abacus counting service (https://abacus.jasoncameron.dev).
  // One count per browser session, and only on the real site, so local previews don't count.
  var COUNTER_URL = 'https://abacus.jasoncameron.dev';
  var COUNTER_NAME = 'colecomfort.github.io/visits';
  var LIVE_HOST = 'colecomfort.github.io';

  // Papers for the "I'm feeling lucky" tab (high and extra high), from the CV.
  var PAPERS = [
    'pdfs/SVD.pdf',                                   // Gaussian probability theory is completely positive
    'https://doi.org/10.22331/q-2026-01-19-1972',     // A dataflow programming framework for linear optical DQC
    'https://doi.org/10.4230/LIPIcs.FSCD.2026.8',     // Denotational semantics for stabiliser quantum programs
    'https://doi.org/10.46298/lmcs-17(4:8)2021',      // Dagger linear logic for categorical quantum mechanics
    'https://doi.org/10.4204/eptcs.287.4',            // The category TOF
    'https://doi.org/10.4204/eptcs.266.18',           // The category CNOT
    'https://doi.org/10.4204/eptcs.340.4',            // The ZX&-calculus
    'https://doi.org/10.4204/eptcs.372.24',           // A graphical calculus for Lagrangian relations
    'https://arxiv.org/abs/2010.13361',               // Sheet diagrams for bimonoidal categories
    'https://doi.org/10.4204/EPTCS.380.4',            // Coend optics for quantum combs
    'https://arxiv.org/abs/2403.10479',               // Complete equational theories for Gaussian relations
    'https://doi.org/10.4230/LIPIcs.FSCD.2026.7',     // Graphical symplectic algebra
    'https://arxiv.org/abs/2304.10584',               // The algebra for stabilizer codes
    'https://arxiv.org/abs/2607.04015',               // The delayed stabilizer ZX-calculus
    'https://arxiv.org/abs/2607.03996'                // Finite observations, infinite behaviour
  ];

  // A small chilli pepper, drawn as SVG.
  var CHILLI = '<svg class="chilli" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M6.5 7.5c3.5-1.2 6 .8 7 4.2.9 3.2 2.6 6.4 6.8 8.6-5.6 1.4-11.2-1-13.6-5.6-1.2-2.4-1.3-5.2-.2-7.2z" fill="#d81e1e"/>' +
    '<path d="M8.2 10.4c1.6-.3 2.9.7 3.5 2.3" fill="none" stroke="#ff9a8a" stroke-width="1.2" stroke-linecap="round"/>' +
    '<path d="M4.6 8.4c1-1.6 3-2.2 4.6-1.4" fill="none" stroke="#2e8b2e" stroke-width="2.4" stroke-linecap="round"/>' +
    '<path d="M6.6 6.8c-.2-2 .8-3.6 2.6-4.4" fill="none" stroke="#2e8b2e" stroke-width="1.8" stroke-linecap="round"/>' +
    '</svg>';

  var storageWorks = true;
  var open = isUnlocked();
  var level = fromUrl();
  if (level === null) level = fromStorage();
  if (level === null) level = Math.floor(Math.random() * 3);   // none, medium or high
  if (level === 3 && !open) level = 2;                          // extra high has to be earned
  save(level);

  var root = document.documentElement;
  root.setAttribute('data-spice', String(level));

  window.SPICE = { level: level, names: NAMES, set: setLevel, visits: countVisit(), unlocked: open, unlock: unlock };

  if (level > 0) {
    var plain = document.getElementById('plain-css');
    if (plain) plain.disabled = true;
    var sheets = [[], ['web2.css'], ['retro.css'], ['extreme.css']][level];
    var scripts = [[], [], ['retro.js'], ['retro.js', 'extreme.js']][level];
    var tags = sheets.map(function (href) { return '<link rel="stylesheet" href="' + href + '">'; })
      .concat(scripts.map(function (src) { return '<script src="' + src + '"><\/script>'; }));
    // Written into the <head> while it is being parsed, so the stylesheets block rendering
    // exactly as if they had been in the HTML.
    document.write(tags.join(''));
  }
  document.write('<script src="runner.js"><\/script>');   // the runner, on every level

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();

  // The back button can show a cached copy of a page at an older level.
  window.addEventListener('pageshow', function (e) {
    var stored = fromStorage();
    if (e.persisted && stored !== null && stored !== level) location.reload();
  });

  function ready() {
    if (level >= 2) luckyTab();
    carryLevelInLinks();
    document.body.appendChild([understated, toolbar, jumpMenu, fireBar][level]());
  }

  // high and extra high: a last tab that opens a random paper (a new pick on every click).
  function luckyTab() {
    var nav = document.querySelector('.site-nav');
    if (!nav) return;
    var a = el('a', 'lucky', 'I’m feeling lucky');
    a.target = '_blank';
    a.rel = 'noopener';
    function pick() { a.href = PAPERS[Math.floor(Math.random() * PAPERS.length)]; }
    pick();
    a.addEventListener('click', pick);      // runs before the link is followed
    a.addEventListener('auxclick', pick);
    nav.appendChild(a);
  }

  /* ---------- choosing and remembering the level ---------- */

  function fromUrl() {
    var m = /[?&]spice=([0-3])(?:&|$)/.exec(location.search);
    return m ? Number(m[1]) : null;
  }

  function fromStorage() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && s.level >= 0 && s.level <= 3 && Date.now() - s.t < IDLE_MS) return s.level | 0;
    } catch (e) { /* unavailable or unreadable */ }
    return null;
  }

  function isUnlocked() {
    try { return localStorage.getItem(UNLOCK_KEY) === '1'; } catch (e) { return false; }
  }

  // Called by runner.js when someone catches the running man.
  function unlock() {
    try { localStorage.setItem(UNLOCK_KEY, '1'); } catch (e) { /* ignore */ }
    open = window.SPICE.unlocked = true;
  }

  // The levels on offer: extra high only once it has been unlocked.
  function choices() { return open ? NAMES : NAMES.slice(0, 3); }

  function save(n) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ level: n, t: Date.now() }));
      storageWorks = true;
    } catch (e) {
      storageWorks = false;
    }
  }

  function setLevel(n) {
    n = Math.max(0, Math.min(open ? 3 : 2, n));
    save(n);
    var here = location.pathname + location.search + location.hash;
    var there = location.pathname + '?spice=' + n + location.hash;
    if (there === here) location.reload();
    else location.assign(there);
  }

  // The tabs and other links between pages carry the level too, so it is kept even where
  // localStorage is blocked or kept per file (e.g. Firefox with pages opened from disk).
  function carryLevelInLinks() {
    document.querySelectorAll('a[href]').forEach(function (a) {
      var m = /^([\w-]+\.html)(#.*)?$/.exec(a.getAttribute('href'));
      if (m) a.setAttribute('href', m[1] + '?spice=' + level + (m[2] || ''));
    });
  }

  /* ---------- visit counter ---------- */

  // Resolves to the number of visits, or null if it can't be had.
  function countVisit() {
    if (!window.fetch) return Promise.resolve(null);
    var first = false;
    try { first = !sessionStorage.getItem('visit-counted'); } catch (e) { /* ignore */ }
    var action = location.hostname === LIVE_HOST && first ? 'hit' : 'get';
    if (action === 'get' && level < 2) return Promise.resolve(null);   // only shown at high and above
    return fetch(COUNTER_URL + '/' + action + '/' + COUNTER_NAME)
      .then(function (r) {
        if (!r.ok) throw new Error('counter ' + r.status);
        return r.json();
      })
      .then(function (d) {
        if (action === 'hit') {
          try { sessionStorage.setItem('visit-counted', '1'); } catch (e) { /* ignore */ }
        }
        return typeof d.value === 'number' ? d.value : null;
      })
      .catch(function () { return null; });
  }

  /* ---------- the upgrade control, one per level ---------- */

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function levelButton(n, text, cls) {
    var b = el('button', cls, text);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(n === level));
    b.addEventListener('click', function () { setLevel(n); });
    return b;
  }

  function chillies(n) {
    var s = el('span', 'chillies');
    s.innerHTML = new Array(n + 1).join(CHILLI);
    return s;
  }

  // none: a faint "upgrade" and four small dots, bottom right.
  function understated() {
    var f = el('footer', 'spice spice-0');
    f.setAttribute('aria-label', 'Upgrade level');
    f.appendChild(el('span', 'spice-label', 'upgrade'));
    choices().forEach(function (name, i) {
      var b = levelButton(i, '', 'spice-dot');
      b.title = name;
      b.setAttribute('aria-label', 'upgrade: ' + name);
      f.appendChild(b);
    });
    return f;
  }

  // medium: a glossy toolbar fixed to the bottom of the window, rated in chilli peppers.
  function toolbar() {
    var bar = el('div', 'spice spice-1');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Upgrade level');
    bar.appendChild(el('span', 'spice-label', 'Upgrade'));
    var seg = el('span', 'spice-seg');
    choices().forEach(function (name, i) {
      var b = levelButton(i, i ? null : name);
      if (i) {
        b.appendChild(chillies(i));
        b.title = name;
        b.setAttribute('aria-label', name);
      }
      seg.appendChild(b);
    });
    bar.appendChild(seg);
    return bar;
  }

  // high: a 1997 jump menu with webring-style << >> arrows.
  function jumpMenu() {
    var form = el('form', 'spice spice-2');
    var t = el('table');
    t.setAttribute('border', '2');
    t.setAttribute('cellpadding', '6');
    t.setAttribute('align', 'center');
    var cell = t.insertRow().insertCell();

    var less = levelButton(level - 1, '<<');
    var more = levelButton(level + 1, '>>');
    [less, more].forEach(function (b) { b.removeAttribute('aria-pressed'); });
    less.setAttribute('aria-label', 'downgrade');
    more.setAttribute('aria-label', 'upgrade');
    less.disabled = level === 0;
    more.disabled = level >= choices().length - 1;
    if (!open) more.title = 'catch the running man';

    var label = el('label', null, 'Upgrade: ');
    var select = el('select');
    choices().forEach(function (name, i) { select.appendChild(new Option(name, String(i), false, i === level)); });
    label.appendChild(select);

    var go = el('input');
    go.type = 'submit';
    go.value = 'Go!';

    [less, label, go, more].forEach(function (node, i) {
      if (i) cell.appendChild(document.createTextNode(' '));
      cell.appendChild(node);
    });
    form.appendChild(t);
    if (!open) form.appendChild(el('p', 'spice-hint', 'catch the running man'));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      setLevel(Number(select.value));
    });
    return form;
  }

  // extra high: a blinking fire bar whose chilli buttons scroll past in a <marquee>
  // (it stops while the pointer or keyboard focus is on it, so they can be caught).
  function fireBar() {
    var calm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    var bar = el('div', 'spice spice-3');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Upgrade level');
    bar.appendChild(el('span', 'spice-label', 'Upgrade'));
    var track = el(calm ? 'div' : 'marquee', 'spice-track');
    if (!calm) {
      track.setAttribute('scrollamount', '6');
      var stop = function () { track.stop(); }, go = function () { track.start(); };
      track.addEventListener('mouseenter', stop);
      track.addEventListener('mouseleave', go);
      track.addEventListener('focusin', stop);
      track.addEventListener('focusout', go);
      track.addEventListener('touchstart', stop, { passive: true });
    }
    NAMES.forEach(function (name, i) {
      var b = levelButton(i, null);
      b.appendChild(chillies(i));
      b.appendChild(document.createTextNode(name));
      track.appendChild(b);
    });
    bar.appendChild(track);
    return bar;
  }
})();
