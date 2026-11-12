"""An original late-90s boy-band-style pop loop, synthesised from scratch.

Usage: python3 make_boyband.py out.wav
Everything here (melody, rhythm, sounds) is written for this site; the chord loop is the
everyday vi-IV-I-V. Structure: 4-bar intro, 8-bar hook in A minor, 2-bar break with a
snare roll, the obligatory key change up a tone, the hook again in B minor, 2-bar ending.
"""
import sys
import numpy as np
from scipy.signal import butter, lfilter, sawtooth, square
from scipy.io import wavfile

SR = 44100
BPM = 112
BEAT = 60.0 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(1999)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12.0)


def env(n, a=0.005, d=0.1, s=0.7, r=0.05, length=None):
    """ADSR envelope over n samples; the note is held for `length` seconds before release."""
    length = n / SR - r if length is None else length
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-6), 1.0)
    e = np.where((t >= a) & (t < a + d), 1 - (1 - s) * (t - a) / max(d, 1e-6), e)
    e = np.where((t >= a + d) & (t < length), s, e)
    e = np.where(t >= length, s * np.clip(1 - (t - length) / max(r, 1e-6), 0, 1), e)
    return e


def lowpass(x, cutoff, order=2):
    b, a = butter(order, min(cutoff / (SR / 2), 0.99), 'low')
    return lfilter(b, a, x)


def highpass(x, cutoff, order=2):
    b, a = butter(order, cutoff / (SR / 2), 'high')
    return lfilter(b, a, x)


class Track:
    def __init__(self, seconds):
        self.n = int(seconds * SR) + SR
        self.l = np.zeros(self.n)
        self.r = np.zeros(self.n)

    def add(self, sig, at, gain=1.0, pan=0.0):
        i = int(at * SR)
        j = min(self.n, i + len(sig))
        self.l[i:j] += sig[:j - i] * gain * (1 - max(pan, 0))
        self.r[i:j] += sig[:j - i] * gain * (1 + min(pan, 0))


# ---- instruments ----

def kick():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    f = 45 + 95 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def clap():
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    noise = highpass(rng.standard_normal(n), 900)
    bursts = np.exp(-t * 18) + 0.6 * np.exp(-np.maximum(t - 0.012, 0) * 60) * (t > 0.012)
    return noise * bursts * 0.5 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.3


def hat(open_=False):
    n = int((0.22 if open_ else 0.05) * SR)
    t = np.arange(n) / SR
    return highpass(rng.standard_normal(n), 7000) * np.exp(-t * (9 if open_ else 70))


