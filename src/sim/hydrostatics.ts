// Hidrostática y estabilidad APROXIMADAS a partir de las dimensiones principales
// y el coeficiente de bloque (formulación de forma de casco sencilla).
// Sirve para enseñar tendencias (calado, asiento, escora, GM, superficie libre),
// no para cálculos reales de un buque.

import type { ShipDef } from './ship'
import { cap100, tankLength, tankTcg } from './ship'

export interface Weight {
  mass: number // t
  lcg: number // m desde PPpp
  vcg: number // m sobre la quilla
  tcg: number // m, + estribor
  fsm: number // momento de superficie libre (t·m)
}

export interface Hydro {
  displacement: number
  deadweight: number
  draftMean: number
  draftAft: number
  draftFwd: number
  trim: number // + apopante (por popa)
  heelDeg: number // + escora a estribor
  kg: number
  km: number
  gm: number
  fsCorrection: number
  gmCorrected: number
  lcg: number
  lcb: number
}

export interface TankContent {
  volume: number // m³ observados
  density: number // t/m³
}

/** Peso y centros de un tanque prismático con un volumen dado */
export function tankWeight(ship: ShipDef, tankIdx: number, c: TankContent): Weight {
  const t = ship.tanks[tankIdx]
  const len = tankLength(ship, t)
  const area = len * t.breadth
  const level = Math.min(c.volume / area, ship.tankDepth)
  const mass = c.volume * c.density
  const fill = c.volume / cap100(t)
  // superficie libre sólo en tanques parcialmente llenos
  const slack = fill > 0.005 && fill < 0.98
  const fsm = slack ? (c.density * len * t.breadth ** 3) / 12 : 0
  return {
    mass,
    lcg: t.lcg,
    vcg: ship.tankBottom + level / 2,
    tcg: tankTcg(ship, t),
    fsm,
  }
}

export function computeHydro(ship: ShipDef, weights: Weight[]): Hydro {
  const all: Weight[] = [
    { mass: ship.lightship, lcg: ship.lightshipLcg, vcg: ship.lightshipKg, tcg: 0, fsm: 0 },
    ...ship.constants.map((c) => ({ mass: c.mass, lcg: c.lcg, vcg: c.vcg, tcg: 0, fsm: 0 })),
    ...weights,
  ]
  const disp = all.reduce((s, w) => s + w.mass, 0)
  const lcg = all.reduce((s, w) => s + w.mass * w.lcg, 0) / disp
  const kg = all.reduce((s, w) => s + w.mass * w.vcg, 0) / disp
  const tcg = all.reduce((s, w) => s + w.mass * w.tcg, 0) / disp
  const fsmTotal = all.reduce((s, w) => s + w.fsm, 0)

  const { lpp: L, beam: B, cb, seaDensity: rho } = ship
  const vol = disp / rho
  const draft = vol / (L * B * cb)
  const cwp = (1 + 2 * cb) / 3

  // Morrish para KB, momentos de inercia de la flotación aproximados
  const kb = draft * (5 / 6 - cb / (3 * cwp))
  const iT = (cwp ** 2 / 11.7) * L * B ** 3
  const iL = ((3 * cwp ** 2) / ((1 + cwp) * (1 + 2 * cwp))) * (B * L ** 3) / 12
  const bmT = iT / vol
  const bmL = iL / vol
  const km = kb + bmT
  const gm = km - kg
  const fsCorrection = fsmTotal / disp
  const gmCorrected = gm - fsCorrection
  const gmL = kb + bmL - kg

  // LCB a proa de la sección media, retrocediendo a medida que aumenta el calado
  const lcb = L * (0.535 - (0.022 * draft) / ship.summerDraft)
  const trim = ((lcb - lcg) * L) / gmL // + por popa
  const draftAft = draft + trim / 2
  const draftFwd = draft - trim / 2
  const heelDeg = gmCorrected > 0.05 ? (Math.atan(tcg / gmCorrected) * 180) / Math.PI : tcg > 0 ? 30 : tcg < 0 ? -30 : 0

  return {
    displacement: disp,
    deadweight: disp - ship.lightship,
    draftMean: draft,
    draftAft,
    draftFwd,
    trim,
    heelDeg,
    kg,
    km,
    gm,
    fsCorrection,
    gmCorrected,
    lcg,
    lcb,
  }
}
