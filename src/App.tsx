import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioEngine, DEFAULT_VOLUME, VOLUME_RANGE, type NoteHandle } from './audio/AudioEngine'
import type { Instrument } from './audio/instruments'
import { CameraView } from './components/CameraView'
import { ControlPanel } from './components/ControlPanel'
import { CurrentNote } from './components/CurrentNote'
import { GestureGuide } from './components/GestureGuide'
import { Landing } from './components/Landing'
import { Recorder } from './components/Recorder'
import { WaveformVisualizer } from './components/WaveformVisualizer'
import { gestureDigits, type NoteName } from './config/gestures'
import { chordFor, KEYS, type Chord, type Lean } from './music/theory'
import { HandTracker, type ActiveGestures } from './vision/HandTracker'

type Phase = 'landing' | 'starting' | 'live'
type Tracking = 'loading' | 'live' | 'failed'

/** A chord is three notes at once, so each is quieter than a lone note. */
const CHORD_VOICE_GAIN = 0.55
/** Left-fist drag: volume change for moving the fist the full height of the frame. */
const VOLUME_PER_FRAME = 1.8
/** `?rec` in the URL turns on the guided real-hand recorder. */
const RECORDING = new URLSearchParams(location.search).has('rec')

interface Sounding {
  key: NoteName
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
  const [keyName, setKeyName] = useState<NoteName>('C')
  const [instrument, setInstrument] = useState<Instrument>('strings')
  const [guideOpen, setGuideOpen] = useState(true)
  const [active, setActive] = useState<ActiveGestures>({ left: [], right: [] })
  const [handsPresent, setHandsPresent] = useState(false)
  const [current, setCurrent] = useState<{ chord: Chord; hit: number } | null>(null)
  const sounding = useRef<Sounding | null>(null)
  const volume = useRef(DEFAULT_VOLUME)
  /** Where the left fist grabbed, and the volume at that moment (relative drag, no jump). */
  const grab = useRef<{ y: number; volume: number } | null>(null)
  const getVolume = useCallback(() => volume.current, [])

  // The tracker fires outside React; let it read the latest selections without re-binding.
  const settings = useRef({ keyName, instrument })
  useEffect(() => {
    settings.current = { keyName, instrument }
  }, [keyName, instrument])

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
    const { keyName, instrument } = settings.current
    const chord = chordFor(degree, keyName, lean)
    sounding.current?.voices.forEach((v) => v.release())
    sounding.current = {
      key: keyName,
      degree,
      lean,
      notes: chord.notes,
      voices: chord.notes.map((midi) => audio.play(instrument, midi, degree, CHORD_VOICE_GAIN)),
    }
    setCurrent((c) => ({ chord, hit: (c?.hit ?? 0) + 1 }))
  }

  /** Leaning while a chord sounds re-voices only the notes that change (usually just the third). */
  function relean(audio: AudioEngine, lean: Lean) {
    const s = sounding.current
    if (!s || s.lean === lean) return
    const chord = chordFor(s.degree, s.key, lean)
    chord.notes.forEach((midi, i) => {
      if (midi === s.notes[i]) return
      s.voices[i].release()
      s.voices[i] = audio.play(settings.current.instrument, midi, s.degree, CHORD_VOICE_GAIN)
    })
    s.lean = lean
    s.notes = chord.notes
    setCurrent((c) => ({ chord, hit: (c?.hit ?? 0) + 1 }))
  }

  function changeKey(key: NoteName) {
    settings.current.keyName = key
    setKeyName(key)
  }

  function dragVolume(audio: AudioEngine, y: number | null) {
    if (y === null) {
      grab.current = null
      return
    }
    grab.current ??= { y, volume: volume.current }
    const [min, max] = VOLUME_RANGE
    volume.current = Math.max(min, Math.min(max, grab.current.volume + (grab.current.y - y) * VOLUME_PER_FRAME))
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
      handTracker.onTrigger = (gesture, hand, lean) => {
        if (hand !== 'right') return
        const digit = gestureDigits[gesture]
        if (digit === 0) stopChord()
        else playChord(audio, digit - 1, lean)
      }
      handTracker.onLean = (lean) => relean(audio, lean)
      handTracker.onKey = (gesture) => changeKey(KEYS[gestureDigits[gesture] - 1])
      handTracker.onLost = (hand) => {
        if (hand === 'right') stopChord()
      }
      handTracker.onGrip = (y) => dragVolume(audio, y)
      handTracker.onActiveChange = setActive
      handTracker.onPresenceChange = setHandsPresent
      setTracker(handTracker)
      setTracking('live')
    } catch (err) {
      console.error(err)
      setTracking('failed')
    }
  }

  const live = phase === 'live'
  const hint =
    tracking === 'loading' ? '正在加载手部识别…'
    : tracking === 'failed' ? '手部识别加载失败，请检查网络后刷新'
    : handsPresent ? ''
    : '左手比数字换调 · 右手比数字弹和弦'

  return (
    <>
      <CameraView videoRef={videoRef} tracker={tracker} live={live} getVolume={getVolume} keyName={keyName} />
      <WaveformVisualizer analyser={analyser} />

      {live && (
        <>
          <ControlPanel
            keyName={keyName}
            onKeyChange={changeKey}
            instrument={instrument}
            onInstrumentChange={setInstrument}
            guideOpen={guideOpen}
            onToggleGuide={() => setGuideOpen((o) => !o)}
            tracking={tracking}
          >
            <GestureGuide keyName={keyName} active={active} />
          </ControlPanel>
          <p className="hint" data-visible={hint !== ''} role="status">{hint}</p>
          <CurrentNote keyName={keyName} chord={current?.chord ?? null} hit={current?.hit ?? 0} />
          {RECORDING && tracker && <Recorder tracker={tracker} />}
        </>
      )}

      <Landing hidden={live} starting={phase === 'starting'} error={cameraError} onEnable={enable} />
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
