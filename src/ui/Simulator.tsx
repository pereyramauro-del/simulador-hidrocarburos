import { useRef, useState } from 'react'
import { advance, type Exercise } from '../sim/exercises'
import type { SimState } from '../sim/engine'
import type { TimedAction } from '../sim/worker'
import { useSim } from './useSim'
import { LinesView } from './LinesView'
import { TerminalView } from './TerminalView'
import { TanksView } from './TanksView'
import { clock } from './format'
import { GButton, GuideContext, viewOf } from './guide'
import { Captain } from './Captain'

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

export function Simulator({ exercise, hints, onFinish, onExit }: Props) {
  const { snap, act, setSpeed, setPaused } = useSim(exercise.id)
  const [view, setView] = useState<View>('lineas')
  const [selected, setSelected] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const progress = useRef(0)

  if (!snap) return <div className="home">Cargando simulador…</div>
  const s = snap.state
  const activeAlarms = s.alarms.filter((a) => a.active || !a.acked)
  const unacked = activeAlarms.filter((a) => !a.acked)
  const worst = unacked.some((a) => a.level === 'critica') ? 'critica' : 'alta'
  const steps = exercise.steps ?? []
  progress.current = advance(steps, s, progress.current)
  const firstPending = progress.current < steps.length ? progress.current : -1
  const allDone = steps.length > 0 && firstPending === -1

  // Guía: qué controles resaltar en este momento
  const g = !hints || steps.length === 0 ? null : allDone ? { targets: ['finish'] } : steps[firstPending].guide?.(s, { selected, factor: snap.factor }) ?? { targets: [] }
  const guide = new Set<string>()
  for (const t of g?.targets ?? []) {
    const v = viewOf(t)
    if (v && v !== view) guide.add(`tab:${v}`)
    else if (!t.startsWith('view:')) guide.add(t)
  }
  // si lo que hay que tocar está en otra pestaña, decirlo con palabras
  const goTab = VIEWS.find((v) => guide.has(`tab:${v.id}`) && (g?.targets ?? []).some((t) => viewOf(t) === v.id && !t.startsWith('view:')))

  return (
    <GuideContext.Provider value={guide}>
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
            <GButton key={f} id={`speed:${f}`} className={`small ${snap.factor === f ? 'on' : ''}`} aria-pressed={snap.factor === f} onClick={() => setSpeed(f)}>
              ×{f}
            </GButton>
          ))}
        </div>
        <button className="small" onClick={() => setPaused(!snap.paused)}>
          {snap.paused ? 'Reanudar' : 'Pausa'}
        </button>
        <GButton id="finish" className="small primary" onClick={() => setConfirm(true)}>
          Finalizar
        </GButton>
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
              <button key={v.id} role="tab" aria-selected={view === v.id} className={guide.has(`tab:${v.id}`) ? 'guide' : undefined} onClick={() => {
                setSelected(null)
                setView(v.id)
              }}>
                {v.label}
              </button>
            ))}
          </div>
          {g && (
            <Captain
              stepKey={allDone ? 'fin' : String(firstPending)}
              label={allDone ? 'Listo' : `Paso ${firstPending + 1} de ${steps.length}`}
              text={allDone ? 'Completaste todos los pasos. Tocá Finalizar para ver tu nota.' : steps[firstPending].text}
              go={goTab ? `Primero andá a la pestaña ${goTab.label}.` : undefined}
              wait={g.wait}
              waiting={!allDone && (g.targets.length === 0 || !!g.wait)}
            />
          )}
          <div className="view" key={view}>
            {view === 'lineas' && (
              <>
                <LinesView s={s} selected={selected} onSelect={setSelected} act={(id, o) => act({ type: 'valve', id, opening: o })} />
                <p className="hint">Tocá una válvula o un tanque y elegí qué hacer en el cuadro que aparece encima. Válvula llena: abierta. Gris: estrangulada. Hueca: cerrada.</p>
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
          {hints && steps.length > 0 && (
            <section>
              <h3>Pasos</h3>
              <ol className="steps">
                {steps.map((st, i) => {
                  const done = firstPending === -1 || i < firstPending
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
    </GuideContext.Provider>
  )
}
