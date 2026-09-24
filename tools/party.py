"""reez.cc — 'oiia oiia (reez party mix)': original loop, 140 BPM, D minor.
The "o-i-i-a" chant is formant-synthesised (additive harmonics shaped by
vowel formants), so there are no samples and no licensing issues."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
BPM = 140
BEAT = 60 / BPM
BAR = 4 * BEAT
BARS = 32
N = int(BARS * BAR * SR)
TAIL = int(3 * SR)
rng = np.random.default_rng(42)

def buf(): return np.zeros(N + TAIL)
def mtof(m): return 440 * 2 ** ((np.asarray(m, float) - 69) / 12)
def idx(t): return int(round(t * SR))
def lp(x, f, o=2): return sosfilt(butter(o, min(f, SR/2-100), 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)
def add(dst, sig, t, gain=1.0):
    i = idx(t); j = min(i + sig.shape[-1], dst.shape[-1])
    dst[..., i:j] += gain * sig[..., :j - i]
def saw(f, n, ph=0.0):
    return 2 * ((f * np.arange(n) / SR + ph) % 1.0) - 1

# ---------- song ----------
ROOTS = [50, 46, 41, 48]          # D  Bb  F  C  (2 bars each)
MINOR = [True, False, False, False]
def chord(b):
    i = (b // 2) % 4
    r = ROOTS[i]
    return r, [r, r + (3 if MINOR[i] else 4), r + 7]

def section(b):
    if b < 16: return 'drop'
    if b < 24: return 'break'
    return 'drop2'

# ---------- formant voice ----------
# (F1, F2, F3) Hz, bandwidths, gains
VOWELS = {
    'o': (430, 820, 2700),
    'i': (300, 2500, 3300),
    'a': (780, 1250, 2600),
    'e': (420, 2100, 2800),
    'u': (320, 700, 2400),
    'm': (250, 1000, 2500),
}
BW = np.array([80, 110, 160])
FG = np.array([1.0, 0.7, 0.35])

def voice(segments, gain=1.0):
    """segments: list of (vowel, f0_hz, dur_s). Formants + pitch glide between them."""
    total = sum(d for _, _, d in segments)
    n = sum(int(d * SR) for _, _, d in segments)
    t = np.arange(n) / SR
    # piecewise targets
    F = np.zeros((3, n)); f0 = np.zeros(n); amp = np.ones(n)
    cursor = 0
    for k, (v, p, d) in enumerate(segments):
        m = int(d * SR); seg = slice(cursor, cursor + m)
        F[:, seg] = np.array(VOWELS[v])[:, None]
        f0[seg] = p
        # little dip between syllables so each one "speaks"
        tt = np.arange(m) / SR
        amp[seg] = np.clip(tt / 0.012, 0, 1) * np.clip((d - tt) / 0.025, 0, 1)
        if v == 'm': amp[seg] *= 0.35
        cursor += m
    # smooth transitions (~25 ms glide)
    kern = np.hanning(int(0.025 * SR)); kern /= kern.sum()
    for i in range(3): F[i] = np.convolve(F[i], kern, 'same')
    f0 = np.convolve(f0, kern, 'same'); f0[f0 < 50] = 50
    f0 *= 1 + 0.012 * np.sin(2 * np.pi * 6 * t)          # cartoon vibrato
    phase = 2 * np.pi * np.cumsum(f0) / SR
    out = np.zeros(n)
    for h in range(1, 14):
        fh = h * f0
        env = sum(FG[i] / (1 + ((fh - F[i]) / BW[i]) ** 2) for i in range(3))
        env *= (fh < 7000)
        out += env * np.sin(h * phase) / h ** 0.3
    breath = bp(rng.standard_normal(n), 2500, 6000) * 0.03
    return (out + breath) * amp * gain

def meow(f0=900, gain=1.0):
    d = 0.42; n = int(d * SR); t = np.arange(n) / SR
    segs = [('m', f0 * 0.9, 0.05), ('i', f0, 0.09), ('e', f0 * 1.1, 0.1), ('a', f0 * 0.95, 0.1), ('u', f0 * 0.7, 0.08)]
    return voice(segs, gain)

# ---------- drums ----------
def kick_hit():
    n = int(0.32 * SR); t = np.arange(n) / SR
    f = 50 + 180 * np.exp(-t / 0.025)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    click = hp(rng.standard_normal(n), 2500) * np.exp(-t / 0.003) * 0.4
    return np.tanh(3.0 * (body + click)) * 0.9
def clap_hit(g=1.0):
    n = int(0.25 * SR); t = np.arange(n) / SR
    e = sum(np.exp(-np.clip(t - o, 0, None) / 0.012) * (t >= o) for o in (0, 0.009, 0.018))
    e += np.exp(-t / 0.08) * 0.6
    return g * bp(rng.standard_normal(n), 900, 6000) * e * 0.6
def hat(open_=False):
    n = int((0.18 if open_ else 0.04) * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 8000, 4) * np.exp(-t / (0.06 if open_ else 0.01))

kick, clap, hats, bass, synth, vox, fx = buf(), buf(), buf(), buf(), np.zeros((2, N+TAIL)), buf(), buf()
duck = np.ones(N + TAIL)
K = kick_hit()

for b in range(BARS):
    s = section(b); t0 = b * BAR
    for beat in range(4):
        tb = t0 + beat * BEAT
        if s != 'break':
            add(kick, K, tb)
            n = int(BEAT * SR); tt = np.arange(n) / SR
            env = 1 - 0.8 * np.exp(-tt / 0.09) * np.clip(tt / 0.003, 0, 1)
            i = idx(tb); duck[i:i+n] = np.minimum(duck[i:i+n], env)
            if beat in (1, 3): add(clap, clap_hit(), tb)
            add(hats, hat(True), tb + BEAT / 2, 0.3)
            add(hats, hat(), tb + BEAT / 4, 0.15); add(hats, hat(), tb + 3 * BEAT / 4, 0.15)
        else:
            add(hats, hat(), tb + BEAT / 2, 0.2)
    if b in (22, 23):
        div = 8 if b == 22 else 16
        for k in range(div):
            add(clap, clap_hit(0.2 + 0.7 * ((b - 22) * div + k) / (2 * div) ), t0 + k * BAR / div)
        n = int(BAR * SR); t = np.arange(n) / SR
        add(fx, hp(rng.standard_normal(n), 1000 + (b - 22) * 2000) * ((t / t[-1] + (b - 22)) / 2) ** 2, t0, 0.25)

# rolling offbeat bass (k-b-b-b)
for b in range(BARS):
    if section(b) == 'break': continue
    root, _ = chord(b)
    for step in range(16):
        if step % 4 == 0: continue
        f = mtof(root - 12)
        n = int(BEAT / 4 * SR * 0.85); t = np.arange(n) / SR
        x = saw(f, n) + 0.6 * np.sin(2 * np.pi * f * t)
        sig = lp(x, 300) + np.exp(-t / 0.03) * (lp(x, 1800) - lp(x, 300))
        add(bass, sig * np.clip(t / 0.002, 0, 1) * np.clip((t[-1] - t) / 0.01, 0, 1), b * BAR + step * BEAT / 4)

# supersaw offbeat stabs (drop) / long pads (break)
for b in range(BARS):
    _, tri = chord(b); s = section(b)
    notes = [m + 12 for m in tri] + [tri[0] + 24]
    def ss(n):
        L = np.zeros(n); R = np.zeros(n)
        for m in notes:
            f = mtof(m)
            for k, det in enumerate([-0.15, -0.06, 0, 0.07, 0.16]):
                v = saw(f * 2 ** (det / 12), n, rng.random()); p = k / 4
                L += v * (1 - p); R += v * p
        return np.stack([L, R]) / 14
    if s == 'break':
        if b % 2 == 0:
            n = int(2 * BAR * SR); t = np.arange(n) / SR
            e = np.clip(t / 0.4, 0, 1) * np.clip((t[-1] - t) / 0.3, 0, 1)
            x = ss(n); x = np.stack([lp(x[0], 1500), lp(x[1], 1500)])
            add(synth, x * e, b * BAR)
    else:
        for beat in range(4):
            n = int(BEAT * 0.45 * SR); t = np.arange(n) / SR
            x = ss(n); x = np.stack([lp(x[0], 5000), lp(x[1], 5000)])
            add(synth, x * np.exp(-t / 0.12), b * BAR + beat * BEAT + BEAT / 2, 0.9)

# the chant: O I I A  O I I A  (8ths) – pitch follows the chord
E8 = BEAT / 2
def chant_bar(b, octave=0, gain=1.0):
    root, tri = chord(b)
    base = root + 12 + 12 * octave          # D5-ish
    o, i, a = base + 7, base + 12, tri[1] + 12 + 12 * octave + 12
    p = mtof([o, i, i, a])
    segs = []
    for k in range(2):
        segs += [('o', p[0], E8), ('i', p[1], E8), ('i', p[2], E8), ('a', p[3], E8)]
    add(vox, voice(segs, gain), b * BAR)

for b in range(BARS):
    s = section(b)
    if s == 'drop': chant_bar(b, 0, 1.0)
    elif s == 'break' and b % 2 == 0 and b < 22: chant_bar(b, 0, 0.7)
    elif s == 'drop2': chant_bar(b, 0, 1.0); chant_bar(b, 1, 0.35)
    if b % 4 == 3 and s != 'break':
        add(vox, meow(1000 + 150 * (b % 8 == 7)), b * BAR + 3.5 * BEAT, 0.8)
add(vox, meow(1200), 23 * BAR + 3 * BEAT, 1.0)

# ---------- mix ----------
def ir(sec, seed):
    r = np.random.default_rng(seed); n = int(sec * SR); t = np.arange(n) / SR
    x = r.standard_normal(n) * np.exp(-t / (sec / 5)); return lp(x, 7000) / np.sqrt(np.sum(x ** 2))
send = synth * 0.5 + np.stack([vox, vox]) * 0.35 + np.stack([clap, clap]) * 0.1
rev = np.stack([fftconvolve(send[0], ir(1.8, 1))[:N+TAIL], fftconvolve(send[1], ir(1.8, 2))[:N+TAIL]])

# vox slapback for width
voxL = vox.copy(); voxR = np.zeros_like(vox); d = idx(0.018); voxR[d:] = vox[:-d]
mix = np.zeros((2, N + TAIL))
mix += kick * 0.85 + clap * 0.5 + bass * 0.55 * duck + fx
mix += np.stack([hats * 0.8, hats])
mix += synth * 1.1 * duck
mix += np.stack([voxL, 0.6 * vox + 0.4 * voxR]) * 0.9
mix += rev * 0.3 * duck

out = mix[:, :N].copy(); out[:, :TAIL] += mix[:, N:N+TAIL]
out = hp(out, 25); out = lp(out, 15000)
out = np.tanh(out * 1.25); out /= np.max(np.abs(out)) * 1.12

import wave
with wave.open('party.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out.T * 32767).astype(np.int16).tobytes())
print('done', N / SR)
