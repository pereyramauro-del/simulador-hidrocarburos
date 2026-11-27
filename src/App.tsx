import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import type { Exercise } from './sim/exercises'
import type { SimState } from './sim/engine'
import type { TimedAction } from './sim/worker'
import { Home } from './ui/Home'
import { Simulator } from './ui/Simulator'
import { Result } from './ui/Result'
import type { SavedSession } from './storage'

type Screen =
  | { kind: 'home' }
  | { kind: 'sim'; ex: Exercise; hints: boolean; run: number; resume?: SavedSession }
  | { kind: 'result'; ex: Exercise; hints: boolean; state: SimState; actions: TimedAction[] }

export default function App({ offlineReady }: { offlineReady: boolean }) {
  const [screen, setScreenNow] = useState<Screen>({ kind: 'home' })
  // Cambio de pantalla con View Transitions cuando el navegador lo soporta
  // El botón "atrás" del navegador vuelve al menú en lugar de salir de la app
  // (el simulador guarda el avance al desmontarse).
  useEffect(() => {
    history.scrollRestoration = 'manual'
    const onPop = () => {
      setScreenNow({ kind: 'home' })
      requestAnimationFrame(() => window.scrollTo(0, 0))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const setScreen = (next: Screen) => {
    if (next.kind !== 'home' && !history.state?.sh) history.pushState({ sh: 1 }, '')
    if (next.kind === 'home' && history.state?.sh) history.replaceState(null, '')
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduce) return setScreenNow(next)
    document.startViewTransition(() => flushSync(() => setScreenNow(next)))
    window.scrollTo(0, 0)
  }

  if (screen.kind === 'sim')
    return (
      <Simulator
        key={screen.run}
        exercise={screen.ex}
        hints={screen.hints}
        resume={screen.resume}
        onExit={() => setScreen({ kind: 'home' })}
        onFinish={(state, actions) => setScreen({ kind: 'result', ex: screen.ex, hints: screen.hints, state, actions })}
      />
    )
  if (screen.kind === 'result')
    return (
      <Result
        exercise={screen.ex}
        state={screen.state}
        actions={screen.actions}
        hints={screen.hints}
        onMenu={() => setScreen({ kind: 'home' })}
        onRetry={() => setScreen({ kind: 'sim', ex: screen.ex, hints: screen.hints, run: Date.now() })}
      />
    )
  return <Home offlineReady={offlineReady} onStart={(ex, hints, resume) => setScreen({ kind: 'sim', ex, hints, run: Date.now(), resume })} />
}
