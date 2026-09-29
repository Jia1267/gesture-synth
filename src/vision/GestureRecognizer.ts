import { recognition, type GestureId } from '../config/gestures'

export interface Point3 {
  x: number
  y: number
  z: number
}

const dist = (a: Point3, b: Point3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

/** [MCP, PIP, DIP, TIP] landmark indices for the four fingers. */
const FINGERS = {
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
} as const

const sub = (a: Point3, b: Point3): Point3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const dot = (a: Point3, b: Point3) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Point3, b: Point3): Point3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

/**
 * Thumb tip → pinky knuckle distance measured within the palm plane, so a thumb bent
 * forward over the palm (toward the camera) still counts as folded.
 */
function thumbSpread(p: Point3[]) {
  const normal = cross(sub(p[5], p[0]), sub(p[17], p[0]))
  const v = sub(p[4], p[17])
  const off = dot(v, normal) / dot(normal, normal)
  return Math.hypot(v.x - normal.x * off, v.y - normal.y * off, v.z - normal.z * off)
}

/** Angle in degrees between two vectors. */
function angle(a: Point3, b: Point3) {
  const cos = (a.x * b.x + a.y * b.y + a.z * b.z) / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z))
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
}

/**
 * How far a finger bends away from the palm's direction, in degrees: the angle between its
 * knuckle→tip direction and the wrist→knuckle line. Straight ≈ 10°, clenched > 120°.
 */
function bend(p: Point3[], [mcp, , , tip]: readonly number[]) {
  return angle(sub(p[mcp], p[0]), sub(p[tip], p[mcp]))
}

/**
 * Classify one hand from its 21 world landmarks (metric, camera-orientation independent).
 * Returns null when the pose matches none of the signs — including a relaxed, half-curled
 * hand, which must not pass for a fist because a fist stops the music.
 */
export function classifyGesture(p: Point3[]): GestureId | null {
  const palm = dist(p[0], p[9])
  const bends = [FINGERS.index, FINGERS.middle, FINGERS.ring, FINGERS.pinky].map((f) => bend(p, f))
  const [index, middle, ring, pinky] = bends.map((b) => b < recognition.upMaxDeg)
  const thumbOut = thumbSpread(p) > palm * recognition.thumbOut

  if (index && middle && ring && pinky) return thumbOut ? 'five' : 'four'
  if (pinky && thumbOut && !index && !middle && !ring) return 'six'
  if (index && middle && ring && !pinky) return 'three'
  if (index && middle && !ring && !pinky) return 'two'
  if (index && !middle && !ring && !pinky) return 'one'
  if (bends.every((b) => b > recognition.fistMinDeg)) return 'zero'
  return null
}

/**
 * Turns one hand's per-frame guesses into sign changes.
 * - Unrecognized frames are ignored, so whatever is playing keeps playing (sticky hold).
 * - A new sign takes over once `minFrames` of the last 4 recognized frames agree, spanning
 *   at least `minHoldMs` — one stray frame no longer restarts the wait.
 */
export class GestureStabilizer {
  /** The sign currently in effect. */
  active: GestureId | null = null
  /** What the hand looks like right now, for on-screen feedback; null = can't tell. */
  seen: GestureId | null = null
  private recent: { t: number; g: GestureId }[] = []

  /** Feed one frame. Returns the sign that takes effect on this frame, if any. */
  update(raw: GestureId | null, now: number): GestureId | null {
    this.recent = this.recent.filter((f) => now - f.t < recognition.voteWindowMs)
    if (!raw) {
      if (this.recent.length === 0) this.seen = null
      return null
    }
    this.recent.push({ t: now, g: raw })
    if (this.recent.length > 4) this.recent.shift()
    this.seen = raw
    if (raw === this.active) return null
    const votes = this.recent.filter((f) => f.g === raw)
    if (votes.length < recognition.minFrames || now - votes[0].t < recognition.minHoldMs) return null
    this.active = raw
    return raw
  }
}
