import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initStore } from '@/data/store'
import { Splash } from '@/components/layout/Splash'

const root = createRoot(document.getElementById('root'))

root.render(<Splash message="Preparing the demo…" />)

// Load (or create) the demo data before showing the app.
initStore()
  .then(async (status) => {
    const { App } = await import('./App')
    root.render(
      <StrictMode>
        <App storeStatus={status} />
      </StrictMode>,
    )
  })
  .catch((err) => {
    console.error(err)
    root.render(<Splash message="The demo could not start in this browser. Please use an up-to-date version of Chrome, Edge, Firefox or Safari." />)
  })
