import type { CSSProperties, KeyboardEvent } from 'react'
import { VLCC, tankLength } from '../sim/ship'
import { fmt0, fmt1 } from './format'

const ship = VLCC
// metros desde la perpendicular de popa → px (manga exagerada ×1,6 para que se lean los rótulos)
export const X0 = 70
export const SX = 2.88
export const px = (m: number) => X0 + (m + 5) * SX
const SY = 2.88 * 1.6
export const HULL_TOP = 40
const CT_B = 23.5
const WT_B = 11.75
const rowY = { P: HULL_TOP, C: HULL_TOP + WT_B * SY, S: HULL_TOP + (WT_B + CT_B) * SY }
const rowH = { P: WT_B * SY, C: CT_B * SY, S: WT_B * SY }
export const HULL_BOTTOM = HULL_TOP + 47 * SY

export const lineColor = (id: number) => `var(--l${id})`

interface Props {
  fills: number[]
  flows?: number[]
  selectedTank?: string | null
  onSelectTank?: (id: string) => void
  /** secuencia de carga de entrada (portada) */
  intro?: boolean
  compact?: boolean
}

const onKey = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}

/** Plano de tanques del VLCC: casco, cámara de bombas y tanques con su nivel. */
export function ShipPlan({ fills, flows, selectedTank, onSelectTank, intro, compact }: Props) {
  const lcgMin = 55
  const lcgMax = 280
  return (
    <g>
      <path
        d={`M${px(-4)} ${HULL_TOP - 6} H${px(284)} Q${px(306)} ${(HULL_TOP + HULL_BOTTOM) / 2} ${px(284)} ${HULL_BOTTOM + 6} H${px(-4)} Z`}
        fill="var(--hull)"
        stroke="var(--equip)"
        strokeWidth={1.5}
      />
      {!compact && (
        <>
          <text x={px(-2)} y={HULL_TOP - 14} fontSize={12} className="t-quiet">
            Popa
          </text>
          <text x={px(290)} y={HULL_TOP - 14} fontSize={12} className="t-quiet" textAnchor="end">
            Proa →
          </text>
          <text x={px(-1)} y={rowY.P + 16} fontSize={11} className="t-quiet">
            Babor
          </text>
          <text x={px(-1)} y={rowY.S + rowH.S - 6} fontSize={11} className="t-quiet">
            Estribor
          </text>
        </>
      )}
      <rect x={px(38)} y={rowY.C} width={px(50) - px(38)} height={rowH.C} fill="var(--bulkhead)" stroke="var(--equip)" />
      <text x={(px(38) + px(50)) / 2} y={rowY.C + rowH.C / 2} fontSize={10} textAnchor="middle" className="t-quiet" transform={`rotate(-90 ${(px(38) + px(50)) / 2} ${rowY.C + rowH.C / 2})`}>
        Cámara de bombas
      </text>

      {ship.tanks.map((t, i) => {
        const len = tankLength(ship, t)
        const x1 = px(t.lcg - len / 2)
        const w = len * SX
        const isFP = t.id === 'FP'
        const y = isFP ? rowY.C : rowY[t.side]
        const h = isFP ? rowH.C : rowH[t.side]
        const fill = Math.max(0, Math.min(1, fills[i]))
        const flow = flows?.[i] ?? 0
        const cargo = t.kind !== 'ballast'
        const alarm = !cargo || intro ? null : fill >= 0.98 ? 'var(--alarm-crit)' : fill >= 0.95 ? 'var(--alarm-high)' : null
        const vId = `BV_${t.id}`
        const selectable = !!onSelectTank && t.line > 0
        const selected = selectedTank === vId
        const delay = ((t.lcg - lcgMin) / (lcgMax - lcgMin)) * 1.4
        const style = { '--d': `${delay.toFixed(2)}s` } as CSSProperties
        return (
          <g
            key={t.id}
            className={selectable ? 'clickable' : undefined}
            onClick={selectable ? () => onSelectTank!(vId) : undefined}
            onKeyDown={selectable ? onKey(() => onSelectTank!(vId)) : undefined}
            role={selectable ? 'button' : undefined}
            tabIndex={selectable ? 0 : undefined}
            aria-label={selectable ? `Tanque ${t.name}, ${fmt1(fill * 100)}%` : undefined}
          >
            <rect x={x1 + 1} y={y + 1} width={w - 2} height={h - 2} fill="#eef0f1" />
            <rect
              className={`level ${intro ? 'intro' : ''}`}
              style={{ ...style, transform: `scaleY(${fill})` }}
              x={x1 + 1}
              y={y + 1}
              width={w - 2}
              height={h - 2}
              fill={cargo ? 'var(--crude)' : 'var(--sea)'}
            />
            <rect
              className="focus-ring"
              x={x1 + 1}
              y={y + 1}
              width={w - 2}
              height={h - 2}
              fill="none"
              stroke={selected ? 'var(--operator)' : alarm ?? (t.line ? lineColor(t.line) : 'var(--equip)')}
              strokeWidth={selected ? 3 : alarm ? 3 : 1.75}
            />
            <g className={intro ? 'label-intro' : undefined} style={style}>
              <TankLabel x={x1 + w / 2} y={y} w={w} h={h} name={isFP ? 'FP' : t.name} fill={fill} flow={flow} />
            </g>
          </g>
        )
      })}
    </g>
  )
}

function TankLabel({ x, y, w, h, name, fill, flow }: { x: number; y: number; w: number; h: number; name: string; fill: number; flow: number }) {
  const big = h > 80
  // el rótulo va sobre el líquido cuando el tanque está más de medio lleno
  const onLiquid = fill > 0.55
  const color = onLiquid ? '#fff' : 'var(--ink)'
  return (
    <>
      <text x={x} y={y + h / 2 - (big ? 8 : 2)} fontSize={w < 55 ? 10.5 : 13} textAnchor="middle" fontWeight={650} style={{ fill: color }}>
        {name}
      </text>
      <text x={x} y={y + h / 2 + (big ? 11 : 12)} fontSize={w < 55 ? 10 : 11.5} textAnchor="middle" style={{ fill: color }}>
        {fmt1(fill * 100)}%
      </text>
      {big && flow > 0 && (
        <text x={x} y={y + h / 2 + 28} fontSize={11.5} textAnchor="middle" fontWeight={650} style={{ fill: color }}>
          ↑ {fmt0(flow)} m³/h
        </text>
      )}
      {!big && flow > 0 && (
        <text x={x + w / 2 - 5} y={y + 13} fontSize={12} textAnchor="end" fontWeight={700} style={{ fill: color }}>
          ↑
        </text>
      )}
    </>
  )
}
