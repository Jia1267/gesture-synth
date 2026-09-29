import type { ReactNode } from 'react'
import { INSTRUMENTS, type Instrument } from '../audio/instruments'
import type { NoteName } from '../config/gestures'
import { KEYS } from '../music/theory'

interface Props {
  keyName: NoteName
  onKeyChange: (key: NoteName) => void
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

      <div className="field field--stacked">
        <span className="field__label" id="key-label">调</span>
        <div className="keys" role="radiogroup" aria-labelledby="key-label">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={k === keyName}
              className="key"
              onClick={() => props.onKeyChange(k)}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span className="field__label">音色</span>
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
        {guideOpen ? '收起指南' : '展开指南'}
      </button>

      <div id="gesture-guide" className="panel__guide" data-open={guideOpen} inert={!guideOpen}>
        <div className="panel__guide-inner">{props.children}</div>
      </div>
    </aside>
  )
}
