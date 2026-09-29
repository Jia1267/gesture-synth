import type { Pitch } from '../music/theory'

/** Large, quiet readout of the last played note. `hit` restarts the flash on every trigger. */
export function CurrentNote({ pitch, hit }: { pitch: Pitch | null; hit: number }) {
  return (
    <div className="current-note" aria-live="polite">
      {pitch && (
        <div key={hit} className="current-note__inner">
          <span className="current-note__name">{pitch.name}</span>
          <span className="current-note__syllable">· {pitch.syllable}</span>
        </div>
      )}
    </div>
  )
}
