import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { App } from './App'
import './styles/globals.css'

const PUBLISHABLE_KEY = import.meta.env.RENDERER_VITE_CLERK_PUBLISHABLE_KEY as string

if (!PUBLISHABLE_KEY) {
  console.warn('Clerk publishable key not set — auth will be unavailable')
}

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    {PUBLISHABLE_KEY ? (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <App />
      </ClerkProvider>
    ) : (
      <App />
    )}
  </StrictMode>,
)
