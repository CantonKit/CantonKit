# CantonKit

**Wagmi for Canton Network.** A TypeScript SDK that gives React (and soon Vue/Svelte) developers a familiar hook API for building Canton dApps — connect wallet, read contracts, submit transactions.

[Twitter / X](https://x.com/CantonKit) · [Demo video](https://x.com/i/status/2053987248094466332)

---

## What is CantonKit?

Canton Network uses a UTXO ledger model, privacy-by-default data distribution, and a prepare-sign-execute transaction flow that differs substantially from EVM. The official [`@canton-network/dapp-sdk`](https://www.npmjs.com/package/@canton-network/dapp-sdk) exposes these primitives correctly, but wiring them into a React app requires significant boilerplate: managing connection state, integrating TanStack Query for ACS polling, handling WebSocket lifecycle for live transaction streams.

CantonKit is the DX layer on top. If you've used Wagmi on EVM, the API will feel familiar:

```tsx
const { status, activeParty, connect } = useCantonConnection()
const counters = useContracts<Counter>({ templateId: COUNTER })
const submit = useSubmit()
```

It does **not** replace `@canton-network/dapp-sdk` — it wraps it.

---

## What works today (v0.1)

**`@cantonkit/core`** — Framework-agnostic Canton client:
- `queryACS<T>` — typed active contract set query
- `submitAndWait` — submit commands and wait for confirmation
- `subscribeToTransactions` — live transaction stream with two sources: `'wallet'` (default, via the connected wallet) or `'ledger'` (direct WebSocket to the JSON Ledger API)
- Typed error classes: `CantonSubmitError`, `CantonConnectionError`

**`@cantonkit/react`** — React integration:
- `<CantonProvider>` — wallet gateway mode (CIP-0103); wraps `DappClient` and exposes connection state
- `<LedgerProvider>` — direct JSON Ledger API mode; no wallet required, great for localnet
- `useCantonConnection()` — connection status, active party, connect/disconnect
- `useContracts<T>({ templateId })` — ACS query backed by TanStack Query; handles loading/error states and cache invalidation
- `useSubmit()` — TanStack mutation wrapping `submitAndWait`
- `useTransactionStream({ filter, source?, bufferSize? })` — live contract events, configurable buffer

**Testing utilities** (at `@cantonkit/react/testing`):
- `createFakeCantonClient` — in-memory client for component tests
- `TestCantonProvider` — drop-in provider replacement; no real ledger needed

**Examples** in this repo:
- [`counter-app-localnet`](./examples/counter-app-localnet) — full read / write / stream demo against a local Canton sandbox
- [`counter-app-localnet-starter`](./examples/counter-app-localnet-starter) — blank starting template for your own app

---

## Packages

| Package | npm | Purpose |
|---------|-----|---------|
| `@cantonkit/core` | [![npm](https://img.shields.io/npm/v/@cantonkit/core)](https://www.npmjs.com/package/@cantonkit/core) | Framework-agnostic client |
| `@cantonkit/react` | [![npm](https://img.shields.io/npm/v/@cantonkit/react)](https://www.npmjs.com/package/@cantonkit/react) | React provider + hooks |

---

## Install

```bash
pnpm add @cantonkit/react @cantonkit/core @canton-network/dapp-sdk \
         @tanstack/react-query react
```

---

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

For a full working app against a local sandbox, see [`examples/counter-app-localnet`](./examples/counter-app-localnet).

---

## Testing your own app

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

---

## Roadmap

| Version | Status | What's in it |
|---------|--------|-------------|
| v0.1 | **Released** | Core client, React hooks, testing utilities, localnet examples |
| v0.2 | Planned | `cantonkit codegen` — DAR → TypeScript interface + `templateId` constant generator |
| v0.3 | Planned | SSR / Next.js App Router support; live-ledger contract test harness |
| v0.4 | Planned | Vue 3 composables; Svelte stores |

---

## Contributing

```bash
pnpm install
pnpm build       # build all packages
pnpm test        # run all tests
pnpm typecheck
pnpm lint
```

Issues and PRs welcome.

---

## License

MIT — see [LICENSE](./LICENSE).
