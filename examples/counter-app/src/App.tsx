import {
  templateId,
  useCantonConnection,
  useContracts,
  useSubmit,
  useTransactionStream,
} from '@cantonkit/react'

const COUNTER = templateId('#MyApp:Counter:Counter')

interface Counter {
  owner: string
  count: string
}

export function App() {
  const { status, activeParty, connect, disconnect } = useCantonConnection()
  const counters = useContracts<Counter>({ templateId: COUNTER })
  const submit = useSubmit()
  const stream = useTransactionStream({ filter: { templateIds: [COUNTER] } })

  if (status !== 'connected') {
    return (
      <main>
        <h1>CantonKit Counter Demo</h1>
        <p>Status: {status}</p>
        <button onClick={() => connect()}>Connect wallet</button>
      </main>
    )
  }

  return (
    <main>
      <h1>CantonKit Counter Demo</h1>
      <p>Connected as {activeParty}</p>
      <button onClick={() => disconnect()}>Disconnect</button>

      <h2>Your counters</h2>
      {counters.isLoading && <p>Loading…</p>}
      {counters.error && <p>Error: {counters.error.message}</p>}
      <ul>
        {counters.data?.map((c) => (
          <li key={c.contractId}>
            {c.contractId.slice(0, 8)}… — {c.payload.count}
          </li>
        ))}
      </ul>

      <button
        disabled={submit.isPending || !activeParty}
        onClick={() =>
          submit.mutate({
            commands: [
              {
                CreateCommand: {
                  templateId: COUNTER,
                  createArguments: { owner: activeParty!, count: '0' },
                },
              },
            ],
            actAs: [activeParty!],
          })
        }
      >
        New counter
      </button>

      <h2>Recent transactions</h2>
      <p>Stream {stream.isConnected ? 'open' : 'closed'}</p>
      <ul>
        {stream.events.map((e) => (
          <li key={e.updateId}>{e.updateId}</li>
        ))}
      </ul>
    </main>
  )
}
