export type Instrument = 'voice' | 'piano' | 'strings' | 'synth' | 'pad'

export const INSTRUMENTS: { id: Instrument; label: string }[] = [
  { id: 'voice', label: 'Voice' },
  { id: 'piano', label: 'Piano' },
  { id: 'strings', label: 'Strings' },
  { id: 'synth', label: 'Synth' },
  { id: 'pad', label: 'Soft Pad' },
]

/** One sounding note. The engine connects `output` into the mix and decides when it ends. */
export interface Voice {
  output: AudioNode
  /** Reverb send, 0–1. */
  reverb: number
  /** How long a one-shot note sounds before its release begins, in seconds. */
  length: number
  /** Begin the release at context time `at`; returns the time the note is silent. */
  release(at: number): number
}

type Builder = (ctx: BaseAudioContext, hz: number, t: number, degree: number) => Voice

interface Envelope {
  attack: number
  peak: number
  decay: number
  sustain: number
  /** One-shot sustain time after the attack. */
  hold: number
  release: number
}

/**
 * Wraps an attack → decay → sustain amp envelope around `build`, which connects its sound
 * into `input` and returns every source node so all of them stop after the release.
 */
function makeVoice(
  ctx: BaseAudioContext,
  t: number,
  env: Envelope,
  reverb: number,
  build: (input: AudioNode) => AudioScheduledSourceNode[],
): Voice {
  const amp = new GainNode(ctx, { gain: 0 })
  const gain = amp.gain
  gain.setValueAtTime(0, t)
  gain.linearRampToValueAtTime(env.peak, t + env.attack)
  gain.setTargetAtTime(env.peak * env.sustain, t + env.attack, env.decay / 3)
  const sources = build(amp)
  for (const source of sources) source.start(t)

  return {
    output: amp,
    reverb,
    length: env.attack + env.hold,
    release(at) {
      // Releasing a held note right now: freeze the envelope wherever it is (even mid-attack).
      if (at <= ctx.currentTime + 0.02) {
        // Firefox lacks cancelAndHoldAtTime.
        if (typeof gain.cancelAndHoldAtTime === 'function') gain.cancelAndHoldAtTime(at)
        else {
          gain.cancelScheduledValues(at)
          gain.setValueAtTime(gain.value, at)
        }
      }
      gain.setTargetAtTime(0, at, env.release / 5)
      const end = at + env.release
      for (const source of sources) source.stop(end)
      return end
    },
  }
}

function osc(
  ctx: BaseAudioContext,
  type: OscillatorType,
  hz: number,
  dest: AudioNode,
  { detune = 0, gain = 1 } = {},
) {
  const node = new OscillatorNode(ctx, { type, frequency: hz, detune })
  if (gain === 1) node.connect(dest)
  else node.connect(new GainNode(ctx, { gain })).connect(dest)
  return node
}

/** Delayed vibrato: connect `depth` to an oscillator's `detune` (cents); `lfo` is a source to stop. */
function vibrato(ctx: BaseAudioContext, t: number, rate: number, cents: number, delay: number) {
  const lfo = new OscillatorNode(ctx, { frequency: rate })
  const depth = new GainNode(ctx, { gain: 0 })
  depth.gain.setValueAtTime(0, t + delay)
  depth.gain.linearRampToValueAtTime(cents, t + delay + 0.4)
  lfo.connect(depth)
  return { lfo, depth }
}

/** Formants [frequency, gain] for the vowel of each solfège syllable. */
const VOWELS: Record<string, [number, number][]> = {
  a: [[730, 1], [1090, 0.5], [2440, 0.22]],
  e: [[530, 1], [1840, 0.45], [2480, 0.2]],
  i: [[300, 1], [2290, 0.35], [3010, 0.18]],
  o: [[570, 1], [840, 0.6], [2410, 0.15]],
}
const SYLLABLE_VOWEL = ['o', 'e', 'i', 'a', 'o', 'a', 'i'] // Do Re Mi Fa Sol La Ti

