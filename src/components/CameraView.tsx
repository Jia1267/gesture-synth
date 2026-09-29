import type { RefObject } from 'react'
import type { HandTracker } from '../vision/HandTracker'
import { HandOverlay } from './HandOverlay'

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>
  tracker: HandTracker | null
  live: boolean
}

export function CameraView({ videoRef, tracker, live }: Props) {
  return (
    <div className="camera" data-live={live}>
      <video ref={videoRef} className="camera__video" playsInline muted />
      <HandOverlay tracker={tracker} videoRef={videoRef} />
    </div>
  )
}
