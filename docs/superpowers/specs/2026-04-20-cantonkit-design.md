# CantonKit — Design Spec

**Date:** 2026-04-20
**Status:** Approved (pending user review of this document)
**Scope:** v1 of CantonKit, a TypeScript-first SDK wrapping `@canton-network/dapp-sdk` for frontend and fullstack developers.

---

## 1. Background & Goals

The Canton Network JS/TS ecosystem today gives dApp developers two building blocks and no high-level abstractions:

- **`@canton-network/dapp-sdk`** (v1.0.0 verified from npm registry, 2026-04-20) — a thin, framework-agnostic wallet-connection layer: `DappClient`, `DiscoveryClient`, adapters for remote gateways, browser extensions, and `window.canton` injection. Implements CIP-0103.
- **Canton JSON Ledger API v2** — exposed by validator nodes; developers either proxy it via `DappClient.ledgerApi()` or connect directly with their own auth.

Neither is shaped for a frontend developer who expects Wagmi/Ethers-style DX: a provider, a handful of hooks, and typed data flowing through them.

**Goal of CantonKit v1:** put a React-first, TanStack-Query-powered DX layer on top of `@canton-network/dapp-sdk`, with a framework-agnostic core that leaves room for Vue/Svelte adapters and a future DAR-based codegen tool.

**Non-goals for v1:**
- DAR → TypeScript codegen CLI (deferred to v0.2)
- Vue/Svelte adapters (v0.4, enabled by the core/react package split)
- Next.js / SSR beyond basic `typeof window` guards (v0.3)
- Token-standard helpers (Amulet transfers, etc.) — those live in `@canton-network/wallet-sdk`; CantonKit stays at the primitive layer

---

## 2. Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Package layout | Monorepo: `@cantonkit/core` + `@cantonkit/react` | Lets non-React consumers use core; matches how Wagmi/Viem and React-Query evolved |
| Type source for contracts | Generics in v1; DAR codegen in v0.2 | Ships the hook API fast; validates shape with real users before committing to a compiler |
| Async state layer | `@tanstack/react-query` as peer dep | Caching, retries, devtools, suspense for free; industry standard; same choice as Wagmi |
| Transaction stream source | User-selectable: `source: 'wallet' \| 'ledger'` | Wallet path works everywhere; ledger path offers full fidelity when the app has direct access |
| Base SDK | `@canton-network/dapp-sdk ^1.0.0` | Matches the original request; pre-wrapped wallet-connection surface; never bypasses wallet consent |
| Test target | Mocked `DappClient` + mocked `CantonClient` | Fast, deterministic; live-ledger integration tests deferred to v0.3 |
| Build | `tsup`, ESM-first with CJS fallback, `sideEffects: false` | Matches dapp-sdk's own build; tree-shakeable |
| License | Apache-2.0 | Matches dapp-sdk |

---

## 3. Repository Layout

```
CantonKit/
├── packages/
│   ├── core/                           → @cantonkit/core
│   │   ├── src/
│   │   │   ├── client.ts               createCantonClient factory
│   │   │   ├── ledger/
│   │   │   │   ├── queryACS.ts
│   │   │   │   ├── submitAndWait.ts
│   │   │   │   ├── streamTransactions.ts
│   │   │   │   └── getTransactionById.ts
│   │   │   ├── transport/
│   │   │   │   ├── viaLedgerApi.ts     wraps DappClient.ledgerApi
│   │   │   │   └── viaWebSocket.ts     direct /v2 WS + reconnect
│   │   │   ├── error.ts                CantonError
│   │   │   ├── types/
│   │   │   │   ├── commands.ts
│   │   │   │   ├── contracts.ts
│   │   │   │   └── transactions.ts
│   │   │   ├── test/
│   │   │   │   └── fakeDappClient.ts   shared test fixture
│   │   │   └── index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   │
│   └── react/                          → @cantonkit/react
│       ├── src/
│       │   ├── CantonProvider.tsx
│       │   ├── context.ts              CantonContext, useCantonClient, useCantonConnection
│       │   ├── hooks/
│       │   │   ├── useContracts.ts
│       │   │   ├── useSubmit.ts
│       │   │   └── useTransactionStream.ts
│       │   ├── ssr.ts                  SSR guards, hydration helpers
│       │   ├── testing/
│       │   │   ├── createFakeCantonClient.ts
│       │   │   └── TestCantonProvider.tsx
│       │   └── index.ts
│       ├── tests/
│       │   ├── CantonProvider.test.tsx
│       │   ├── useContracts.test.tsx
│       │   ├── useSubmit.test.tsx
│       │   └── useTransactionStream.test.tsx
│       ├── package.json
│       ├── tsconfig.json
│       └── tsup.config.ts
│
├── examples/
│   └── counter-app/                    Vite + React 18; connect, query, submit, stream
│
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-04-20-cantonkit-design.md   (this file)
│
├── .github/workflows/ci.yml
├── .changeset/
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── vitest.config.ts
├── .eslintrc.cjs
├── .prettierrc
├── LICENSE
└── README.md
```

