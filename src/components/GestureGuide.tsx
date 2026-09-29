import { gestureDigits, gestureLabels, type GestureId, type NoteName } from '../config/gestures'
import { chordFor, KEYS } from '../music/theory'
import type { ActiveGestures } from '../vision/HandTracker'
import { HandIcon } from './HandIcon'

const ORDER: GestureId[] = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'zero']

interface Props {
  keyName: NoteName
  active: ActiveGestures
}

/** One row per sign: the key it selects with the left hand, and the chord it plays with the right. */
export function GestureGuide({ keyName, active }: Props) {
  return (
    <section className="guide" aria-label="手势指南">
      <h2 className="guide__title">手势指南</h2>
      <div className="guide__head" aria-hidden="true">
        <span>左·调</span>
        <span>右·和弦</span>
      </div>
      <ol className="guide__list">
        {ORDER.map((g) => {
          const digit = gestureDigits[g]
          const key = digit > 0 ? KEYS[digit - 1] : null
          const chord = digit > 0 ? chordFor(digit - 1, keyName, 'none') : null
          return (
            <li key={g} className="guide__row" data-active={active.right.includes(g) || undefined} title={gestureLabels[g]}>
              <span className="guide__key" data-current={key === keyName || undefined} data-held={active.left.includes(g) || undefined}>
                {key}
              </span>
              <HandIcon gesture={g} className="guide__icon" />
              <span className="guide__chord">{chord ? chord.name : '停'}</span>
              <span className="guide__syllable">{chord ? `${digit} · ${chord.syllable}` : '0'}</span>
              <span className="sr-only">
                {gestureLabels[g]}：{key ? `左手换到 ${key} 调，` : '左手握拳调音量，'}
                {chord ? `右手弹 ${chord.name}` : '右手停'}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="guide__tips">
        左手握拳上下移动 → 音量
        <br />
        右手往外倾 → 大三 · 往内倾 → 小三
        <br />
        右手握拳或放松 → 停
      </p>
    </section>
  )
}
