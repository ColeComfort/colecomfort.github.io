/*
 * Upgrade level 3 ("extra high"): a 1997-style GeoCities homepage (in the spirit of
 * Cameron's World) that can do things 1997 couldn't. spice.js loads it after retro.js,
 * whose helpers (window.WEB1) it uses; extreme.css styles it.
 *
 * Looks: frames over a loud tiled background. Inside, the content is a collage of boxes,
 * each on its own generated gaudy tile, with text in colours close to it (readable, just).
 * Dancing baby and skeleton GIFs, an NSYNC banner, an "under construction" sign, a hit
 * counter, a <marquee> upgrade bar and the song, played through a distortion chain.
 *
 * Does: every click fires a shotgun blast (Web Audio) and leaves a bullet hole. Almost
 * anything can be shot: frames, boxes, paragraphs, titles, list items, every picture.
 * A hit thing burns with an old-school procedural fire while its pixels char darker at
 * random, and every hit makes it crispier, like a JPEG saved over and over. Keep shooting and it comes loose: sometimes one of its two top "pins" goes first
 * and it swings from the other corner before dropping. It falls in jerky, GIF-like steps,
 * and when it hits the bottom of the window it shatters into blocky web-safe tiles in its
 * own colours, which bounce and blink out. Any GIFs on it drop out first and fall to the
 * bottom of whatever it was sitting in, where they carry on. Clicking the bare background sets off
 * fireworks. Reload to get everything back. Links and buttons still work as usual.
 */
