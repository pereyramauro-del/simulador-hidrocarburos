// Modelo del buque de referencia: VLCC basado en el M.T. "Polar Lady" (simulador
// Kongsberg VLCC-II), con los datos publicados en el TFG "Elaboración de un manual
// de simulador de cargas líquidas VLCC" (Univ. de La Laguna, 2018).
//
// Las capacidades al 98% y los LCG vienen del TFG. Profundidades, mangas de tanque,
// TCG y toda la hidrostática son APROXIMACIONES DIDÁCTICAS: el TFG no publica las
// tablas hidrostáticas del buque. No usar estos números para operaciones reales.

export type TankKind = 'cargo' | 'slop' | 'ballast'
export type Side = 'P' | 'C' | 'S'

export interface TankDef {
  id: string
  name: string
  kind: TankKind
  side: Side
  /** Volumen al 98% (m³), según el TFG */
  cap98: number
  /** Centro de gravedad longitudinal desde la perpendicular de popa (m) */
  lcg: number
  /** Manga del tanque (m) — aproximada */
  breadth: number
  /** Línea de carga a la que conecta (1–4). Tanques de lastre: 0 */
  line: number
}

export interface ShipDef {
  id: string
  name: string
  lpp: number
  loa: number
  beam: number
  depth: number
  summerDraft: number
  cb: number
  lightship: number
  lightshipLcg: number
  lightshipKg: number
  /** Pesos fijos: combustible, agua dulce y consumibles (aproximado) */
  constants: { name: string; mass: number; lcg: number; vcg: number }[]
  /** Profundidad útil de los tanques de carga, de fondo a referencia de sonda (m) */
  tankDepth: number
  /** Altura del fondo del tanque sobre la quilla (doble fondo, m) */
  tankBottom: number
  seaDensity: number
  tanks: TankDef[]
  lines: { id: number; color: string; name: string }[]
}

const CT_B = 23.5
const WT_B = 11.75

export const VLCC: ShipDef = {
  id: 'vlcc-polar-lady',
  name: 'VLCC de referencia (tipo M.T. "Polar Lady")',
  lpp: 295,
  loa: 305,
  beam: 47,
  depth: 30.4,
  summerDraft: 19.07,
  cb: 0.801,
  lightship: 217552 - 187997, // desplazamiento en verano − peso muerto
  lightshipLcg: 141,
  lightshipKg: 15.5,
  constants: [
    { name: 'Fuel-oil pesado (depósito de popa)', mass: 3400, lcg: 48.51, vcg: 13.96 },
    { name: 'Agua dulce, diésel y consumibles', mass: 900, lcg: 20, vcg: 14 },
  ],
  tankDepth: 25.5,
  tankBottom: 2.6,
  seaDensity: 1.025,
  lines: [
    { id: 1, color: '#2f9e44', name: 'Línea 1' },
    { id: 2, color: '#e0b100', name: 'Línea 2' },
    { id: 3, color: '#8d5a2b', name: 'Línea 3' },
    { id: 4, color: '#d9480f', name: 'Línea 4' },
  ],
  tanks: [
    // Línea 1: CT1 y WT5 P/S
    { id: 'CT1', name: 'CT1', kind: 'cargo', side: 'C', cap98: 30813, lcg: 235.23, breadth: CT_B, line: 1 },
    { id: 'WT5P', name: 'WT5P', kind: 'cargo', side: 'P', cap98: 8808, lcg: 86.85, breadth: WT_B, line: 1 },
    { id: 'WT5S', name: 'WT5S', kind: 'cargo', side: 'S', cap98: 8808, lcg: 86.85, breadth: WT_B, line: 1 },
    // Línea 2: CT4 y WT1 P/S
    { id: 'CT4', name: 'CT4', kind: 'cargo', side: 'C', cap98: 30806, lcg: 76.98, breadth: CT_B, line: 2 },
    { id: 'WT1P', name: 'WT1P', kind: 'cargo', side: 'P', cap98: 12554, lcg: 232.9, breadth: WT_B, line: 2 },
    { id: 'WT1S', name: 'WT1S', kind: 'cargo', side: 'S', cap98: 12554, lcg: 232.9, breadth: WT_B, line: 2 },
    // Línea 3: CT3, WT2 P/S y slops (WT6 P/S)
    { id: 'CT3', name: 'CT3', kind: 'cargo', side: 'C', cap98: 30818, lcg: 129.72, breadth: CT_B, line: 3 },
    { id: 'WT2P', name: 'WT2P', kind: 'cargo', side: 'P', cap98: 9283, lcg: 191.93, breadth: WT_B, line: 3 },
    { id: 'WT2S', name: 'WT2S', kind: 'cargo', side: 'S', cap98: 9283, lcg: 191.93, breadth: WT_B, line: 3 },
    { id: 'WT6P', name: 'Slop P', kind: 'slop', side: 'P', cap98: 4024, lcg: 60.53, breadth: WT_B, line: 3 },
    { id: 'WT6S', name: 'Slop S', kind: 'slop', side: 'S', cap98: 4024, lcg: 60.53, breadth: WT_B, line: 3 },
    // Línea 4: CT2 y WT4 P/S
    { id: 'CT2', name: 'CT2', kind: 'cargo', side: 'C', cap98: 30818, lcg: 182.46, breadth: CT_B, line: 4 },
    { id: 'WT4P', name: 'WT4P', kind: 'cargo', side: 'P', cap98: 14514, lcg: 129.73, breadth: WT_B, line: 4 },
    { id: 'WT4S', name: 'WT4S', kind: 'cargo', side: 'S', cap98: 14514, lcg: 129.73, breadth: WT_B, line: 4 },
    // Lastre segregado
    { id: 'WT3P', name: 'WT3P', kind: 'ballast', side: 'P', cap98: 5231, lcg: 165.62, breadth: WT_B, line: 0 },
    { id: 'WT3S', name: 'WT3S', kind: 'ballast', side: 'S', cap98: 5231, lcg: 165.62, breadth: WT_B, line: 0 },
    { id: 'FP', name: 'Pique proa', kind: 'ballast', side: 'C', cap98: 12113, lcg: 276.19, breadth: 30, line: 0 },
  ],
}

/** Capacidad al 100% (m³) */
export const cap100 = (t: TankDef) => t.cap98 / 0.98

/** Eslora aproximada del tanque (prisma de profundidad tankDepth y manga breadth) */
export const tankLength = (ship: ShipDef, t: TankDef) => cap100(t) / (ship.tankDepth * t.breadth)

/** Centro de gravedad transversal (m, + estribor) */
export const tankTcg = (ship: ShipDef, t: TankDef) => {
  if (t.side === 'C') return 0
  const off = ship.tanks.find((x) => x.id === 'CT1')!.breadth / 2 + t.breadth / 2
  return t.side === 'S' ? off : -off
}

export const tankById = (ship: ShipDef, id: string) => {
  const t = ship.tanks.find((x) => x.id === id)
  if (!t) throw new Error(`Tanque desconocido: ${id}`)
  return t
}
