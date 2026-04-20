# CantonKit v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@cantonkit/core` + `@cantonkit/react` — a TypeScript-first, Wagmi-style SDK wrapping `@canton-network/dapp-sdk` v1.0.0.

**Architecture:** pnpm monorepo with two packages. `@cantonkit/core` is framework-agnostic and holds the `CantonClient` factory, typed ledger operations, error model, and transport. `@cantonkit/react` provides `<CantonProvider>` plus `useContracts` / `useSubmit` / `useTransactionStream` hooks, all built on `@tanstack/react-query` v5. Tests mock two seams: `DappClient` (for core) and `CantonClient` (for React).

**Tech Stack:** TypeScript 5.5+, pnpm workspaces, tsup (ESM+CJS), Vitest 2.x, @testing-library/react 16.x, React 18+, @tanstack/react-query ^5, `@canton-network/dapp-sdk` ^1.0.0, Changesets, GitHub Actions.

---

## Reference: Spec

Full design lives at `docs/superpowers/specs/2026-04-20-cantonkit-design.md`. Read it before starting — every decision point is documented there.

## Reference: TDD discipline

Every behavior-bearing task follows:
1. Write the failing test
2. Run it, confirm it fails for the expected reason
3. Write the minimum code to pass
4. Run it, confirm it passes
5. Commit

Types-only, config-only, and docs-only tasks skip steps 1–2.

---

## File Structure

```
CantonKit/
├── package.json                                 root, private, scripts orchestrate workspaces
├── pnpm-workspace.yaml
├── tsconfig.base.json                           strict, exactOptional, noUncheckedIndexedAccess
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
├── .changeset/config.json
├── .github/workflows/ci.yml
├── LICENSE                                      Apache-2.0
├── README.md                                    public root docs + Quick Start
│
├── docs/superpowers/
│   ├── specs/2026-04-20-cantonkit-design.md    (exists)
│   └── plans/2026-04-20-cantonkit-v1-implementation.md   (this file)
│
├── packages/core/
│   ├── package.json                             name=@cantonkit/core, peer dapp-sdk ^1.0.0
│   ├── tsconfig.json
│   ├── tsup.config.ts
│   ├── vitest.config.ts                         node env
│   └── src/
│       ├── index.ts                             public exports only
│       ├── client.ts                            createCantonClient factory
│       ├── error.ts                             CantonError class + code union
│       ├── types/
│       │   ├── index.ts                         re-exports
│       │   ├── commands.ts                      Command, CreateCommand, ExerciseCommand, SubmitOptions, SubmitResult, TemplateId brand
│       │   ├── contracts.ts                     ActiveContract<T>, QueryACSOptions
│       │   └── transactions.ts                  TransactionEvent union, WalletTxEvent, LedgerTxEvent, SubscribeOptions, Unsubscribe
│       ├── transport/
│       │   ├── viaLedgerApi.ts                  wraps DappClient.ledgerApi → typed POST/GET
│       │   └── viaWebSocket.ts                  direct /v2 WS + reconnect with injectable clock
│       ├── ledger/
│       │   ├── queryACS.ts                      POST /v2/state/active-contracts
│       │   ├── submitAndWait.ts                 via DappClient.prepareExecuteAndWait
│       │   ├── submit.ts                        via DappClient.prepareExecute
│       │   ├── getTransactionById.ts            GET /v2/updates/transaction-by-id/:id
│       │   └── streamTransactions.ts            dispatches to wallet or ledger source
│       └── test/
│           └── fakeDappClient.ts                shared fixture (exported for @cantonkit/react tests too)
│
└── packages/react/
    ├── package.json                             name=@cantonkit/react, peers: core, dapp-sdk, react>=18, @tanstack/react-query ^5
    ├── tsconfig.json
    ├── tsup.config.ts
    ├── vitest.config.ts                         jsdom env
    └── src/
        ├── index.ts                             public exports only
        ├── context.ts                           CantonContext, useCantonClient, useCantonConnection
        ├── CantonProvider.tsx                   provider; constructs DappClient + CantonClient + QueryClient
        ├── ssr.ts                               typeof window guards, hydration helpers
        ├── hooks/
        │   ├── useContracts.ts
        │   ├── useSubmit.ts
        │   └── useTransactionStream.ts
        └── testing/
            ├── index.ts                         subpath entry
            ├── createFakeCantonClient.ts
            └── TestCantonProvider.tsx
```

Each source file has one sibling `.test.ts` / `.test.tsx` colocated in the same directory. Example: `packages/core/src/ledger/queryACS.ts` pairs with `packages/core/src/ledger/queryACS.test.ts`.

---

## Task 0: Verify environment

**Files:** none

- [ ] **Step 1: Verify Node and pnpm**

Run:
```bash
node --version && pnpm --version
```
Expected: Node `>=20.0.0`, pnpm `>=9.0.0`. If pnpm missing: `corepack enable && corepack prepare pnpm@latest --activate`.

- [ ] **Step 2: Verify git user**

Run:
```bash
git config user.email && git config user.name
```
Expected: both set. If not, set them before proceeding.

- [ ] **Step 3: Confirm working directory is clean**

Run:
```bash
cd /Users/jason/github/CantonKit && git status --short
```
Expected: only `.idea/` untracked (or empty).

---

## Task 1: Monorepo skeleton + tooling

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.eslintrc.cjs`, `.prettierrc`, `.changeset/config.json`, `LICENSE`

- [ ] **Step 1: Write `.gitignore`**

```
node_modules/
dist/
coverage/
*.log
.DS_Store
.idea/
.vscode/
.turbo/
*.tsbuildinfo
.changeset/*.md
!.changeset/README.md
!.changeset/config.json
```

- [ ] **Step 2: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "examples/*"
```

- [ ] **Step 3: Write root `package.json`**

```json
{
  "name": "cantonkit",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.0",
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "build": "pnpm -r --filter './packages/*' build",
    "test": "pnpm -r --filter './packages/*' test",
    "typecheck": "pnpm -r --filter './packages/*' typecheck",
    "lint": "eslint 'packages/*/src/**/*.{ts,tsx}'",
    "format": "prettier --write 'packages/*/src/**/*.{ts,tsx,json,md}'",
    "changeset": "changeset",
    "release": "pnpm build && changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint": "^9.0.0",
    "eslint-plugin-react": "^7.35.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "prettier": "^3.3.0",
    "tsup": "^8.3.0",
    "typescript": "^5.5.0",
    "vitest": "^2.1.0",
    "@vitest/coverage-v8": "^2.1.0"
  }
}
```

- [ ] **Step 4: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 5: Write `.prettierrc`**

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "always"
}
```

- [ ] **Step 6: Write `.eslintrc.cjs`**

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: { react: { version: '18.3.0' } },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
}
```

- [ ] **Step 7: Write `LICENSE`**

Paste the standard Apache-2.0 license text with copyright line:

```
Copyright 2026 CantonKit contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

(The short preamble above is sufficient — full license text is optional but recommended; include it from https://www.apache.org/licenses/LICENSE-2.0.txt.)

- [ ] **Step 8: Initialize Changesets**

Run:
```bash
pnpm install
pnpm changeset init
```
Expected: creates `.changeset/config.json` and `.changeset/README.md`.

- [ ] **Step 9: Update `.changeset/config.json`**

Edit the generated file so `access` is `"public"`:
```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [["@cantonkit/core", "@cantonkit/react"]],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

- [ ] **Step 10: Verify tooling**

Run:
```bash
pnpm typecheck 2>&1 || true
```
Expected: exits cleanly with "no projects found" (no packages yet) — this just proves pnpm workspaces load.

- [ ] **Step 11: Commit**

```bash
git add .
git commit -m "chore: monorepo skeleton (pnpm, tsconfig, eslint, changesets)"
```

---

## Task 2: `@cantonkit/core` package bootstrap

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/tsup.config.ts`, `packages/core/vitest.config.ts`, `packages/core/src/index.ts`, `packages/core/README.md`

- [ ] **Step 1: Write `packages/core/package.json`**

```json
{
  "name": "@cantonkit/core",
  "version": "0.1.0",
  "description": "Framework-agnostic TypeScript client for the Canton Network, wrapping @canton-network/dapp-sdk.",
  "license": "Apache-2.0",
  "type": "module",
  "sideEffects": false,
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run --coverage",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "@canton-network/dapp-sdk": "^1.0.0"
  },
  "devDependencies": {
    "@canton-network/dapp-sdk": "^1.0.0"
  },
  "publishConfig": { "access": "public" }
}
```

- [ ] **Step 2: Write `packages/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 3: Write `packages/core/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
})
```

- [ ] **Step 4: Write `packages/core/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test/**', 'src/index.ts'],
      thresholds: { lines: 90, functions: 90, branches: 85 },
    },
  },
})
```

- [ ] **Step 5: Write placeholder `packages/core/src/index.ts`**

```ts
// Public exports for @cantonkit/core. Populated by later tasks.
export {}
```

- [ ] **Step 6: Write `packages/core/README.md`**

```markdown
# @cantonkit/core

Framework-agnostic TypeScript client for the Canton Network, wrapping [`@canton-network/dapp-sdk`](https://www.npmjs.com/package/@canton-network/dapp-sdk).

See the [main README](../../README.md) for usage.
```

- [ ] **Step 7: Install and verify**

Run:
```bash
pnpm install
pnpm --filter @cantonkit/core typecheck
```
Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add packages/core
git commit -m "feat(core): bootstrap @cantonkit/core package"
```

---

## Task 3: Core types — commands, contracts, transactions

**Files:**
- Create: `packages/core/src/types/commands.ts`, `packages/core/src/types/contracts.ts`, `packages/core/src/types/transactions.ts`, `packages/core/src/types/index.ts`

No tests — types only. TypeScript's compiler is the verifier here.

- [ ] **Step 1: Write `packages/core/src/types/commands.ts`**

```ts
/**
 * Branded template identifier. Canton template IDs are of the form
 * `<package>:<module>:<entity>`, e.g. `#MyApp:Counter:Counter` (the `#`
 * prefix denotes the "primary" package when working with dapp-sdk).
 */
export type TemplateId = string & { readonly __brand: 'TemplateId' }

export function templateId(raw: string): TemplateId {
  return raw as TemplateId
}

export interface CreateCommand {
  CreateCommand: {
    templateId: TemplateId
    createArguments: Record<string, unknown>
  }
}

export interface ExerciseCommand {
  ExerciseCommand: {
    templateId: TemplateId
    contractId: string
    choice: string
    choiceArgument: Record<string, unknown>
  }
}

export interface ExerciseByKeyCommand {
  ExerciseByKeyCommand: {
    templateId: TemplateId
    contractKey: Record<string, unknown>
    choice: string
    choiceArgument: Record<string, unknown>
  }
}

export type Command = CreateCommand | ExerciseCommand | ExerciseByKeyCommand

export interface SubmitOptions {
  commands: Command[]
  actAs: string[]
  readAs?: string[]
  commandId?: string
  deduplicationDuration?: string // ISO-8601 duration, pass-through to ledger
}

export interface SubmitResult {
  updateId: string
  commandId: string
  completionOffset: string
}
```

- [ ] **Step 2: Write `packages/core/src/types/contracts.ts`**

```ts
import type { TemplateId } from './commands.js'

export interface QueryACSOptions {
  templateId: TemplateId
  parties: string[]
  filter?: { key?: Record<string, unknown> }
}

export interface ActiveContract<T = unknown> {
  contractId: string
  templateId: TemplateId
  payload: T
  signatories: string[]
  observers: string[]
}
```

- [ ] **Step 3: Write `packages/core/src/types/transactions.ts`**

```ts
import type { TemplateId } from './commands.js'

export interface WalletTxEvent {
  source: 'wallet'
  updateId: string
  status: 'submitted' | 'accepted' | 'rejected'
  raw: unknown // opaque payload from DappClient.onTxChanged
}

export interface LedgerTxEvent {
  source: 'ledger'
  updateId: string
  offset: string
  effectiveAt: string
  events: Array<{
    templateId: TemplateId
    contractId: string
    kind: 'created' | 'archived' | 'exercised'
    payload?: unknown
  }>
}

export type TransactionEvent = WalletTxEvent | LedgerTxEvent

export interface SubscribeOptions {
  source?: 'wallet' | 'ledger'
  filter?: {
    templateIds?: TemplateId[]
    parties?: string[]
  }
  onEvent?: (event: TransactionEvent) => void
  onError?: (error: unknown) => void
}

export type Unsubscribe = () => void

export interface Transaction {
  updateId: string
  offset: string
  effectiveAt: string
  events: LedgerTxEvent['events']
}
```

- [ ] **Step 4: Write `packages/core/src/types/index.ts`**

```ts
export * from './commands.js'
export * from './contracts.js'
export * from './transactions.js'
```

- [ ] **Step 5: Verify types compile**

Run:
```bash
pnpm --filter @cantonkit/core typecheck
```
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/types
git commit -m "feat(core): add command, contract, and transaction types"
```

---

## Task 4: `CantonError`

