# Custom vocal samples

Put recorded syllables here to replace the synthesized voice in the **Voice** sound:

    do.wav  re.wav  mi.wav  fa.wav  sol.wav  la.wav  ti.wav

- Sing each one at its C-major pitch (do = C4, re = D4, mi = E4 … ti = B4).
  The app pitch-shifts them to the selected key.
- Keep them short (≈0.5–1.5 s) and trimmed so the sound starts immediately.
- Any file that is missing falls back to the built-in synthesized vowel.

File names are defined in `src/audio/AudioEngine.ts` (`SAMPLE_NAMES`).
