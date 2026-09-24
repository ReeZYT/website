"""reez.cc — 'aimbot.dll' : original darksynth loop, 112 BPM, A minor.
Fully synthesized, no samples -> no licensing issues."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
BPM = 112
BEAT = 60 / BPM
BAR = 4 * BEAT
BARS = 32
N = int(BARS * BAR * SR)
TAIL = int(4 * SR)
rng = np.random.default_rng(1337)

def buf(): return np.zeros(N + TAIL)
def st(): return np.zeros((2, N + TAIL))
def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def idx(t): return int(round(t * SR))
def lp(x, f, o=2): return sosfilt(butter(o, min(f, SR/2-100), 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)

def add(dst, sig, t, gain=1.0):
    i = idx(t); j = min(i + len(sig), dst.shape[-1])
    dst[..., i:j] += gain * sig[..., :j - i]

def saw(f, n, phase=0.0):
    t = np.arange(n) / SR
    p = (f * t + phase) % 1.0
    # polyBLEP-lite: soften the discontinuity a bit
    return 2 * p - 1

def adsr(n, a=0.005, d=0.1, s=0.7, r=0.08):
    e = np.full(n, s)
    na, nd, nr = int(a*SR), int(d*SR), int(r*SR)
    na = min(na, n); e[:na] = np.linspace(0, 1, na)
    nd = min(nd, n - na); e[na:na+nd] = np.linspace(1, s, nd)
    if nr < n: e[-nr:] *= np.linspace(1, 0, nr)
    return e

# ---------- song data ----------
CHORDS = [  # (bass root, pad triad, arp tones) – 2 bars each: Am  F  Dm  E
    (45, [57, 60, 64], [69, 72, 76, 81]),
    (41, [53, 57, 60], [65, 69, 72, 77]),
    (38, [50, 53, 57], [62, 65, 69, 74]),
    (40, [52, 56, 59], [64, 68, 71, 76]),
]
def chord_at(bar): return CHORDS[(bar // 2) % 4]

MELODY = [  # (midi, beats) over one 8-bar cycle
    (76,2),(74,1),(72,1),(76,2),(81,2),
    (84,3),(81,1),(79,2),(77,2),
    (81,2),(77,1),(74,1),(77,2),(81,2),
    (80,3),(83,1),(88,4),
]

def has(part, b):
    main = 4 <= b < 28
    return {
        'pad':   True,
        'arp':   True,
        'hats':  2 <= b < 28 or b >= 30,
        'kick':  main,
        'snare': main,
        'bass':  main,
        'lead':  12 <= b < 28,
        'roll':  b == 3,
        'riser': b in (2, 3),
    }[part]

# ---------- instruments ----------
kick, snare, hats, bass, pad, arp, lead, fx = buf(), buf(), buf(), buf(), st(), st(), st(), buf()
duck = np.ones(N + TAIL)

def kick_hit():
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t / 0.035)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18)
    click = hp(rng.standard_normal(n), 3000) * np.exp(-t / 0.004) * 0.3
    return np.tanh(1.8 * (body + click))

def snare_hit(g=1.0):
    n = int(0.35 * SR); t = np.arange(n) / SR
    noise = bp(rng.standard_normal(n), 1200, 9000) * np.exp(-t / 0.09)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05)
    return g * (0.8 * noise + 0.6 * tone)

def hat(open_=False):
    n = int((0.25 if open_ else 0.05) * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7500, 4) * np.exp(-t / (0.08 if open_ else 0.012))

K = kick_hit()
for b in range(BARS):
    t0 = b * BAR
    for beat in range(4):
        tb = t0 + beat * BEAT
        if has('kick', b):
            add(kick, K, tb)
            # sidechain envelope
            n = int(BEAT * SR); tt = np.arange(n) / SR
            env = 1 - 0.7 * np.exp(-tt / 0.13) * np.clip(tt / 0.004, 0, 1)
            i = idx(tb); duck[i:i+n] = np.minimum(duck[i:i+n], env)
        if has('snare', b) and beat in (1, 3):
            add(snare, snare_hit(), tb)
        if has('hats', b):
            add(hats, hat(), tb, 0.35)                       # on-beat closed
            add(hats, hat(True), tb + BEAT / 2, 0.22)        # off-beat open
            if has('kick', b):
                add(hats, hat(), tb + BEAT / 4, 0.18)
                add(hats, hat(), tb + 3 * BEAT / 4, 0.18)
    if has('roll', b):
        steps = [(i / 16, (i + 1) / 16) for i in range(16)] + [(0.75 + i / 32, 0) for i in range(8)]
        for k, (pos, _) in enumerate(steps):
            add(snare, snare_hit(0.15 + 0.6 * pos), t0 + pos * BAR)
    if has('riser', b) and b == 2:
        n = int(2 * BAR * SR); t = np.arange(n) / SR
        r = rng.standard_normal(n)
        r = hp(r, 800) * (t / t[-1]) ** 2.2
        add(fx, r, t0, 0.25)

# bass: 16th-note saw pulses with filter "wah" via dark/bright crossfade
for b in range(BARS):
    if not has('bass', b): continue
    root = chord_at(b)[0]
    for s in range(16):
        if s % 4 == 0: continue            # leave room for the kick
        f = mtof(root - 12 + (12 if s in (6, 14) else 0))
        n = int(BEAT / 4 * SR * 0.9)
        x = 0.6 * saw(f, n) + 0.4 * saw(f * 1.005, n, 0.3) + 0.5 * np.sin(2*np.pi*f*np.arange(n)/SR)
        t = np.arange(n) / SR
        fe = np.exp(-t / 0.05)
        sig = lp(x, 350) + fe * (lp(x, 2400) - lp(x, 350))
        add(bass, sig * adsr(n, 0.002, 0.05, 0.8, 0.02), b * BAR + s * BEAT / 4)

# pad: supersaw triads, 2 bars each, stereo detune
for b in range(0, BARS, 2):
    triad = chord_at(b)[1]
    n = int(2 * BAR * SR)
    L, R = np.zeros(n), np.zeros(n)
    for m in triad:
        f = mtof(m)
        for k, det in enumerate([-0.12, -0.05, 0.0, 0.06, 0.13]):
            ph = rng.random()
            v = saw(f * 2 ** (det / 12), n, ph)
            pan = k / 4
            L += v * (1 - pan); R += v * pan
    env = adsr(n, 0.35, 0.5, 0.85, 0.5)
    cut = 900 if b < 4 or b >= 28 else 2200
    add(pad, np.stack([lp(L, cut), lp(R, cut)]) * env / 12, b * BAR)

# arp: square-ish 16ths, ping-pong delay later
ARP_PAT = [0, 1, 2, 3, 2, 1, 0, 2, 1, 3, 2, 0, 3, 1, 2, 1]
arp_dry = buf()
for b in range(BARS):
    tones = chord_at(b)[2]
    for s in range(16):
        f = mtof(tones[ARP_PAT[s]])
        n = int(BEAT / 4 * SR * 0.8); t = np.arange(n) / SR
        sq = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + saw(f * 2, n) * 0.2
        g = 0.55 if (b < 4 or b >= 28) else 0.8
        cut = 1800 if b < 4 else 4200
        add(arp_dry, lp(sq, cut) * np.exp(-t / 0.07) * g, b * BAR + s * BEAT / 4)
arp[0] += arp_dry * 0.8; arp[1] += arp_dry * 0.8
D = 0.75 * BEAT
for k in range(1, 6):
    ch = k % 2
    shifted = np.zeros_like(arp_dry); i = idx(k * D)
    shifted[i:] = arp_dry[:-i]
    arp[ch] += lp(shifted, 3000) * (0.45 ** k)

# lead: detuned saw with vibrato
for cyc_start in (12, 20):
    t_cursor = cyc_start * BAR
    for m, beats in MELODY:
        dur = beats * BEAT
        n = int(dur * SR); t = np.arange(n) / SR
        f = mtof(m - 12) * (1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.25) / 0.3, 0, 1))
        ph = np.cumsum(f) / SR
        v = (2 * (ph % 1) - 1) + (2 * ((ph * 1.007) % 1) - 1)
        if cyc_start == 20:
            v += 0.6 * (2 * ((ph * 2) % 1) - 1)   # octave layer on 2nd pass
        v = lp(v, 3200) * adsr(n, 0.02, 0.2, 0.75, 0.12) * 0.22
        add(lead, np.stack([v * 0.9, v]), t_cursor)
        t_cursor += dur

# ---------- mix ----------
def reverb_ir(sec=2.8, seed=0):
    r = np.random.default_rng(seed); n = int(sec * SR); t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t / (sec / 5))
    return lp(ir, 6000) / np.sqrt(np.sum(ir ** 2))

send = (pad * 0.6 + arp * 0.35 + lead * 0.5) + np.stack([snare, snare]) * 0.15
IRL, IRR = reverb_ir(seed=1), reverb_ir(seed=2)
rev = np.stack([fftconvolve(send[0], IRL)[:N+TAIL], fftconvolve(send[1], IRR)[:N+TAIL]])

mix = np.zeros((2, N + TAIL))
mono = kick * 0.8 + snare * 0.45 + bass * 0.55 * duck + fx
mix += mono
mix += np.stack([hats * 0.9, hats * 1.0])
mix += (pad * 1.5 + arp * 0.85 + lead * 0.85) * duck
mix += rev * 0.35 * duck

# wrap the tail onto the start -> seamless loop
out = mix[:, :N].copy()
out[:, :TAIL] += mix[:, N:N+TAIL]

out = hp(out, 25)
out = lp(out, 15000, 2)
# start the file on the drop (bar 4): build-up now leads back into it on loop
out = np.roll(out, -int(4 * BAR * SR), axis=1)
out = np.tanh(out * 1.15)
out /= np.max(np.abs(out)) * 1.12

import wave
pcm = (out.T * 32767).astype(np.int16)
with wave.open('track.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('done', N / SR, 'sec')
