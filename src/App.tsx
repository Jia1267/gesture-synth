import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioEngine, DEFAULT_VOLUME, VOLUME_RANGE, type NoteHandle } from './audio/AudioEngine'
import type { Instrument } from './audio/instruments'
import { CameraView, type OverlayState } from './components/CameraView'
import { ControlPanel } from './components/ControlPanel'
import { CurrentNote } from './components/CurrentNote'
import { GestureGuide } from './components/GestureGuide'
import { Landing } from './components/Landing'
import { Recorder } from './components/Recorder'
import { WaveformVisualizer } from './components/WaveformVisualizer'
import { gestureDigits } from './config/gestures'
import { loadSettings, saveSettings, voicingFromSign, type Settings } from './config/settings'
import { chordFor, WHITE_KEYS, type Chord, type KeyName, type Lean, type Voicing } from './music/theory'
import { HandTracker, type ActiveGestures } from './vision/HandTracker'

type Phase = 'landing' | 'starting' | 'live'
type Tracking = 'loading' | 'live' | 'failed'

/** A chord is three or four notes at once, so each is quieter than a lone note. */
const CHORD_VOICE_GAIN = 0.5
/** Left-hand drag: volume change for moving the hand the full height of the frame. */
const VOLUME_PER_FRAME = 1.8
/** When a gripping hand drops out of frame, undo this much of the drag (it was the hand falling). */
const VOLUME_UNDO_MS = 500
/** `?rec` in the URL turns on the guided real-hand recorder. */
const RECORDING = new URLSearchParams(location.search).has('rec')

interface Shape {
  voicing: Voicing
  low: boolean
}
const NO_SHAPE: Shape = { voicing: 'smooth', low: false }

interface Sounding {
  key: KeyName
  degree: number
  lean: Lean
  notes: number[]
  voices: NoteHandle[]
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<AudioEngine | null>(null)
  const [phase, setPhase] = useState<Phase>('landing')
  const [cameraError, setCameraError] = useState('')
  const [tracker, setTracker] = useState<HandTracker | null>(null)
  const [tracking, setTracking] = useState<Tracking>('loading')
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const [keyName, setKeyName] = useState<KeyName>('C')
  const [instrument, setInstrument] = useState<Instrument>('strings')
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [open, setOpen] = useState<'guide' | 'settings' | null>('guide')
  const [active, setActive] = useState<ActiveGestures>({ left: [], right: [] })
  const [handsPresent, setHandsPresent] = useState(false)
  const [current, setCurrent] = useState<{ chord: Chord; low: boolean; hit: number } | null>(null)
  const sounding = useRef<Sounding | null>(null)
  const volume = useRef(DEFAULT_VOLUME)
  /** Where the left hand grabbed, the volume then, and the recent drag (for undo). */
  const grab = useRef<{ y: number; volume: number; trail: { t: number; v: number }[] } | null>(null)

  // The tracker fires outside React; let it read the latest state without re-binding.
  const live = useRef({ keyName, instrument, settings, shape: NO_SHAPE })
  useEffect(() => {
    live.current = { ...live.current, keyName, instrument, settings }
  }, [keyName, instrument, settings])
  const overlayState = useCallback(
    (): OverlayState => ({
      keyName: live.current.keyName,
      leftHand: live.current.settings.leftHand,
      showVolume: live.current.settings.leftVolume,
      volume: volume.current,
    }),
    [],
  )

  useEffect(() => {
    if (!tracker) return
    tracker.start()
    return () => tracker.stop()
  }, [tracker])

  function stopChord() {
    sounding.current?.voices.forEach((v) => v.release())
    sounding.current = null
    setCurrent(null)
  }

  function playChord(audio: AudioEngine, degree: number, lean: Lean) {
    const { keyName, instrument, shape } = live.current
    const chord = chordFor(degree, keyName, { lean, ...shape })
    sounding.current?.voices.forEach((v) => v.release())
    sounding.current = {
      key: keyName,
      degree,
      lean,
      notes: chord.notes,
      voices: chord.notes.map((midi) => audio.play(instrument, midi, degree, CHORD_VOICE_GAIN)),
    }
    setCurrent((c) => ({ chord, low: shape.low, hit: (c?.hit ?? 0) + 1 }))
  }

  /** Re-voice the sounding chord (lean or left-hand shape changed): shared notes keep ringing. */
  function revoice(audio: AudioEngine) {
    const s = sounding.current
    if (!s) return
    const { instrument, shape } = live.current
    const chord = chordFor(s.degree, s.key, { lean: s.lean, ...shape })
    const kept = new Map<number, NoteHandle>()
    s.notes.forEach((midi, i) => {
      if (chord.notes.includes(midi)) kept.set(midi, s.voices[i])
      else s.voices[i].release()
    })
    s.voices = chord.notes.map((midi) => kept.get(midi) ?? audio.play(instrument, midi, s.degree, CHORD_VOICE_GAIN))
    s.notes = chord.notes
    setCurrent((c) => ({ chord, low: shape.low, hit: (c?.hit ?? 0) + 1 }))
  }

