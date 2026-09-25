/* ============================================================
   reez.cc — config
   ============================================================ */
const CONFIG = {
  // Optional: your numeric Discord user ID for live status via Lanyard
  // (join discord.gg/lanyard once, then paste the ID here). Empty = off.
  discordId: "",
  timezone: "Europe/Berlin",
  // Shown next to the mute button while assets/audio.mp3 plays. Empty = hidden.
  trackName: "reez — aimbot.dll",
  volume: 0.35,
  // Optional looping background video, e.g. "assets/bg.mp4". Empty = off.
  bgVideo: "",
  // Background grid pulses to the music (needs http(s), not file://).
  reactive: true,
};

/* ============================================================ */

const $ = (id) => document.getElementById(id);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

$("year").textContent = new Date().getFullYear();

/* ---------- Avatar (Spotify picture) with fallback ---------- */
const avatar = $("avatar-img");
const markBroken = () => avatar.classList.add("is-broken");
avatar.addEventListener("error", markBroken);
if (avatar.complete && avatar.naturalWidth === 0) markBroken();

/* ---------- Boot log, bottom left ---------- */
const LOG = [
  ["» resolving reez.cc", "ok"],
  ["» loading <span class=\"hl\">aimbot.dll</span>", "ok"],
  ["» bypassing boredom", "ok"],
  ["» found <span class=\"hl\">oiia.exe</span>", "?"],
  ["» type: oiia // tap pfp 5x", ""],
  ["» ready.", ""],
];

// Reserve room for the log under the content (see .main padding in CSS)
const logEl = $("log");
function syncLogHeight() {
  // measure the fully typed log up front so nothing jumps while it types
  const probe = logEl.cloneNode();
  probe.removeAttribute("id");
  probe.style.visibility = "hidden";
  probe.innerHTML = LOG.map(([l, st]) => st ? `${l} <span class="ok">[${st}]</span>` : l).join("\n");
  document.body.appendChild(probe);
  const hpx = Math.max(probe.offsetHeight, logEl.offsetHeight);
  probe.remove();
  document.documentElement.style.setProperty("--log-h", hpx + "px");
}
if ("ResizeObserver" in window) new ResizeObserver(syncLogHeight).observe(logEl);
window.addEventListener("resize", syncLogHeight);
syncLogHeight();

function renderLog(count, caret) {
  $("log").innerHTML = LOG.slice(0, count)
    .map(([line, status]) => status ? `${line} <span class="ok">[${status}]</span>` : line)
    .join("\n") + (caret ? '<span class="caret"></span>' : "");
}
let logTimer = null;
function playLog() {
  if (reduceMotion.matches) { renderLog(LOG.length, false); return; }
  let i = 0;
  renderLog(0, true);
  const t = logTimer = setInterval(() => {
    renderLog(++i, true);
    if (i >= LOG.length) clearInterval(t);
  }, 450);
}

/* ---------- Name: decode on load, glitch now and then ---------- */
const nameEl = $("name");
const mainPart = nameEl.querySelector(".name__main");
const tldPart = nameEl.querySelector(".name__tld");
const GLYPHS = "01<>/\\|[]{}#$%&*+=-_";
const randGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

// Each scramble gets an id; starting a new one cancels any still running,
// so two loops can never fight over the same letters.
let scrambleId = 0;

function decode(el, target, delay, id, done) {
  let frame = 0;
  const settleAt = target.split("").map((_, i) => 6 + i * 3 + Math.floor(Math.random() * 4));
  const last = Math.max(...settleAt);
  const run = () => {
    if (id !== scrambleId) return;
    el.textContent = target.split("").map((ch, i) =>
      frame >= settleAt[i] ? ch : randGlyph()
    ).join("");
    frame++;
    if (frame <= last) setTimeout(run, 40);
    else done?.();
  };
  setTimeout(run, delay);
}

function glitch() {
  nameEl.classList.remove("is-glitch");
  void nameEl.offsetWidth; // restart animation
  nameEl.classList.add("is-glitch");
  setTimeout(() => nameEl.classList.remove("is-glitch"), 360);
}

