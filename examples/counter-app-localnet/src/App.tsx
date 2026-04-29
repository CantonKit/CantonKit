/// <reference types="vite/client" />
import {
  LedgerProvider,
  useContracts,
  useSubmit,
  useTransactionStream,
} from '@cantonkit/react'
import { templateId } from '@cantonkit/core'

const COUNTER = templateId('#counter-1.0.0:Counter:Counter')

interface Counter {
  owner: string
  count: number
}

function CounterApp() {
  const counters = useContracts<Counter>({
    templateId: COUNTER,
    parties: [import.meta.env.VITE_PARTY],
  })
  const submit = useSubmit()
  const stream = useTransactionStream({
    filter: { templateIds: [COUNTER], parties: [import.meta.env.VITE_PARTY] },
  })

  if (!import.meta.env.VITE_PARTY) {
    return (
      <main>
        <h1>CantonKit Counter — Localnet</h1>
        <p>No party configured. Set VITE_PARTY in your .env file.</p>
      </main>
    )
  }

  return (
    <main>
      <h1>CantonKit Counter — Localnet</h1>
      <p>Party: {import.meta.env.VITE_PARTY}</p>

      <h2>Your counters</h2>
      {counters.isLoading && <p>Loading…</p>}
      {counters.error && <p>Error: {String(counters.error)}</p>}
      <ul>
        {counters.data?.map((c) => (
          <li key={c.contractId}>
            {c.contractId.slice(0, 8)}… — count: {c.payload.count}
            <button
              disabled={submit.isPending}
              onClick={() =>
                submit.mutate({
                  commands: [
                    {
                      ExerciseCommand: {
                        templateId: COUNTER,
                        contractId: c.contractId,
                        choice: 'Increment',
                        choiceArgument: {},
                      },
                    },
                  ],
                  actAs: [import.meta.env.VITE_PARTY],
                })
              }
            >
              +1
            </button>
          </li>
        ))}
      </ul>

      <button
        disabled={submit.isPending}
        onClick={() =>
          submit.mutate({
            commands: [
              {
                CreateCommand: {
                  templateId: COUNTER,
                  createArguments: { owner: import.meta.env.VITE_PARTY, count: 0 },
                },
              },
            ],
            actAs: [import.meta.env.VITE_PARTY],
          })
        }
      >
        New counter
      </button>

      <h2>Recent transactions</h2>
      <p>Stream: {stream.isConnected ? 'open' : 'closed'}</p>
      <ul>
        {stream.events.map((e) => (
          <li key={e.updateId}>{e.updateId}</li>
        ))}
      </ul>
    </main>
  )
}

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
