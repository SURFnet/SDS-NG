import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@surfnet/sds-ng/styles.css'
import { TooltipProvider } from '@surfnet/sds-ng'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </StrictMode>,
)
