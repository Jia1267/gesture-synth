import { HandLandmarker, type HandLandmarkerResult, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import type { GestureId } from '../config/gestures'
import { classifyGesture, GestureStabilizer } from './GestureRecognizer'
import { OneEuroFilter } from './OneEuroFilter'

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
/** Keep a hand's identity (and held gesture) through brief tracking dropouts. */
const LOST_GRACE_MS = 300
/** Max wrist travel between frames, in normalized units, to count as the same hand. */
const MATCH_RADIUS = 0.25
/**
 * MediaPipe's docs say Left/Right labels assume a mirrored (selfie-flipped) image, but on raw
 * frames this model (tasks-vision 1.0.1) tested as reporting true handedness. If the L/R tags
 * drawn under each wrist come out reversed on your camera, set this to true.
 */
const SWAP_HANDEDNESS = false

/** The user's own left or right hand. */
export type HandRole = 'left' | 'right'
export type ActiveGestures = Record<HandRole, GestureId[]>

export interface TrackedHand {
  id: number
  role: HandRole
  /** Smoothed landmarks in normalized, unmirrored video coordinates. */
  points: { x: number; y: number }[]
  visible: boolean
  /** performance.now() of the last gesture this hand triggered. */
  pulseAt: number
}

interface Track extends TrackedHand {
  filters: OneEuroFilter[]
  stabilizer: GestureStabilizer
  lastSeen: number
  /** Smoothed model vote that this is a "Right" hand, 0–1. */
  rightness: number
}

/** Runs MediaPipe on a video element every new frame and turns hands into gesture events. */
export class HandTracker {
  onTrigger: (gesture: GestureId, hand: HandRole, handId: number) => void = () => {}
  /** A hand's held gesture ended: it changed pose, relaxed, or left the frame. */
  onRelease: (hand: HandRole, handId: number) => void = () => {}
  onActiveChange: (active: ActiveGestures) => void = () => {}
  onPresenceChange: (present: boolean) => void = () => {}

  private tracks: Track[] = []
  private nextId = 1
  private raf = 0
  private lastVideoTime = -1
  private activeKey = ''
  private present = false
  private landmarker: HandLandmarker
  private video: HTMLVideoElement

  private constructor(landmarker: HandLandmarker, video: HTMLVideoElement) {
    this.landmarker = landmarker
    this.video = video
  }

  static async create(video: HTMLVideoElement) {
    const make = (delegate: 'GPU' | 'CPU') =>
      HandLandmarker.createFromOptions(
        { wasmLoaderPath, wasmBinaryPath },
        {
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        },
      )
    const landmarker = await make('GPU').catch(() => make('CPU'))
    return new HandTracker(landmarker, video)
  }

  get hands(): readonly TrackedHand[] {
    return this.tracks
  }

  start() {
    cancelAnimationFrame(this.raf)
    this.raf = requestAnimationFrame(this.tick)
  }

  stop() {
    cancelAnimationFrame(this.raf)
  }

  private tick = () => {
    this.raf = requestAnimationFrame(this.tick)
    const video = this.video
    if (video.readyState < 2 || video.currentTime === this.lastVideoTime) return
    this.lastVideoTime = video.currentTime
    const now = performance.now()
    this.update(this.landmarker.detectForVideo(video, now), now)
  }

  private update(result: HandLandmarkerResult, now: number) {
    const unmatched = new Set(this.tracks)
    const tSec = now / 1000

    const seen = result.landmarks.map((raw, i) => {
      const track = this.match(raw[0], unmatched) ?? this.createTrack()
      unmatched.delete(track)
      track.lastSeen = now
      track.visible = true
      track.points = raw.map((p, j) => ({
        x: track.filters[j * 2].filter(p.x, tSec),
        y: track.filters[j * 2 + 1].filter(p.y, tSec),
      }))
      const saysRight = result.handedness[i]?.[0]?.categoryName === 'Right' ? 1 : 0
      track.rightness += 0.3 * (saysRight - track.rightness)
      return track
    })
    this.assignRoles(seen)

    seen.forEach((track, i) => {
      const held = track.stabilizer.active
      const fired = track.stabilizer.update(classifyGesture(result.worldLandmarks[i]), now)
      if (held && track.stabilizer.active !== held) this.onRelease(track.role, track.id)
      if (fired) {
        track.pulseAt = now
        this.onTrigger(fired, track.role, track.id)
      }
    })

    for (const track of unmatched) track.visible = false
    const kept: Track[] = []
    for (const track of this.tracks) {
      if (now - track.lastSeen < LOST_GRACE_MS) kept.push(track)
      else if (track.stabilizer.active) this.onRelease(track.role, track.id)
    }
    this.tracks = kept

    const visible = this.tracks.filter((t) => t.visible)
    const active: ActiveGestures = { left: [], right: [] }
    for (const t of visible) if (t.stabilizer.active) active[t.role].push(t.stabilizer.active)
    const key = JSON.stringify(active)
    if (key !== this.activeKey) {
      this.activeKey = key
      this.onActiveChange(active)
    }
    if ((visible.length > 0) !== this.present) {
      this.present = visible.length > 0
      this.onPresenceChange(this.present)
    }
  }

  /**
   * Role comes from the model's (smoothed) handedness, so crossed arms still work. If both
   * hands claim the same side, fall back to position.
   */
  private assignRoles(hands: Track[]) {
    for (const hand of hands) hand.role = hand.rightness > 0.5 !== SWAP_HANDEDNESS ? 'right' : 'left'
    if (hands.length === 2 && hands[0].role === hands[1].role) {
      // Raw webcam frames are unmirrored, so larger x = further to the user's left.
      const [left, right] = hands[0].points[0].x > hands[1].points[0].x ? hands : [hands[1], hands[0]]
      left.role = 'left'
      right.role = 'right'
    }
  }

  private match(wrist: NormalizedLandmark, candidates: Set<Track>) {
    let best: Track | undefined
    let bestDist = MATCH_RADIUS
    for (const track of candidates) {
      const d = Math.hypot(track.points[0].x - wrist.x, track.points[0].y - wrist.y)
      if (d < bestDist) {
        best = track
        bestDist = d
      }
    }
    return best
  }

  private createTrack() {
    const track: Track = {
      id: this.nextId++,
      role: 'right',
      rightness: 0.5,
      points: [],
      visible: true,
      pulseAt: -Infinity,
      filters: Array.from({ length: 42 }, () => new OneEuroFilter()),
      stabilizer: new GestureStabilizer(),
      lastSeen: 0,
    }
    this.tracks.push(track)
    return track
  }
}