let decoding = false;
let nameTarget = "reez";

// Width of the *final* text, measured on a hidden copy, so it doesn't
// matter what the scramble is showing at the moment we measure.
function measure(el, text) {
  const probe = document.createElement("span");
  probe.className = el.className;
  probe.textContent = text;
  probe.style.cssText = "position:absolute;visibility:hidden;width:auto;white-space:nowrap";
  el.parentNode.appendChild(probe);
  // offsetWidth = layout width, unaffected by the party-mode scale/rotate
  const wpx = probe.offsetWidth;
  probe.remove();
  return wpx;
}

// Lock each part to its final width so scrambling never shifts the layout
function lockWidths() {
  mainPart.style.width = measure(mainPart, nameTarget) + "px";
  tldPart.style.width = measure(tldPart, ".cc") + "px";
  nameEl.querySelector(".name__text").dataset.text = nameTarget + ".cc";
}
lockWidths();
document.fonts?.ready.then(lockWidths);
window.addEventListener("resize", lockWidths);

function scrambleName(force = false) {
  if (decoding && !force) return;
  decoding = true;
  const id = ++scrambleId;
  lockWidths();
  let pending = 2;
  const finish = () => {
    if (--pending > 0 || id !== scrambleId) return;
    decoding = false;
    glitch();
  };
  decode(mainPart, nameTarget, 0, id, finish);
  decode(tldPart, ".cc", 120, id, finish);
}

if (!reduceMotion.matches) {
  (function loop() {
    setTimeout(() => { if (!document.hidden) glitch(); loop(); }, 3500 + Math.random() * 3500);
  })();
  nameEl.addEventListener("pointerenter", () => scrambleName());
}

/* ---------- Splash + sound ----------
   Browsers block sound until a gesture, so the page opens behind a
   "click to enter" splash. That click starts assets/audio.mp3.       */
const dock = $("dock");
const muteBtn = $("mute");
const audio = $("audio");
const splash = $("enter");
const mainEl = $("main");
audio.volume = CONFIG.volume;

let audioOk = audio.readyState >= 3;
let entered = false;
let muted = store.get("reez:muted") === "1";

// Analyser feeds the background + dock equalizer
let analyser = null, freq = null;
const level = { bass: 0, avg: 0, kick: 0, lastKick: 0 };
const eqBars = [...$("eq").children];

const partyAudio = $("party-audio");
partyAudio.volume = Math.min(1, CONFIG.volume * 1.3);
const activeAudio = () => (party.on ? partyAudio : audio);

function applyMute() {
  audio.muted = muted;
  partyAudio.muted = muted;
  muteBtn.setAttribute("aria-pressed", String(muted));
}

function initAnalyser() {
  // file:// media counts as cross-origin -> an analyser would output silence
  if (analyser || !CONFIG.reactive || !location.protocol.startsWith("http")) return;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    analyser = ac.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.55;
    for (const el of [audio, partyAudio]) {
      ac.createMediaElementSource(el).connect(analyser);
      el.addEventListener("play", () => ac.resume());
    }
    analyser.connect(ac.destination);
    freq = new Uint8Array(analyser.frequencyBinCount);
    ac.resume();
  } catch { analyser = null; }
}

function startSound() {
  if (!audioOk || !entered) return;
  initAnalyser();
  applyMute();
  if (!muted) audio.play().catch(() => {});
  $("track-name").textContent = CONFIG.trackName;
  if (dock.hidden) {
    dock.hidden = false;
    requestAnimationFrame(() => dock.classList.add("is-in"));
  }
}
audio.addEventListener("canplay", () => { audioOk = true; startSound(); }, { once: true });

muteBtn.addEventListener("click", () => {
  muted = !muted;
  store.set("reez:muted", muted ? "1" : "0");
  applyMute();
  if (!muted && activeAudio().paused) activeAudio().play().catch(() => {});
});

