# Gesture Synth

**Live:** https://jia1267.github.io/gesture-synth/

Accompany your own singing with your hands. The webcam is the instrument: the **right
hand** shows jianpu digits 1–6 and plays that chord of the key, the **left hand** holds
the volume. If you can say "1-6-4-5", you can play it.

Everything runs in the browser — no backend. Video never leaves the machine.

## Run

```bash
npm install
npm run dev
```

Open the printed localhost URL (camera access needs `localhost` or `https`), click
**开启摄像头**, and raise your right hand.

## Playing

Pick the key in the panel. Then, with the right hand (Chinese finger-counting signs):

| Sign | Hand shape                          | Plays (key of C) |
| ---- | ----------------------------------- | ---------------- |
| 1    | index finger                        | C  (1 · Do)      |
| 2    | index + middle                      | Dm (2 · Re)      |
| 3    | index + middle + ring               | Em (3 · Mi)      |
| 4    | four fingers, thumb folded in palm  | F  (4 · Fa)      |
| 5    | open hand, thumb out                | G  (5 · Sol)     |
| 6    | thumb + pinky                       | Am (6 · La)      |
| 0    | fist                                | stop             |

- **Lean the right hand** outward (to your right) to make the chord major, inward to make
  it minor — e.g. 3 → E instead of Em, 4 → Fm instead of F. Upright plays the key's own
  chord. While a chord rings, leaning changes only its third.
- **Left fist, moved up or down**, drags the volume; open the hand to let go.
- A chord keeps sounding until you show another sign, make a fist, or keep your hand out
  of view for about a second. Shapes the camera can't read change nothing.
- The digit under your right wrist is what the camera reads: gold = playing, white =
  about to play, `?` = hold your fingers clearly straight or clearly folded.

With one hand in view it is the playing hand; with two, the one on your left holds the
volume.

## Tuning recognition with your own hands

Open the site with `?rec` at the end of the URL (e.g.
`https://jia1267.github.io/gesture-synth/?rec`). After the camera starts it prompts each
sign for 4 seconds, then downloads `gesture-rec-*.json` with the raw hand landmarks —
use it to set the thresholds in `src/config/gestures.ts` (`recognition`).

## Structure

```
src/
  App.tsx                    wiring: camera → tracker → chords / volume → UI
  config/gestures.ts         sign → digit, recognition thresholds and timing
  vision/
    HandTracker.ts           MediaPipe loop, hand identity + roles, lean, volume grip
    GestureRecognizer.ts     sign classifier + voting, sticky stabilizer
    OneEuroFilter.ts         landmark jitter filter
  audio/
    AudioEngine.ts           mix bus, reverb, volume, analyser
    instruments.ts           Voice / Piano / Strings / Synth / Soft Pad
  music/theory.ts            key spelling, chords and voicing
  components/                CameraView, HandOverlay, ControlPanel, GestureGuide,
                             HandIcon, WaveformVisualizer, CurrentNote, Landing, Recorder
```

The MediaPipe WASM runtime is bundled from `node_modules`; the hand model
(`hand_landmarker.task`, ~7.5 MB) is fetched once from Google's model storage.
