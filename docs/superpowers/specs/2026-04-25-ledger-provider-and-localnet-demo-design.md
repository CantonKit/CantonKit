# Design: LedgerProvider + counter-app-localnet Demo

Date: 2026-04-25

## Background

The existing `CantonProvider` conflates two concerns: wallet connection (via `@canton-network/dapp-sdk` gateway) and a partial JSON Ledger API integration (WebSocket stream only). This makes the provider's responsibility unclear and leaves the ledger direct-connect path incomplete — reads and writes still go through the wallet even when `ledgerUrl` is configured.

This design:
1. Renames and clarifies the two connection paths into `WalletProvider` and `LedgerProvider`
2. Completes the JSON Ledger API path (reads, writes, and streams all go direct)
3. Adds `useCantonAuth()` for token lifecycle management in the ledger path
4. Adds a runnable `counter-app-localnet` example backed by a real Canton sandbox

---

## Goals

- Two flat, non-overlapping providers with names in the same dimension ("who is the counterparty")
- All existing hooks (`useContracts`, `useSubmit`, `useTransactionStream`) work under both providers unchanged
- `LedgerProvider` handles token lifecycle; callers do not manage tokens directly after construction
- Demo runs end-to-end against a local `daml start` sandbox with no external accounts required

---

## Provider Design

### WalletProvider (renamed from CantonProvider)

Connects to a Canton wallet via `@canton-network/dapp-sdk`. Responsible for wallet connection, disconnection, and party discovery. Does not accept `ledgerUrl` or `auth`.

Config is a discriminated union on `mode`, because different wallet connection mechanisms require different parameters:

```tsx
// Remote gateway (HTTP/SSE JSON-RPC endpoint)
<WalletProvider config={{
  mode: 'gateway',
  gatewayUrl: 'https://gateway.example.com/api/json-rpc',
}}>

// Browser extension wallet — no URL required
// WalletProvider constructs new ExtensionAdapter() internally;
// ExtensionAdapter auto-discovers any CIP-103 compliant extension via postMessage.
<WalletProvider config={{
  mode: 'extension',
}}>
```

`gatewayUrl` is only required when `mode` is `'gateway'`. For `mode: 'extension'`, `WalletProvider` constructs `new ExtensionAdapter()` internally — no adapter needs to be passed by the caller.

Both modes accept an optional `additionalAdapters` field as an escape hatch for advanced cases (e.g. supporting multiple extension wallets simultaneously, or injecting a custom `InjectedAdapter` in tests). Ordinary users do not need it.

Exposes via context:
- `useCantonConnection()` — status, activeParty, connect(), disconnect()
- `useContracts()`, `useSubmit()`, `useTransactionStream()`

### LedgerProvider (new)

Connects directly to the JSON Ledger API v2. Responsible for token lifecycle and constructing `CantonClient` via `createJsonLedgerClient`. Does not involve any wallet or dapp-sdk concepts.

```tsx
<LedgerProvider config={{
  ledgerUrl: 'http://localhost:7575',
  party: 'Alice::...',
  auth: { mode: 'static', token: '...' }
  // or
  auth: { mode: 'oauth2', issuerUrl: '...', clientId: '...' }
}}>
```

Exposes via context:
- `useCantonAuth()` — token state, login(), logout(), refresh(); interface is the same regardless of auth mode
- `useContracts()`, `useSubmit()`, `useTransactionStream()`

`WalletProvider` and `LedgerProvider` implement the same underlying `CantonContext`, so all data hooks work identically under either provider.

---

## useCantonAuth()

Available only under `LedgerProvider`. Hides the difference between `static` and `oauth2` modes.

```ts
interface CantonAuthState {
  isAuthenticated: boolean
  token: string | undefined
  login: () => Promise<void>    // no-op in static mode
  logout: () => Promise<void>
  refresh: () => Promise<void>  // no-op in static mode
}

function useCantonAuth(): CantonAuthState
```

**static mode**: token is taken from config at construction time. `login`/`refresh` are no-ops. `logout` clears the token from context (does not invalidate server-side).

**oauth2 mode**: `login()` initiates the OAuth2 authorization code flow. `refresh()` uses the refresh token to obtain a new access token. `logout()` clears tokens and optionally calls the provider's end-session endpoint.

---

## Core Library Changes

### New dependencies

`@canton-network/core-provider-ledger` is added as a dependency of `@cantonkit/core`. This official package provides a `LedgerProvider` class that implements the same `Provider` interface as the wallet adapters, but connects directly to the JSON Ledger API over HTTP. It handles auth token injection via an `accessTokenProvider` callback and provides full OpenAPI-typed request/response pairs. Using it avoids hand-rolling raw `fetch` calls and stays aligned with the canton-network SDK family.

### New files in `@cantonkit/core`

#### `packages/core/src/transport/viaLedgerProvider.ts`
Implements `LedgerTransport` using `@canton-network/core-provider-ledger`'s `LedgerProvider`. Accepts a `getToken` callback; token refreshes are transparent because the callback is invoked on every request.

