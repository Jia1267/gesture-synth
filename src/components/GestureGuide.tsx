import { gestureLabels, gestureMappings, type GestureId, type NoteName } from '../config/gestures'
import { KEYS, pitchFor, type Pitch } from '../music/theory'
import type { ActiveGestures } from '../vision/HandTracker'
import { HandIcon } from './HandIcon'

interface Props {
  keyName: NoteName
  active: ActiveGestures
}

/** One row per gesture: left column = key it selects (left hand), right = note it plays (right hand). */
export function GestureGuide({ keyName, active }: Props) {
  const gestures = (Object.keys(gestureMappings) as GestureId[]).sort(
    (a, b) => KEYS.indexOf(gestureMappings[a]) - KEYS.indexOf(gestureMappings[b]),
  )
  return (
    <section className="guide" aria-label="Gesture guide">
      <h2 className="guide__title">Gesture guide</h2>
      <div className="guide__head" aria-hidden="true">
        <span>L · key</span>
        <span>R · note</span>
      </div>
      <ol className="guide__list">
        {gestures.map((g) => (
          <GestureItem
            key={g}
            gesture={g}
            keyLetter={gestureMappings[g]}
            isKey={gestureMappings[g] === keyName}
            pitch={pitchFor(gestureMappings[g], keyName)}
            left={active.left.includes(g)}
            right={active.right.includes(g)}
          />
        ))}
      </ol>
    </section>
  )
}

interface ItemProps {
  gesture: GestureId
  keyLetter: NoteName
  isKey: boolean
  pitch: Pitch
  left: boolean
  right: boolean
}

function GestureItem({ gesture, keyLetter, isKey, pitch, left, right }: ItemProps) {
  return (
    <li className="guide__row" data-active={right || undefined} title={gestureLabels[gesture]}>
      <span className="guide__key" data-current={isKey || undefined} data-held={left || undefined}>
        {keyLetter}
      </span>
      <HandIcon gesture={gesture} className="guide__icon" />
      <span className="guide__play">
        <span className="guide__note">{pitch.name}</span>
        <span className="guide__syllable">{pitch.syllable}</span>
      </span>
      <span className="sr-only">
        {gestureLabels[gesture]}: left hand selects key {keyLetter}, right hand plays {pitch.name} {pitch.syllable}
      </span>
    </li>
  )
}
