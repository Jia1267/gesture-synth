export type Instrument = 'voice' | 'piano' | 'strings' | 'synth' | 'pad'

export const INSTRUMENTS: { id: Instrument; label: string }[] = [
  { id: 'voice', label: 'Voice' },
  { id: 'piano', label: 'Piano' },
  { id: 'strings', label: 'Strings' },
  { id: 'synth', label: 'Synth' },
  { id: 'pad', label: 'Soft Pad' },
]

/** One sounding note. The engine connects `output` into the mix. */
export interface Voice {
  output: AudioNode
  /** Context time at which the note is silent. */
  end: number
  /** Reverb send, 0鈥?. */
  reverb: number
}

type Builder = (ctx: BaseAudioContext, hz: number, t: number, degree: number) => Voice

interface Envelope {
  attack: number
  peak: number
  decay: number
  sustain: number
  hold: number
  release: number
}

/** Attack 鈫?decay to sustain 鈫?hold 鈫?release. Returns the time the note is silent. */
function envelope(param: AudioParam, t: number, e: Envelope) {
  param.setValueAtTime(0, t)
  param.linearRampToValueAtTime(e.peak, t + e.attack)
  param.setTargetAtTime(e.peak * e.sustain, t + e.attack, e.decay / 3)
  const releaseAt = t + e.attack + e.hold
  param.setTargetAtTime(0, releaseAt, e.release / 5)
  return releaseAt + e.release
}

function oscillator(
  ctx: BaseAudioContext,
  type: OscillatorType,
  hz: number,
  t: number,
  end: number,
  dest: AudioNode,
  { detune = 0, gain = 1 } = {},
) {
  const osc = new OscillatorNode(ctx, { type, frequency: hz, detune })
  if (gain === 1) osc.connect(dest)
  else osc.connect(new GainNode(ctx, { gain })).connect(dest)
  osc.start(t)
  osc.stop(end)
  return osc
}

/** Delayed vibrato; connect the returned node to an oscillator's `detune` (cents). */
function vibrato(ctx: BaseAudioContext, t: number, end: number, rate: number, cents: number, delay: number) {
  const lfo = new OscillatorNode(ctx, { frequency: rate })
  const depth = new GainNode(ctx, { gain: 0 })
  depth.gain.setValueAtTime(0, t + delay)
  depth.gain.linearRampToValueAtTime(cents, t + delay + 0.4)
  lfo.connect(depth)
  lfo.start(t)
  lfo.stop(end)
  return depth
}

/** Formants [frequency, gain] for the vowel of each solf猫ge syllable. */
const VOWELS: Record<string, [number, number][]> = {
  a: [[730, 1], [1090, 0.5], [2440, 0.22]],
  e: [[530, 1], [1840, 0.45], [2480, 0.2]],
  i: [[300, 1], [2290, 0.35], [3010, 0.18]],
  o: [[570, 1], [840, 0.6], [2410, 0.15]],
}
const SYLLABLE_VOWEL = ['o', 'e', 'i', 'a', 'o', 'a', 'i'] // Do Re Mi Fa Sol La Ti

