/* ============================================================
   reez.cc — config
   ============================================================ */
const CONFIG = {
  // Numeric Discord user ID for live status via Lanyard
  // (join discord.gg/lanyard once, then paste the ID here). Empty = off.
  discordId: "559785484683837450",
  timezone: "Europe/Berlin",
  // Forum gate. Set with `node tools/gate.mjs` – never edit by hand.
  gate: {"v":1,"i":600000,"s":"BAdtGTk+NHVDpeZsHGXPoA==","n":"Dxf1Zqb4dBimk8/+","d":"TrLizGuT43EFqfuhQ1YNBdsq4hKyS7y8fFgiD8/TZVV32I3DOCraCdEe8mkCE2kBKfzQwDS98FLkJUY="},
};

/* ============================================================ */

const $ = (id) => document.getElementById(id);

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

$("year").textContent = new Date().getFullYear();

/* ---------- Avatar with monogram fallback ---------- */
const avatar = $("avatar-img");
const markBroken = () => avatar.classList.add("is-broken");
avatar.addEventListener("error", markBroken);
if (avatar.complete && avatar.naturalWidth === 0) markBroken();

/* ---------- Local time ---------- */
const clockFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: CONFIG.timezone });
function tick() {
  const now = new Date();
  $("clock").textContent = clockFmt.format(now);
  $("clock").dateTime = now.toISOString();
}
tick();
setInterval(tick, 1000);

/* ---------- Discord: copy the username ---------- */
const discordBtn = $("discord-copy");
const discordStatus = $("discord-status");
let copyTimer = null;

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { /* ignore */ }
  ta.remove();
  return ok;
}

discordBtn.addEventListener("click", async () => {
  const ok = await copyText(discordBtn.dataset.copy);
  discordStatus.textContent = ok ? "Copied" : "Failed";
  discordBtn.classList.toggle("is-copied", ok);
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    discordStatus.textContent = "Copy";
    discordBtn.classList.remove("is-copied");
  }, 1800);
});

/* ---------- Live status via Lanyard ---------- */
const STATUS_LABEL = { online: "Online", idle: "Away", dnd: "Do not disturb", offline: "Offline" };