**Files:**
- Create: `packages/core/src/error.ts`, `packages/core/src/error.test.ts`

- [ ] **Step 1: Write the failing test — `packages/core/src/error.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { CantonError } from './error.js'

describe('CantonError', () => {
  it('preserves code, message, status, and cause', () => {
    const cause = new Error('underlying')
    const err = new CantonError('LEDGER_HTTP', 'bad response', { status: 500, cause })
    expect(err.name).toBe('CantonError')
    expect(err.code).toBe('LEDGER_HTTP')
    expect(err.message).toBe('bad response')
    expect(err.status).toBe(500)
    expect(err.cause).toBe(cause)
    expect(err instanceof Error).toBe(true)
  })

  it('supports construction without status or cause', () => {
    const err = new CantonError('NOT_CONNECTED', 'no wallet')
    expect(err.status).toBeUndefined()
    expect(err.cause).toBeUndefined()
  })

  it('has a static wrap helper that converts unknown errors', () => {
    const existing = new CantonError('NOT_CONNECTED', 'already typed')
    expect(CantonError.wrap(existing, 'UNKNOWN')).toBe(existing)

    const wrapped = CantonError.wrap(new Error('raw'), 'UNKNOWN')
    expect(wrapped).toBeInstanceOf(CantonError)
    expect(wrapped.code).toBe('UNKNOWN')
    expect(wrapped.cause).toBeInstanceOf(Error)

    const fromString = CantonError.wrap('oops', 'LEDGER_HTTP')
    expect(fromString.code).toBe('LEDGER_HTTP')
    expect(fromString.message).toBe('oops')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm --filter @cantonkit/core test --no-coverage error.test
```
Expected: FAIL — `CantonError` not found.

- [ ] **Step 3: Write `packages/core/src/error.ts`**

```ts
export type CantonErrorCode =
  | 'NOT_CONNECTED'
  | 'WALLET_REJECTED'
  | 'LEDGER_HTTP'
  | 'LEDGER_TIMEOUT'
  | 'STREAM_CLOSED'
  | 'INVALID_ARGUMENT'
  | 'UNKNOWN'

export interface CantonErrorOptions {
  status?: number
  cause?: unknown
}

export class CantonError extends Error {
  readonly code: CantonErrorCode
  readonly status: number | undefined
  readonly cause: unknown

  constructor(code: CantonErrorCode, message: string, opts: CantonErrorOptions = {}) {
    super(message)
    this.name = 'CantonError'
    this.code = code
    this.status = opts.status
    this.cause = opts.cause
  }

  static wrap(err: unknown, fallbackCode: CantonErrorCode): CantonError {
    if (err instanceof CantonError) return err
    if (err instanceof Error) {
      return new CantonError(fallbackCode, err.message, { cause: err })
    }
    return new CantonError(fallbackCode, String(err), { cause: err })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pnpm --filter @cantonkit/core test --no-coverage error.test
```
Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/error.ts packages/core/src/error.test.ts
git commit -m "feat(core): CantonError with code union and wrap helper"
```

---

## Task 5: Fake DappClient fixture

**Files:**
- Create: `packages/core/src/test/fakeDappClient.ts`, `packages/core/src/test/fakeDappClient.test.ts`

The fixture is shared by all core tests and re-exported for React tests. It must faithfully emulate the dapp-sdk surface we call.

- [ ] **Step 1: Write the failing test — `packages/core/src/test/fakeDappClient.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest'
import { createFakeDappClient } from './fakeDappClient.js'

