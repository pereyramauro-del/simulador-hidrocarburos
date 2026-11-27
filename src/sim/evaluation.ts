// Evaluación automática al terminar un ejercicio: reglas de secuencia, límites
// de variables y resultado, como propone la Parte E del Curso Modelo OMI 1.02.

import type { ShipDef } from './ship'
import type { SimState } from './engine'
import { fillOf } from './engine'

export interface EvalItem {
  id: string
  rule: string
  ok: boolean
  penalty: number
  detail: string
  t?: number
}

export interface Evaluation {
  score: number
  passed: boolean
  items: EvalItem[]
}

const PASS = 70

const firstEvent = (s: SimState, type: string, pred?: (d: Record<string, unknown>) => boolean) =>
  s.events.find((e) => e.type === type && (!pred || pred(e.data ?? {})))

const pct = (x: number) => `${(x * 100).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const hms = (t: number) => {
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = Math.floor(t % 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function evaluateEx3(ship: ShipDef, s: SimState): Evaluation {
  const items: EvalItem[] = []
  const add = (id: string, rule: string, ok: boolean, penalty: number, detail: string, t?: number) =>
    items.push({ id, rule, ok, penalty: ok ? 0 : penalty, detail, t })

  // 1. Manifold abierto solo con autorización de la terminal
  const mfOpen = firstEvent(s, 'valvula', (d) => d.id === 'MF1' && (d.to as number) > 0)
  const auth = firstEvent(s, 'terminal_autoriza')
  if (mfOpen) {
    const ok = !!auth && auth.t <= mfOpen.t
    add('mf_auth', 'Manifold abierto después de la confirmación de la terminal', ok, 20,
      ok ? 'Correcto.' : `El manifold se abrió a las ${hms(mfOpen.t)} sin confirmación previa de la terminal.`, mfOpen.t)

    // 2. Alineación antes de abrir el manifold
    const opened = (id: string) => s.events.filter((e) => e.type === 'valvula' && e.data?.id === id && e.t <= mfOpen.t).at(-1)
    const drop = opened('DROP1')
    const bv = opened('BV_CT1')
    const aligned = !!drop && (drop.data?.to as number) > 0 && !!bv && (bv.data?.to as number) > 0
    add('align', 'Línea 1 alineada hacia CT1 antes de abrir el manifold', aligned, 10,
      aligned ? 'Correcto.' : 'Al abrir el manifold, el bajante L1 o la válvula de CT1 todavía estaban cerrados.', mfOpen.t)
  } else {
    add('mf_auth', 'Manifold abierto después de la confirmación de la terminal', false, 20, 'Nunca se abrió el manifold.')
  }

  // 3. Pedido de inicio antes de estar autorizado
  const early = firstEvent(s, 'inicio_sin_autorizacion')
  add('comms', 'Pedido de bombeo solo después de avisar que el buque está listo', !early, 5,
    early ? 'Se pidió iniciar el bombeo antes de la confirmación de la terminal.' : 'Correcto.', early?.t)

  // 4. Caudal inicial reducido
  const start = firstEvent(s, 'terminal_inicia')
  if (start) {
    const r = start.data?.rate as number
    add('start_rate', 'Inicio a caudal reducido (≤ 5.000 m³/h)', r <= 5000, 10,
      r <= 5000 ? `Inicio a ${r.toLocaleString('es-AR')} m³/h.` : `Inicio a ${r.toLocaleString('es-AR')} m³/h, por encima de lo recomendado.`, start.t)
  }

  // 5. Carga solo en CT1
  const wrong = ship.tanks
    .map((t, i) => ({ t, v: s.tanks[i].volume }))
    .filter(({ t, v }) => t.kind !== 'ballast' && t.id !== 'CT1' && v > 1)
  add('wrong_tank', 'Carga solo en el tanque indicado', wrong.length === 0, 15,
    wrong.length === 0 ? 'Correcto.' : `Entró carga en: ${wrong.map(({ t, v }) => `${t.name} (${Math.round(v)} m³)`).join(', ')}.`)

  // 6. Sobrepresión
  const highP = s.events.filter((e) => e.type === 'alarma' && e.data?.id === 'P_HIGH')
  const esd = firstEvent(s, 'esd')
  add('pressure', 'Sin alarmas de presión alta en el manifold', highP.length === 0, Math.min(15, 5 * highP.length),
    highP.length === 0 ? 'Correcto.' : `${highP.length} alarma(s) de presión alta.`, highP[0]?.t)
  add('esd', 'Sin parada de emergencia de la terminal', !esd, 25,
    esd ? 'La terminal disparó la parada de emergencia por sobrepresión.' : 'Correcto.', esd?.t)

  // 7. Estrangulamiento al llegar al 95%
  const c95 = firstEvent(s, 'cruza95', (d) => d.tank === 'CT1')
  if (c95) {
    const v = c95.data?.valve as number
    add('throttle', 'Válvula de CT1 estrangulada (≤ 50%) al llegar al 95%', v <= 0.5, 10,
      v <= 0.5 ? `Válvula al ${Math.round(v * 100)}%.` : `La válvula estaba al ${Math.round(v * 100)}% al llegar al 95%.`, c95.t)
  }

  // 8. Aviso de último tanque
  const last = firstEvent(s, 'mensaje', (d) => d.kind === 'ultimo')
  const stopReq = firstEvent(s, 'mensaje', (d) => d.kind === 'parar')
  const lastOk = !!last && (!stopReq || last.t <= stopReq.t)
  add('last', 'Aviso de último tanque a la terminal antes de pedir la parada', lastOk, 5,
    lastOk ? 'Correcto.' : 'No se avisó a la terminal que era el último tanque.', last?.t)

  // 9. Llegar al 98% con bombeo, rebalse
  const c98 = firstEvent(s, 'cruza98', (d) => d.tank === 'CT1' && (d.rate as number) > 0)
  add('reach98', 'Parada pedida a tiempo (sin llegar al 98% con bombeo)', !c98, 15,
    c98 ? 'CT1 llegó al 98% con la terminal todavía bombeando.' : 'Correcto.', c98?.t)
  const ovf = firstEvent(s, 'rebalse')
  add('overflow', 'Sin rebalse', !ovf, 50,
    ovf ? `Rebalse en ${String(ovf.data?.tank)}: ${Math.round(s.spilled)} m³ derramados en cubierta.` : 'Correcto.', ovf?.t)

  // 10. Llenado final
  const f = fillOf(ship, s, 'CT1')
  const fillOk = f >= 0.95 && f <= 0.985
  add('final_fill', 'Llenado final de CT1 entre 95% y 98%', fillOk, 15,
    `CT1 quedó al ${pct(f)}${fillOk ? '.' : f < 0.95 ? ': quedó corto.' : ': por encima del límite.'}`)

  // 11. Estado final
  const stopped = s.terminal.rate === 0
  const closed = s.valves.MF1 === 0 && s.valves.BV_CT1 === 0
  add('closed', 'Bombeo detenido y manifold y válvula de CT1 cerrados al terminar', stopped && closed, 10,
    stopped && closed ? 'Correcto.' : !stopped ? 'Se finalizó con la terminal todavía bombeando.' : 'Quedaron válvulas abiertas.')

  const score = Math.max(0, 100 - items.reduce((a, i) => a + i.penalty, 0))
  return { score, passed: score >= PASS, items }
}
