import { keyLabel, type Chord, type KeyName } from '../music/theory'

interface Props {
  keyName: KeyName
  chord: Chord | null
  /** Played one octave lower (left-hand thumb out). */
  low: boolean
  /** Restarts the flash on every chord change. */
  hit: number
}

/** Quiet readout in the corner: the key (jianpu "1=♭E") and the chord that is sounding. */
export function CurrentNote({ keyName, chord, low, hit }: Props) {
  return (
    <div className="current-note" aria-live="polite">
      <div key={keyName} className="current-note__key">1={keyLabel(keyName)}</div>
      {chord && (
        <div key={hit} className="current-note__inner">
          <span className="current-note__name">{chord.name}</span>
          <span className="current-note__syllable">
            {chord.digit} · {chord.syllable}
            {low && ' · 低八度'}
          </span>
        </div>
      )}
    </div>
  )
}
