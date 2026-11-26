import { useRef, useState } from 'react'
import { EXERCISES, type Exercise } from '../sim/exercises'
import { exportBackup, importBackup, loadName, loadResults, saveName } from '../storage'

export function Home({ onStart, offlineReady }: { onStart: (ex: Exercise, hints: boolean) => void; offlineReady: boolean }) {
  const [name, setName] = useState(loadName())
  const [briefing, setBriefing] = useState<Exercise | null>(null)
  const [hints, setHints] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const results = loadResults()
  const best = (id: string) => {
    const r = results.filter((x) => x.exerciseId === id)
    return r.length ? Math.max(...r.map((x) => x.score)) : null
  }

  return (
    <div className="home">
      <header>
        <div>
          <h1>Simulador de carga de hidrocarburos</h1>
          <p className="muted" style={{ margin: 0 }}>
            Práctica de operaciones de carga de buque tanque · Curso de carga de hidrocarburos · Prototipo
          </p>
        </div>
        <span className="spacer" />
        <span className={`tag ${offlineReady ? 'ok' : ''}`} title="La aplicación queda guardada en este navegador y abre sin internet">
          {offlineReady ? '● Disponible sin conexión' : '○ Preparando uso sin conexión…'}
        </span>
      </header>

      <div className="card row" style={{ marginBottom: '1rem' }}>
        <label className="row">
          Alumno
          <input
            type="text"
            value={name}
            placeholder="Nombre y apellido"
            onChange={(e) => {
              setName(e.target.value)
              saveName(e.target.value)
            }}
            style={{ minWidth: '16em' }}
          />
        </label>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          Aparece en los informes que entregás al instructor. Se guarda solo en este equipo.
        </span>
        <span className="spacer" />
        <button className="small" onClick={exportBackup}>
          Respaldar progreso
        </button>
        <button className="small" onClick={() => fileRef.current?.click()}>
          Restaurar respaldo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            try {
              const n = importBackup(await f.text())
              setMsg(`Respaldo restaurado: ${n} resultado(s) nuevo(s).`)
              setName(loadName())
            } catch {
              setMsg('No se pudo leer el archivo de respaldo.')
            }
            e.target.value = ''
          }}
        />
      </div>
      {msg && <p className="tag ok">{msg}</p>}

      <div className="ex-list">
        {EXERCISES.map((ex) => {
          const b = best(ex.id)
          return (
            <div key={ex.id} className={`card ex-card ${ex.available ? '' : 'off'}`}>
              <span className="num">
                {ex.number ? `Ejercicio ${ex.number}` : 'Práctica'} · {ex.block}
              </span>
              <h3>{ex.title}</h3>
              <span className="summary">{ex.summary}</span>
              <div className="row">
                {ex.available ? (
                  <button className="primary" onClick={() => setBriefing(ex)}>
                    Empezar
                  </button>
                ) : (
                  <span className="tag">Próximamente</span>
                )}
                {b !== null && <span className={`tag ${b >= 70 ? 'ok' : 'bad'}`}>Mejor nota: {b}</span>}
              </div>
            </div>
          )
        })}
      </div>

      <p className="disclaimer">
        Herramienta de práctica, no homologada bajo STCW A-I/12. El buque se basa en el VLCC del simulador Kongsberg VLCC-II descrito en un trabajo de la Universidad de La Laguna; la hidrostática y la hidráulica son aproximaciones didácticas. No usar estos valores para operaciones reales.
      </p>

      {briefing && (
        <div className="modal-back" onClick={() => setBriefing(null)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <span className="muted">{briefing.number ? `Ejercicio ${briefing.number}` : 'Práctica'} · Briefing</span>
            <h2>{briefing.title}</h2>
            {briefing.briefing?.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {briefing.objectives && (
              <>
                <h3>Objetivos</h3>
                <ul>
                  {briefing.objectives.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </>
            )}
            {briefing.steps && (
              <label className="row" style={{ marginBottom: '1rem' }}>
                <input type="checkbox" checked={hints} onChange={(e) => setHints(e.target.checked)} />
                Mostrar los pasos como guía (la nota se calcula igual)
              </label>
            )}
            <div className="row">
              <button className="primary" onClick={() => onStart(briefing, hints)}>
                Comenzar
              </button>
              <button onClick={() => setBriefing(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
