const n0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const n1 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const n2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmt0 = (v: number) => n0.format(Math.abs(v) < 0.5 ? 0 : v)
export const fmt1 = (v: number) => n1.format(v)
export const fmt2 = (v: number) => n2.format(v)

export const clock = (t: number) => {
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = Math.floor(t % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
