import type { SimState } from '../sim/engine'
import { VLCC, cap100, tankLength } from '../sim/ship'
import { fmt0, fmt1 } from './format'

const ship = VLCC
// escala: metros desde la perpendicular de popa → px
const X0 = 70
const SX = 2.88
const x = (m: number) => X0 + (m + 5) * SX
// manga exagerada ×1.6 para que se lean los rótulos
const SY = 2.88 * 1.6
const HULL_TOP = 40
const CT_B = 23.5
const WT_B = 11.75
const rowY = { P: HULL_TOP, C: HULL_TOP + WT_B * SY, S: HULL_TOP + (WT_B + CT_B) * SY }
const rowH = { P: WT_B * SY, C: CT_B * SY, S: WT_B * SY }
const HULL_BOTTOM = HULL_TOP + 47 * SY

const PID_TOP = HULL_BOTTOM + 60
const PID_ROW = 62

const lineColor = (id: number) => ship.lines.find((l) => l.id === id)?.color ?? '#888'

interface Props {
  s: SimState
  selected: string | null
  onSelect: (valveId: string) => void
}

export function ValveSymbol({ cx, cy, opening, selected, onClick, label, size = 9 }: { cx: number; cy: number; opening: number; selected: boolean; onClick: () => void; label: string; size?: number }) {
  const fill = opening === 0 ? '#0a1118' : opening === 1 ? '#2fbf71' : '#f0b429'
  const stroke = opening === 0 ? '#93a4b8' : fill
  return (
    <g className="clickable" onClick={onClick} role="button" aria-label={label}>
      {selected && <circle cx={cx} cy={cy} r={size + 6} fill="none" stroke="#3ba7ff" strokeWidth={2} />}
      <rect x={cx - size - 4} y={cy - size - 4} width={2 * size + 8} height={2 * size + 8} fill="transparent" />
      <path d={`M${cx - size} ${cy - size * 0.7} L${cx} ${cy} L${cx - size} ${cy + size * 0.7} Z M${cx + size} ${cy - size * 0.7} L${cx} ${cy} L${cx + size} ${cy + size * 0.7} Z`} fill={fill} stroke={stroke} strokeWidth={1.5} />
      {opening > 0 && opening < 1 && (
        <text x={cx} y={cy - size - 4} fontSize={10} textAnchor="middle" fill="#f0b429">
          {Math.round(opening * 100)}%
        </text>
      )}
    </g>
  )
}

