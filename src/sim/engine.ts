// Motor de simulación determinista de paso fijo (1 s simulado por paso).
// Misma condición inicial + mismas acciones en los mismos segundos = mismo resultado.
// El motor REGISTRA las maniobras incorrectas en lugar de bloquearlas: un tanque
// puede rebalsar y una línea puede sobrepresionarse. Ver la consecuencia enseña.

import type { ShipDef } from './ship'
import { cap100, tankLength } from './ship'
import { computeHydro, tankWeight, type Hydro } from './hydrostatics'

export const DT = 1 // s

// Parámetros hidráulicos didácticos
const C_TANK = 3000 // m³/h por √bar con la válvula de fondo 100% abierta
const C_LINE_VALVE = 20000 // manifold y bajante, abiertas 100%
const P_STATIC = 1.0 // bar
export const P_HIGH = 8 // bar: alarma de alta presión
export const P_ESD = 14 // bar: la terminal dispara la parada de emergencia
const TERMINAL_DELAY = 20 // s de respuesta de la terminal
const STOP_DELAY = 30 // s hasta que la terminal empieza a parar
const RAMP = 50 // m³/h por segundo de rampa de caudal en tierra

export type TerminalState = 'sin_manguera' | 'esperando' | 'autorizado' | 'bombeando' | 'parando' | 'detenido' | 'esd'

export type MsgKind = 'listo' | 'iniciar' | 'caudal' | 'ultimo' | 'parar'

export type Action =
  | { type: 'valve'; id: string; opening: number }
  | { type: 'hose'; line: number; connected: boolean }
  | { type: 'msg'; kind: MsgKind; rate?: number }
  | { type: 'ack'; alarm: string }

export interface LogEntry {
  t: number
  who: 'alumno' | 'terminal' | 'sistema'
  text: string
  /** true si es una comunicación buque–terminal */
  com?: boolean
}

export interface Alarm {
  id: string
  text: string
  level: 'alta' | 'critica'
  active: boolean
  acked: boolean
  since: number
}

export interface SimEvent {
  t: number
  type: string
  data?: Record<string, unknown>
}

export interface TankState {
  volume: number
  density: number
  flow: number // m³/h entrando (+) o saliendo (−)
}

export interface LineState {
  flow: number
  pressure: number
}

export interface PendingTerminal {
  at: number
  kind: 'autorizar' | 'iniciar' | 'caudal' | 'parar' | 'standby' | 'rechazo'
  rate?: number
  text?: string
}

export interface SimState {
  t: number
  tanks: TankState[]
  valves: Record<string, number>
  hoses: Record<number, boolean>
  availableHoses: number[]
  terminal: {
    state: TerminalState
    rate: number
    target: number
    maxRate: number
    product: string
    density: number
    pending: PendingTerminal[]
    lastNotice: boolean
  }
  lines: Record<number, LineState>
  manifoldPressure: number
  alarms: Alarm[]
  log: LogEntry[]
  events: SimEvent[]
  spilled: number
  hydro: Hydro
}

export const valveIds = (ship: ShipDef) => [
  ...ship.lines.flatMap((l) => [`MF${l.id}`, `DROP${l.id}`]),
  ...ship.tanks.filter((t) => t.line > 0).map((t) => `BV_${t.id}`),
]

export interface InitialCondition {
  volumes: Record<string, number> // m³ por tanque
  densities?: Record<string, number>
  availableHoses: number[]
  product: string
  density: number
  maxRate: number
}

export function createState(ship: ShipDef, ic: InitialCondition): SimState {
  const tanks = ship.tanks.map((t) => ({
    volume: ic.volumes[t.id] ?? 0,
    density: ic.densities?.[t.id] ?? (t.kind === 'ballast' ? ship.seaDensity : ic.density),
    flow: 0,
  }))
  const valves: Record<string, number> = {}
  for (const id of valveIds(ship)) valves[id] = 0
  const lines: Record<number, LineState> = {}
  for (const l of ship.lines) lines[l.id] = { flow: 0, pressure: 0 }
  const s: SimState = {
    t: 0,
    tanks,
    valves,
    hoses: Object.fromEntries(ship.lines.map((l) => [l.id, false])),
    availableHoses: ic.availableHoses,
    terminal: {
      state: 'sin_manguera',
      rate: 0,
      target: 0,
      maxRate: ic.maxRate,
      product: ic.product,
      density: ic.density,
      pending: [],
      lastNotice: false,
    },
    lines,
    manifoldPressure: 0,
    alarms: [],
    log: [{ t: 0, who: 'sistema', text: 'Simulación iniciada. Todas las válvulas cerradas.' }],
    events: [],
    spilled: 0,
    hydro: computeHydro(ship, []),
  }
  s.hydro = hydroOf(ship, s)
  return s
}

