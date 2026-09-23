/* ============================================================
   reez.cc — config
   ============================================================ */
const CONFIG = {
  // Optional: your numeric Discord user ID for live status via Lanyard
  // (join discord.gg/lanyard once, then paste the ID here). Empty = off.
  discordId: "",
  timezone: "Europe/Berlin",
  // Shown next to the mute button while assets/audio.mp3 plays. Empty = hidden.
  trackName: "",
  volume: 0.35,
};

/* ============================================================ */

const $ = (id) => document.getElementById(id);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

$("year").textContent = new Date().getFullYear();
requestAnimationFrame(() => $("main").classList.add("is-in"));

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
  ["» ready.", ""],
];

function renderLog(count, caret) {
  $("log").innerHTML = LOG.slice(0, count)
    .map(([line, status]) => status ? `${line} <span class="ok">[${status}]</span>` : line)
    .join("\n") + (caret ? '<span class="caret"></span>' : "");
}
(function playLog() {
  if (reduceMotion.matches) { renderLog(LOG.length, false); return; }
  let i = 0;
  renderLog(0, true);
  const t = setInterval(() => {
    renderLog(++i, true);
    if (i >= LOG.length) clearInterval(t);
  }, 450);
})();

/* ---------- Name: decode on load, glitch now and then ---------- */
const nameEl = $("name");
const mainPart = nameEl.querySelector(".name__main");
const tldPart = nameEl.querySelector(".name__tld");
const GLYPHS = "01<>/\\|[]{}#$%&*+=-_";
const randGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

function decode(el, target, delay = 0, done) {
  let frame = 0;
  const settleAt = target.split("").map((_, i) => 6 + i * 3 + Math.floor(Math.random() * 4));
  const last = Math.max(...settleAt);
  const run = () => {
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

// Lock each part to its final width so scrambling never shifts the layout
function lockWidths() {
  if (decoding) return;
  for (const el of [mainPart, tldPart]) {
    el.style.width = "";
    el.style.width = el.getBoundingClientRect().width + "px";
  }
}
lockWidths();
document.fonts?.ready.then(lockWidths);
window.addEventListener("resize", lockWidths);


function scrambleName() {
  if (decoding) return;
  decoding = true;
  decode(mainPart, "reez", 0);
  decode(tldPart, ".cc", 120, () => { decoding = false; glitch(); });
}

if (!reduceMotion.matches) {
  scrambleName();
  (function loop() {
    setTimeout(() => { if (!document.hidden) glitch(); loop(); }, 3500 + Math.random() * 3500);
  })();
  nameEl.addEventListener("pointerenter", scrambleName);
}

/* ---------- Sound: assets/audio.mp3 starts on the first interaction ---------- */
const dock = $("dock");
const muteBtn = $("mute");
const audio = $("audio");
audio.volume = CONFIG.volume;

let audioOk = false;
let interacted = false;
let muted = store.get("reez:muted") === "1";

function applyMute() {
  audio.muted = muted;
  muteBtn.setAttribute("aria-pressed", String(muted));
}

function startSound() {
  if (!audioOk || !interacted) return;
  applyMute();
  if (!muted) audio.play().catch(() => {});
  $("track-name").textContent = CONFIG.trackName;
  if (dock.hidden) {
    dock.hidden = false;
    requestAnimationFrame(() => dock.classList.add("is-in"));
  }
}

audio.addEventListener("canplay", () => { audioOk = true; startSound(); }, { once: true });

// Browsers only allow sound after a gesture, so the first click, tap or key starts it.
function firstInteraction() {
  interacted = true;
  startSound();
  ["pointerdown", "keydown"].forEach((ev) => document.removeEventListener(ev, firstInteraction));
}
["pointerdown", "keydown"].forEach((ev) => document.addEventListener(ev, firstInteraction));

muteBtn.addEventListener("click", () => {
  muted = !muted;
  store.set("reez:muted", muted ? "1" : "0");
  applyMute();
  if (!muted && audio.paused) audio.play().catch(() => {});
});

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

    if (dist < RADIUS) {
      const f = 1 - dist / RADIUS;
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
        const k = (1 - band / 40) * (1 - r.r / maxR);
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
    const tw = 0.13 + 0.06 * Math.sin(t / 900 + d.seed * 40);
    const a = Math.min(1, tw + d.glow * 0.85);
    const size = 1.4 + d.glow * 1.6;
    ctx.fillStyle = d.glow > 0.05
      ? `rgba(${(183 - 90 * d.glow) | 0}, ${(166 + 60 * d.glow) | 0}, 255, ${a})`
      : `rgba(210, 200, 255, ${a})`;
    ctx.fillRect(d.x - size / 2, d.y - size / 2, size, size);
  }

  // thin lines from the cursor to the closest lit dots
  ctx.lineWidth = 0.6;
  for (const d of near) {
    ctx.strokeStyle = `rgba(94, 231, 255, ${0.35 * d.glow})`;
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
