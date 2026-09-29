import type { Voicing } from '../music/theory'

/** What the left hand does: nothing (free to hold a mic or phone), change key, or shape the chord. */
export type LeftHandMode = 'none' | 'key' | 'voicing'

export interface Settings {
  leftHand: LeftHandMode
  /** A closed left hand (fist, or holding a mic or phone) moved up or down drags the volume. */
  leftVolume: boolean
  /** Leaning the right hand forces major / minor. */
  lean: boolean
}

export const DEFAULT_SETTINGS: Settings = { leftHand: 'none', leftVolume: true, lean: true }

const STORAGE_KEY = 'gesture-synth-settings'

/** Per-browser convenience only; the app works the same when storage is unavailable. */
export function loadSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Private windows and blocked storage: settings just won't persist.
  }
}

/** Left-hand finger count → chord shape, as in the reference instrument. */
const VOICING_BY_COUNT: Voicing[] = ['root', 'inv1', 'seventh', 'dom7']

export const VOICING_LABELS: Record<Voicing, string> = {
  smooth: '',
  root: '原位',
  inv1: '转位',
  seventh: '七和弦',
  dom7: '属七',
}

/** Parse a left-hand sign like "3" or "3L" (thumb out = one octave lower). */
export function voicingFromSign(sign: string): { voicing: Voicing; low: boolean } {
  return { voicing: VOICING_BY_COUNT[Number(sign[0]) - 1] ?? 'smooth', low: sign.endsWith('L') }
}
