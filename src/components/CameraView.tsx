import type { RefObject } from 'react'
import type { LeftHandMode } from '../config/settings'
import type { KeyName } from '../music/theory'
import type { HandTracker } from '../vision/HandTracker'
import { HandOverlay } from './HandOverlay'

/** What the overlay needs from the app each frame. */
export interface OverlayState {
  keyName: KeyName
  leftHand: LeftHandMode
  showVolume: boolean
  volume: number
}

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>
  tracker: HandTracker | null
  live: boolean
  getState: () => OverlayState
}

export function CameraView({ videoRef, tracker, live, getState }: Props) {
  return (
    <div className="camera" data-live={live}>
      <video ref={videoRef} className="camera__video" playsInline muted />
      <HandOverlay tracker={tracker} videoRef={videoRef} getState={getState} />
    </div>
  )
}
