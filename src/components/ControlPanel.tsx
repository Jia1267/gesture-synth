import type { ReactNode } from 'react'
import { INSTRUMENTS, type Instrument } from '../audio/instruments'
import type { NoteName } from '../config/gestures'

interface Props {
  /** Set by left-hand gestures. */
  keyName: NoteName
  instrument: Instrument
  onInstrumentChange: (instrument: Instrument) => void
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
