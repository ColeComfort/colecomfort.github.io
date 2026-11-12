/*
 * The runner. On every upgrade level a little gold runner dashes across the window now and
 * then: every 2-5 minutes with no upgrade, 1-2.5 minutes at medium, 20-40 seconds at high and
 * 10-30 seconds at extra high, running faster the higher the level.
 * Get the mouse really close and he lurches, suddenly faster or slower at random.
 * Click or tap him and he turns round and speeds up; catch him twice in one dash and a
 * pop-up congratulates you and tells you which winner you are. Winners are counted
 * site-wide (once per browser) on the real site; local previews just say you won.
 * Catching him is also the only way to unlock the extra high level (see spice.js). The
 * pop-up has the dancing babies, and closing it lets loose a stampede of runners, every
 * one of them as catchable as the first.
 *
 * spice.js loads this on every page, after the level's own scripts.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var level = Number(root.getAttribute('data-spice')) || 0;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var GIF = 'pictures/web1/runner.gif';
  var EVERY = [[120, 300], [60, 150], [20, 40], [10, 30]][level];     // seconds between dashes
  var SPEED = [[200, 280], [260, 360], [320, 440], [380, 520]][level];   // pixels a second
  var WINNERS_URL = 'https://abacus.jasoncameron.dev/hit/colecomfort.github.io/runner-winners';
  var LIVE_HOST = 'colecomfort.github.io';
  var NEXT_KEY = 'runner-next', WON_KEY = 'runner-winner';
  var CLOSE = 90;                      // "really close": pixels from his middle
  var SPEED_LIMITS = [80, 1800];
  var BABIES = ['pictures/web1/dancing-baby.gif', 'pictures/web1/baby-cha-cha.gif'];
  var STAMPEDE = 10, MOST_AT_ONCE = 30;
  var popupOpen = false;

  var pointer = { x: -1e4, y: -1e4 };
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse') { pointer.x = e.clientX; pointer.y = e.clientY; }
  }, { passive: true });

  addStyles();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();

  // The time of the next dash is kept for the visit, so moving between pages doesn't
  // restart the wait.
  function schedule() {
    var due = 0;
    try {
      var s = JSON.parse(sessionStorage.getItem(NEXT_KEY));
      if (s && s.level === level) due = s.at;
    } catch (e) { /* ignore */ }
    if (!due) {
      due = Date.now() + (EVERY[0] + Math.random() * (EVERY[1] - EVERY[0])) * 1000;
      try { sessionStorage.setItem(NEXT_KEY, JSON.stringify({ level: level, at: due })); } catch (e) { /* ignore */ }
    }
    setTimeout(run, Math.max(0, due - Date.now()));
  }

  function nextDash() {
    try { sessionStorage.removeItem(NEXT_KEY); } catch (e) { /* ignore */ }
    schedule();
  }

  // One dash across the window. The scheduled runner books the next dash when he's done;
  // runners in a stampede don't.
  function run(herd) {
    var w = document.createElement('span'), img = new Image();
    w.className = 'runner';
    w.setAttribute('aria-hidden', 'true');
    img.src = GIF;
    img.alt = '';
    img.draggable = false;
    w.appendChild(img);

    var dir = Math.random() < 0.5 ? -1 : 1;
    var speed = (SPEED[0] + Math.random() * (SPEED[1] - SPEED[0])) * (herd ? 1 + Math.random() * 0.5 : 1);
    var x = dir > 0 ? -140 : innerWidth + 20, catches = 0, last = 0, nextLurch = 0;
    var y = Math.round(innerHeight * (herd ? 0.03 + Math.random() * 0.8 : 0.12 + Math.random() * 0.55));
    w.style.top = y + 'px';
    w.style.left = Math.round(x) + 'px';
    face();
    document.body.appendChild(w);

    // caught: turn round and speed up; twice in one dash wins
    w.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      dir = -dir;
      speed = clamp(speed * 1.6);
      face();
      if (++catches === 2) win();
    });

    function face() { w.classList.toggle('runner-left', dir < 0); }   // the GIF runs to the right

    function done() { if (!herd) nextDash(); }

    requestAnimationFrame(function step(now) {
      if (!w.isConnected) return done();
      var dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      // the mouse right next to him makes him lurch: suddenly faster or slower
      var dx = pointer.x - (x + 47), dy = pointer.y - (y + 60);
      if (dx * dx + dy * dy < CLOSE * CLOSE && now > nextLurch) {
        speed = clamp(speed * (Math.random() < 0.5 ? 1.6 + Math.random() * 0.8 : 0.3 + Math.random() * 0.3));
        nextLurch = now + 600;
      }
      x += dir * speed * dt;
      w.style.left = Math.round(x) + 'px';
      if (x < -160 || x > innerWidth + 40) { w.remove(); return done(); }
      requestAnimationFrame(step);
    });
  }

  function clamp(v) { return Math.max(SPEED_LIMITS[0], Math.min(SPEED_LIMITS[1], v)); }

  // A crowd of runners all at once, each with the same tricks.
  function stampede() {
    var running = document.querySelectorAll('.runner').length;
    for (var i = 0; i < STAMPEDE && running + i < MOST_AT_ONCE; i++) {
      setTimeout(function () { run(true); }, i * 120 + Math.random() * 200);
    }
  }

  /* ---------- winning ---------- */

  function win() {
    if (popupOpen) return;
    popupOpen = true;
    var fresh = !!(window.SPICE && !SPICE.unlocked);
    if (window.SPICE && SPICE.unlock) SPICE.unlock();
    var mine = null;
    try { mine = parseInt(localStorage.getItem(WON_KEY), 10) || null; } catch (e) { /* ignore */ }
    var count;
    if (mine) count = Promise.resolve(mine);                         // already a winner: same number
    else if (location.hostname === LIVE_HOST && window.fetch) {
      count = fetch(WINNERS_URL)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { return d && typeof d.value === 'number' ? d.value : null; })
        .catch(function () { return null; });
    } else count = Promise.resolve(null);                            // local preview: not counted
    count.then(function (n) {
      if (n && !mine) {
        try { localStorage.setItem(WON_KEY, String(n)); } catch (e) { /* ignore */ }
      }
      popup(n, fresh || (window.SPICE && SPICE.level < 3));
    });
  }

  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function popup(n, offerExtraHigh) {
    var d = document.createElement('dialog');
    d.className = 'runner-popup';
    var bar = document.createElement('div');
    bar.className = 'runner-popup-bar';
    bar.textContent = 'Congratulations';
    var big = document.createElement('p');
    big.className = 'runner-popup-big';
    big.textContent = 'Congrats!';
    var head = document.createElement('div');          // the dancing babies either side
    head.className = 'runner-popup-head';
    BABIES.forEach(function (src, i) {
      var baby = new Image();
      baby.src = src;
      baby.alt = '';
      baby.className = 'runner-popup-baby';
      head.appendChild(baby);
      if (i === 0) head.appendChild(big);
    });
    var msg = document.createElement('p');
    msg.className = 'runner-popup-msg';
    msg.textContent = n ? 'You are the ' + ordinal(n) + ' winner!' : 'You are a winner!';
    var form = document.createElement('form');
    form.method = 'dialog';
    var ok = document.createElement('button');
    ok.textContent = 'OK';
    form.appendChild(ok);
    var parts = [bar, head, msg];
    if (offerExtraHigh) {
      var prize = document.createElement('p');
      prize.className = 'runner-popup-prize';
      prize.textContent = 'You have unlocked extra high!';
      parts.push(prize);
      var go = document.createElement('button');
      go.textContent = 'Upgrade';
      go.addEventListener('click', function () { if (window.SPICE) SPICE.set(3); });
      form.appendChild(document.createTextNode(' '));
      form.appendChild(go);
    }
    parts.push(form);
    parts.forEach(function (e) { d.appendChild(e); });
    document.body.appendChild(d);
    d.addEventListener('close', function () {     // then the stampede
      d.remove();
      popupOpen = false;
      stampede();
    });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });   // click outside
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');

    // fireworks to celebrate at high and extra high
    if (level >= 2 && window.WEB1 && WEB1.makeFireworks) {
      var fw = WEB1.makeFireworks(level === 3);
      for (var i = 0; i < 6; i++) {
        setTimeout(function () {
          fw.burst(innerWidth * (0.15 + Math.random() * 0.7), innerHeight * (0.15 + Math.random() * 0.5), 80);
        }, i * 250);
      }
    }
  }

  /* ---------- looks, per level ---------- */

  function addStyles() {
    var css = [
      '.runner { position: fixed; z-index: 2147483000; cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none; }',
      'html .runner img { display: block; width: auto; max-width: none; height: 120px; pointer-events: none; }',
      'html .runner-left img { transform: scaleX(-1); }',

      'dialog.runner-popup { padding: 0; border: 0; max-width: min(92vw, 460px); text-align: center; overflow: hidden; }',
      '.runner-popup-head { display: flex; align-items: center; justify-content: center; gap: 10px; }',
      'html .runner-popup-baby { flex: none; width: auto; max-width: none; height: 96px; }',
      'dialog.runner-popup::backdrop { background: rgba(0, 0, 0, 0.45); }',
      'dialog.runner-popup p { margin: 0; }',
      '.runner-popup-prize { margin-top: 10px !important; font-weight: bold; }',
      '.runner-popup-bar { display: none; }',

      // none: a quiet card
      '[data-spice="0"] .runner-popup { padding: 28px 34px 24px; border-radius: 12px; background: #ffffff; color: #1c1f23; font: 15px/1.5 Inter, -apple-system, "Segoe UI", sans-serif; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25); }',
      '[data-spice="0"] .runner-popup-big { margin-bottom: 4px !important; font: 600 26px/1.2 "Source Serif 4", Georgia, serif; }',
      '[data-spice="0"] .runner-popup button { margin-top: 18px; padding: 8px 24px; border: 0; border-radius: 8px; background: #1a4f8b; color: #ffffff; font: 500 14px Inter, sans-serif; cursor: pointer; }',
      '@media (prefers-color-scheme: dark) { [data-spice="0"] .runner-popup { background: #1b1e23; color: #e4e6e9; } [data-spice="0"] .runner-popup button { background: #8db4f0; color: #121417; } }',

      // medium: glossy Web 2.0
      '[data-spice="1"] .runner-popup { padding: 26px 34px 24px; border-radius: 16px; border: 1px solid #3a4250; background: linear-gradient(#2c333e, #1d2129); color: #eaf0f6; font: 15px/1.5 "Open Sans", sans-serif; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 20px 60px rgba(0, 0, 0, 0.6); }',
      '[data-spice="1"] .runner-popup-big { margin-bottom: 4px !important; font: 800 28px/1.2 Nunito, sans-serif; color: #ffffff; }',
      '[data-spice="1"] .runner-popup button { margin-top: 18px; padding: 8px 28px; border-radius: 999px; border: 1px solid #1b64ad; background: linear-gradient(#78c3fb 0%, #4b9fe6 49%, #2b7fd0 50%, #3990e0 100%); color: #ffffff; font: 800 15px Nunito, sans-serif; text-shadow: 0 -1px 0 rgba(0, 0, 0, 0.35); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5); cursor: pointer; }',

      // high and extra high: a Windows 95 dialog box
      '[data-spice="2"] .runner-popup, [data-spice="3"] .runner-popup { padding: 3px 3px 16px; background: #c0c0c0; color: #000000; border: 2px solid; border-color: #ffffff #404040 #404040 #ffffff; border-radius: 0; font: 16px/1.4 "Times New Roman", Times, serif; min-width: 280px; }',
      '[data-spice="2"] .runner-popup-bar, [data-spice="3"] .runner-popup-bar { display: block; margin-bottom: 14px; padding: 3px 6px; text-align: left; color: #ffffff; background: #000080; font: bold 13px Tahoma, "MS Sans Serif", Arial, sans-serif; }',
      '[data-spice="2"] .runner-popup-big, [data-spice="3"] .runner-popup-big { font: bold 26px "Comic Sans MS", "Comic Sans", "Chalkboard SE", cursive; }',
      '[data-spice="2"] .runner-popup button, [data-spice="3"] .runner-popup button { margin-top: 14px; min-width: 80px; padding: 4px 14px; background: #c0c0c0; color: #000000; border: 2px solid; border-color: #ffffff #404040 #404040 #ffffff; font: bold 13px Tahoma, "MS Sans Serif", Arial, sans-serif; cursor: pointer; }',
      '[data-spice="2"] .runner-popup button:active, [data-spice="3"] .runner-popup button:active { border-color: #404040 #ffffff #ffffff #404040; }',

      // extra high: louder still
      '[data-spice="3"] .runner-popup { border: 6px ridge #ff00ff; font-family: "Comic Sans MS", "Comic Sans", "Chalkboard SE", cursive; }',
      '[data-spice="3"] .runner-popup-big { font-size: 34px; animation: runner-rainbow 0.6s steps(1, end) infinite; }',
      '@keyframes runner-rainbow { 0% { color: #ff0000; } 17% { color: #ff9900; } 33% { color: #cccc00; } 50% { color: #00aa00; } 67% { color: #0066ff; } 83% { color: #9900cc; } }',
      '@media (prefers-reduced-motion: reduce) { .runner-popup * { animation: none !important; } }'
    ];
    var s = document.createElement('style');
    s.textContent = css.join('\n');
    document.head.appendChild(s);
  }
})();
