import { useEffect, useRef, useState } from 'react'
import { AudioEngine } from './audio/AudioEngine'
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
  const [guideOpen, setGuideOpen] = useState(true)
  const [active, setActive] = useState<ActiveGestures>({ left: [], right: [] })
  const [handsPresent, setHandsPresent] = useState(false)
  const [current, setCurrent] = useState<{ pitch: Pitch; hit: number } | null>(null)

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

  async function enable() {
    setPhase('starting')
    setCameraError('')
    // Created inside the click so the browser lets audio start.
    const audio = (audioRef.current ??= new AudioEngine())
    void audio.resume()

    const video = videoRef.current!
    try {
      video.srcObject = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
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
      handTracker.onTrigger = (gesture, hand) => {
        // Left hand silently sets the key; right hand plays the syllable in that key.
        if (hand === 'left') {
          settings.current.keyName = gestureMappings[gesture]
          setKeyName(gestureMappings[gesture])
          return
        }
        const { keyName, instrument } = settings.current
        const pitch = pitchFor(gestureMappings[gesture], keyName)
        audio.play(instrument, pitch.midi, pitch.degree)
        setCurrent((c) => ({ pitch, hit: (c?.hit ?? 0) + 1 }))
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
