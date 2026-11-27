// Catálogo de ejercicios: los 14 de la propuesta, ordenados según los bloques
// del Curso Modelo OMI 2.06. En este prototipo funcionan el 3 y la práctica libre.

import type { ShipDef } from './ship'
import { VLCC } from './ship'
import type { InitialCondition, SimState } from './engine'
import { fillOf } from './engine'
import { evaluateEx3, type Evaluation } from './evaluation'

export interface GuideUI {
  /** válvula seleccionada en el panel */
  selected: string | null
  /** factor de tiempo actual */
  factor: number
}

export interface Guide {
  /** controles a resaltar (ver src/ui/guide.tsx) */
  targets: string[]
  /** si no hay nada que tocar: qué se está esperando */
  wait?: string
}

export interface TutorialStep {
  text: string
  view?: 'lineas' | 'terminal' | 'tanques' | 'registro'
  done: (s: SimState) => boolean
  guide?: (s: SimState, ui: GuideUI) => Guide
}

/** Qué tocar para dejar una válvula como se pide: primero la válvula, después el botón del panel. */
function valveTask(s: SimState, ui: GuideUI, id: string, want: 'abrir' | 'cerrar' | number): string[] | null {
  const v = s.valves[id]
  const ok = want === 'abrir' ? v === 1 : want === 'cerrar' ? v === 0 : v > 0 && v <= want + 1e-9
  if (ok) return null
  if (ui.selected !== id) return [`valve:${id}`]
  return [want === 'abrir' ? 'panel:open' : want === 'cerrar' ? 'panel:close' : `panel:${Math.round(want * 100)}`]
}

const first = (...tasks: (string[] | null)[]) => tasks.find((t) => t) ?? []

/** Espera: sugiere acelerar el tiempo si va lento */
const waiting = (ui: GuideUI, wait: string, extra: string[] = [], speed = 20): Guide => ({
  targets: [...extra, ...(ui.factor < speed ? [`speed:${speed}`] : [])],
  wait,
})

export interface Exercise {
  id: string
  number: number | null
  title: string
  /** Bloque del Curso Modelo OMI 2.06 (1–5); 0 = práctica libre */
  block: number
  available: boolean
  evaluated: boolean
  summary: string
  briefing?: string[]
  objectives?: string[]
  initial?: () => InitialCondition
  steps?: TutorialStep[]
  evaluate?: (ship: ShipDef, s: SimState) => Evaluation
  canFinish?: (s: SimState) => boolean
}

// Condición de lastre normal: lastre segregado lleno, tanques de carga vacíos
const ballastCondition = (ship: ShipDef): Record<string, number> => {
  const v: Record<string, number> = {}
  for (const t of ship.tanks) v[t.id] = t.kind === 'ballast' && t.id !== 'FP' ? t.cap98 : t.id === 'FP' ? t.cap98 * 0.35 : 0
  return v
}

const ex3Initial = (): InitialCondition => ({
  volumes: ballastCondition(VLCC),
  availableHoses: [1],
  product: 'Crudo liviano',
  density: 0.85,
  maxRate: 20000,
})

const freeInitial = (): InitialCondition => ({
  volumes: ballastCondition(VLCC),
  availableHoses: [1, 2, 3, 4],
  product: 'Crudo liviano',
  density: 0.85,
  maxRate: 20000,
})

/**
 * Avance de los pasos: solo hacia adelante. Un paso cumplido no vuelve a quedar
 * pendiente aunque después cambie el estado (por ejemplo, cerrar el manifold al final).
 */
export function advance(steps: TutorialStep[], s: SimState, from: number) {
  let i = from
  while (i < steps.length && steps[i].done(s)) i++
  return i
}

const sent = (s: SimState, kind: string) => s.events.some((e) => e.type === 'mensaje' && e.data?.kind === kind)

