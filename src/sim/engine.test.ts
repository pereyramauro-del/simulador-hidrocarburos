import { describe, expect, it } from 'vitest'
import { VLCC, cap100, tankById } from './ship'
import { applyAction, createState, fillOf, step, type Action, type SimState } from './engine'
import { advance, exerciseById } from './exercises'
import { evaluateEx3 } from './evaluation'
import { replay } from './replay'
import type { TimedAction } from './worker'

const ex3 = exerciseById('ex3')!

function runUntil(s: SimState, cond: (s: SimState) => boolean, max = 6 * 3600) {
  const start = s.t
  while (!cond(s) && s.t - start < max) step(VLCC, s)
}

/** Ejecuta el procedimiento correcto del ejercicio 3 y devuelve estado y acciones. */
function correctRun() {
  const s = createState(VLCC, ex3.initial!())
  const log: TimedAction[] = []
  const act = (a: Action) => {
    log.push({ t: s.t, action: a })
    applyAction(VLCC, s, a)
  }
  act({ type: 'hose', line: 1, connected: true })
  act({ type: 'valve', id: 'DROP1', opening: 1 })
  act({ type: 'valve', id: 'BV_CT1', opening: 1 })
  act({ type: 'msg', kind: 'listo' })
  runUntil(s, (x) => x.terminal.state === 'autorizado')
  act({ type: 'valve', id: 'MF1', opening: 1 })
  act({ type: 'msg', kind: 'iniciar', rate: 5000 })
  runUntil(s, (x) => x.terminal.rate >= 5000)
  act({ type: 'msg', kind: 'caudal', rate: 6000 })
  runUntil(s, () => fillOf(VLCC, s, 'CT1') >= 0.88)
  act({ type: 'msg', kind: 'caudal', rate: 2000 })
  runUntil(s, (x) => x.terminal.rate <= 2000)
  act({ type: 'valve', id: 'BV_CT1', opening: 0.5 })
  act({ type: 'msg', kind: 'ultimo' })
  runUntil(s, () => fillOf(VLCC, s, 'CT1') >= 0.95)
  act({ type: 'valve', id: 'BV_CT1', opening: 0.25 })
  act({ type: 'msg', kind: 'parar' })
  runUntil(s, (x) => x.terminal.state === 'detenido')
  act({ type: 'valve', id: 'MF1', opening: 0 })
  act({ type: 'valve', id: 'DROP1', opening: 0 })
  act({ type: 'valve', id: 'BV_CT1', opening: 0 })
  return { s, log }
}

