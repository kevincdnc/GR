import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow/700.css'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import './styles.css'

createRoot(document.getElementById('root')!).render(<App />)