### 3.1 Module boundaries

- **`@cantonkit/core` depends on:** `@canton-network/dapp-sdk` (peer). Zero React, zero TanStack.
- **`@cantonkit/react` depends on:** `@cantonkit/core` (peer), `@canton-network/dapp-sdk` (peer), `react >=18` (peer), `@tanstack/react-query ^5` (peer). No direct `DappClient` calls from hooks; everything goes through `CantonClient`.

This boundary is what makes mocked tests feasible and keeps the core reusable from Vue/Svelte later.

---

## 4. `@cantonkit/core` — Client API

### 4.1 Factory

```typescript
import type { DappClient } from '@canton-network/dapp-sdk'

export interface CantonClient {
  // Read
  queryACS<T = unknown>(opts: QueryACSOptions): Promise<ActiveContract<T>[]>
  getTransactionById(id: string): Promise<Transaction>

  // Write (goes through wallet for user consent)
  submitAndWait(opts: SubmitOptions): Promise<SubmitResult>
  submit(opts: SubmitOptions): Promise<null>            // fire-and-forget; null matches dapp-sdk.prepareExecute

  // Stream — returns an unsubscribe function (not an EventEmitter)
  subscribeToTransactions(opts: SubscribeOptions): Unsubscribe

  // Escape hatch for endpoints CantonKit hasn't wrapped
  ledger: DappClient['ledgerApi']

  // Lifecycle
  destroy(): void
}

export function createCantonClient(opts: CreateCantonClientOptions): CantonClient
```

### 4.2 Two construction modes

```typescript
// Mode A — caller already has a DappClient (typical inside React)
createCantonClient({ dappClient })

// Mode B — headless / Node / server-side: config only, core builds DappClient
createCantonClient({
  gatewayUrl: 'https://gateway.example.com/api/json-rpc',
  ledgerUrl: 'https://ledger.example.com',   // optional, for source: 'ledger' streams
  auth: { /* bearer token provider */ },
})
```

Mode A is used by `<CantonProvider>`; Mode B is the pure-TS path for scripts, tests, SSR.

### 4.3 Method → ledger mapping

| Core method | Underlying call |
|---|---|
| `queryACS` | `dappClient.ledgerApi({ method: 'POST', url: '/v2/state/active-contracts', body })` |
| `submitAndWait` | `dappClient.prepareExecuteAndWait(params)` |
| `submit` | `dappClient.prepareExecute(params)` |
| `getTransactionById` | `dappClient.ledgerApi({ method: 'GET', url: '/v2/updates/transaction-by-id/:id' })` |
| `subscribeToTransactions` (`source: 'wallet'`) | `dappClient.onTxChanged(listener)` + client-side `templateIds` filter. The wallet already scopes events to connected accounts, so `filter.parties` is a no-op in wallet mode (documented, not silently dropped). |
| `subscribeToTransactions` (`source: 'ledger'`) | WebSocket to `${ledgerUrl}/v2/updates/flats` with reconnect + exponential backoff. Requires `ledgerUrl` and `auth`. Both `filter.templateIds` and `filter.parties` enforced server-side via the v2 filter payload. |

