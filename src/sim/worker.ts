// El motor corre en un Web Worker para no trabar la interfaz.
import { VLCC } from './ship'
import { applyAction, createState, step, type Action, type SimState } from './engine'
import { exerciseById } from './exercises'
import { replay } from './replay'

export type ToWorker =
  | { type: 'init'; exerciseId: string; resume?: { actions: TimedAction[]; t: number; factor: number } }
  | { type: 'action'; action: Action }
  | { type: 'speed'; factor: number }
  | { type: 'pause'; paused: boolean }

export interface TimedAction {
  t: number
  action: Action
}

export type FromWorker = {
  type: 'state'
  state: SimState
  actions: TimedAction[]
  paused: boolean
  factor: number
}

let state: SimState | null = null
let actions: TimedAction[] = []
let paused = true
let factor = 1
let acc = 0

const post = () => {
  if (!state) return
  const msg: FromWorker = { type: 'state', state, actions, paused, factor }
  self.postMessage(msg)
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data
  if (m.type === 'init') {
    const ex = exerciseById(m.exerciseId)
    if (!ex?.initial) return
    if (m.resume) {
      // seguir una práctica guardada: se reproduce hasta el mismo instante
      state = replay(VLCC, ex.initial(), m.resume.actions, m.resume.t)
      actions = [...m.resume.actions]
      factor = m.resume.factor
    } else {
      state = createState(VLCC, ex.initial())
      actions = []
      factor = 1
    }
    paused = false
    acc = 0
  } else if (m.type === 'action' && state) {
    actions.push({ t: state.t, action: m.action })
    applyAction(VLCC, state, m.action)
  } else if (m.type === 'speed') {
    factor = m.factor
  } else if (m.type === 'pause') {
    paused = m.paused
  }
  post()
}

let tick = 0
setInterval(() => {
  if (!state) return
  if (!paused) {
    acc += factor * 0.1
    while (acc >= 1) {
      step(VLCC, state)
      acc -= 1
    }
  }
  tick++
  if (tick % 2 === 0) post()
}, 100)