// Optional background video: starts loading right away, fades in on enter
const bgVideo = $("bg-video");
if (CONFIG.bgVideo && !reduceMotion.matches) {
  bgVideo.src = CONFIG.bgVideo;
  bgVideo.preload = "auto";
}
function startVideo() {
  if (!bgVideo.src) return;
  const go = () => { bgVideo.classList.add("is-on"); bgVideo.play().catch(() => {}); };
  if (bgVideo.readyState >= 3) go(); else bgVideo.addEventListener("canplay", go, { once: true });
}

function enter() {
  if (entered) return;
  entered = true;
  document.removeEventListener("keydown", onSplashKey);
  splash.classList.add("is-out");
  setTimeout(() => { splash.hidden = true; }, 650);
  mainEl.inert = false;
  mainEl.classList.add("is-in");
  nameEl.focus({ preventScroll: true });
  playLog();
  if (!reduceMotion.matches) scrambleName();
  startSound();
  startVideo();
}
function onSplashKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey || e.key === "Tab") return;
  e.preventDefault();
  enter();
}

splash.hidden = false;
mainEl.inert = true;
$("enter-btn").addEventListener("click", enter);
document.addEventListener("keydown", onSplashKey);
$("enter-btn").focus({ preventScroll: true, focusVisible: false });

// Called every animation frame by the background
function readAudio(t) {
  if (party.on) partyBeatClock(t);
  const el = activeAudio();
  if (!analyser || el.paused || el.muted) {
    level.bass *= 0.9; level.kick *= 0.9;
    for (const b of eqBars) b.style.transform = "scaleY(0.15)";
    return;
  }
  analyser.getByteFrequencyData(freq);
  const band = (a, z) => { let s = 0; for (let i = a; i <= z; i++) s += freq[i]; return s / ((z - a + 1) * 255); };
  const b = band(0, 2);
  level.avg += (b - level.avg) * 0.04;
  level.bass += (b - level.bass) * 0.35;
  if (!party.on && b - level.avg > 0.1 && t - level.lastKick > 280) {
    level.lastKick = t;
    level.kick = 1;
    ripples.push({ x: w / 2, y: h / 2, r: 0, soft: true });
  }
  level.kick *= 0.9;
  [band(0, 2), band(4, 9), band(12, 26), band(30, 60)].forEach((v, i) => {
    eqBars[i].style.transform = `scaleY(${Math.max(0.15, Math.min(1, v * 1.4))})`;
  });
}

/* ---------- Discord: copy handle ---------- */
const discordBtn = $("discord-copy");
const discordStatus = $("discord-status");
let copyTimer = null;

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

discordBtn.addEventListener("click", async () => {
  const ok = await copyText(discordBtn.dataset.copy);
  discordStatus.textContent = ok ? "Copied" : "Copy failed";
  discordStatus.classList.toggle("is-done", ok);
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    discordStatus.textContent = "Copy";
    discordStatus.classList.remove("is-done");
  }, 2000);
});

/* ---------- Clock ---------- */
const clockFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: CONFIG.timezone, hour: "2-digit", minute: "2-digit", hour12: false,
});
const zonePart = (opts) => new Intl.DateTimeFormat("en-GB", { timeZone: CONFIG.timezone, ...opts })
  .formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value || "";
function tick() {
  const now = new Date();
  const el = $("clock");
  el.textContent = clockFmt.format(now);
  el.dateTime = now.toISOString();
  // e.g. "CEST · UTC+2 · Berlin" (switches to CET / UTC+1 in winter automatically)
  const abbr = zonePart({ timeZoneName: "short" });
  const offset = zonePart({ timeZoneName: "shortOffset" }).replace("GMT", "UTC");
  const city = CONFIG.timezone.split("/").pop().replace(/_/g, " ");
  $("tz").textContent = [abbr !== offset.replace("UTC", "GMT") ? abbr : "", offset, city].filter(Boolean).join(" · ");
}
tick();
setInterval(tick, 10_000);