function hydroOf(ship: ShipDef, s: SimState) {
  return computeHydro(
    ship,
    s.tanks.map((c, i) => tankWeight(ship, i, c)),
  )
}

const log = (s: SimState, who: LogEntry['who'], text: string, com = false) => s.log.push({ t: s.t, who, text, com: com || who === 'terminal' })
const ev = (s: SimState, type: string, data?: Record<string, unknown>) => s.events.push({ t: s.t, type, data })

function raise(s: SimState, id: string, text: string, level: Alarm['level']) {
  const a = s.alarms.find((x) => x.id === id)
  if (a) {
    if (!a.active) {
      a.active = true
      a.acked = false
      a.since = s.t
      log(s, 'sistema', `ALARMA: ${text}`)
      ev(s, 'alarma', { id })
    }
    return
  }
  s.alarms.push({ id, text, level, active: true, acked: false, since: s.t })
  log(s, 'sistema', `ALARMA: ${text}`)
  ev(s, 'alarma', { id })
}

function clear(s: SimState, id: string) {
  const a = s.alarms.find((x) => x.id === id)
  if (a && a.active) {
    a.active = false
    log(s, 'sistema', `Normalizada: ${a.text}`)
  }
}

const fmt = (n: number) => Math.round(n).toLocaleString('es-AR')

export function applyAction(ship: ShipDef, s: SimState, a: Action) {
  switch (a.type) {
    case 'valve': {
      const v = Math.max(0, Math.min(1, a.opening))
      if (!(a.id in s.valves)) return
      const before = s.valves[a.id]
      if (before === v) return
      s.valves[a.id] = v
      ev(s, 'valvula', { id: a.id, from: before, to: v })
      log(s, 'alumno', `${valveLabel(ship, a.id)}: ${v === 0 ? 'cerrada' : v === 1 ? 'abierta' : `abierta al ${Math.round(v * 100)}%`}`)
      return
    }
    case 'hose': {
      if (!s.availableHoses.includes(a.line)) return
      if (s.hoses[a.line] === a.connected) return
      if (!a.connected && s.terminal.rate > 0) {
        log(s, 'sistema', 'No se puede desconectar la manguera con la terminal bombeando.')
        return
      }
      s.hoses[a.line] = a.connected
      ev(s, 'manguera', { line: a.line, connected: a.connected })
      log(s, 'alumno', `Manguera ${a.connected ? 'conectada' : 'desconectada'} en el manifold de la línea ${a.line}`)
      if (a.connected && s.terminal.state === 'sin_manguera') s.terminal.state = 'esperando'
      return
    }
    case 'msg': {
      const term = s.terminal
      ev(s, 'mensaje', { kind: a.kind, rate: a.rate })
      if (a.kind === 'listo') {
        log(s, 'alumno', 'Buque listo para recibir la carga.', true)
        if (!Object.values(s.hoses).some(Boolean)) {
          term.pending.push({ at: s.t + 5, kind: 'rechazo', text: 'No vemos ninguna manguera conectada. Conecten primero.' })
        } else if (term.state === 'esperando') {
          term.pending.push({ at: s.t + TERMINAL_DELAY, kind: 'autorizar' })
        }
      } else if (a.kind === 'iniciar') {
        const r = Math.min(a.rate ?? 0, term.maxRate)
        log(s, 'alumno', `Solicito iniciar bombeo a ${fmt(r)} m³/h.`, true)
        if (term.state !== 'autorizado') {
          ev(s, 'inicio_sin_autorizacion')
          term.pending.push({ at: s.t + 5, kind: 'rechazo', text: 'Todavía no confirmaron que el buque está listo.' })
        } else {
          term.pending.push({ at: s.t + TERMINAL_DELAY, kind: 'iniciar', rate: r })
        }
      } else if (a.kind === 'caudal') {
        const r = Math.min(a.rate ?? 0, term.maxRate)
        log(s, 'alumno', `Solicito cambiar el caudal a ${fmt(r)} m³/h.`, true)
        if (term.state !== 'bombeando') {
          term.pending.push({ at: s.t + 5, kind: 'rechazo', text: 'No estamos bombeando.' })
        } else {
          term.pending.push({ at: s.t + TERMINAL_DELAY, kind: 'caudal', rate: r })
        }
      } else if (a.kind === 'ultimo') {
        log(s, 'alumno', 'Aviso: estamos en el último tanque, prepárense para parar.', true)
        term.lastNotice = true
        term.pending.push({ at: s.t + 10, kind: 'standby' })
      } else if (a.kind === 'parar') {
        log(s, 'alumno', 'Solicito parar el bombeo.', true)
        if (term.state === 'bombeando') term.pending.push({ at: s.t + STOP_DELAY, kind: 'parar' })
        else term.pending.push({ at: s.t + 5, kind: 'rechazo', text: 'No estamos bombeando.' })
      }
      return
    }
    case 'ack': {
      const al = s.alarms.find((x) => x.id === a.alarm)
      if (al) al.acked = true
      return
    }
  }
}

