import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource-variable/archivo/wdth.css'
import './index.css'
import App from './App'

function Root() {
  const [offlineReady, setOfflineReady] = useState(false)
  useEffect(() => {
    const update = registerSW({
      immediate: true,
      onOfflineReady: () => setOfflineReady(true),
      onRegisteredSW: (_url, reg) => {
        if (reg?.active) setOfflineReady(true)
      },
      onNeedRefresh: () => {
        if (confirm('Hay una versión nueva del simulador. ¿Actualizar ahora?')) update(true)
      },
    })
  }, [])
  return <App offlineReady={offlineReady} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
