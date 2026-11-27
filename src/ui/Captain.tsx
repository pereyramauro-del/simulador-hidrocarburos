import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'

interface Props {
  label: string
  text: string
  go?: string
  wait?: string
  /** cambia con cada paso; reabre el globo si estaba plegado */
  stepKey: string
}

const A = 60 // tamaño del capitán
const GAP = 10
const BW = 290 // ancho máximo del globo

type Pos = { x: number; y: number; above: boolean; left: boolean; target: boolean }

/*
  Dónde está lo que hay que tocar. El orden importa: primero el popup de
  válvula, después la vista, el mímico, las pestañas y la barra superior.
*/
const SELECTORS = ['.valve-pop .guide', '.view .guide', '.view .mimic .guide-pulse', '.tabs .guide', '.topbar .guide']
function findTarget(): { r: DOMRect; pop: DOMRect | null } | null {
  for (const sel of SELECTORS) {
    const el = document.querySelector(sel)
    if (el) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 || r.height > 0) return { r, pop: el.closest('.valve-pop')?.getBoundingClientRect() ?? null }
    }
  }
  return null
}

/** Botón dentro del popup de válvula: el capitán se pone al costado del popup, a la altura del botón. */
function besidePopup(r: DOMRect, pop: DOMRect): Pos {
  const vw = window.innerWidth
  const y = r.top + r.height / 2 - A / 2
  const right = pop.right + GAP + A + GAP + Math.min(BW, 200) < vw
  return place(right ? pop.right + GAP : pop.left - GAP - A, y, true)
}

function place(x: number, y: number, target: boolean, aboveHint = false): Pos {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cx = Math.min(Math.max(8, x), vw - A - 8)
  const cy = Math.min(Math.max(8, y), vh - A - 8)
  const bw = Math.min(BW, vw - A - 3 * GAP)
  return { x: cx, y: cy, above: aboveHint || cy > vh * 0.55, left: cx + A + GAP + bw > vw - 8, target }
}

/** Posición junto al objetivo: debajo de él (o arriba si no entra), sin taparlo. */
function near(r: DOMRect): Pos {
  const vh = window.innerHeight
  const x = r.left + r.width / 2 - A / 2 + Math.min(r.width / 2, 24)
  let y = r.bottom + GAP
  let above = false
  if (y + A > vh - 8) {
    y = r.top - GAP - A
    above = true
  }
  return place(x, y, true, above)
}

function rest(): Pos {
  const main = document.querySelector('.main')?.getBoundingClientRect()
  const vh = window.innerHeight
  const bottom = Math.min(vh, main?.bottom ?? vh)
  return place((main?.left ?? 0) + 16, bottom - A - 16, false, true)
}

const same = (a: Pos, b: Pos) => Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && a.above === b.above && a.left === b.left && a.target === b.target

/**
 * El capitán: acompaña al alumno y se acerca al control que corresponde.
 * Se puede arrastrar; una vez movido a mano se queda ahí hasta que se le pida
 * volver a acompañar los botones.
 */
