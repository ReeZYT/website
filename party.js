/* ============================================================
   reez.cc ▸ easter eggs for the sub pages (ballet, breakdance)
   Same triggers as the home page:
     type "oiia" (or tap the screen 5× quickly) → party mode with this
     page's own mix; "ballet" / "break" jump between the pages.
   Party mode swaps the page's <audio id="music"> to data-party, so the
   page's own mute button and autoplay unlock keep working.
   Exit: Esc (only ends the party, doesn't leave the page), the ✕ pill,
   or the same trigger again.
   ============================================================ */
(() => {
  const script = document.currentScript;
  const cfg = {
    src: script.dataset.party,                 // e.g. assets/ballet-party.mp3
    name: script.dataset.partyName || "oiia oiia",
    bpm: Number(script.dataset.bpm) || 120,
    catEvery: Number(script.dataset.catEvery) || 2, // spawn a cat every n beats
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const root = document.documentElement;
  const page = location.pathname.split("/").pop().replace(/\.html$/, "") || "index";

  // You've been on the site in this tab: the home page skips its splash
  try { sessionStorage.setItem("reez:entered", "1"); } catch { /* ignore */ }

  /* ---------- styles (kept here so the pages stay self-contained) ---------- */
  const css = document.createElement("style");
  css.textContent = `
    .cats { position: fixed; inset: 0; z-index: 3; pointer-events: none; overflow: hidden; }
    .cat { position: absolute; left: 0; top: 0; width: var(--size); height: var(--size); will-change: transform;
      animation: cat-in .35s cubic-bezier(.2,.8,.2,1) both; transition: opacity .5s; filter: drop-shadow(0 6px 14px rgba(0,0,0,.5)); }
    .cat.is-gone { opacity: 0; }
    .cat__spin { width: 100%; height: 100%; animation: cat-spin var(--spin, .35s) linear infinite; }
    .cat svg { width: 100%; height: 100%; display: block; }
    @keyframes cat-spin { to { transform: rotateY(360deg); } }
    @keyframes cat-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes party-hue { from { filter: hue-rotate(0deg) saturate(1.8) brightness(1.15); } to { filter: hue-rotate(360deg) saturate(1.8) brightness(1.15); } }
    .party-trip { position: fixed; inset: -50%; z-index: 0; pointer-events: none; opacity: 0;
      background: conic-gradient(from 0deg, #ff3d7f, #ffb13d, #f8ff3d, #3dff8b, #3dd8ff, #7a3dff, #ff3dd8, #ff3d7f);
      mix-blend-mode: screen; filter: blur(40px); transition: opacity 1s; }
    .is-party .party-trip { opacity: .16; animation: party-spin 14s linear infinite; }
    @keyframes party-spin { to { transform: rotate(360deg); } }
    .is-party .backdrop canvas { animation: party-hue 5s linear infinite; }
    .is-party .step__name { color: hsl(calc(var(--party-h, 0) * 1deg) 100% 70%); }
    .party-exit { position: fixed; z-index: 4; left: 50%; top: max(16px, env(safe-area-inset-top));
      transform: translateX(-50%); display: inline-flex; align-items: center; gap: 8px;
      min-height: 44px; padding: 0 16px; border: 0; border-radius: 999px; cursor: pointer;
      background: var(--fill); box-shadow: inset 0 0 0 1px hsl(calc(var(--party-h, 0) * 1deg) 100% 65% / .7);
      color: var(--label); font: 500 .8125rem/1 var(--font-mono); -webkit-tap-highlight-color: transparent; }
    .party-exit:hover { background: var(--fill-hover); }
    .party-exit[hidden] { display: none; }
    .is-party .sound__name { color: hsl(calc(var(--party-h, 0) * 1deg) 100% 72%); }
    @media (max-width: 420px) { .party-exit { top: auto; bottom: max(64px, calc(env(safe-area-inset-bottom) + 48px)); } }
    @media (prefers-reduced-motion: reduce) { .is-party .backdrop canvas { animation: none; filter: saturate(1.8) hue-rotate(60deg); } .is-party .party-trip { animation: none; } }
  `;
  document.head.appendChild(css);

  const trip = document.createElement("div");
  trip.className = "party-trip";
  trip.setAttribute("aria-hidden", "true");
  const layer = document.createElement("div");
  layer.className = "cats";
  layer.setAttribute("aria-hidden", "true");
  const exitBtn = document.createElement("button");
  exitBtn.type = "button";
  exitBtn.className = "party-exit";
  exitBtn.hidden = true;
  exitBtn.textContent = "✕ o i i a";
  exitBtn.setAttribute("aria-label", "Exit party mode");
  const status = document.createElement("p");
  status.className = "sr-only";
  status.setAttribute("aria-live", "polite");
  (document.querySelector(".backdrop") || document.body.firstChild).after(trip);
  document.body.append(layer, exitBtn, status);

  /* ---------- cats (same cat as the home page) ---------- */
  const CAT_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
    <g fill="currentColor"><path d="M27 40 31 12l16 18z"/><path d="M73 40 69 12 53 30z"/>
    <ellipse cx="50" cy="44" rx="25" ry="21"/><ellipse cx="50" cy="78" rx="21" ry="19"/></g>
    <path d="M69 88c20 3 20-16 12-24" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
    <path d="M33 22l5 10-8 1zM67 22l-5 10 8 1z" fill="#ffb3c8"/>
    <ellipse cx="41" cy="42" rx="5.5" ry="6.5" fill="#fff"/><ellipse cx="59" cy="42" rx="5.5" ry="6.5" fill="#fff"/>
    <circle cx="42" cy="43" r="3" fill="#111"/><circle cx="60" cy="43" r="3" fill="#111"/>
    <path d="M46 51l4 3 4-3z" fill="#ff8fb1"/>
    <path d="M50 54q-3 5-7 2M50 54q3 5 7 2" fill="none" stroke="#111" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M22 50h12M22 55l12-2M78 50H66M78 55l-12-2" stroke="#111" stroke-opacity=".45" stroke-width="1.4" stroke-linecap="round"/></svg>`;
  const COLORS = ["#f5f5f5", "#ffb347", "#8b8b8b", "#2b2b2b", "#e8c39e", "#ff9ad5", "#9ad0ff"];
  const MAX_CATS = 18;
  const party = { on: false, beat: -1, kick: 0, cats: [], raf: null };

  function spawnCat(x, y, burst = false) {
    if (reduce.matches) return;
    if (party.cats.length >= MAX_CATS) party.cats.shift().el.remove();
    const size = 44 + Math.random() * 64;
    const el = document.createElement("div");
    el.className = "cat";
    el.style.setProperty("--size", size + "px");
    el.style.setProperty("--spin", (0.25 + Math.random() * 0.35).toFixed(2) + "s");
    el.style.color = COLORS[(Math.random() * COLORS.length) | 0];
    el.innerHTML = `<div class="cat__spin">${CAT_SVG}</div>`;
    layer.appendChild(el);
    const a = Math.random() * Math.PI * 2, v = burst ? 6 + Math.random() * 6 : 2 + Math.random() * 3;
    party.cats.push({
      el, size,
      x: x != null ? x - size / 2 : Math.random() * (innerWidth - size),
      y: y != null ? y - size / 2 : Math.random() * (innerHeight - size),
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      born: performance.now(), life: 8000 + Math.random() * 5000,
    });
  }

  // the page's dot grid ripples on the beat (hook set by the page)
  const ripple = (x, y) => window.reezRipple?.(x, y);

  const music = document.getElementById("music");
  const nameEl = document.querySelector(".sound__name");
  const orig = { src: music?.getAttribute("src"), name: nameEl?.textContent, title: document.title, time: 0 };

  function tick(t) {
    const now = performance.now();
    if (party.on) {
      root.style.setProperty("--party-h", ((t * 0.08) % 360).toFixed(1));
      if (music && !music.paused) {
        const beat = Math.floor(music.currentTime / (60 / cfg.bpm));
        if (beat !== party.beat) {
          party.beat = beat;
          party.kick = 1;
          ripple(innerWidth / 2, innerHeight / 2);
          if (beat % cfg.catEvery === 0) spawnCat();
        }
      }
    }
    party.kick *= 0.9;
    const W = innerWidth, H = innerHeight;
    for (let i = party.cats.length - 1; i >= 0; i--) {
      const c = party.cats[i], boost = 1 + party.kick * 1.5;
      c.x += c.vx * boost; c.y += c.vy * boost;
      if (c.x < 0 || c.x > W - c.size) { c.vx *= -1; c.x = Math.max(0, Math.min(W - c.size, c.x)); }
      if (c.y < 0 || c.y > H - c.size) { c.vy *= -1; c.y = Math.max(0, Math.min(H - c.size, c.y)); }
      c.el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0) scale(${1 + 0.12 * party.kick})`;
      if (!party.on || now - c.born > c.life) {
        c.el.classList.add("is-gone");
        party.cats.splice(i, 1);
        setTimeout(() => c.el.remove(), 500);
      }
    }
    party.raf = party.on || party.cats.length ? requestAnimationFrame(tick) : null;
  }

  function swapMusic(src, time) {
    if (!music || !src) return;
    const wasPlaying = !music.paused;
    music.src = src;
    if (time) music.addEventListener("loadedmetadata", () => { music.currentTime = time % (music.duration || Infinity); }, { once: true });
    if (wasPlaying) music.play().catch(() => {});
  }

  function partyOn() {
    if (party.on) return;
    party.on = true; party.beat = -1;
    root.classList.add("is-party");
    orig.time = music ? music.currentTime : 0;
    swapMusic(cfg.src, 0);
    if (nameEl) nameEl.textContent = cfg.name;
    document.title = "oiia oiia ▸ reez.cc";
    exitBtn.hidden = false;
    status.textContent = "Party mode on. Press Escape to exit.";
    for (let i = 0; i < 6; i++) spawnCat(innerWidth / 2, innerHeight / 2, true);
    if (!party.raf) party.raf = requestAnimationFrame(tick);
  }
  function partyOff() {
    if (!party.on) return;
    party.on = false;
    root.classList.remove("is-party");
    root.style.removeProperty("--party-h");
    swapMusic(orig.src, orig.time);
    if (nameEl) nameEl.textContent = orig.name;
    document.title = orig.title;
    exitBtn.hidden = true;
    status.textContent = "Party mode off.";
  }
  const toggle = () => (party.on ? partyOff() : partyOn());
  exitBtn.addEventListener("click", partyOff);

  /* ---------- triggers ---------- */
  let typed = "";
  // capture phase: runs before the page's own "Esc = back home" handler
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && party.on) { e.preventDefault(); e.stopImmediatePropagation(); partyOff(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1 || e.target.closest?.("input, textarea")) return;
    typed = (typed + e.key.toLowerCase()).slice(-6);
    if (typed.endsWith("oiia")) { typed = ""; toggle(); }
    else if (typed === "ballet" && page !== "ballet") location.href = "ballet.html";
    else if (typed.endsWith("break") && page !== "breakdance") location.href = "breakdance.html";
  }, true);

  // touch: 5 quick taps anywhere starts it; during the party taps throw cats
  let taps = [];
  addEventListener("pointerdown", (e) => {
    if (e.target.closest?.("a, button")) return;
    if (party.on) { for (let i = 0; i < 3; i++) spawnCat(e.clientX, e.clientY, true); return; }
    const now = performance.now();
    taps = [...taps.filter((t) => now - t < 1800), now];
    if (taps.length >= 5) { taps = []; partyOn(); }
  }, { passive: true });

  window.oiia = () => { toggle(); return party.on ? "🐈 o i i a o i i a" : "party over."; };
})();