export const INSTRUMENT_BUILDERS: Record<Instrument, Builder> = {
  /** Synthesized sung vowel — used when no recorded sample exists in /public/audio/. */
  voice: (ctx, hz, t, degree) =>
    makeVoice(ctx, t, { attack: 0.03, peak: 0.65, decay: 0.3, sustain: 0.8, hold: 0.6, release: 0.45 }, 0.35, (input) => {
      const glottis = new GainNode(ctx)
      const source = osc(ctx, 'sawtooth', hz, glottis)
      const { lfo, depth } = vibrato(ctx, t, 5.2, 18, 0.25)
      depth.connect(source.detune)
      for (const [freq, gain] of VOWELS[SYLLABLE_VOWEL[degree]]) {
        glottis
          .connect(new BiquadFilterNode(ctx, { type: 'bandpass', frequency: freq, Q: freq / 90 }))
          .connect(new GainNode(ctx, { gain: gain * 4 }))
          .connect(input)
      }
      return [source, lfo]
    }),

  piano: (ctx, hz, t) =>
    // Struck, so it fades even while held — just slowly, like a pedalled piano.
    makeVoice(ctx, t, { attack: 0.004, peak: 0.35, decay: 3, sustain: 0, hold: 2.2, release: 0.8 }, 0.18, (input) => {
      const tone = new BiquadFilterNode(ctx, { type: 'lowpass', Q: 0.4 })
      tone.frequency.setValueAtTime(Math.min(hz * 14, 9000), t)
      tone.frequency.setTargetAtTime(hz * 4, t, 0.35)
      tone.connect(input)
      return [
        osc(ctx, 'triangle', hz, tone),
        osc(ctx, 'triangle', hz, tone, { detune: 4, gain: 0.6 }),
        osc(ctx, 'sine', hz * 2, tone, { gain: 0.3 }),
        osc(ctx, 'sine', hz * 3, tone, { gain: 0.08 }),
      ]
    }),

  strings: (ctx, hz, t) =>
    makeVoice(ctx, t, { attack: 0.06, peak: 0.26, decay: 0.3, sustain: 0.85, hold: 1, release: 0.9 }, 0.4, (input) => {
      const tone = new BiquadFilterNode(ctx, { type: 'lowpass', Q: 0.7 })
      tone.frequency.setValueAtTime(1200, t)
      tone.frequency.linearRampToValueAtTime(Math.min(hz * 9, 4000), t + 0.15)
      tone.connect(input)
      const { lfo, depth } = vibrato(ctx, t, 5.3, 6, 0.25)
      const saws = [-9, 0, 9].map((detune) => osc(ctx, 'sawtooth', hz, tone, { detune, gain: 0.7 }))
      for (const saw of saws) depth.connect(saw.detune)
      return [...saws, lfo]
    }),

  synth: (ctx, hz, t) =>
    makeVoice(ctx, t, { attack: 0.004, peak: 0.24, decay: 0.25, sustain: 0.5, hold: 0.35, release: 0.35 }, 0.15, (input) => {
      const tone = new BiquadFilterNode(ctx, { type: 'lowpass', Q: 6 })
      tone.frequency.setValueAtTime(hz * 1.5, t)
      tone.frequency.linearRampToValueAtTime(Math.min(hz * 16, 8000), t + 0.012)
      tone.frequency.setTargetAtTime(hz * 3, t + 0.012, 0.12)
      tone.connect(input)
      return [
        osc(ctx, 'square', hz, tone, { gain: 0.5 }),
        osc(ctx, 'sawtooth', hz, tone, { detune: 7, gain: 0.6 }),
        osc(ctx, 'sine', hz / 2, tone, { gain: 0.4 }),
      ]
    }),

  pad: (ctx, hz, t) =>
    makeVoice(ctx, t, { attack: 0.18, peak: 0.26, decay: 1, sustain: 1, hold: 1.5, release: 1.6 }, 0.6, (input) => {
      const tone = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: Math.min(hz * 5, 2200), Q: 0.3 })
      tone.connect(input)
      return [
        osc(ctx, 'sine', hz, tone),
        osc(ctx, 'triangle', hz, tone, { detune: -7, gain: 0.45 }),
        osc(ctx, 'triangle', hz, tone, { detune: 7, gain: 0.45 }),
        osc(ctx, 'sine', hz * 2, tone, { detune: 3, gain: 0.12 }),
      ]
    }),
}
