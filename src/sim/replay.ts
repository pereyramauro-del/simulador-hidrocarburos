import type { ShipDef } from './ship'
import { applyAction, createState, step, type InitialCondition, type SimState } from './engine'
import type { TimedAction } from './worker'

/** Reproduce una sesión a partir de la condición inicial y el registro de acciones. */
export function replay(ship: ShipDef, ic: InitialCondition, actions: TimedAction[], until: number): SimState {
  const s = createState(ship, ic)
  let i = 0
  while (true) {
    while (i < actions.length && actions[i].t <= s.t) applyAction(ship, s, actions[i++].action)
    if (s.t >= until) break
    step(ship, s)
  }
  return s
}