Using `prepareExecute*` rather than reimplementing via `ledgerApi` ensures the wallet sees every write and can prompt for user consent. CantonKit never bypasses the wallet.

### 4.4 Types (highlights)

```typescript
export interface QueryACSOptions {
  templateId: TemplateId           // branded string: 'PkgHash:Mod:Tpl'
  parties: string[]                // readAs set
  filter?: { key?: Record<string, unknown> }
}

export interface ActiveContract<T> {
  contractId: string
  templateId: TemplateId
  payload: T                       // user asserts shape in v1
  signatories: string[]
  observers: string[]
}

export interface SubmitOptions {
  commands: Command[]              // CreateCommand | ExerciseCommand | ...
  actAs: string[]
  readAs?: string[]
  commandId?: string               // caller-supplied; default = uuid()
  deduplicationPeriod?: DedupPeriod
}

export type Unsubscribe = () => void
```

All types exported from `@cantonkit/core`.

### 4.5 Error model

Single discriminated union thrown by every core method:

```typescript
export class CantonError extends Error {
  code:
    | 'NOT_CONNECTED'      // no active wallet session
    | 'WALLET_REJECTED'    // user declined in wallet UI
    | 'LEDGER_HTTP'        // non-2xx from JSON Ledger API
    | 'LEDGER_TIMEOUT'
    | 'STREAM_CLOSED'
    | 'INVALID_ARGUMENT'
    | 'UNKNOWN'
  status?: number          // HTTP status when applicable
  cause?: unknown          // original error from dapp-sdk or fetch
}
```

React hooks expose this as `error` on query/mutation results; users branch on `error.code`.

### 4.6 Tree-shakeability

- Named exports only.
- `"sideEffects": false` in `package.json`.
- No top-level runtime code — nothing runs until `createCantonClient()` is called.

---

## 5. `@cantonkit/react` — Provider & hooks

### 5.1 `<CantonProvider>`

```tsx
<CantonProvider
  config={{
    gatewayUrl: 'https://gateway.example.com/api/json-rpc',
    ledgerUrl?: 'https://ledger.example.com',
    dappClient?: DappClient,           // inject existing instance
    queryClient?: QueryClient,         // share with rest of app
    additionalAdapters?: ProviderAdapter[],
  }}
>
  <App />
</CantonProvider>
```

**On mount:**
1. If `dappClient` not supplied, construct `new DappClient(...)`; store in ref.
2. Call `createCantonClient({ dappClient })`; store in context.
3. If no `queryClient`, create one (`staleTime: 30s`, `refetchOnWindowFocus: false`) and wrap children with `<QueryClientProvider>`.
4. Wire `onStatusChanged` / `onAccountsChanged` into an internal store exposed via `useSyncExternalStore`.

**On unmount:** `cantonClient.destroy()` — closes WS streams, removes dapp-sdk listeners.

**SSR safety:** `DappClient` construction gated by `typeof window !== 'undefined'`; hooks return `status: 'disconnected'`, empty data during SSR, hydrate on client.

### 5.2 Context + split lookup hooks

```typescript
interface CantonContextValue {
  client: CantonClient
  dappClient: DappClient             // raw, for escape hatches
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  accounts: Wallet[]                 // [] when disconnected
  activeParty: string | null
  connect: (opts?) => Promise<void>
  disconnect: () => Promise<void>
}
```

Split lookup hooks prevent unrelated re-renders:
- `useCantonClient()` → `CantonClient` only
- `useCantonConnection()` → `{ status, accounts, activeParty, connect, disconnect }`

### 5.3 `useContracts<T>`

`UseContractsOptions` is structurally `QueryACSOptions` with `parties` made optional (it defaults to `[activeParty]` when omitted):