/* ---------- Discord presence via Lanyard (optional) ---------- */
const STATUS_LABEL = { online: "Online", idle: "Idle", dnd: "Do not disturb", offline: "Offline" };

async function loadPresence() {
  if (!CONFIG.discordId) return;
  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${CONFIG.discordId}`);
    if (!res.ok) return;
    const { data } = await res.json();
    const status = data.discord_status || "offline";

    const dot = $("presence-dot");
    dot.dataset.status = status;
    dot.hidden = false;

    const text = $("presence-text");
    text.textContent = STATUS_LABEL[status] || "Offline";
    text.hidden = false;

    const detail = $("spotify-detail");
    detail.textContent = data.listening_to_spotify && data.spotify
      ? `Listening to ${data.spotify.song} – ${data.spotify.artist}`
      : "Playlists & profile";
  } catch { /* offline or blocked: keep the static page */ }
}
loadPresence();
setInterval(loadPresence, 30_000);

/* ============================================================
   Background: dot grid that reacts to the pointer.
   Dots near the cursor light up and get pushed away, then spring back.
   Clicking sends a ripple. Without a pointer, a slow scanner wanders.
   ============================================================ */
const canvas = $("bg-canvas");
const ctx = canvas.getContext("2d");
const GAP = 26;
const RADIUS = 170;
const PUSH = 26;

let w = 0, h = 0, dpr = 1;
let dots = [];
let rafId = null;
const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false, lastMove: 0 };
const ripples = [];

function build() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = window.innerWidth; h = window.innerHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dots = [];
  const offX = (w % GAP) / 2, offY = (h % GAP) / 2;
  for (let y = offY; y <= h; y += GAP) {
    for (let x = offX; x <= w; x += GAP) {
      dots.push({ ox: x, oy: y, x, y, vx: 0, vy: 0, glow: 0, seed: Math.random() });
    }
  }
}

function drawStatic() {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(210, 200, 255, 0.12)";
  for (const d of dots) ctx.fillRect(d.ox - 0.75, d.oy - 0.75, 1.5, 1.5);
}

function frame(t) {
  readAudio(t);
  partyFrame(t);
  const R = RADIUS * (1 + 0.35 * level.bass);
  // Wander when the pointer is idle (touch devices, or mouse left the window)
  if (!pointer.active || t - pointer.lastMove > 4000) {
    pointer.tx = w * (0.5 + 0.35 * Math.sin(t / 5200));
    pointer.ty = h * (0.5 + 0.3 * Math.sin(t / 3700 + 1.3));
  }
  if (pointer.x < -1000) { pointer.x = pointer.tx; pointer.y = pointer.ty; }
  pointer.x += (pointer.tx - pointer.x) * 0.18;
  pointer.y += (pointer.ty - pointer.y) * 0.18;

  const maxR = Math.max(w, h);
  for (let i = ripples.length - 1; i >= 0; i--) {
    ripples[i].r += 9;
    if (ripples[i].r > maxR) ripples.splice(i, 1);
  }

  ctx.clearRect(0, 0, w, h);
  const near = [];

  for (const d of dots) {
    const dx = d.ox - pointer.x, dy = d.oy - pointer.y;
    const dist = Math.hypot(dx, dy);
    let fx = 0, fy = 0, target = 0;

    if (dist < R) {
      const f = 1 - dist / R;
      const ease = f * f;
      fx += (dx / (dist || 1)) * PUSH * ease;
      fy += (dy / (dist || 1)) * PUSH * ease;
      target = ease;
      if (f > 0.55) near.push(d);
    }

    for (const r of ripples) {
      const rd = Math.hypot(d.ox - r.x, d.oy - r.y);
      const band = Math.abs(rd - r.r);
      if (band < 40) {
        const k = (1 - band / 40) * (1 - r.r / maxR) * (r.soft ? 0.45 : 1);
        fx += ((d.ox - r.x) / (rd || 1)) * 14 * k;
        fy += ((d.oy - r.y) / (rd || 1)) * 14 * k;
        target = Math.max(target, k);
      }
    }

    // spring toward the displaced home position
    const hx = d.ox + fx, hy = d.oy + fy;
    d.vx = (d.vx + (hx - d.x) * 0.12) * 0.78;
    d.vy = (d.vy + (hy - d.y) * 0.12) * 0.78;
    d.x += d.vx; d.y += d.vy;
    d.glow += (target - d.glow) * 0.15;

    // faint twinkle so the grid never looks frozen
    const tw = 0.13 + 0.06 * Math.sin(t / 900 + d.seed * 40) + 0.1 * level.kick;
    const a = Math.min(1, tw + d.glow * 0.85);
    const size = 1.4 + d.glow * 1.6;
    if (party.on) {
      const hue = (party.hue + d.ox * 0.25 + d.oy * 0.15 + d.glow * 90) % 360;
      const ps = size + 1.2 + level.kick * 1.6;
      ctx.fillStyle = `hsla(${hue | 0}, 100%, ${62 + d.glow * 18}%, ${Math.min(1, a + 0.35)})`;
      ctx.fillRect(d.x - ps / 2, d.y - ps / 2, ps, ps);
      continue;
    }
    ctx.fillStyle = d.glow > 0.05
      ? `rgba(${(183 - 90 * d.glow) | 0}, ${(166 + 60 * d.glow) | 0}, 255, ${a})`
      : `rgba(210, 200, 255, ${a})`;
    ctx.fillRect(d.x - size / 2, d.y - size / 2, size, size);
  }

  // thin lines from the cursor to the closest lit dots
  ctx.lineWidth = 0.6;
  for (const d of near) {
    ctx.strokeStyle = party.on
      ? `hsla(${(party.hue + d.ox * 0.5) % 360 | 0}, 100%, 65%, ${0.6 * d.glow})`
      : `rgba(94, 231, 255, ${0.35 * d.glow})`;
    ctx.beginPath();
    ctx.moveTo(pointer.x, pointer.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
  }

  rafId = requestAnimationFrame(frame);
}

function start() {
  stop();
  build();
  if (reduceMotion.matches) { drawStatic(); return; }
  rafId = requestAnimationFrame(frame);
}
function stop() { if (rafId) cancelAnimationFrame(rafId); rafId = null; }

window.addEventListener("pointermove", (e) => {
  pointer.tx = e.clientX; pointer.ty = e.clientY;
  pointer.active = true; pointer.lastMove = performance.now();
}, { passive: true });
document.documentElement.addEventListener("pointerleave", () => { pointer.active = false; });
window.addEventListener("pointerdown", (e) => {
  if (reduceMotion.matches) return;
  ripples.push({ x: e.clientX, y: e.clientY, r: 0 });
}, { passive: true });

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(start, 120);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop(); else start();
});
reduceMotion.addEventListener?.("change", start);

start();

/* ============================================================
   Easter egg: party mode.
   Trigger: type "oiia", or tap the avatar 5×. Hinted at in the boot log.
   Exit: Esc, the ✕ in the dock, or the same trigger again.
   ============================================================ */
const party = { on: false, hue: 0, beat: -1, cats: [] };
const PARTY_BPM = 140;
const MAX_CATS = 22;
const catLayer = $("cats");
const profileEl = document.querySelector(".profile");
const partyExit = $("party-exit");

const CAT_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <g fill="currentColor">
    <path d="M27 40 31 12l16 18z"/><path d="M73 40 69 12 53 30z"/>
    <ellipse cx="50" cy="44" rx="25" ry="21"/>
    <ellipse cx="50" cy="78" rx="21" ry="19"/>
  </g>
  <path d="M69 88c20 3 20-16 12-24" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
  <path d="M33 22l5 10-8 1zM67 22l-5 10 8 1z" fill="#ffb3c8"/>
  <ellipse cx="41" cy="42" rx="5.5" ry="6.5" fill="#fff"/><ellipse cx="59" cy="42" rx="5.5" ry="6.5" fill="#fff"/>
  <circle cx="42" cy="43" r="3" fill="#111"/><circle cx="60" cy="43" r="3" fill="#111"/>
  <path d="M46 51l4 3 4-3z" fill="#ff8fb1"/>
  <path d="M50 54q-3 5-7 2M50 54q3 5 7 2" fill="none" stroke="#111" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M22 50h12M22 55l12-2M78 50H66M78 55l-12-2" stroke="#111" stroke-opacity=".45" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;
const CAT_COLORS = ["#f5f5f5", "#ffb347", "#8b8b8b", "#2b2b2b", "#e8c39e", "#ff9ad5", "#9ad0ff"];

// The avatar turns into a spinning cat
const avatarCat = document.createElement("span");
avatarCat.className = "avatar__cat";
avatarCat.innerHTML = CAT_SVG;
document.querySelector(".avatar").appendChild(avatarCat);

function spawnCat(x, y, burst = false) {
  if (reduceMotion.matches) return;
  if (party.cats.length >= MAX_CATS) {
    const old = party.cats.shift();
    old.el.remove();
  }
  const size = 48 + Math.random() * 72;
  const el = document.createElement("div");
  el.className = "cat";
  el.style.setProperty("--size", size + "px");
  el.style.setProperty("--spin", (0.25 + Math.random() * 0.35).toFixed(2) + "s");
  el.style.color = CAT_COLORS[(Math.random() * CAT_COLORS.length) | 0];
  el.innerHTML = `<div class="cat__spin">${CAT_SVG}</div>`;
  catLayer.appendChild(el);
  const ang = Math.random() * Math.PI * 2;
  const speed = burst ? 6 + Math.random() * 6 : 2 + Math.random() * 3;
  party.cats.push({
    el, size,
    x: (x ?? Math.random() * (w - size)) - (x != null ? size / 2 : 0),
    y: (y ?? Math.random() * (h - size)) - (y != null ? size / 2 : 0),
    vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
    born: performance.now(), life: 9000 + Math.random() * 5000,
  });
}

// 140 BPM clock from the track position: works even without an analyser
function partyBeatClock(t) {
  const beat = Math.floor(partyAudio.currentTime / (60 / PARTY_BPM));
  if (partyAudio.paused || beat === party.beat) return;
  party.beat = beat;
  level.kick = 1;
  ripples.push({ x: w / 2, y: h / 2, r: 0 });
  if (beat % 2 === 0) spawnCat();
}

function partyFrame(t) {
  if (!party.on && !party.cats.length) return;
  party.hue = (t * 0.08) % 360;
  if (party.on) {
    document.documentElement.style.setProperty("--party-h", party.hue.toFixed(1));
    const k = level.kick;
    profileEl.style.transform =
      `scale(${1 + 0.05 * k}) rotate(${(Math.sin(t / 380) * 3).toFixed(2)}deg)`;
    mainEl.style.setProperty("--shake-x", ((Math.random() - 0.5) * 8 * k).toFixed(1) + "px");
    mainEl.style.setProperty("--shake-y", ((Math.random() - 0.5) * 8 * k).toFixed(1) + "px");
  }
  const now = performance.now();
  for (let i = party.cats.length - 1; i >= 0; i--) {
    const c = party.cats[i];
    const boost = 1 + level.kick * 1.5;
    c.x += c.vx * boost; c.y += c.vy * boost;
    if (c.x < 0 || c.x > w - c.size) { c.vx *= -1; c.x = Math.max(0, Math.min(w - c.size, c.x)); }
    if (c.y < 0 || c.y > h - c.size) { c.vy *= -1; c.y = Math.max(0, Math.min(h - c.size, c.y)); }
    c.el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0) scale(${1 + 0.12 * level.kick})`;
    if (!party.on || now - c.born > c.life) {
      c.el.classList.add("is-gone");
      party.cats.splice(i, 1);
      setTimeout(() => c.el.remove(), 500);
    }
  }
}

