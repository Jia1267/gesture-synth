import { cMajorMidi, midiToHz } from '../music/theory'
import { INSTRUMENT_BUILDERS, type Instrument, type Voice } from './instruments'

/**
 * Optional recorded syllables. Drop files with these names into /public/audio/
 * (sung at C-major pitch: do = C4, re = D4 …) and the Voice sound uses them,
 * pitch-shifted to the selected key. Missing files fall back to a synthesized vowel.
 */
const SAMPLE_NAMES = ['do', 're', 'mi', 'fa', 'sol', 'la', 'ti']
const MAX_VOICES = 14

/** A playing note; `release` fades a sustained note out (no-op for one-shots). */
export interface NoteHandle {
  release(): void
}

interface LiveNote {
  fader: GainNode
  voice: Voice
  /** Context time the note is silent; Infinity while sustained. */
  end: number
}

export class AudioEngine {
  readonly ctx = new AudioContext({ latencyHint: 'interactive' })
  readonly analyser: AnalyserNode
  private master: GainNode
  private reverbBus: GainNode
  private samples: (AudioBuffer | null)[] = []
  private live: LiveNote[] = []

  constructor() {
    const { ctx } = this
    this.master = new GainNode(ctx, { gain: 0.8 })
    this.analyser = new AnalyserNode(ctx, { fftSize: 2048 })
    this.master
      .connect(new DynamicsCompressorNode(ctx, { threshold: -14, knee: 8, ratio: 6, attack: 0.003, release: 0.2 }))
      .connect(this.analyser)
      .connect(ctx.destination)
    this.reverbBus = new GainNode(ctx, { gain: 0.6 })
    this.reverbBus.connect(new ConvolverNode(ctx, { buffer: impulseResponse(ctx, 2.4) })).connect(this.master)
    void this.loadSamples()
  }

  resume() {
    return this.ctx.resume()
  }

  /**
   * Start a note immediately. Notes overlap freely up to MAX_VOICES.
   * `sustain`: keep sounding until the returned handle is released; otherwise a one-shot.
   */
  play(instrument: Instrument, midi: number, degree: number, sustain = false): NoteHandle {
    const { ctx } = this
    const t = ctx.currentTime + 0.005
    const sample = instrument === 'voice' ? this.samples[degree] : null
    const voice = sample
      ? this.sampleVoice(sample, midi, degree, t)
      : INSTRUMENT_BUILDERS[instrument](ctx, midiToHz(midi), t, degree)

    const fader = new GainNode(ctx)
    voice.output.connect(fader).connect(this.master)
    fader.connect(new GainNode(ctx, { gain: voice.reverb })).connect(this.reverbBus)

    const note: LiveNote = { fader, voice, end: sustain ? Infinity : voice.release(t + voice.length) }
    this.live = this.live.filter((n) => n.end > ctx.currentTime)
    this.live.push(note)
    if (this.live.length > MAX_VOICES) {
      const stolen = this.live.shift()!
      stolen.fader.gain.setTargetAtTime(0, t, 0.03)
      if (stolen.end === Infinity) stolen.end = stolen.voice.release(t)
    }
    return {
      release: () => {
        if (note.end === Infinity) note.end = voice.release(ctx.currentTime)
      },
    }
  }

  private sampleVoice(buffer: AudioBuffer, midi: number, degree: number, t: number): Voice {
    const rate = 2 ** ((midi - cMajorMidi(degree)) / 12)
    const source = new AudioBufferSourceNode(this.ctx, { buffer, playbackRate: rate })
    const amp = new GainNode(this.ctx, { gain: 0 })
    amp.gain.setValueAtTime(0, t)
    amp.gain.linearRampToValueAtTime(0.9, t + 0.005)
    source.connect(amp)
    source.start(t)
    const duration = buffer.duration / rate
    return {
      output: amp,
      reverb: 0.25,
      length: duration,
      release(at) {
        amp.gain.setTargetAtTime(0, at, 0.03)
        source.stop(at + 0.15)
        return Math.min(at + 0.15, t + duration)
      },
    }
  }

  private async loadSamples() {
    this.samples = await Promise.all(
      SAMPLE_NAMES.map(async (name) => {
        try {
          const res = await fetch(`${import.meta.env.BASE_URL}audio/${name}.wav`)
          // Dev servers answer missing files with index.html — treat that as "no sample".
          if (!res.ok || res.headers.get('content-type')?.includes('text/html')) return null
          return await this.ctx.decodeAudioData(await res.arrayBuffer())
        } catch {
          return null
        }
      }),
    )
  }
}

/** Decaying stereo noise — a cheap, smooth room. */
function impulseResponse(ctx: BaseAudioContext, seconds: number) {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3
  }
  return buffer
}
