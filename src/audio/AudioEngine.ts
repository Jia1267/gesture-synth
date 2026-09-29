import { midiToHz } from '../music/theory'
import { INSTRUMENT_BUILDERS, type Instrument, type Voice } from './instruments'

const MAX_VOICES = 14
export const DEFAULT_VOLUME = 1
/** Chords peak at ~0.4–0.7 at volume 1, so the top stays clear of clipping (±1). */
export const VOLUME_RANGE = [0.15, 1.3] as const

/** A sounding note; `release` fades it out. */
export interface NoteHandle {
  release(): void
}

interface LiveNote {
  fader: GainNode
  voice: Voice
  /** Context time the note is silent; Infinity while it sustains. */
  end: number
}

export class AudioEngine {
  readonly ctx = new AudioContext({ latencyHint: 'interactive' })
  readonly analyser: AnalyserNode
  private master: GainNode
  private volume: GainNode
  private reverbBus: GainNode
  private live: LiveNote[] = []

  constructor() {
    const { ctx } = this
    this.master = new GainNode(ctx, { gain: 0.8 })
    // Volume sits after the compressor, so turning it up really gets louder; the waveform
    // is drawn after it, so the line visibly grows and shrinks with the volume.
    this.volume = new GainNode(ctx, { gain: DEFAULT_VOLUME })
    this.analyser = new AnalyserNode(ctx, { fftSize: 2048 })
    this.master
      .connect(new DynamicsCompressorNode(ctx, { threshold: -14, knee: 8, ratio: 6, attack: 0.003, release: 0.2 }))
      .connect(this.volume)
      .connect(this.analyser)
      .connect(ctx.destination)
    this.reverbBus = new GainNode(ctx, { gain: 0.6 })
    this.reverbBus.connect(new ConvolverNode(ctx, { buffer: impulseResponse(ctx, 2.4) })).connect(this.master)
  }

  resume() {
    return this.ctx.resume()
  }

  /** Overall loudness, clamped to VOLUME_RANGE and smoothed so dragging it never clicks. */
  setVolume(value: number) {
    const [min, max] = VOLUME_RANGE
    this.volume.gain.setTargetAtTime(Math.max(min, Math.min(max, value)), this.ctx.currentTime, 0.05)
  }

  /**
   * Start a note that sustains until the returned handle is released.
   * `vowelDegree` picks the Voice sound's vowel; `gain` scales the note (chords use < 1).
   */
  play(instrument: Instrument, midi: number, vowelDegree: number, gain = 1): NoteHandle {
    const { ctx } = this
    const t = ctx.currentTime + 0.005
    const voice = INSTRUMENT_BUILDERS[instrument](ctx, midiToHz(midi), t, vowelDegree)

    const fader = new GainNode(ctx, { gain })
    voice.output.connect(fader).connect(this.master)
    fader.connect(new GainNode(ctx, { gain: voice.reverb })).connect(this.reverbBus)

    const note: LiveNote = { fader, voice, end: Infinity }
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
