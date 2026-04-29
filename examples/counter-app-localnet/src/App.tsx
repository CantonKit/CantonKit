/// <reference types="vite/client" />
import { LedgerProvider } from '@cantonkit/react'
import { CounterApp } from './CounterApp'

export function App() {
  return (
    <LedgerProvider
      config={{
        ledgerUrl: import.meta.env.VITE_LEDGER_URL,
        party: import.meta.env.VITE_PARTY,
        auth: {
          mode: 'static',
          token: import.meta.env.VITE_TOKEN || undefined,
        },
      }}
    >
      <CounterApp />
    </LedgerProvider>
  )
}
