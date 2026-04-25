# LedgerProvider + counter-app-localnet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `LedgerProvider` for direct JSON Ledger API access, rename `CantonProvider` → `WalletProvider` with discriminated-union config, and ship a runnable `counter-app-localnet` demo backed by `daml start`.

**Architecture:** `@canton-network/core-provider-ledger`'s `LedgerProvider` (official SDK) is wrapped into a `LedgerTransport` (`viaLedgerProvider.ts`), mirroring how the existing `viaLedgerApi.ts` wraps `DappClient.ledgerApi`. A new `createJsonLedgerClient()` in `@cantonkit/core` composes that transport with the existing `queryACS`, `submitViaLedger`, and `createLedgerStream`. The React `LedgerProvider` manages auth state and injects a `getToken` closure into the client. `CantonProvider` is renamed `WalletProvider` with a `mode: 'gateway' | 'extension'` discriminated union, keeping a deprecated re-export for one release cycle.

**Tech Stack:** TypeScript, Vitest, React 18, `@canton-network/core-provider-ledger@1.1.0`, `@canton-network/core-wallet-auth@1.0.0`, `@canton-network/dapp-sdk@1.0.0`, Vite, Daml SDK

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/core/src/transport/viaLedgerProvider.ts` | Create | `LedgerTransport` impl using `core-provider-ledger` |
| `packages/core/src/transport/viaLedgerProvider.test.ts` | Create | Unit tests for the transport |
| `packages/core/src/ledger/submitViaLedger.ts` | Create | submit/submitAndWait over JSON Ledger API |
| `packages/core/src/ledger/submitViaLedger.test.ts` | Create | Unit tests for submit |
| `packages/core/src/client.ts` | Modify | Add `createJsonLedgerClient` |
| `packages/core/src/index.ts` | Modify | Export new types/functions |
| `packages/core/package.json` | Modify | Add `@canton-network/core-provider-ledger` dependency |
| `packages/react/src/WalletProvider.tsx` | Create (rename) | `CantonProvider` → `WalletProvider` with `mode` union |
| `packages/react/src/CantonProvider.tsx` | Modify | Thin deprecated re-export of `WalletProvider` |
| `packages/react/src/LedgerProvider.tsx` | Create | Auth state machine + `CantonClient` construction |
| `packages/react/src/LedgerContext.ts` | Create | Separate auth context for `useCantonAuth` |
| `packages/react/src/hooks/useCantonAuth.ts` | Create | Reads auth state from `LedgerContext` |
| `packages/react/src/LedgerProvider.test.tsx` | Create | Unit tests for `LedgerProvider` |
| `packages/react/src/index.ts` | Modify | Export new providers/hooks |
| `examples/counter-app-localnet/daml/daml.yaml` | Create | Sandbox config |
| `examples/counter-app-localnet/daml/Counter.daml` | Create | Counter Daml template |
| `examples/counter-app-localnet/src/main.tsx` | Create | React entry point |
| `examples/counter-app-localnet/src/App.tsx` | Create | Counter UI using `LedgerProvider` hooks |
| `examples/counter-app-localnet/.env.example` | Create | Env var template |
| `examples/counter-app-localnet/package.json` | Create | Example package config |
| `examples/counter-app-localnet/tsconfig.json` | Create | TypeScript config |
| `examples/counter-app-localnet/vite.config.ts` | Create | Vite config |
| `examples/counter-app-localnet/index.html` | Create | HTML entry |

---

## Task 1: Add `@canton-network/core-provider-ledger` dependency

**Files:**
- Modify: `packages/core/package.json`

- [ ] **Step 1: Add the dependency**

In `packages/core/package.json`, add to `"dependencies"` (create the key if it doesn't exist — currently only `peerDependencies` and `devDependencies` are present):

```json
{
  "dependencies": {
    "@canton-network/core-provider-ledger": "^1.1.0"
  }
}
```

- [ ] **Step 2: Install**

```bash
pnpm install
```

Expected: lock file updated, `@canton-network/core-provider-ledger` appears in `node_modules/.pnpm`.

- [ ] **Step 3: Verify types resolve**

```bash
cd packages/core && pnpm typecheck
```

Expected: exits 0 (no new errors).

- [ ] **Step 4: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml
git commit -m "chore(core): add @canton-network/core-provider-ledger dependency"
```

---

## Task 2: Implement `viaLedgerProvider` transport

**Files:**
- Create: `packages/core/src/transport/viaLedgerProvider.ts`
- Create: `packages/core/src/transport/viaLedgerProvider.test.ts`

The `LedgerProvider` from `@canton-network/core-provider-ledger` exposes `provider.request({ method: 'ledgerApi', params: { resource, requestMethod, body?, path?, query? } })`. We wrap it into the existing `LedgerTransport` interface (`{ get, post }`) so all downstream ledger functions (`queryACS`, `getTransactionById`) work unchanged.

