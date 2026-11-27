import { useEffect, useState } from 'react'
import type { Exercise } from '../sim/exercises'
import { valveLabel, type SimState } from '../sim/engine'
import type { TimedAction } from '../sim/worker'
import { VLCC } from '../sim/ship'
import { useSim } from './useSim'
import { LinesView } from './LinesView'
import { TerminalView } from './TerminalView'
import { TanksView } from './TanksView'
import { clock } from './format'

type View = 'lineas' | 'terminal' | 'tanques' | 'registro'
const VIEWS: { id: View; label: string }[] = [
  { id: 'lineas', label: 'Líneas de carga' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'tanques', label: 'Tanques y estabilidad' },
  { id: 'registro', label: 'Registro' },
]
const SPEEDS = [1, 5, 20, 60]

interface Props {
  exercise: Exercise
  hints: boolean
  onFinish: (s: SimState, actions: TimedAction[]) => void
  onExit: () => void
}

function ValvePanel({ id, s, act }: { id: string; s: SimState; act: (o: number) => void }) {
  const v = s.valves[id]
  const [pct, setPct] = useState(Math.round(v * 100))
  useEffect(() => setPct(Math.round(v * 100)), [v, id])
  const throttle = id.startsWith('BV_')
  return (
    <section className="valve-panel" key={id} aria-live="polite">
      <h3>{valveLabel(VLCC, id)}</h3>
      <p className="valve-state">{v === 0 ? 'Cerrada' : v === 1 ? 'Abierta' : `Abierta al ${Math.round(v * 100)}%`}</p>
      <div className="row">
        <button onClick={() => act(1)} disabled={v === 1}>
          Abrir
        </button>
        <button onClick={() => act(0)} disabled={v === 0}>
          Cerrar
        </button>
      </div>
      {throttle && (
        <div style={{ marginTop: '0.6rem' }}>
          <label className="quiet small-text" htmlFor="throttle">
            Apertura para estrangular: {pct}%
          </label>
          <input id="throttle" type="range" min={0} max={100} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
          <div className="row">
            {[25, 50, 75].map((p) => (
              <button key={p} className="small" onClick={() => act(p / 100)}>
                {p}%
              </button>
            ))}
            <span className="spacer" />
            <button className="small primary" onClick={() => act(pct / 100)}>
              Aplicar {pct}%
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export function Simulator({ exercise, hints, onFinish, onExit }: Props) {
  const { snap, act, setSpeed, setPaused } = useSim(exercise.id)
  const [view, setView] = useState<View>('lineas')
  const [selected, setSelected] = useState<string | null>('MF1')
  const [confirm, setConfirm] = useState(false)

  if (!snap) return <div className="home">Cargando simulador…</div>
  const s = snap.state
  const activeAlarms = s.alarms.filter((a) => a.active || !a.acked)
  const unacked = activeAlarms.filter((a) => !a.acked)
  const worst = unacked.some((a) => a.level === 'critica') ? 'critica' : 'alta'
  const steps = exercise.steps ?? []
  const firstPending = steps.findIndex((st) => !st.done(s))

  return (
    <div className="sim">
      <div className="topbar">
        <button className="small" onClick={onExit} title="Volver al menú sin guardar">
          Menú
        </button>
        <span className="title">
          {exercise.number ? `Ejercicio ${exercise.number}: ` : ''}
          {exercise.title}
        </span>
        <span className="spacer" />
        <span className="clock" title="Tiempo simulado">
          {clock(s.t)}
        </span>
        <div className="speed" role="group" aria-label="Velocidad de la simulación">
          {SPEEDS.map((f) => (
            <button key={f} className={`small ${snap.factor === f ? 'on' : ''}`} aria-pressed={snap.factor === f} onClick={() => setSpeed(f)}>
              ×{f}
            </button>
          ))}
        </div>
        <button className="small" onClick={() => setPaused(!snap.paused)}>
          {snap.paused ? 'Reanudar' : 'Pausa'}
        </button>
        <button className="small primary" onClick={() => setConfirm(true)}>
          Finalizar
        </button>
      </div>

      {unacked.length > 0 ? (
        <div className={`alarmbar ${worst}`} role="alert" key={unacked[unacked.length - 1].id + unacked[unacked.length - 1].since}>
          <span className="flag">Alarma</span>
          <span>{unacked[unacked.length - 1].text}</span>
          {unacked.length > 1 && <span>(+{unacked.length - 1})</span>}
          <span className="spacer" />
          <button className="small" onClick={() => unacked.forEach((a) => act({ type: 'ack', alarm: a.id }))}>
            Reconocer {unacked.length > 1 ? 'todas' : ''}
          </button>
        </div>
      ) : (
        <div />
      )}

      <div className="body">
        <div className="main">
          <div className="tabs" role="tablist">
            {VIEWS.map((v) => (
              <button key={v.id} role="tab" aria-selected={view === v.id} onClick={() => setView(v.id)}>
                {v.label}
              </button>
            ))}
          </div>
          <div className="view" key={view}>
            {view === 'lineas' && (
              <>
                <LinesView s={s} selected={selected} onSelect={setSelected} />
                <p className="hint">Tocá una válvula o un tanque para operarlo desde el panel de la derecha. Válvula llena: abierta. Gris: estrangulada. Hueca: cerrada.</p>
              </>
            )}
            {view === 'terminal' && <TerminalView s={s} act={act} />}
            {view === 'tanques' && <TanksView s={s} />}
            {view === 'registro' && (
              <div className="panel">
                <h2>Registro de operaciones</h2>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th style={{ textAlign: 'left' }}>Origen</th>
                      <th style={{ textAlign: 'left' }}>Evento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...s.log].reverse().map((l, i) => (
                      <tr key={i}>
                        <td className="mono">{clock(l.t)}</td>
                        <td style={{ textAlign: 'left' }}>{l.who === 'alumno' ? 'Buque' : l.who === 'terminal' ? 'Terminal' : 'Sistema'}</td>
                        <td style={{ textAlign: 'left' }}>{l.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <aside className="side">
          {selected && <ValvePanel id={selected} s={s} act={(o) => act({ type: 'valve', id: selected, opening: o })} />}
          {hints && steps.length > 0 && (
            <section>
              <h3>Pasos</h3>
              <ol className="steps">
                {steps.map((st, i) => {
                  const done = st.done(s)
                  const cls = done ? 'done' : i === firstPending ? 'current' : ''
                  return (
                    <li key={i} className={cls}>
                      <span>
                        {done ? (
                          <svg className="tick" width="14" height="14" viewBox="0 0 14 14" aria-label="Hecho">
                            <path d="M2 7.5 L5.5 11 L12 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          `${i + 1}.`
                        )}
                      </span>
                      <span>
                        {st.text}
                        {i === firstPending && st.view && st.view !== view && (
                          <>
                            {' '}
                            <button className="small" onClick={() => setView(st.view!)}>
                              Ir a {VIEWS.find((v) => v.id === st.view)?.label}
                            </button>
                          </>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </section>
          )}
          <section>
            <h3>Alarmas</h3>
            {activeAlarms.length === 0 ? (
              <p className="quiet small-text">Sin alarmas activas.</p>
            ) : (
              <ul className="steps alarm-list">
                {activeAlarms.map((a) => (
                  <li key={a.id} className={a.active ? (a.level === 'critica' ? 'crit' : 'high') : undefined}>
                    <span>{a.active ? '●' : '○'}</span>
                    <span>
                      {clock(a.since)} {a.text}
                      {!a.active && ' (normalizada)'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {exercise.objectives && (
            <section>
              <h3>Objetivos</h3>
              <ul className="steps">
                {exercise.objectives.map((o, i) => (
                  <li key={i}>
                    <span>•</span>
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {confirm && (
        <div className="modal-back" onClick={() => setConfirm(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>¿Finalizar el ejercicio?</h2>
            <p>{exercise.evaluated ? 'Se calcula la nota con el estado actual del buque y se genera el informe.' : 'Se muestra el resumen de la práctica.'}</p>
            <div className="row">
              <button className="primary" onClick={() => onFinish(s, snap.actions)}>
                Finalizar y ver informe
              </button>
              <button onClick={() => setConfirm(false)}>Seguir operando</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