describe('motor de carga', () => {
  it('estado inicial en lastre con calados razonables', () => {
    const s = createState(VLCC, ex3.initial!())
    expect(s.hydro.draftMean).toBeGreaterThan(3)
    expect(s.hydro.draftMean).toBeLessThan(10)
    expect(s.hydro.gmCorrected).toBeGreaterThan(5)
  })

  it('procedimiento correcto del ejercicio 3 aprueba con 100', () => {
    const { s } = correctRun()
    const f = fillOf(VLCC, s, 'CT1')
    expect(f).toBeGreaterThanOrEqual(0.95)
    expect(f).toBeLessThanOrEqual(0.985)
    const ev = evaluateEx3(VLCC, s)
    const failed = ev.items.filter((i) => !i.ok)
    expect(failed).toEqual([])
    expect(ev.score).toBe(100)
  })

  it('cargar CT1 aumenta calado y asiento por proa', () => {
    const { s } = correctRun()
    const s0 = createState(VLCC, ex3.initial!())
    expect(s.hydro.draftMean).toBeGreaterThan(s0.hydro.draftMean)
    expect(s.hydro.trim).toBeLessThan(s0.hydro.trim) // CT1 está a proa
  })

  it('bombear con el manifold cerrado dispara la parada de emergencia', () => {
    const s = createState(VLCC, ex3.initial!())
    applyAction(VLCC, s, { type: 'hose', line: 1, connected: true })
    applyAction(VLCC, s, { type: 'msg', kind: 'listo' })
    runUntil(s, (x) => x.terminal.state === 'autorizado')
    applyAction(VLCC, s, { type: 'msg', kind: 'iniciar', rate: 5000 })
    runUntil(s, (x) => x.terminal.state === 'esd', 600)
    expect(s.terminal.state).toBe('esd')
    expect(evaluateEx3(VLCC, s).items.find((i) => i.id === 'esd')!.ok).toBe(false)
  })

  it('sin parar a tiempo el tanque rebalsa y se registra', () => {
    const s = createState(VLCC, ex3.initial!())
    for (const a of [
      { type: 'hose', line: 1, connected: true },
      { type: 'valve', id: 'DROP1', opening: 1 },
      { type: 'valve', id: 'BV_CT1', opening: 1 },
      { type: 'msg', kind: 'listo' },
    ] as Action[]) applyAction(VLCC, s, a)
    runUntil(s, (x) => x.terminal.state === 'autorizado')
    applyAction(VLCC, s, { type: 'valve', id: 'MF1', opening: 1 })
    applyAction(VLCC, s, { type: 'msg', kind: 'iniciar', rate: 5000 })
    runUntil(s, (x) => x.spilled > 10, 12 * 3600)
    expect(s.spilled).toBeGreaterThan(10)
    expect(s.tanks[VLCC.tanks.indexOf(tankById(VLCC, 'CT1'))].volume).toBeCloseTo(cap100(tankById(VLCC, 'CT1')))
    expect(evaluateEx3(VLCC, s).passed).toBe(false)
  })

  it('la repetición reproduce exactamente la sesión', () => {
    const { s, log } = correctRun()
    const r = replay(VLCC, ex3.initial!(), log, s.t)
    expect(r.tanks.map((x) => x.volume)).toEqual(s.tanks.map((x) => x.volume))
    expect(r.events.length).toBe(s.events.length)
  })
})

describe('guía de pasos del ejercicio 3', () => {
  it('seguir solo lo que la guía resalta lleva a 100', () => {
    const steps = ex3.steps!
    const s = createState(VLCC, ex3.initial!())
    let selected: string | null = null
    let clicks = 0
    let i = 0
    for (let guard = 0; guard < 200000; guard++) {
      i = advance(steps, s, i)
      if (i === steps.length) break
      const g = steps[i].guide!(s, { selected, factor: 20 })
      const t = g.targets.find((x) => !x.startsWith('view:') && !x.startsWith('speed:') && x !== 'rate')
      if (!t) {
        step(VLCC, s) // nada que tocar: avanza el tiempo
        continue
      }
      clicks++
      if (t.startsWith('hose:')) applyAction(VLCC, s, { type: 'hose', line: Number(t.slice(5)), connected: true })
      else if (t.startsWith('valve:')) selected = t.slice(6)
      else if (t === 'panel:open') applyAction(VLCC, s, { type: 'valve', id: selected!, opening: 1 })
      else if (t === 'panel:close') applyAction(VLCC, s, { type: 'valve', id: selected!, opening: 0 })
      else if (t.startsWith('panel:')) applyAction(VLCC, s, { type: 'valve', id: selected!, opening: Number(t.slice(6)) / 100 })
      else if (t.startsWith('msg:')) {
        const kind = t.slice(4) as 'listo' | 'iniciar' | 'caudal' | 'ultimo' | 'parar'
        applyAction(VLCC, s, { type: 'msg', kind, rate: kind === 'iniciar' ? 5000 : kind === 'caudal' ? 2000 : undefined })
      } else throw new Error(`destino desconocido: ${t}`)
      step(VLCC, s)
    }
    expect(i).toBe(steps.length)
    const ev = evaluateEx3(VLCC, s)
    expect(ev.items.filter((x) => !x.ok)).toEqual([])
    expect(ev.score).toBe(100)
    expect(clicks).toBeLessThan(30)
  })
})
