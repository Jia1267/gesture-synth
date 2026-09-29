/** Chinese finger-counting signs. */
export type GestureId = 'one' | 'two' | 'three' | 'four' | 'five' | 'six' | 'zero'
export type NoteName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

/**
 * The jianpu digit each sign shows. Right hand: 1–6 play the chord on that degree of the
 * current key (in C: 1=C 2=Dm 3=Em 4=F 5=G 6=Am); 0, a fist, is a rest — it stops the chord.
 * Left hand: a fist grabs the volume.
 */
export const gestureDigits: Record<GestureId, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  zero: 0,
}

export const gestureLabels: Record<GestureId, string> = {
  one: '1：食指',
  two: '2：食指 + 中指',
  three: '3：食指 + 中指 + 无名指',
  four: '4：四指伸直，拇指折进掌心',
  five: '5：五指张开',
  six: '6：拇指 + 小指',
  zero: '0：握拳（停）',
}

/** Recognition thresholds and timing. Tune these against real-hand recordings (?rec). */
export const recognition = {
  /**
   * A finger counts as up when its knuckle→tip direction is within this many degrees of the
   * palm's wrist→knuckle direction. Deliberately straight ≈ 10–25°, relaxed/cupped ≈ 50–65°.
   */
  upMaxDeg: 60,
  /** For a fist (which stops the music) every finger must bend past this. Loose curls ≈ 70–90°. */
  fistMinDeg: 95,
  /**
   * Thumb-tip to pinky-knuckle distance within the palm plane (in palm lengths) above which
   * the thumb counts as out. Separates 4 (thumb folded, ≈0.4) from 5 (thumb out, ≈0.9–1.4).
   */
  thumbOut: 0.7,
  /** A new sign takes over once this many of the last 4 recognized frames agree… */
  minFrames: 3,
  /** …spanning at least this long, so 60 fps cameras don't react to in-between shapes. */
  minHoldMs: 50,
  /** Recognized frames older than this no longer vote. */
  voteWindowMs: 250,
  /** Right-hand lean in degrees (+ = toward the player's right, "outward"): past `enter` it forces major/minor… */
  leanEnterDeg: 25,
  /** …and it returns to the key's own chord once back within `exit`. */
  leanExitDeg: 15,
  /** A lean must hold this long before the chord changes. */
  leanDwellMs: 150,
  /** A left fist must hold this long before it grabs the volume. */
  gripDwellMs: 150,
}