async function loadPresence() {
  if (!CONFIG.discordId) return;
  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${CONFIG.discordId}`);
    if (!res.ok) return;
    const { data } = await res.json();
    const status = data.discord_status || "offline";
    const game = (data.activities || []).find((a) => a.type === 0);
    const song = data.listening_to_spotify && data.spotify;

    $("avatar-status").dataset.status = status;
    $("avatar-status").title = `${STATUS_LABEL[status] || "Offline"} on Discord`;
    $("avatar-status").hidden = false;

    let text = STATUS_LABEL[status] || "Offline";
    if (game) text = `Playing ${game.name}`;
    else if (song) text = `Listening to ${song.song} – ${song.artist}`;
    $("now").dataset.status = status;
    $("now-text").textContent = text;
    $("now-text").title = text;
    $("now").hidden = false;

    $("steam-detail").textContent = game ? `Playing ${game.name}` : "1337ReeZ";
    $("spotify-detail").textContent = song ? `${song.song} – ${song.artist}` : "Playlists & profile";
  } catch { /* offline or blocked: keep the static page */ }
}
loadPresence();
setInterval(loadPresence, 15_000);

/* ---------- Forum gate ----------
   The forum URL is stored encrypted (AES-GCM). The access key is
   stretched with PBKDF2 into the AES key; only the right key decrypts
   the URL. Too many wrong keys -> growing cooldown.                   */
const gate = $("gate");
const gateKey = $("gate-key");
const gateBtn = $("gate-btn");
const gateStatus = $("gate-status");
const GATE_LOCK = "reez:gate";
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
let gateTimer = null;

function gateState(label, cls) {
  gate.classList.remove("is-busy", "is-denied", "is-granted", "is-locked");
  void gate.offsetWidth;
  if (cls) gate.classList.add(cls);
  gateBtn.textContent = label;
}

async function unseal(key, box) {
  if (!box || !crypto?.subtle) return null;
  try {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), "PBKDF2", false, ["deriveKey"]);
    const aes = await crypto.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt: fromB64(box.s), iterations: box.i },
      base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const url = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(box.n) }, aes, fromB64(box.d)));
    return /^https:\/\//.test(url) ? url : null;
  } catch { return null; } // wrong key: GCM tag check fails
}

const lockState = () => { try { return JSON.parse(store.get(GATE_LOCK)) || { fails: 0, until: 0 }; } catch { return { fails: 0, until: 0 }; } };

function showLock(until) {
  clearInterval(gateTimer);
  const tickLock = () => {
    const left = Math.ceil((until - Date.now()) / 1000);
    if (left <= 0) { clearInterval(gateTimer); gateKey.disabled = false; gateState("Enter"); gateStatus.textContent = ""; return; }
    gateKey.disabled = true;
    gateState(`${left}s`, "is-locked");
    gateStatus.textContent = `Too many attempts. Try again in ${left} seconds.`;
  };
  tickLock();
  gateTimer = setInterval(tickLock, 1000);
}
if (lockState().until > Date.now()) showLock(lockState().until);

gate.addEventListener("submit", async (e) => {
  e.preventDefault();
  const key = gateKey.value.trim();
  if (!key) { gateKey.focus(); return; }
  if (gate.classList.contains("is-busy") || lockState().until > Date.now()) return;
  clearInterval(gateTimer); clearTimeout(gateTimer);
  gateState("···", "is-busy");
  gateStatus.textContent = "Checking…";
  const t0 = performance.now();
  const url = await unseal(key, CONFIG.gate);
  const wait = 450 - (performance.now() - t0);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  gateKey.value = "";

  if (url) {
    store.set(GATE_LOCK, JSON.stringify({ fails: 0, until: 0 }));
    gateState("Granted", "is-granted");
    gateStatus.textContent = "Access granted. Redirecting…";
    setTimeout(() => location.assign(url), 700);
    return;
  }
  const st = lockState();
  st.fails += 1;
  // 3 free tries, then 30s, 60s, 120s … (max 15 min)
  if (st.fails >= 3) st.until = Date.now() + Math.min(900, 30 * 2 ** (st.fails - 3)) * 1000;
  store.set(GATE_LOCK, JSON.stringify(st));
  gateState("Denied", "is-denied");
  gateStatus.textContent = "Access denied.";
  gateTimer = setTimeout(() => {
    if (st.until > Date.now()) showLock(st.until);
    else { gateState("Enter"); gateStatus.textContent = ""; }
  }, 1600);
});

/* ============================================================
   Pointer: shared, smoothed in the render loop
   ============================================================ */
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const pointer = { x: 0, y: 0, tx: 0, ty: 0 }; // -1..1, y up
window.addEventListener("pointermove", (e) => {
  pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.ty = -((e.clientY / window.innerHeight) * 2 - 1);
  $("readout").textContent = `x ${((pointer.tx + 1) / 2).toFixed(3)} · y ${((1 - pointer.ty) / 2).toFixed(3)}`;
}, { passive: true });
// phones: tilt the device instead
window.addEventListener("deviceorientation", (e) => {
  if (e.gamma == null) return;
  pointer.tx = Math.max(-1, Math.min(1, e.gamma / 30));
  pointer.ty = Math.max(-1, Math.min(1, (45 - e.beta) / 30));
}, { passive: true });

/* ---------- Cards: 3D tilt + spotlight ---------- */
for (const card of document.querySelectorAll(".card")) {
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    card.style.setProperty("--mx", `${px * 100}%`);
    card.style.setProperty("--my", `${py * 100}%`);
    if (reduceMotion.matches || e.pointerType !== "mouse") return;
    card.style.setProperty("--rx", `${(0.5 - py) * 14}deg`);
    card.style.setProperty("--ry", `${(px - 0.5) * 14}deg`);
  });
  card.addEventListener("pointerleave", () => {
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
  });
}

/* ============================================================
   Background: raymarched liquid chrome.
   A wobbling core with orbiting droplets that melt into it, two
   orbit rings, and one droplet that chases the pointer. The scene
   turns with the pointer. Rendered at reduced resolution and scaled
   down further if frames get slow.
   ============================================================ */
const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform vec2 uShift;
uniform float uCam;

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }

vec2 map(vec3 p){
  vec3 q = p;
  q.xz *= rot(uTime * 0.12 + uMouse.x * 0.9);
  q.yz *= rot(-uMouse.y * 0.6);

  float t = uTime * 0.6;
  float d = length(q) - 1.05;
  d += 0.09 * sin(2.6 * q.x + t) * sin(2.9 * q.y + t * 1.3) * sin(2.4 * q.z + t * 0.8);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec3 c = vec3(sin(t * 0.7 + fi * 1.9) * 1.55, cos(t * 0.55 + fi * 2.4) * 0.95, sin(t * 0.45 + fi * 2.9) * 1.25);
    d = smin(d, length(q - c) - (0.22 + 0.06 * fi), 0.55);
  }
  // droplet that chases the pointer (world space)
  vec3 m = vec3(uMouse.x * 2.4 + uShift.x * 1.6, uMouse.y * 1.5 - uShift.y * 1.6, 1.2);
  d = smin(d, length(p - m) - 0.26, 0.8);

  // thin orbit rings
  vec3 r1 = q; r1.xy *= rot(0.45);
  vec3 r2 = q; r2.yz *= rot(1.1); r2.xy *= rot(-0.3);
  float ring = min(length(vec2(length(r1.xz) - 2.15, r1.y)) - 0.012,
                   length(vec2(length(r2.xz) - 2.55, r2.y)) - 0.008);
  return d < ring ? vec2(d, 0.0) : vec2(ring, 1.0);
}

vec3 normal(vec3 p){
  const vec2 e = vec2(0.0015, -0.0015);
  return normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x + e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
}

vec3 pal(float t){ return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.52, 0.68, 0.86))); }

// fake studio environment: soft light strips + a cool horizon
vec3 env(vec3 r){
  vec3 c = mix(vec3(0.03, 0.035, 0.07), vec3(0.42, 0.46, 0.66), smoothstep(-0.4, 0.9, r.y));
  c += vec3(0.9, 0.95, 1.0) * smoothstep(0.86, 0.99, r.y) * 1.2;
  c += vec3(0.55, 0.95, 1.0) * smoothstep(0.035, 0.0, abs(r.x - 0.55)) * smoothstep(-0.2, 0.4, r.y) * 1.5;
  c += vec3(0.75, 0.55, 1.0) * smoothstep(0.05, 0.0, abs(r.x + 0.7)) * 1.1;
  return c;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  uv -= uShift;
  vec3 ro = vec3(0.0, 0.0, uCam);
  vec3 rd = normalize(vec3(uv, -1.75));

  float t = 0.0, glow = 0.0;
  vec2 h = vec2(1.0, 0.0);
  for (int i = 0; i < 80; i++) {
    h = map(ro + rd * t);
    glow += 0.012 / (0.04 + h.x * h.x);
    if (h.x < 0.001 || t > 16.0) break;
    t += h.x * 0.9;
  }

  // background: deep space with a soft halo behind the object
  float halo = exp(-2.2 * length(uv - vec2(0.0, 0.0)));
  vec3 col = vec3(0.012, 0.014, 0.03) + vec3(0.12, 0.16, 0.36) * halo * 0.55;
  col += pal(uv.y * 0.4 + uTime * 0.03) * glow * 0.004;

  if (t < 16.0) {
    vec3 p = ro + rd * t;
    vec3 n = normal(p);
    vec3 r = reflect(rd, n);
    float fr = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    if (h.y > 0.5) {
      col = mix(vec3(0.5, 0.9, 1.0), vec3(0.8, 0.6, 1.0), 0.5 + 0.5 * sin(p.x * 2.0 + uTime)) * 0.75;
    } else {
      vec3 iri = pal(dot(n, -rd) * 0.9 + p.y * 0.18 + uTime * 0.04);
      col = env(r) * mix(vec3(1.0), iri, 0.55) * 1.25;
      col += iri * (0.12 + fr * 1.3);
      col += vec3(1.0) * pow(max(dot(r, normalize(vec3(0.5, 0.8, 0.4))), 0.0), 40.0) * 1.5;
    }
  }

  col = col / (1.0 + col);                 // tonemap
  col = pow(col, vec3(0.85));
  col *= 1.0 - 0.35 * dot(uv * 0.6, uv * 0.6); // vignette
  gl_FragColor = vec4(col, 1.0);
}`;

function startScene() {
  const canvas = $("scene");
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) return;

  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  try {
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  } catch (err) { console.warn(err); return; }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (n) => gl.getUniformLocation(prog, n);
  const uRes = u("uRes"), uTime = u("uTime"), uMouse = u("uMouse"), uShift = u("uShift"), uCam = u("uCam");

  let scale = 0;              // render resolution vs. device pixels
  let shift = [0, 0], cam = 6.2;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // ~1.2 MP is plenty for soft shapes; the CSS upscale hides the rest
    if (!scale) scale = Math.min(0.75, Math.sqrt(1.2e6 / (window.innerWidth * window.innerHeight * dpr * dpr)));
    canvas.width = Math.round(window.innerWidth * dpr * scale);
    canvas.height = Math.round(window.innerHeight * dpr * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
    // wide screens: push the object right, next to the text
    const aspect = window.innerWidth / window.innerHeight;
    shift = window.innerWidth > 940 ? [Math.min(0.45, aspect * 0.26), 0] : [0, aspect < 1 ? -0.18 : 0];
    // portrait: pull the camera back and sink the object behind the cards
    cam = aspect < 1 ? 6.2 / Math.max(aspect, 0.45) * 0.75 : 6.2;
  }
  resize();
  window.addEventListener("resize", resize);

  let raf = 0, last = performance.now(), slow = 0, time = 0;
  function frame(now) {
    const dt = Math.min(now - last, 100);
    last = now;
    if (!reduceMotion.matches) time += dt / 1000;
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, time);
    gl.uniform2f(uMouse, pointer.x, pointer.y);
    gl.uniform2f(uShift, shift[0], shift[1]);
    gl.uniform1f(uCam, cam);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // adaptive quality: drop resolution while frames stay slow
    slow = dt > 28 ? slow + 1 : Math.max(0, slow - 1);
    if (slow > 30 && scale > 0.35) { scale -= 0.1; slow = 0; resize(); }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });
}
startScene();
