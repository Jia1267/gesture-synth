/** The 12 major keys, spelled the way jianpu scores usually write them (1=♭E, 1=♯F…). */
export type KeyName = 'C' | 'Db' | 'D' | 'Eb' | 'E' | 'F' | 'F#' | 'G' | 'Ab' | 'A' | 'Bb' | 'B'
export const KEYS: KeyName[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
/** The keys a left-hand sign 1–7 selects. */
export const WHITE_KEYS: KeyName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

export const SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si']

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
/** Semitones above C for each natural letter — also the major-scale intervals. */
const NATURAL = [0, 2, 4, 5, 7, 9, 11]

/** Jianpu-style label: accidental first, e.g. "♭E". */
export const keyLabel = (key: KeyName) => (key[1] === 'b' ? '♭' : key[1] === '#' ? '♯' : '') + key[0]

function keyInfo(key: KeyName) {
  const letter = LETTERS.indexOf(key[0])
  const shift = key[1] === 'b' ? -1 : key[1] === '#' ? 1 : 0
  return { letter, semi: (NATURAL[letter] + shift + 12) % 12 }
}

/** Spell `midi` on a given letter (0–6), e.g. 70 on B → "B♭". */
function spell(midi: number, letter: number) {
  const acc = ((midi % 12) - NATURAL[letter] + 12) % 12
  return LETTERS[letter] + (acc === 1 ? '♯' : acc === 11 ? '♭' : acc === 2 ? '𝄪' : acc === 10 ? '𝄫' : '')
}

export const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

/** How the player's right hand leans: outward forces a major chord, inward a minor one. */
export type Lean = 'none' | 'out' | 'in'

/**
 * How the chord is voiced (left hand, "变和弦" mode — mirrors the reference instrument):
 * smooth = default voice leading; root = root position; inv1 = 1st inversion;
 * seventh = maj7 / m7; dom7 = dominant 7 (°7 on minor chords).
 */
export type Voicing = 'smooth' | 'root' | 'inv1' | 'seventh' | 'dom7'

export interface ChordOptions {
  lean?: Lean
  voicing?: Voicing
  /** One octave lower. */
  low?: boolean
}

export interface Chord {
  /** e.g. "Am", "E", "F♯m", "B°", "Cmaj7", "C/E", "G7". */
  name: string
  /** Jianpu digit 1–7. */
  digit: number
  syllable: string
  /** MIDI notes, low to high. */
  notes: number[]
}

type Quality = 'major' | 'minor' | 'dim'

/** Chord quality on each degree of a major key: I ii iii IV V vi vii°. */
const DIATONIC: Quality[] = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'dim']
const THIRD: Record<Quality, number> = { major: 4, minor: 3, dim: 3 }
const FIFTH: Record<Quality, number> = { major: 7, minor: 7, dim: 6 }
const SUFFIX: Record<Quality, string> = { major: '', minor: 'm', dim: '°' }

/**
 * Fold a note into F3–E4: the chord sits under the singer, and notes shared by two
 * chords stay on the same pitch when the chord changes (smooth voice leading, no search).
 */
const fold = (midi: number) => 53 + ((((midi - 53) % 12) + 12) % 12)

/** The chord on `degree` (0-based) of `key`. */
export function chordFor(degree: number, key: KeyName, { lean = 'none', voicing = 'smooth', low = false }: ChordOptions = {}): Chord {
  const { letter: k, semi } = keyInfo(key)
  // Keep the root between G3 and F♯4 so every key sits in a comfortable range.
  const r = 60 + semi - (semi >= 7 ? 12 : 0) + NATURAL[degree]
  const rootName = spell(r, (k + degree) % 7)
  const q: Quality = lean === 'out' ? 'major' : lean === 'in' ? 'minor' : DIATONIC[degree]
  const [third, fifth] = [THIRD[q], FIFTH[q]]
  const bass = fold(r)

  let notes: number[]
  let name: string
  switch (voicing) {
    case 'root':
      notes = [bass, bass + third, bass + fifth]
      name = rootName + SUFFIX[q]
      break
    case 'inv1': {
      const b = fold(r + third)
      notes = [b, b + fifth - third, b + 12 - third]
      name = `${rootName}${SUFFIX[q]}/${spell(r + third, (k + degree + 2) % 7)}`
      break
    }
    case 'seventh': {
      const seventh = q === 'major' ? 11 : 10
      notes = [bass, bass + third, bass + fifth, bass + seventh]
      name = rootName + (q === 'major' ? 'maj7' : q === 'minor' ? 'm7' : 'ø7')
      break
    }
    case 'dom7':
      // Major chords get the dominant 7th; minor and diminished ones the diminished 7th.
      notes = q === 'major' ? [bass, bass + 4, bass + 7, bass + 10] : [bass, bass + 3, bass + 6, bass + 9]
      name = rootName + (q === 'major' ? '7' : '°7')
      break
    default:
      notes = [r, r + third, r + fifth].map(fold).sort((a, b) => a - b)
      name = rootName + SUFFIX[q]
  }
  if (low) notes = notes.map((n) => n - 12)
  return { name, digit: degree + 1, syllable: SOLFEGE[degree], notes }
}
