import { useState, type KeyboardEvent } from 'react'
import type { SimState } from '../sim/engine'
import { VLCC, cap100 } from '../sim/ship'
import { fmt0, fmt1 } from './format'
import { HULL_BOTTOM, ShipPlan, lineColor, px, tankBox } from './ShipPlan'
import { useGuide } from './guide'
import { ValvePopover, type Anchor } from './ValvePopover'

const ship = VLCC
const PID_TOP = HULL_BOTTOM + 70
const PID_ROW = 64

interface Props {
  s: SimState
  selected: string | null
  onSelect: (valveId: string | null) => void
  act: (valveId: string, opening: number) => void
}

const W = 1000
const H = PID_TOP + PID_ROW * 4 + 16
const rowOf = (lineId: number) => PID_TOP + (lineId - 1) * PID_ROW + 14
const bvX = (tankId: string) => {
  const t = ship.tanks.find((k) => k.id === tankId)!
  return px(t.lcg) + (t.side === 'P' ? -22 : t.side === 'S' ? 22 : 0)
}

/** Dónde anclar el popup: sobre la válvula del diagrama o sobre el tanque tocado. */
function anchorFor(id: string, fromTank: boolean): Anchor {
  if (id.startsWith('BV_') && fromTank) {
    const b = tankBox(id.slice(3))
    return { fx: (b.x + b.w / 2) / W, fy: (b.y + b.h) / H, place: 'below' }
  }
  let x: number
  let line: number
  if (id.startsWith('MF')) [x, line] = [142, Number(id.slice(2))]
  else if (id.startsWith('DROP')) [x, line] = [202, Number(id.slice(4))]
  else {
    const t = ship.tanks.find((k) => k.id === id.slice(3))!
    ;[x, line] = [bvX(t.id), t.line]
  }
  return { fx: x / W, fy: (rowOf(line) - 14) / H, place: 'above' }
}

/*
  Válvula según ISA-101: abierta = cuerpo lleno, cerrada = hueco,
  estrangulada = medio llena con su porcentaje. Sin rojo ni verde: esos
  colores quedan para las alarmas.
*/
export function ValveSymbol({ valveId, cx, cy, opening, selected, onClick, label, size = 9 }: { valveId: string; cx: number; cy: number; opening: number; selected: boolean; onClick: () => void; label: string; size?: number }) {
  const guided = useGuide(`valve:${valveId}`)
  const state = opening === 0 ? 'cerrada' : opening === 1 ? 'abierta' : `abierta al ${Math.round(opening * 100)}%`
  const body = opening === 0 ? '#f4f5f5' : opening === 1 ? 'var(--ink)' : 'var(--ink-2)'
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }
  return (
    <g className="clickable valve" onClick={onClick} onKeyDown={onKey} role="button" tabIndex={0} aria-label={`${label}, ${state}`} aria-pressed={selected}>
      <rect x={cx - size - 6} y={cy - size - 6} width={2 * size + 12} height={2 * size + 12} fill="transparent" />
      {guided && <circle className="guide-pulse" cx={cx} cy={cy} r={size + 7} />}
      {selected && <circle className="select-ring" cx={cx} cy={cy} r={size + 6} fill="none" stroke="var(--operator)" strokeWidth={2.5} />}
      <circle className="focus-ring" cx={cx} cy={cy} r={size + 6} fill="none" stroke="transparent" />
      <g className="pop">
        <path
          className="valve-body"
          d={`M${cx - size} ${cy - size * 0.7} L${cx} ${cy} L${cx - size} ${cy + size * 0.7} Z M${cx + size} ${cy - size * 0.7} L${cx} ${cy} L${cx + size} ${cy + size * 0.7} Z`}
          fill={body}
          stroke="var(--ink)"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </g>
      {opening > 0 && opening < 1 && (
        <text x={cx} y={cy - size - 5} fontSize={10.5} textAnchor="middle" fontWeight={650}>
          {Math.round(opening * 100)}%
        </text>
      )}
    </g>
  )
}

