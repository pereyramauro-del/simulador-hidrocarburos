import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Exercise } from '../sim/exercises'
import type { SimState } from '../sim/engine'
import { fillOf } from '../sim/engine'
import type { TimedAction } from '../sim/worker'
import { VLCC, cap100 } from '../sim/ship'
import { download, loadName, saveResult, sha256 } from '../storage'
import { clock, fmt0, fmt1, fmt2 } from './format'

interface Props {
  exercise: Exercise
  state: SimState
  actions: TimedAction[]
  hints: boolean
  onMenu: () => void
  onRetry: () => void
}

/** La nota cuenta hasta su valor una vez (salvo con movimiento reducido). */
function useCountUp(target: number) {
  const [v, setV] = useState(() => (matchMedia('(prefers-reduced-motion: reduce)').matches ? target : 0))
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setV(target)
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 900)
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return v
}

export function Result({ exercise, state: s, actions, hints, onMenu, onRetry }: Props) {
  const evaluation = useMemo(() => exercise.evaluate?.(VLCC, s) ?? null, [exercise, s])
  const [date] = useState(() => new Date().toISOString())
  const alumno = loadName()

  useEffect(() => {
    if (evaluation) saveResult({ exerciseId: exercise.id, title: exercise.title, date, score: evaluation.score, passed: evaluation.passed })
  }, [evaluation, exercise, date])

  const cargoTanks = VLCC.tanks.map((t, i) => ({ t, st: s.tanks[i] })).filter(({ t, st }) => t.kind !== 'ballast' && st.volume > 0.5)

  const exportSession = async () => {
    const body = {
      app: 'simulador-hidrocarburos',
      version: 1,
      tipo: 'sesion',
      ejercicio: { id: exercise.id, titulo: exercise.title },
      alumno,
      fecha: date,
      conPistas: hints,
      duracionSimulada_s: s.t,
      acciones: actions,
      evaluacion: evaluation,
      resumen: {
        tanques: cargoTanks.map(({ t, st }) => ({ tanque: t.id, volumen_m3: Math.round(st.volume), llenado: +(st.volume / cap100(t)).toFixed(4) })),
        derramado_m3: Math.round(s.spilled),
        calados: { popa: +s.hydro.draftAft.toFixed(2), proa: +s.hydro.draftFwd.toFixed(2) },
      },
    }
    const hash = await sha256(JSON.stringify(body))
    const safe = (alumno || 'alumno').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()
    download(`sesion-${exercise.id}-${safe}-${date.slice(0, 10)}.json`, JSON.stringify({ ...body, hash }, null, 2))
  }

  const shown = useCountUp(evaluation?.score ?? 0)

  return (
    <main className="result">
      <div className="row no-print" style={{ marginBottom: '1rem' }}>
        <button onClick={onMenu}>Menú</button>
        <button onClick={onRetry}>Repetir ejercicio</button>
        <span className="spacer" />
        <button onClick={exportSession}>Descargar sesión (.json)</button>
        <button className="primary" onClick={() => window.print()}>
          Imprimir o guardar PDF
        </button>
      </div>

      <article className="report">
        <header className="report-head">
          <div>
            <p className="kind">Informe de práctica, simulador de carga de hidrocarburos</p>
            <h1>
              {exercise.number ? `Ejercicio ${exercise.number}: ` : ''}
              {exercise.title}
            </h1>
          </div>
          <dl className="kv" style={{ minWidth: 260, margin: 0 }}>
            <dt>Alumno</dt>
            <dd>{alumno || 'Sin nombre'}</dd>
            <dt>Fecha</dt>
            <dd>{new Date(date).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</dd>
            <dt>Tiempo simulado</dt>
            <dd>{clock(s.t)}</dd>
            <dt>Modo</dt>
            <dd>{hints ? 'Con pasos guiados' : 'Sin guía'}</dd>
          </dl>
        </header>

        {evaluation && (
          <div className="score-line">
            <span className="score" aria-label={`Nota ${evaluation.score} sobre 100`}>
              {shown}
            </span>
            <span className="quiet">sobre 100</span>
            <span className={`grade ${evaluation.passed ? 'pass' : 'fail'}`} style={{ marginLeft: '0.6rem' }}>
              {evaluation.passed ? 'Aprobado' : 'No aprobado'}, el mínimo es 70
            </span>
          </div>
        )}

        {evaluation && (
          <table className="data" style={{ marginBottom: '1.6rem' }}>
            <thead>
              <tr>
                <th>Criterio</th>
                <th style={{ textAlign: 'left' }}>Detalle</th>
                <th>Hora</th>
                <th>Descuento</th>
              </tr>
            </thead>
            <tbody>
              {evaluation.items.map((i, k) => (
                <tr key={i.id} className="eval-row" style={{ '--i': k } as CSSProperties}>
                  <td>
                    <span className={`check ${i.ok ? 'ok' : 'bad'}`} aria-label={i.ok ? 'Cumplido' : 'No cumplido'}>
                      {i.ok ? '✓' : '✗'}
                    </span>
                    {i.rule}
                  </td>
                  <td style={{ textAlign: 'left' }}>{i.detail}</td>
                  <td>{i.t !== undefined ? clock(i.t) : ''}</td>
                  <td>{i.penalty ? `−${i.penalty}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2>Estado final del buque</h2>
        <div className="panels">
          <table className="data">
            <thead>
              <tr>
                <th>Tanque</th>
                <th>Volumen (m³)</th>
                <th>Llenado</th>
                <th>Peso (t)</th>
              </tr>
            </thead>
            <tbody>
              {cargoTanks.length === 0 && (
                <tr>
                  <td colSpan={4} className="quiet">
                    Sin carga a bordo.
                  </td>
                </tr>
              )}
              {cargoTanks.map(({ t, st }) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{fmt0(st.volume)}</td>
                  <td>{fmt1((st.volume / cap100(t)) * 100)}%</td>
                  <td>{fmt0(st.volume * st.density)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="kv" style={{ margin: 0 }}>
            <dt>Calado de popa y de proa</dt>
            <dd>
              {fmt2(s.hydro.draftAft)} y {fmt2(s.hydro.draftFwd)} m
            </dd>
            <dt>Escora</dt>
            <dd>{fmt2(s.hydro.heelDeg)}°</dd>
            <dt>GM corregido</dt>
            <dd>{fmt2(s.hydro.gmCorrected)} m</dd>
            <dt>Carga derramada</dt>
            <dd>{fmt0(s.spilled)} m³</dd>
            {exercise.id === 'ex3' && (
              <>
                <dt>Llenado de CT1</dt>
                <dd>{fmt1(fillOf(VLCC, s, 'CT1') * 100)}%</dd>
              </>
            )}
          </dl>
        </div>
        <p className="note print-only">Nota de práctica calculada en la computadora del alumno. Herramienta no homologada; valores didácticos aproximados.</p>
        <div className="signature">
          <div>Firma del alumno</div>
          <div>Firma del instructor</div>
        </div>
      </article>
      <p className="note no-print">Para entregar al instructor: guardá el informe como PDF con "Imprimir o guardar PDF" y adjuntá la sesión (.json), que tiene el registro completo de tus acciones y una huella de integridad.</p>
    </main>
  )
}
