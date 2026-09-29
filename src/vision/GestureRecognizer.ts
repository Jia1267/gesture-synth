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
 * A finger is extended when it carries on roughly in the palm's direction. Bending at any
 * knuckle swings the knuckle→tip direction away from the wrist→knuckle line, so loosely
 * curled fingers don't pass as extended.
 */
function isExtended(p: Point3[], [mcp, , , tip]: readonly number[]) {
  return angle(sub(p[mcp], p[0]), sub(p[tip], p[mcp])) < recognition.maxBend
}

/**
 * Classify one hand from its 21 world landmarks (metric, camera-orientation independent).
 * Returns null when the pose matches none of the gestures.
 */
export function classifyGesture(p: Point3[]): GestureId | null {
  const palm = dist(p[0], p[9])
  const index = isExtended(p, FINGERS.index)
  const middle = isExtended(p, FINGERS.middle)
  const ring = isExtended(p, FINGERS.ring)
  const pinky = isExtended(p, FINGERS.pinky)
  const thumbOut = thumbSpread(p) > palm * recognition.thumbOut

  if (index && middle && ring && pinky) return thumbOut ? 'five' : 'four'
  if (pinky && thumbOut && !index && !middle && !ring) return 'six'
  if (index && middle && ring && !pinky) return 'three'
  if (index && middle && !ring && !pinky) return 'two'
  if (index && !middle && !ring && !pinky) return 'one'
  if (!index && !middle && !ring && !pinky) return 'zero'
  return null
}

/**
 * Debounces per-frame classifications for one hand. A gesture fires once when it
 * has been held for `stableMs`; it must be released (or changed) before it can fire
 * again, and never faster than `cooldownMs`.
 */
export class GestureStabilizer {
  /** The currently held (latched) gesture. */
  active: GestureId | null = null
  private candidate: GestureId | null = null
  private since = 0
  private lastFired = new Map<GestureId, number>()

  /** Feed one frame. Returns the gesture to trigger on this frame, if any. */
  update(raw: GestureId | null, now: number): GestureId | null {
    if (raw !== this.candidate) {
      this.candidate = raw
      this.since = now
    }
    if (this.candidate === this.active || now - this.since < recognition.stableMs) return null
    this.active = this.candidate
    if (this.active === null) return null
    if (now - (this.lastFired.get(this.active) ?? -Infinity) < recognition.cooldownMs) return null
    this.lastFired.set(this.active, now)
    return this.active
  }
}