export function LinesView({ s, selected, onSelect }: Props) {
  const H = PID_TOP + PID_ROW * 4 + 20
  return (
    <svg className="mimic" viewBox={`0 0 1000 ${H}`} role="img" aria-label="Mímico de tanques y líneas de carga">
      {/* casco */}
      <path
        d={`M${x(-4)} ${HULL_TOP - 6} H${x(284)} Q${x(306)} ${(HULL_TOP + HULL_BOTTOM) / 2} ${x(284)} ${HULL_BOTTOM + 6} H${x(-4)} Z`}
        fill="#0f1a24"
        stroke="#3a4d63"
        strokeWidth={2}
      />
      <text x={x(-2)} y={HULL_TOP - 14} fontSize={12} className="muted">
        Popa
      </text>
      <text x={x(290)} y={HULL_TOP - 14} fontSize={12} className="muted" textAnchor="end">
        Proa →
      </text>
      <text x={x(-1)} y={rowY.P + 16} fontSize={11} className="muted">
        Babor
      </text>
      <text x={x(-1)} y={rowY.S + rowH.S - 6} fontSize={11} className="muted">
        Estribor
      </text>
      {/* cámara de bombas */}
      <rect x={x(38)} y={rowY.C} width={x(50) - x(38)} height={rowH.C} fill="#18222d" stroke="#3a4d63" />
      <text x={(x(38) + x(50)) / 2} y={rowY.C + rowH.C / 2} fontSize={10} textAnchor="middle" className="muted" transform={`rotate(-90 ${(x(38) + x(50)) / 2} ${rowY.C + rowH.C / 2})`}>
        Cámara de bombas
      </text>

      {/* tanques */}
      {ship.tanks.map((t, i) => {
        const len = tankLength(ship, t)
        const x1 = x(t.lcg - len / 2)
        const w = len * SX
        const y = rowY[t.side]
        const h = t.id === 'FP' ? rowH.C : rowH[t.side]
        const yy = t.id === 'FP' ? rowY.C : y
        const fill = s.tanks[i].volume / cap100(t)
        const color = t.kind === 'ballast' ? 'var(--ballast)' : 'var(--cargo)'
        const vId = `BV_${t.id}`
        const flow = s.tanks[i].flow
        const alarm = t.kind === 'ballast' ? null : fill >= 0.98 ? '#ef4444' : fill >= 0.95 ? '#f0b429' : null
        return (
          <g key={t.id} className={t.line ? 'clickable' : undefined} onClick={t.line ? () => onSelect(vId) : undefined} role={t.line ? 'button' : undefined} aria-label={t.line ? `Tanque ${t.name}` : undefined}>
            <rect x={x1 + 1} y={yy + 1} width={w - 2} height={h - 2} fill="#0a1118" />
            <rect x={x1 + 1} y={yy + 1 + (h - 2) * (1 - fill)} width={w - 2} height={(h - 2) * fill} fill={color} opacity={0.85} />
            <rect x={x1 + 1} y={yy + 1} width={w - 2} height={h - 2} fill="none" stroke={alarm ?? (t.line ? lineColor(t.line) : '#3a4d63')} strokeWidth={alarm ? 3 : 2} />
            <text x={x1 + w / 2} y={yy + h / 2 - (h > 80 ? 8 : 2)} fontSize={w < 55 ? 10 : 12} textAnchor="middle" fontWeight={600}>
              {t.id === 'FP' ? 'FP' : t.name}
            </text>
            <text x={x1 + w / 2} y={yy + h / 2 + (h > 80 ? 10 : 12)} fontSize={w < 55 ? 10 : 11} textAnchor="middle">
              {fmt1(fill * 100)}%
            </text>
            {h > 80 && flow > 0 && (
              <text x={x1 + w / 2} y={yy + h / 2 + 26} fontSize={11} textAnchor="middle" fill="#7fd1ff">
                ▲ {fmt0(flow)} m³/h
              </text>
            )}
            {h <= 80 && flow > 0 && (
              <text x={x1 + w - 4} y={yy + 13} fontSize={11} textAnchor="end" fill="#7fd1ff">
                ▲
              </text>
            )}
          </g>
        )
      })}

      {/* P&ID simplificado de las 4 líneas */}
      <text x={20} y={PID_TOP - 24} fontSize={13} fontWeight={600}>
        Líneas de carga · manifold → bajante → válvulas de fondo
      </text>
      {ship.lines.map((l, k) => {
        const y = PID_TOP + k * PID_ROW + 20
        const color = l.color
        const ls = s.lines[l.id]
        const flowing = ls.flow > 0
        const hose = s.hoses[l.id]
        const available = s.availableHoses.includes(l.id)
        const tanks = ship.tanks.filter((t) => t.line === l.id)
        const xs = tanks.map((t) => x(t.lcg) + (t.side === 'P' ? -22 : t.side === 'S' ? 22 : 0))
        const xEnd = Math.max(...xs) + 20
        return (
          <g key={l.id}>
            <text x={20} y={y + 4} fontSize={13} fontWeight={700} fill={color}>
              L{l.id}
            </text>
            {/* manguera / terminal */}
            <rect x={48} y={y - 13} width={54} height={26} rx={4} fill={hose ? '#13301f' : '#0a1118'} stroke={hose ? '#2fbf71' : available ? '#93a4b8' : '#3a4d63'} strokeDasharray={available ? undefined : '3 3'} />
            <text x={75} y={y + 4} fontSize={10} textAnchor="middle" className={hose ? undefined : 'muted'}>
              {hose ? 'Manguera' : available ? 'Sin conectar' : 'No disp.'}
            </text>
            <line x1={102} y1={y} x2={xEnd} y2={y} stroke={color} strokeWidth={4} opacity={0.35} />
            {flowing && <line x1={102} y1={y} x2={xEnd} y2={y} stroke={color} strokeWidth={4} className="flowing" />}
            <ValveSymbol label={`Válvula de manifold L${l.id}`} cx={140} cy={y} opening={s.valves[`MF${l.id}`]} selected={selected === `MF${l.id}`} onClick={() => onSelect(`MF${l.id}`)} />
            <text x={140} y={y + 24} fontSize={10} textAnchor="middle" className="muted">
              Manifold
            </text>
            <ValveSymbol label={`Válvula de bajante L${l.id}`} cx={200} cy={y} opening={s.valves[`DROP${l.id}`]} selected={selected === `DROP${l.id}`} onClick={() => onSelect(`DROP${l.id}`)} />
            <text x={200} y={y + 24} fontSize={10} textAnchor="middle" className="muted">
              Bajante
            </text>
            <text x={232} y={y - 10} fontSize={11} className="mono">
              {fmt0(ls.flow)} m³/h · {fmt1(ls.pressure)} bar
            </text>
            {tanks.map((t, j) => (
              <g key={t.id}>
                <ValveSymbol label={`Válvula de fondo ${t.name}`} cx={xs[j]} cy={y} opening={s.valves[`BV_${t.id}`]} selected={selected === `BV_${t.id}`} onClick={() => onSelect(`BV_${t.id}`)} size={8} />
                <text x={xs[j]} y={y + 24} fontSize={10} textAnchor="middle" className="muted">
                  {t.name}
                </text>
              </g>
            ))}
          </g>
        )
      })}
    </svg>
  )
}
