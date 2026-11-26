import { useEffect, useMemo, useState } from 'react'
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

  return (
    <div className="result">
      <div className="row no-print" style={{ marginBottom: '1rem' }}>
        <button onClick={onMenu}>← Menú</button>
        <button onClick={onRetry}>Repetir ejercicio</button>
        <span className="spacer" />
        <button onClick={exportSession}>Descargar sesión (.json)</button>
        <button className="primary" onClick={() => window.print()}>
          Imprimir / guardar PDF
        </button>
      </div>

      <div className="card">
        <span className="muted">
          Informe de ejercicio · Simulador de carga de hidrocarburos (prototipo)
        </span>
        <h1>{exercise.number ? `Ejercicio ${exercise.number}: ` : ''}{exercise.title}</h1>
        <div className="kv" style={{ maxWidth: 520, marginBottom: '1rem' }}>
          <span>Alumno</span>
          <span>{alumno || '—'}</span>
          <span>Fecha</span>
          <span>{new Date(date).toLocaleString('es-AR')}</span>
          <span>Tiempo simulado</span>
          <span>{clock(s.t)}</span>
          <span>Modo</span>
          <span>{hints ? 'Con pasos guiados' : 'Sin guía'}</span>
        </div>

        {evaluation && (
          <div className="row" style={{ alignItems: 'baseline', marginBottom: '1rem' }}>
            <span className="score">{evaluation.score}</span>
            <span className="muted">/ 100</span>
            <span className={`tag ${evaluation.passed ? 'ok' : 'bad'}`}>{evaluation.passed ? 'Aprobado' : 'No aprobado'} (mínimo 70)</span>
          </div>
        )}

        {evaluation && (
          <table className="data" style={{ marginBottom: '1rem' }}>
            <thead>
              <tr>
                <th>Criterio</th>
                <th style={{ textAlign: 'left' }}>Detalle</th>
                <th>Hora</th>
                <th>Descuento</th>
              </tr>
            </thead>
            <tbody>
              {evaluation.items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <span className={`tag ${i.ok ? 'ok' : 'bad'}`}>{i.ok ? '✓' : '✗'}</span> {i.rule}
                  </td>
                  <td style={{ textAlign: 'left' }}>{i.detail}</td>
                  <td className="mono">{i.t !== undefined ? clock(i.t) : ''}</td>
                  <td>{i.penalty ? `−${i.penalty}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2>Estado final del buque</h2>
        <div className="grid2">
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
                  <td colSpan={4} className="muted">
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
          <div className="kv">
            <span>Calado popa / proa</span>
            <span>
              {fmt2(s.hydro.draftAft)} / {fmt2(s.hydro.draftFwd)} m
            </span>
            <span>Escora</span>
            <span>{fmt2(s.hydro.heelDeg)}°</span>
            <span>GM corregido</span>
            <span>{fmt2(s.hydro.gmCorrected)} m</span>
            <span>Carga derramada</span>
            <span>{fmt0(s.spilled)} m³</span>
            {exercise.id === 'ex3' && (
              <>
                <span>Llenado de CT1</span>
                <span>{fmt1(fillOf(VLCC, s, 'CT1') * 100)}%</span>
              </>
            )}
          </div>
        </div>
        <p className="muted print-only" style={{ fontSize: '0.8rem', marginTop: '1rem' }}>
          Nota de práctica calculada en el equipo del alumno. Herramienta no homologada; valores didácticos aproximados.
        </p>
      </div>
      <p className="muted no-print" style={{ fontSize: '0.85rem', marginTop: '0.8rem' }}>
        Para entregar al instructor: guardá el informe como PDF con “Imprimir / guardar PDF” y adjuntá también la sesión (.json), que incluye el registro completo de tus acciones y una huella de integridad.
      </p>
    </div>
  )
}
