import type { SimState } from '../sim/engine'
import { ullageOf } from '../sim/engine'
import { VLCC, cap100 } from '../sim/ship'
import { fmt0, fmt1, fmt2 } from './format'

const ship = VLCC

function Profile({ s }: { s: SimState }) {
  // perfil del buque con su asiento
  const W = 640
  const H = 200
  const sx = (W - 60) / ship.loa
  const sy = 4.2
  const keel = 160
  const h = s.hydro
  // exagera el asiento solo cuando es chico, para que siempre entre en el dibujo
  const ex = Math.max(1, Math.min(5, Math.floor(4 / Math.max(Math.abs(h.trim), 0.01))))
  const aft = keel - h.draftAft * sy - (h.trim * (ex - 1) * sy) / 2
  const fwd = keel - h.draftFwd * sy + (h.trim * (ex - 1) * sy) / 2
  const x0 = 30
  return (
    <svg className="mimic" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Perfil del buque con su asiento">
      <path d={`M${x0} ${keel} H${x0 + ship.loa * sx - 20} L${x0 + ship.loa * sx} ${keel - ship.depth * sy} H${x0} Z`} fill="#18222d" stroke="#3a4d63" strokeWidth={2} />
      <line x1={x0 - 20} y1={aft} x2={x0 + ship.loa * sx + 20} y2={fwd} stroke="#3ba7ff" strokeWidth={2} />
      <path d={`M${x0 - 20} ${aft} L${x0 + ship.loa * sx + 20} ${fwd} V${H} H${x0 - 20} Z`} fill="#3ba7ff" opacity={0.12} />
      <text x={x0} y={22} fontSize={12}>
        Popa {fmt2(h.draftAft)} m
      </text>
      <text x={W / 2} y={22} fontSize={12} textAnchor="middle">
        Medio {fmt2(h.draftMean)} m
      </text>
      <text x={W - 30} y={22} fontSize={12} textAnchor="end">
        Proa {fmt2(h.draftFwd)} m
      </text>
      <text x={W / 2} y={H - 8} fontSize={11} textAnchor="middle" className="muted">
        {ex > 1 ? `Asiento exagerado ×${ex} para que se vea` : 'Asiento a escala'}
      </text>
    </svg>
  )
}

function Inclinometer({ deg }: { deg: number }) {
  const r = 70
  const a = (Math.max(-15, Math.min(15, deg)) * 4 * Math.PI) / 180
  return (
    <svg className="mimic" viewBox="0 0 200 120" role="img" aria-label="Inclinómetro" style={{ maxWidth: 260 }}>
      <path d={`M${100 - r} 90 A${r} ${r} 0 0 1 ${100 + r} 90`} fill="none" stroke="#3a4d63" strokeWidth={2} />
      <line x1={100} y1={90} x2={100 + Math.sin(a) * r} y2={90 - Math.cos(a) * r} stroke="#3ba7ff" strokeWidth={3} />
      <text x={100} y={112} fontSize={13} textAnchor="middle">
        Escora {fmt2(Math.abs(deg))}° {deg > 0.005 ? 'Er' : deg < -0.005 ? 'Br' : ''}
      </text>
    </svg>
  )
}

export function TanksView({ s }: { s: SimState }) {
  const h = s.hydro
  const cargo = ship.tanks.map((t, i) => ({ t, st: s.tanks[i] })).filter(({ t }) => t.kind !== 'ballast')
  const ballast = ship.tanks.map((t, i) => ({ t, st: s.tanks[i] })).filter(({ t }) => t.kind === 'ballast')
  const totalCargoVol = cargo.reduce((a, c) => a + c.st.volume, 0)
  const totalCargoT = cargo.reduce((a, c) => a + c.st.volume * c.st.density, 0)
  const row = ({ t, st }: (typeof cargo)[number]) => {
    const f = st.volume / cap100(t)
    const color = t.kind === 'ballast' ? undefined : f >= 0.98 ? 'var(--crit)' : f >= 0.95 ? 'var(--warn)' : undefined
    return (
      <tr key={t.id}>
        <td>
          {t.name} {t.line ? <span className="muted">· L{t.line}</span> : null}
        </td>
        <td>{fmt0(st.volume)}</td>
        <td style={{ color }}>{fmt1(f * 100)}%</td>
        <td>{fmt2(ullageOf(ship, s, t.id))}</td>
        <td>{fmt0(st.volume * st.density)}</td>
        <td>{st.flow > 0 ? fmt0(st.flow) : '—'}</td>
      </tr>
    )
  }
  return (
    <div className="grid2">
      <div className="card">
        <h2>Tanques</h2>
        <table className="data">
          <thead>
            <tr>
              <th>Tanque</th>
              <th>Volumen (m³)</th>
              <th>Llenado</th>
              <th>Vacío (m)</th>
              <th>Peso (t)</th>
              <th>Caudal (m³/h)</th>
            </tr>
          </thead>
          <tbody>
            {cargo.map(row)}
            <tr>
              <td>
                <b>Total carga</b>
              </td>
              <td>
                <b>{fmt0(totalCargoVol)}</b>
              </td>
              <td />
              <td />
              <td>
                <b>{fmt0(totalCargoT)}</b>
              </td>
              <td />
            </tr>
            {ballast.map(row)}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.6rem' }}>
          Vacío (ullage) medido desde la referencia de sonda con tanques prismáticos de {ship.tankDepth} m. Límite de llenado: 98% del volumen.
        </p>
      </div>
      <div className="card">
        <h2>Calculador de carga</h2>
        <Profile s={s} />
        <div className="row" style={{ alignItems: 'flex-start', marginTop: '0.6rem' }}>
          <div className="kv" style={{ flex: 1, minWidth: 220 }}>
            <span>Desplazamiento</span>
            <span>{fmt0(h.displacement)} t</span>
            <span>Peso muerto</span>
            <span>{fmt0(h.deadweight)} t</span>
            <span>Asiento</span>
            <span>
              {fmt2(Math.abs(h.trim))} m {h.trim > 0.01 ? 'apopante' : h.trim < -0.01 ? 'aproante' : 'aguas iguales'}
            </span>
            <span>KG</span>
            <span>{fmt2(h.kg)} m</span>
            <span>KM</span>
            <span>{fmt2(h.km)} m</span>
            <span>GM sólido</span>
            <span>{fmt2(h.gm)} m</span>
            <span>Corrección por superficie libre</span>
            <span>{fmt2(h.fsCorrection)} m</span>
            <span>
              <b>GM corregido</b>
            </span>
            <span>
              <b>{fmt2(h.gmCorrected)} m</b>
            </span>
          </div>
          <Inclinometer deg={h.heelDeg} />
        </div>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.6rem' }}>
          Hidrostática aproximada a partir de eslora, manga y coeficiente de bloque (buque didáctico). Calado de verano de referencia: {fmt2(ship.summerDraft)} m. Esfuerzos cortantes y momentos flectores: próxima fase.
        </p>
      </div>
    </div>
  )
}
