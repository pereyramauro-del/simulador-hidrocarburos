// Progreso del alumno guardado en su navegador (sin servidor).
// localStorage puede fallar (modo privado, cuotas): siempre con try/catch.

export interface ResultRecord {
  exerciseId: string
  title: string
  date: string
  score: number
  passed: boolean
}

const KEY_RESULTS = 'sh.resultados.v1'
const KEY_NAME = 'sh.alumno.v1'
const KEY_SESSION = 'sh.sesion.v1'

/**
 * Práctica sin terminar. El motor es determinista, así que alcanza con las
 * acciones del alumno y el tiempo simulado para reconstruir el estado exacto.
 */
export interface SavedSession {
  v: 1
  exerciseId: string
  hints: boolean
  actions: { t: number; action: unknown }[]
  t: number
  factor: number
  progress: number
  savedAt: number
}

export function loadSession(): SavedSession | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY_SESSION) ?? 'null')
    return s?.v === 1 && typeof s.t === 'number' && Array.isArray(s.actions) ? s : null
  } catch {
    return null
  }
}

export function saveSession(s: SavedSession) {
  try {
    localStorage.setItem(KEY_SESSION, JSON.stringify(s))
  } catch {
    /* sin almacenamiento disponible */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY_SESSION)
  } catch {
    /* ignorar */
  }
}

export function loadResults(): ResultRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY_RESULTS) ?? '[]')
  } catch {
    return []
  }
}

export function saveResult(r: ResultRecord) {
  try {
    const all = loadResults()
    all.push(r)
    localStorage.setItem(KEY_RESULTS, JSON.stringify(all))
  } catch {
    /* sin almacenamiento disponible */
  }
}

export function loadName(): string {
  try {
    return localStorage.getItem(KEY_NAME) ?? ''
  } catch {
    return ''
  }
}

export function saveName(n: string) {
  try {
    localStorage.setItem(KEY_NAME, n)
  } catch {
    /* ignorar */
  }
}

export function exportBackup() {
  const data = { app: 'simulador-hidrocarburos', tipo: 'respaldo', alumno: loadName(), resultados: loadResults() }
  download(`respaldo-simulador-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2))
}

export function importBackup(text: string): number {
  const data = JSON.parse(text)
  if (data?.app !== 'simulador-hidrocarburos' || !Array.isArray(data.resultados)) throw new Error('Archivo no válido')
  const all = loadResults()
  const seen = new Set(all.map((r) => r.date + r.exerciseId))
  const nuevos = (data.resultados as ResultRecord[]).filter((r) => !seen.has(r.date + r.exerciseId))
  localStorage.setItem(KEY_RESULTS, JSON.stringify([...all, ...nuevos]))
  if (data.alumno && !loadName()) saveName(data.alumno)
  return nuevos.length
}

export function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
