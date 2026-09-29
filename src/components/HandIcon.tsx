import { useId } from 'react'
import type { GestureId } from '../config/gestures'

type Finger = 'index' | 'middle' | 'ring' | 'pinky'

interface Pose {
  up: Finger[]
  thumb: 'out' | 'in'
  /** Thumb and index meet in a ring. */
  ring?: boolean
}

const POSES: Record<GestureId, Pose> = {
  index: { up: ['index'], thumb: 'in' },
  peace: { up: ['index', 'middle'], thumb: 'in' },
  threeFingers: { up: ['index', 'middle', 'ring'], thumb: 'in' },
  openPalm: { up: ['index', 'middle', 'ring', 'pinky'], thumb: 'out' },
  fist: { up: [], thumb: 'in' },
  ok: { up: ['middle', 'ring', 'pinky'], thumb: 'out', ring: true },
  shaka: { up: ['pinky'], thumb: 'out' },
}

/** [baseX, baseY, tipX, tipY, foldedTipY, width] in a 32×32 box, palm facing the viewer. */
const FINGERS: Record<Finger, [number, number, number, number, number, number]> = {
  index: [11, 17, 9.2, 5.2, 13.2, 3.1],
  middle: [15, 17, 15, 3.6, 12.6, 3.1],
  ring: [19, 17, 20.6, 5.2, 13.2, 3.1],
  pinky: [22.6, 18, 25.6, 8.6, 14.4, 2.7],
}

const PALM = { x: 8.6, y: 14.6, width: 15.8, height: 11.4, rx: 3.6 }

/** Silhouette of a hand pose, drawn in currentColor. */
export function HandIcon({ gesture, className }: { gesture: GestureId; className?: string }) {
  const clipId = useId()
  const pose = POSES[gesture]
  const fingers = (Object.keys(FINGERS) as Finger[]).filter((f) => !(pose.ring && f === 'index'))

  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" strokeLinecap="round" fill="none">
      {fingers.map((f) => {
        const [bx, by, tx, ty, foldedY, w] = FINGERS[f]
        const up = pose.up.includes(f)
        return <line key={f} x1={bx} y1={by} x2={up ? tx : bx} y2={up ? ty : foldedY} stroke="currentColor" strokeWidth={w} />
      })}

      {pose.thumb === 'out' &&
        (pose.ring ? (
          <line x1={10.6} y1={22} x2={6.4} y2={15.6} stroke="currentColor" strokeWidth={3} />
        ) : (
          <line x1={11.5} y1={23} x2={4.2} y2={15.4} stroke="currentColor" strokeWidth={3.3} />
        ))}
      {pose.ring && <circle cx={7.6} cy={12.2} r={3.4} stroke="currentColor" strokeWidth={2.6} />}

      <rect {...PALM} fill="currentColor" />
      <rect x={11.2} y={24} width={10.4} height={6} rx={1.6} fill="currentColor" />

      {/* Thumb folded across the palm: it grows out of the palm's lower-left edge, and a
          palm-clipped outline separates it from the palm only where they overlap. */}
      {pose.thumb === 'in' && (
        <>
          <clipPath id={clipId}>
            <rect {...PALM} />
          </clipPath>
          <line
            x1={6.6} y1={26.2} x2={17.6} y2={19.8}
            stroke="var(--icon-cut)" strokeWidth={5} clipPath={`url(#${clipId})`}
          />
          <line x1={6.6} y1={26.2} x2={17.6} y2={19.8} stroke="currentColor" strokeWidth={3.3} />
        </>
      )}
    </svg>
  )
}
