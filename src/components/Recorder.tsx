import { useEffect, useState } from 'react'
import { recognition } from '../config/gestures'
import { classifyGesture } from '../vision/GestureRecognizer'
import type { HandTracker } from '../vision/HandTracker'

const STEPS = [
  { label: '1', say: '右手比 1' },
  { label: '2', say: '右手比 2' },
  { label: '3', say: '右手比 3' },
  { label: '4', say: '右手比 4' },
  { label: '5', say: '右手比 5' },
  { label: '6', say: '右手比 6（食指 + 小指 🤘）' },
  { label: '7', say: '右手比 7（拇指 + 食指 + 小指 🤟）' },
  { label: '0', say: '右手握拳' },
  { label: 'relaxed', say: '右手放松，留在画面里' },
  { label: 'switch', say: '右手弹 1 6 4 5，按平时的速度' },
  { label: 'lean', say: '右手比 1，往外倾、回正、往内倾' },
  { label: 'left-keys', say: '左手在 1–7 之间慢慢换，右手放下' },
  { label: 'left-voicing', say: '左手依次伸 1、2、3、4 根手指，再伸出拇指' },
  { label: 'left-fist', say: '左手握拳（或拿手机）上下移动，右手比 1' },
]
const STEP_MS = 4000
const COUNTDOWN_MS = 3000

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits

/**
 * `?rec`: walks the player through every sign and downloads the raw landmarks as JSON,
 * so thresholds can be set from real hands and replayed as regression tests.
 */
export function Recorder({ tracker }: { tracker: HandTracker }) {
  const [step, setStep] = useState(-1)

  useEffect(() => {
    const frames: unknown[] = []
    let label: string | null = null
    tracker.listenFrames((result, hands, now) => {
      if (!label) return
      frames.push({
        t: Math.round(now),
        label,
        hands: hands.map((hand, i) => ({
          role: hand.role,
          raw: classifyGesture(result.worldLandmarks[i]),
          active: hand.active,
          handedness: result.handedness[i]?.[0]?.categoryName,
          image: result.landmarks[i].map((p) => [round(p.x, 4), round(p.y, 4), round(p.z, 4)]),
          world: result.worldLandmarks[i].map((p) => [round(p.x, 5), round(p.y, 5), round(p.z, 5)]),
        })),
      })
    })

    const timers = STEPS.map((s, i) =>
      window.setTimeout(() => {
        label = s.label
        setStep(i)
      }, COUNTDOWN_MS + i * STEP_MS),
    )
    timers.push(
      window.setTimeout(() => {
        label = null
        setStep(STEPS.length)
        download({ meta: { when: new Date().toISOString(), userAgent: navigator.userAgent, recognition }, frames })
      }, COUNTDOWN_MS + STEPS.length * STEP_MS),
    )
    return () => {
      timers.forEach(clearTimeout)
      tracker.listenFrames(null)
    }
  }, [tracker])

  return (
    <div className="recorder" role="status">
      {step < 0 && <strong>准备录制：跟着提示做手势</strong>}
      {step >= 0 && step < STEPS.length && (
        <>
          <small>
            录制中 {step + 1} / {STEPS.length}
          </small>
          <strong>{STEPS[step].say}</strong>
        </>
      )}
      {step === STEPS.length && <strong>录制完成，JSON 文件已下载，请发给开发者</strong>}
    </div>
  )
}

function download(data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `gesture-rec-${Date.now()}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