export const INSTRUMENT_BUILDERS: Record<Instrument, Builder> = {
  /** Synthesized sung vowel 鈥?used when no recorded sample exists in /public/audio/. */
  voice(ctx, hz, t, degree) {
    const amp = new GainNode(ctx, { gain: 0 })
    const end = envelope(amp.gain, t, { attack: 0.07, peak: 0.65, decay: 0.3, sustain: 0.8, hold: 0.6, release: 0.45 })
    const glottis = new GainNode(ctx)
    const source = oscillator(ctx, 'sawtooth', hz, t, end, glottis)
    vibrato(ctx, t, end, 5.2, 18, 0.25).connect(source.detune)
    for (const [freq, gain] of VOWELS[SYLLABLE_VOWEL[degree]]) {
      glottis
        .connect(new BiquadFilterNode(ctx, { type: 'bandpass', frequency: freq, Q: freq / 90 }))
        .connect(new GainNode(ctx, { gain: gain * 4 }))
        .connect(amp)
    }
    return { output: amp, end, reverb: 0.35 }
  },

  piano(ctx, hz, t) {
    const amp = new GainNode(ctx, { gain: 0 })
    const tone = new BiquadFilterNode(ctx, { type: 'lowpass', Q: 0.4 })
    tone.frequency.setValueAtTime(Math.min(hz * 14, 9000), t)
    tone.frequency.setTargetAtTime(hz * 4, t, 0.35)
    tone.connect(amp)
    amp.gain.setValueAtTime(0, t)
    amp.gain.linearRampToValueAtTime(0.35, t + 0.004)
    amp.gain.setTargetAtTime(0, t + 0.004, 0.55)
    const end = t + 3
    oscillator(ctx, 'triangle', hz, t, end, tone)
    oscillator(ctx, 'triangle', hz, t, end, tone, { detune: 4, gain: 0.6 })
    oscillator(ctx, 'sine', hz * 2, t, end, tone, { gain: 0.3 })
    oscillator(ctx, 'sine', hz * 3, t, end, tone, { gain: 0.08 })
    return { output: amp, end, reverb: 0.18 }
  },

  strings(ctx, hz, t) {
    const amp = new GainNode(ctx, { gain: 0 })
    const tone = new BiquadFilterNode(ctx, { type: 'lowpass', Q: 0.7 })
    tone.frequency.setValueAtTime(900, t)
    tone.frequency.linearRampToValueAtTime(Math.min(hz * 9, 4000), t + 0.25)
    tone.connect(amp)
    const end = envelope(amp.gain, t, { attack: 0.14, peak: 0.26, decay: 0.3, sustain: 0.85, hold: 1, release: 0.9 })
    const vib = vibrato(ctx, t, end, 5.3, 6, 0.25)
    for (const detune of [-9, 0, 9]) {
      vib.connect(oscillator(ctx, 'sawtooth', hz, t, end, tone, { detune, gain: 0.7 }).detune)
    }
    return { output: amp, end, reverb: 0.4 }
  },

  synth(ctx, hz, t) {
    const amp = new GainNode(ctx, { gain: 0 })
    const tone = new BiquadFilterNode(ctx, { type: 'lowpass', Q: 6 })
    tone.frequency.setValueAtTime(hz * 1.5, t)
    tone.frequency.linearRampToValueAtTime(Math.min(hz * 16, 8000), t + 0.012)
    tone.frequency.setTargetAtTime(hz * 3, t + 0.012, 0.12)
    tone.connect(amp)
    const end = envelope(amp.gain, t, { attack: 0.004, peak: 0.24, decay: 0.25, sustain: 0.5, hold: 0.35, release: 0.35 })
    oscillator(ctx, 'square', hz, t, end, tone, { gain: 0.5 })
    oscillator(ctx, 'sawtooth', hz, t, end, tone, { detune: 7, gain: 0.6 })
    oscillator(ctx, 'sine', hz / 2, t, end, tone, { gain: 0.4 })
    return { output: amp, end, reverb: 0.15 }
  },

  pad(ctx, hz, t) {
    const amp = new GainNode(ctx, { gain: 0 })
    const tone = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: Math.min(hz * 5, 2200), Q: 0.3 })
    tone.connect(amp)
    const end = envelope(amp.gain, t, { attack: 0.45, peak: 0.26, decay: 1, sustain: 1, hold: 1.3, release: 1.6 })
    oscillator(ctx, 'sine', hz, t, end, tone)
    oscillator(ctx, 'triangle', hz, t, end, tone, { detune: -7, gain: 0.45 })
    oscillator(ctx, 'triangle', hz, t, end, tone, { detune: 7, gain: 0.45 })
    oscillator(ctx, 'sine', hz * 2, t, end, tone, { detune: 3, gain: 0.12 })
    return { output: amp, end, reverb: 0.6 }
  },
}
