import { useCallback, useEffect, useRef, useState } from 'react'
import type { Action } from '../sim/engine'
import type { FromWorker, TimedAction, ToWorker } from '../sim/worker'
import SimWorker from '../sim/worker?worker'

export function useSim(exerciseId: string, resume?: { actions: TimedAction[]; t: number; factor: number }) {
  const ref = useRef<Worker | null>(null)
  const [snap, setSnap] = useState<FromWorker | null>(null)

  useEffect(() => {
    const w = new SimWorker()
    ref.current = w
    w.onmessage = (e: MessageEvent<FromWorker>) => setSnap(e.data)
    const init: ToWorker = { type: 'init', exerciseId, resume }
    w.postMessage(init)
    return () => {
      w.terminate()
      ref.current = null
    }
  }, [exerciseId])

  const send = useCallback((m: ToWorker) => ref.current?.postMessage(m), [])
  const act = useCallback((action: Action) => send({ type: 'action', action }), [send])
  const setSpeed = useCallback((factor: number) => send({ type: 'speed', factor }), [send])
  const setPaused = useCallback((paused: boolean) => send({ type: 'pause', paused }), [send])

  return { snap, act, setSpeed, setPaused }
}