`AccessTokenProvider` requires both `getAccessToken(): Promise<string>` and `getAuthContext(): Promise<AuthContext>`. We only need the token, so `getAuthContext` throws — the `LedgerProvider` internals only call `getAuthContext` for OIDC flows we don't use here.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/transport/viaLedgerProvider.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { viaLedgerProvider } from './viaLedgerProvider.js'

function makeProvider(response: unknown) {
  return {
    request: vi.fn().mockResolvedValue(response),
  }
}

vi.mock('@canton-network/core-provider-ledger', () => ({
  LedgerProvider: vi.fn().mockImplementation(({ accessTokenProvider }) => ({
    _tokenProvider: accessTokenProvider,
    request: vi.fn(),
  })),
}))

import { LedgerProvider } from '@canton-network/core-provider-ledger'

describe('viaLedgerProvider', () => {
  it('POST wraps body into provider.request ledgerApi call', async () => {
    const mockRequest = vi.fn().mockResolvedValue({ activeContracts: [] })
    ;(LedgerProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      request: mockRequest,
    }))

    const transport = viaLedgerProvider('http://localhost:7575', () => 'tok')
    await transport.post('/v2/state/active-contracts', { filter: {} })

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'ledgerApi',
      params: {
        resource: '/v2/state/active-contracts',
        requestMethod: 'post',
        body: { filter: {} },
      },
    })
  })

  it('GET wraps path params into provider.request ledgerApi call', async () => {
    const mockRequest = vi.fn().mockResolvedValue({ transaction: { updateId: 'u1' } })
    ;(LedgerProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      request: mockRequest,
    }))

    const transport = viaLedgerProvider('http://localhost:7575', () => 'tok')
    await transport.get('/v2/updates/transaction-by-id/:id', { id: 'abc' })

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'ledgerApi',
      params: {
        resource: '/v2/updates/transaction-by-id/:id',
        requestMethod: 'get',
        path: { id: 'abc' },
      },
    })
  })

  it('throws LEDGER_HTTP on non-ok response', async () => {
    const mockRequest = vi.fn().mockRejectedValue(Object.assign(new Error('bad'), { status: 404 }))
    ;(LedgerProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      request: mockRequest,
    }))

    const transport = viaLedgerProvider('http://localhost:7575', () => 'tok')
    await expect(transport.post('/v2/state/active-contracts', {})).rejects.toMatchObject({
      code: 'LEDGER_HTTP',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && pnpm test -- viaLedgerProvider
```

Expected: FAIL — `Cannot find module './viaLedgerProvider.js'`

- [ ] **Step 3: Implement `viaLedgerProvider.ts`**

Create `packages/core/src/transport/viaLedgerProvider.ts`:

```ts
import { LedgerProvider } from '@canton-network/core-provider-ledger'
import { CantonError } from '../error.js'
import type { LedgerTransport } from './viaLedgerApi.js'

export function viaLedgerProvider(
  ledgerUrl: string,
  getToken: () => string | undefined
): LedgerTransport {
  const provider = new LedgerProvider({
    baseUrl: ledgerUrl,
    accessTokenProvider: {
      getAccessToken: async () => getToken() ?? '',
      getAuthContext: async () => {
        throw new CantonError('INVALID_ARGUMENT', 'getAuthContext not supported in viaLedgerProvider')
      },
    },
  })

  async function call<T>(
    requestMethod: 'get' | 'post',
    resource: string,
    extra: { body?: unknown; path?: Record<string, string> }
  ): Promise<T> {
    try {
      return (await provider.request({
        method: 'ledgerApi',
        params: { resource, requestMethod, ...extra },
      } as never)) as T
    } catch (err) {
      throw CantonError.wrap(err, 'LEDGER_HTTP')
    }
  }

  return {
    get: (url, pathParams) =>
      call('get', url, pathParams ? { path: pathParams } : {}),
    post: (url, body) =>
      call('post', url, { body }),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/core && pnpm test -- viaLedgerProvider
```

Expected: PASS (3 tests)

- [ ] **Step 5: Typecheck**

```bash
cd packages/core && pnpm typecheck
```

Expected: exits 0

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/transport/viaLedgerProvider.ts packages/core/src/transport/viaLedgerProvider.test.ts
git commit -m "feat(core): add viaLedgerProvider transport wrapping core-provider-ledger"
```

---

## Task 3: Implement `submitViaLedger`

**Files:**
- Create: `packages/core/src/ledger/submitViaLedger.ts`
- Create: `packages/core/src/ledger/submitViaLedger.test.ts`

`POST /v2/commands/submit` for fire-and-forget, `POST /v2/commands/submit-and-wait` for synchronous completion. Both accept the same `SubmitOptions` shape. The transport is `LedgerTransport` (same as `queryACS`).

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/ledger/submitViaLedger.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { submitViaLedger, submitAndWaitViaLedger } from './submitViaLedger.js'
import { templateId } from '../types/commands.js'
import type { LedgerTransport } from '../transport/viaLedgerApi.js'

function makeTransport(response: unknown): LedgerTransport {
  return {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue(response),
  }
}

const OPTS = {
  commands: [
    {
      CreateCommand: {
        templateId: templateId('#App:Mod:T'),
        createArguments: { owner: 'Alice' },
      },
    },
  ],
  actAs: ['Alice'],
}

describe('submitViaLedger', () => {
  it('POSTs to /v2/commands/submit and returns null', async () => {
    const transport = makeTransport({})
    const result = await submitViaLedger(transport, OPTS)
    expect(result).toBeNull()
    expect(transport.post).toHaveBeenCalledWith('/v2/commands/submit', expect.objectContaining({
      commands: OPTS.commands,
      actAs: ['Alice'],
    }))
  })

  it('wraps errors as LEDGER_HTTP', async () => {
    const transport: LedgerTransport = {
      get: vi.fn(),
      post: vi.fn().mockRejectedValue(new Error('timeout')),
    }
    await expect(submitViaLedger(transport, OPTS)).rejects.toMatchObject({ code: 'LEDGER_HTTP' })
  })
})

describe('submitAndWaitViaLedger', () => {
  it('POSTs to /v2/commands/submit-and-wait and returns SubmitResult', async () => {
    const transport = makeTransport({
      updateId: 'u1',
      commandId: 'c1',
      completionOffset: '42',
    })
    const result = await submitAndWaitViaLedger(transport, OPTS)
    expect(result).toEqual({ updateId: 'u1', commandId: 'c1', completionOffset: '42' })
    expect(transport.post).toHaveBeenCalledWith(
      '/v2/commands/submit-and-wait',
      expect.objectContaining({ actAs: ['Alice'] })
    )
  })

  it('auto-generates commandId when not supplied', async () => {
    const transport = makeTransport({ updateId: 'u1', commandId: 'gen', completionOffset: '0' })
    await submitAndWaitViaLedger(transport, { commands: [], actAs: ['Alice'] })
    const call = (transport.post as ReturnType<typeof vi.fn>).mock.calls[0][1] as { commandId: string }
    expect(call.commandId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
  })

  it('preserves caller-supplied commandId', async () => {
    const transport = makeTransport({ updateId: 'u1', commandId: 'my-id', completionOffset: '0' })
    await submitAndWaitViaLedger(transport, { commands: [], actAs: ['Alice'], commandId: 'my-id' })
    const call = (transport.post as ReturnType<typeof vi.fn>).mock.calls[0][1] as { commandId: string }
    expect(call.commandId).toBe('my-id')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && pnpm test -- submitViaLedger
```

Expected: FAIL — `Cannot find module './submitViaLedger.js'`

- [ ] **Step 3: Implement `submitViaLedger.ts`**

Create `packages/core/src/ledger/submitViaLedger.ts`:

```ts
import type { LedgerTransport } from '../transport/viaLedgerApi.js'
import type { SubmitOptions, SubmitResult } from '../types/commands.js'
import { CantonError } from '../error.js'

function defaultUuid(): string {
  return globalThis.crypto.randomUUID()
}

export async function submitViaLedger(
  transport: LedgerTransport,
  opts: SubmitOptions
): Promise<null> {
  try {
    await transport.post('/v2/commands/submit', {
      commands: opts.commands,
      actAs: opts.actAs,
      readAs: opts.readAs,
      commandId: opts.commandId,
      deduplicationDuration: opts.deduplicationDuration,
    })
    return null
  } catch (err) {
    throw CantonError.wrap(err, 'LEDGER_HTTP')
  }
}

export async function submitAndWaitViaLedger(
  transport: LedgerTransport,
  opts: SubmitOptions
): Promise<SubmitResult> {
  const commandId = opts.commandId ?? defaultUuid()
  try {
    return await transport.post<SubmitResult>('/v2/commands/submit-and-wait', {
      commands: opts.commands,
      actAs: opts.actAs,
      readAs: opts.readAs,
      commandId,
      deduplicationDuration: opts.deduplicationDuration,
    })
  } catch (err) {
    throw CantonError.wrap(err, 'LEDGER_HTTP')
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/core && pnpm test -- submitViaLedger
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ledger/submitViaLedger.ts packages/core/src/ledger/submitViaLedger.test.ts
git commit -m "feat(core): add submitViaLedger for direct JSON Ledger API writes"
```

---

## Task 4: Add `createJsonLedgerClient` to `@cantonkit/core`

**Files:**
- Modify: `packages/core/src/client.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/client.test.ts` (append after existing tests):

```ts
import { createJsonLedgerClient } from './client.js'

describe('createJsonLedgerClient', () => {
  it('returns a CantonClient with all required methods', () => {
    const client = createJsonLedgerClient({
      ledgerUrl: 'http://localhost:7575',
      party: 'Alice::abc',
      getToken: () => undefined,
    })
    expect(typeof client.queryACS).toBe('function')
    expect(typeof client.submit).toBe('function')
    expect(typeof client.submitAndWait).toBe('function')
    expect(typeof client.subscribeToTransactions).toBe('function')
    expect(typeof client.destroy).toBe('function')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && pnpm test -- client
```

Expected: FAIL — `createJsonLedgerClient is not a function` or similar

- [ ] **Step 3: Implement `createJsonLedgerClient` in `client.ts`**

Add after the existing `createCantonClient` function in `packages/core/src/client.ts`:

```ts
import { viaLedgerProvider } from './transport/viaLedgerProvider.js'
import { submitViaLedger, submitAndWaitViaLedger } from './ledger/submitViaLedger.js'

export interface JsonLedgerClientOptions {
  ledgerUrl: string
  party: string
  getToken: () => string | undefined
  maxReconnectAttempts?: number
}

export function createJsonLedgerClient(opts: JsonLedgerClientOptions): CantonClient {
  const transport = viaLedgerProvider(opts.ledgerUrl, opts.getToken)
  const ledgerSource = createLedgerStream({
    ledgerUrl: opts.ledgerUrl,
    auth: { token: opts.getToken() ?? '' },
    ...(opts.maxReconnectAttempts !== undefined
      ? { maxReconnectAttempts: opts.maxReconnectAttempts }
      : {}),
  } satisfies LedgerStreamConfig)

  const activeUnsubscribes = new Set<Unsubscribe>()

  return {
    queryACS: <T>(q: QueryACSOptions) => queryACS<T>(transport, q),
    getTransactionById: (id) => getTransactionById(transport, id),
    submit: (p) => submitViaLedger(transport, p),
    submitAndWait: (p) => submitAndWaitViaLedger(transport, p),
    subscribeToTransactions(sub: SubscribeOptions): Unsubscribe {
      const unsub = ledgerSource(sub)
      activeUnsubscribes.add(unsub)
      return () => {
        activeUnsubscribes.delete(unsub)
        unsub()
      }
    },
    ledger: (params) => {
      throw new CantonError('INVALID_ARGUMENT', 'ledger() raw proxy not available in JsonLedgerClient — use queryACS or getTransactionById')
    },
    destroy() {
      for (const u of activeUnsubscribes) u()
      activeUnsubscribes.clear()
    },
  }
}
```

Also add the missing imports at the top of `client.ts` (alongside existing imports):

```ts
import { viaLedgerProvider } from './transport/viaLedgerProvider.js'
import { submitViaLedger, submitAndWaitViaLedger } from './ledger/submitViaLedger.js'
```

- [ ] **Step 4: Export from `index.ts`**

In `packages/core/src/index.ts`, add:

```ts
export { createJsonLedgerClient } from './client.js'
export type { JsonLedgerClientOptions } from './client.js'
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd packages/core && pnpm test -- client
```

Expected: PASS

- [ ] **Step 6: Typecheck**

```bash
cd packages/core && pnpm typecheck
```

Expected: exits 0

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/client.ts packages/core/src/index.ts
git commit -m "feat(core): add createJsonLedgerClient for direct JSON Ledger API access"
```

---

## Task 5: Rename `CantonProvider` → `WalletProvider` with discriminated-union config

**Files:**
- Create: `packages/react/src/WalletProvider.tsx`
- Modify: `packages/react/src/CantonProvider.tsx` (replace with deprecated re-export)
- Modify: `packages/react/src/index.ts`

The new `WalletProvider` is functionally identical to `CantonProvider` except:
1. Config is `WalletProviderConfig` with `mode: 'gateway' | 'extension'`
2. `mode: 'gateway'` requires `gatewayUrl`; `mode: 'extension'` constructs `new ExtensionAdapter()` internally
3. `ledgerUrl` and `auth` fields are removed from config

- [ ] **Step 1: Create `WalletProvider.tsx`**

Create `packages/react/src/WalletProvider.tsx` — copy the full content of `CantonProvider.tsx` then apply these changes:

```tsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  QueryClient,
  QueryClientProvider,
  type QueryClient as QC,
} from '@tanstack/react-query'
import type { DappClient } from '@canton-network/dapp-sdk'
import {
  createCantonClient,
  type CantonClient,
  type CreateCantonClientOptions,
} from '@cantonkit/core'
import {
  CantonContext,
  type CantonContextValue,
  type ConnectionStatus,
  type Wallet,
} from './context.js'
import { isBrowser } from './ssr.js'

export type WalletProviderConfig =
  | {
      mode: 'gateway'
      gatewayUrl: string
      additionalAdapters?: unknown[]
      dappClient?: DappClient
      queryClient?: QC
    }
  | {
      mode: 'extension'
      additionalAdapters?: unknown[]
      dappClient?: DappClient
      queryClient?: QC
    }

export interface WalletProviderProps {
  config: WalletProviderConfig
  children: ReactNode
}

function defaultQueryClient(): QC {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
    },
  })
}

async function constructDappClient(config: WalletProviderConfig): Promise<DappClient> {
  if (config.dappClient) return config.dappClient
  if (!isBrowser) {
    throw new Error('WalletProvider: DappClient can only be constructed in the browser')
  }
  const mod = await import('@canton-network/dapp-sdk')
  const { DappClient, DiscoveryClient, RemoteAdapter, ExtensionAdapter } = mod as unknown as {
    DappClient: new (provider: unknown, opts?: unknown) => DappClient
    DiscoveryClient: { create: (opts: { adapters: unknown[] }) => Promise<{
      connect: () => Promise<void>
      getActiveSession: () => { provider: unknown; adapter: { type: string } } | null
    }> }
    RemoteAdapter: new (opts: { name: string; rpcUrl: string }) => { provider: () => unknown }
    ExtensionAdapter: new () => { provider: () => unknown }
  }

  const modeAdapters =
    config.mode === 'gateway'
      ? [new RemoteAdapter({ name: 'Default Gateway', rpcUrl: config.gatewayUrl })]
      : [new ExtensionAdapter()]

  const adapters = [...modeAdapters, ...((config.additionalAdapters ?? []) as never[])]
  const discovery = await DiscoveryClient.create({ adapters })
  const session = discovery.getActiveSession()
  if (session) {
    return new DappClient(session.provider, { providerType: session.adapter.type })
  }
  const provider = (adapters[0] as { provider: () => unknown }).provider()
  return new DappClient(provider)
}

export function WalletProvider({ config, children }: WalletProviderProps): JSX.Element {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [accounts, setAccounts] = useState<Wallet[]>([])
  const [dappClient, setDappClient] = useState<DappClient | null>(
    config.dappClient ?? null
  )
  const clientRef = useRef<CantonClient | null>(null)
  if (config.dappClient && !clientRef.current) {
    const clientOpts: CreateCantonClientOptions = { dappClient: config.dappClient }
    clientRef.current = createCantonClient(clientOpts)
  }
  const queryClient = useMemo(() => config.queryClient ?? defaultQueryClient(), [config.queryClient])

  useEffect(() => {
    if (config.dappClient) {
      return () => {
        clientRef.current?.destroy()
        clientRef.current = null
      }
    }
    let cancelled = false
    constructDappClient(config)
      .then((dc) => {
        if (cancelled) return
        setDappClient(dc)
        clientRef.current = createCantonClient({ dappClient: dc })
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
      clientRef.current?.destroy()
      clientRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config.mode,
    (config as { gatewayUrl?: string }).gatewayUrl,
    config.dappClient,
  ])

  useEffect(() => {
    if (!dappClient) return
    const statusListener = (evt: unknown) => {
      const isConnected = (evt as { connection?: { isConnected?: boolean } }).connection?.isConnected
      setStatus(isConnected ? 'connected' : 'disconnected')
    }
    const accountsListener = (evt: unknown) => {
      const list = (evt as { accounts?: Wallet[] }).accounts ?? []
      setAccounts(list)
    }
    dappClient.onStatusChanged(statusListener as never)
    dappClient.onAccountsChanged(accountsListener as never)
    return () => {
      dappClient.removeOnStatusChanged(statusListener as never)
      dappClient.removeOnAccountsChanged(accountsListener as never)
    }
  }, [dappClient])

  const connect = useCallback(async () => {
    if (!dappClient) throw new Error('DappClient not ready')
    setStatus('connecting')
    try {
      await dappClient.connect()
      const list = await dappClient.listAccounts()
      setAccounts(list as Wallet[])
      setStatus('connected')
    } catch (err) {
      setStatus('error')
      throw err
    }
  }, [dappClient])

  const disconnect = useCallback(async () => {
    if (!dappClient) return
    await dappClient.disconnect()
    setStatus('disconnected')
    setAccounts([])
  }, [dappClient])

  const value: CantonContextValue | null = useMemo(() => {
    if (!dappClient || !clientRef.current) return null
    return {
      client: clientRef.current,
      dappClient,
      status,
      accounts,
      activeParty: accounts[0]?.partyId ?? null,
      connect,
      disconnect,
    }
  }, [dappClient, status, accounts, connect, disconnect])

  return (
    <QueryClientProvider client={queryClient}>
      {value ? (
        <CantonContext.Provider value={value}>{children}</CantonContext.Provider>
      ) : (
        children
      )}
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Replace `CantonProvider.tsx` with deprecated re-export**

Replace the entire content of `packages/react/src/CantonProvider.tsx` with:

```tsx
/** @deprecated Use WalletProvider instead. Will be removed in a future release. */
export { WalletProvider as CantonProvider } from './WalletProvider.js'
export type { WalletProviderConfig as CantonProviderConfig, WalletProviderProps as CantonProviderProps } from './WalletProvider.js'
```

- [ ] **Step 3: Update `index.ts` exports**

In `packages/react/src/index.ts`, replace the `CantonProvider` export line with:

```ts
export { WalletProvider } from './WalletProvider.js'
export type { WalletProviderConfig, WalletProviderProps } from './WalletProvider.js'

// Deprecated — kept for one release cycle
export { CantonProvider } from './CantonProvider.js'
export type { CantonProviderConfig, CantonProviderProps } from './CantonProvider.js'
```

- [ ] **Step 4: Run existing tests to verify no regressions**

```bash
cd packages/react && pnpm test
```

Expected: all existing tests PASS (they import `CantonProvider` which re-exports `WalletProvider`)

- [ ] **Step 5: Typecheck**

```bash
cd packages/react && pnpm typecheck
```

Expected: exits 0

- [ ] **Step 6: Commit**

```bash
git add packages/react/src/WalletProvider.tsx packages/react/src/CantonProvider.tsx packages/react/src/index.ts
git commit -m "feat(react): add WalletProvider with mode union, deprecate CantonProvider"
```

---

## Task 6: Add `LedgerContext` and `useCantonAuth`

**Files:**
- Create: `packages/react/src/LedgerContext.ts`
- Create: `packages/react/src/hooks/useCantonAuth.ts`

`LedgerProvider` needs its own context separate from `CantonContext` because it exposes `useCantonAuth()` which is not available under `WalletProvider`.

- [ ] **Step 1: Create `LedgerContext.ts`**

Create `packages/react/src/LedgerContext.ts`:

```ts
import { createContext, useContext } from 'react'

export interface CantonAuthState {
  isAuthenticated: boolean
  token: string | undefined
  login: () => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export const LedgerAuthContext = createContext<CantonAuthState | null>(null)

export function useLedgerAuthContext(): CantonAuthState {
  const ctx = useContext(LedgerAuthContext)
  if (!ctx) throw new Error('useCantonAuth must be used inside <LedgerProvider>')
  return ctx
}
```

- [ ] **Step 2: Create `useCantonAuth.ts`**

Create `packages/react/src/hooks/useCantonAuth.ts`:

```ts
import { useLedgerAuthContext, type CantonAuthState } from '../LedgerContext.js'

export function useCantonAuth(): CantonAuthState {
  return useLedgerAuthContext()
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/react/src/LedgerContext.ts packages/react/src/hooks/useCantonAuth.ts
git commit -m "feat(react): add LedgerContext and useCantonAuth hook"
```

---

## Task 7: Implement `LedgerProvider`

**Files:**
- Create: `packages/react/src/LedgerProvider.tsx`
- Create: `packages/react/src/LedgerProvider.test.tsx`
- Modify: `packages/react/src/index.ts`

`LedgerProvider` manages auth state and creates a `CantonClient` via `createJsonLedgerClient`. The `getToken` passed to the client is a closure over `tokenRef`, so token updates from `logout` are immediately reflected without rebuilding the client.

- [ ] **Step 1: Write the failing tests**

Create `packages/react/src/LedgerProvider.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { LedgerProvider } from './LedgerProvider.js'
import { useCantonAuth } from './hooks/useCantonAuth.js'
import { useCantonClient } from './context.js'

const wrapper =
  (token?: string) =>
  ({ children }: { children: React.ReactNode }) =>
    (
      <LedgerProvider
        config={{
          ledgerUrl: 'http://localhost:7575',
          party: 'Alice::abc',
          auth: { mode: 'static', token },
        }}
      >
        {children}
      </LedgerProvider>
    )

describe('LedgerProvider', () => {
  it('exposes a CantonClient to children', () => {
    const { result } = renderHook(() => useCantonClient(), { wrapper: wrapper('tok') })
    expect(typeof result.current.queryACS).toBe('function')
  })

  it('useCantonAuth returns isAuthenticated=true when token is provided', () => {
    const { result } = renderHook(() => useCantonAuth(), { wrapper: wrapper('tok') })
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.token).toBe('tok')
  })

  it('useCantonAuth returns isAuthenticated=false when token is undefined', () => {
    const { result } = renderHook(() => useCantonAuth(), { wrapper: wrapper(undefined) })
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.token).toBeUndefined()
  })

  it('logout clears the token', async () => {
    const { result } = renderHook(() => useCantonAuth(), { wrapper: wrapper('tok') })
    await act(async () => { await result.current.logout() })
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.token).toBeUndefined()
  })

  it('login and refresh are no-ops in static mode', async () => {
    const { result } = renderHook(() => useCantonAuth(), { wrapper: wrapper('tok') })
    await act(async () => { await result.current.login() })
    await act(async () => { await result.current.refresh() })
    expect(result.current.token).toBe('tok')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/react && pnpm test -- LedgerProvider
```

Expected: FAIL — `Cannot find module './LedgerProvider.js'`

- [ ] **Step 3: Implement `LedgerProvider.tsx`**

Create `packages/react/src/LedgerProvider.tsx`:

```tsx
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  QueryClient,
  QueryClientProvider,
  type QueryClient as QC,
} from '@tanstack/react-query'
import { createJsonLedgerClient, type CantonClient } from '@cantonkit/core'
import { CantonContext, type CantonContextValue, type Wallet } from './context.js'
import { LedgerAuthContext, type CantonAuthState } from './LedgerContext.js'

export type LedgerAuthConfig =
  | { mode: 'static'; token?: string }
  | { mode: 'oauth2'; issuerUrl: string; clientId: string }

export interface LedgerProviderConfig {
  ledgerUrl: string
  party: string
  auth: LedgerAuthConfig
  maxReconnectAttempts?: number
  queryClient?: QC
}

export interface LedgerProviderProps {
  config: LedgerProviderConfig
  children: ReactNode
}

function defaultQueryClient(): QC {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
    },
  })
}

export function LedgerProvider({ config, children }: LedgerProviderProps): JSX.Element {
  const [token, setToken] = useState<string | undefined>(
    config.auth.mode === 'static' ? config.auth.token : undefined
  )

  // tokenRef lets getToken always read the latest token without rebuilding the client.
  const tokenRef = useRef(token)
  tokenRef.current = token

  const clientRef = useRef<CantonClient | null>(null)
  if (!clientRef.current) {
    clientRef.current = createJsonLedgerClient({
      ledgerUrl: config.ledgerUrl,
      party: config.party,
      getToken: () => tokenRef.current,
      maxReconnectAttempts: config.maxReconnectAttempts,
    })
  }

  const queryClient = useMemo(
    () => config.queryClient ?? defaultQueryClient(),
    [config.queryClient]
  )

  const login = useCallback(async () => {
    if (config.auth.mode === 'oauth2') {
      throw new Error('OAuth2 login not yet implemented')
    }
    // static mode: no-op
  }, [config.auth.mode])

  const logout = useCallback(async () => {
    setToken(undefined)
  }, [])

  const refresh = useCallback(async () => {
    if (config.auth.mode === 'oauth2') {
      throw new Error('OAuth2 refresh not yet implemented')
    }
    // static mode: no-op
  }, [config.auth.mode])

  const authValue: CantonAuthState = useMemo(
    () => ({ isAuthenticated: token !== undefined, token, login, logout, refresh }),
    [token, login, logout, refresh]
  )

  const party = config.party
  const cantonValue: CantonContextValue = useMemo(
    () => ({
      client: clientRef.current!,
      dappClient: null as never,
      status: token !== undefined ? 'connected' : 'disconnected',
      accounts: token !== undefined ? [{ partyId: party }] : [] as Wallet[],
      activeParty: token !== undefined ? party : null,
      connect: login,
      disconnect: logout,
    }),
    [token, party, login, logout]
  )

  return (
    <QueryClientProvider client={queryClient}>
      <LedgerAuthContext.Provider value={authValue}>
        <CantonContext.Provider value={cantonValue}>
          {children}
        </CantonContext.Provider>
      </LedgerAuthContext.Provider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/react && pnpm test -- LedgerProvider
```

Expected: PASS (5 tests)

- [ ] **Step 5: Update `index.ts` to export `LedgerProvider` and `useCantonAuth`**

Add to `packages/react/src/index.ts`:

```ts
export { LedgerProvider } from './LedgerProvider.js'
export type { LedgerProviderConfig, LedgerProviderProps, LedgerAuthConfig } from './LedgerProvider.js'

export { useCantonAuth } from './hooks/useCantonAuth.js'
export type { CantonAuthState } from './LedgerContext.js'
```

- [ ] **Step 6: Run all react tests**

```bash
cd packages/react && pnpm test
```

Expected: all tests PASS

- [ ] **Step 7: Typecheck**

```bash
cd packages/react && pnpm typecheck
```

Expected: exits 0

- [ ] **Step 8: Commit**

```bash
git add packages/react/src/LedgerProvider.tsx packages/react/src/LedgerProvider.test.tsx packages/react/src/LedgerContext.ts packages/react/src/hooks/useCantonAuth.ts packages/react/src/index.ts
git commit -m "feat(react): add LedgerProvider and useCantonAuth for direct ledger access"
```

---

## Task 8: Create `counter-app-localnet` example

**Files:**
- Create: `examples/counter-app-localnet/daml/daml.yaml`
- Create: `examples/counter-app-localnet/daml/Counter.daml`
- Create: `examples/counter-app-localnet/index.html`
- Create: `examples/counter-app-localnet/package.json`
- Create: `examples/counter-app-localnet/tsconfig.json`
- Create: `examples/counter-app-localnet/vite.config.ts`
- Create: `examples/counter-app-localnet/.env.example`
- Create: `examples/counter-app-localnet/src/main.tsx`
- Create: `examples/counter-app-localnet/src/App.tsx`

- [ ] **Step 1: Create `daml/daml.yaml`**

Create `examples/counter-app-localnet/daml/daml.yaml`:

```yaml
sdk-version: 3.1.0
name: counter
version: 1.0.0
source: .
parties:
  - Alice
build-options:
  - --target=2.1
```

- [ ] **Step 2: Create `daml/Counter.daml`**

Create `examples/counter-app-localnet/daml/Counter.daml`:

```daml
module Counter where

template Counter
  with
    owner : Party
    count : Int
  where
    signatory owner

    choice Increment : ContractId Counter
      controller owner
      do create this with count = count + 1
```

- [ ] **Step 3: Create `package.json`**

Create `examples/counter-app-localnet/package.json`:

```json
{
  "name": "@cantonkit-examples/counter-app-localnet",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@cantonkit/react": "workspace:*",
    "@cantonkit/core": "workspace:*",
    "@tanstack/react-query": "^5.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 4: Create `tsconfig.json`**

Create `examples/counter-app-localnet/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create `vite.config.ts`**

Create `examples/counter-app-localnet/vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

- [ ] **Step 6: Create `index.html`**

Create `examples/counter-app-localnet/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CantonKit Counter — Localnet</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `.env.example`**

Create `examples/counter-app-localnet/.env.example`:

```
VITE_LEDGER_URL=http://localhost:7575
VITE_PARTY=                # paste party ID from `daml start` output, e.g. Alice::abc123...
VITE_TOKEN=                # leave empty if sandbox runs with no-auth mode
```

- [ ] **Step 8: Create `src/main.tsx`**

Create `examples/counter-app-localnet/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 9: Create `src/App.tsx`**

Create `examples/counter-app-localnet/src/App.tsx`:

```tsx
import {
  LedgerProvider,
  useCantonAuth,
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
  const { isAuthenticated, token } = useCantonAuth()
  const counters = useContracts<Counter>({
    templateId: COUNTER,
    parties: [import.meta.env.VITE_PARTY],
  })
  const submit = useSubmit()
  const stream = useTransactionStream({
    filter: { templateIds: [COUNTER], parties: [import.meta.env.VITE_PARTY] },
  })

  if (!isAuthenticated) {
    return (
      <main>
        <h1>CantonKit Counter — Localnet</h1>
        <p>No token configured. Set VITE_TOKEN in your .env file.</p>
      </main>
    )
  }

  return (
    <main>
      <h1>CantonKit Counter — Localnet</h1>
      <p>Party: {import.meta.env.VITE_PARTY}</p>

      <h2>Your counters</h2>
      {counters.isLoading && <p>Loading…</p>}
      {counters.error && <p>Error: {counters.error.message}</p>}
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
```

- [ ] **Step 10: Install and typecheck**

```bash
pnpm install && cd examples/counter-app-localnet && pnpm exec tsc --noEmit
```

Expected: exits 0

- [ ] **Step 11: Commit**

```bash
git add examples/counter-app-localnet/
git commit -m "feat(examples): add counter-app-localnet demo for direct JSON Ledger API"
```

---

## Task 9: Run full test suite and typecheck

- [ ] **Step 1: Run all tests**

```bash
pnpm --filter '@cantonkit/core' test && pnpm --filter '@cantonkit/react' test
```

Expected: all tests PASS, no regressions

- [ ] **Step 2: Typecheck all packages**

```bash
pnpm --filter '@cantonkit/core' typecheck && pnpm --filter '@cantonkit/react' typecheck
```

Expected: both exit 0

- [ ] **Step 3: Commit**

If no issues, nothing to commit. If fixes were needed, commit them:

```bash
git add -p
git commit -m "fix: address typecheck and test issues from full suite run"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `WalletProvider` with `mode: 'gateway' \| 'extension'` | Task 5 |
| `gatewayUrl` not required for extension mode | Task 5 |
| `CantonProvider` deprecated re-export | Task 5 |
| `ledgerUrl`/`auth` removed from `WalletProvider` | Task 5 |
| `LedgerProvider` with `auth.mode: 'static' \| 'oauth2'` | Task 7 |
| `useCantonAuth()` — isAuthenticated, token, login, logout, refresh | Tasks 6, 7 |
| static mode: login/refresh no-op | Task 7 |
| `createJsonLedgerClient` returning `CantonClient` | Task 4 |
| `viaLedgerProvider` transport using `core-provider-ledger` | Task 2 |
| `submitViaLedger` / `submitAndWaitViaLedger` | Task 3 |
| `counter-app-localnet` with `Counter.daml` + `daml.yaml` | Task 8 |
| Demo uses `LedgerProvider`, all three hooks work | Task 8 |
| oauth2 mode: login/refresh throw "not yet implemented" | Task 7 (explicit placeholder is intentional per spec "not in scope") |
