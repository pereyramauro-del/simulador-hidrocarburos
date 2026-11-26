import { useEffect, useRef, useState } from 'react'
import type { Action, SimState, TerminalState } from '../sim/engine'
import { P_ESD, P_HIGH } from '../sim/engine'
import { VLCC } from '../sim/ship'
import { clock, fmt0, fmt1 } from './format'

const STATE_TEXT: Record<TerminalState, string> = {
  sin_manguera: 'Esperando conexión de manguera',
  esperando: 'Manguera conectada · esperando aviso del buque',
  autorizado: 'Autorizado · esperando pedido de inicio',
  bombeando: 'Bombeando',
  parando: 'Parando bombas',
  detenido: 'Bombeo detenido',
  esd: 'PARADA DE EMERGENCIA',
}

export function TerminalView({ s, act }: { s: SimState; act: (a: Action) => void }) {
  const [rate, setRate] = useState(5000)
  const term = s.terminal
  const chatRef = useRef<HTMLDivElement>(null)
  const msgs = s.log.filter((l) => l.com || l.text.startsWith('ALARMA: Parada'))

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight })
  }, [msgs.length])

  const pColor = s.manifoldPressure >= P_HIGH ? 'var(--crit)' : s.manifoldPressure >= P_HIGH * 0.75 ? 'var(--warn)' : 'var(--ok)'

  return (
    <div className="grid2">
      <div className="card">
        <h2>Terminal de carga</h2>
        <div className="kv">
          <span>Estado</span>
          <span style={{ color: term.state === 'esd' ? 'var(--crit)' : undefined }}>{STATE_TEXT[term.state]}</span>
          <span>Producto</span>
          <span>
            {term.product} · {fmt0(term.density * 1000)} kg/m³ a 15 °C
          </span>
          <span>Caudal actual</span>
          <span>{fmt0(term.rate)} m³/h</span>
          <span>Caudal pedido</span>
          <span>{fmt0(term.target)} m³/h</span>
          <span>Presión en el manifold</span>
          <span style={{ color: pColor }}>{fmt1(s.manifoldPressure)} bar</span>
          <span className="muted">Alarma / parada de emergencia</span>
          <span className="muted">
            {P_HIGH} / {P_ESD} bar
          </span>
        </div>
        <h3 style={{ marginTop: '1rem' }}>Mangueras en el manifold</h3>
        <div className="row">
          {VLCC.lines.map((l) => {
            const avail = s.availableHoses.includes(l.id)
            const on = s.hoses[l.id]
            return (
              <button
                key={l.id}
                className={on ? 'active' : undefined}
                disabled={!avail}
                title={avail ? undefined : 'La terminal no tiene manguera para esta línea en este ejercicio'}
                onClick={() => act({ type: 'hose', line: l.id, connected: !on })}
                style={{ borderColor: avail ? l.color : undefined }}
              >
                L{l.id}: {on ? 'conectada' : avail ? 'conectar' : 'no disponible'}
              </button>
            )
          })}
        </div>
      </div>

      <div className="card">
        <h2>Comunicaciones buque–terminal</h2>
        <div className="row" style={{ marginBottom: '0.6rem' }}>
          <button onClick={() => act({ type: 'msg', kind: 'listo' })}>Buque listo para recibir</button>
        </div>
        <div className="row" style={{ marginBottom: '0.6rem' }}>
          <label className="row">
            Caudal
            <input type="number" min={0} max={term.maxRate} step={500} value={rate} onChange={(e) => setRate(Number(e.target.value))} style={{ width: '7.5em' }} />
            m³/h
          </label>
          <button onClick={() => act({ type: 'msg', kind: 'iniciar', rate })}>Iniciar bombeo</button>
          <button onClick={() => act({ type: 'msg', kind: 'caudal', rate })}>Cambiar caudal</button>
        </div>
        <div className="row" style={{ marginBottom: '0.8rem' }}>
          <button onClick={() => act({ type: 'msg', kind: 'ultimo' })}>Aviso: último tanque</button>
          <button className="danger" onClick={() => act({ type: 'msg', kind: 'parar' })}>
            Parar bombeo
          </button>
        </div>
        <div className="chat" ref={chatRef}>
          {msgs.length === 0 && <span className="muted">Sin mensajes todavía.</span>}
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.who}`}>
              <span className="muted mono" style={{ fontSize: '0.75rem' }}>
                {clock(m.t)} · {m.who === 'alumno' ? 'Buque' : m.who === 'terminal' ? 'Terminal' : 'Sistema'}
              </span>
              <br />
              {m.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