export const EXERCISES: Exercise[] = [
  { id: 'ex1', number: 1, title: 'Familiarización con el buque y los mímicos', block: 1, available: false, evaluated: true, summary: 'Ubicar tanques, líneas, válvulas y bombas; leer el calculador de carga.' },
  { id: 'ex2', number: 2, title: 'Arranque de la planta de gas inerte e inertización', block: 2, available: false, evaluated: true, summary: 'Secuencia de arranque, O2 de suministro ≤ 5% y tanques < 8%.' },
  {
    id: 'ex3',
    number: 3,
    title: 'Cargar un tanque (CT1)',
    block: 4,
    available: true,
    evaluated: true,
    summary: 'Alineación, comunicación con la terminal, inicio a caudal reducido y topeo al 98%.',
    briefing: [
      'El buque está atracado en la terminal de carga, en condición de lastre normal: lastre segregado lleno y tanques de carga vacíos e inertizados.',
      'Hay que cargar crudo liviano (densidad 0,85 a 15 °C) solo en el tanque central CT1, que pertenece a la línea 1. La terminal tiene una manguera disponible para el manifold de la línea 1.',
      'Todas las válvulas están cerradas. El tanque se considera lleno al 98% de su volumen (requisito OMI); por encima de eso hay riesgo de rebalse por dilatación.',
      'Recordá que la terminal tarda en responder: unos 20 s para cada pedido y unos 30 s más para empezar a parar. Las bombas de tierra suben y bajan el caudal de a poco.',
    ],
    objectives: [
      'Alinear la línea 1 hacia CT1 antes de abrir el manifold.',
      'Abrir el manifold solo después de la confirmación de la terminal.',
      'Iniciar a caudal reducido (≤ 5.000 m³/h) y verificar que la carga entra solo en CT1.',
      'Estrangular la válvula de CT1 y bajar el caudal al acercarse al llenado.',
      'Avisar a la terminal y pedir la parada a tiempo para terminar entre 95% y 98%.',
      'Dejar manifold y válvulas cerradas al final.',
    ],
    initial: ex3Initial,
    steps: [
      { text: 'Conectá la manguera al manifold de la línea 1.', view: 'terminal', done: (s) => s.hoses[1], guide: () => ({ targets: ['hose:1'] }) },
      { text: 'Alineá la línea 1: abrí la válvula de bajante L1 y la válvula de fondo de CT1.', view: 'lineas', done: (s) => s.valves.DROP1 > 0 && s.valves.BV_CT1 > 0, guide: (s, ui) => ({ targets: first(valveTask(s, ui, 'DROP1', 'abrir'), valveTask(s, ui, 'BV_CT1', 'abrir')) }) },
      { text: 'Avisá a la terminal que el buque está listo para recibir.', view: 'terminal', done: (s) => sent(s, 'listo'), guide: () => ({ targets: ['msg:listo'] }) },
      { text: 'Esperá la confirmación de la terminal.', view: 'terminal', done: (s) => s.events.some((e) => e.type === 'terminal_autoriza'), guide: (_s, ui) => waiting(ui, 'La terminal responde en unos 20 segundos.') },
      { text: 'Abrí la válvula de manifold L1.', view: 'lineas', done: (s) => s.valves.MF1 > 0, guide: (s, ui) => ({ targets: first(valveTask(s, ui, 'MF1', 'abrir')) }) },
      { text: 'Pedí iniciar el bombeo a caudal reducido (hasta 5.000 m³/h).', view: 'terminal', done: (s) => s.events.some((e) => e.type === 'terminal_inicia'), guide: (s, ui) => (s.terminal.pending.some((p) => p.kind === 'iniciar') ? waiting(ui, 'La terminal está por iniciar el bombeo.') : { targets: ['rate', 'msg:iniciar'] }) },
      { text: 'Verificá en Líneas o Tanques que la carga entra solo en CT1. Si querés, pedí subir el caudal vigilando la presión (con un solo tanque, no más de unos 6.000 m³/h).', view: 'tanques', done: (s) => fillOf(VLCC, s, 'CT1') > 0.3, guide: (_s, ui) => waiting(ui, 'La carga está entrando en CT1. Acelerá el tiempo y fijate que no entre en otro tanque.', ['view:tanques'], 60) },
      { text: 'Con un vacío cercano a 3 m (≈ 88%), pedí caudal de topeo (por ejemplo 2.000 m³/h). Cuando el caudal haya bajado, estrangulá la válvula de CT1 al 50%: si la cerrás antes, sube la presión.', view: 'lineas', done: (s) => s.valves.BV_CT1 <= 0.5 && s.terminal.target <= 2500 && fillOf(VLCC, s, 'CT1') > 0.85, guide: (s, ui) => {
        const f = fillOf(VLCC, s, 'CT1')
        if (f < 0.85) return waiting(ui, `CT1 va por ${Math.round(f * 100)}%. Seguí cargando hasta cerca del 88%.`, ['view:tanques'], 60)
        const slow = ui.factor > 5 ? ['speed:5'] : []
        if (s.terminal.target > 2500 && !s.terminal.pending.some((p) => p.kind === 'caudal')) return { targets: ['rate', 'msg:caudal', ...slow] }
        if (s.terminal.pending.some((p) => p.kind === 'caudal') || s.terminal.rate > 2500) return { targets: slow, wait: 'La terminal está bajando el caudal. Cuando baje, estrangulá CT1.' }
        return { targets: [...first(valveTask(s, ui, 'BV_CT1', 0.5)), ...slow] }
      } },
      { text: 'Avisá a la terminal que es el último tanque. Al llegar al 95%, estrangulá CT1 al 25%.', view: 'terminal', done: (s) => sent(s, 'ultimo') && s.valves.BV_CT1 <= 0.25, guide: (s, ui) => {
        if (!sent(s, 'ultimo')) return { targets: ['msg:ultimo'] }
        if (fillOf(VLCC, s, 'CT1') < 0.95) return { targets: ['view:tanques', ...(ui.factor !== 20 ? ['speed:20'] : [])], wait: 'Al llegar al 95% vas a estrangular CT1 al 25%. A ×20 llegás a tiempo de reaccionar.' }
        return { targets: first(valveTask(s, ui, 'BV_CT1', 0.25)) }
      } },
      { text: 'Pedí la parada antes del 98%, teniendo en cuenta la demora de la terminal.', view: 'terminal', done: (s) => sent(s, 'parar'), guide: () => ({ targets: ['msg:parar'] }) },
      { text: 'Con el bombeo detenido, cerrá el manifold L1, el bajante L1 y la válvula de CT1. Después tocá Finalizar.', view: 'lineas', done: (s) => s.terminal.state === 'detenido' && s.valves.MF1 === 0 && s.valves.BV_CT1 === 0 && s.valves.DROP1 === 0, guide: (s, ui) => {
        if (s.terminal.state !== 'detenido') return waiting(ui, 'La terminal está parando las bombas: tarda unos 30 segundos más la rampa.')
        return { targets: first(valveTask(s, ui, 'MF1', 'cerrar'), valveTask(s, ui, 'DROP1', 'cerrar'), valveTask(s, ui, 'BV_CT1', 'cerrar')) }
      } },
    ],
    evaluate: evaluateEx3,
    canFinish: () => true,
  },
  { id: 'ex4', number: 4, title: 'Deslastrar un tanque de carga vía ODM', block: 3, available: false, evaluated: true, summary: 'Arranque de bomba, límite de 15 ppm, desvío a slop y agotamiento.' },
  { id: 'ex5', number: 5, title: 'Cálculo de carga', block: 4, available: false, evaluated: true, summary: 'Volumen a 15 °C con VCF, peso en vacío y en aire, API y barriles.' },
  { id: 'ex6', number: 6, title: 'Plan de carga', block: 4, available: false, evaluated: true, summary: 'Secuencia de tanques, deslastrado coordinado, último tanque, calados finales.' },
  { id: 'ex7', number: 7, title: 'Carga completa del buque', block: 4, available: false, evaluated: true, summary: 'Ejecutar el plan sin rebalses y con esfuerzos dentro de límites.' },
  { id: 'ex8', number: 8, title: 'Estabilidad y esfuerzos', block: 4, available: false, evaluated: true, summary: 'Interpretar GZ, GM, cortantes, flectores, arrufo y quebranto.' },
  { id: 'ex9', number: 9, title: 'Descarga con asiento de drenado y agotamiento', block: 4, available: false, evaluated: true, summary: 'Asiento de 5–6 m, gas inerte positivo, sin cavitación sostenida.' },
  { id: 'ex10', number: 10, title: 'Lavado con crudo (COW)', block: 2, available: false, evaluated: true, summary: 'O2 < 8%, línea de lavado ≥ 8 bar, solo tanques designados.' },
  { id: 'ex11', number: 11, title: 'Lastrado: segregado, sucio y limpio', block: 3, available: false, evaluated: true, summary: 'Separación de dos válvulas, esfuerzos y asiento para la travesía.' },
  { id: 'ex12', number: 12, title: 'Lavado con agua y manejo de lavazas', block: 2, available: false, evaluated: true, summary: 'Caja de mar, calentador y máquinas; lavazas a slop.' },
  { id: 'ex13', number: 13, title: 'Decantación de slops y carga sobre residuos (LOT)', block: 2, available: false, evaluated: true, summary: 'Sedimentación, interfaz agua/aceite y descarga sin superar 15 ppm.' },
  { id: 'ex14', number: 14, title: 'Purga y desgasificación para entrar a un tanque', block: 2, available: false, evaluated: true, summary: 'Purga a ≤ 2% de hidrocarburos; 21% de O2 y < 1% del LEL.' },
  {
    id: 'libre',
    number: null,
    title: 'Práctica libre de carga',
    block: 0,
    available: true,
    evaluated: false,
    summary: 'Las 4 líneas disponibles, sin plan ni nota. Para probar caudales, repartos y topeos.',
    briefing: [
      'Buque en lastre normal, tanques de carga vacíos. La terminal tiene mangueras para los 4 manifolds y puede bombear hasta 20.000 m³/h.',
      'No hay evaluación: cargá los tanques en el orden que quieras y observá cómo cambian el reparto de caudal, la presión, los calados, el asiento, la escora y el GM.',
    ],
    initial: freeInitial,
    canFinish: () => true,
  },
]

export const exerciseById = (id: string) => EXERCISES.find((e) => e.id === id)
