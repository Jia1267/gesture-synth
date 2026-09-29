import { useEffect, useRef, useState } from 'react'
import { AudioEngine, type NoteHandle } from './audio/AudioEngine'
import type { Instrument } from './audio/instruments'
import { CameraView } from './components/CameraView'
import { ControlPanel } from './components/ControlPanel'
import { CurrentNote } from './components/CurrentNote'
import { GestureGuide } from './components/GestureGuide'
import { Landing } from './components/Landing'
import { WaveformVisualizer } from './components/WaveformVisualizer'
import { gestureMappings, type NoteName } from './config/gestures'
import { pitchFor, type Pitch } from './music/theory'
import { HandTracker, type ActiveGestures } from './vision/HandTracker'

type Phase = 'landing' | 'starting' | 'live'
type Tracking = 'loading' | 'live' | 'failed'

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
  const [sustain, setSustain] = useState(false)
  const [guideOpen, setGuideOpen] = useState(true)
  const [active, setActive] = useState<ActiveGestures>({ left: [], right: [] })
  const [handsPresent, setHandsPresent] = useState(false)
  const [current, setCurrent] = useState<{ pitch: Pitch; hit: number } | null>(null)
  /** Sustained right-hand notes, by tracked hand id. */
  const heldNotes = useRef(new Map<number, NoteHandle>())

  // The tracker fires outside React; let it read the latest selections without re-binding.
  const settings = useRef({ keyName, instrument, sustain })
  useEffect(() => {
    settings.current = { keyName, instrument, sustain }
  }, [keyName, instrument, sustain])

  function releaseHeld(handId?: number) {
    for (const [id, note] of heldNotes.current) {
      if (handId !== undefined && id !== handId) continue
      note.release()
      heldNotes.current.delete(id)
    }
  }

  function toggleSustain() {
    if (sustain) releaseHeld()
    setSustain(!sustain)
  }

  useEffect(() => {
    if (!tracker) return
    tracker.start()
    return () => tracker.stop()
  }, [tracker])

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
      handTracker.onTrigger = (gesture, hand, handId) => {
        // Left hand silently sets the key; right hand plays the syllable in that key.
        if (hand === 'left') {
          settings.current.keyName = gestureMappings[gesture]
          setKeyName(gestureMappings[gesture])
          return
        }
        const { keyName, instrument, sustain } = settings.current
        const pitch = pitchFor(gestureMappings[gesture], keyName)
        releaseHeld(handId)
        const note = audio.play(instrument, pitch.midi, pitch.degree, sustain)
        if (sustain) heldNotes.current.set(handId, note)
        setCurrent((c) => ({ pitch, hit: (c?.hit ?? 0) + 1 }))
      }
      handTracker.onRelease = (_hand, handId) => releaseHeld(handId)
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
    tracking === 'loading' ? 'Loading hand tracking…'
    : tracking === 'failed' ? 'Hand tracking failed to load. Check your connection and reload.'
    : handsPresent ? ''
    : 'Left hand sets the key · right hand plays'

  return (
    <>
      <CameraView videoRef={videoRef} tracker={tracker} live={live} />
      <WaveformVisualizer analyser={analyser} />

      {live && (
        <>
          <ControlPanel
            keyName={keyName}
            instrument={instrument}
            onInstrumentChange={setInstrument}
            sustain={sustain}
            onToggleSustain={toggleSustain}
            guideOpen={guideOpen}
            onToggleGuide={() => setGuideOpen((o) => !o)}
            tracking={tracking}
          >
            <GestureGuide keyName={keyName} active={active} />
          </ControlPanel>
          <p className="hint" data-visible={hint !== ''} role="status">{hint}</p>
          <CurrentNote pitch={current?.pitch ?? null} hit={current?.hit ?? 0} />
        </>
      )}

      <Landing hidden={live} starting={phase === 'starting'} error={cameraError} onEnable={enable} />
    </>
  )
}

function describeCameraError(err: unknown) {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError') return 'Camera access was blocked. Allow it in your browser’s site settings, then try again.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device.'
  if (name === 'NotReadableError') return 'The camera is in use by another app.'
  if (!navigator.mediaDevices) return 'Camera access needs a secure (https or localhost) page.'
  return 'Could not start the camera.'
}
