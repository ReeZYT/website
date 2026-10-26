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
   Background: a field of voxel pillars, like a live data grid.
   The camera glides over it and leans with the pointer; pillars
   under the pointer rise and light up, random cells blink like
   activity LEDs. Rays walk the grid cell by cell (DDA) and hit each
   pillar exactly. Rendered at reduced resolution and scaled down
   further if frames get slow.
   ============================================================ */
const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform vec2 uShift;

const float GAP = 0.09;
const float TOP = 3.6; // tallest pillar

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec2 hover;            // grid point under the pointer
float height(vec2 id){
  float t = uTime * 0.5;
  float h = 0.25 + 0.45 * (0.5 + 0.5 * sin(id.x * 0.42 + t) * cos(id.y * 0.37 - t * 0.7));
  h += 0.35 * hash(id);
  vec2 d = id + 0.5 - hover;
  h += 2.1 * exp(-dot(d, d) * 0.09);
  return h;
}

void camera(vec2 uv, out vec3 ro, out vec3 rd){
  ro = vec3(uMouse.x * 2.2, 7.2 + uMouse.y * 0.9, 10.0 - uTime * 0.7);
  vec3 ta = ro + vec3(uMouse.x * 0.8, -6.0, -9.5);
  vec3 f = normalize(ta - ro);
  vec3 r = normalize(cross(f, vec3(0.0, 1.0, 0.0)));
  vec3 u = cross(r, f);
  rd = normalize(uv.x * r + uv.y * u + 1.6 * f);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y - uShift;
  vec3 ro, rd;
  camera(uv, ro, rd);

  // where the pointer ray meets the grid
  vec3 mo, md;
  camera(uMouse * vec2(0.5 * uRes.x / uRes.y, 0.5) - uShift, mo, md);
  hover = (mo + md * ((1.2 - mo.y) / md.y)).xz;

  vec3 bg = mix(vec3(0.01, 0.012, 0.025), vec3(0.05, 0.04, 0.12), smoothstep(-0.6, 0.4, uv.y));
  vec3 col = bg;

  // start where the ray drops below the tallest pillar
  float t = max(0.0, (ro.y - TOP) / -rd.y);
  vec3 p = ro + rd * t;
  vec2 cell = floor(p.xz);
  vec2 dir = sign(rd.xz);
  vec2 inv = 1.0 / max(abs(rd.xz), 1e-4);
  vec2 tMax = t + (cell + max(dir, 0.0) - p.xz) * dir * inv;
  vec2 tDelta = inv;

  float hitT = -1.0, hitH = 0.0;
  vec3 n = vec3(0.0);
  vec2 hitCell = vec2(0.0);
  for (int i = 0; i < 110; i++) {
    float h = height(cell);
    // ray vs. this cell's pillar (axis-aligned box)
    vec3 bmin = vec3(cell.x + GAP, -3.0, cell.y + GAP);
    vec3 bmax = vec3(cell.x + 1.0 - GAP, h, cell.y + 1.0 - GAP);
    vec3 ird = 1.0 / rd;
    vec3 t0 = (bmin - ro) * ird, t1 = (bmax - ro) * ird;
    vec3 tn = min(t0, t1), tf = max(t0, t1);
    float tNear = max(max(tn.x, tn.y), tn.z);
    float tFar = min(min(tf.x, tf.y), tf.z);
    if (tNear < tFar && tFar > 0.0) {
      hitT = tNear; hitH = h; hitCell = cell;
      n = tNear == tn.y ? vec3(0.0, 1.0, 0.0) : tNear == tn.x ? vec3(-sign(rd.x), 0.0, 0.0) : vec3(0.0, 0.0, -sign(rd.z));
      break;
    }
    if (tMax.x < tMax.y) { tMax.x += tDelta.x; cell.x += dir.x; }
    else { tMax.y += tDelta.y; cell.y += dir.y; }
    if (min(tMax.x, tMax.y) > 60.0) break;
  }

  if (hitT > 0.0) {
    vec3 hp = ro + rd * hitT;
    vec2 local = hp.xz - hitCell;
    float rnd = hash(hitCell);
    vec2 dm = hitCell + 0.5 - hover;
    float near = exp(-dot(dm, dm) * 0.09);
    vec3 tint = mix(vec3(0.49, 0.97, 1.0), vec3(0.65, 0.55, 1.0), rnd);
    // blinking "activity" cells
    float blink = step(0.985, hash(hitCell + floor(uTime * 1.5)));
    tint = mix(tint, vec3(1.0, 0.48, 0.85), blink);

    if (n.y > 0.5) {
      // top face: dark plate with a glowing rim
      vec2 e = min(local - GAP, 1.0 - GAP - local);
      float rim = smoothstep(0.06, 0.0, min(e.x, e.y));
      float lvl = smoothstep(0.3, 2.6, hitH);
      col = vec3(0.02, 0.024, 0.045) + tint * (0.02 + 0.1 * lvl + 0.9 * near + 0.6 * blink);
      col += tint * rim * (0.18 + 1.4 * near + 0.8 * blink);
    } else {
      // sides: darker, with rack-like LED rows and lit vertical edges
      float side = n.x != 0.0 ? local.y : local.x;
      float edge = smoothstep(0.05, 0.0, min(side - GAP, 1.0 - GAP - side));
      float rows = step(0.82, fract(hp.y * 3.0)) * step(0.5, hash(hitCell + floor(hp.y * 3.0)));
      float shade = n.x != 0.0 ? 0.6 : 1.0;
      col = vec3(0.012, 0.014, 0.03) * shade;
      col += tint * (edge * (0.1 + 0.8 * near) + rows * (0.06 + 0.5 * near)) * shade;
      col += tint * smoothstep(-1.0, hitH, hp.y) * 0.03;
    }
    // fog into the distance
    col = mix(col, bg, 1.0 - exp(-max(hitT - 5.0, 0.0) * 0.09));
  }

  col += vec3(0.35, 0.3, 0.9) * 0.08 * exp(-abs(uv.y - 0.32) * 6.0); // horizon haze
  col = col / (1.0 + col);
  col = pow(col, vec3(0.9));
  col *= 1.0 - 0.3 * dot(uv * 0.7, uv * 0.7);
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
  const uRes = u("uRes"), uTime = u("uTime"), uMouse = u("uMouse"), uShift = u("uShift");

  let scale = 0;              // render resolution vs. device pixels
  let shift = [0, 0];
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // ~1.2 MP keeps it smooth; the CSS upscale hides the rest
    if (!scale) scale = Math.min(0.75, Math.sqrt(1.2e6 / (window.innerWidth * window.innerHeight * dpr * dpr)));
    canvas.width = Math.round(window.innerWidth * dpr * scale);
    canvas.height = Math.round(window.innerHeight * dpr * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
    // portrait: look a bit further down so the grid sits behind the cards
    shift = [0, window.innerWidth / window.innerHeight < 1 ? 0.12 : 0];
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
