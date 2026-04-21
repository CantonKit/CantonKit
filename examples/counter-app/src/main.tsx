import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CantonProvider } from '@cantonkit/react'
import { App } from './App.js'

const gatewayUrl = import.meta.env.VITE_CANTON_GATEWAY_URL ?? 'https://gateway.example.com/api/json-rpc'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CantonProvider config={{ gatewayUrl }}>
      <App />
    </CantonProvider>
  </StrictMode>
)
