import { useEffect, useRef, useState } from 'react'
import type { Action, SimState, TerminalState } from '../sim/engine'
import { P_ESD, P_HIGH } from '../sim/engine'
import { VLCC } from '../sim/ship'
import { clock, fmt0, fmt1 } from './format'
import { GButton, useGuide } from './guide'

const STATE_TEXT: Record<TerminalState, string> = {
  sin_manguera: 'Esperando conexión de manguera',
  esperando: 'Manguera conectada, espera el aviso del buque',
  autorizado: 'Autorizado, espera el pedido de inicio',
  bombeando: 'Bombeando',
  parando: 'Parando bombas',
  detenido: 'Bombeo detenido',
  esd: 'PARADA DE EMERGENCIA',
}

export function TerminalView({ s, act }: { s: SimState; act: (a: Action) => void }) {
  const [rate, setRate] = useState(5000)
  const guideRate = useGuide('rate')
  const term = s.terminal
  const chatRef = useRef<HTMLDivElement>(null)
  const msgs = s.log.filter((l) => l.com || l.text.startsWith('ALARMA: Parada'))

  // la terminal tiene una respuesta en camino: mostrar que está escribiendo
  const typing = term.pending.length > 0

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs.length, typing])

  // color solo cuando la presión se acerca a la alarma
  const pColor = s.manifoldPressure >= P_HIGH ? 'var(--alarm-crit)' : s.manifoldPressure >= P_HIGH * 0.75 ? 'var(--alarm-high)' : 'var(--ink)'

  return (
    <div className="panels">
      <div className="panel">
        <h2>Terminal de carga</h2>
        <dl className="kv">
          <dt>Estado</dt>
          <dd style={{ color: term.state === 'esd' ? 'var(--alarm-crit)' : undefined, fontWeight: 650 }}>{STATE_TEXT[term.state]}</dd>
          <dt>Producto</dt>
          <dd>
            {term.product}, {fmt0(term.density * 1000)} kg/m³ a 15 °C
          </dd>
          <dt>Caudal actual</dt>
          <dd>{fmt0(term.rate)} m³/h</dd>
          <dt>Caudal pedido</dt>
          <dd>{fmt0(term.target)} m³/h</dd>
          <dt>Presión en el manifold</dt>
          <dd style={{ color: pColor, fontWeight: 650 }}>{fmt1(s.manifoldPressure)} bar</dd>
          <dt>Alarma y parada de emergencia</dt>
          <dd className="quiet">
            {P_HIGH} y {P_ESD} bar
          </dd>
        </dl>
        <div className="bar" aria-hidden="true" style={{ marginTop: '0.8rem', height: 8, background: 'var(--bulkhead)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
          <div className="bar-fill" style={{ width: `${Math.min(100, (s.manifoldPressure / P_ESD) * 100)}%`, height: '100%', background: pColor }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(P_HIGH / P_ESD) * 100}%`, width: 2, background: 'var(--ink)' }} />
        </div>
        <h3 style={{ marginTop: '1.2rem' }}>Mangueras en el manifold</h3>
        <div className="row">
          {VLCC.lines.map((l) => {
            const avail = s.availableHoses.includes(l.id)
            const on = s.hoses[l.id]
            return (
              <GButton
                key={l.id}
                id={`hose:${l.id}`}
                className={on ? 'on' : undefined}
                aria-pressed={on}
                disabled={!avail}
                title={avail ? undefined : 'La terminal no tiene manguera para esta línea en este ejercicio'}
                onClick={() => act({ type: 'hose', line: l.id, connected: !on })}
              >
                {on ? `Desconectar L${l.id}` : avail ? `Conectar L${l.id}` : `L${l.id} sin manguera`}
              </GButton>
            )
          })}
        </div>
      </div>

      <div className="panel">
        <h2>Comunicaciones con la terminal</h2>
        <div className="row" style={{ marginBottom: '0.6rem' }}>
          <GButton id="msg:listo" onClick={() => act({ type: 'msg', kind: 'listo' })}>Avisar: buque listo</GButton>
        </div>
        <div className="row" style={{ marginBottom: '0.6rem' }}>
          <label className="row">
            Caudal
            <input className={guideRate ? 'guide' : undefined} type="number" min={0} max={term.maxRate} step={500} value={rate} onChange={(e) => setRate(Number(e.target.value))} style={{ width: '7.5em' }} />
            m³/h
          </label>
          <GButton id="msg:iniciar" onClick={() => act({ type: 'msg', kind: 'iniciar', rate })}>Pedir inicio</GButton>
          <GButton id="msg:caudal" onClick={() => act({ type: 'msg', kind: 'caudal', rate })}>Pedir cambio de caudal</GButton>
        </div>
        <div className="row">
          <GButton id="msg:ultimo" onClick={() => act({ type: 'msg', kind: 'ultimo' })}>Avisar: último tanque</GButton>
          <GButton id="msg:parar" className="danger" onClick={() => act({ type: 'msg', kind: 'parar' })}>
            Pedir parada
          </GButton>
        </div>
        <div className="radio-log" ref={chatRef} aria-live="polite">
          {msgs.length === 0 && <p className="quiet small-text" style={{ padding: '0.4rem 0' }}>Todavía no hubo comunicaciones.</p>}
          {msgs.map((m, i) => (
            <div key={i} className={m.who}>
              <span className="when">{clock(m.t)}</span>
              <span className="who">{m.who === 'alumno' ? 'Buque' : m.who === 'terminal' ? 'Terminal' : 'Sistema'}</span>
              <span>{m.text}</span>
            </div>
          ))}
          {typing && (
            <div className="terminal typing" role="status">
              <span className="when" />
              <span className="who">Terminal</span>
              <span className="dots" aria-label="La terminal está respondiendo">
                <i />
                <i />
                <i />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