describe('createFakeDappClient', () => {
  it('records ledgerApi calls and returns queued responses', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({ ok: true, body: { data: 'hello' } })

    const result = await fake.ledgerApi({ method: 'GET', url: '/v2/health' })

    expect(result).toEqual({ ok: true, body: { data: 'hello' } })
    expect(fake.__calls.ledgerApi).toHaveLength(1)
    expect(fake.__calls.ledgerApi[0]).toEqual({ method: 'GET', url: '/v2/health' })
  })

  it('throws when ledgerApi called with no queued response', async () => {
    const fake = createFakeDappClient()
    await expect(fake.ledgerApi({ method: 'GET', url: '/v2/x' })).rejects.toThrow(
      /no queued response/
    )
  })

  it('drives onTxChanged listeners via emitTx', () => {
    const fake = createFakeDappClient()
    const listener = vi.fn()
    const unsub = fake.onTxChanged(listener)

    fake.__emitTx({ updateId: 'u1' })
    expect(listener).toHaveBeenCalledWith({ updateId: 'u1' })

    unsub()
    fake.__emitTx({ updateId: 'u2' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('drives status and accounts listeners', () => {
    const fake = createFakeDappClient()
    const statusListener = vi.fn()
    const accountsListener = vi.fn()
    fake.onStatusChanged(statusListener)
    fake.onAccountsChanged(accountsListener)

    fake.__emitStatus({ connection: { isConnected: true } })
    fake.__emitAccounts({ accounts: [{ partyId: 'Alice' }] })

    expect(statusListener).toHaveBeenCalledOnce()
    expect(accountsListener).toHaveBeenCalledOnce()
  })

  it('queues prepareExecuteAndWait results and failures', async () => {
    const fake = createFakeDappClient()
    fake.__queue.prepareExecuteAndWait.push({
      kind: 'ok',
      value: { updateId: 'u1', commandId: 'c1', completionOffset: '0' },
    })
    fake.__queue.prepareExecuteAndWait.push({ kind: 'err', error: new Error('rejected') })

    const ok = await fake.prepareExecuteAndWait({ commands: [], actAs: [] })
    expect(ok.updateId).toBe('u1')

    await expect(fake.prepareExecuteAndWait({ commands: [], actAs: [] })).rejects.toThrow(
      'rejected'
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm --filter @cantonkit/core test --no-coverage fakeDappClient
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write `packages/core/src/test/fakeDappClient.ts`**

```ts
/**
 * Minimal fake of @canton-network/dapp-sdk's DappClient surface that we use.
 * Shared by core tests AND re-exported to @cantonkit/react/testing so React
 * tests can drive the same seams.
 *
 * Fields prefixed with `__` are test-only knobs; production code must not
 * touch them (the real DappClient doesn't have them).
 */

type QueuedResult<T> = { kind: 'ok'; value: T } | { kind: 'err'; error: unknown }

export interface FakeDappClient {
  ledgerApi(params: unknown): Promise<unknown>
  prepareExecute(params: unknown): Promise<null>
  prepareExecuteAndWait(params: unknown): Promise<{
    updateId: string
    commandId: string
    completionOffset: string
  }>
  listAccounts(): Promise<{ accounts: Array<{ partyId: string }> }>
  connect(opts?: unknown): Promise<{ isConnected: boolean }>
  disconnect(): Promise<void>
  status(): Promise<{ connection: { isConnected: boolean } }>
  onTxChanged(listener: (e: unknown) => void): () => void
  onStatusChanged(listener: (e: unknown) => void): () => void
  onAccountsChanged(listener: (e: unknown) => void): () => void

  __queue: {
    ledgerApi: unknown[]
    prepareExecute: QueuedResult<null>[]
    prepareExecuteAndWait: QueuedResult<{
      updateId: string
      commandId: string
      completionOffset: string
    }>[]
    listAccounts: Array<{ accounts: Array<{ partyId: string }> }>
    connect: QueuedResult<{ isConnected: boolean }>[]
  }
  __calls: {
    ledgerApi: unknown[]
    prepareExecute: unknown[]
    prepareExecuteAndWait: unknown[]
    listAccounts: number
    connect: unknown[]
    disconnect: number
  }
  __emitTx(event: unknown): void
  __emitStatus(event: unknown): void
  __emitAccounts(event: unknown): void
}

export function createFakeDappClient(): FakeDappClient {
  const txListeners = new Set<(e: unknown) => void>()
  const statusListeners = new Set<(e: unknown) => void>()
  const accountsListeners = new Set<(e: unknown) => void>()

  const queue: FakeDappClient['__queue'] = {
    ledgerApi: [],
    prepareExecute: [],
    prepareExecuteAndWait: [],
    listAccounts: [],
    connect: [],
  }
  const calls: FakeDappClient['__calls'] = {
    ledgerApi: [],
    prepareExecute: [],
    prepareExecuteAndWait: [],
    listAccounts: 0,
    connect: [],
    disconnect: 0,
  }

  function takeQueuedResult<T>(list: QueuedResult<T>[], label: string): T {
    const next = list.shift()
    if (!next) throw new Error(`no queued response for ${label}`)
    if (next.kind === 'err') throw next.error
    return next.value
  }

  return {
    async ledgerApi(params) {
      calls.ledgerApi.push(params)
      const next = queue.ledgerApi.shift()
      if (next === undefined) throw new Error('no queued response for ledgerApi')
      return next
    },
    async prepareExecute(params) {
      calls.prepareExecute.push(params)
      return takeQueuedResult(queue.prepareExecute, 'prepareExecute')
    },
    async prepareExecuteAndWait(params) {
      calls.prepareExecuteAndWait.push(params)
      return takeQueuedResult(queue.prepareExecuteAndWait, 'prepareExecuteAndWait')
    },
    async listAccounts() {
      calls.listAccounts++
      const next = queue.listAccounts.shift()
      return next ?? { accounts: [] }
    },
    async connect(opts) {
      calls.connect.push(opts)
      return takeQueuedResult(queue.connect, 'connect')
    },
    async disconnect() {
      calls.disconnect++
    },
    async status() {
      return { connection: { isConnected: false } }
    },
    onTxChanged(listener) {
      txListeners.add(listener)
      return () => txListeners.delete(listener)
    },
    onStatusChanged(listener) {
      statusListeners.add(listener)
      return () => statusListeners.delete(listener)
    },
    onAccountsChanged(listener) {
      accountsListeners.add(listener)
      return () => accountsListeners.delete(listener)
    },
    __queue: queue,
    __calls: calls,
    __emitTx(event) {
      txListeners.forEach((l) => l(event))
    },
    __emitStatus(event) {
      statusListeners.forEach((l) => l(event))
    },
    __emitAccounts(event) {
      accountsListeners.forEach((l) => l(event))
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
pnpm --filter @cantonkit/core test --no-coverage fakeDappClient
```
Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/test
git commit -m "test(core): shared FakeDappClient fixture"
```

---

## Task 6: `viaLedgerApi` transport

**Files:**
- Create: `packages/core/src/transport/viaLedgerApi.ts`, `packages/core/src/transport/viaLedgerApi.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { createFakeDappClient } from '../test/fakeDappClient.js'
import { CantonError } from '../error.js'
import { viaLedgerApi } from './viaLedgerApi.js'

describe('viaLedgerApi', () => {
  it('POSTs and returns the response body', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({ ok: true, status: 200, body: { hello: 'world' } })

    const transport = viaLedgerApi(fake as never)
    const result = await transport.post<{ hello: string }>('/v2/foo', { bar: 1 })

    expect(result).toEqual({ hello: 'world' })
    expect(fake.__calls.ledgerApi[0]).toEqual({
      method: 'POST',
      url: '/v2/foo',
      body: { bar: 1 },
    })
  })

  it('GETs with path parameters substituted', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({ ok: true, status: 200, body: { id: 'u1' } })

    const transport = viaLedgerApi(fake as never)
    await transport.get<{ id: string }>('/v2/updates/transaction-by-id/:id', { id: 'u1' })

    expect(fake.__calls.ledgerApi[0]).toEqual({
      method: 'GET',
      url: '/v2/updates/transaction-by-id/u1',
    })
  })

  it('throws LEDGER_HTTP on non-ok response with status preserved', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({
      ok: false,
      status: 500,
      body: { error: 'boom' },
    })

    const transport = viaLedgerApi(fake as never)
    await expect(transport.post('/v2/foo', {})).rejects.toMatchObject({
      name: 'CantonError',
      code: 'LEDGER_HTTP',
      status: 500,
    })
  })

  it('wraps dapp-sdk network errors as UNKNOWN', async () => {
    const fake = createFakeDappClient()
    // no queued response → fake throws a plain Error
    const transport = viaLedgerApi(fake as never)
    const error = await transport.post('/v2/foo', {}).catch((e) => e as CantonError)
    expect(error).toBeInstanceOf(CantonError)
    expect(error.code).toBe('UNKNOWN')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cantonkit/core test --no-coverage viaLedgerApi`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `packages/core/src/transport/viaLedgerApi.ts`**

```ts
import type { DappClient } from '@canton-network/dapp-sdk'
import { CantonError } from '../error.js'

/**
 * `DappClient.ledgerApi` is a low-level proxy. We expect responses of the form
 * `{ ok: boolean, status: number, body: unknown }`. This shape mirrors what
 * dapp-sdk returns for proxied JSON Ledger API calls — verify against a real
 * response the first time you wire this up and adjust if dapp-sdk evolves.
 */
interface LedgerApiResponse {
  ok: boolean
  status: number
  body: unknown
}

export interface LedgerTransport {
  get<T>(url: string, pathParams?: Record<string, string>): Promise<T>
  post<T>(url: string, body: unknown): Promise<T>
}

function substitutePath(url: string, params: Record<string, string> = {}): string {
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replace(`:${key}`, encodeURIComponent(value)),
    url
  )
}

export function viaLedgerApi(dapp: Pick<DappClient, 'ledgerApi'>): LedgerTransport {
  async function call<T>(method: 'GET' | 'POST', url: string, body?: unknown): Promise<T> {
    let response: LedgerApiResponse
    try {
      response = (await dapp.ledgerApi({ method, url, body } as never)) as LedgerApiResponse
    } catch (err) {
      throw CantonError.wrap(err, 'UNKNOWN')
    }
    if (!response.ok) {
      throw new CantonError('LEDGER_HTTP', `Ledger API ${method} ${url} failed`, {
        status: response.status,
        cause: response.body,
      })
    }
    return response.body as T
  }

  return {
    get: (url, pathParams) => call('GET', substitutePath(url, pathParams)),
    post: (url, body) => call('POST', url, body),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cantonkit/core test --no-coverage viaLedgerApi`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/transport/viaLedgerApi.ts packages/core/src/transport/viaLedgerApi.test.ts
git commit -m "feat(core): viaLedgerApi transport with CantonError mapping"
```

---

## Task 7: `queryACS` ledger operation

**Files:**
- Create: `packages/core/src/ledger/queryACS.ts`, `packages/core/src/ledger/queryACS.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { createFakeDappClient } from '../test/fakeDappClient.js'
import { viaLedgerApi } from '../transport/viaLedgerApi.js'
import { queryACS } from './queryACS.js'
import { templateId } from '../types/commands.js'

const TPL = templateId('#App:Mod:T')

describe('queryACS', () => {
  it('POSTs /v2/state/active-contracts with filter payload and returns typed contracts', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({
      ok: true,
      status: 200,
      body: {
        activeContracts: [
          {
            contractId: 'c1',
            templateId: '#App:Mod:T',
            payload: { owner: 'Alice', amount: '100' },
            signatories: ['Alice'],
            observers: [],
          },
        ],
      },
    })

    const transport = viaLedgerApi(fake as never)
    const contracts = await queryACS<{ owner: string; amount: string }>(transport, {
      templateId: TPL,
      parties: ['Alice'],
    })

    expect(contracts).toHaveLength(1)
    expect(contracts[0]).toMatchObject({
      contractId: 'c1',
      payload: { owner: 'Alice', amount: '100' },
    })

    const sent = fake.__calls.ledgerApi[0] as { body: { filter: { filtersByParty: unknown } } }
    expect(sent.body.filter).toBeDefined()
  })

  it('returns empty array on empty activeContracts', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({ ok: true, status: 200, body: { activeContracts: [] } })

    const transport = viaLedgerApi(fake as never)
    const contracts = await queryACS(transport, { templateId: TPL, parties: ['Alice'] })
    expect(contracts).toEqual([])
  })

  it('throws INVALID_ARGUMENT when parties is empty', async () => {
    const fake = createFakeDappClient()
    const transport = viaLedgerApi(fake as never)
    await expect(
      queryACS(transport, { templateId: TPL, parties: [] })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cantonkit/core test --no-coverage queryACS`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `packages/core/src/ledger/queryACS.ts`**

```ts
import type { LedgerTransport } from '../transport/viaLedgerApi.js'
import type { ActiveContract, QueryACSOptions } from '../types/contracts.js'
import type { TemplateId } from '../types/commands.js'
import { CantonError } from '../error.js'

interface RawActiveContract {
  contractId: string
  templateId: string
  payload: unknown
  signatories: string[]
  observers: string[]
}

interface RawResponse {
  activeContracts: RawActiveContract[]
}

/**
 * Queries the JSON Ledger API v2 active contract set.
 * Endpoint: POST /v2/state/active-contracts
 * Request shape follows the v2 ACS filter format (filtersByParty + templateIds).
 * Verify against the current v2 OpenAPI spec if the server rejects the payload.
 */
export async function queryACS<T = unknown>(
  transport: LedgerTransport,
  opts: QueryACSOptions
): Promise<ActiveContract<T>[]> {
  if (opts.parties.length === 0) {
    throw new CantonError('INVALID_ARGUMENT', 'queryACS requires at least one party')
  }

  const body = {
    filter: {
      filtersByParty: Object.fromEntries(
        opts.parties.map((p) => [
          p,
          { cumulative: [{ identifierFilter: { templateFilter: { templateId: opts.templateId } } }] },
        ])
      ),
    },
    verbose: false,
  }

  const raw = await transport.post<RawResponse>('/v2/state/active-contracts', body)

  return raw.activeContracts.map((c) => ({
    contractId: c.contractId,
    templateId: c.templateId as TemplateId,
    payload: c.payload as T,
    signatories: c.signatories,
    observers: c.observers,
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cantonkit/core test --no-coverage queryACS`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ledger/queryACS.ts packages/core/src/ledger/queryACS.test.ts
git commit -m "feat(core): queryACS via POST /v2/state/active-contracts"
```

---

## Task 8: `submit` and `submitAndWait`

**Files:**
- Create: `packages/core/src/ledger/submit.ts`, `packages/core/src/ledger/submit.test.ts`, `packages/core/src/ledger/submitAndWait.ts`, `packages/core/src/ledger/submitAndWait.test.ts`

- [ ] **Step 1: Write failing test — `packages/core/src/ledger/submit.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { createFakeDappClient } from '../test/fakeDappClient.js'
import { submit } from './submit.js'
import { templateId } from '../types/commands.js'

describe('submit', () => {
  it('calls DappClient.prepareExecute with the command payload and returns null', async () => {
    const fake = createFakeDappClient()
    fake.__queue.prepareExecute.push({ kind: 'ok', value: null })

    const result = await submit(fake as never, {
      commands: [
        {
          CreateCommand: {
            templateId: templateId('#App:Mod:T'),
            createArguments: { owner: 'Alice' },
          },
        },
      ],
      actAs: ['Alice'],
    })

    expect(result).toBeNull()
    expect(fake.__calls.prepareExecute).toHaveLength(1)
  })

  it('maps user rejection to WALLET_REJECTED', async () => {
    const fake = createFakeDappClient()
    const rejection = Object.assign(new Error('rejected by user'), { code: 'USER_REJECTED' })
    fake.__queue.prepareExecute.push({ kind: 'err', error: rejection })

    await expect(
      submit(fake as never, { commands: [], actAs: ['Alice'] })
    ).rejects.toMatchObject({ code: 'WALLET_REJECTED' })
  })

  it('wraps generic failures as UNKNOWN', async () => {
    const fake = createFakeDappClient()
    fake.__queue.prepareExecute.push({ kind: 'err', error: new Error('network blip') })

    await expect(
      submit(fake as never, { commands: [], actAs: ['Alice'] })
    ).rejects.toMatchObject({ code: 'UNKNOWN' })
  })
})
```

- [ ] **Step 2: Write failing test — `packages/core/src/ledger/submitAndWait.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { createFakeDappClient } from '../test/fakeDappClient.js'
import { submitAndWait } from './submitAndWait.js'
import { templateId } from '../types/commands.js'

describe('submitAndWait', () => {
  it('returns SubmitResult on successful prepareExecuteAndWait', async () => {
    const fake = createFakeDappClient()
    fake.__queue.prepareExecuteAndWait.push({
      kind: 'ok',
      value: { updateId: 'u1', commandId: 'c1', completionOffset: '42' },
    })

    const result = await submitAndWait(fake as never, {
      commands: [
        {
          CreateCommand: {
            templateId: templateId('#App:Mod:T'),
            createArguments: { owner: 'Alice' },
          },
        },
      ],
      actAs: ['Alice'],
    })

    expect(result).toEqual({ updateId: 'u1', commandId: 'c1', completionOffset: '42' })
  })

  it('generates a commandId if not supplied', async () => {
    const fake = createFakeDappClient()
    fake.__queue.prepareExecuteAndWait.push({
      kind: 'ok',
      value: { updateId: 'u1', commandId: 'generated', completionOffset: '0' },
    })

    await submitAndWait(fake as never, { commands: [], actAs: ['A'] })

    const sent = fake.__calls.prepareExecuteAndWait[0] as { commandId?: string }
    expect(sent.commandId).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('preserves caller-supplied commandId', async () => {
    const fake = createFakeDappClient()
    fake.__queue.prepareExecuteAndWait.push({
      kind: 'ok',
      value: { updateId: 'u1', commandId: 'my-id', completionOffset: '0' },
    })

    await submitAndWait(fake as never, { commands: [], actAs: ['A'], commandId: 'my-id' })

    const sent = fake.__calls.prepareExecuteAndWait[0] as { commandId?: string }
    expect(sent.commandId).toBe('my-id')
  })

  it('maps rejection to WALLET_REJECTED', async () => {
    const fake = createFakeDappClient()
    const err = Object.assign(new Error('rejected'), { code: 'USER_REJECTED' })
    fake.__queue.prepareExecuteAndWait.push({ kind: 'err', error: err })

    await expect(
      submitAndWait(fake as never, { commands: [], actAs: ['A'] })
    ).rejects.toMatchObject({ code: 'WALLET_REJECTED' })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @cantonkit/core test --no-coverage submit`
Expected: FAIL — modules not found.

- [ ] **Step 4: Write `packages/core/src/ledger/submit.ts`**

```ts
import type { DappClient } from '@canton-network/dapp-sdk'
import type { SubmitOptions } from '../types/commands.js'
import { CantonError } from '../error.js'

function isRejection(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string' &&
    /REJECT/i.test((err as { code: string }).code)
  )
}

export async function submit(
  dapp: Pick<DappClient, 'prepareExecute'>,
  opts: SubmitOptions
): Promise<null> {
  try {
    return await dapp.prepareExecute({
      commands: opts.commands,
      actAs: opts.actAs,
      readAs: opts.readAs,
      commandId: opts.commandId,
      deduplicationDuration: opts.deduplicationDuration,
    } as never)
  } catch (err) {
    if (isRejection(err)) {
      throw new CantonError('WALLET_REJECTED', 'User rejected the transaction', { cause: err })
    }
    throw CantonError.wrap(err, 'UNKNOWN')
  }
}
```

- [ ] **Step 5: Write `packages/core/src/ledger/submitAndWait.ts`**

```ts
import type { DappClient } from '@canton-network/dapp-sdk'
import type { SubmitOptions, SubmitResult } from '../types/commands.js'
import { CantonError } from '../error.js'

function isRejection(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string' &&
    /REJECT/i.test((err as { code: string }).code)
  )
}

export interface SubmitDeps {
  idGenerator?: () => string
}

function defaultUuid(): string {
  // RFC4122 v4 — Node 20+ and modern browsers expose crypto.randomUUID
  return globalThis.crypto.randomUUID()
}

export async function submitAndWait(
  dapp: Pick<DappClient, 'prepareExecuteAndWait'>,
  opts: SubmitOptions,
  deps: SubmitDeps = {}
): Promise<SubmitResult> {
  const commandId = opts.commandId ?? (deps.idGenerator ?? defaultUuid)()
  try {
    const result = (await dapp.prepareExecuteAndWait({
      commands: opts.commands,
      actAs: opts.actAs,
      readAs: opts.readAs,
      commandId,
      deduplicationDuration: opts.deduplicationDuration,
    } as never)) as SubmitResult
    return result
  } catch (err) {
    if (isRejection(err)) {
      throw new CantonError('WALLET_REJECTED', 'User rejected the transaction', { cause: err })
    }
    throw CantonError.wrap(err, 'UNKNOWN')
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @cantonkit/core test --no-coverage submit`
Expected: PASS — 7 tests green across both files.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/ledger/submit.ts packages/core/src/ledger/submit.test.ts \
        packages/core/src/ledger/submitAndWait.ts packages/core/src/ledger/submitAndWait.test.ts
git commit -m "feat(core): submit and submitAndWait with rejection mapping"
```

---

## Task 9: `getTransactionById`

**Files:**
- Create: `packages/core/src/ledger/getTransactionById.ts`, `packages/core/src/ledger/getTransactionById.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest'
import { createFakeDappClient } from '../test/fakeDappClient.js'
import { viaLedgerApi } from '../transport/viaLedgerApi.js'
import { getTransactionById } from './getTransactionById.js'

describe('getTransactionById', () => {
  it('GETs /v2/updates/transaction-by-id/:id and returns a Transaction', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({
      ok: true,
      status: 200,
      body: {
        transaction: {
          updateId: 'u1',
          offset: '10',
          effectiveAt: '2026-04-20T00:00:00Z',
          events: [],
        },
      },
    })

    const transport = viaLedgerApi(fake as never)
    const tx = await getTransactionById(transport, 'u1')

    expect(tx.updateId).toBe('u1')
    expect(fake.__calls.ledgerApi[0]).toEqual({
      method: 'GET',
      url: '/v2/updates/transaction-by-id/u1',
    })
  })

  it('url-encodes the id', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({
      ok: true,
      status: 200,
      body: { transaction: { updateId: 'a/b', offset: '0', effectiveAt: '', events: [] } },
    })

    const transport = viaLedgerApi(fake as never)
    await getTransactionById(transport, 'a/b')
    expect(fake.__calls.ledgerApi[0]).toMatchObject({
      url: '/v2/updates/transaction-by-id/a%2Fb',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cantonkit/core test --no-coverage getTransactionById`
Expected: FAIL.

- [ ] **Step 3: Write `packages/core/src/ledger/getTransactionById.ts`**

```ts
import type { LedgerTransport } from '../transport/viaLedgerApi.js'
import type { Transaction } from '../types/transactions.js'

interface RawResponse {
  transaction: Transaction
}

export async function getTransactionById(
  transport: LedgerTransport,
  id: string
): Promise<Transaction> {
  const { transaction } = await transport.get<RawResponse>(
    '/v2/updates/transaction-by-id/:id',
    { id }
  )
  return transaction
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cantonkit/core test --no-coverage getTransactionById`
Expected: PASS — 2 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ledger/getTransactionById.ts packages/core/src/ledger/getTransactionById.test.ts
git commit -m "feat(core): getTransactionById"
```

---

## Task 10: Wallet-source transaction streaming

**Files:**
- Create: `packages/core/src/ledger/streamTransactions.ts`, `packages/core/src/ledger/streamTransactions.wallet.test.ts`

This task only implements `source: 'wallet'`. The ledger-source path is added in Task 11 so we can commit in bite-sized steps.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi } from 'vitest'
import { createFakeDappClient } from '../test/fakeDappClient.js'
import { streamTransactions } from './streamTransactions.js'
import { templateId } from '../types/commands.js'

describe('streamTransactions (source: wallet)', () => {
  it('forwards onTxChanged events through onEvent', () => {
    const fake = createFakeDappClient()
    const received: unknown[] = []
    const unsub = streamTransactions(fake as never, {
      source: 'wallet',
      onEvent: (e) => received.push(e),
    })

    fake.__emitTx({ updateId: 'u1' })
    fake.__emitTx({ updateId: 'u2' })

    expect(received).toHaveLength(2)
    expect((received[0] as { source: string }).source).toBe('wallet')
    unsub()
  })

  it('stops delivery after unsubscribe', () => {
    const fake = createFakeDappClient()
    const onEvent = vi.fn()
    const unsub = streamTransactions(fake as never, { source: 'wallet', onEvent })
    unsub()
    fake.__emitTx({ updateId: 'x' })
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('filters by templateIds client-side', () => {
    const fake = createFakeDappClient()
    const onEvent = vi.fn()
    const keep = templateId('#A:M:K')
    streamTransactions(fake as never, {
      source: 'wallet',
      filter: { templateIds: [keep] },
      onEvent,
    })

    fake.__emitTx({ updateId: 'u1', templateId: '#A:M:K' })
    fake.__emitTx({ updateId: 'u2', templateId: '#A:M:OTHER' })

    expect(onEvent).toHaveBeenCalledOnce()
  })

  it('defaults to source=wallet when source omitted', () => {
    const fake = createFakeDappClient()
    const onEvent = vi.fn()
    streamTransactions(fake as never, { onEvent })
    fake.__emitTx({ updateId: 'u1' })
    expect(onEvent).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cantonkit/core test --no-coverage streamTransactions`
Expected: FAIL.

- [ ] **Step 3: Write `packages/core/src/ledger/streamTransactions.ts`**

```ts
import type { DappClient } from '@canton-network/dapp-sdk'
import type {
  SubscribeOptions,
  TransactionEvent,
  Unsubscribe,
  WalletTxEvent,
} from '../types/transactions.js'
import { CantonError } from '../error.js'

function toWalletEvent(raw: unknown): WalletTxEvent {
  const r = raw as { updateId?: string; status?: WalletTxEvent['status'] }
  return {
    source: 'wallet',
    updateId: r.updateId ?? '',
    status: r.status ?? 'submitted',
    raw,
  }
}

function matchesFilter(raw: unknown, templateIds: string[] | undefined): boolean {
  if (!templateIds || templateIds.length === 0) return true
  const tplId = (raw as { templateId?: string }).templateId
  if (!tplId) return false
  return templateIds.includes(tplId)
}

interface StreamDeps {
  ledgerSource?: (opts: SubscribeOptions) => Unsubscribe
}

export function streamTransactions(
  dapp: Pick<DappClient, 'onTxChanged'>,
  opts: SubscribeOptions,
  deps: StreamDeps = {}
): Unsubscribe {
  const source = opts.source ?? 'wallet'
  if (source === 'ledger') {
    if (!deps.ledgerSource) {
      throw new CantonError(
        'INVALID_ARGUMENT',
        'source=ledger requires a ledger transport — pass ledgerUrl to createCantonClient'
      )
    }
    return deps.ledgerSource(opts)
  }

  const templateIds = opts.filter?.templateIds
  const unsubscribe = dapp.onTxChanged((raw: unknown) => {
    if (!matchesFilter(raw, templateIds)) return
    const event: TransactionEvent = toWalletEvent(raw)
    opts.onEvent?.(event)
  })

  return unsubscribe
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cantonkit/core test --no-coverage streamTransactions`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ledger/streamTransactions.ts packages/core/src/ledger/streamTransactions.wallet.test.ts
git commit -m "feat(core): streamTransactions wallet source with client-side template filter"
```

---

## Task 11: Ledger-source streaming via WebSocket

**Files:**
- Create: `packages/core/src/transport/viaWebSocket.ts`, `packages/core/src/transport/viaWebSocket.test.ts`
- Modify: `packages/core/src/ledger/streamTransactions.ts` to accept an injected `ledgerSource`

The WebSocket transport uses dependency injection for both the `WebSocket` constructor and the clock so tests run fast and deterministic.

- [ ] **Step 1: Write failing test — `packages/core/src/transport/viaWebSocket.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLedgerStream } from './viaWebSocket.js'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  readyState = 0
  onopen?: () => void
  onmessage?: (ev: { data: string }) => void
  onerror?: (ev: unknown) => void
  onclose?: (ev: { code: number; reason: string }) => void
  sent: string[] = []
  closed = false

  constructor(public url: string, public protocols?: string | string[]) {
    FakeWebSocket.instances.push(this)
  }
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.closed = true
    this.onclose?.({ code: 1000, reason: '' })
  }
  __open() {
    this.readyState = 1
    this.onopen?.()
  }
  __message(body: unknown) {
    this.onmessage?.({ data: JSON.stringify(body) })
  }
  __error(err: unknown) {
    this.onerror?.(err)
  }
  __close(code = 1006, reason = 'abnormal') {
    this.onclose?.({ code, reason })
  }
}

describe('createLedgerStream', () => {
  beforeEach(() => {
    FakeWebSocket.instances = []
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const deps = () => ({
    WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    clock: {
      setTimeout: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms),
      clearTimeout: (id: unknown) => globalThis.clearTimeout(id as number),
    },
  })

  it('opens a ws URL with the bearer token in the subprotocols', () => {
    const stream = createLedgerStream(
      { ledgerUrl: 'https://ledger.example', auth: { token: 'TKN' } },
      deps()
    )
    const unsub = stream({ onEvent: () => undefined })
    expect(FakeWebSocket.instances[0]?.url).toBe('wss://ledger.example/v2/updates/flats')
    expect(FakeWebSocket.instances[0]?.protocols).toContain('jwt.token.TKN')
    unsub()
  })

  it('sends a request payload on open with the provided filter', () => {
    const stream = createLedgerStream(
      { ledgerUrl: 'https://ledger.example', auth: { token: 'TKN' } },
      deps()
    )
    stream({
      filter: { templateIds: ['#A:M:T' as never], parties: ['Alice'] },
      onEvent: () => undefined,
    })
    const ws = FakeWebSocket.instances[0]!
    ws.__open()
    expect(ws.sent).toHaveLength(1)
    const payload = JSON.parse(ws.sent[0]!)
    expect(payload.filter.filtersByParty.Alice).toBeDefined()
  })

  it('emits LedgerTxEvent on message', () => {
    const stream = createLedgerStream(
      { ledgerUrl: 'https://ledger.example', auth: { token: 'TKN' } },
      deps()
    )
    const received: unknown[] = []
    stream({ onEvent: (e) => received.push(e) })
    const ws = FakeWebSocket.instances[0]!
    ws.__open()
    ws.__message({
      transaction: {
        updateId: 'u1',
        offset: '10',
        effectiveAt: '2026-04-20',
        events: [],
      },
    })
    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({ source: 'ledger', updateId: 'u1' })
  })

  it('reconnects with exponential backoff on abnormal close', () => {
    const stream = createLedgerStream(
      { ledgerUrl: 'https://ledger.example', auth: { token: 'TKN' } },
      deps()
    )
    stream({ onEvent: () => undefined })
    const ws1 = FakeWebSocket.instances[0]!
    ws1.__open()
    ws1.__close(1006)

    expect(FakeWebSocket.instances).toHaveLength(1) // not yet retried
    vi.advanceTimersByTime(1000) // first backoff ~1s
    expect(FakeWebSocket.instances).toHaveLength(2)
  })

  it('does not reconnect after explicit unsubscribe', () => {
    const stream = createLedgerStream(
      { ledgerUrl: 'https://ledger.example', auth: { token: 'TKN' } },
      deps()
    )
    const unsub = stream({ onEvent: () => undefined })
    FakeWebSocket.instances[0]?.__open()
    unsub()
    vi.advanceTimersByTime(10_000)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('reports STREAM_CLOSED via onError when reconnect budget exhausted', () => {
    const onError = vi.fn()
    const stream = createLedgerStream(
      {
        ledgerUrl: 'https://ledger.example',
        auth: { token: 'TKN' },
        maxReconnectAttempts: 2,
      },
      deps()
    )
    stream({ onEvent: () => undefined, onError })
    // fail 3 times
    for (let i = 0; i < 3; i++) {
      FakeWebSocket.instances[i]?.__close(1006)
      vi.advanceTimersByTime(10_000)
    }
    expect(onError).toHaveBeenCalled()
    const err = onError.mock.calls[0]?.[0]
    expect((err as { code?: string }).code).toBe('STREAM_CLOSED')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cantonkit/core test --no-coverage viaWebSocket`
Expected: FAIL.

- [ ] **Step 3: Write `packages/core/src/transport/viaWebSocket.ts`**

```ts
import type {
  LedgerTxEvent,
  SubscribeOptions,
  TransactionEvent,
  Unsubscribe,
} from '../types/transactions.js'
import { CantonError } from '../error.js'

export interface AuthProvider {
  token: string
}

export interface LedgerStreamConfig {
  ledgerUrl: string
  auth: AuthProvider
  maxReconnectAttempts?: number
}

export interface LedgerStreamDeps {
  WebSocketCtor?: typeof WebSocket
  clock?: {
    setTimeout: (fn: () => void, ms: number) => unknown
    clearTimeout: (id: unknown) => void
  }
}

type LedgerSource = (opts: SubscribeOptions) => Unsubscribe

function toWss(url: string): string {
  return url.replace(/^http/, 'ws') + '/v2/updates/flats'
}

function buildRequest(filter: SubscribeOptions['filter']): Record<string, unknown> {
  const parties = filter?.parties ?? []
  const templateIds = filter?.templateIds ?? []
  const filtersByParty: Record<string, unknown> = {}
  for (const p of parties) {
    filtersByParty[p] = {
      cumulative: templateIds.map((t) => ({
        identifierFilter: { templateFilter: { templateId: t } },
      })),
    }
  }
  return { filter: { filtersByParty }, verbose: false }
}

function toLedgerEvent(raw: unknown): LedgerTxEvent | null {
  const t = (raw as { transaction?: unknown }).transaction as
    | {
        updateId: string
        offset: string
        effectiveAt: string
        events: LedgerTxEvent['events']
      }
    | undefined
  if (!t) return null
  return {
    source: 'ledger',
    updateId: t.updateId,
    offset: t.offset,
    effectiveAt: t.effectiveAt,
    events: t.events,
  }
}

export function createLedgerStream(
  config: LedgerStreamConfig,
  deps: LedgerStreamDeps = {}
): LedgerSource {
  const WS = deps.WebSocketCtor ?? (globalThis.WebSocket as typeof WebSocket)
  const clock = deps.clock ?? {
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (id) => globalThis.clearTimeout(id as number),
  }

  if (!WS) {
    throw new CantonError(
      'INVALID_ARGUMENT',
      'WebSocket constructor unavailable; pass WebSocketCtor in deps for non-browser environments'
    )
  }

  const maxAttempts = config.maxReconnectAttempts ?? 5

  return function ledgerSource(opts: SubscribeOptions): Unsubscribe {
    let stopped = false
    let attempt = 0
    let currentSocket: WebSocket | null = null
    let pendingTimer: unknown = null

    const connect = () => {
      if (stopped) return
      const ws = new WS(toWss(config.ledgerUrl), [`jwt.token.${config.auth.token}`])
      currentSocket = ws
      ws.onopen = () => {
        attempt = 0
        ws.send(JSON.stringify(buildRequest(opts.filter)))
      }
      ws.onmessage = (ev: MessageEvent) => {
        try {
          const parsed = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data))
          const event = toLedgerEvent(parsed)
          if (event) {
            const emit: TransactionEvent = event
            opts.onEvent?.(emit)
          }
        } catch (err) {
          opts.onError?.(CantonError.wrap(err, 'UNKNOWN'))
        }
      }
      ws.onerror = (err) => {
        opts.onError?.(CantonError.wrap(err, 'STREAM_CLOSED'))
      }
      ws.onclose = (ev: CloseEvent) => {
        currentSocket = null
        if (stopped || ev.code === 1000) return
        attempt += 1
        if (attempt > maxAttempts) {
          opts.onError?.(
            new CantonError('STREAM_CLOSED', 'Reconnect budget exhausted', {
              status: ev.code,
            })
          )
          stopped = true
          return
        }
        const backoff = Math.min(30_000, 2 ** (attempt - 1) * 1000)
        pendingTimer = clock.setTimeout(connect, backoff)
      }
    }

    connect()

    return () => {
      stopped = true
      if (pendingTimer) clock.clearTimeout(pendingTimer)
      currentSocket?.close()
    }
  }
}
```

- [ ] **Step 4: Modify `packages/core/src/ledger/streamTransactions.ts`**

Replace the existing file so `source: 'ledger'` consults an injected `ledgerSource`:

```ts
import type { DappClient } from '@canton-network/dapp-sdk'
import type {
  SubscribeOptions,
  TransactionEvent,
  Unsubscribe,
  WalletTxEvent,
} from '../types/transactions.js'
import { CantonError } from '../error.js'

function toWalletEvent(raw: unknown): WalletTxEvent {
  const r = raw as { updateId?: string; status?: WalletTxEvent['status'] }
  return {
    source: 'wallet',
    updateId: r.updateId ?? '',
    status: r.status ?? 'submitted',
    raw,
  }
}

function matchesFilter(raw: unknown, templateIds: string[] | undefined): boolean {
  if (!templateIds || templateIds.length === 0) return true
  const tplId = (raw as { templateId?: string }).templateId
  if (!tplId) return false
  return templateIds.includes(tplId)
}

export interface StreamDeps {
  ledgerSource?: (opts: SubscribeOptions) => Unsubscribe
}

export function streamTransactions(
  dapp: Pick<DappClient, 'onTxChanged'>,
  opts: SubscribeOptions,
  deps: StreamDeps = {}
): Unsubscribe {
  const source = opts.source ?? 'wallet'
  if (source === 'ledger') {
    if (!deps.ledgerSource) {
      throw new CantonError(
        'INVALID_ARGUMENT',
        'source=ledger requires a ledger transport — pass ledgerUrl to createCantonClient'
      )
    }
    return deps.ledgerSource(opts)
  }

  const templateIds = opts.filter?.templateIds
  const unsubscribe = dapp.onTxChanged((raw: unknown) => {
    if (!matchesFilter(raw, templateIds)) return
    const event: TransactionEvent = toWalletEvent(raw)
    opts.onEvent?.(event)
  })

  return unsubscribe
}
```

- [ ] **Step 5: Run all core tests**

Run: `pnpm --filter @cantonkit/core test --no-coverage`
Expected: PASS — all tests green (including the new WebSocket suite).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/transport/viaWebSocket.ts \
        packages/core/src/transport/viaWebSocket.test.ts \
        packages/core/src/ledger/streamTransactions.ts
git commit -m "feat(core): ledger-source WebSocket streaming with backoff"
```

---

## Task 12: `createCantonClient` factory

**Files:**
- Create: `packages/core/src/client.ts`, `packages/core/src/client.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi } from 'vitest'
import { createFakeDappClient } from './test/fakeDappClient.js'
import { createCantonClient } from './client.js'
import { templateId } from './types/commands.js'

describe('createCantonClient', () => {
  it('wires queryACS through the dappClient ledgerApi', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({ ok: true, status: 200, body: { activeContracts: [] } })
    const client = createCantonClient({ dappClient: fake as never })
    const contracts = await client.queryACS({
      templateId: templateId('#A:M:T'),
      parties: ['Alice'],
    })
    expect(contracts).toEqual([])
    expect(fake.__calls.ledgerApi[0]).toMatchObject({ url: '/v2/state/active-contracts' })
  })

  it('wires submitAndWait through prepareExecuteAndWait', async () => {
    const fake = createFakeDappClient()
    fake.__queue.prepareExecuteAndWait.push({
      kind: 'ok',
      value: { updateId: 'u1', commandId: 'c1', completionOffset: '0' },
    })
    const client = createCantonClient({ dappClient: fake as never })
    const result = await client.submitAndWait({ commands: [], actAs: ['A'] })
    expect(result.updateId).toBe('u1')
  })

  it('wires subscribeToTransactions wallet source through onTxChanged', () => {
    const fake = createFakeDappClient()
    const client = createCantonClient({ dappClient: fake as never })
    const onEvent = vi.fn()
    const unsub = client.subscribeToTransactions({ onEvent })
    fake.__emitTx({ updateId: 'u1' })
    expect(onEvent).toHaveBeenCalledOnce()
    unsub()
  })

  it('subscribeToTransactions source=ledger throws without ledgerUrl', () => {
    const fake = createFakeDappClient()
    const client = createCantonClient({ dappClient: fake as never })
    expect(() =>
      client.subscribeToTransactions({ source: 'ledger', onEvent: () => undefined })
    ).toThrow(/source=ledger/)
  })

  it('destroy tears down wallet listeners', () => {
    const fake = createFakeDappClient()
    const client = createCantonClient({ dappClient: fake as never })
    const onEvent = vi.fn()
    client.subscribeToTransactions({ onEvent })
    client.destroy()
    fake.__emitTx({ updateId: 'x' })
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('ledger escape hatch calls through to dappClient.ledgerApi', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({ ok: true, status: 200, body: { foo: 'bar' } })
    const client = createCantonClient({ dappClient: fake as never })
    const raw = (await client.ledger({ method: 'GET', url: '/v2/anything' } as never)) as {
      body: unknown
    }
    expect(raw.body).toEqual({ foo: 'bar' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cantonkit/core test --no-coverage client`
Expected: FAIL.

- [ ] **Step 3: Write `packages/core/src/client.ts`**

```ts
import type { DappClient } from '@canton-network/dapp-sdk'
import type { ActiveContract, QueryACSOptions } from './types/contracts.js'
import type { SubmitOptions, SubmitResult } from './types/commands.js'
import type {
  SubscribeOptions,
  Transaction,
  TransactionEvent,
  Unsubscribe,
} from './types/transactions.js'
import { viaLedgerApi, type LedgerTransport } from './transport/viaLedgerApi.js'
import { createLedgerStream, type LedgerStreamConfig } from './transport/viaWebSocket.js'
import { queryACS } from './ledger/queryACS.js'
import { submit } from './ledger/submit.js'
import { submitAndWait } from './ledger/submitAndWait.js'
import { getTransactionById } from './ledger/getTransactionById.js'
import { streamTransactions } from './ledger/streamTransactions.js'

export interface CreateCantonClientOptions {
  /** Existing DappClient instance (typical when used inside React). */
  dappClient: DappClient
  /** Enables source: 'ledger' subscriptions. Required URL + auth. */
  ledgerUrl?: string
  auth?: { token: string }
  maxReconnectAttempts?: number
}

export interface CantonClient {
  queryACS<T = unknown>(opts: QueryACSOptions): Promise<ActiveContract<T>[]>
  getTransactionById(id: string): Promise<Transaction>
  submit(opts: SubmitOptions): Promise<null>
  submitAndWait(opts: SubmitOptions): Promise<SubmitResult>
  subscribeToTransactions(opts: SubscribeOptions): Unsubscribe
  ledger: DappClient['ledgerApi']
  destroy(): void
}

export function createCantonClient(opts: CreateCantonClientOptions): CantonClient {
  const dapp = opts.dappClient
  const transport: LedgerTransport = viaLedgerApi(dapp)
  const ledgerSource =
    opts.ledgerUrl && opts.auth
      ? createLedgerStream(
          {
            ledgerUrl: opts.ledgerUrl,
            auth: opts.auth,
            maxReconnectAttempts: opts.maxReconnectAttempts,
          } satisfies LedgerStreamConfig
        )
      : undefined

  const activeUnsubscribes = new Set<Unsubscribe>()

  return {
    queryACS: <T>(q: QueryACSOptions) => queryACS<T>(transport, q),
    getTransactionById: (id) => getTransactionById(transport, id),
    submit: (p) => submit(dapp, p),
    submitAndWait: (p) => submitAndWait(dapp, p),
    subscribeToTransactions(sub: SubscribeOptions): Unsubscribe {
      const wrappedOnEvent = sub.onEvent
        ? (e: TransactionEvent) => sub.onEvent!(e)
        : undefined
      const unsub = streamTransactions(
        dapp,
        { ...sub, onEvent: wrappedOnEvent },
        ledgerSource ? { ledgerSource } : {}
      )
      activeUnsubscribes.add(unsub)
      return () => {
        activeUnsubscribes.delete(unsub)
        unsub()
      }
    },
    ledger: dapp.ledgerApi.bind(dapp),
    destroy() {
      for (const u of activeUnsubscribes) u()
      activeUnsubscribes.clear()
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cantonkit/core test --no-coverage client`
Expected: PASS — 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/client.ts packages/core/src/client.test.ts
git commit -m "feat(core): createCantonClient factory"
```

---

## Task 13: Core public exports & coverage

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Replace `packages/core/src/index.ts`**

```ts
export { createCantonClient } from './client.js'
export type { CantonClient, CreateCantonClientOptions } from './client.js'

export { CantonError } from './error.js'
export type { CantonErrorCode } from './error.js'

export type {
  TemplateId,
  Command,
  CreateCommand,
  ExerciseCommand,
  ExerciseByKeyCommand,
  SubmitOptions,
  SubmitResult,
} from './types/commands.js'
export { templateId } from './types/commands.js'

export type { ActiveContract, QueryACSOptions } from './types/contracts.js'
export type {
  TransactionEvent,
  WalletTxEvent,
  LedgerTxEvent,
  SubscribeOptions,
  Unsubscribe,
  Transaction,
} from './types/transactions.js'

// Test fixture — exported so @cantonkit/react's testing subpath can reuse it.
export { createFakeDappClient } from './test/fakeDappClient.js'
export type { FakeDappClient } from './test/fakeDappClient.js'
```

- [ ] **Step 2: Run full core test suite with coverage**

Run: `pnpm --filter @cantonkit/core test`
Expected: PASS — all tests green, coverage thresholds (90% line, 90% function, 85% branch) met.

- [ ] **Step 3: Build the package**

Run: `pnpm --filter @cantonkit/core build`
Expected: produces `packages/core/dist/index.js`, `.cjs`, `.d.ts` without errors.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): public API surface"
```

---

## Task 14: `@cantonkit/react` package bootstrap

**Files:**
- Create: `packages/react/package.json`, `packages/react/tsconfig.json`, `packages/react/tsup.config.ts`, `packages/react/vitest.config.ts`, `packages/react/vitest.setup.ts`, `packages/react/src/index.ts`, `packages/react/src/testing/index.ts`, `packages/react/README.md`

- [ ] **Step 1: Write `packages/react/package.json`**

```json
{
  "name": "@cantonkit/react",
  "version": "0.1.0",
  "description": "React provider and hooks for CantonKit.",
  "license": "Apache-2.0",
  "type": "module",
  "sideEffects": false,
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./testing": {
      "types": "./dist/testing/index.d.ts",
      "import": "./dist/testing/index.js",
      "require": "./dist/testing/index.cjs"
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run --coverage",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "@cantonkit/core": "workspace:^",
    "@canton-network/dapp-sdk": "^1.0.0",
    "react": ">=18.0.0",
    "@tanstack/react-query": "^5.0.0"
  },
  "devDependencies": {
    "@cantonkit/core": "workspace:*",
    "@canton-network/dapp-sdk": "^1.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/dom": "^10.4.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "jsdom": "^25.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "publishConfig": { "access": "public" }
}
```

- [ ] **Step 2: Write `packages/react/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.test.tsx"]
}
```

- [ ] **Step 3: Write `packages/react/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'testing/index': 'src/testing/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  external: ['react', 'react-dom', '@tanstack/react-query', '@cantonkit/core', '@canton-network/dapp-sdk'],
})
```

- [ ] **Step 4: Write `packages/react/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/testing/**', 'src/index.ts'],
      thresholds: { lines: 85, functions: 85, branches: 80 },
    },
  },
})
```

- [ ] **Step 5: Write `packages/react/vitest.setup.ts`**

```ts
import '@testing-library/react'
// jsdom ships a minimal fetch; we stub WebSocket for tests that need it.
```

- [ ] **Step 6: Write placeholder `packages/react/src/index.ts`**

```ts
// Public exports for @cantonkit/react. Populated by later tasks.
export {}
```

- [ ] **Step 7: Write placeholder `packages/react/src/testing/index.ts`**

```ts
// Test fixtures for consumers. Populated by later tasks.
export {}
```

- [ ] **Step 8: Write `packages/react/README.md`**

```markdown
# @cantonkit/react

React provider and hooks for CantonKit. See the [main README](../../README.md).
```

- [ ] **Step 9: Install and typecheck**

Run:
```bash
pnpm install
pnpm --filter @cantonkit/react typecheck
```
Expected: exits 0.

- [ ] **Step 10: Commit**

```bash
git add packages/react
git commit -m "feat(react): bootstrap @cantonkit/react package"
```

---

## Task 15: Context + `useCantonClient` / `useCantonConnection`

**Files:**
- Create: `packages/react/src/context.ts`, `packages/react/src/context.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createContext } from 'react'
import {
  CantonContext,
  useCantonClient,
  useCantonConnection,
} from './context.js'

describe('context hooks', () => {
  it('useCantonClient throws outside a provider', () => {
    expect(() => renderHook(() => useCantonClient())).toThrow(/CantonProvider/)
  })

  it('useCantonConnection throws outside a provider', () => {
    expect(() => renderHook(() => useCantonConnection())).toThrow(/CantonProvider/)
  })

  it('returns the context value when wrapped', () => {
    const fakeClient = { destroy: () => undefined } as never
    const value = {
      client: fakeClient,
      dappClient: {} as never,
      status: 'connected' as const,
      accounts: [{ partyId: 'Alice' }] as never,
      activeParty: 'Alice',
      connect: async () => undefined,
      disconnect: async () => undefined,
    }
    const { result } = renderHook(() => useCantonClient(), {
      wrapper: ({ children }) => (
        <CantonContext.Provider value={value}>{children}</CantonContext.Provider>
      ),
    })
    expect(result.current).toBe(fakeClient)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cantonkit/react test --no-coverage context`
Expected: FAIL.

- [ ] **Step 3: Write `packages/react/src/context.ts`**

```ts
import { createContext, useContext } from 'react'
import type { CantonClient } from '@cantonkit/core'
import type { DappClient } from '@canton-network/dapp-sdk'

export interface Wallet {
  partyId: string
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface CantonContextValue {
  client: CantonClient
  dappClient: DappClient
  status: ConnectionStatus
  accounts: Wallet[]
  activeParty: string | null
  connect: (opts?: { additionalAdapters?: unknown[] }) => Promise<void>
  disconnect: () => Promise<void>
}

export const CantonContext = createContext<CantonContextValue | null>(null)

export function useCantonClient(): CantonClient {
  const ctx = useContext(CantonContext)
  if (!ctx) throw new Error('useCantonClient must be used inside <CantonProvider>')
  return ctx.client
}

export function useCantonConnection(): Omit<CantonContextValue, 'client' | 'dappClient'> {
  const ctx = useContext(CantonContext)
  if (!ctx) throw new Error('useCantonConnection must be used inside <CantonProvider>')
  const { status, accounts, activeParty, connect, disconnect } = ctx
  return { status, accounts, activeParty, connect, disconnect }
}

/** @internal — escape hatch for tests and advanced users. */
export function useCantonContextRaw(): CantonContextValue {
  const ctx = useContext(CantonContext)
  if (!ctx) throw new Error('CantonContext must be used inside <CantonProvider>')
  return ctx
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cantonkit/react test --no-coverage context`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/context.ts packages/react/src/context.test.tsx
git commit -m "feat(react): CantonContext + useCantonClient + useCantonConnection"
```

---

## Task 16: Testing utilities (`createFakeCantonClient`, `TestCantonProvider`)

**Files:**
- Create: `packages/react/src/testing/createFakeCantonClient.ts`, `packages/react/src/testing/TestCantonProvider.tsx`
- Modify: `packages/react/src/testing/index.ts`

These need to be built BEFORE the hooks so the hook tests can use them.

- [ ] **Step 1: Write `packages/react/src/testing/createFakeCantonClient.ts`**

```ts
import type { CantonClient } from '@cantonkit/core'

export interface FakeCantonClient extends CantonClient {
  __emitTx: (event: unknown) => void
}

type Overrides = Partial<{
  [K in keyof CantonClient]: CantonClient[K]
}>

/**
 * Minimal in-memory CantonClient fake for hook tests.
 * Consumers inject overrides per test to script behavior.
 */
export function createFakeCantonClient(overrides: Overrides = {}): FakeCantonClient {
  const listeners = new Set<(e: unknown) => void>()

  const base: CantonClient = {
    async queryACS() {
      return []
    },
    async getTransactionById() {
      throw new Error('not implemented in fake')
    },
    async submit() {
      return null
    },
    async submitAndWait() {
      return { updateId: 'fake-u', commandId: 'fake-c', completionOffset: '0' }
    },
    subscribeToTransactions(opts) {
      const listener = (e: unknown) => opts.onEvent?.(e as never)
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    ledger: async () => ({ ok: true, status: 200, body: {} }) as never,
    destroy() {
      listeners.clear()
    },
  }

  return Object.assign({}, base, overrides, {
    __emitTx(event: unknown) {
      listeners.forEach((l) => l(event))
    },
  })
}
```

- [ ] **Step 2: Write `packages/react/src/testing/TestCantonProvider.tsx`**

```tsx
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CantonClient } from '@cantonkit/core'
import { CantonContext, type CantonContextValue, type ConnectionStatus, type Wallet } from '../context.js'

export interface TestCantonProviderProps {
  client: CantonClient
  status?: ConnectionStatus
  accounts?: Wallet[]
  activeParty?: string | null
  queryClient?: QueryClient
  children: ReactNode
}

export function TestCantonProvider({
  client,
  status = 'connected',
  accounts = [{ partyId: 'Alice' }],
  activeParty,
  queryClient,
  children,
}: TestCantonProviderProps) {
  const qc =
    queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })

  const value: CantonContextValue = {
    client,
    dappClient: {} as never,
    status,
    accounts,
    activeParty: activeParty ?? (accounts[0]?.partyId ?? null),
    connect: async () => undefined,
    disconnect: async () => undefined,
  }

  return (
    <QueryClientProvider client={qc}>
      <CantonContext.Provider value={value}>{children}</CantonContext.Provider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 3: Replace `packages/react/src/testing/index.ts`**

```ts
export { createFakeCantonClient } from './createFakeCantonClient.js'
export type { FakeCantonClient } from './createFakeCantonClient.js'
export { TestCantonProvider } from './TestCantonProvider.js'
export type { TestCantonProviderProps } from './TestCantonProvider.js'
// Re-export the low-level core fake for users who want to drive the DappClient seam
export { createFakeDappClient } from '@cantonkit/core'
export type { FakeDappClient } from '@cantonkit/core'
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @cantonkit/react typecheck`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/testing
git commit -m "feat(react): testing subpath with fake CantonClient and provider"
```

---

## Task 17: `useContracts` hook

**Files:**
- Create: `packages/react/src/hooks/useContracts.ts`, `packages/react/src/hooks/useContracts.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { templateId, type ActiveContract } from '@cantonkit/core'
import { createFakeCantonClient, TestCantonProvider } from '../testing/index.js'
import { useContracts } from './useContracts.js'

const TPL = templateId('#App:Mod:T')

function wrap(client: ReturnType<typeof createFakeCantonClient>) {
  return ({ children }: { children: React.ReactNode }) => (
    <TestCantonProvider client={client}>{children}</TestCantonProvider>
  )
}

describe('useContracts', () => {
  it('fetches on mount and exposes typed data', async () => {
    const client = createFakeCantonClient({
      queryACS: vi.fn(async () => [
        {
          contractId: 'c1',
          templateId: TPL,
          payload: { owner: 'Alice', amount: '10' },
          signatories: ['Alice'],
          observers: [],
        } as ActiveContract<{ owner: string; amount: string }>,
      ]) as never,
    })
    const { result } = renderHook(
      () => useContracts<{ owner: string; amount: string }>({ templateId: TPL }),
      { wrapper: wrap(client) }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0]?.payload.owner).toBe('Alice')
  })

  it('refetches when parties change', async () => {
    const queryACS = vi.fn(async () => [])
    const client = createFakeCantonClient({ queryACS: queryACS as never })
    const { result, rerender } = renderHook(
      ({ party }: { party: string }) =>
        useContracts({ templateId: TPL, parties: [party] }),
      { wrapper: wrap(client), initialProps: { party: 'Alice' } }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    rerender({ party: 'Bob' })
    await waitFor(() => expect(queryACS).toHaveBeenCalledTimes(2))
  })

  it('surfaces CantonError in error state', async () => {
    const client = createFakeCantonClient({
      queryACS: vi.fn(async () => {
        throw Object.assign(new Error('boom'), { code: 'LEDGER_HTTP', name: 'CantonError' })
      }) as never,
    })
    const { result } = renderHook(() => useContracts({ templateId: TPL }), {
      wrapper: wrap(client),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as { code?: string }).code).toBe('LEDGER_HTTP')
  })

  it('is disabled when not connected and no parties supplied', () => {
    const client = createFakeCantonClient({
      queryACS: vi.fn(async () => []) as never,
    })
    const { result } = renderHook(() => useContracts({ templateId: TPL }), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <TestCantonProvider client={client} status="disconnected" activeParty={null} accounts={[]}>
          {children}
        </TestCantonProvider>
      ),
    })
    expect(result.current.fetchStatus).toBe('idle')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cantonkit/react test --no-coverage useContracts`
Expected: FAIL.

- [ ] **Step 3: Write `packages/react/src/hooks/useContracts.ts`**

```ts
import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query'
import type {
  ActiveContract,
  CantonError,
  QueryACSOptions,
  TemplateId,
} from '@cantonkit/core'
import { useCantonClient, useCantonConnection } from '../context.js'

export interface UseContractsOptions {
  templateId: TemplateId
  parties?: string[]
  filter?: QueryACSOptions['filter']
}

type TanstackOpts<T> = Omit<
  UseQueryOptions<ActiveContract<T>[], CantonError>,
  'queryKey' | 'queryFn'
>

export function useContracts<T = unknown>(
  opts: UseContractsOptions,
  queryOptions?: TanstackOpts<T>
): UseQueryResult<ActiveContract<T>[], CantonError> {
  const client = useCantonClient()
  const { activeParty } = useCantonConnection()
  const parties = opts.parties ?? (activeParty ? [activeParty] : [])
  const enabled = parties.length > 0 && (queryOptions?.enabled ?? true)

  return useQuery<ActiveContract<T>[], CantonError>({
    queryKey: ['canton', 'acs', opts.templateId, parties, opts.filter],
    queryFn: () =>
      client.queryACS<T>({
        templateId: opts.templateId,
        parties,
        filter: opts.filter,
      }),
    ...queryOptions,
    enabled,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cantonkit/react test --no-coverage useContracts`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/hooks/useContracts.ts packages/react/src/hooks/useContracts.test.tsx
git commit -m "feat(react): useContracts hook with TanStack Query"
```

---

## Task 18: `useSubmit` hook

**Files:**
- Create: `packages/react/src/hooks/useSubmit.ts`, `packages/react/src/hooks/useSubmit.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { templateId } from '@cantonkit/core'
import { createFakeCantonClient, TestCantonProvider } from '../testing/index.js'
import { useSubmit } from './useSubmit.js'
import { useContracts } from './useContracts.js'

const TPL = templateId('#App:Mod:T')

describe('useSubmit', () => {
  it('mutates successfully and returns SubmitResult', async () => {
    const client = createFakeCantonClient({
      submitAndWait: vi.fn(async () => ({
        updateId: 'u1',
        commandId: 'c1',
        completionOffset: '42',
      })) as never,
    })
    const { result } = renderHook(() => useSubmit(), {
      wrapper: ({ children }) => (
        <TestCantonProvider client={client}>{children}</TestCantonProvider>
      ),
    })

    await act(async () => {
      await result.current.mutateAsync({ commands: [], actAs: ['Alice'] })
    })

    expect(result.current.data?.updateId).toBe('u1')
  })

  it('surfaces WALLET_REJECTED error', async () => {
    const client = createFakeCantonClient({
      submitAndWait: vi.fn(async () => {
        throw Object.assign(new Error('rejected'), {
          code: 'WALLET_REJECTED',
          name: 'CantonError',
        })
      }) as never,
    })
    const { result } = renderHook(() => useSubmit(), {
      wrapper: ({ children }) => (
        <TestCantonProvider client={client}>{children}</TestCantonProvider>
      ),
    })
    await act(async () => {
      await result.current.mutateAsync({ commands: [], actAs: ['Alice'] }).catch(() => undefined)
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as { code?: string }).code).toBe('WALLET_REJECTED')
  })

  it('invalidates ACS queries on success (prefix match)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    let queryACSCount = 0
    const client = createFakeCantonClient({
      queryACS: (async () => {
        queryACSCount++
        return []
      }) as never,
      submitAndWait: (async () => ({
        updateId: 'u1',
        commandId: 'c1',
        completionOffset: '0',
      })) as never,
    })
    const { result } = renderHook(
      () => ({
        contracts: useContracts({ templateId: TPL, parties: ['Alice'] }),
        submit: useSubmit(),
      }),
      {
        wrapper: ({ children }) => (
          <TestCantonProvider client={client} queryClient={qc}>
            {children}
          </TestCantonProvider>
        ),
      }
    )

    await waitFor(() => expect(result.current.contracts.isSuccess).toBe(true))
    expect(queryACSCount).toBe(1)

    await act(async () => {
      await result.current.submit.mutateAsync({ commands: [], actAs: ['Alice'] })
    })

    await waitFor(() => expect(queryACSCount).toBe(2))
  })

  it('respects invalidate: false to skip auto-invalidation', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    let queryACSCount = 0
    const client = createFakeCantonClient({
      queryACS: (async () => {
        queryACSCount++
        return []
      }) as never,
      submitAndWait: (async () => ({
        updateId: 'u1',
        commandId: 'c1',
        completionOffset: '0',
      })) as never,
    })
    const { result } = renderHook(
      () => ({
        contracts: useContracts({ templateId: TPL, parties: ['Alice'] }),
        submit: useSubmit({ invalidate: false }),
      }),
      {
        wrapper: ({ children }) => (
          <TestCantonProvider client={client} queryClient={qc}>
            {children}
          </TestCantonProvider>
        ),
      }
    )
    await waitFor(() => expect(result.current.contracts.isSuccess).toBe(true))
    await act(async () => {
      await result.current.submit.mutateAsync({ commands: [], actAs: ['Alice'] })
    })
    // give React time in case invalidation were to fire
    await new Promise((r) => setTimeout(r, 20))
    expect(queryACSCount).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cantonkit/react test --no-coverage useSubmit`
Expected: FAIL.

- [ ] **Step 3: Write `packages/react/src/hooks/useSubmit.ts`**

```ts
import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query'
import type { CantonError, SubmitOptions, SubmitResult } from '@cantonkit/core'
import { useCantonClient } from '../context.js'

export interface UseSubmitOptions
  extends UseMutationOptions<SubmitResult, CantonError, SubmitOptions> {
  /** When false, skips the default invalidation of ['canton', 'acs']. Default true. */
  invalidate?: boolean
}

export function useSubmit(
  options: UseSubmitOptions = {}
): UseMutationResult<SubmitResult, CantonError, SubmitOptions> {
  const client = useCantonClient()
  const queryClient = useQueryClient()
  const { invalidate = true, onSuccess: userOnSuccess, ...rest } = options

  return useMutation<SubmitResult, CantonError, SubmitOptions>({
    mutationFn: (opts: SubmitOptions) => client.submitAndWait(opts),
    onSuccess: (data, variables, context) => {
      if (invalidate) {
        // Prefix match in TanStack v5 — invalidates every useContracts query.
        queryClient.invalidateQueries({ queryKey: ['canton', 'acs'] })
      }
      userOnSuccess?.(data, variables, context)
    },
    ...rest,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cantonkit/react test --no-coverage useSubmit`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/hooks/useSubmit.ts packages/react/src/hooks/useSubmit.test.tsx
git commit -m "feat(react): useSubmit with ACS auto-invalidation"
```

---

## Task 19: `useTransactionStream` hook

**Files:**
- Create: `packages/react/src/hooks/useTransactionStream.ts`, `packages/react/src/hooks/useTransactionStream.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createFakeCantonClient, TestCantonProvider } from '../testing/index.js'
import { useTransactionStream } from './useTransactionStream.js'

describe('useTransactionStream', () => {
  it('buffers events and exposes them in most-recent-first order', () => {
    const client = createFakeCantonClient()
    const { result } = renderHook(() => useTransactionStream({}), {
      wrapper: ({ children }) => (
        <TestCantonProvider client={client}>{children}</TestCantonProvider>
      ),
    })

    act(() => {
      client.__emitTx({ source: 'wallet', updateId: 'u1', status: 'submitted', raw: {} })
      client.__emitTx({ source: 'wallet', updateId: 'u2', status: 'submitted', raw: {} })
    })

    expect(result.current.events.map((e) => e.updateId)).toEqual(['u2', 'u1'])
  })

  it('caps events at bufferSize', () => {
    const client = createFakeCantonClient()
    const { result } = renderHook(() => useTransactionStream({ bufferSize: 2 }), {
      wrapper: ({ children }) => (
        <TestCantonProvider client={client}>{children}</TestCantonProvider>
      ),
    })

    act(() => {
      client.__emitTx({ source: 'wallet', updateId: 'u1', status: 'submitted', raw: {} })
      client.__emitTx({ source: 'wallet', updateId: 'u2', status: 'submitted', raw: {} })
      client.__emitTx({ source: 'wallet', updateId: 'u3', status: 'submitted', raw: {} })
    })

    expect(result.current.events).toHaveLength(2)
    expect(result.current.events.map((e) => e.updateId)).toEqual(['u3', 'u2'])
  })

  it('fires onEvent synchronously before re-render', () => {
    const client = createFakeCantonClient()
    const onEvent = vi.fn()
    renderHook(() => useTransactionStream({ onEvent }), {
      wrapper: ({ children }) => (
        <TestCantonProvider client={client}>{children}</TestCantonProvider>
      ),
    })
    act(() => {
      client.__emitTx({ source: 'wallet', updateId: 'u1', status: 'submitted', raw: {} })
    })
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ updateId: 'u1' })
    )
  })

  it('tears down subscription on unmount', () => {
    let unsubCalled = false
    const client = createFakeCantonClient({
      subscribeToTransactions: ((opts: never) => {
        return () => {
          unsubCalled = true
        }
      }) as never,
    })
    const { unmount } = renderHook(() => useTransactionStream({}), {
      wrapper: ({ children }) => (
        <TestCantonProvider client={client}>{children}</TestCantonProvider>
      ),
    })
    unmount()
    expect(unsubCalled).toBe(true)
  })

  it('clear() empties the buffer', () => {
    const client = createFakeCantonClient()
    const { result } = renderHook(() => useTransactionStream({}), {
      wrapper: ({ children }) => (
        <TestCantonProvider client={client}>{children}</TestCantonProvider>
      ),
    })
    act(() => {
      client.__emitTx({ source: 'wallet', updateId: 'u1', status: 'submitted', raw: {} })
    })
    expect(result.current.events).toHaveLength(1)
    act(() => result.current.clear())
    expect(result.current.events).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @cantonkit/react test --no-coverage useTransactionStream`
Expected: FAIL.

- [ ] **Step 3: Write `packages/react/src/hooks/useTransactionStream.ts`**

```ts
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { CantonError, SubscribeOptions, TransactionEvent } from '@cantonkit/core'
import { useCantonClient } from '../context.js'

export interface UseTransactionStreamOptions {
  source?: SubscribeOptions['source']
  filter?: SubscribeOptions['filter']
  onEvent?: (event: TransactionEvent) => void
  bufferSize?: number
}

interface StreamSnapshot {
  events: TransactionEvent[]
  isConnected: boolean
  error: CantonError | null
}

const EMPTY_SNAPSHOT: StreamSnapshot = { events: [], isConnected: false, error: null }

interface StreamStore {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => StreamSnapshot
  clear: () => void
}

function createStreamStore(
  subscribeFn: (push: (event: TransactionEvent) => void, fail: (err: CantonError) => void) => () => void,
  bufferSize: number
): StreamStore {
  let snapshot: StreamSnapshot = { events: [], isConnected: false, error: null }
  const listeners = new Set<() => void>()
  let unsub: (() => void) | null = null

  function emit() {
    listeners.forEach((l) => l())
  }

  function ensureStarted() {
    if (unsub) return
    unsub = subscribeFn(
      (event) => {
        const next = [event, ...snapshot.events].slice(0, bufferSize)
        snapshot = { ...snapshot, events: next, isConnected: true }
        emit()
      },
      (err) => {
        snapshot = { ...snapshot, isConnected: false, error: err }
        emit()
      }
    )
    snapshot = { ...snapshot, isConnected: true }
    emit()
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      ensureStarted()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          unsub?.()
          unsub = null
        }
      }
    },
    getSnapshot: () => snapshot,
    clear() {
      snapshot = { ...snapshot, events: [] }
      emit()
    },
  }
}

export function useTransactionStream(opts: UseTransactionStreamOptions): {
  events: TransactionEvent[]
  isConnected: boolean
  error: CantonError | null
  clear: () => void
} {
  const client = useCantonClient()
  const bufferSize = opts.bufferSize ?? 50
  const onEventRef = useRef(opts.onEvent)
  onEventRef.current = opts.onEvent

  // Stable key so changing filter/source resubscribes exactly once.
  const key = useMemo(
    () => JSON.stringify({ source: opts.source, filter: opts.filter }),
    [opts.source, opts.filter]
  )

  const store = useMemo(() => {
    return createStreamStore((push, fail) => {
      return client.subscribeToTransactions({
        source: opts.source,
        filter: opts.filter,
        onEvent: (event) => {
          onEventRef.current?.(event)
          push(event)
        },
        onError: (err) => fail(err as CantonError),
      })
    }, bufferSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, key, bufferSize])

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY_SNAPSHOT)
  const clear = useCallback(() => store.clear(), [store])

  useEffect(() => () => undefined, [store])

  return { ...snapshot, clear }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @cantonkit/react test --no-coverage useTransactionStream`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/hooks/useTransactionStream.ts packages/react/src/hooks/useTransactionStream.test.tsx
git commit -m "feat(react): useTransactionStream with useSyncExternalStore"
```

---

## Task 20: `CantonProvider`

**Files:**
- Create: `packages/react/src/ssr.ts`, `packages/react/src/CantonProvider.tsx`, `packages/react/src/CantonProvider.test.tsx`

- [ ] **Step 1: Write `packages/react/src/ssr.ts`**

```ts
export const isBrowser = typeof window !== 'undefined'
```

- [ ] **Step 2: Write failing test — `packages/react/src/CantonProvider.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { CantonProvider } from './CantonProvider.js'
import { useCantonConnection, useCantonClient } from './context.js'
import { createFakeDappClient } from '@cantonkit/core'

describe('CantonProvider', () => {
  it('exposes a CantonClient to children', () => {
    const fake = createFakeDappClient()
    const { result } = renderHook(() => useCantonClient(), {
      wrapper: ({ children }) => (
        <CantonProvider config={{ gatewayUrl: 'https://gw', dappClient: fake as never }}>
          {children}
        </CantonProvider>
      ),
    })
    expect(result.current).toBeDefined()
    expect(typeof result.current.queryACS).toBe('function')
  })

  it('starts disconnected with no accounts', () => {
    const fake = createFakeDappClient()
    const { result } = renderHook(() => useCantonConnection(), {
      wrapper: ({ children }) => (
        <CantonProvider config={{ gatewayUrl: 'https://gw', dappClient: fake as never }}>
          {children}
        </CantonProvider>
      ),
    })
    expect(result.current.status).toBe('disconnected')
    expect(result.current.accounts).toEqual([])
    expect(result.current.activeParty).toBeNull()
  })

  it('transitions disconnected → connecting → connected during connect()', async () => {
    const fake = createFakeDappClient()
    fake.__queue.connect.push({ kind: 'ok', value: { isConnected: true } })
    fake.__queue.listAccounts.push({ accounts: [{ partyId: 'Alice::hash' }] })

    const { result } = renderHook(() => useCantonConnection(), {
      wrapper: ({ children }) => (
        <CantonProvider config={{ gatewayUrl: 'https://gw', dappClient: fake as never }}>
          {children}
        </CantonProvider>
      ),
    })

    await act(async () => {
      await result.current.connect()
    })

    await waitFor(() => expect(result.current.status).toBe('connected'))
    expect(result.current.activeParty).toBe('Alice::hash')
  })

  it('transitions to error state on connect failure', async () => {
    const fake = createFakeDappClient()
    fake.__queue.connect.push({ kind: 'err', error: new Error('nope') })

    const { result } = renderHook(() => useCantonConnection(), {
      wrapper: ({ children }) => (
        <CantonProvider config={{ gatewayUrl: 'https://gw', dappClient: fake as never }}>
          {children}
        </CantonProvider>
      ),
    })

    await act(async () => {
      await result.current.connect().catch(() => undefined)
    })

    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('calls dapp.disconnect on disconnect()', async () => {
    const fake = createFakeDappClient()
    const { result } = renderHook(() => useCantonConnection(), {
      wrapper: ({ children }) => (
        <CantonProvider config={{ gatewayUrl: 'https://gw', dappClient: fake as never }}>
          {children}
        </CantonProvider>
      ),
    })
    await act(async () => {
      await result.current.disconnect()
    })
    expect(fake.__calls.disconnect).toBe(1)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @cantonkit/react test --no-coverage CantonProvider`
Expected: FAIL.

- [ ] **Step 4: Write `packages/react/src/CantonProvider.tsx`**

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

export interface CantonProviderConfig {
  gatewayUrl: string
  ledgerUrl?: string
  auth?: { token: string }
  /** Inject an existing DappClient. Typical in tests or when sharing across providers. */
  dappClient?: DappClient
  queryClient?: QC
  additionalAdapters?: unknown[]
}

export interface CantonProviderProps {
  config: CantonProviderConfig
  children: ReactNode
}

function defaultQueryClient(): QC {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
    },
  })
}

async function constructDappClient(
  config: CantonProviderConfig
): Promise<DappClient> {
  if (config.dappClient) return config.dappClient
  if (!isBrowser) {
    throw new Error('CantonProvider: DappClient can only be constructed in the browser')
  }
  // Dynamic import keeps SSR bundles clean.
  const mod = await import('@canton-network/dapp-sdk')
  const { DappClient, DiscoveryClient, RemoteAdapter } = mod as unknown as {
    DappClient: new (provider: unknown, opts?: unknown) => DappClient
    DiscoveryClient: { create: (opts: { adapters: unknown[] }) => Promise<{
      connect: () => Promise<void>
      getActiveSession: () => { provider: unknown; adapter: { type: string } } | null
    }> }
    RemoteAdapter: new (opts: { name: string; rpcUrl: string }) => {
      provider: () => unknown
    }
  }
  const adapters = [
    new RemoteAdapter({ name: 'Default Gateway', rpcUrl: config.gatewayUrl }),
    ...((config.additionalAdapters ?? []) as never[]),
  ]
  const discovery = await DiscoveryClient.create({ adapters })
  // Hydrate from saved session without opening the picker — provider is idle until connect().
  const session = discovery.getActiveSession()
  if (session) {
    return new DappClient(session.provider, { providerType: session.adapter.type })
  }
  const provider = (adapters[0] as { provider: () => unknown }).provider()
  return new DappClient(provider)
}

export function CantonProvider({ config, children }: CantonProviderProps): JSX.Element {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [accounts, setAccounts] = useState<Wallet[]>([])
  const [dappClient, setDappClient] = useState<DappClient | null>(null)
  const clientRef = useRef<CantonClient | null>(null)
  const queryClient = useMemo(() => config.queryClient ?? defaultQueryClient(), [config.queryClient])

  useEffect(() => {
    let cancelled = false
    constructDappClient(config)
      .then((dc) => {
        if (cancelled) return
        setDappClient(dc)
        const clientOpts: CreateCantonClientOptions = { dappClient: dc }
        if (config.ledgerUrl) clientOpts.ledgerUrl = config.ledgerUrl
        if (config.auth) clientOpts.auth = config.auth
        clientRef.current = createCantonClient(clientOpts)
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
      clientRef.current?.destroy()
      clientRef.current = null
    }
  }, [config.gatewayUrl, config.ledgerUrl, config.auth?.token, config.dappClient])

  useEffect(() => {
    if (!dappClient) return
    const unsubStatus = dappClient.onStatusChanged?.((evt: unknown) => {
      const isConnected = (evt as { connection?: { isConnected?: boolean } }).connection?.isConnected
      setStatus(isConnected ? 'connected' : 'disconnected')
    })
    const unsubAccounts = dappClient.onAccountsChanged?.((evt: unknown) => {
      const list = (evt as { accounts?: Wallet[] }).accounts ?? []
      setAccounts(list)
    })
    return () => {
      unsubStatus?.()
      unsubAccounts?.()
    }
  }, [dappClient])

  const connect = useCallback(
    async (opts?: { additionalAdapters?: unknown[] }) => {
      if (!dappClient) throw new Error('DappClient not ready')
      setStatus('connecting')
      try {
        await dappClient.connect(opts as never)
        const { accounts: list } = await dappClient.listAccounts()
        setAccounts(list)
        setStatus('connected')
      } catch (err) {
        setStatus('error')
        throw err
      }
    },
    [dappClient]
  )

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

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @cantonkit/react test --no-coverage CantonProvider`
Expected: PASS — 5 tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/react/src/ssr.ts packages/react/src/CantonProvider.tsx packages/react/src/CantonProvider.test.tsx
git commit -m "feat(react): CantonProvider with status and accounts state"
```

---

## Task 21: React public exports & coverage

**Files:**
- Modify: `packages/react/src/index.ts`

- [ ] **Step 1: Replace `packages/react/src/index.ts`**

```ts
export { CantonProvider } from './CantonProvider.js'
export type { CantonProviderConfig, CantonProviderProps } from './CantonProvider.js'

export { CantonContext, useCantonClient, useCantonConnection } from './context.js'
export type { CantonContextValue, ConnectionStatus, Wallet } from './context.js'

export { useContracts } from './hooks/useContracts.js'
export type { UseContractsOptions } from './hooks/useContracts.js'

export { useSubmit } from './hooks/useSubmit.js'
export type { UseSubmitOptions } from './hooks/useSubmit.js'

export { useTransactionStream } from './hooks/useTransactionStream.js'
export type { UseTransactionStreamOptions } from './hooks/useTransactionStream.js'

// Re-export commonly used core types so apps need fewer imports.
export type {
  CantonClient,
  CantonError,
  CantonErrorCode,
  ActiveContract,
  QueryACSOptions,
  SubmitOptions,
  SubmitResult,
  TemplateId,
  Command,
  CreateCommand,
  ExerciseCommand,
  ExerciseByKeyCommand,
  TransactionEvent,
  WalletTxEvent,
  LedgerTxEvent,
  SubscribeOptions,
  Unsubscribe,
  Transaction,
} from '@cantonkit/core'
export { templateId } from '@cantonkit/core'
```

- [ ] **Step 2: Run full react test suite with coverage**

Run: `pnpm --filter @cantonkit/react test`
Expected: PASS — all tests green, coverage thresholds met (85% lines, 85% functions, 80% branches).

- [ ] **Step 3: Build the package**

Run: `pnpm --filter @cantonkit/react build`
Expected: produces `packages/react/dist/index.{js,cjs,d.ts}` and `packages/react/dist/testing/index.{js,cjs,d.ts}` without errors.

- [ ] **Step 4: Commit**

```bash
git add packages/react/src/index.ts
git commit -m "feat(react): public API surface with core type re-exports"
```

---

## Task 22: Public API coverage guard

**Files:**
- Create: `scripts/check-public-api-coverage.mjs`
- Modify: root `package.json` (add script)

Prevents adding a public export without at least one test reference.

- [ ] **Step 1: Write `scripts/check-public-api-coverage.mjs`**

```js
#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { execSync } from 'node:child_process'

const packages = ['packages/core/src/index.ts', 'packages/react/src/index.ts']

const exportRe = /^export\s+(?:type\s+)?\{([^}]+)\}/gm
const gaps = []

for (const indexPath of packages) {
  const content = readFileSync(indexPath, 'utf8')
  const exports = []
  for (const match of content.matchAll(exportRe)) {
    exports.push(
      ...match[1]
        .split(',')
        .map((s) => s.trim().replace(/\s+as\s+.+$/, ''))
        .filter((s) => s && !s.startsWith('//'))
    )
  }
  for (const symbol of exports) {
    const cmd = `grep -rE "\\b${symbol}\\b" packages/*/src --include='*.test.ts' --include='*.test.tsx' -l || true`
    const out = execSync(cmd, { encoding: 'utf8' }).trim()
    if (!out) gaps.push({ indexPath, symbol })
  }
}

if (gaps.length > 0) {
  console.error('Public exports with no test references:')
  for (const g of gaps) console.error(`  ${g.indexPath} → ${g.symbol}`)
  process.exit(1)
}
console.log('All public exports referenced in tests.')
```

- [ ] **Step 2: Add script to root `package.json`**

Add to the `scripts` block:
```json
"check:api-coverage": "node scripts/check-public-api-coverage.mjs"
```

- [ ] **Step 3: Run it**

Run: `pnpm check:api-coverage`
Expected: "All public exports referenced in tests." If it reports gaps, either add a test or remove the symbol from the public index.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-public-api-coverage.mjs package.json
git commit -m "chore: public-API coverage guard script"
```

---

## Task 23: Example counter app

**Files:**
- Create: `examples/counter-app/package.json`, `examples/counter-app/tsconfig.json`, `examples/counter-app/vite.config.ts`, `examples/counter-app/index.html`, `examples/counter-app/src/main.tsx`, `examples/counter-app/src/App.tsx`, `examples/counter-app/.env.example`

No tests — this is a runnable demo that doubles as end-to-end documentation.

- [ ] **Step 1: Write `examples/counter-app/package.json`**

```json
{
  "name": "@cantonkit-examples/counter-app",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@cantonkit/core": "workspace:*",
    "@cantonkit/react": "workspace:*",
    "@canton-network/dapp-sdk": "^1.0.0",
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

- [ ] **Step 2: Write `examples/counter-app/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write `examples/counter-app/vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
})
```

- [ ] **Step 4: Write `examples/counter-app/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>CantonKit Counter Demo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write `examples/counter-app/.env.example`**

```
VITE_CANTON_GATEWAY_URL=https://gateway.example.com/api/json-rpc
```

- [ ] **Step 6: Write `examples/counter-app/src/main.tsx`**

```tsx
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
```

- [ ] **Step 7: Write `examples/counter-app/src/App.tsx`**

```tsx
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
```

- [ ] **Step 8: Install and typecheck**

Run:
```bash
pnpm install
pnpm --filter @cantonkit-examples/counter-app exec tsc --noEmit
```
Expected: exits 0.

- [ ] **Step 9: Commit**

```bash
git add examples/counter-app
git commit -m "docs: example counter app exercising the full public API"
```

---

## Task 24: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm check:api-coverage
      - run: pnpm build
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: packages/*/coverage
```

- [ ] **Step 2: Verify locally**

Run the same steps CI runs:
```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test && pnpm check:api-coverage && pnpm build
```
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add .github
git commit -m "ci: pnpm-based workflow with typecheck, lint, test, build"
```

---

## Task 25: Root `README.md`

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: root README with Quick Start and package index"
```

---

## Task 26: Final verification & changeset

**Files:**
- Create: `.changeset/initial-release.md`

- [ ] **Step 1: Run the whole pipeline end-to-end**

Run:
```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm check:api-coverage
pnpm build
```
Expected: all green, coverage thresholds met, both packages built into `dist/`.

- [ ] **Step 2: Write `.changeset/initial-release.md`**

```markdown
---
'@cantonkit/core': minor
'@cantonkit/react': minor
---

Initial release of CantonKit v0.1: framework-agnostic `@cantonkit/core` with `CantonClient` (queryACS, submitAndWait, subscribeToTransactions) and `@cantonkit/react` with `<CantonProvider>` plus `useContracts`, `useSubmit`, and `useTransactionStream` hooks. Ships with `@cantonkit/react/testing` fixtures and a runnable counter-app example.
```

- [ ] **Step 3: Verify changeset**

Run: `pnpm changeset status`
Expected: reports the two packages queued for a minor version bump.

- [ ] **Step 4: Commit**

```bash
git add .changeset/initial-release.md
git commit -m "chore: initial-release changeset"
```

- [ ] **Step 5: Tag the commit locally**

Run:
```bash
git log --oneline
```
Expected: a clean history from monorepo skeleton through to this changeset. No further action needed — actual publishing is a manual step taken after human review.

---

## Spec Coverage Map

| Spec section | Covered by |
|---|---|
| §1 Background & Goals | Task 25 README |
| §2 Architectural Decisions | Tasks 1 (monorepo), 2 & 14 (packages), 3 (types), 11 (streams), 17-19 (hooks on TanStack) |
| §3 Repository Layout | Tasks 1-26 |
| §4.1 Factory | Task 12 |
| §4.2 Construction modes | Task 12 (Mode A); Mode B explicit SSR/Node usage inherits from Task 12's `dappClient` option (no separate construction path needed — consumers pass any DappClient they built themselves) |
| §4.3 Method → ledger mapping | Tasks 6 (transport), 7-11 (ops) |
| §4.4 Types | Task 3 |
| §4.5 Error model | Task 4 |
| §4.6 Tree-shakeability | Tasks 2, 14 (`sideEffects: false` + named exports in 13, 21) |
| §5.1 `<CantonProvider>` | Task 20 |
| §5.2 Split context hooks | Task 15 |
| §5.3 `useContracts<T>` | Task 17 |
| §5.4 `useSubmit` | Task 18 |
| §5.5 `useTransactionStream` | Task 19 |
| §5.6 Pass-through options | Tasks 17-19 all accept TanStack option overrides |
| §6 Testing strategy | Task 5 (FakeDappClient), 16 (FakeCantonClient), every hook/ledger task pairs implementation with tests |
| §6.5 Coverage gates | Tasks 2, 14 (vitest configs), 22 (public API guard) |
| §7 Build & Release | Tasks 1 (tooling), 2 & 14 (per-package build), 24 (CI), 26 (changeset) |
| §8 Quick Start | Tasks 23 (runnable), 25 (README) |
| §9 Open questions | Task 3 types leave TODO-free but inline-commented hooks for v2 OpenAPI verification; Task 7 endpoint comment flags schema check; Task 8 `idGenerator` shipped; `TransactionEvent` union shipped as planned |