def bass(midi, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = sawtooth(2 * np.pi * hz(midi) * t) + 0.5 * square(2 * np.pi * hz(midi - 12) * t)
    return lowpass(x, 700) * env(n, 0.004, 0.08, 0.6, 0.03)


def supersaw(midis, dur, cutoff=3200):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for m in midis:
        for cents in (-14, 0, 13):
            x += sawtooth(2 * np.pi * hz(m) * 2 ** (cents / 1200) * t + rng.uniform(0, 6.28))
    return lowpass(x / (3 * len(midis)), cutoff)


def stab(midis):
    n = int(0.32 * SR)
    return supersaw(midis, 0.32, 3600) * env(n, 0.003, 0.18, 0.2, 0.08)


def pad(midis, dur):
    n = int(dur * SR)
    return supersaw(midis, dur, 1400) * env(n, 0.25, 0.4, 0.8, 0.3)


def lead(midi, dur):
    """A bright pulse with delayed vibrato: the 'singer'."""
    n = int((dur + 0.08) * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.6 * t) * np.clip((t - 0.15) / 0.2, 0, 1)
    phase = 2 * np.pi * np.cumsum(hz(midi) * vib) / SR
    x = 0.6 * square(phase, duty=0.32) + 0.4 * sawtooth(phase)
    return lowpass(x, 4200) * env(n, 0.01, 0.12, 0.75, 0.08, length=dur)


# ---- the score ----

A, B, C, D, E, F, G = 57, 59, 60, 62, 64, 65, 67   # notes in the octave below middle-A
CHORDS = [  # vi - IV - I - V in C (A minor feel): root and triad
    (45, [57, 60, 64]),   # Am
    (41, [57, 60, 65]),   # F
    (48, [55, 60, 64]),   # C
    (43, [55, 59, 62]),   # G
]
# hook melody, one list per bar: (midi, start beat, length in beats)
HOOK = [
    [(76, 0, .5), (76, .5, .5), (79, 1, .75), (76, 1.75, .25), (74, 2, .5), (72, 2.5, 1)],
    [(72, 0, .5), (69, .5, .5), (72, 1, .5), (74, 1.5, 1), (72, 2.5, .5), (69, 3, 1)],
    [(67, 0, .5), (72, .5, .5), (76, 1, 1), (74, 2, .5), (76, 2.5, .5), (79, 3, 1)],
    [(81, 0, .75), (79, .75, .75), (76, 1.5, .5), (74, 2, 2)],
    [(76, 0, .5), (76, .5, .5), (79, 1, .75), (76, 1.75, .25), (81, 2, .5), (79, 2.5, 1)],
    [(77, 0, .5), (76, .5, .5), (74, 1, .5), (72, 1.5, 1), (74, 2.5, .5), (76, 3, 1)],
    [(79, 0, 1), (76, 1, .5), (72, 1.5, .5), (74, 2, 1), (76, 3, 1)],
    [(74, 0, .5), (71, .5, .5), (74, 1, 1), (74, 2, 2)],
]
STAB_BEATS = [0, 0.75, 1.5, 2.5, 3.25]


def bar_of_band(tr, start, chord, shift, drums=True, stabs=True, bass_on=True, pad_on=True, kick_on=True):
    root, triad = chord
    triad = [m + shift for m in triad]
    if pad_on:
        tr.add(pad(triad, BAR), start, 0.16)
    if stabs:
        for b in STAB_BEATS:
            tr.add(stab(triad + [triad[0] + 12]), start + b * BEAT, 0.34)
    if bass_on:
        for i in range(8):
            m = root + shift + (12 if i in (3, 7) else 0)
            tr.add(bass(m, BEAT / 2 * 0.9), start + i * BEAT / 2, 0.42)
    if drums:
        for b in range(4):
            if kick_on:
                tr.add(kick(), start + b * BEAT, 0.9)
            if b in (1, 3):
                tr.add(clap(), start + b * BEAT, 0.55)
            tr.add(hat(open_=True), start + (b + 0.5) * BEAT, 0.12, pan=0.3)
        for s in range(16):
            tr.add(hat(), start + s * BEAT / 4, 0.07 if s % 2 else 0.1, pan=-0.3)


def melody(tr, start, bar_notes, shift):
    for midi, at, length in bar_notes:
        note = lead(midi + shift, length * BEAT * 0.95)
        t0 = start + at * BEAT
        tr.add(note, t0, 0.32)
        tr.add(note, t0 + 0.75 * BEAT, 0.12, pan=-0.6)   # echoes, either side
        tr.add(note, t0 + 1.5 * BEAT, 0.06, pan=0.6)


def main(out):
    bars = 4 + 8 + 2 + 8 + 2
    tr = Track(bars * BAR + 1.0)
    t = 0.0
    # intro: pad and stabs, then the beat comes in
    for i in range(4):
        bar_of_band(tr, t, CHORDS[i % 4], 0, drums=i >= 2, bass_on=i >= 2, kick_on=i >= 2)
        t += BAR
    # the hook
    for i in range(8):
        bar_of_band(tr, t, CHORDS[i % 4], 0)
        melody(tr, t, HOOK[i], 0)
        t += BAR
    # break: just the pad on F and G, a snare roll and a rising noise
    for i, chord in enumerate([CHORDS[1], CHORDS[3]]):
        bar_of_band(tr, t, chord, 0, drums=False, stabs=False, bass_on=False)
        if i == 1:
            for s in range(16):
                tr.add(clap(), t + s * BEAT / 4, 0.15 + 0.4 * s / 16)
        t += BAR
    n = int(2 * BAR * SR)
    riser = highpass(rng.standard_normal(n), 2000) * np.linspace(0, 1, n) ** 2
    tr.add(riser, t - 2 * BAR, 0.18)
    # the key change, up a whole tone
    for i in range(8):
        bar_of_band(tr, t, CHORDS[i % 4], 2)
        melody(tr, t, HOOK[i], 2)
        t += BAR
    # ending: one big hit, then the pad rings on
    root, triad = CHORDS[0]
    tr.add(stab([m + 2 for m in triad] + [triad[0] + 14]), t, 0.5)
    tr.add(kick(), t, 1.0)
    tr.add(pad([m + 2 for m in triad], 2 * BAR), t, 0.2)

    mix = np.stack([tr.l, tr.r], axis=1)[: int((bars * BAR + 0.2) * SR)]
    mix = np.tanh(1.3 * mix / np.max(np.abs(mix)))        # glue it together
    mix = mix / np.max(np.abs(mix)) * 0.89
    wavfile.write(out, SR, (mix * 32767).astype(np.int16))
    print(out, round(len(mix) / SR, 1), 'seconds')


if __name__ == '__main__':
    main(sys.argv[1])
