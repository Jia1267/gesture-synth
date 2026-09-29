import { useEffect, useRef } from 'react'

/** Samples shown across the line (~21 ms at 48 kHz). */
const WINDOW = 1024
const POINTS = 220
/** Display-only low-pass: keeps each note's fundamental, drops the spiky harmonics. */
const SMOOTH_HZ = 900

/** A thin gold oscilloscope line. Drifts gently when silent. */
export function WaveformVisualizer({ analyser }: { analyser: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const data = new Float32Array(analyser?.fftSize ?? 0)
    const wave = new Float32Array(WINDOW)
    const k = analyser ? 1 - Math.exp((-2 * Math.PI * SMOOTH_HZ) / analyser.context.sampleRate) : 0
    const gold = getComputedStyle(canvas).getPropertyValue('--gold').trim() || '#f2c14e'
    let glow = 0
    let raf = 0

    const draw = (ms: number) => {
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

      // Start at a rising zero crossing so periodic tones hold still instead of jittering.
      let start = 0
      let peak = 0
      if (analyser) {
        analyser.getFloatTimeDomainData(data)
        for (let i = 1; i < data.length - WINDOW; i++) {
          if (data[i - 1] < 0 && data[i] >= 0) {
            start = i
            break
          }
        }
        // One-pole low-pass run forward then backward (zero phase, so no shift).
        wave[0] = data[start]
        for (let i = 1; i < WINDOW; i++) wave[i] = wave[i - 1] + k * (data[start + i] - wave[i - 1])
        for (let i = WINDOW - 2; i >= 0; i--) wave[i] += k * (wave[i + 1] - wave[i])
        for (let i = 0; i < WINDOW; i++) peak = Math.max(peak, Math.abs(wave[i]))
      }
      glow = Math.max(peak, glow * 0.93)

      const t = ms / 1000
      const mid = H / 2
      const amp = H * 0.42
      const x0 = W * 0.03
      const span = W * 0.94
      const ys: number[] = []
      for (let j = 0; j < POINTS; j++) {
        const u = j / (POINTS - 1)
        const sample = analyser ? wave[Math.round(u * (WINDOW - 1))] : 0
        const idle = Math.sin(u * 9 + t * 0.8) * 1.2 + Math.sin(u * 23 - t * 1.3) * 0.6
        const taper = Math.sin(Math.PI * u) ** 0.8
        ys.push(mid + (Math.max(-1, Math.min(1, sample * 1.8)) * amp + idle) * taper)
      }

      ctx.beginPath()
      ctx.moveTo(x0, ys[0])
      for (let j = 1; j < POINTS - 1; j++) {
        const x = x0 + (j / (POINTS - 1)) * span
        const xNext = x0 + ((j + 1) / (POINTS - 1)) * span
        ctx.quadraticCurveTo(x, ys[j], (x + xNext) / 2, (ys[j] + ys[j + 1]) / 2)
      }
      ctx.lineTo(x0 + span, ys[POINTS - 1])
      ctx.strokeStyle = gold
      ctx.lineWidth = 1.5
      ctx.shadowColor = gold
      ctx.shadowBlur = Math.min(1, glow * 3) * 14
      ctx.globalAlpha = 0.75 + Math.min(0.25, glow)
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [analyser])

  return <canvas ref={canvasRef} className="waveform" aria-hidden="true" />
}