```typescript
interface UseContractsOptions extends Omit<QueryACSOptions, 'parties'> {
  parties?: string[]
}

function useContracts<T = unknown>(
  opts: UseContractsOptions,
  queryOptions?: Omit<UseQueryOptions, 'queryKey' | 'queryFn'>
): UseQueryResult<ActiveContract<T>[], CantonError>
```

Wraps `useQuery`. Key: `['canton', 'acs', templateId, parties, filter]`. Disabled when `activeParty === null` and `opts.parties` is absent. Second argument is a pass-through for any TanStack option.

### 5.4 `useSubmit`

```typescript
function useSubmit(
  mutationOptions?: UseMutationOptions<SubmitResult, CantonError, SubmitOptions>
): UseMutationResult<SubmitResult, CantonError, SubmitOptions>
```

Wraps `useMutation` around `client.submitAndWait`. Default `onSuccess` calls `queryClient.invalidateQueries({ queryKey: ['canton', 'acs'] })` — TanStack v5 treats that as a prefix match, so every `useContracts` query invalidates and refetches regardless of templateId or party. Users can override `onSuccess`, or pass a CantonKit-specific `invalidate: false` field to skip the default.

### 5.5 `useTransactionStream`

```typescript
function useTransactionStream(opts: {
  source?: 'wallet' | 'ledger'       // default 'wallet'
  filter?: { templateIds?: TemplateId[]; parties?: string[] }
  onEvent?: (event: TransactionEvent) => void
  bufferSize?: number                // default 50
}): {
  events: TransactionEvent[]         // most recent first, capped at bufferSize
  isConnected: boolean
  error: CantonError | null
  clear: () => void
}
```

Implemented with `useSyncExternalStore` over an internal store that calls `client.subscribeToTransactions(opts)`. Returns stable snapshots (React 18 concurrent-safe). Subscription torn down on unmount or when `source`/`filter` changes. `onEvent` fires synchronously before React schedules a re-render.

### 5.6 Why hooks accept pass-through options

TanStack's options (retries, polling, suspense, `select`, `placeholderData`, etc.) are the whole reason we chose it as a peer dep. Every hook ends with an escape hatch: `(cantonOpts, tanstackOpts?)`.

---

## 6. Testing Strategy

### 6.1 Two mock seams

**Seam 1 — `DappClient` (for `@cantonkit/core`).** Shared fixture `createFakeDappClient()` with recorded calls, driven listeners, and per-method Vi-mock overrides.

**Seam 2 — `CantonClient` (for `@cantonkit/react`).** Shipped as `@cantonkit/react/testing` subpath export:
- `createFakeCantonClient(overrides)` — returns a `CantonClient` with sensible defaults
- `<TestCantonProvider client={...}>` — skips real `DappClient` construction

```tsx
const client = createFakeCantonClient({
  queryACS: async () => [mkContract(...)],
})
const { result } = renderHook(() => useContracts({ templateId, party }), {
  wrapper: ({ children }) => <TestCantonProvider client={client}>{children}</TestCantonProvider>,
})
```

### 6.2 Coverage matrix

| Module | Happy | Error | Reactivity | Type inference |
|---|---|---|---|---|
| `createCantonClient` | typed ACS; submitAndWait returns result | `WALLET_REJECTED`, `LEDGER_HTTP`, timeout | emit/unsubscribe; WS reconnect for `source: 'ledger'` | `queryACS<MyT>()` → `payload: MyT` |
| `CantonProvider` | status `disconnected→connecting→connected`; accounts populated | `connect()` rejects → status `'error'` | split-context isolation check | `activeParty: string \| null` |
| `useContracts` | fetch on mount; refetch on party change; empty ACS → `[]` | ledger 500 → `LEDGER_HTTP`; disabled when not connected | `useSubmit` success invalidates ACS key → refetch | generic propagates |
| `useSubmit` | resolves with `SubmitResult`; `isPending` transitions | user rejects → `WALLET_REJECTED`; bad command → `INVALID_ARGUMENT` | auto-invalidation; `invalidate: false` disables it | wrong `Command` shape rejected at compile time |
| `useTransactionStream` | wallet events buffered; `bufferSize` cap; `clear()` works | filter mismatch drops silently; `STREAM_CLOSED` + reconnect for ledger | events trigger re-render; filter change resubscribes exactly once | `events: TransactionEvent[]`; filter keys autocomplete |

