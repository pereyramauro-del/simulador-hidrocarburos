# Simulador de carga de hidrocarburos (prototipo)

Simulador web de operaciones de carga de buque tanque para el curso de carga de hidrocarburos. Funciona en el navegador y, después de la primera visita, **sin conexión** (PWA instalable). No tiene servidor: el motor de simulación corre en el navegador del alumno y el progreso se guarda en su equipo.

Herramienta de práctica, **no homologada** bajo STCW A-I/12. El buque se basa en el VLCC del simulador Kongsberg VLCC-II descrito en un TFG de la Universidad de La Laguna; la hidrostática y la hidráulica son aproximaciones didácticas.

## Qué incluye esta versión

- Menú con los 14 ejercicios de la propuesta (ordenados por los bloques del Curso Modelo OMI 2.06).
- **Ejercicio 3 · Cargar un tanque (CT1)** completo: mímico de tanques y líneas, terminal con comunicaciones, calculador de carga (calados, asiento, escora, GM con superficie libre), alarmas, pasos guiados, evaluación automática e informe (PDF + sesión JSON con hash).
- **Práctica libre de carga** con las 4 líneas.

## Uso local

```bash
npm install
npm run dev       # desarrollo
npm test          # tests del motor
npm run build     # build de producción en dist/
```

## Publicar en Vercel

```bash
npx vercel --prod
```

Vercel detecta Vite solo (build `npm run build`, salida `dist`).

## Estructura

- `src/sim/ship.ts` — datos del buque (tanques, líneas).
- `src/sim/hydrostatics.ts` — hidrostática y estabilidad aproximadas.
- `src/sim/engine.ts` — motor determinista de paso fijo (1 s).
- `src/sim/exercises.ts` y `src/sim/evaluation.ts` — catálogo de ejercicios y reglas de evaluación.
- `src/sim/worker.ts` — el motor corre en un Web Worker.
- `src/ui/` — pantallas.
