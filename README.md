# Gesture Synth

**Live:** https://jia1267.github.io/gesture-synth/

Accompany your own singing with your hands. The webcam is the instrument: the **right
hand** shows jianpu digits 1–7 and plays that chord of the key. The **left hand** is free
by default, or — your choice in 设置 — changes the key or reshapes the chord, and a closed
left hand drags the volume. If you can say "1-6-4-5", you can play it.

The music theory follows the reference instrument (Eric Wei's Gesture Synth): seven
diatonic chords, lean for major/minor, root position / 1st inversion / 7th / dominant 7th,
and an octave switch — with the hands mirrored (his left hand plays the degrees; ours is
the right).

Everything runs in the browser — no backend. Video never leaves the machine.

## Run

```bash
npm install
npm run dev
```

Open the printed localhost URL (camera access needs `localhost` or `https`), click
**开启摄像头**, and raise your right hand.

## Playing

Pick one of the 12 keys on the panel's piano. Then, with the **right hand**:

| Sign | Hand shape                          | Plays (key of C) | Left hand in 换调 mode |
| ---- | ----------------------------------- | ---------------- | ---------------------- |
| 1    | index finger                        | C  (1 · Do)      | 1=C                    |
| 2    | index + middle                      | Dm (2 · Re)      | 1=D                    |
| 3    | index + middle + ring               | Em (3 · Mi)      | 1=E                    |
| 4    | four fingers, thumb folded in palm  | F  (4 · Fa)      | 1=F                    |
| 5    | open hand, thumb out                | G  (5 · Sol)     | 1=G                    |
| 6    | index + pinky (🤘)                  | Am (6 · La)      | 1=A                    |
| 7    | thumb + index + pinky (🤟)          | B° (7 · Si)      | 1=B                    |
| 0    | fist                                | stop             | —                      |

6 and 7 are the reference instrument's shapes: 1 → 6 only raises the pinky and 6 ↔ 7 only
moves the thumb, so the common changes don't pass through another sign. 7 must be held
0.15 s (the others 0.05 s) so a 🤟 flashed mid-change doesn't sound.

- **Lean the right hand** outward (to your right) for a major chord, inward for minor:
  3 → E, 4 → Fm, 7 → B or Bm. Upright plays the key's own chord.
- A chord keeps sounding until you show another sign, make a fist (a relaxed hand looks
  the same to the camera, so relaxing also stops), or keep the hand out of view for about
  a second. Shapes the camera can't read change nothing.
- Under the right wrist is what the camera reads: gold = playing, white = about to play,
  `?` = hold your fingers clearly straight or clearly folded.

### 设置 (settings, remembered per browser)

**左手用途 — what the left hand does:**

- **不用** (default): nothing — free to hold a mic, a phone, or rest.
- **换调**: show 1–7 unbroken for 1 s to switch to C D E F G A B (a bar under the
  wrist fills, then `1=G` turns gold). Works mid-song too.
- **变和弦** (the reference instrument's other hand): count of raised fingers shapes the
  chord — 1 root position, 2 1st inversion (C/E), 3 7th (Cmaj7 / Am7), 4 dominant 7th (G7;
  minor chords get °7). Thumb out plays an octave lower. Shared notes keep ringing when the
  shape changes.

**左手握拳调音量** (on by default): a closed left hand — fist, or holding a mic or phone —
moved up or down drags the volume. If the hand drops out of frame, the last half second
of dragging is undone.

**右手倾斜切大小三** (on by default): the lean above.

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
