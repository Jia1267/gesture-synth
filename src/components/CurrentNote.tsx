import type { Chord } from '../music/theory'

/** Large, quiet readout of the chord that is sounding. `hit` restarts the flash on every change. */
export function CurrentNote({ chord, hit }: { chord: Chord | null; hit: number }) {
  return (
    <div className="current-note" aria-live="polite">
      {chord && (
        <div key={hit} className="current-note__inner">
          <span className="current-note__name">{chord.name}</span>
          <span className="current-note__syllable">{chord.digit} · {chord.syllable}</span>
        </div>
      )}
    </div>
  )
}