export function Captain({ label, text, go, wait, stepKey }: Props) {
  const [pos, setPos] = useState<Pos>(() => rest())
  const [pinned, setPinned] = useState<{ x: number; y: number } | null>(null)
  const [open, setOpen] = useState(true)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null)
  const posRef = useRef(pos)
  posRef.current = pos

  // reabrir el globo en cada paso nuevo
  useEffect(() => setOpen(true), [stepKey])

  const measure = () => {
    if (drag.current) return
    const next = pinned ? place(pinned.x, pinned.y, false) : (() => {
      const t = findTarget()
      return !t ? rest() : t.pop ? besidePopup(t.r, t.pop) : near(t.r)
    })()
    if (!same(next, posRef.current)) setPos(next)
  }

  // medir después de cada render (la simulación re-renderiza varias veces por segundo)
  useLayoutEffect(measure)

  useEffect(() => {
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    window.addEventListener('scroll', on, true)
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on, true)
      window.removeEventListener('resize', on)
      cancelAnimationFrame(raf)
    }
  })

  const onDown = (e: RPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, sx: e.clientX, sy: e.clientY, moved: false }
  }
  const onMove = (e: RPointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d) return
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return
    if (!d.moved) {
      d.moved = true
      setDragging(true)
    }
    setPos(place(e.clientX - d.dx, e.clientY - d.dy, false))
  }
  const onUp = () => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (!d) return
    if (d.moved) setPinned({ x: posRef.current.x, y: posRef.current.y })
    else setOpen((o) => !o)
  }

  const cls = ['captain', pos.above ? 'above' : 'below', pos.left ? 'left' : 'right', dragging ? 'dragging' : '', pos.target ? 'at-target' : 'resting', pinned ? 'pinned' : '']
  return (
    <div className={cls.join(' ')} style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}>
      <button
        className="captain-face"
        aria-label={open ? 'Capitán. Tocá para plegar el globo o arrastralo para moverlo' : 'Capitán. Tocá para ver qué hacer'}
        aria-expanded={open}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((o) => !o)
          }
        }}
      >
        <CaptainFace />
      </button>
      {open && (
        <div className="captain-bubble" key={stepKey} role="status" aria-live="polite" style={{ width: `min(${BW}px, calc(100vw - ${A + 3 * GAP}px))` }}>
          <span className="captain-step">{label}</span>
          <span className="captain-text">{text}</span>
          {go && <span className="captain-go">{go}</span>}
          {wait && <span className="captain-wait">{wait}</span>}
          {pinned && (
            <button className="captain-follow small" onClick={() => setPinned(null)}>
              Volver a guiarme
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Ilustración propia: capitán con gorra blanca, visera negra, ancla dorada y barba canosa. */
function CaptainFace() {
  return (
    <svg viewBox="0 0 64 64" width={A} height={A} aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="#dfe6ee" />
      {/* hombros con charreteras */}
      <path d="M8 58c3-10 12-14 24-14s21 4 24 14a31 31 0 0 1-48 0z" fill="#1d2b45" />
      <path d="M26 44l6 8 6-8" fill="#fff" />
      <rect x="12" y="50" width="9" height="3" rx="1" fill="#d9a300" />
      <rect x="43" y="50" width="9" height="3" rx="1" fill="#d9a300" />
      {/* cara */}
      <ellipse cx="32" cy="32" rx="12.5" ry="13.5" fill="#e9b98f" />
      {/* barba */}
      <path d="M19.6 31c0 9 5.6 15.5 12.4 15.5S44.4 40 44.4 31c-2 4-5 5.5-6.6 5.5-1.6-1.6-3.6-2.3-5.8-2.3s-4.2.7-5.8 2.3c-1.6 0-4.6-1.5-6.6-5.5z" fill="#eef0f1" />
      <path d="M27.5 37.5c1.4-1 2.9-1.4 4.5-1.4s3.1.4 4.5 1.4" fill="none" stroke="#c9cdd0" strokeWidth="1.4" strokeLinecap="round" />
      {/* ojos y cejas */}
      <circle cx="27" cy="29" r="1.5" fill="#1d2327" />
      <circle cx="37" cy="29" r="1.5" fill="#1d2327" />
      <path d="M24.5 25.6c1.6-.9 3.4-1 5-.3M34.5 25.3c1.6-.7 3.4-.6 5 .3" fill="none" stroke="#eef0f1" strokeWidth="1.8" strokeLinecap="round" />
      {/* gorra */}
      <path d="M17 19.5c0-6 6.7-9.5 15-9.5s15 3.5 15 9.5v2.5H17z" fill="#fff" stroke="#c3c8cc" strokeWidth="1" />
      <rect x="17" y="19.5" width="30" height="3.4" fill="#1d2b45" />
      <path d="M18.5 22.9h27c-1 2.6-6.6 3.8-13.5 3.8s-12.5-1.2-13.5-3.8z" fill="#1d2327" />
      {/* ancla */}
      <g stroke="#d9a300" strokeWidth="1.3" fill="none" strokeLinecap="round">
        <circle cx="32" cy="12.6" r="1.1" />
        <path d="M32 13.7v4.6M30.2 15h3.6M29.4 16.6c.6 1.3 1.5 1.9 2.6 1.9s2-.6 2.6-1.9" />
      </g>
    </svg>
  )
}
