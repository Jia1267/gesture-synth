import type { NoteName } from '../config/gestures'
import type { Chord } from '../music/theory'

/**
 * Quiet readout in the corner: the key (jianpu "1=F") and the chord that is sounding.
 * `hit` restarts the flash on every chord change; the key flashes when it changes.
 */
export function CurrentNote({ keyName, chord, hit }: { keyName: NoteName; chord: Chord | null; hit: number }) {
  return (
    <div className="current-note" aria-live="polite">
      <div key={keyName} className="current-note__key">1={keyName}</div>
      {chord && (
        <div key={hit} className="current-note__inner">
          <span className="current-note__name">{chord.name}</span>
          <span className="current-note__syllable">{chord.digit} · {chord.syllable}</span>
        </div>
      )}
    </div>
  )
}