```ts
import { LedgerProvider } from '@canton-network/core-provider-ledger'

export function viaLedgerProvider(
  ledgerUrl: string,
  getToken: () => string | undefined
): LedgerTransport {
  const provider = new LedgerProvider({
    baseUrl: ledgerUrl,
    accessTokenProvider: { getAccessToken: () => getToken() ?? '' },
  })
  // wraps provider.request({ method: 'ledgerApi', ... }) into LedgerTransport
}
```

This replaces the previously proposed `viaFetch.ts`. The structure mirrors the existing `viaLedgerApi.ts` (which wraps `DappClient.ledgerApi`), keeping the two transports symmetric.

#### `packages/core/src/ledger/submitViaLedger.ts`
Implements submit and submitAndWait by calling `POST /v2/commands/submit` and `POST /v2/commands/submit-and-wait` via the same `LedgerProvider` instance.

#### `packages/core/src/client.ts` (extended)
New export alongside the existing `createCantonClient`:

```ts
export interface JsonLedgerClientOptions {
  ledgerUrl: string
  party: string
  getToken: () => string | undefined  // injected by LedgerProvider; token refreshes are transparent
  maxReconnectAttempts?: number
}

export function createJsonLedgerClient(opts: JsonLedgerClientOptions): CantonClient
```

Returns a `CantonClient` — same interface as `createCantonClient`. All three paths (read, write, stream) go directly to the JSON Ledger API:
- Read: `viaFetch` transport → existing `queryACS`, `getTransactionById`
- Write: `submitViaLedger`
- Stream: existing `createLedgerStream` (already WebSocket direct-connect)

### New files in `@cantonkit/react`

#### `packages/react/src/LedgerProvider.tsx`
Constructs a `CantonClient` via `createJsonLedgerClient`, manages the auth state machine, and provides context to child hooks. `getToken` is a closure over the current auth state so token refreshes are transparent to the client.

#### `packages/react/src/hooks/useCantonAuth.ts`
Reads auth state from `LedgerProvider` context.

### Renamed in `@cantonkit/react`

`CantonProvider.tsx` → `WalletProvider.tsx`. The old name `CantonProvider` is kept as a deprecated re-export for one release cycle to avoid a hard breaking change.

The existing `ledgerUrl` and `auth` fields are removed from `WalletProvider`'s config. They belong exclusively to `LedgerProvider`.

---

## Demo: counter-app-localnet

### Directory structure

```
examples/counter-app-localnet/
├── daml/
│   ├── daml.yaml          # sandbox config, no-auth mode
│   └── Counter.daml       # Counter template
├── src/
│   ├── main.tsx
│   └── App.tsx            # uses LedgerProvider + createJsonLedgerClient
├── .env.example
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Counter.daml

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

### daml.yaml

Configures sandbox with no authentication and the Counter module.

### App.tsx

```tsx
<LedgerProvider config={{
  ledgerUrl: import.meta.env.VITE_LEDGER_URL,
  party: import.meta.env.VITE_PARTY,
  auth: { mode: 'static', token: import.meta.env.VITE_TOKEN },
}}>
  <CounterApp />
</LedgerProvider>
```

`CounterApp` uses `useContracts`, `useSubmit`, `useTransactionStream` — identical to `counter-app` except no wallet connection UI.

### .env.example

```
VITE_LEDGER_URL=http://localhost:6864
VITE_PARTY=                # paste party ID from daml start output
VITE_TOKEN=                # leave empty if sandbox auth is disabled
```

### Running the demo

```bash
# 1. Install dpm (replaces the old Daml SDK installer)
curl -sSL https://get.digitalasset.com/install/install.sh | sh

# 2. Install the SDK version pinned in daml.yaml
cd examples/counter-app-localnet/daml
dpm install 3.4.11

# 3. Build the Daml archive
dpm build

# 4. Start sandbox (no-auth mode; parties from daml.yaml are auto-allocated)
dpm sandbox --dar .daml/dist/counter-1.0.0.dar

# 5. Copy party ID from sandbox output, fill .env

# 6. Start frontend (separate terminal)
cd examples/counter-app-localnet
pnpm dev
```

---

## What is NOT in scope

- Party allocation UI (parties are declared in `daml.yaml`; `dpm sandbox` allocates them automatically)
- Token generation UI (use `.env` or a script)
- OAuth2 provider setup (design covers the interface; wiring to a real provider is a follow-up)
- Changes to existing tests

---

## File change summary

| File | Change |
|---|---|
| `packages/core/src/transport/viaLedgerProvider.ts` | New |
| `packages/core/src/ledger/submitViaLedger.ts` | New |
| `packages/core/src/client.ts` | Add `createJsonLedgerClient` |
| `packages/core/src/index.ts` | Export new types and function |
| `packages/react/src/LedgerProvider.tsx` | New |
| `packages/react/src/hooks/useCantonAuth.ts` | New |
| `packages/react/src/WalletProvider.tsx` | Renamed from CantonProvider |
| `packages/react/src/index.ts` | Update exports |
| `examples/counter-app-localnet/` | New directory |
