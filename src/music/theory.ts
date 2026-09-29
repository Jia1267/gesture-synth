import type { NoteName } from '../config/gestures'

export const KEYS: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
export const SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si']

/** Semitones above C for each natural letter — also the major-scale intervals. */
const NATURAL = [0, 2, 4, 5, 7, 9, 11]

export interface Pitch {
  /** Spelled note name in the current key, e.g. "B♭". */
  name: string
  syllable: string
  midi: number
}

/** Resolve a C-major note name to the pitch it plays in `key` (major). */
export function pitchFor(note: NoteName, key: NoteName): Pitch {
  const degree = KEYS.indexOf(note)
  const k = KEYS.indexOf(key)
  const rootSemi = NATURAL[k]
  // Keep the root between G3 and F4 so every key sits in a comfortable range.
  const rootMidi = 60 + rootSemi - (rootSemi >= 7 ? 12 : 0)
  const midi = rootMidi + NATURAL[degree]
  const letter = (k + degree) % 7
  const accidental = (((midi % 12) - NATURAL[letter]) + 12) % 12
  const name = KEYS[letter] + (accidental === 1 ? '♯' : accidental === 11 ? '♭' : '')
  return { name, syllable: SOLFEGE[degree], midi }
}

export const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

/** How the player's right hand leans: outward forces a major chord, inward a minor one. */
export type Lean = 'none' | 'out' | 'in'

export interface Chord {
  /** e.g. "Am", "E", "F♯m", "B°". */
  name: string
  /** Jianpu digit 1–7. */
  digit: number
  syllable: string
  /** Root, third, fifth as MIDI notes. */
  notes: [number, number, number]
}

type Quality = 'major' | 'minor' | 'dim'

/** Chord quality on each degree of a major key: I ii iii IV V vi vii°. */
const DIATONIC: Quality[] = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'dim']

/** Semitones above the root for the third and fifth, and the name suffix. */
const SHAPES: Record<Quality, [number, number, string]> = {
  major: [4, 7, ''],
  minor: [3, 7, 'm'],
  dim: [3, 6, '°'],
}

/**
 * Fold a note into F3–E4: the chord sits under the singer, and notes shared by two
 * chords stay on the same pitch when the chord changes (smooth voice leading, no search).
 */
const fold = (midi: number) => 53 + ((((midi - 53) % 12) + 12) % 12)

/** The triad on `degree` (0-based) of `key`; leaning out forces major, leaning in forces minor. */
export function chordFor(degree: number, key: NoteName, lean: Lean): Chord {
  const root = pitchFor(KEYS[degree], key)
  const quality = lean === 'out' ? 'major' : lean === 'in' ? 'minor' : DIATONIC[degree]
  const [third, fifth, suffix] = SHAPES[quality]
  return {
    name: root.name + suffix,
    digit: degree + 1,
    syllable: root.syllable,
    notes: [fold(root.midi), fold(root.midi + third), fold(root.midi + fifth)],
  }
}
