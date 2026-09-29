import type { NoteName } from '../config/gestures'

export const KEYS: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
export const SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti']

/** Semitones above C for each natural letter — also the major-scale intervals. */
const NATURAL = [0, 2, 4, 5, 7, 9, 11]

export interface Pitch {
  /** Spelled note name in the current key, e.g. "B♭". */
  name: string
  syllable: string
  midi: number
  /** Scale degree 0–6. */
  degree: number
}

/** Resolve a C-major note name to the pitch it plays in `key` (major). */
export function pitchFor(note: NoteName, key: NoteName): Pitch {
  const degree = KEYS.indexOf(note)
  const k = KEYS.indexOf(key)
  const rootSemi = NATURAL[k]
  // Keep the root between G3 and F4 so every key sits in a comfortable singing range.
  const rootMidi = 60 + rootSemi - (rootSemi >= 7 ? 12 : 0)
  const midi = rootMidi + NATURAL[degree]
  const letter = (k + degree) % 7
  const accidental = (((midi % 12) - NATURAL[letter]) + 12) % 12
  const name = KEYS[letter] + (accidental === 1 ? '♯' : accidental === 11 ? '♭' : '')
  return { name, syllable: SOLFEGE[degree], midi, degree }
}

/** MIDI note the degree would have in C major (used to pitch-shift recorded samples). */
export const cMajorMidi = (degree: number) => 60 + NATURAL[degree]

export const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
