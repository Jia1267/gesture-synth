/**
 * Signs: finger counting 1–5, 🤘 for 6 and 🤟 for 7 (as in the reference instrument), a fist for 0.
 * With 6 = index + pinky, going 1 → 6 only raises the pinky, and 6 ↔ 7 only moves the thumb,
 * so the common 1-6-4-5 changes don't pass through another sign.
 */
export type GestureId = 'one' | 'two' | 'three' | 'four' | 'five' | 'six' | 'seven' | 'zero'

/**
 * The jianpu digit each sign shows. Right hand: 1–7 play the chord on that degree of the key
 * (in C: C Dm Em F G Am B°); 0 — a fist, which is also what a relaxed hand looks like — stops.
 * Left hand (when set to change key): 1–7 switch to C D E F G A B.
 */
export const gestureDigits: Record<GestureId, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  zero: 0,
}

export const gestureLabels: Record<GestureId, string> = {
  one: '1：食指',
  two: '2：食指 + 中指',
  three: '3：食指 + 中指 + 无名指',
  four: '4：四指伸直，拇指折进掌心',
  five: '5：五指张开',
  six: '6：食指 + 小指 🤘',
  seven: '7：拇指 + 食指 + 小指 🤟',
  zero: '0：握拳',
}

/** Recognition thresholds and timing. Tune these against real-hand recordings (?rec). */
export const recognition = {
  /*
   * Thresholds below are set from real-hand ?rec recordings (2026-09-29, ~36–40 fps):
   * straight fingers 5–45°, bent fingers 93–160°, mid-change shapes 63–88°;
   * thumb folded (4, and 3 holding the pinky) ≤ 0.47 palm, thumb out (5) ≥ 1.16.
   */
  /** A finger counts as up when its knuckle→tip direction is within this many degrees of the palm's. */
  upMaxDeg: 60,
  /** For a fist (which stops the music) every finger must bend past this — above mid-change shapes. */
  fistMinDeg: 90,
  /** Thumb-tip to pinky-knuckle distance within the palm plane (palm lengths) above which the thumb is out. */
  thumbOut: 0.8,
  /** A new sign takes over once this many of the last 4 recognized frames agree… */
  minFrames: 3,
  /** …spanning at least this long, so 60 fps cameras don't react to in-between shapes. */
  minHoldMs: 50,
  /** 7 is the rarest chord and sits next to 5 and 6, so it must be held a little longer. */
  rareHoldMs: 150,
  /** Recognized frames older than this no longer vote. */
  voteWindowMs: 250,
  /** Right-hand lean in degrees (+ = toward the player's right, "outward"): past `enter` it forces major/minor… */
  leanEnterDeg: 25,
  /** …and it returns to the key's own chord once back within `exit`. */
  leanExitDeg: 15,
  /** A lean must hold this long before the chord changes. */
  leanDwellMs: 150,
  /** A closed left hand (fist, or holding a mic or phone) must hold this long before it grabs the volume. */
  gripDwellMs: 150,
  /**
   * A left-hand sign must be seen unbroken this long before it changes the key, so a hand that
   * merely opens doesn't (a recorded casual open hand lasted 0.47 s; a deliberate sign 1.76 s).
   */
  keyHoldMs: 1000,
}
