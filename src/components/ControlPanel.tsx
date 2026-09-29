import type { ReactNode } from 'react'
import { INSTRUMENTS, type Instrument } from '../audio/instruments'
import type { LeftHandMode, Settings } from '../config/settings'
import { keyLabel, type KeyName } from '../music/theory'

/** Piano layout on a 14-column grid: white keys span two columns, black keys sit between them. */
const WHITE: KeyName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const BLACK: [KeyName, number][] = [['Db', 2], ['Eb', 4], ['F#', 8], ['Ab', 10], ['Bb', 12]]

const LEFT_HAND_MODES: { id: LeftHandMode; label: string; hint: string }[] = [
  { id: 'none', label: '不用', hint: '左手自由，可以拿麦克风或手机' },
  { id: 'key', label: '换调', hint: '比 1–7 保持 1 秒 → 换到 C–B 调，唱到一半也能换' },
  { id: 'voicing', label: '变和弦', hint: '伸 1 指原位 · 2 指转位 · 3 指七和弦 · 4 指属七；拇指伸出低八度' },
]

type Drawer = 'guide' | 'settings' | null

interface Props {
  keyName: KeyName
  onKeyChange: (key: KeyName) => void
  instrument: Instrument
  onInstrumentChange: (instrument: Instrument) => void
  settings: Settings
  onSettingsChange: (settings: Settings) => void
  open: Drawer
  onOpen: (open: Drawer) => void
  tracking: 'loading' | 'live' | 'failed'
  /** The gesture guide. */
  children: ReactNode
}

export function ControlPanel(props: Props) {
  const { keyName, instrument, settings, open, tracking } = props
  const set = (patch: Partial<Settings>) => props.onSettingsChange({ ...settings, ...patch })
  const toggle = (drawer: Exclude<Drawer, null>) => props.onOpen(open === drawer ? null : drawer)
  const keyButton = (k: KeyName, column: number, black: boolean) => (
    <button
      key={k}
      type="button"
      role="radio"
      aria-checked={k === keyName}
      aria-label={`1=${keyLabel(k)}`}
      className={black ? 'key key--black' : 'key'}
      style={{ gridColumn: `${column} / span 2` }}
      onClick={() => props.onKeyChange(k)}
    >
      {keyLabel(k)}
    </button>
  )

  return (
    <aside className="panel">
      <div className="panel__brand">
        <span className="panel__dot" data-status={tracking} aria-hidden="true" />
        Gesture Synth
      </div>

      <div className="field field--stacked">
        <span className="field__label" id="key-label">调</span>
        <div className="keys" role="radiogroup" aria-labelledby="key-label">
          {BLACK.map(([k, column]) => keyButton(k, column, true))}
          {WHITE.map((k, i) => keyButton(k, i * 2 + 1, false))}
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

      <div className="panel__tabs">
        <button type="button" className="btn-guide" aria-expanded={open === 'guide'} aria-controls="panel-drawer" onClick={() => toggle('guide')}>
          手势指南
        </button>
        <button type="button" className="btn-guide" aria-expanded={open === 'settings'} aria-controls="panel-drawer" onClick={() => toggle('settings')}>
          设置
        </button>
      </div>

      <div id="panel-drawer" className="panel__guide" data-open={open !== null} inert={open === null}>
        <div className="panel__guide-inner">
          {open === 'settings' ? (
            <section className="settings" aria-label="设置">
              <h2 className="guide__title">左手用途</h2>
              <div className="segmented" role="radiogroup" aria-label="左手用途">
                {LEFT_HAND_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={settings.leftHand === m.id}
                    className="segmented__item"
                    onClick={() => set({ leftHand: m.id })}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="settings__hint">{LEFT_HAND_MODES.find((m) => m.id === settings.leftHand)?.hint}</p>
              <Switch
                label="左手握拳调音量"
                hint="上下移动；拿麦克风、手机的手也算握拳"
                checked={settings.leftVolume}
                onChange={(leftVolume) => set({ leftVolume })}
              />
              <Switch
                label="右手倾斜切大小三"
                hint="往外倾大三，往内倾小三"
                checked={settings.lean}
                onChange={(lean) => set({ lean })}
              />
            </section>
          ) : (
            props.children
          )}
        </div>
      </div>
    </aside>
  )
}

function Switch({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
      <span className="switch__text">
        {label}
        <small>{hint}</small>
      </span>
      <span className="switch__track" aria-hidden="true">
        <span className="switch__thumb" />
      </span>
    </button>
  )
}
