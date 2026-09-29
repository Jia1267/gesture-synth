import { gestureDigits, gestureLabels, type GestureId, type NoteName } from '../config/gestures'
import { chordFor } from '../music/theory'
import { HandIcon } from './HandIcon'

const ORDER: GestureId[] = ['one', 'two', 'three', 'four', 'five', 'six', 'zero']

interface Props {
  keyName: NoteName
  /** Signs the right hand is holding right now. */
  active: GestureId[]
}

/** Right-hand sign → the chord it plays in the current key. */
export function GestureGuide({ keyName, active }: Props) {
  return (
    <section className="guide" aria-label="手势指南">
      <h2 className="guide__title">手势指南</h2>
      <ol className="guide__list">
        {ORDER.map((g) => {
          const digit = gestureDigits[g]
          const chord = digit > 0 ? chordFor(digit - 1, keyName, 'none') : null
          return (
            <li key={g} className="guide__row" data-active={active.includes(g) || undefined} title={gestureLabels[g]}>
              <HandIcon gesture={g} className="guide__icon" />
              <span className="guide__chord">{chord ? chord.name : '停'}</span>
              <span className="guide__syllable">{chord ? `${digit} · ${chord.syllable}` : '0'}</span>
              <span className="sr-only">{gestureLabels[g]}</span>
            </li>
          )
        })}
      </ol>
      <p className="guide__tips">
        右手往外倾 → 大三 · 往内倾 → 小三
        <br />
        左手握拳上下移动 → 音量
      </p>
    </section>
  )
}
