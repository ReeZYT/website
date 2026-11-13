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
$("socials-count").textContent = String(document.querySelectorAll(".tile").length).padStart(2, "0");

/* ---------- Avatar with monogram fallback ---------- */
const avatar = $("avatar-img");
const markBroken = () => avatar.classList.add("is-broken");
avatar.addEventListener("error", markBroken);
if (avatar.complete && avatar.naturalWidth === 0) markBroken();

/* ---------- Local time ---------- */
const clockFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: CONFIG.timezone });
function tickClock() {
  const now = new Date();
  $("clock").textContent = clockFmt.format(now);
  $("clock").dateTime = now.toISOString();
}

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

/* ---------- Live status via Lanyard ----------
   Discord presence and the current Spotify track. Polled while the
   tab is visible; elapsed time and the track progress run locally
   between polls. If Lanyard can't be reached the panel says so and
   the rest of the page stays as it is.                              */
const STATUS_LABEL = { online: "Online", idle: "Away", dnd: "Do not disturb", offline: "Offline" };
const VERB = { 0: "Playing", 1: "Streaming", 3: "Watching", 5: "Competing in" };
const SPOTIFY_PROFILE = $("sp-link").href;
const POLL_MS = 15_000;
let presence = null;   // last Lanyard payload
let pollTimer = null;

const setText = (id, text) => { const el = $(id); if (el.textContent !== text) el.textContent = text; el.title = text; };
const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
function since(ms) {
  const min = Math.floor(Math.max(0, ms) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `for ${min} min`;
  return `for ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}
function device(d) {
  if (d.active_on_discord_desktop) return "On desktop";
  if (d.active_on_discord_mobile) return "On mobile";
  if (d.active_on_discord_web) return "In the browser";
  return "";
}

function renderPresence() {
  const d = presence;
  if (!d) return;
  const status = STATUS_LABEL[d.discord_status] ? d.discord_status : "offline";
  const acts = d.activities || [];
  const act = acts.find((a) => a.type in VERB);
  const custom = acts.find((a) => a.type === 4 && a.state);
  const song = d.listening_to_spotify && d.spotify;

  $("now").dataset.status = status;
  setText("now-state", STATUS_LABEL[status]);
  $("avatar-status").dataset.status = status;
  $("avatar-status").title = `${STATUS_LABEL[status]} on Discord`;
  $("avatar-status").hidden = false;

  // Discord row
  if (act) {
    const start = act.timestamps && act.timestamps.start;
    setText("dc-line", `${VERB[act.type]} ${act.name}`);
    setText("dc-sub", [act.details || act.state, start && since(Date.now() - start)].filter(Boolean).join(" · ") || device(d) || "aimbot.dll");
  } else {
    setText("dc-line", custom ? custom.state : STATUS_LABEL[status]);
    setText("dc-sub", (status === "offline" ? "" : device(d)) || "aimbot.dll");
  }

  // Spotify row
  const sp = $("sp"), art = $("sp-art");
  sp.dataset.on = String(Boolean(song));
  if (song) {
    setText("sp-title", song.song);
    setText("sp-artist", song.artist.replace(/; /g, ", "));
    $("sp-link").href = song.track_id ? `https://open.spotify.com/track/${encodeURIComponent(song.track_id)}` : SPOTIFY_PROFILE;
    if (song.album_art_url && art.dataset.src !== song.album_art_url) {
      art.dataset.src = song.album_art_url;
      art.hidden = true;
      art.src = song.album_art_url;
    }
    const { start, end } = song.timestamps || {};
    const total = end - start, pos = Math.min(Math.max(Date.now() - start, 0), total);
    if (total > 0) {
      $("sp-bar").style.transform = `scaleX(${(pos / total).toFixed(4)})`;
      $("sp-time").textContent = `${clock(pos)} / ${clock(total)}`;
      if (Date.now() > end + 1500) refreshSoon(); // track ended: fetch the next one
    }
  } else {
    setText("sp-title", "Nothing playing");
    setText("sp-artist", "Playlists & profile");
    $("sp-link").href = SPOTIFY_PROFILE;
    art.hidden = true;
    art.removeAttribute("src");
    delete art.dataset.src;
    $("sp-bar").style.transform = "scaleX(0)";
    $("sp-time").textContent = "0:00 / 0:00";
  }

  // The matching tiles show the same thing
  $("steam-detail").textContent = act && act.type === 0 ? `Playing ${act.name}` : "1337ReeZ";
  $("spotify-detail").textContent = song ? `${song.song} – ${song.artist.replace(/; /g, ", ")}` : "Playlists & profile";
}
$("sp-art").addEventListener("load", (e) => { e.target.hidden = false; });
$("sp-art").addEventListener("error", (e) => { e.target.hidden = true; });

