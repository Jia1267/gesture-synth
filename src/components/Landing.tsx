/** An open hand as 21 tracking landmarks — the same language as the live overlay. */
const HAND = [
  [50, 96], [36, 88], [26, 76], [19, 65], [13, 55],
  [38, 56], [35, 40], [33, 30], [31, 21],
  [50, 54], [50, 36], [50, 25], [50, 15],
  [61, 56], [64, 40], [66, 30], [68, 22],
  [71, 61], [76, 49], [80, 41], [83, 33],
]
const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
]

interface Props {
  hidden: boolean
  starting: boolean
  error: string
  onEnable: () => void
}

export function Landing({ hidden, starting, error, onEnable }: Props) {
  return (
    <main className="landing" data-hidden={hidden} inert={hidden}>
      <svg className="landing__hand" viewBox="0 0 100 100" aria-hidden="true">
        {BONES.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={HAND[a][0]} y1={HAND[a][1]} x2={HAND[b][0]} y2={HAND[b][1]} />
        ))}
        {HAND.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 4 === 0 && i > 0 ? 2.2 : 1.8} />
        ))}
      </svg>
      <h1 className="landing__title">Gesture Synth</h1>
      <p className="landing__tagline">Play music with your hands.</p>
      <button type="button" className="landing__cta" onClick={onEnable} disabled={starting}>
        {starting ? 'Starting camera…' : 'Enable Camera'}
      </button>
      <p className="landing__error" role="alert">{error}</p>
      <p className="landing__note">Your camera is processed locally in your browser.</p>
    </main>
  )
}
