import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import { t } from './ui/i18n'
// Self-hosted, so the service worker precaches the fonts and the site keeps its type offline.
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'

document.title = t('appTitle')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
