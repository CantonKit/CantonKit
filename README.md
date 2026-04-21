# CantonKit

A TypeScript-first SDK for Canton Network frontend and fullstack developers.

CantonKit wraps [`@canton-network/dapp-sdk`](https://www.npmjs.com/package/@canton-network/dapp-sdk) with a Wagmi-style React API: a provider, three hooks, and a framework-agnostic client.

## Packages

| Package | Purpose |
|---|---|
| [`@cantonkit/core`](./packages/core) | Framework-agnostic `CantonClient`: `queryACS`, `submitAndWait`, `subscribeToTransactions`, typed errors |
| [`@cantonkit/react`](./packages/react) | `<CantonProvider>` + `useContracts`, `useSubmit`, `useTransactionStream` |

## Install

```bash
pnpm add @cantonkit/react @cantonkit/core @canton-network/dapp-sdk \
         @tanstack/react-query react
```

## Quick Start

```tsx
import {
  CantonProvider,
  templateId,
  useCantonConnection,
  useContracts,
  useSubmit,
} from '@cantonkit/react'

interface Counter { owner: string; count: string }
const COUNTER = templateId('#MyApp:Counter:Counter')

function App() {
  const { status, activeParty, connect } = useCantonConnection()
  const counters = useContracts<Counter>({ templateId: COUNTER })
  const submit = useSubmit()

  if (status !== 'connected') return <button onClick={() => connect()}>Connect wallet</button>

  return (
    <>
      <ul>{counters.data?.map(c => <li key={c.contractId}>{c.payload.count}</li>)}</ul>
      <button
        onClick={() => submit.mutate({
          commands: [{
            CreateCommand: {
              templateId: COUNTER,
              createArguments: { owner: activeParty!, count: '0' },
            },
          }],
          actAs: [activeParty!],
        })}
        disabled={submit.isPending}
      >
        New counter
      </button>
    </>
  )
}

export function Root() {
  return (
    <CantonProvider config={{ gatewayUrl: 'https://gateway.example.com/api/json-rpc' }}>
      <App />
    </CantonProvider>
  )
}
```

See [`examples/counter-app`](./examples/counter-app) for a full working demo.

## Development

```bash
pnpm install
pnpm test        # run all tests across packages
pnpm build       # build all packages
pnpm lint
pnpm typecheck
```

## Testing your own app

CantonKit ships fixtures at `@cantonkit/react/testing`:

```tsx
import { createFakeCantonClient, TestCantonProvider } from '@cantonkit/react/testing'

const client = createFakeCantonClient({
  queryACS: async () => [/* fake contracts */],
})

render(
  <TestCantonProvider client={client}>
    <MyComponent />
  </TestCantonProvider>
)
```

## Status

v0.1 — the hook layer and core client. Planned:
- v0.2: DAR → TypeScript codegen CLI
- v0.3: SSR/Next.js story, live-ledger contract tests
- v0.4: Vue and Svelte adapters

## License

Apache-2.0. See [LICENSE](./LICENSE).
