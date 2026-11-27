import { useRef, useState } from 'react'
import { EXERCISES, exerciseById, type Exercise } from '../sim/exercises'
import { VLCC } from '../sim/ship'
import { clearSession, exportBackup, importBackup, loadName, loadResults, loadSession, saveName, type SavedSession } from '../storage'
import { clock } from './format'
import { HULL_BOTTOM, ShipPlan } from './ShipPlan'

// Bloques del Curso Modelo OMI 2.06 con sus horas sugeridas
const BLOCKS = [
  { n: 1, title: 'Familiarización', hours: 6 },
  { n: 2, title: 'Operaciones y procedimientos especiales', hours: 10 },
  { n: 3, title: 'Operaciones de lastre', hours: 4 },
  { n: 4, title: 'Operaciones de carga', hours: 6 },
  { n: 5, title: 'Problemas operacionales', hours: 4 },
]

// Portada: el buque cargado al 98% en todos los tanques de carga
const HERO_FILLS = VLCC.tanks.map((t) => (t.kind === 'ballast' ? 0 : 0.98))

const ago = (ms: number) => {
  const min = Math.round((Date.now() - ms) / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ayer' : `hace ${d} días`
}

export function Home({ onStart, offlineReady }: { onStart: (ex: Exercise, hints: boolean, resume?: SavedSession) => void; offlineReady: boolean }) {
  const [name, setName] = useState(loadName())
  const [session, setSession] = useState(() => {
    const s = loadSession()
    return s && exerciseById(s.exerciseId)?.available ? s : null
  })
  const sessionEx = session ? exerciseById(session.exerciseId)! : null
  const [briefing, setBriefing] = useState<Exercise | null>(null)
  const [hints, setHints] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const results = loadResults()
  const best = (id: string) => {
    const r = results.filter((x) => x.exerciseId === id)
    return r.length ? Math.max(...r.map((x) => x.score)) : null
  }
  const free = EXERCISES.find((e) => e.block === 0)!

  const Row = ({ ex }: { ex: Exercise }) => {
    const b = best(ex.id)
    return (
      <div className={`ex-row ${ex.available ? '' : 'soon'}`}>
        <span className="ex-num">{ex.number}</span>
        <span className="ex-title">{ex.title}</span>
        <span className="ex-sum">{ex.summary}</span>
        <span className="ex-act">
          {b !== null && <span className={`grade ${b >= 70 ? 'pass' : 'fail'}`}>Mejor nota {b}</span>}
          {ex.available && session?.exerciseId === ex.id ? (
            <>
              <button className="primary" onClick={() => onStart(ex, session.hints, session)}>
                Continuar
              </button>
              <button onClick={() => setBriefing(ex)}>Empezar de nuevo</button>
            </>
          ) : ex.available ? (
            <button className="primary" onClick={() => setBriefing(ex)}>
              Empezar
            </button>
          ) : (
            <span className="ex-soon">Próximamente</span>
          )}
        </span>
      </div>
    )
  }

  return (
    <main className="home">
      <div className="home-head">
        <h1>Simulador de carga de hidrocarburos</h1>
        <span className="spacer" />
        <span className={`status ${offlineReady ? 'ready' : ''}`} title="La aplicación queda guardada en este navegador y abre sin internet">
          {offlineReady ? 'Disponible sin conexión' : 'Preparando uso sin conexión'}
        </span>
      </div>
      <p className="home-lede">Practicá la carga de un petrolero VLCC desde la sala de control: alineá las líneas, coordiná con la terminal y llená los tanques sin pasarte del 98%.</p>

      <div className="hero-plan">
        <svg className="mimic" viewBox={`62 24 912 ${HULL_BOTTOM - 4}`} role="img" aria-label="Plano de tanques del VLCC de referencia, con los tanques de carga llenos">
          <ShipPlan fills={HERO_FILLS} intro compact />
        </svg>
      </div>
      <p className="hero-caption">El buque de los ejercicios: 4 tanques centrales, 5 pares laterales con los slops, lastre segregado y 4 líneas de carga.</p>

      {session && sessionEx && (
        <section className="resume" aria-labelledby="resume-title">
          <div>
            <h2 id="resume-title">Seguí donde lo dejaste</h2>
            <p>
              {sessionEx.number ? `Ejercicio ${sessionEx.number}: ` : ''}
              {sessionEx.title}
            </p>
            <p className="quiet small-text">
              Tiempo simulado {clock(session.t)}
              {session.hints && sessionEx.steps ? `, paso ${Math.min(session.progress + 1, sessionEx.steps.length)} de ${sessionEx.steps.length}` : ''}. Guardado {ago(session.savedAt)}.
            </p>
          </div>
          <div className="row">
            <button className="primary" onClick={() => onStart(sessionEx, session.hints, session)}>
              Continuar
            </button>
            <button
              onClick={() => {
                clearSession()
                setSession(null)
              }}
            >
              Descartar
            </button>
          </div>
        </section>
      )}

      <div className="student">
        <label>
          Alumno
          <input
            type="text"
            value={name}
            placeholder="Nombre y apellido"
            onChange={(e) => {
              setName(e.target.value)
              saveName(e.target.value)
            }}
          />
        </label>
        <span className="quiet small-text">Figura en los informes que entregás. Se guarda solo en esta computadora.</span>
        <span className="spacer" />
        <span className="row" style={{ gap: '0.5rem' }}>
          <button className="small" onClick={exportBackup}>
            Respaldar progreso
          </button>
          <button className="small" onClick={() => fileRef.current?.click()}>
            Restaurar respaldo
          </button>
        </span>
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
              setMsg('Ese archivo no es un respaldo del simulador. Elegí el .json que descargaste con "Respaldar progreso".')
            }
            e.target.value = ''
          }}
        />
      </div>
      {msg && <p className="small-text">{msg}</p>}

      <section className="syllabus" aria-labelledby="programa">
        <h2 id="programa">Programa</h2>
        <p>Ordenado según los bloques del Curso Modelo OMI 2.06. Las horas son las que sugiere el curso para cada bloque.</p>
        {BLOCKS.map((b) => {
          const exs = EXERCISES.filter((e) => e.block === b.n).sort((x, y) => (x.number ?? 0) - (y.number ?? 0))
          return (
            <div key={b.n} className="block">
              <span className="block-num" aria-hidden="true">
                {b.n}
              </span>
              <div>
                <div className="block-head">
                  <h3>{b.title}</h3>
                  <span className="hours">{b.hours} h</span>
                </div>
                {exs.length > 0 ? (
                  exs.map((ex) => <Row key={ex.id} ex={ex} />)
                ) : (
                  <p className="quiet small-text">Sin ejercicio propio: los fallos y averías aparecen dentro de los ejercicios de los otros bloques.</p>
                )}
              </div>
            </div>
          )
        })}
        <div className="free-practice">
          <span />
          <div className="ex-row" style={{ gridTemplateColumns: '1fr auto' }}>
            <span className="ex-title">{free.title}</span>
            <span className="ex-sum" style={{ gridColumn: 1 }}>
              {free.summary}
            </span>
            <span className="ex-act" style={{ gridColumn: 2 }}>
              <button className="primary" onClick={() => setBriefing(free)}>
                Empezar
              </button>
            </span>
          </div>
        </div>
      </section>

      <p className="disclaimer">
        Herramienta de práctica, no homologada bajo STCW A-I/12. El buque se basa en el VLCC del simulador Kongsberg VLCC-II descrito en un trabajo de la Universidad de La Laguna. La hidrostática y la hidráulica son aproximaciones didácticas: no usar estos valores para operaciones reales.
      </p>

      {briefing && (
        <div className="modal-back" onClick={() => setBriefing(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="briefing-title" onClick={(e) => e.stopPropagation()}>
            <p className="context">{briefing.number ? `Ejercicio ${briefing.number}, briefing` : 'Briefing'}</p>
            <h2 id="briefing-title">{briefing.title}</h2>
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
              <label className="row" style={{ marginBottom: '1.2rem' }}>
                <input type="checkbox" checked={hints} onChange={(e) => setHints(e.target.checked)} />
                Mostrar los pasos como guía (la nota se calcula igual)
              </label>
            )}
            {session && (
              <p className="quiet small-text">
                {session.exerciseId === briefing.id ? 'Al comenzar de cero se descarta la práctica guardada de este ejercicio.' : 'Tenés otra práctica sin terminar; al comenzar esta, la guardada se reemplaza.'}
              </p>
            )}
            <div className="row">
              <button className="primary" onClick={() => onStart(briefing, hints)}>
                Comenzar ejercicio
              </button>
              <button onClick={() => setBriefing(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
