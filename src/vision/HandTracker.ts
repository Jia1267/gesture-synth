import { HandLandmarker, type HandLandmarkerResult, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import { recognition, type GestureId } from '../config/gestures'
import type { Lean } from '../music/theory'
import { classifyGesture, GestureStabilizer } from './GestureRecognizer'
import { OneEuroFilter } from './OneEuroFilter'

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
/**
 * Keep a hand (and what it is playing) through tracking dropouts from motion blur or light
 * changes; only after this long out of sight does it count as gone.
 */
const LOST_GRACE_MS = 1000
/** Max wrist travel between frames, in normalized units, to count as the same hand. */
const MATCH_RADIUS = 0.25

/** The player's own left or right hand. The right hand plays; the left hand sets key and volume. */
export type HandRole = 'left' | 'right'
export type ActiveGestures = Record<HandRole, GestureId[]>

export interface TrackedHand {
  id: number
  role: HandRole
  /** Smoothed landmarks in normalized, unmirrored video coordinates. */
  points: { x: number; y: number }[]
  visible: boolean
  /** performance.now() of the last sign this hand triggered. */
  pulseAt: number
  /** The sign in effect, and what the hand looks like right now (null = can't tell). */
  active: GestureId | null
  seen: GestureId | null
  /** Left hand only: a fist is currently holding the volume. */
  gripping: boolean
}

type FrameListener = (result: HandLandmarkerResult, hands: readonly TrackedHand[], now: number) => void

interface Track extends TrackedHand {
  filters: OneEuroFilter[]
  stabilizer: GestureStabilizer
  lastSeen: number
  lean: Lean
  leanPending: { to: Lean; since: number } | null
  gripSince: number | null
  /** Smoothed model vote that this is the player's right hand, 0–1. */
  rightness: number
  /** Left hand: the unbroken run of one raw sign, and the sign whose key was last sent. */
  keyRun: { sign: GestureId; since: number } | null
  keySent: GestureId | null
}

/** Runs MediaPipe on a video element every new frame and turns hands into musical events. */
export class HandTracker {
  /** A hand's sign changed. For the right hand, `lean` is its lean at that moment. */
  onTrigger: (gesture: GestureId, hand: HandRole, lean: Lean) => void = () => {}
  /** The right hand's lean changed. */
  onLean: (lean: Lean) => void = () => {}
  /** The left hand has held a number sign for `keyHoldMs`: switch to that key. */
  onKey: (gesture: GestureId) => void = () => {}
  /** Left fist holding the volume: wrist height (0 = top … 1 = bottom) every frame; null on release. */
  onGrip: (y: number | null) => void = () => {}
  /** A hand that was holding a sign has been out of sight for LOST_GRACE_MS. */
  onLost: (hand: HandRole) => void = () => {}
  onActiveChange: (active: ActiveGestures) => void = () => {}
  onPresenceChange: (present: boolean) => void = () => {}
  private onFrame: FrameListener | null = null
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
          minHandDetectionConfidence: 0.5,
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

  /** Receive every processed frame with its tracks in result order (the ?rec recorder); null stops. */
  listenFrames(listener: FrameListener | null) {
    this.onFrame = listener
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
      const raw = classifyGesture(result.worldLandmarks[i])
      const fired = track.stabilizer.update(raw, now)
      track.active = track.stabilizer.active
      track.seen = track.stabilizer.seen
      this.updateLean(track, now)
      this.updateGrip(track, raw, now)
      this.updateKey(track, raw, now)
      if (fired) {
        track.pulseAt = now
        this.onTrigger(fired, track.role, track.lean)
      }
    })

    for (const track of unmatched) {
      track.visible = false
      this.releaseGrip(track)
    }
    const kept: Track[] = []
    for (const track of this.tracks) {
      if (now - track.lastSeen < LOST_GRACE_MS) kept.push(track)
      else if (track.active) this.onLost(track.role)
    }
    this.tracks = kept

    const visible = this.tracks.filter((t) => t.visible)
    const active: ActiveGestures = { left: [], right: [] }
    for (const t of visible) if (t.active) active[t.role].push(t.active)
    const key = JSON.stringify(active)
    if (key !== this.activeKey) {
      this.activeKey = key
      this.onActiveChange(active)
    }
    if ((visible.length > 0) !== this.present) {
      this.present = visible.length > 0
      this.onPresenceChange(this.present)
    }
    this.onFrame?.(result, seen, now)
  }

  /**
   * Roles come from MediaPipe's Left/Right label, smoothed over frames. On raw webcam frames it
   * reported the true hand in 3053 of 3062 recorded frames (?rec, 2026-09-29). If both hands
   * claim the same side, position decides.
   */
  private assignRoles(hands: Track[]) {
    for (const hand of hands) hand.role = hand.rightness > 0.5 ? 'right' : 'left'
    if (hands.length === 2 && hands[0].role === hands[1].role) {
      // Raw webcam frames are unmirrored, so larger x = further to the player's left.
      const [left, right] = hands[0].points[0].x > hands[1].points[0].x ? hands : [hands[1], hands[0]]
      left.role = 'left'
      right.role = 'right'
    }
  }

  /**
   * A left-hand number sign seen continuously for `keyHoldMs` switches the key (once per hold).
   * Uses this frame's raw shape, not the sticky sign, so a hand that relaxes never commits.
   */
  private updateKey(track: Track, raw: GestureId | null, now: number) {
    if (track.role !== 'left' || !raw || raw === 'zero') {
      track.keyRun = null
      return
    }
    if (track.keyRun?.sign !== raw) {
      track.keyRun = { sign: raw, since: now }
      return
    }
    if (raw === track.keySent || now - track.keyRun.since < recognition.keyHoldMs) return
    track.keySent = raw
    this.onKey(raw)
  }

  /** Right hand leaning past a wide dead zone, held briefly, forces a major or minor chord. */
  private updateLean(track: Track, now: number) {
    if (track.role !== 'right') return
    const { leanEnterDeg: enter, leanExitDeg: exit, leanDwellMs } = recognition
    const deg = this.leanDegrees(track)
    let target = track.lean
    if (deg > enter) target = 'out'
    else if (deg < -enter) target = 'in'
    else if (track.lean === 'out' && deg < exit) target = 'none'
    else if (track.lean === 'in' && deg > -exit) target = 'none'

    if (target === track.lean) {
      track.leanPending = null
    } else if (track.leanPending?.to !== target) {
      track.leanPending = { to: target, since: now }
    } else if (now - track.leanPending.since >= leanDwellMs) {
      track.lean = target
      track.leanPending = null
      this.onLean(target)
    }
  }

  /** Tilt of the wrist→middle-knuckle line from upright, in degrees; + = toward the player's right. */
  private leanDegrees(track: Track) {
    const wrist = track.points[0]
    const knuckle = track.points[9]
    const aspect = this.video.videoWidth / this.video.videoHeight || 1
    // Unmirrored frames: the player's right is toward smaller x.
    return (Math.atan2(-(knuckle.x - wrist.x) * aspect, wrist.y - knuckle.y) * 180) / Math.PI
  }

  /**
   * A clear left fist, held briefly, grabs the volume; opening the hand lets go. Uses this
   * frame's raw shape (not the sticky sign) so relaxing the hand releases at once.
   */
  private updateGrip(track: Track, raw: GestureId | null, now: number) {
    if (track.role !== 'left' || raw !== 'zero') {
      this.releaseGrip(track)
      return
    }
    track.gripSince ??= now
    if (now - track.gripSince < recognition.gripDwellMs) return
    track.gripping = true
    this.onGrip(track.points[0].y)
  }

  private releaseGrip(track: Track) {
    track.gripSince = null
    if (!track.gripping) return
    track.gripping = false
    this.onGrip(null)
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
      points: [],
      visible: true,
      pulseAt: -Infinity,
      active: null,
      seen: null,
      gripping: false,
      filters: Array.from({ length: 42 }, () => new OneEuroFilter()),
      stabilizer: new GestureStabilizer(),
      lastSeen: 0,
      lean: 'none',
      leanPending: null,
      gripSince: null,
      rightness: 0.5,
      keyRun: null,
      keySent: null,
    }
    this.tracks.push(track)
    return track
  }
}