async function loadPresence() {
  if (!CONFIG.discordId) return;
  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${CONFIG.discordId}`, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    presence = (await res.json()).data;
    renderPresence();
  } catch {
    if (presence) return; // keep the last known state
    $("now").dataset.status = "offline";
    setText("now-state", "No signal");
    setText("dc-line", "Status unavailable");
  }
}
let soonTimer = null;
function refreshSoon() {
  if (soonTimer) return;
  soonTimer = setTimeout(() => { soonTimer = null; loadPresence(); }, 2000);
}
function poll() {
  clearInterval(pollTimer);
  if (document.hidden) return;
  loadPresence();
  pollTimer = setInterval(loadPresence, POLL_MS);
}
document.addEventListener("visibilitychange", poll);
if (CONFIG.discordId) poll();
else { $("now").dataset.status = "offline"; setText("now-state", "Off"); setText("dc-line", "Status is switched off"); }

// One shared second tick: clock, track progress, elapsed time
function tick() {
  tickClock();
  if (presence && !document.hidden) renderPresence();
}
tick();
setInterval(tick, 1000);

/* ---------- Wordmark: settles out of noise once on load ---------- */
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
(function settleName() {
  const el = $("name-word"), final = el.textContent, noise = "01#$%&/<>[]{}=+*";
  if (reduceMotion.matches) return;
  const t0 = performance.now(), per = 150, lead = 260;
  (function frame(now) {
    const done = Math.floor((now - t0 - lead) / per);
    if (done >= final.length) { el.textContent = final; return; }
    el.textContent = [...final].map((c, i) => (i < done ? c : noise[Math.floor(Math.random() * noise.length)])).join("");
    setTimeout(() => requestAnimationFrame(frame), 55);
  })(t0);
})();

/* ---------- Hex view ----------
   The facts of this page as a null-separated record, shown the way a
   hex editor would. A cursor reads it byte by byte and the footer
   shows the string it is in. Purely decorative (aria-hidden).        */
(function hexView() {
  const body = $("hex");
  if (!body) return;
  const record = ["ReeZ", "Lukas", "Software Engineer", "Düsseldorf, DE", "reverse engineering", "data mining", "pattern recognition", "clips", "games"];
  const bytes = [...new TextEncoder().encode(record.join("\0") + "\0")];
  // which string each byte belongs to, for the footer
  const field = []; { let f = 0; for (const b of bytes) { field.push(f); if (b === 0) f += 1; } }
  const hex = (n, w) => n.toString(16).padStart(w, "0");
  const printable = (b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".");
  $("hex-size").textContent = `${bytes.length} bytes`;

  let cols = 0, cells = [], pos = 0, timer = null;
  const rows = document.createElement("div");
  rows.className = "hex__rows";
  body.appendChild(rows);

  function build(n) {
    cols = n;
    rows.textContent = "";
    cells = bytes.map(() => []);
    for (let r = 0; r < bytes.length; r += n) {
      const line = document.createElement("div");
      const off = document.createElement("span");
      off.className = "hex__off";
      off.textContent = hex(r, 4) + "  ";
      const hx = document.createElement("span"), as = document.createElement("span");
      as.className = "hex__ascii";
      for (let i = r; i < r + n; i += 1) {
        const gap = i - r === n / 2 - 1 && n > 8 ? "  " : " ";
        if (i >= bytes.length) { hx.append("  " + gap); continue; }
        const a = document.createElement("i"), b = document.createElement("i");
        a.textContent = hex(bytes[i], 2);
        b.textContent = printable(bytes[i]);
        if (bytes[i] === 0) { a.className = "is-nul"; b.className = "is-nul"; }
        hx.append(a, gap);
        as.append(b);
        cells[i] = [a, b];
      }
      line.append(off, hx, " ", as);
      rows.appendChild(line);
    }
    body.style.setProperty("--ch", String(4 + 2 + n * 3 + (n > 8 ? 1 : 0) + 1 + n));
    body.style.setProperty("--rows", String(Math.ceil(bytes.length / n)));
    paint();
  }

  // footer: where the cursor is and the string it is reading
  function readout() {
    const still = reduceMotion.matches;
    const at = still ? 0 : Math.min(pos, bytes.length - 1), f = field[at];
    let start = at; while (start > 0 && field[start - 1] === f) start -= 1;
    const read = still ? record[0] : new TextDecoder().decode(new Uint8Array(bytes.slice(start, at + 1).filter((v) => v !== 0))).replace(/�/g, "");
    $("hex-off").textContent = "0x" + hex(at, 2);
    $("hex-dec").textContent = `"${read}"`;
  }

  function paint() {
    const still = reduceMotion.matches;
    cells.forEach((pair, i) => pair.forEach((c) => {
      c.classList.toggle("is-read", still || i < pos);
      c.classList.toggle("is-on", !still && i === pos);
    }));
    readout();
  }

  function step() {
    pos += 1;
    if (pos > bytes.length) { stop(); timer = setTimeout(() => { pos = 0; paint(); run(); }, 4200); return; }
    const pair = cells[pos - 1], next = cells[pos];
    if (pair) pair.forEach((c) => { c.classList.remove("is-on"); c.classList.add("is-read"); });
    if (next) next.forEach((c) => c.classList.add("is-on"));
    readout();
  }
  function stop() { clearInterval(timer); clearTimeout(timer); timer = null; }
  function run() { stop(); if (!reduceMotion.matches && !document.hidden) timer = setInterval(step, 85); }

  const fit = () => { const n = body.clientWidth < 440 ? 8 : 16; if (n !== cols) build(n); };
  new ResizeObserver(fit).observe(body);
  fit();
  run();
  document.addEventListener("visibilitychange", run);
  reduceMotion.addEventListener("change", () => { paint(); run(); });
})();

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