  function relean(audio: AudioEngine, lean: Lean) {
    const s = sounding.current
    if (!s || s.lean === lean) return
    s.lean = lean
    revoice(audio)
  }

  function reshape(audio: AudioEngine, shape: Shape) {
    live.current.shape = shape
    revoice(audio)
  }

  function changeKey(key: KeyName) {
    live.current.keyName = key
    setKeyName(key)
  }

  function changeSettings(next: Settings) {
    const audio = audioRef.current
    if (audio && next.leftHand !== 'voicing' && live.current.shape !== NO_SHAPE) reshape(audio, NO_SHAPE)
    if (audio && !next.lean) relean(audio, 'none')
    live.current.settings = next
    setSettings(next)
    saveSettings(next)
  }

  function dragVolume(audio: AudioEngine, y: number | null, lost = false) {
    const g = grab.current
    if (y === null) {
      if (g && lost) {
        // The hand most likely dropped out of frame: undo what the fall dragged.
        const cutoff = performance.now() - VOLUME_UNDO_MS
        volume.current = g.trail.filter((p) => p.t <= cutoff).at(-1)?.v ?? g.volume
        audio.setVolume(volume.current)
      }
      grab.current = null
      return
    }
    if (!g) {
      grab.current = { y, volume: volume.current, trail: [] }
      return
    }
    const [min, max] = VOLUME_RANGE
    volume.current = Math.max(min, Math.min(max, g.volume + (g.y - y) * VOLUME_PER_FRAME))
    g.trail.push({ t: performance.now(), v: volume.current })
    audio.setVolume(volume.current)
  }

  async function enable() {
    setPhase('starting')
    setCameraError('')
    // Created inside the click so the browser lets audio start.
    const audio = (audioRef.current ??= new AudioEngine())
    void audio.resume()

    const video = videoRef.current!
    try {
      video.srcObject = await navigator.mediaDevices.getUserMedia({
        // 60 fps where the camera allows it halves the wait for each new frame.
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60 } },
        audio: false,
      })
      await video.play()
    } catch (err) {
      setCameraError(describeCameraError(err))
      setPhase('landing')
      return
    }
    setAnalyser(audio.analyser)
    setPhase('live')

    try {
      const handTracker = await HandTracker.create(video)
      const mode = () => live.current.settings
      handTracker.onTrigger = (gesture, hand, lean) => {
        if (hand !== 'right') return
        const digit = gestureDigits[gesture]
        if (digit === 0) stopChord()
        else playChord(audio, digit - 1, mode().lean ? lean : 'none')
      }
      handTracker.onLean = (lean) => {
        if (mode().lean) relean(audio, lean)
      }
      handTracker.onKey = (gesture) => {
        if (mode().leftHand === 'key') changeKey(WHITE_KEYS[gestureDigits[gesture] - 1])
      }
      handTracker.onVoicing = (sign) => {
        if (mode().leftHand === 'voicing') reshape(audio, voicingFromSign(sign))
      }
      handTracker.onGrip = (y, lost) => {
        if (mode().leftVolume || y === null) dragVolume(audio, y, lost)
      }
      handTracker.onLost = (hand) => {
        if (hand === 'right') stopChord()
      }
      handTracker.onActiveChange = setActive
      handTracker.onPresenceChange = setHandsPresent
      setTracker(handTracker)
      setTracking('live')
    } catch (err) {
      console.error(err)
      setTracking('failed')
    }
  }

  const isLive = phase === 'live'
  const hint =
    tracking === 'loading' ? '正在加载手部识别…'
    : tracking === 'failed' ? '手部识别加载失败，请检查网络后刷新'
    : handsPresent ? ''
    : '右手比 1–7 弹和弦 · 握拳停'

  return (
    <>
      <CameraView videoRef={videoRef} tracker={tracker} live={isLive} getState={overlayState} />
      <WaveformVisualizer analyser={analyser} />

      {isLive && (
        <>
          <ControlPanel
            keyName={keyName}
            onKeyChange={changeKey}
            instrument={instrument}
            onInstrumentChange={setInstrument}
            settings={settings}
            onSettingsChange={changeSettings}
            open={open}
            onOpen={setOpen}
            tracking={tracking}
          >
            <GestureGuide keyName={keyName} active={active} settings={settings} />
          </ControlPanel>
          <p className="hint" data-visible={hint !== ''} role="status">{hint}</p>
          <CurrentNote keyName={keyName} chord={current?.chord ?? null} low={current?.low ?? false} hit={current?.hit ?? 0} />
          {RECORDING && tracker && <Recorder tracker={tracker} />}
        </>
      )}

      <Landing hidden={isLive} starting={phase === 'starting'} error={cameraError} onEnable={enable} />
    </>
  )
}

function describeCameraError(err: unknown) {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError') return '摄像头权限被拒绝了。请在浏览器的网站设置里允许摄像头，然后再试一次。'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return '没有找到摄像头。'
  if (name === 'NotReadableError') return '摄像头正被其他应用占用。'
  if (!navigator.mediaDevices) return '摄像头需要在安全页面（https 或 localhost）下使用。'
  return '无法打开摄像头。'
}
