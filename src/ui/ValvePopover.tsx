import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { valveLabel, type SimState } from '../sim/engine'
import { VLCC } from '../sim/ship'
import { GButton } from './guide'

export interface Anchor {
  /** posición del punto de anclaje como fracción del ancho y alto del mímico */
  fx: number
  fy: number
  /** el popup va arriba de la válvula, salvo que no entre */
  place: 'above' | 'below'
}

interface Props {
  id: string
  s: SimState
  anchor: Anchor
  act: (opening: number) => void
  onClose: () => void
}

const stateText = (v: number) => (v === 0 ? 'Cerrada' : v === 1 ? 'Abierta' : `Abierta al ${Math.round(v * 100)}%`)

/**
 * Popup que aparece pegado a la válvula tocada. Se cierra solo al elegir una
 * acción, con Escape o tocando fuera.
 */
export function ValvePopover({ id, s, anchor, act, onClose }: Props) {
  const v = s.valves[id]
  const throttle = id.startsWith('BV_')
  const [pct, setPct] = useState(Math.round(v * 100))
  const ref = useRef<HTMLDivElement>(null)
  const opener = useRef<Element | null>(null)

  useEffect(() => {
    opener.current = document.activeElement
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled):not(.pop-x)')?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        ;(opener.current as HTMLElement | null)?.focus?.()
      }
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element
      if (ref.current?.contains(t)) return
      // tocar otra válvula o tanque la selecciona; no hace falta cerrar antes
      if (t.closest('.mimic .clickable') || t.closest('.captain')) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [id])

  const choose = (o: number) => {
    act(o)
    onClose()
  }

  const f = Math.min(0.97, Math.max(0.03, anchor.fx))
  const style = {
    left: `${anchor.fx * 100}%`,
    top: `${anchor.fy * 100}%`,
    '--fx': `${f * 100}%`,
  } as CSSProperties

  return (
    <div ref={ref} className={`valve-pop ${anchor.place}`} style={style} role="dialog" aria-label={valveLabel(VLCC, id)} key={id}>
      <div className="pop-head">
        <strong>{valveLabel(VLCC, id)}</strong>
        <button className="pop-x" onClick={onClose} aria-label="Cerrar sin cambiar">
          ×
        </button>
      </div>
      <p className="pop-state">
        <span className={`pop-dot ${v === 0 ? 'closed' : v === 1 ? 'open' : 'mid'}`} aria-hidden="true" />
        {stateText(v)}
      </p>
      <div className="pop-main">
        <GButton id="panel:open" className="primary" onClick={() => choose(1)} disabled={v === 1}>
          Abrir
        </GButton>
        <GButton id="panel:close" onClick={() => choose(0)} disabled={v === 0}>
          Cerrar
        </GButton>
      </div>
      {throttle && (
        <div className="pop-throttle">
          <span className="pop-label">Estrangular</span>
          <div className="pop-steps">
            {[25, 50, 75].map((p) => (
              <GButton key={p} id={`panel:${p}`} className="small" onClick={() => choose(p / 100)} disabled={Math.round(v * 100) === p}>
                {p}%
              </GButton>
            ))}
          </div>
          <div className="pop-range">
            <input type="range" min={0} max={100} step={5} value={pct} aria-label="Apertura" onChange={(e) => setPct(Number((e.target as HTMLInputElement).value))} />
            <button className="small" onClick={() => choose(pct / 100)}>
              Dejar en {pct}%
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
