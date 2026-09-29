# Gesture Synth

**Live:** https://jia1267.github.io/gesture-synth/

Play music with your hands. The webcam feed is the instrument: MediaPipe tracks both
hands — the **left hand picks the key**, the **right hand plays the syllables** Do–Ti
of that key, one note per pose, to layer under your singing.

Everything runs in the browser — no backend. Video never leaves the machine.

## Run

```bash
npm install
npm run dev
```

Open the printed localhost URL (camera access needs `localhost` or `https`), click
**Enable Camera**, and raise a hand.

## Gestures

| Gesture            | Left hand: key | Right hand: syllable |
| ------------------ | -------------- | -------------------- |
| Index finger       | C              | Do                   |
| Index + middle     | D              | Re                   |
| Index+middle+ring  | E              | Mi                   |
| Open palm          | F              | Fa                   |
| Closed fist        | G              | Sol                  |
| OK sign            | A              | La                   |
| Thumb + pinky      | B              | Ti                   |

A pose must be held ~180 ms before it counts. The left hand switches the key silently
and the key stays until you pick another one; the right hand plays once per pose —
change pose (or drop your hand) to play again. In key F the right hand plays
F G A B♭ C D E; the guide and the note readout always show the real note names.

Which hand is which comes from MediaPipe's handedness, shown as `L · KEY` / `R · NOTE`
under each wrist. If those tags come out reversed on your camera, set
`SWAP_HANDEDNESS = true` in `src/vision/HandTracker.ts`.

## Configure

- **Gesture → note mapping, timing, thresholds:** `src/config/gestures.ts`
  (`gestureMappings`, `recognition`).
- **Instrument presets:** `src/audio/instruments.ts` (pure Web Audio, no samples).
- **Vocal samples:** drop `do.wav … ti.wav` into `public/audio/` — see the README there.
  Missing files fall back to a synthesized sung vowel.

## Structure

```
src/
  App.tsx                    wiring: camera → tracker → audio → UI
  config/gestures.ts         mappings + recognizer settings
  vision/
    HandTracker.ts           MediaPipe HandLandmarker loop, hand identity, smoothing
    GestureRecognizer.ts     pose classifier + hold/cooldown debouncer
    OneEuroFilter.ts         landmark jitter filter
  audio/
    AudioEngine.ts           mix bus, reverb, analyser, sample loading
    instruments.ts           Voice / Piano / Strings / Synth / Soft Pad
  music/theory.ts            key → pitch spelling, solfège
  components/                CameraView, HandOverlay, ControlPanel, GestureGuide,
                             HandIcon, WaveformVisualizer, CurrentNote, Landing
```

The MediaPipe WASM runtime is bundled from `node_modules`; the hand model
(`hand_landmarker.task`, ~7.5 MB) is fetched once from Google's model storage.
