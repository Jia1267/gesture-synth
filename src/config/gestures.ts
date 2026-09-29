/** Chinese finger-counting signs. */
export type GestureId = 'one' | 'two' | 'three' | 'four' | 'five' | 'zero' | 'six'
export type NoteName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

/**
 * One letter per gesture, read differently by each hand:
 * - left hand: selects the key (the "F" gesture switches to F major), silently;
 * - right hand: plays that scale degree in the current key (C = Do … B = Ti),
 *   so in key F the "C" gesture sounds F · Do.
 * Reassign freely — the guide re-orders itself from this object.
 */
export const gestureMappings: Record<GestureId, NoteName> = {
  one: 'C',
  two: 'D',
  three: 'E',
  four: 'F',
  five: 'G',
  zero: 'A',
  six: 'B',
}

export const gestureLabels: Record<GestureId, string> = {
  one: '1 — index finger',
  two: '2 — index + middle',
  three: '3 — index, middle, ring',
  four: '4 — four fingers, thumb folded',
  five: '5 — open hand',
  zero: '0 — fist',
  six: '6 — thumb + pinky',
}

/** Timing and geometry thresholds for the recognizer. */
export const recognition = {
  /**
   * A pose must be seen continuously this long before it counts. Lower = snappier, but
   * in-between shapes while changing pose may slip through as stray notes.
   */
  stableMs: 100,
  /** The same gesture cannot fire again within this window. */
  cooldownMs: 200,
  /**
   * A finger counts as extended when its knuckle→tip direction is within this many degrees
   * of the palm's wrist→knuckle direction. Deliberately straight ≈ 10–25°, loosely curled
   * ≈ 70°+, fist > 120°; a relaxed, cupped hand sits around 50–65°.
   */
  maxBend: 60,
  /**
   * Thumb-tip to pinky-knuckle distance within the palm plane (in palm lengths) above which
   * the thumb counts as out. Separates 4 (thumb folded, ≈0.4) from 5 (thumb out, ≈0.9–1.4).
   */
  thumbOut: 0.7,
}
