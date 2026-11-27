import type { SimState } from '../sim/engine'
import { ullageOf } from '../sim/engine'
import { VLCC, cap100 } from '../sim/ship'
import { fmt0, fmt1, fmt2 } from './format'

const ship = VLCC

function Profile({ s }: { s: SimState }) {
  // perfil del buque con su asiento
  const W = 640
  const H = 190
  const sx = (W - 60) / ship.loa
  const sy = 4.2
  const keel = 160
  const h = s.hydro
  // exagera el asiento solo cuando es chico, para que siempre entre en el dibujo
  const ex = Math.max(1, Math.min(5, Math.floor(4 / Math.max(Math.abs(h.trim), 0.01))))
  const aft = keel - h.draftAft * sy - (h.trim * (ex - 1) * sy) / 2
  const fwd = keel - h.draftFwd * sy + (h.trim * (ex - 1) * sy) / 2
  const x0 = 30
  const xb = x0 + ship.loa * sx
  return (
    <svg className="mimic" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Perfil del buque: calado de popa ${fmt2(h.draftAft)} m y de proa ${fmt2(h.draftFwd)} m`}>
      <path d={`M${x0 - 20} ${aft} L${xb + 20} ${fwd} V${H} H${x0 - 20} Z`} fill="var(--sea)" opacity={0.18} style={{ transition: 'd 0.6s ease' }} />
      <path d={`M${x0} ${keel} H${xb - 20} L${xb} ${keel - ship.depth * sy} H${x0} Z`} fill="var(--hull)" stroke="var(--equip)" strokeWidth={1.5} />
      <line x1={x0 - 20} y1={aft} x2={xb + 20} y2={fwd} stroke="var(--sea)" strokeWidth={2} />
      <text x={x0} y={26} fontSize={18} fontWeight={600}>
        Popa {fmt2(h.draftAft)} m
      </text>
      <text x={W / 2} y={26} fontSize={18} fontWeight={600} textAnchor="middle">
        Medio {fmt2(h.draftMean)} m
      </text>
      <text x={W - 30} y={26} fontSize={18} fontWeight={600} textAnchor="end">
        Proa {fmt2(h.draftFwd)} m
      </text>
      <text x={W / 2} y={H - 8} fontSize={15} textAnchor="middle" className="t-quiet">
        {ex > 1 ? `Asiento exagerado ×${ex} para que se vea` : 'Asiento a escala'}
      </text>
    </svg>
  )
}

function Inclinometer({ deg }: { deg: number }) {
  const r = 70
  const a = (Math.max(-15, Math.min(15, deg)) * 4 * Math.PI) / 180
  return (
    <svg className="mimic" viewBox="0 0 200 124" role="img" aria-label={`Inclinómetro: escora ${fmt2(Math.abs(deg))} grados`} style={{ maxWidth: 240 }}>
      <path d={`M${100 - r} 90 A${r} ${r} 0 0 1 ${100 + r} 90`} fill="none" stroke="var(--equip)" strokeWidth={1.5} />
      {[-10, -5, 0, 5, 10].map((d) => {
        const aa = (d * 4 * Math.PI) / 180
        return <line key={d} x1={100 + Math.sin(aa) * (r - 6)} y1={90 - Math.cos(aa) * (r - 6)} x2={100 + Math.sin(aa) * r} y2={90 - Math.cos(aa) * r} stroke="var(--equip)" />
      })}
      <line x1={100} y1={90} x2={100} y2={90 - r} stroke="var(--ink)" strokeWidth={2.5} strokeLinecap="round" style={{ transform: `rotate(${(a * 180) / Math.PI}deg)`, transformOrigin: '100px 90px', transition: 'transform 0.6s cubic-bezier(0.2, 0.7, 0.2, 1)' }} />
      <text x={100} y={115} fontSize={13} textAnchor="middle">
        Escora {fmt2(Math.abs(deg))}° {deg > 0.005 ? 'a estribor' : deg < -0.005 ? 'a babor' : ''}
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
    const cls = t.kind === 'ballast' ? undefined : f >= 0.98 ? 'hh' : f >= 0.95 ? 'hi' : undefined
    return (
      <tr key={t.id}>
        <td>{t.name}</td>
        <td>{t.line ? t.line : ''}</td>
        <td>{fmt0(st.volume)}</td>
        <td className={cls}>{fmt1(f * 100)}%</td>
        <td>{fmt2(ullageOf(ship, s, t.id))}</td>
        <td>{fmt0(st.volume * st.density)}</td>
        <td>{st.flow > 0 ? fmt0(st.flow) : ''}</td>
      </tr>
    )
  }
  return (
    <div className="panels">
      <div className="panel">
        <h2>Tanques</h2>
        <table className="data">
          <thead>
            <tr>
              <th>Tanque</th>
              <th>Línea</th>
              <th>Volumen (m³)</th>
              <th>Llenado</th>
              <th>Vacío (m)</th>
              <th>Peso (t)</th>
              <th>Caudal (m³/h)</th>
            </tr>
          </thead>
          <tbody>
            {cargo.map(row)}
            <tr className="total">
              <td>Total de carga</td>
              <td />
              <td>{fmt0(totalCargoVol)}</td>
              <td />
              <td />
              <td>{fmt0(totalCargoT)}</td>
              <td />
            </tr>
            {ballast.map(row)}
          </tbody>
        </table>
        <p className="note">Vacío (ullage) medido desde la referencia de sonda, con tanques prismáticos de {ship.tankDepth} m. Límite de llenado: 98% del volumen.</p>
      </div>
      <div className="panel">
        <h2>Calculador de carga</h2>
        <Profile s={s} />
        <div className="row" style={{ alignItems: 'flex-start', marginTop: '0.8rem', gap: '1.2rem' }}>
          <dl className="kv" style={{ flex: 1, minWidth: 230, margin: 0 }}>
            <dt>Desplazamiento</dt>
            <dd>{fmt0(h.displacement)} t</dd>
            <dt>Peso muerto</dt>
            <dd>{fmt0(h.deadweight)} t</dd>
            <dt>Asiento</dt>
            <dd>
              {fmt2(Math.abs(h.trim))} m {h.trim > 0.01 ? 'apopante' : h.trim < -0.01 ? 'aproante' : 'en aguas iguales'}
            </dd>
            <dt>KG</dt>
            <dd>{fmt2(h.kg)} m</dd>
            <dt>KM</dt>
            <dd>{fmt2(h.km)} m</dd>
            <dt>GM sólido</dt>
            <dd>{fmt2(h.gm)} m</dd>
            <dt>Corrección por superficie libre</dt>
            <dd>{fmt2(h.fsCorrection)} m</dd>
            <dt className="strong">GM corregido</dt>
            <dd className="strong">{fmt2(h.gmCorrected)} m</dd>
          </dl>
          <Inclinometer deg={h.heelDeg} />
        </div>
        <p className="note">
          Hidrostática aproximada a partir de eslora, manga y coeficiente de bloque (buque didáctico). Calado de verano de referencia: {fmt2(ship.summerDraft)} m. Esfuerzos cortantes y momentos flectores llegan en una próxima versión.
        </p>
      </div>
    </div>
  )
}
