/*
 * Web 1.0 for upgrade level 2 ("high"), plus shared helpers (window.WEB1) that
 * extreme.js uses for level 3. spice.js loads this at levels 2 and 3.
 *
 * At level 2 nothing is duplicated: the page's own content is reused and restructured
 * (tables, rainbow marquee title, starfield, web-safe-palette photo, visit counter,
 * cursor sparkles, and fireworks when you click the background). retro.css styles it.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var level = Number(root.getAttribute('data-spice'));
  if (!(level >= 2)) return;

  var calm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var COLOURS = ['#ff4040', '#ff9900', '#ffee00', '#33ff33', '#33ccff', '#9966ff', '#ff66cc'];
  var PHOTO = 'pictures/prof_pic.jpg';

  window.WEB1 = {
    calm: calm, PHOTO: PHOTO, el: el, rnd: rnd, onReady: onReady,
    dithered: dithered, ditherImage: ditherImage,
    counter: counter, makeFireworks: makeFireworks
  };

  if (level !== 2) return;   // extra high has its own layout (extreme.js)

  root.classList.add('retro');
  onReady(function () {
    [starfield, titles, layoutHome, layoutPapers, photo, footer, sparkles, backgroundFireworks]
      .forEach(function (step) {
        try { step(); } catch (e) { if (window.console) console.warn('web1:', e); }
      });
    root.classList.add('web1-ready');   // retro.css hides the page until this is set
  });

  /* ---------- helpers (shared) ---------- */

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function rnd(n) { return Math.floor(Math.random() * n); }

  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function whenLoaded(img, fn) {
    var done = false;
    function go() { if (!done) { done = true; fn(); } }
    if (img.complete && img.naturalWidth) go();
    else img.addEventListener('load', go, { once: true });
  }

  // Shrink an image to size x size and dither it to the 216-colour web-safe palette.
  // Throws if the browser won't let us read the pixels (pages opened straight from disk).
  function dithered(img, size) {
    var c = el('canvas'), g;
    c.width = c.height = size;
    g = c.getContext('2d');
    g.drawImage(img, 0, 0, size, size);
    var data = g.getImageData(0, 0, size, size);
    webSafeDither(data.data, size, size);
    g.putImageData(data, 0, 0);
    return c;
  }

  // Floyd-Steinberg error diffusion onto 0, 51, 102, ..., 255 per channel.
  function webSafeDither(px, w, h) {
    var n = w * h, buf = new Float32Array(n * 3), i, k, x, y;
    for (i = 0; i < n; i++) for (k = 0; k < 3; k++) buf[i * 3 + k] = px[i * 4 + k];

    function spread(x, y, k, e) {
      if (x < 0 || x >= w || y >= h) return;
      buf[(y * w + x) * 3 + k] += e;
    }

    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        for (k = 0; k < 3; k++) {
          var j = (y * w + x) * 3 + k, old = buf[j];
          var q = Math.max(0, Math.min(255, Math.round(old / 51) * 51));
          var e = old - q;
          buf[j] = q;
          spread(x + 1, y, k, e * 7 / 16);
          spread(x - 1, y + 1, k, e * 3 / 16);
          spread(x, y + 1, k, e * 5 / 16);
          spread(x + 1, y + 1, k, e / 16);
        }
      }
    }
    for (i = 0; i < n; i++) for (k = 0; k < 3; k++) px[i * 4 + k] = buf[i * 3 + k];
  }

  // Replace an <img> with its web-safe dithered version, shown with hard pixel edges.
  function ditherImage(img, size) {
    whenLoaded(img, function () {
      try {
        img.src = dithered(img, size).toDataURL('image/png');
      } catch (e) {
        // Pixels can't be read (page opened straight from disk): pixelate without the palette.
        var c = el('canvas', 'web1-photo-fallback');
        c.width = c.height = size;
        c.getContext('2d').drawImage(img, 0, 0, size, size);
        c.setAttribute('role', 'img');
        c.setAttribute('aria-label', img.alt);
        img.parentNode.replaceChild(c, img);
      }
    });
  }

  // Odometer-style visit counter, filled in from spice.js's site-wide count.
  function counter(parent) {
    var c = el('div', 'web1-counter');
    c.setAttribute('role', 'img');
    show(null);
    parent.appendChild(c);
    if (window.SPICE && SPICE.visits) SPICE.visits.then(show);
    return c;

    function show(n) {
      var digits = n == null ? '------' : String(n).padStart(6, '0');
      c.textContent = '';
      c.setAttribute('aria-label', n == null ? 'visit counter' : n + ' visits');
      digits.split('').forEach(function (d) {
        var s = el('span');
        s.textContent = d;
        c.appendChild(s);
      });
    }
  }

  // A full-window canvas for fireworks. burst() explodes at a point; launch() sends a
  // rocket up from the bottom of the window first. `big` makes everything larger.
  function makeFireworks(big) {
    if (calm) return { burst: function () {}, launch: function () {} };
    var canvas = el('canvas', 'web1-fireworks');
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    var g = canvas.getContext('2d');
    var parts = [], spawn = [], rockets = [], running = false;
    var PALETTE = ['#ff3333', '#ffcc00', '#33ff66', '#33ccff', '#ff66ff', '#ffffff', '#ff9933'];

    function fit() { canvas.width = innerWidth; canvas.height = innerHeight; }
    fit();
    addEventListener('resize', fit);

    function start() { if (!running) { running = true; requestAnimationFrame(frame); } }

    function burst(x, y, n, colour) {
      var a = colour || PALETTE[rnd(PALETTE.length)], b = PALETTE[rnd(PALETTE.length)];
      for (var i = 0; i < n; i++) {
        var angle = Math.random() * Math.PI * 2, speed = 1 + Math.random() * (big ? 5.5 : 3.8);
        spawn.push({
          x: x, y: y,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: 1, decay: 0.011 + Math.random() * 0.014,
          c: Math.random() < 0.7 ? a : b,
          crackle: big && !colour && Math.random() < 0.1
        });
      }
      start();
    }

    function launch(x, y) {
      rockets.push({ x0: x + (Math.random() - 0.5) * 120, y0: innerHeight, x: x, y: y, t: 0 });
      start();
    }

    function frame() {
      g.clearRect(0, 0, canvas.width, canvas.height);

      rockets = rockets.filter(function (r) {
        r.t += 0.045;
        var x = Math.round(r.x0 + (r.x - r.x0) * r.t), y = Math.round(r.y0 + (r.y - r.y0) * r.t);
        g.fillStyle = 'rgba(255, 190, 80, 0.7)';
        g.fillRect(x, y + 4, 1, 8);
        g.fillStyle = '#ffffcc';
        g.fillRect(x - 1, y - 1, 3, 3);
        if (r.t >= 1) { burst(r.x, r.y, 150); return false; }
        return true;
      });

      parts = parts.concat(spawn);
      spawn = [];
      var size = big ? 3 : 2;
      parts = parts.filter(function (p) {
        p.vy += 0.06;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
          if (p.crackle) burst(p.x, p.y, 12, '#ffffff');
          return false;
        }
        g.globalAlpha = p.life;
        g.fillStyle = p.c;
        g.fillRect(Math.round(p.x), Math.round(p.y), size, size);
        return true;
      });
      g.globalAlpha = 1;

      if (parts.length || spawn.length || rockets.length) requestAnimationFrame(frame);
      else { running = false; g.clearRect(0, 0, canvas.width, canvas.height); }
    }

    return { burst: burst, launch: launch };
  }

  /* ---------- level 2 ---------- */

  function layoutTable(cls) {
    var t = el('table', 'web1 ' + cls);
    t.setAttribute('border', '2');
    t.setAttribute('cellpadding', '12');
    t.setAttribute('cellspacing', '3');
    t.setAttribute('width', '100%');
    return t;
  }

  function rainbowRule() {
    var hr = el('hr', 'web1-rainbow');
    hr.setAttribute('aria-hidden', 'true');
    return hr;
  }

  // Tiled black starfield, drawn fresh each time.
  function starfield() {
    var size = 160, c = el('canvas'), g;
    c.width = c.height = size;
    g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, size, size);
    for (var i = 0; i < 70; i++) {
      var v = 80 + rnd(130);
      g.fillStyle = 'rgb(' + v + ',' + v + ',' + Math.min(255, v + 40) + ')';
      g.fillRect(rnd(size), rnd(size), 1, 1);
    }
    for (i = 0; i < 4; i++) {
      var x = 2 + rnd(size - 4), y = 2 + rnd(size - 4);
      g.fillStyle = '#ffffff';
      g.fillRect(x, y - 2, 1, 5);
      g.fillRect(x - 2, y, 5, 1);
    }
    document.body.style.backgroundImage = 'url(' + c.toDataURL() + ')';
  }

  // Page title: one colour per letter, bouncing in a <marquee>.
  function titles() {
    var h = document.querySelector('.page-title');
    if (!h) return;
    var text = h.textContent.trim(), k = 0;
    h.setAttribute('aria-label', text);
    h.textContent = '';
    Array.from(text).forEach(function (ch) {
      if (ch === ' ') { h.appendChild(document.createTextNode(' ')); return; }
      var s = el('span');
      s.textContent = ch;
      s.style.color = COLOURS[k++ % COLOURS.length];
      s.setAttribute('aria-hidden', 'true');
      h.appendChild(s);
    });
    if (calm) return;
    var m = el('marquee');
    m.setAttribute('behavior', 'alternate');
    m.setAttribute('scrollamount', '4');
    h.parentNode.insertBefore(m, h);
    m.appendChild(h);
  }

  // Home: photo column on the left, bio on the right, in a bordered table.
  function layoutHome() {
    var about = document.querySelector('.about');
    if (!about) return;
    var t = layoutTable('web1-about');
    var row = t.insertRow();
    var left = row.insertCell(), right = row.insertCell();
    left.setAttribute('width', '240');
    left.setAttribute('align', 'center');
    left.setAttribute('valign', 'top');
    right.setAttribute('valign', 'top');
    var profile = about.querySelector('.profile'), bio = about.querySelector('.bio');
    if (profile) left.appendChild(profile);
    if (bio) right.appendChild(bio);
    about.parentNode.replaceChild(t, about);
  }

  // Diagrams: each paper becomes a two-row table (navy title bar, then figures),
  // with rainbow rules between papers.
  function layoutPapers() {
    document.querySelectorAll('.paper').forEach(function (paper, i) {
      var head = paper.querySelector('.paper-head'), body = paper.querySelector('.paper-body');
      if (!head || !body) return;
      var t = layoutTable('web1-paper');
      var top = t.insertRow().insertCell();
      top.className = 'web1-head';
      top.setAttribute('bgcolor', '#000080');
      while (head.firstChild) top.appendChild(head.firstChild);
      var bottom = t.insertRow().insertCell();
      while (body.firstChild) bottom.appendChild(body.firstChild);
      head.remove();
      body.remove();
      paper.appendChild(t);
      if (i > 0) paper.parentNode.insertBefore(rainbowRule(), paper);
    });
  }

  function photo() {
    var img = document.querySelector('.photo img');
    if (img) ditherImage(img, 72);
  }

  // Footer: rainbow rule, under-construction stripes and the visit counter.
  function footer() {
    var f = el('div', 'web1-footer');
    f.appendChild(rainbowRule());
    var stripes = el('div', 'web1-construction');
    stripes.setAttribute('aria-hidden', 'true');
    f.appendChild(stripes);
    counter(f);
    (document.querySelector('main') || document.body).appendChild(f);
  }

  // Twinkling cursor trail (mouse only).
  function sparkles() {
    if (calm || !matchMedia('(pointer: fine)').matches) return;
    var last = 0, live = 0, colours = ['#ffff66', '#ff99ff', '#66ffff', '#ffffff'];
    document.addEventListener('mousemove', function (e) {
      var now = Date.now();
      if (now - last < 45 || live > 25) return;
      last = now;
      live++;
      var s = el('span', 'web1-sparkle');
      s.textContent = '✦';
      s.setAttribute('aria-hidden', 'true');
      s.style.left = (e.clientX + 6) + 'px';
      s.style.top = (e.clientY + 6) + 'px';
      s.style.color = colours[rnd(colours.length)];
      s.addEventListener('animationend', function () { s.remove(); live--; });
      document.body.appendChild(s);
    });
  }

  // Click the background (anywhere outside the content boxes and controls) for fireworks.
  function backgroundFireworks() {
    var fw = makeFireworks(false);
    document.addEventListener('click', function (e) {
      if (e.button !== 0) return;
      if (e.target.closest('a, button, input, select, label, textarea, table, .people, .spice, dialog')) return;
      if (window.getSelection && String(getSelection())) return;   // not while selecting text
      fw.burst(e.clientX, e.clientY, 70);
    });
  }
})();