export function valveLabel(ship: ShipDef, id: string) {
  if (id.startsWith('MF')) return `Válvula de manifold L${id.slice(2)}`
  if (id.startsWith('DROP')) return `Válvula de bajante L${id.slice(4)}`
  if (id.startsWith('BV_')) {
    const t = ship.tanks.find((x) => x.id === id.slice(3))
    return `Válvula de fondo ${t?.name ?? id.slice(3)}`
  }
  return id
}

function terminalTick(s: SimState) {
  const term = s.terminal
  const due = term.pending.filter((p) => p.at <= s.t)
  term.pending = term.pending.filter((p) => p.at > s.t)
  for (const p of due) {
    if (term.state === 'esd' && p.kind !== 'rechazo') continue
    switch (p.kind) {
      case 'rechazo':
        log(s, 'terminal', p.text ?? 'Mensaje no aceptado.')
        break
      case 'autorizar':
        if (term.state === 'esperando') {
          term.state = 'autorizado'
          ev(s, 'terminal_autoriza')
          log(s, 'terminal', 'Recibido. Pueden abrir el manifold y avisar el caudal de inicio.')
        }
        break
      case 'iniciar':
        term.state = 'bombeando'
        term.target = p.rate ?? 0
        ev(s, 'terminal_inicia', { rate: term.target })
        log(s, 'terminal', `Iniciamos bombeo, subiendo a ${fmt(term.target)} m³/h.`)
        break
      case 'caudal':
        if (term.state === 'bombeando') {
          term.target = p.rate ?? term.target
          ev(s, 'terminal_caudal', { rate: term.target })
          log(s, 'terminal', `Ajustamos el caudal a ${fmt(term.target)} m³/h.`)
        }
        break
      case 'standby':
        log(s, 'terminal', 'Entendido, quedamos en stand-by para la parada.')
        break
      case 'parar':
        if (term.state === 'bombeando') {
          term.state = 'parando'
          term.target = 0
          ev(s, 'terminal_para')
          log(s, 'terminal', 'Parando bombas de tierra.')
        }
        break
    }
  }
  // rampa de caudal
  if (term.state === 'bombeando' || term.state === 'parando') {
    const d = term.target - term.rate
    term.rate += Math.sign(d) * Math.min(Math.abs(d), RAMP * DT)
    if (term.state === 'parando' && term.rate <= 0) {
      term.rate = 0
      term.state = 'detenido'
      ev(s, 'terminal_detenida')
      log(s, 'terminal', 'Bombeo detenido. Pueden cerrar el manifold.')
    }
  }
}