(function () {
  'use strict';

  var W = window.WEB1, root = document.documentElement;
  if (!W || root.getAttribute('data-spice') !== '3') return;
  root.classList.add('extreme');

  var calm = W.calm, el = W.el, rnd = W.rnd;
  var SONG = 'audio/tic-toc.mp3';
  var GIF = 'pictures/web1/';
  var BODY_TILE = GIF + 'background.gif';   // a real 90s tile; set to null to use the generated swirl
  var CELL = 4;                  // size of one fire / char pixel

  // Anything you click can be shot. Small things come loose after 3 hits, bigger ones
  // after 5, and whole frames (or anything as big) after 10.
  var FRAME_HITS = 10;
  function hitsFor(e) {
    var r = e.getBoundingClientRect(), area = r.width * r.height;
    return area < 20000 ? 3 : area < 200000 ? 5 : FRAME_HITS;
  }

  var soundOff = false;
  try { soundOff = localStorage.getItem('spice-music') === 'off'; } catch (e) { /* ignore */ }

  var frames = {};               // name -> { outer, inner }
  var tiled = new Map();         // element -> { t: tile, ox, oy } or { t: tile, doc: true } for the page
  var bgLayer = null;            // the drifting, colour-cycling page background

  W.onReady(function () {
    [background, buildFrames, collage, decorations, targets, crosshair, effects, music].forEach(function (step) {
      try { step(); } catch (e) { if (window.console) console.warn('extreme:', e); }
    });
    root.classList.add('web1-ready');   // extreme.css hides the page until this is set
  });

  /* ---------- gaudy tiles, generated pixel by pixel ---------- */

  var T = 64;                    // tile size before doubling
  var SWIRL = [[255, 0, 204], [255, 255, 0], [0, 255, 102], [0, 102, 255], [255, 102, 0], [0, 255, 255], [255, 0, 102], [153, 0, 255]];
  var RAINBOW = [[255, 0, 0], [255, 153, 0], [255, 255, 0], [0, 255, 0], [0, 255, 255], [0, 102, 255], [153, 0, 255], [255, 0, 255]];

  function wrap(d) { d %= T; if (d < -T / 2) d += T; if (d >= T / 2) d -= T; return d; }
  function hash(x, y) { return (Math.abs((x * 73856093) ^ (y * 19349663)) % 1000) / 1000; }

  // Each pattern is seamless. ink and link are text colours near the pattern's own
  // colours but a little darker, so text is hard (not impossible) to read.
  var PATTERNS = {
    swirl: { ink: '#7a0099', link: '#000099', px: function (x, y) {
      var u = x / T * 2 * Math.PI, v = y / T * 2 * Math.PI;
      var s = Math.sin(2 * u + 1.5 * Math.sin(v)) + Math.sin(3 * v + Math.cos(2 * u)) + Math.sin(2 * (u + v)) + Math.cos(u - 2 * v);
      var band = Math.floor((s + 4) * 2 + (Math.random() - 0.5) * 0.35);   // speckled edges, like a dithered GIF
      return SWIRL[((band % SWIRL.length) + SWIRL.length) % SWIRL.length];
    } },
    checks: { ink: '#99008f', link: '#0000cc', px: function (x, y) {
      return ((x >> 4) + (y >> 4)) & 1 ? [255, 0, 255] : [255, 255, 0];
    } },
    stars: { ink: '#8080ff', link: '#ffcc00', px: function (x, y) {
      var S = [[10, 12], [42, 6], [27, 33], [54, 43], [13, 52], [44, 58]];
      for (var i = 0; i < S.length; i++) {
        var dx = wrap(x - S[i][0]), dy = wrap(y - S[i][1]);
        if ((dx === 0 && Math.abs(dy) <= 3) || (dy === 0 && Math.abs(dx) <= 3) || (Math.abs(dx) === 1 && Math.abs(dy) === 1)) return [255, 255, 0];
      }
      return hash(x, y) < 0.012 ? [255, 255, 255] : [0, 0, 128];
    } },
    stripes: { ink: '#802000', link: '#000099', px: function (x, y) {
      return RAINBOW[Math.floor(((x + y) % T) / 8)];
    } },
    dots: { ink: '#006b00', link: '#990066', px: function (x, y) {
      var C = [[8, 8], [40, 8], [24, 40], [56, 40]];
      for (var i = 0; i < C.length; i++) {
        var dx = wrap(x - C[i][0]), dy = wrap(y - C[i][1]);
        if (dx * dx + dy * dy <= 36) return [255, 0, 255];
      }
      return [0, 255, 0];
    } },
    zigzag: { ink: '#00667a', link: '#99004d', px: function (x, y) {
      return (y + Math.abs((x % 16) - 8)) % 16 < 8 ? [0, 255, 255] : [255, 102, 204];
    } },
    // a lit-up disco floor for the dance floor
    disco: { ink: '#ffffff', link: '#ffff00', px: function (x, y) {
      var cx = x % 16, cy = y % 16;
      if (cx === 0 || cy === 0) return [0, 0, 0];                          // grout
      var lit = [[255, 0, 255], [0, 255, 255], [255, 255, 0], [0, 255, 0], [0, 102, 255], [40, 0, 60]];
      var c = lit[Math.floor(hash(x >> 4, y >> 4) * lit.length)];
      return cx < 4 && cy < 4 ? [255, 255, 255] : c;                       // a glint in each corner
    } }
  };

  var tileCache = {};

  function tile(name) {
    if (tileCache[name]) return tileCache[name];
    var p = PATTERNS[name], small = el('canvas'), g, img, d, x, y;
    small.width = small.height = T;
    g = small.getContext('2d');
    img = g.createImageData(T, T);
    d = img.data;
    for (y = 0; y < T; y++) {
      for (x = 0; x < T; x++) {
        var c = p.px(x, y), k = (y * T + x) * 4;
        d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    var big = el('canvas'), bg;                // doubled, with hard pixel edges
    big.width = big.height = T * 2;
    bg = big.getContext('2d');
    bg.imageSmoothingEnabled = false;
    bg.drawImage(small, 0, 0, T * 2, T * 2);
    return (tileCache[name] = {
      url: big.toDataURL(), w: T * 2, h: T * 2,
      data: bg.getImageData(0, 0, T * 2, T * 2).data, ink: p.ink, link: p.link
    });
  }

  function tileColour(t, x, y) {
    var bx = ((Math.floor(x) % t.w) + t.w) % t.w, by = ((Math.floor(y) % t.h) + t.h) % t.h, k = (by * t.w + bx) * 4;
    return [t.data[k], t.data[k + 1], t.data[k + 2]];
  }

  // The page background lives on its own layer so it can drift diagonally and cycle
  // through colours (extreme.css animates it) without touching anything in front.
  function background() {
    var body = document.body;
    bgLayer = el('div', 'xf-bg');
    bgLayer.setAttribute('aria-hidden', 'true');
    body.insertBefore(bgLayer, body.firstChild);
    if (!BODY_TILE) {
      var t = tile('swirl');
      bgLayer.style.backgroundImage = 'url(' + t.url + ')';
      tiled.set(body, { t: t, doc: true });
      return;
    }
    bgLayer.style.backgroundImage = 'url(' + BODY_TILE + ')';
    var img = new Image();
    img.onload = function () {
      try {
        var c = el('canvas'), g;
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        tiled.set(body, { t: { url: BODY_TILE, w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data }, doc: true });
      } catch (e) { /* can't sample it; shards use other colours */ }
    };
    img.src = BODY_TILE;
  }

  // Where the drifting background is right now: its offset and how far its hue has turned.
  function bodyLook() {
    var cs = bgLayer ? getComputedStyle(bgLayer) : null;
    var pos = cs ? cs.backgroundPosition.split(' ').map(parseFloat) : [0, 0];
    var hue = cs ? /hue-rotate\(([-\d.]+)deg\)/.exec(cs.filter) : null;
    return { dx: pos[0] || 0, dy: pos[1] || 0, deg: hue ? parseFloat(hue[1]) : 0 };
  }

  // The same maths as CSS hue-rotate(), for one colour.
  function hueRotate(c, deg) {
    if (!deg) return c;
    var a = deg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    var m = [
      0.213 + cs * 0.787 - sn * 0.213, 0.715 - cs * 0.715 - sn * 0.715, 0.072 - cs * 0.072 + sn * 0.928,
      0.213 - cs * 0.213 + sn * 0.143, 0.715 + cs * 0.285 + sn * 0.140, 0.072 - cs * 0.072 - sn * 0.283,
      0.213 - cs * 0.213 - sn * 0.787, 0.715 - cs * 0.715 + sn * 0.715, 0.072 + cs * 0.928 + sn * 0.072
    ];
    return [0, 1, 2].map(function (i) {
      return Math.max(0, Math.min(255, m[i * 3] * c[0] + m[i * 3 + 1] * c[1] + m[i * 3 + 2] * c[2]));
    });
  }

  // A copy of a tile with its hue turned, for pieces of background that come loose.
  function turnedTile(t, deg) {
    var c = el('canvas'), g, img, d, i;
    c.width = t.w;
    c.height = t.h;
    g = c.getContext('2d');
    img = g.createImageData(t.w, t.h);
    d = img.data;
    for (i = 0; i < d.length; i += 4) {
      var p = hueRotate([t.data[i], t.data[i + 1], t.data[i + 2]], deg);
      d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return { url: c.toDataURL(), w: t.w, h: t.h, data: d };
  }

  // Put a box on its own tile, with text colours close to it.
  function paint(box, name) {
    var t = tile(name);
    box.style.backgroundImage = 'url(' + t.url + ')';
    box.style.setProperty('--ink', t.ink);
    box.style.setProperty('--link', t.link);
    tiled.set(box, { t: t, ox: 0, oy: 0 });
  }

  /* ---------- frames, collage and decorations ---------- */

  function pane(name) {
    var outer = el('div', 'xf-pane xf-' + name + ' xf-burnable'), inner = el('div', 'xf-scroll');
    outer.setAttribute('data-hp', String(FRAME_HITS));
    outer.appendChild(inner);
    frames[name] = { outer: outer, inner: inner };
    return outer;
  }

  function buildFrames() {
    var body = document.body;
    var top = pane('top'), left = pane('left'), centre = pane('main');

    var title = document.querySelector('.page-title');
    if (title) frames.top.inner.appendChild(title);

    var nav = document.querySelector('.site-nav');
    if (nav) frames.left.inner.appendChild(nav);

    var profile = document.querySelector('.profile');
    if (!profile) {
      // other pages: a copy of the photo for the left frame
      profile = el('div', 'profile');
      var photo = el('div', 'photo'), img = new Image();
      img.alt = '';
      img.src = W.PHOTO;
      photo.appendChild(img);
      profile.appendChild(photo);
    }
    frames.left.inner.appendChild(profile);
    var face = profile.querySelector('.photo img');
    if (face) W.ditherImage(face, 72);
    W.counter(frames.left.inner);

    var main = document.querySelector('main');
    if (main) frames.main.inner.appendChild(main);

    var header = document.querySelector('.site-header');
    if (header) header.remove();

    body.insertBefore(centre, body.firstChild);
    body.insertBefore(left, centre);
    body.insertBefore(top, left);
    var bar = document.querySelector('.spice-3');
    if (bar) body.appendChild(bar);          // the bottom frame

    document.querySelectorAll('.figure .frame').forEach(function (f) { f.classList.add('xf-figure'); });
  }

  function collage() {
    var order = ['checks', 'stars', 'stripes', 'dots', 'zigzag', 'swirl'], i = 0;
    document.querySelectorAll('.xf-main .bio, .xf-main .paper, .xf-main .people').forEach(function (box) {
      paint(box, order[i++ % order.length]);
    });
    var profile = document.querySelector('.profile');
    if (profile) paint(profile, 'stars');
  }

  function gif(name, cls) {
    var i = new Image();
    i.src = GIF + name;
    i.alt = '';
    i.className = cls;
    return i;
  }

  // The GIFs are grouped by theme rather than scattered: babies either side of the title,
  // the peacock showing off under your details, a dance floor (banner, waltzers, robot DJ,
  // skeleton) at the end of the content, and the site badges together in the footer.
  function decorations() {
    var top = frames.top.inner, left = frames.left.inner, main = frames.main.inner;
    top.insertBefore(gif('dancing-baby.gif', 'xf-dancer'), top.firstChild);
    top.appendChild(gif('baby-cha-cha.gif', 'xf-dancer'));

    left.appendChild(gif('peacock.gif', 'xf-peacock'));

    var floor = el('div', 'xf-dancefloor');
    floor.appendChild(gif('nsync.gif', 'xf-banner'));
    var row = el('div', 'xf-floor');
    row.appendChild(gif('waltz.gif', 'xf-dancer'));
    row.appendChild(gif('robot.gif', 'xf-dancer'));
    row.appendChild(gif('skeleton.gif', 'xf-dancer'));
    floor.appendChild(row);
    main.appendChild(floor);
    paint(floor, 'disco');

    var foot = el('div', 'xf-foot');
    foot.appendChild(gif('under-construction.gif', 'xf-construction'));
    foot.appendChild(gif('cat-globe.gif', 'xf-badge'));
    var best = el('p', 'xf-best');
    best.textContent = 'best viewed at 800 × 600';
    foot.appendChild(best);
    main.appendChild(foot);
  }

  // Pictures get a wrapper, which can hold the bullet holes and charring that an <img> can't.
  function targets() {
    document.querySelectorAll('.xf-pane img').forEach(function (img) {
      var w = el('span', 'xf-wrap');
      if (img.classList.contains('xf-dancer')) w.classList.add('xf-dancer-wrap');
      if (/waltz/.test(img.src)) w.classList.add('xf-flyaway');      // shot, they float up and away
      if (img.style.width === '100%') {           // figures sized as a share of the column
        w.style.width = '100%';
        w.style.maxWidth = img.style.maxWidth;
        img.style.maxWidth = '';
      }
      img.parentNode.insertBefore(w, img);
      w.appendChild(img);
    });
  }

  // The element a click lands on: pictures and canvases count as their wrapper, the inside
  // of a frame as the frame; the page itself (and the background) is not a target.
  function targetOf(node) {
    var t = node && (node.nodeType === 1 ? node : node.parentElement);
    if (t && /^(IMG|CANVAS|svg|path)$/.test(t.tagName)) t = t.closest('.xf-wrap, .photo') || t.parentElement;
    if (t && t.classList.contains('xf-scroll')) t = t.parentElement;
    if (!t || t === document.body || t === root || t === bgLayer) return null;
    return t;
  }

  /* ---------- crosshair cursor ---------- */

  function crosshair() {
    var c = el('canvas'), g;
    c.width = c.height = 32;
    g = c.getContext('2d');
    [['#000000', 4], ['#ff2a2a', 2]].forEach(function (s) {
      g.strokeStyle = s[0];
      g.lineWidth = s[1];
      g.beginPath();
      g.arc(16, 16, 9, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(16, 1); g.lineTo(16, 9);
      g.moveTo(16, 23); g.lineTo(16, 31);
      g.moveTo(1, 16); g.lineTo(9, 16);
      g.moveTo(23, 16); g.lineTo(31, 16);
      g.stroke();
    });
    g.fillStyle = '#ff2a2a';
    g.fillRect(15, 15, 2, 2);
    addStyle('html.extreme, html.extreme * { cursor: url(' + c.toDataURL() + ') 16 16, crosshair !important; }');
  }

  function addStyle(css) {
    var s = el('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---------- sound: one Web Audio context for the effects and the song ---------- */

  var sound = (function () {
    var ac = null, bus = null, noise = null;

    function context() {
      if (!ac) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
        var shaper = ac.createWaveShaper(), curve = new Float32Array(512), master = ac.createGain();
        for (var i = 0; i < 512; i++) curve[i] = Math.tanh(2.5 * (i / 255.5 - 1));   // a bit of crunch
        shaper.curve = curve;
        master.gain.value = 0.4;
        bus = ac.createGain();
        bus.connect(shaper);
        shaper.connect(master);
        master.connect(ac.destination);
        noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        var d = noise.getChannelData(0);
        for (i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      return ac;
    }

    function ready() {
      if (soundOff || !context()) return false;
      if (ac.state === 'suspended') ac.resume();
      return true;
    }

    function hiss(t, dur, f0, f1, vol, type) {   // filtered noise, filter sweeping f0 -> f1
      var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noise;
      f.type = type || 'lowpass';
      f.frequency.setValueAtTime(f0, t);
      f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f);
      f.connect(g);
      g.connect(bus);
      s.start(t, Math.random() * 0.4);
      s.stop(t + dur + 0.05);
    }

    function tone(t, f0, f1, dur, vol, type) {   // an oscillator gliding f0 -> f1
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(bus);
      o.start(t);
      o.stop(t + dur + 0.05);
    }

    return {
      context: context,
      shot: function () {          // shotgun blast, then the pump: "chk-chk"
        if (!ready()) return;
        var t = ac.currentTime;
        hiss(t, 0.35, 7000, 180, 1);
        tone(t, 160, 38, 0.2, 0.9);
        hiss(t + 0.42, 0.05, 3200, 2600, 0.3, 'highpass');
        hiss(t + 0.55, 0.06, 2400, 1900, 0.35, 'highpass');
      },
      pin: function () {           // a pin popping out
        if (!ready()) return;
        tone(ac.currentTime, 2400, 900, 0.12, 0.25, 'square');
      },
      rise: function () {          // whistle on the way up
        if (!ready()) return;
        tone(ac.currentTime, 300, 1800, 0.8, 0.12, 'square');
      },
      fall: function () {          // cartoon whistle on the way down
        if (!ready()) return;
        tone(ac.currentTime, 1500, 260, 0.9, 0.12, 'square');
      },
      crash: function () {         // hitting the bottom: a boom and some tinkling
        if (!ready()) return;
        var t = ac.currentTime;
        hiss(t, 1.2, 2600, 50, 1);
        tone(t, 95, 24, 0.7, 1);
        for (var i = 0; i < 7; i++) hiss(t + 0.08 + Math.random() * 0.6, 0.07, 9000, 6000, 0.2, 'highpass');
      }
    };
  })();

  /* ---------- old-school procedural fire ---------- */

  // Heat values 0..36 per cell. Each step the bottom row is re-lit, every cell passes its
  // heat to the cell above (drifting sideways at random) and loses a little on the way.
  var FIRE_RGBA = (function () {
    var p = [];
    for (var i = 0; i <= 36; i++) {
      var t = i / 36;
      p.push([
        Math.min(255, Math.round(t * 2.6 * 255)),
        Math.max(0, Math.min(255, Math.round((t * 2.6 - 1) * 255))),
        Math.max(0, Math.min(255, Math.round((t * 2.6 - 1.9) * 300))),
        i === 0 ? 0 : Math.min(255, i * 40)
      ]);
    }
    return p;
  })();

  function Fire() {
    this.w = this.h = 0;
    this.c = el('canvas');
    this.g = this.c.getContext('2d');
  }
  Fire.prototype.fit = function (w, h) {
    if (w === this.w && h === this.h) return;
    this.w = this.c.width = w;
    this.h = this.c.height = h;
    this.f = new Uint8Array(w * h);
    this.img = this.g.createImageData(w, h);
  };
  // lit: keep feeding the fire; hot: how much of the bottom row is lit; reach: roughly how
  // far up the grid the flames get (0..1); (sx, sy): a hot spot, e.g. where it was shot
  Fire.prototype.step = function (lit, hot, reach, sx, sy) {
    var w = this.w, h = this.h, f = this.f, x, y, alive = false;
    var drop = Math.max(0.2, 36 / (h * reach));          // average heat lost per row
    for (x = 0; x < w; x++) f[(h - 1) * w + x] = lit && Math.random() < hot ? 36 : 0;
    if (lit && sy >= 0 && sy < h - 1) {
      for (x = sx - 3; x <= sx + 3; x++) if (x >= 0 && x < w && Math.random() < 0.8) f[sy * w + x] = 36;
    }
    for (x = 0; x < w; x++) {
      for (y = 1; y < h; y++) {
        var src = y * w + x, v = f[src];
        if (!v) { f[src - w] = 0; continue; }
        alive = true;
        var dx = x + rnd(3) - 1;
        if (dx < 0) dx = 0; else if (dx >= w) dx = w - 1;
        var nv = v - Math.floor(drop) - (Math.random() < drop % 1 ? 1 : 0);
        f[(y - 1) * w + dx] = nv > 0 ? nv : 0;
      }
    }
    var d = this.img.data;
    for (var i = 0, k = 0; i < f.length; i++, k += 4) {
      var p = FIRE_RGBA[f[i]];
      d[k] = p[0]; d[k + 1] = p[1]; d[k + 2] = p[2]; d[k + 3] = p[3];
    }
    this.g.putImageData(this.img, 0, 0);
    return alive;
  };

  /* ---------- shooting, burning, falling, shattering ---------- */

  function effects() {
    var canvas = el('canvas', 'xf-effects');
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    var g = canvas.getContext('2d');
    var fires = [], fallers = [], shards = [], sparks = [], chars = new Map();
    var running = false, last = 0, clock = { fire: 0, char: 0, fall: 0 };
    var fireworks = W.makeFireworks(true);

    function fit() { canvas.width = innerWidth; canvas.height = innerHeight; }
    fit();
    addEventListener('resize', fit);

    holeSprite();
    crispFilters();

    // the page title burns gently all the time, like a 1997 Java fire applet
    var title = document.querySelector('.page-title');
    if (title && !calm) fires.push({ el: title, fire: new Fire(), ambient: true });

    document.addEventListener('click', function (e) {
      if (e.button !== 0 || !e.target.closest) return;
      sound.shot();
      spark(e.clientX, e.clientY);
      start();
      // links and controls work as usual (the figures are links, but they get shot);
      // the runner (runner.js) dodges instead
      if (e.target.closest('a:not(.xf-figure), button, input, select, label, textarea, .spice, dialog, .runner')) return;
      var box = targetOf(e.target);
      if (!box) {
        bulletHole(null, e.clientX, e.clientY);
        fireworks.launch(e.clientX, e.clientY);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (box.closest('.xf-dead')) return;                            // already on its way: just the bang
      if (box.classList.contains('xf-flyaway')) flyAway(box);
      else hit(box, e.clientX, e.clientY);
    }, true);

    start();

    function start() { if (!running) { running = true; last = 0; requestAnimationFrame(loop); } }

    function loop(now) {
      var dt = last ? Math.min(100, now - last) : 16;
      last = now;
      clock.fire += dt; clock.char += dt; clock.fall += dt;
      // fixed rates whatever the screen's refresh rate (catching up a few steps if needed)
      for (var i = 0; clock.fire >= 33 && i < 4; i++) { clock.fire -= 33; stepFires(now); }    // ~30 fps, like the demos
      for (i = 0; clock.char >= 100 && i < 2; i++) { clock.char -= 100; stepChar(now); }
      for (i = 0; clock.fall >= 83 && i < 3; i++) { clock.fall -= 83; stepFall(); }          // ~12 fps: jerky, like a GIF
      clock.fire = Math.min(clock.fire, 33); clock.char = Math.min(clock.char, 100); clock.fall = Math.min(clock.fall, 83);
      sparks = sparks.filter(function (p) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life -= 0.08;
        return p.life > 0;
      });
      draw();
      if (fires.length || fallers.length || shards.length || sparks.length) requestAnimationFrame(loop);
      else { running = false; g.clearRect(0, 0, canvas.width, canvas.height); }
    }

    function draw() {
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.imageSmoothingEnabled = false;
      shards.forEach(function (s) {
        g.fillStyle = s.c;
        g.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s);
      });
      fires.forEach(function (f) {
        if (!f.r || !f.fire.w) return;
        g.drawImage(f.fire.c, f.r.left, f.r.bottom - f.fire.h * CELL, f.fire.w * CELL, f.fire.h * CELL);
      });
      g.fillStyle = '#ffff66';
      sparks.forEach(function (p) { g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); });
    }

    /* --- hits --- */

    function hit(box, x, y) {
      if (!box.hasAttribute('data-hp')) box.setAttribute('data-hp', String(hitsFor(box)));
      var hp = Number(box.getAttribute('data-hp'));
      var dmg = (Number(box.getAttribute('data-dmg')) || 0) + 1;
      box.setAttribute('data-dmg', String(dmg));
      box.setAttribute('data-heat', Math.min(1, dmg / hp).toFixed(2));
      crisp(box, dmg);
      bulletHole(box, x, y);
      var r = box.getBoundingClientRect(), c = charFor(box);
      var cx = Math.floor((x - r.left - box.clientLeft) / CELL), cy = Math.floor((y - r.top - box.clientTop) / CELL);
      for (var dy = -3; dy <= 3; dy++) {          // a scorch mark where it was hit
        for (var dx = -3; dx <= 3; dx++) {
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= 3.2) scorch(c, cx + dx, cy + dy, (0.45 - dist * 0.12) * (0.5 + Math.random()));
        }
      }
      box.classList.remove('xf-hit');
      void box.offsetWidth;                      // restart the jolt
      box.classList.add('xf-hit');

      var entry = null;
      fires.forEach(function (f) { if (f.el === box) entry = f; });
      if (!entry) fires.push(entry = { el: box, fire: new Fire() });
      entry.until = Math.max(entry.until || 0, performance.now() + 1800 + dmg * 300);
      entry.ox = x - r.left;
      entry.oy = y - r.top;
      start();
      if (dmg >= hp) drop(box);
    }

    /* --- JPEG-ifying: every hit makes it crispier --- */

    // Six SVG filters of increasing crunch: over-sharpened (the halos of a badly
    // compressed JPEG), partly broken into 8x8 blocks, over-saturated, and banded into
    // fewer and fewer colours. Big things get a lighter version (no blocks or sharpening)
    // so the page stays responsive.
    function crispFilters() {
      var defs = '';
      for (var n = 1; n <= 6; n++) {
        var t = n / 6, a = 0.2 + 0.6 * t, mix = 0.12 + 0.5 * t;
        var levels = Math.max(5, 26 - 4 * n), contrast = 1 + 0.7 * t, table = [];
        for (var i = 0; i < levels; i++) {
          table.push(Math.max(0, Math.min(1, 0.5 + (i / (levels - 1) - 0.5) * contrast)).toFixed(3));
        }
        var band = '<feColorMatrix type="saturate" values="' + (1 + 1.6 * t).toFixed(2) + '"/>' +
          '<feComponentTransfer>' + ['R', 'G', 'B'].map(function (c) {
            return '<feFunc' + c + ' type="discrete" tableValues="' + table.join(' ') + '"/>';
          }).join('') + '</feComponentTransfer>';
        var region = 'x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"';
        defs +=
          '<filter id="xf-jpeg-' + n + '" ' + region + '>' +
            '<feConvolveMatrix order="3" preserveAlpha="true" kernelMatrix="0 ' + (-a).toFixed(2) + ' 0 ' +
              (-a).toFixed(2) + ' ' + (1 + 4 * a).toFixed(2) + ' ' + (-a).toFixed(2) + ' 0 ' + (-a).toFixed(2) + ' 0" result="crisp"/>' +
            '<feFlood x="3" y="3" width="2" height="2"/>' +                 // one dot per 8x8 block...
            '<feComposite width="8" height="8"/><feTile result="grid"/>' +
            '<feComposite in="SourceGraphic" in2="grid" operator="in"/>' +  // ...picking up the colour there...
            '<feMorphology operator="dilate" radius="4" result="blocks"/>' + // ...spread over the block
            '<feComposite in="blocks" in2="crisp" operator="arithmetic" k2="' + mix.toFixed(2) + '" k3="' + (1 - mix).toFixed(2) + '"/>' +
            band +
          '</filter>' +
          '<filter id="xf-jpegl-' + n + '" ' + region + '>' + band + '</filter>';
      }
      var holder = el('div');
      holder.innerHTML = '<svg width="0" height="0" aria-hidden="true" style="position:absolute"><defs>' + defs + '</defs></svg>';
      document.body.appendChild(holder.firstChild);
    }

    function crisp(box, dmg) {
      var n = Math.min(dmg, 6);
      if (box.querySelector('img[src$=".gif"]')) {
        // Browsers stop animating GIFs under an SVG filter (they only move again when
        // something else repaints), so anything with a GIF in it gets a plain deep-fry.
        box.style.filter = 'contrast(' + (1 + 0.22 * n).toFixed(2) + ') saturate(' + (1 + 0.45 * n).toFixed(2) + ')';
        return;
      }
      var big = box.offsetWidth * box.offsetHeight > 250000;
      box.style.filter = 'url(#xf-jpeg' + (big ? 'l-' : '-') + n + ')';
      if (!box.matches('.xf-wrap, .photo')) return;
      box.querySelectorAll('img').forEach(function (img) {
        // animated GIFs would freeze if re-saved, so they only get the filter
        if (!/\.gif($|\?)/i.test(img.getAttribute('src') || '')) resave(img, dmg);
      });
    }

    // Re-save a still picture as a JPEG, worse each time and each time from the last copy.
    function resave(img, dmg) {
      if (!img.complete || !img.naturalWidth) return;
      try {
        var w0 = Number(img.dataset.w0) || img.naturalWidth, h0 = Number(img.dataset.h0) || img.naturalHeight;
        img.dataset.w0 = w0;
        img.dataset.h0 = h0;
        var scale = Math.min(1, 900 / w0) * Math.max(0.35, 1 - dmg * 0.1);
        var w = Math.max(8, Math.round(w0 * scale)), h = Math.max(8, Math.round(h0 * scale));
        var c = el('canvas'), cg;
        c.width = w;
        c.height = h;
        cg = c.getContext('2d');
        cg.fillStyle = '#ffffff';
        cg.fillRect(0, 0, w, h);
        cg.drawImage(img, 0, 0, w, h);
        img.src = c.toDataURL('image/jpeg', [0.5, 0.3, 0.18, 0.1, 0.05, 0.02][Math.min(dmg, 6) - 1]);
      } catch (e) { /* can't read it (page opened from disk): the filter alone will do */ }
    }

    function bulletHole(box, x, y) {
      var h = el('span', 'xf-hole');
      h.setAttribute('aria-hidden', 'true');
      if (!box) {
        h.classList.add('xf-hole-free');
        h.style.left = (x - 8) + 'px';
        h.style.top = (y - 8) + 'px';
        document.body.appendChild(h);
        setTimeout(function () { h.remove(); }, 6000);
        return;
      }
      if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
      var r = box.getBoundingClientRect();
      h.style.left = (x - r.left - box.clientLeft - 8) + 'px';
      h.style.top = (y - r.top - box.clientTop - 8) + 'px';
      box.appendChild(h);
    }

    // A small pixel-art bullet hole, drawn once.
    function holeSprite() {
      var rows = [
        '..xxx...',
        '.xooox..',
        'xobbbox.',
        'xobbbox.',
        'xobbbox.',
        '.xooox.c',
        '..xxx...',
        'c.....c.'
      ];
      var colours = { x: '#1a1008', o: '#4a2c12', b: '#000000', c: '#2a1a0a' };
      var c = el('canvas'), cg;
      c.width = c.height = 8;
      cg = c.getContext('2d');
      rows.forEach(function (row, y) {
        row.split('').forEach(function (ch, x) {
          if (colours[ch]) { cg.fillStyle = colours[ch]; cg.fillRect(x, y, 1, 1); }
        });
      });
      addStyle('.xf-hole { background-image: url(' + c.toDataURL() + '); }');
    }

    /* --- charring: pixels go darker at random while it burns --- */

    function charFor(box) {
      var c = chars.get(box);
      if (c) return c;
      if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
      var cv = el('canvas', 'xf-char');
      cv.setAttribute('aria-hidden', 'true');
      var cols = Math.max(1, Math.ceil(box.clientWidth / CELL)), rows = Math.max(1, Math.ceil(box.clientHeight / CELL));
      cv.width = cols;
      cv.height = rows;
      box.appendChild(cv);
      c = { g: cv.getContext('2d'), cols: cols, rows: rows, d: new Float32Array(cols * rows) };
      chars.set(box, c);
      return c;
    }

    function scorch(c, x, y, amount) {
      if (x < 0 || y < 0 || x >= c.cols || y >= c.rows || amount <= 0) return;
      var i = y * c.cols + x, v = Math.min(0.88, c.d[i] + amount);
      c.d[i] = v;
      c.g.clearRect(x, y, 1, 1);
      c.g.fillStyle = 'rgba(28, 10, 0, ' + v.toFixed(2) + ')';
      c.g.fillRect(x, y, 1, 1);
    }

    function stepChar(now) {
      fires.forEach(function (f) {
        if (f.ambient || !(now < f.until) || !f.el.isConnected) return;
        var c = charFor(f.el), heat = parseFloat(f.el.getAttribute('data-heat')) || 0.2;
        var n = Math.ceil(c.cols * c.rows * (0.0015 + heat * 0.004));
        var hx = Math.floor(f.ox / CELL), hy = Math.floor(f.oy / CELL);
        for (var i = 0; i < n; i++) {
          var p = Math.random(), x, y;
          if (p < 0.5) { x = rnd(c.cols); y = c.rows - 1 - Math.floor(c.rows * Math.pow(Math.random(), 3)); }
          else if (p < 0.85) { x = hx + Math.round(gauss() * 6); y = hy + Math.round(gauss() * 6); }
          else { x = rnd(c.cols); y = rnd(c.rows); }
          scorch(c, x, y, 0.03 + Math.random() * 0.1);
        }
      });
    }

    function gauss() { return Math.random() + Math.random() + Math.random() - 1.5; }

    /* --- fire: along the bottom of the visible part of whatever is burning --- */

    function stepFires(now) {
      fires = fires.filter(function (f) {
        var r = f.el.isConnected ? f.el.getBoundingClientRect() : null;
        if (!r || !r.width) return false;
        // once something comes loose its fire is no longer fed and dies down as it falls
        var lit = !f.el.closest('.xf-dead') && (f.ambient || now < f.until);
        var top = Math.max(r.top, 0), bottom = Math.min(r.bottom, innerHeight);
        var frame = f.el.closest('.xf-falling') ? null : f.el.closest('.xf-scroll');
        if (frame) {                                         // only the part showing in its frame
          var fr = frame.getBoundingClientRect();
          top = Math.max(top, fr.top);
          bottom = Math.min(bottom, fr.bottom);
        }
        if (bottom <= top) { f.r = null; return lit; }      // out of sight for now
        var w = Math.max(4, Math.ceil(r.width / CELL));
        var h = Math.max(16, Math.min(110, Math.ceil((bottom - top) / CELL) + (f.ambient ? 6 : 10)));
        f.fire.fit(w, h);
        var heat = parseFloat(f.el.getAttribute('data-heat')) || 0.2;
        var sx = -1, sy = -1;
        if (!f.ambient) {
          sx = Math.floor(f.ox / CELL);
          sy = h - 1 - Math.floor((bottom - (r.top + f.oy)) / CELL);
        }
        f.alive = f.fire.step(lit, f.ambient ? 0.3 : 0.5 + heat * 0.45, f.ambient ? 0.45 : 0.8, sx, sy);
        f.r = { left: r.left, bottom: bottom };
        return lit || f.alive;
      });
    }

    /* --- coming loose and falling --- */

    function drop(box) {
      var isPane = box.classList.contains('xf-pane');
      // its GIFs don't go down with it: they drop out and fall to the bottom of its parent
      if (!box.matches('.xf-wrap')) {
        var host = box.parentElement;
        box.querySelectorAll('.xf-wrap').forEach(function (g) {
          var img = g.querySelector('img');
          if (img && /\.gif($|\?)/i.test(img.getAttribute('src') || '')) dropOut(g, host);
        });
      }
      var r = box.getBoundingClientRect();
      keepLook(box, r);
      liftOut(box, r, !isPane);

      // Pinned at its two top corners: sometimes one pin goes first and it swings
      // down from the other corner before letting go.
      var swing = Math.random() < 0.55, side = Math.random() < 0.5 ? 1 : -1;
      box.style.transformOrigin = swing ? (side > 0 ? 'top left' : 'top right') : 'center';
      fallers.push({
        el: box, top: r.top, vy: 0, isPane: isPane, from: r,
        swinging: swing, angle: 0, av: 0, target: side * (28 + Math.random() * 30),
        ticks: 0, hang: 6 + rnd(8), spin: swing ? 0 : (Math.random() - 0.5) * 3
      });
      if (swing) sound.pin(); else sound.fall();
      start();
    }

    // Take it out of the page flow and pin it where it is, ready to move on its own;
    // optionally leave a gap where it was, which closes up behind it.
    function liftOut(box, r, gap) {
      box.classList.add('xf-dead');
      box.classList.remove('xf-hit');
      if (gap && box.parentNode !== document.body) {
        var g = el('span', 'xf-gap');
        g.style.width = box.offsetWidth + 'px';
        g.style.height = box.offsetHeight + 'px';
        box.parentNode.insertBefore(g, box);
        requestAnimationFrame(function () { g.style.width = g.style.height = '0px'; });
        setTimeout(function () { g.remove(); }, 600);
      }
      box.classList.add('xf-falling');
      box.style.left = r.left + 'px';
      box.style.top = r.top + 'px';
      box.style.width = r.width + 'px';
      box.style.height = r.height + 'px';
      if (box.parentNode !== document.body) document.body.appendChild(box);
    }

    // A GIF falling out of something that has been shot down: it drops to the bottom of
    // `host` (the visible part of it) and settles there, still animating and still a target.
    function dropOut(g, host) {
      var r = g.getBoundingClientRect();
      liftOut(g, r, true);
      g.style.transform = '';
      fallers.push({ el: g, top: r.top, left: r.left, h: r.height, vy: 0, settling: true, host: host,
                     floor: Math.max(r.bottom, floorOf(host)) });
    }

    function floorOf(host) {
      if (!host || host === document.body) {                // the page: stand on the upgrade bar
        var bar = document.querySelector('.spice-3');
        var top = bar ? bar.getBoundingClientRect().top : innerHeight;
        return top > 0 && top < innerHeight ? top : innerHeight;
      }
      var hr = host.getBoundingClientRect(), b = hr.top + host.clientTop + host.clientHeight;
      var frame = host.closest('.xf-scroll');
      if (frame) b = Math.min(b, frame.getBoundingClientRect().bottom);
      return Math.min(b, innerHeight);
    }

    function settle(f) {
      var g = f.el, host = f.host;
      g.classList.remove('xf-falling', 'xf-dead');
      g.classList.add('xf-landed');
      if (!host || host === document.body || !host.isConnected) {   // resting on the bottom of the window
        g.style.position = 'fixed';
        g.style.top = Math.round(f.top) + 'px';
        return;
      }
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      var hr = host.getBoundingClientRect();
      g.style.position = 'absolute';
      g.style.left = Math.round(f.left - hr.left - host.clientLeft + host.scrollLeft) + 'px';
      g.style.top = Math.round(f.top - hr.top - host.clientTop + host.scrollTop) + 'px';
      host.appendChild(g);
    }

    // The waltzing couple: shot, they rise straight up, faster and faster, out of the top.
    function flyAway(box) {
      var r = box.getBoundingClientRect();
      liftOut(box, r, true);
      fallers.push({ el: box, top: r.top, vy: -4, flying: true });
      sound.rise();
      start();
    }

    // Once it leaves its box it would lose its colours and the background behind it,
    // so copy those onto it (the patch of tile it was sitting on goes with it).
    function keepLook(box, r) {
      var cs = getComputedStyle(box);
      ['color', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'textAlign'].forEach(function (p) {
        box.style[p] = cs[p];
      });
      box.querySelectorAll('a').forEach(function (a) { a.style.color = getComputedStyle(a).color; });
      if (cs.backgroundImage !== 'none' || solid(cs.backgroundColor)) return;
      if (!box.textContent.trim()) return;           // pictures keep their see-through parts
      for (var host = box.parentElement; host; host = host.parentElement) {
        var t = tiled.get(host);
        if (!t) continue;
        var patch = t.t, ox, oy;
        if (t.doc) {                                 // the drifting page background, as it is right now
          var look = bodyLook();
          patch = turnedTile(t.t, look.deg);
          ox = r.left - look.dx;
          oy = r.top - look.dy;
        } else {
          var hr = host.getBoundingClientRect();
          ox = r.left - hr.left + t.ox;
          oy = r.top - hr.top + t.oy;
        }
        box.style.backgroundImage = 'url(' + patch.url + ')';
        box.style.backgroundPosition = (-ox) + 'px ' + (-oy) + 'px';
        tiled.set(box, { t: patch, ox: ox, oy: oy });
        return;
      }
    }

    function stepFall() {
      fallers = fallers.filter(function (f) {
        if (f.settling) {                          // a GIF dropping to the bottom of its parent
          f.vy += 9;
          f.top += f.vy;
          if (f.top + f.h >= f.floor) { f.top = f.floor - f.h; settle(f); return false; }
          f.el.style.top = Math.round(f.top) + 'px';
          return true;
        }
        if (f.flying) {                            // rising straight up and away
          f.vy -= 7;
          f.top += f.vy;
          f.el.style.top = Math.round(f.top) + 'px';
          if (f.el.getBoundingClientRect().bottom < 0) { f.el.remove(); return false; }
          return true;
        }
        if (f.swinging) {                          // hanging from one corner, settling
          f.av += (f.target - f.angle) * 0.35;
          f.av *= 0.62;
          f.angle += f.av;
          if (++f.ticks > f.hang) {
            f.swinging = false;
            f.spin = f.target > 0 ? 2 : -2;
            sound.pin();
            sound.fall();
          }
        } else {
          f.vy += 9;
          f.top += f.vy;
          f.angle += f.spin;
        }
        f.el.style.top = Math.round(f.top) + 'px';
        f.el.style.transform = 'rotate(' + f.angle.toFixed(1) + 'deg)';
        if (f.swinging) return true;
        var b = f.el.getBoundingClientRect().bottom;
        if (b >= innerHeight) {
          f.top -= b - innerHeight;                // rest it on the bottom edge
          f.el.style.top = Math.round(f.top) + 'px';
          land(f);
          return false;
        }
        return true;
      });
      shards = shards.filter(function (s) {
        s.t++;
        s.vy += 3;
        s.x += s.vx;
        s.y += s.vy;
        if (s.y + s.s > innerHeight) {              // bounce off the bottom
          s.y = innerHeight - s.s;
          s.vy = -s.vy * 0.35;
          s.vx *= 0.7;
        }
        if (s.x + s.s < 0 || s.x > innerWidth) return false;
        return Math.random() > 0.01 + s.t * 0.011;  // blink out one by one
      });
    }

    function land(f) {
      var box = f.el, r = box.getBoundingClientRect();
      shatter(box, r);
      sound.crash();
      shake();
      fires = fires.filter(function (e) { return e.el !== box && !box.contains(e.el); });
      box.remove();
    }

    /* --- shattering into blocky web-safe tiles, in its own colours --- */

    function shatter(box, r) {
      var area = box.offsetWidth * box.offsetHeight;   // its own size, not its tilted bounding box
      if (!area || !r.width) return;
      var s = Math.max(8, Math.round(Math.sqrt(area / 900)));
      var images = new Map(), cx = r.left + r.width / 2;
      for (var y = r.top; y < r.bottom; y += s) {
        for (var x = r.left; x < r.right; x += s) {
          if (y + s < 0 || y > innerHeight || x + s < 0 || x > innerWidth) continue;
          var c = colourAt(box, x + s / 2, y + s / 2, images);
          if (!c) continue;                           // not part of it (e.g. a corner of a tilted box)
          shards.push({
            x: x, y: y, s: s, t: 0, c: webSafe(c),
            vx: (x + s / 2 - cx) / r.width * 14 + (Math.random() - 0.5) * 6,
            vy: -(4 + Math.random() * 14) * (0.4 + (y - r.top) / r.height)
          });
        }
      }
      start();
    }

    var CLEAR = 'clear';

    // The colour of the box at (x, y): its pictures' own pixels, else the background (tile
    // or colour) behind that spot, flecked with the text colour where there is text, and
    // darkened by any charring.
    function colourAt(box, x, y, images) {
      var at = document.elementFromPoint(x, y);
      if (!at || !box.contains(at)) return null;
      var c = null;
      if (at.tagName === 'IMG' || (at.tagName === 'CANVAS' && !at.classList.contains('xf-char'))) c = imageColour(at, x, y, images);
      if (c === CLEAR) return null;                  // no shard where a picture is see-through
      for (var e = at; e && !c; e = e === box ? null : e.parentElement) {
        var t = tiled.get(e);
        if (t) {
          var er = e.getBoundingClientRect();
          c = tileColour(t.t, x - er.left + t.ox, y - er.top + t.oy);
        } else {
          c = solid(getComputedStyle(e).backgroundColor);
        }
      }
      if (!c) {                                       // see-through: the drifting page background
        var bt = tiled.get(document.body), look = bodyLook();
        c = bt ? hueRotate(tileColour(bt.t, x - look.dx, y - look.dy), look.deg) : [255, 0, 204];
      }
      if (hasText(at) && Math.random() < 0.3) c = solid(getComputedStyle(at).color) || c;
      for (var b = at; b; b = b === box ? null : b.parentElement) {
        var ch = chars.get(b);
        if (!ch) continue;
        var br = b.getBoundingClientRect();
        var ix = Math.floor((x - br.left) / br.width * ch.cols), iy = Math.floor((y - br.top) / br.height * ch.rows);
        if (ix >= 0 && iy >= 0 && ix < ch.cols && iy < ch.rows) {
          var k = 1 - ch.d[iy * ch.cols + ix];
          c = [c[0] * k, c[1] * k, c[2] * k];
        }
        break;
      }
      return c;
    }

    function hasText(node) {
      for (var n = node.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) return true;
      return false;
    }

    function imageColour(img, x, y, cache) {
      var m = cache.get(img);
      if (m === undefined) {
        m = null;
        try {
          var r = img.getBoundingClientRect(), w = Math.max(1, Math.round(r.width / 4)), h = Math.max(1, Math.round(r.height / 4));
          var cv = el('canvas'), cg;
          cv.width = w;
          cv.height = h;
          cg = cv.getContext('2d');
          cg.drawImage(img, 0, 0, w, h);
          m = { r: r, w: w, h: h, d: cg.getImageData(0, 0, w, h).data };
        } catch (e) { /* unreadable */ }
        cache.set(img, m);
      }
      if (!m) return null;
      var ix = Math.min(m.w - 1, Math.max(0, Math.floor((x - m.r.left) / m.r.width * m.w)));
      var iy = Math.min(m.h - 1, Math.max(0, Math.floor((y - m.r.top) / m.r.height * m.h)));
      var k = (iy * m.w + ix) * 4;
      if (m.d[k + 3] < 100) return CLEAR;            // a see-through pixel of a GIF
      return [m.d[k], m.d[k + 1], m.d[k + 2]];
    }

    function solid(colour) {
      var m = /rgba?\(([^)]+)\)/.exec(colour || '');
      if (!m) return null;
      var p = m[1].split(/[\s,\/]+/).map(Number);
      if (p.length > 3 && p[3] < 0.05) return null;
      return [p[0], p[1], p[2]];
    }

    function webSafe(c) {
      return 'rgb(' + c.map(function (v) { return Math.round(v / 51) * 51; }).join(',') + ')';
    }

    function spark(x, y) {
      for (var i = 0; i < 10; i++) {
        var a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 3;
        sparks.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 1 });
      }
    }

    function shake() {
      if (calm) return;
      var b = document.body;
      b.classList.remove('xf-shake');
      void b.offsetWidth;
      b.classList.add('xf-shake');
    }
  }

  /* ---------- the song, distorted ---------- */

  // Looping, and played through Web Audio: overdriven, bit-crushed, thinned out, with a
  // wobbly tape speed that now and then slips. Browsers only allow sound after the visitor
  // has interacted with the site, so it starts on the first click or key press if needed.
  // The ♪ button in the upgrade bar turns all sound off and on (remembered), and the song
  // carries on from the same place when you move to another page.
  function music() {
    var audio = new Audio(SONG);
    audio.loop = true;
    audio.preload = 'auto';

    var resumeAt = 0;
    try { resumeAt = parseFloat(sessionStorage.getItem('spice-music-time')) || 0; } catch (e) { /* ignore */ }
    if (resumeAt > 0) {
      audio.addEventListener('loadedmetadata', function () {
        if (resumeAt < audio.duration) audio.currentTime = resumeAt;
      }, { once: true });
    }
    addEventListener('pagehide', function () {
      try { sessionStorage.setItem('spice-music-time', String(audio.currentTime)); } catch (e) { /* ignore */ }
    });

    var ac = distort(audio);
    if (!ac) audio.volume = 0.5;               // no Web Audio: play it straight

    var button = el('button', 'spice-music');
    button.type = 'button';
    button.textContent = '♪';
    button.setAttribute('aria-label', 'sound');
    function show() { button.setAttribute('aria-pressed', String(!soundOff && !audio.paused)); }
    audio.addEventListener('play', show);
    audio.addEventListener('pause', show);
    show();
    var bar = document.querySelector('.spice-3');
    if (bar) bar.insertBefore(button, bar.children[1] || null);
    else document.body.appendChild(button);

    function play() {
      if (ac && ac.state === 'suspended') ac.resume();
      audio.play().catch(function () {});
    }

    button.addEventListener('click', function () {
      if (soundOff || audio.paused) { soundOff = false; play(); }
      else { soundOff = true; audio.pause(); }
      try { localStorage.setItem('spice-music', soundOff ? 'off' : 'on'); } catch (e) { /* ignore */ }
      show();
    });

    // The audio system itself may also need a click or key press before it will start.
    function startOnInteraction(e) {
      if (e.target.closest && e.target.closest('.spice-music')) return;   // the button handles itself
      ['pointerdown', 'keydown'].forEach(function (type) {
        document.removeEventListener(type, startOnInteraction, true);
      });
      if (!soundOff) play();
    }
    ['pointerdown', 'keydown'].forEach(function (type) {
      document.addEventListener(type, startOnInteraction, true);
    });
    if (!soundOff) play();
  }

  function distort(audio) {
    var ac = sound.context();
    if (!ac) return null;
    try {
      var src = ac.createMediaElementSource(audio);
      var drive = ac.createGain(), crush = ac.createWaveShaper(), thin = ac.createBiquadFilter(), muffle = ac.createBiquadFilter(), out = ac.createGain();
      drive.gain.value = 3.5;                                // push it into the clipper
      var curve = new Float32Array(1024);
      for (var i = 0; i < 1024; i++) curve[i] = Math.round(Math.tanh(3 * (i / 511.5 - 1)) * 7) / 7;   // clip, then only 15 levels
      crush.curve = curve;
      thin.type = 'highpass';                                // tinny...
      thin.frequency.value = 220;
      muffle.type = 'lowpass';                               // ...and lo-fi
      muffle.frequency.value = 3000;
      out.gain.value = 0.3;
      src.connect(drive);
      drive.connect(crush);
      crush.connect(thin);
      thin.connect(muffle);
      muffle.connect(out);
      out.connect(ac.destination);

      // wobbly tape: drift the speed (and pitch) up and down, with the odd slip
      audio.preservesPitch = audio.mozPreservesPitch = audio.webkitPreservesPitch = false;
      var t0 = Date.now();
      setInterval(function () {
        if (audio.paused) return;
        var t = (Date.now() - t0) / 1000;
        var rate = 1 + 0.05 * Math.sin(t * 2.1) + 0.03 * Math.sin(t * 5.3);
        if (Math.random() < 0.03) rate -= 0.3;
        audio.playbackRate = rate;
      }, 120);
      return ac;
    } catch (e) {
      return null;
    }
  }
})();