const PARTY_LOG = [
  ["» injecting <span class=\"hl\">lsd.dll</span>", "ok"],
  ["» summoning cats", "ok"],
  ["» o i i a o i i a", "ok"],
];
function partyOn() {
  if (party.on || !entered) return;
  party.on = true;
  party.beat = -1;
  document.documentElement.classList.add("is-party");
  audio.pause();
  muted = false; applyMute();
  partyAudio.currentTime = 0;
  partyAudio.play().catch(() => {});
  $("track-name").textContent = "oiia oiia (reez party mix)";
  partyExit.hidden = false;
  if (dock.hidden) { dock.hidden = false; requestAnimationFrame(() => dock.classList.add("is-in")); }
  nameTarget = "oiia";
  if (reduceMotion.matches) { mainPart.textContent = nameTarget; lockWidths(); }
  else scrambleName(true);
  clearInterval(logTimer);
  $("log").innerHTML = PARTY_LOG.map(([l, s]) => `${l} <span class="ok">[${s}]</span>`).join("\n");
  $("party-status").textContent = "Party mode on. Press Escape to exit.";
  for (let i = 0; i < 6; i++) spawnCat(w / 2, h / 2, true);
}
function partyOff() {
  if (!party.on) return;
  party.on = false;
  document.documentElement.classList.remove("is-party");
  document.documentElement.style.removeProperty("--party-h");
  profileEl.style.transform = "";
  mainEl.style.removeProperty("--shake-x"); mainEl.style.removeProperty("--shake-y");
  partyAudio.pause();
  if (!muted) audio.play().catch(() => {});
  $("track-name").textContent = CONFIG.trackName;
  partyExit.hidden = true;
  nameTarget = "reez";
  if (reduceMotion.matches) { mainPart.textContent = nameTarget; lockWidths(); }
  else scrambleName(true);
  clearInterval(logTimer);
  renderLog(LOG.length, false);
  $("party-status").textContent = "Party mode off.";
}
const togglePartyMode = () => (party.on ? partyOff() : partyOn());
partyExit.addEventListener("click", partyOff);