/** Avanza la simulación un paso de DT segundos */
export function step(ship: ShipDef, s: SimState) {
  s.t += DT
  terminalTick(s)
  const term = s.terminal

  // conductancia por línea (válvulas en serie, tanques en paralelo)
  const lineG: Record<number, number> = {}
  const tankG: Record<string, number> = {}
  for (const l of ship.lines) {
    const mf = s.valves[`MF${l.id}`]
    const dr = s.valves[`DROP${l.id}`]
    let gt = 0
    for (const t of ship.tanks) {
      if (t.line !== l.id) continue
      const o = s.valves[`BV_${t.id}`]
      const g = o > 0 ? C_TANK * Math.sqrt(o) : 0
      tankG[t.id] = g
      gt += g
    }
    if (!s.hoses[l.id] || mf === 0 || dr === 0 || gt === 0) {
      lineG[l.id] = 0
      continue
    }
    const gmf = C_LINE_VALVE * Math.sqrt(mf)
    const gdr = C_LINE_VALVE * Math.sqrt(dr)
    lineG[l.id] = 1 / Math.sqrt(1 / gmf ** 2 + 1 / gdr ** 2 + 1 / gt ** 2)
  }
  const G = Object.values(lineG).reduce((a, b) => a + b, 0)

  // presión en el manifold
  let pTarget: number
  if (term.rate <= 0) pTarget = 0
  else if (G === 0) pTarget = s.manifoldPressure + 1.5 // sin salida: la presión sube
  else pTarget = P_STATIC + (term.rate / G) ** 2
  s.manifoldPressure += (pTarget - s.manifoldPressure) * (G === 0 && term.rate > 0 ? 1 : 0.35)
  if (s.manifoldPressure < 0.01) s.manifoldPressure = 0

  // reparto de caudal
  for (let i = 0; i < ship.tanks.length; i++) s.tanks[i].flow = 0
  for (const l of ship.lines) {
    const ql = G > 0 ? (term.rate * lineG[l.id]) / G : 0
    s.lines[l.id] = { flow: ql, pressure: s.hoses[l.id] && s.valves[`MF${l.id}`] > 0 ? s.manifoldPressure : 0 }
    if (ql <= 0) continue
    const gsum = ship.tanks.filter((t) => t.line === l.id).reduce((a, t) => a + tankG[t.id], 0)
    ship.tanks.forEach((t, i) => {
      if (t.line !== l.id || tankG[t.id] === 0) return
      s.tanks[i].flow = (ql * tankG[t.id]) / gsum
    })
  }

  // integración de volúmenes, rebalse y alarmas de nivel
  ship.tanks.forEach((t, i) => {
    const ts = s.tanks[i]
    const before = ts.volume / cap100(t)
    ts.volume += (ts.flow * DT) / 3600
    const max = cap100(t)
    if (ts.volume > max) {
      const extra = ts.volume - max
      ts.volume = max
      s.spilled += extra
      if (!s.events.some((e) => e.type === 'rebalse' && e.data?.tank === t.id)) ev(s, 'rebalse', { tank: t.id })
      raise(s, `OVF_${t.id}`, `Rebalse en ${t.name}: carga derramada en cubierta`, 'critica')
    }
    const fill = ts.volume / max
    if (t.kind !== 'ballast') {
      if (before < 0.95 && fill >= 0.95) ev(s, 'cruza95', { tank: t.id, valve: s.valves[`BV_${t.id}`], rate: term.rate })
      if (before < 0.98 && fill >= 0.98) ev(s, 'cruza98', { tank: t.id, rate: term.rate, flow: ts.flow })
      if (fill >= 0.98) raise(s, `HH_${t.id}`, `Nivel muy alto (98%) en ${t.name}`, 'critica')
      else clear(s, `HH_${t.id}`)
      if (fill >= 0.95) raise(s, `H_${t.id}`, `Nivel alto (95%) en ${t.name}`, 'alta')
      else clear(s, `H_${t.id}`)
    }
  })

  // presión
  if (s.manifoldPressure >= P_HIGH) raise(s, 'P_HIGH', `Presión alta en el manifold (> ${P_HIGH} bar)`, 'alta')
  else if (s.manifoldPressure < P_HIGH - 0.5) clear(s, 'P_HIGH')
  if (s.manifoldPressure >= P_ESD && term.state !== 'esd') {
    term.state = 'esd'
    term.rate = 0
    term.target = 0
    term.pending = []
    ev(s, 'esd')
    raise(s, 'ESD', 'Parada de emergencia (ESD) disparada por la terminal por sobrepresión', 'critica')
    log(s, 'terminal', '¡Parada de emergencia! Sobrepresión en la línea. Revisen la alineación.')
  }

  s.hydro = hydroOf(ship, s)
}

export function runSteps(ship: ShipDef, s: SimState, n: number) {
  for (let i = 0; i < n; i++) step(ship, s)
}

export function fillOf(ship: ShipDef, s: SimState, id: string) {
  const i = ship.tanks.findIndex((t) => t.id === id)
  return s.tanks[i].volume / cap100(ship.tanks[i])
}

export function ullageOf(ship: ShipDef, s: SimState, id: string) {
  const i = ship.tanks.findIndex((t) => t.id === id)
  const t = ship.tanks[i]
  const level = s.tanks[i].volume / (tankLength(ship, t) * t.breadth)
  return ship.tankDepth - level
}