### 6.3 Stack

- **Vitest** (matches dapp-sdk's own runner)
- **@testing-library/react** `renderHook`
- **jsdom** for React tests, **node** for core tests — configured via Vitest workspace projects
- **`expectTypeOf`** (built into Vitest) for type-inference assertions

### 6.4 Determinism

Time-dependent code (stream backoff, debounce) accepts injected `clock`; real in prod, `vi.useFakeTimers()` in tests. `commandId` uuid generation accepts injected `idGenerator`.

### 6.5 Coverage gates

CI fails if:
- `packages/core/src/**` line coverage < 90%
- `packages/react/src/**` line coverage < 85% (lower to accommodate SSR guards)
- Any public exported symbol has zero test references (enforced by a small script)

### 6.6 Not tested in v1

- Real HTTP against a Canton sandbox (deferred to v0.3 / MSW fixtures)
- Wallet UI / picker flows (that's dapp-sdk's test surface)

---

## 7. Build & Release

**Per-package `package.json` shape (core):**
```jsonc
{
  "name": "@cantonkit/core",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": false,
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" }
  },
  "peerDependencies": { "@canton-network/dapp-sdk": "^1.0.0" }
}
```

**React package:** same shape, plus `./testing` subpath export, plus peer deps on `@cantonkit/core`, `react >=18`, `@tanstack/react-query ^5`.

**Shared build (`tsup.config.ts`):** ESM + CJS, `dts: true`, `splitting: false`, `sourcemap: true`, `treeshake: true`, `target: es2022`.

**TypeScript (`tsconfig.base.json`):** `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`, `moduleResolution: bundler`, `lib: ["ES2022", "DOM"]`.

**Release:** Changesets for coordinated versioning of the two packages. Single GitHub Actions CI: install → typecheck → lint → test with coverage gates → build → (on release tag) publish.

---

## 8. Quick Start (shipped in root `README.md`)

```tsx
// pnpm add @cantonkit/react @cantonkit/core @canton-network/dapp-sdk \
//          @tanstack/react-query react

import { CantonProvider, useCantonConnection, useContracts, useSubmit } from '@cantonkit/react'

interface Counter { owner: string; count: string }

function App() {
  const { status, activeParty, connect } = useCantonConnection()
  const counters = useContracts<Counter>({
    templateId: '#MyApp:Counter:Counter',
    parties: activeParty ? [activeParty] : [],
  })
  const submit = useSubmit()

  if (status !== 'connected') return <button onClick={() => connect()}>Connect wallet</button>

  return (
    <>
      <ul>{counters.data?.map(c => <li key={c.contractId}>{c.payload.count}</li>)}</ul>
      <button
        onClick={() => submit.mutate({
          commands: [{ CreateCommand: {
            templateId: '#MyApp:Counter:Counter',
            createArguments: { owner: activeParty!, count: '0' },
          }}],
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

---

## 9. Open Questions (to resolve during implementation)

- **JSON Ledger v2 endpoint paths:** The spec references `/v2/state/active-contracts`, `/v2/updates/transaction-by-id/:id`, `/v2/updates/flats`. These should be verified against the current v2 OpenAPI spec during implementation; if any have moved, correct them in one PR and pin the schema version in a comment alongside the constants.
- **`TransactionEvent` shape:** The dapp-sdk `TxChangedEvent` type and the JSON Ledger API `Transaction` payload differ; v1 will expose them as distinct TypeScript types (`WalletTxEvent` vs `LedgerTxEvent`) under a common `TransactionEvent` union, so consumers branch on `source`.
- **Deduplication strategy for `commandId`:** Default is `uuid()`, but exposing a `idGenerator` injection for tests also allows app-level dedup. Document the tradeoff in API reference docs, not in code comments.

These are small, bounded questions — none block the design. They get resolved as the implementation plan's first tasks.
