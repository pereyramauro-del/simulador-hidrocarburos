import { createContext, useContext, type ButtonHTMLAttributes } from 'react'

/*
  Guía visual: el paso actual del ejercicio dice qué controles hay que tocar
  y la interfaz los resalta. Cada control resaltable se identifica con un id:
    tab:<vista>         pestaña (lineas, terminal, tanques, registro)
    valve:<id>          válvula del mímico (MF1, DROP1, BV_CT1…)
    panel:open|close|25|50|75   botones del panel de la válvula seleccionada
    hose:<línea>        conectar manguera
    msg:<tipo>          botones de comunicación (listo, iniciar, caudal, ultimo, parar)
    rate                campo de caudal
    speed:<factor>      botón de velocidad
    finish              botón Finalizar
*/
export const GuideContext = createContext<Set<string>>(new Set())

export const useGuide = (id: string) => useContext(GuideContext).has(id)

/** Vista donde vive cada control; los del panel lateral y la barra superior están siempre visibles */
export function viewOf(target: string): string | null {
  if (target.startsWith('valve:')) return 'lineas'
  if (target.startsWith('hose:') || target.startsWith('msg:') || target === 'rate') return 'terminal'
  if (target.startsWith('view:')) return target.slice(5)
  return null
}

/** Botón que se resalta cuando la guía lo pide */
export function GButton({ id, className, ...rest }: { id: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const on = useGuide(id)
  const cls = [className, on ? 'guide' : ''].filter(Boolean).join(' ')
  return <button {...rest} className={cls || undefined} data-guide={id} />
}
