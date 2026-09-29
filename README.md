# Gesture Synth

**Live:** https://jia1267.github.io/gesture-synth/

Accompany your own singing with your hands. The webcam is the instrument: the **right
hand** shows jianpu digits 1–7 and plays that chord of the key; the **left hand** shows a
digit to change the key and makes a fist to drag the volume. If you can say "1-6-4-5",
you can play it.

Everything runs in the browser — no backend. Video never leaves the machine.

## Run

```bash
npm install
npm run dev
```

Open the printed localhost URL (camera access needs `localhost` or `https`), click
**开启摄像头**, and raise your right hand.

## Playing

Signs are Chinese finger counting, plus 🤟 for 7:

| Sign | Hand shape                          | Left hand: key | Right hand plays (key of C) |
| ---- | ----------------------------------- | -------------- | --------------------------- |
| 1    | index finger                        | C              | C  (1 · Do)                 |
| 2    | index + middle                      | D              | Dm (2 · Re)                 |
| 3    | index + middle + ring               | E              | Em (3 · Mi)                 |
| 4    | four fingers, thumb folded in palm  | F              | F  (4 · Fa)                 |
| 5    | open hand, thumb out                | G              | G  (5 · Sol)                |
| 6    | thumb + pinky                       | A              | Am (6 · La)                 |
| 7    | thumb + index + pinky (🤟)          | B              | B° (7 · Si)                 |
| 0    | fist                                | drag volume    | stop                        |

- **Left hand** — hold a sign for half a second to switch key (the wrist shows `1=G` in
  white, then gold once switched). The key buttons in the panel do the same. A fist moved
  up or down drags the volume; open the hand to let go. The left hand never plays.
- **Right hand** — lean outward (to your right) for a major chord, inward for minor:
  3 → E instead of Em, 4 → Fm instead of F, 7 → B or Bm. Upright plays the key's own
  chord; while a chord rings, leaning re-voices only the notes that change.
- A chord keeps sounding until you show another sign, make a fist (a relaxed hand looks
  the same to the camera, so relaxing also stops), or keep the hand out of view for about
  a second. Shapes the camera can't read change nothing.
- Under the right wrist is what the camera reads: gold = playing, white = about to play,
  `?` = hold your fingers clearly straight or clearly folded.
- 🤟 sits between 1 and 6, so switch between those two briskly or a B° slips in.

Which hand is which comes from MediaPipe's Left/Right label (correct on 3053 of 3062
recorded frames); if both hands claim the same side, position decides.

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
