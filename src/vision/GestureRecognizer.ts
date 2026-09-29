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

function isExtended(p: Point3[], [mcp, pip, dip, tip]: readonly number[]) {
  const path = dist(p[mcp], p[pip]) + dist(p[pip], p[dip]) + dist(p[dip], p[tip])
  const straight = dist(p[mcp], p[tip]) / path > recognition.straightness
  const reaches = dist(p[0], p[tip]) > dist(p[0], p[pip]) * recognition.reachRatio
  return straight && reaches
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
  const pinch = dist(p[4], p[8]) < palm * recognition.pinch
  const thumbOut = dist(p[4], p[9]) > palm * recognition.thumbOut && dist(p[4], p[5]) > palm * 0.5

  if (pinch && middle && ring) return 'ok'
  if (pinky && thumbOut && !index && !middle && !ring) return 'shaka'
  if (index && middle && ring && pinky) return 'openPalm'
  if (index && middle && ring && !pinky) return 'threeFingers'
  if (index && middle && !ring && !pinky) return 'peace'
  if (index && !middle && !ring && !pinky) return 'index'
  if (!index && !middle && !ring && !pinky) return 'fist'
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
