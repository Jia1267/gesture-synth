export type GestureId = 'index' | 'peace' | 'threeFingers' | 'openPalm' | 'fist' | 'ok' | 'shaka'
export type NoteName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

/**
 * One letter per gesture, read differently by each hand:
 * - left hand: selects the key (the "F" gesture switches to F major), silently;
 * - right hand: plays that scale degree in the current key (C = Do … B = Ti),
 *   so in key F the "C" gesture sounds F · Do.
 * Reassign freely — the guide re-orders itself from this object.
 */
export const gestureMappings: Record<GestureId, NoteName> = {
  index: 'C',
  peace: 'D',
  threeFingers: 'E',
  openPalm: 'F',
  fist: 'G',
  ok: 'A',
  shaka: 'B',
}

export const gestureLabels: Record<GestureId, string> = {
  index: 'Index finger',
  peace: 'Index + middle',
  threeFingers: 'Three fingers',
  openPalm: 'Open palm',
  fist: 'Closed fist',
  ok: 'OK sign',
  shaka: 'Thumb + pinky',
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
  /** Finger is "extended" when MCP→tip distance / finger path length exceeds this. */
  straightness: 0.8,
  /** …and the tip is this much farther from the wrist than the PIP joint. */
  reachRatio: 1.1,
  /** Thumb-tip to index-tip distance (in palm lengths) that counts as a pinch. */
  pinch: 0.3,
  /** Thumb-tip to middle-knuckle distance (in palm lengths) that counts as "thumb out". */
  thumbOut: 0.75,
}
