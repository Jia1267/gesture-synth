import type { ReactNode } from 'react'
import { INSTRUMENTS, type Instrument } from '../audio/instruments'
import type { NoteName } from '../config/gestures'

interface Props {
  /** Set by left-hand gestures. */
  keyName: NoteName
  instrument: Instrument
  onInstrumentChange: (instrument: Instrument) => void
  /** Keep a note sounding for as long as its gesture is held. */
  sustain: boolean
  onToggleSustain: () => void
  guideOpen: boolean
  onToggleGuide: () => void
  tracking: 'loading' | 'live' | 'failed'
  children: ReactNode
}

export function ControlPanel(props: Props) {
  const { keyName, instrument, guideOpen, tracking } = props
  return (
    <aside className="panel">
      <div className="panel__brand">
        <span className="panel__dot" data-status={tracking} aria-hidden="true" />
        Gesture Synth
      </div>

      <div className="field">
        <span className="field__label" id="key-label">Key</span>
        <output className="key-readout" aria-labelledby="key-label" aria-live="polite">
          <span key={keyName} className="key-readout__value">{keyName}</span>
          <span className="key-readout__hint">left hand</span>
        </output>
      </div>

      <label className="field">
        <span className="field__label">Sound</span>
        <select
          className="select"
          value={instrument}
          onChange={(e) => props.onInstrumentChange(e.target.value as Instrument)}
        >
          {INSTRUMENTS.map((i) => (
            <option key={i.id} value={i.id}>{i.label}</option>
          ))}
        </select>
      </label>

      <div className="field">
        <span className="field__label" id="hold-label">Hold</span>
        <button
          type="button"
          role="switch"
          aria-checked={props.sustain}
          aria-labelledby="hold-label"
          className="switch"
          title="Keep the note sounding while the gesture is held"
          onClick={props.onToggleSustain}
        >
          <span className="switch__track" aria-hidden="true">
            <span className="switch__thumb" />
          </span>
          {props.sustain ? 'On' : 'Off'}
        </button>
      </div>

      <button
        type="button"
        className="btn-guide"
        aria-expanded={guideOpen}
        aria-controls="gesture-guide"
        onClick={props.onToggleGuide}
      >
        {guideOpen ? 'Close Guide' : 'Open Guide'}
      </button>

      <div id="gesture-guide" className="panel__guide" data-open={guideOpen} inert={!guideOpen}>
        <div className="panel__guide-inner">{props.children}</div>
      </div>
    </aside>
  )
}
