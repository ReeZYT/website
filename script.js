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
const clockFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: CONFIG.timezone });
function tick() {
  const now = new Date();
  $("clock").textContent = clockFmt.format(now);
  $("clock").dateTime = now.toISOString();
}
tick();
setInterval(tick, 10_000);

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
