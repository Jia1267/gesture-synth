import { useEffect, useRef, type RefObject } from 'react'
import type { HandTracker } from '../vision/HandTracker'

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
]
const TIPS = new Set([4, 8, 12, 16, 20])
const PULSE_MS = 180

interface Props {
  tracker: HandTracker | null
  videoRef: RefObject<HTMLVideoElement | null>
}

/**
 * Draws landmarks in unmirrored video space; the canvas shares the video's box and
 * mirror transform, so the dots stay locked to the hand under object-fit: cover.
 */
export function HandOverlay({ tracker, videoRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!tracker || !canvas || !ctx) return
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const dpr = Math.min(devicePixelRatio, 2)
      const W = canvas.clientWidth
      const H = canvas.clientHeight
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr)
        canvas.height = Math.round(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const video = videoRef.current
      if (!video?.videoWidth) return
      const scale = Math.max(W / video.videoWidth, H / video.videoHeight)
      const dw = video.videoWidth * scale
      const dh = video.videoHeight * scale
      const ox = (W - dw) / 2
      const oy = (H - dh) / 2
      const now = performance.now()

      for (const hand of tracker.hands) {
        if (!hand.visible || hand.points.length === 0) continue
        const pts = hand.points.map((p) => [ox + p.x * dw, oy + p.y * dh])
        const pulse = Math.max(0, 1 - (now - hand.pulseAt) / PULSE_MS)
        const grow = reducedMotion ? 1 : 1 + 0.7 * pulse

        ctx.lineWidth = 1
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + 0.35 * pulse})`
        ctx.beginPath()
        for (const [a, b] of CONNECTIONS) {
          ctx.moveTo(pts[a][0], pts[a][1])
          ctx.lineTo(pts[b][0], pts[b][1])
        }
        ctx.stroke()

        // Soft halo, then the crisp dot.
        ctx.fillStyle = pulse > 0 ? `rgba(242, 193, 78, ${0.2 + 0.35 * pulse})` : 'rgba(255, 255, 255, 0.16)'
        circles(ctx, pts, (i) => (TIPS.has(i) ? 4.5 : 3.5) * 2.3 * grow)
        ctx.fillStyle = '#fff'
        circles(ctx, pts, (i) => (TIPS.has(i) ? 4.5 : 3.5) * grow)

        // Role tag under the wrist, un-mirrored so it reads correctly.
        ctx.save()
        ctx.translate(pts[0][0], pts[0][1] + 22)
        ctx.scale(-1, 1)
        ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace'
        ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
        ctx.fillText(hand.role === 'left' ? 'L · KEY' : 'R · NOTE', 0, 0)
        ctx.restore()
      }
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [tracker, videoRef])

  return <canvas ref={canvasRef} className="camera__overlay" />
}

function circles(ctx: CanvasRenderingContext2D, pts: number[][], radius: (i: number) => number) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => {
    const r = radius(i)
    ctx.moveTo(x + r, y)
    ctx.arc(x, y, r, 0, Math.PI * 2)
  })
  ctx.fill()
}