export function LinesView({ s, selected, onSelect, act }: Props) {
  const [fromTank, setFromTank] = useState(false)
  const pick = (id: string, tank: boolean) => {
    setFromTank(tank)
    onSelect(id)
  }
  const fills = ship.tanks.map((t, i) => s.tanks[i].volume / cap100(t))
  const flows = s.tanks.map((t) => t.flow)
  return (
    <div className="mimic-wrap">
    <svg className="mimic" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Mímico de tanques y líneas de carga">
      <ShipPlan fills={fills} flows={flows} selectedTank={selected} onSelectTank={(id) => pick(id, true)} />

      <text x={20} y={PID_TOP - 30} fontSize={14} fontWeight={650}>
        Recorrido de la carga: manguera, manifold, bajante y válvulas de fondo
      </text>
      {ship.lines.map((l) => {
        const y = rowOf(l.id)
        const color = lineColor(l.id)
        const ls = s.lines[l.id]
        const flowing = ls.flow > 0
        const hose = s.hoses[l.id]
        const available = s.availableHoses.includes(l.id)
        const tanks = ship.tanks.filter((t) => t.line === l.id)
        const xs = tanks.map((t) => bvX(t.id))
        const xEnd = Math.max(...xs) + 20
        return (
          <g key={l.id}>
            <text x={20} y={y + 5} fontSize={15} fontWeight={750} style={{ fill: color }}>
              L{l.id}
            </text>
            <rect x={48} y={y - 13} width={56} height={26} rx={2} fill={hose ? 'var(--ink)' : '#f4f5f5'} stroke={available ? 'var(--ink)' : 'var(--rule)'} strokeDasharray={available ? undefined : '3 3'} />
            <text x={76} y={y + 4} fontSize={10.5} textAnchor="middle" style={{ fill: hose ? '#fff' : available ? 'var(--ink)' : 'var(--equip)' }}>
              {hose ? 'Manguera' : available ? 'Sin conectar' : 'No hay'}
            </text>
            <line x1={104} y1={y} x2={xEnd} y2={y} stroke={color} strokeWidth={5} strokeLinecap="round" />
            {flowing && <line x1={104} y1={y} x2={xEnd} y2={y} stroke="var(--crude)" strokeWidth={5} className="flowing" />}
            <ValveSymbol valveId={`MF${l.id}`} label={`Válvula de manifold L${l.id}`} cx={142} cy={y} opening={s.valves[`MF${l.id}`]} selected={selected === `MF${l.id}`} onClick={() => pick(`MF${l.id}`, false)} />
            <text x={142} y={y + 26} fontSize={10.5} textAnchor="middle" className="t-quiet">
              Manifold
            </text>
            <ValveSymbol valveId={`DROP${l.id}`} label={`Válvula de bajante L${l.id}`} cx={202} cy={y} opening={s.valves[`DROP${l.id}`]} selected={selected === `DROP${l.id}`} onClick={() => pick(`DROP${l.id}`, false)} />
            <text x={202} y={y + 26} fontSize={10.5} textAnchor="middle" className="t-quiet">
              Bajante
            </text>
            <text x={236} y={y - 11} fontSize={12} fontWeight={600}>
              {fmt0(ls.flow)} m³/h
            </text>
            <text x={318} y={y - 11} fontSize={12} className="t-quiet">
              {fmt1(ls.pressure)} bar
            </text>
            {tanks.map((t, j) => (
              <g key={t.id}>
                <ValveSymbol valveId={`BV_${t.id}`} label={`Válvula de fondo ${t.name}`} cx={xs[j]} cy={y} opening={s.valves[`BV_${t.id}`]} selected={selected === `BV_${t.id}`} onClick={() => pick(`BV_${t.id}`, false)} size={8} />
                <text x={xs[j]} y={y + 26} fontSize={10.5} textAnchor="middle" className="t-quiet">
                  {t.name}
                </text>
              </g>
            ))}
          </g>
        )
      })}
    </svg>
    {selected && (
      <ValvePopover key={selected} id={selected} s={s} anchor={anchorFor(selected, fromTank)} act={(o) => act(selected, o)} onClose={() => onSelect(null)} />
    )}
    </div>
  )
}
