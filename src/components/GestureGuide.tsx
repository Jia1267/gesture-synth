import { gestureDigits, gestureLabels, type GestureId } from '../config/gestures'
import type { Settings } from '../config/settings'
import { chordFor, keyLabel, WHITE_KEYS, type KeyName } from '../music/theory'
import type { ActiveGestures } from '../vision/HandTracker'
import { HandIcon } from './HandIcon'

const ORDER: GestureId[] = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'zero']

interface Props {
  keyName: KeyName
  active: ActiveGestures
  settings: Settings
}

/** One row per sign: the chord it plays with the right hand (and the key it selects with the left). */
export function GestureGuide({ keyName, active, settings }: Props) {
  const leftKeys = settings.leftHand === 'key'
  return (
    <section className="guide" aria-label="手势指南" data-left-keys={leftKeys || undefined}>
      <h2 className="guide__title">手势指南</h2>
      {leftKeys && (
        <div className="guide__head" aria-hidden="true">
          <span>左·调</span>
          <span>右·和弦</span>
        </div>
      )}
      <ol className="guide__list">
        {ORDER.map((g) => {
          const digit = gestureDigits[g]
          const key = leftKeys && digit > 0 ? WHITE_KEYS[digit - 1] : null
          const chord = digit > 0 ? chordFor(digit - 1, keyName) : null
          return (
            <li key={g} className="guide__row" data-active={active.right.includes(g) || undefined} title={gestureLabels[g]}>
              {leftKeys && (
                <span className="guide__key" data-current={key === keyName || undefined} data-held={active.left.includes(g) || undefined}>
                  {key && keyLabel(key)}
                </span>
              )}
              <HandIcon gesture={g} className="guide__icon" />
              <span className="guide__chord">{chord ? chord.name : '停'}</span>
              <span className="guide__syllable">{chord ? `${digit} · ${chord.syllable}` : '0'}</span>
              <span className="sr-only">
                {gestureLabels[g]}：{chord ? `右手弹 ${chord.name}` : '右手停'}
                {key ? `，左手换到 ${keyLabel(key)} 调` : ''}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="guide__tips">
        {settings.leftHand === 'voicing' && (
          <>
            左手伸 1 指原位 · 2 指转位 · 3 指七和弦 · 4 指属七 · 拇指伸出低八度
            <br />
          </>
        )}
        {settings.lean && (
          <>
            右手往外倾 → 大三 · 往内倾 → 小三
            <br />
          </>
        )}
        {settings.leftVolume && (
          <>
            左手握拳上下移动 → 音量
            <br />
          </>
        )}
        右手握拳或放松 → 停
      </p>
    </section>
  )
}