// Keyboard triggers
let typed = "";
document.addEventListener("keydown", (e) => {
  if (!entered || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "Escape") { partyOff(); return; }
  if (e.key.length !== 1 || e.target.closest("input, textarea")) return;
  typed = (typed + e.key.toLowerCase()).slice(-4);
  if (typed === "oiia") { typed = ""; togglePartyMode(); }
});


// Touch trigger: 5 quick taps on the avatar
let taps = [];
document.querySelector(".avatar").addEventListener("pointerdown", () => {
  const now = performance.now();
  taps = [...taps.filter((t) => now - t < 1800), now];
  if (taps.length >= 5) { taps = []; togglePartyMode(); }
});

// Clicking during the party throws more cats
window.addEventListener("pointerdown", (e) => {
  if (!party.on || e.target.closest(".dock, .avatar")) return;
  for (let i = 0; i < 3; i++) spawnCat(e.clientX, e.clientY, true);
});

/* ---------- Forum gate ---------- */
const gate = $("gate");
const gateKey = $("gate-key");
const gateBtn = $("gate-btn");
const gateStatus = $("gate-status");
let gateTimer = null;

function gateState(label, cls) {
  gate.classList.remove("is-busy", "is-denied");
  void gate.offsetWidth;
  if (cls) gate.classList.add(cls);
  gateBtn.textContent = label;
}

gate.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!gateKey.value) { gateKey.focus(); return; }
  if (gate.classList.contains("is-busy")) return;
  clearTimeout(gateTimer);
  gateState("···", "is-busy");
  gateStatus.textContent = "Checking…";
  gateTimer = setTimeout(() => {
    gateState("Denied", "is-denied");
    gateStatus.textContent = "Access denied.";
    gateKey.value = "";
    gateTimer = setTimeout(() => { gateState("Access"); gateStatus.textContent = ""; }, 1600);
  }, 700 + Math.random() * 500);
});
