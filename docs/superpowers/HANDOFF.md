# CantonKit v1 — Complete

**Status:** 26 of 26 tasks complete. v1 is feature-complete, tested, documented, and ready for release.

## What Shipped

A TypeScript-first SDK for Canton Network frontend and fullstack developers, delivered as a pnpm monorepo with two publishable packages:

- **`@cantonkit/core`** — Framework-agnostic `CantonClient` with typed `queryACS`, `submitAndWait`, `submit`, `getTransactionById`, `subscribeToTransactions` (wallet or ledger source), a `CantonError` discriminated-union class, and an escape hatch to the raw `DappClient.ledgerApi`.
- **`@cantonkit/react`** — `<CantonProvider>` plus Wagmi-style hooks `useContracts<T>`, `useSubmit`, `useTransactionStream`, `useCantonClient`, `useCantonConnection`. Ships with test fixtures under `@cantonkit/react/testing`.

Both packages build ESM + CJS + `.d.ts`, pass `tsc --noEmit` under `strict` + `exactOptionalPropertyTypes` + `verbatimModuleSyntax` + `noUncheckedIndexedAccess`, ESLint 9 flat config, and meet coverage thresholds (core: 93% lines; react: 96% lines).

A runnable demo lives at `examples/counter-app/` (Vite + React 18) exercising every public API.

## Quality Gates

CI enforces all of these on every push/PR via `.github/workflows/ci.yml`:

- `pnpm typecheck` — both packages under strict TS
- `pnpm lint` — ESLint 9 flat config, no errors, no warnings
- `pnpm build` — tsup ESM+CJS build with types
- `pnpm test` — 76 tests across 15 files (43 core + 33 react), coverage gated
- `pnpm check:api-coverage` — custom script ensuring every public value export is referenced by at least one test

## Final Test Counts

- **Core:** 43 tests across 10 files. Coverage: 93.23% lines / 92.5% functions / 85.14% branches.
- **React:** 33 tests across 5 files. Coverage: 95.88% lines / 95.83% functions / 83.33% branches.

## Architectural Decisions (from the spec)

- **Monorepo layout:** `@cantonkit/core` + `@cantonkit/react`. Lets non-React consumers use core directly; matches the wagmi/viem pattern.
- **TanStack Query v5 as peer dep.** `useContracts`/`useSubmit` are thin typed wrappers — users get caching, retries, devtools for free, plus full pass-through of TanStack options.
- **Split-selector context hooks.** `useCantonClient()` returns only the client; `useCantonConnection()` returns only connection state. Prevents unrelated re-renders.
- **Transaction streaming via `useSyncExternalStore`** for React 18 concurrent-safe external subscriptions. Supports wallet-source (client-side template filter) and ledger-source (WebSocket with reconnect + backoff).
- **Error model:** `CantonError` with a 7-code discriminated union (`NOT_CONNECTED`, `WALLET_REJECTED`, `LEDGER_HTTP`, `LEDGER_TIMEOUT`, `STREAM_CLOSED`, `INVALID_ARGUMENT`, `UNKNOWN`). Idempotent `wrap()` lets higher layers re-wrap safely.
- **Zero mocking of dapp-sdk in production.** Every write goes through `prepareExecute` / `prepareExecuteAndWait` so the wallet sees every transaction. Reads go through `ledgerApi` or a direct ledger WS (opt-in via `ledgerUrl` + `auth`).

## Out of Scope for v1 (Roadmap)

- **v0.2** — DAR → TypeScript codegen CLI. This is the real Wagmi-parity killer feature: users get fully-typed contract payloads generated from their Daml DAR files.
- **v0.3** — SSR/Next.js story beyond basic `typeof window` guards. Live-ledger contract tests.
- **v0.4** — Vue and Svelte adapters (enabled by the core/react split).

## Noteworthy Bugs Caught During Review

The two-stage review process (spec + code-quality subagent per behavioral task) caught these real issues before they landed:

- **Task 11 (WebSocket stream):** `ws.onerror` handler was causing double `onError` emission on every abnormal disconnect. WebSocket spec guarantees `error` fires before `close`; removing the `onerror` handler and letting `onclose` drive error reporting fixed the double-emission.
- **Task 12 (core factory):** Five `exactOptionalPropertyTypes` errors were hidden by vitest's esbuild-based transpile. Caught by the first-ever `tsc --noEmit` run and fixed in a dedicated follow-up.
- **Task 18 (useSubmit):** A silent `mutationFn` override was possible — a caller passing `mutationFn` in options would override the hardcoded `client.submitAndWait` through the `...rest` spread. Closed by `Omit<UseMutationOptions, 'mutationFn'>` on `UseSubmitOptions`, mirroring the pattern already used in `useContracts`.
- **Task 19 (useTransactionStream):** Two production bugs: (1) synchronous throw from `client.subscribeToTransactions` was silently swallowed, leaving `isConnected: true, error: null`. Fixed with a try/catch in `ensureStarted`. (2) Casting `err as CantonError` on the `onError` callback was unsafe — raw `CloseEvent`s could reach `result.error`. Fixed by routing through `CantonError.wrap()`.
- **Task 20 (CantonProvider):** Surfaced that the `FakeDappClient` fixture (from Task 5) had diverged from the real `@canton-network/dapp-sdk@1.0.0` surface in three places: listener return types, `listAccounts()` shape, and `connect()` args. Rather than shim, we aligned the fake to the real SDK in a root-cause refactor that simplified the provider and stream transport.

## Lessons Captured

- **Run typecheck between tasks in strict-TS projects.** Vitest transpiles without type-checking; `tsc --noEmit` must be a per-task gate, not just a final-verification step. (See `~/.claude/projects/-Users-jason-github-CantonKit/memory/feedback_typecheck_between_tasks.md`.)
- **Test fixtures should match real SDK shapes.** If the fake and real surfaces drift, the first task that imports the real types surfaces the drift as dual-shape detection code — which should be a signal to realign the fake, not to paper over with shims.

## Commit History (37 commits)

Commits on `feat/v1-implementation` are all semantic, buildable at every step, and organized one-commit-per-task with targeted review fixups between them. Final release state:

```
4a4d61f chore: initial-release changeset
bf0c8d7 docs: root README with Quick Start and package index
af2d307 chore(react): document intentional deps list in CantonProvider effect
2dffca1 ci: migrate to ESLint flat config + GitHub Actions workflow
6a5ac10 docs: example counter app exercising the full public API
1de1a17 chore: public-API value-export coverage guard
040ae84 feat(react): public API surface with core type re-exports
1b8b6e9 refactor(core,react): align FakeDappClient with real @canton-network/dapp-sdk surface
fd43123 feat(react): CantonProvider with status and accounts state
2733246 fix(react): normalize transport errors and remove inert effect in useTransactionStream
4a9b064 feat(react): useTransactionStream with useSyncExternalStore
9bd9e46 fix(react): prevent mutationFn override and tighten useSubmit tests
fe628f7 feat(react): useSubmit with ACS auto-invalidation
f75a3b7 refactor(react): align UseContractsOptions with spec and tighten test coverage
a252140 feat(react): useContracts hook with TanStack Query
b33c725 test(react): cover useCantonConnection and useCantonContextRaw
...
```

## How to Release

1. Merge `feat/v1-implementation` into `main` (via PR, CI gates must pass)
2. Changesets will detect `.changeset/initial-release.md` and queue both packages for the first stable release
3. Run `pnpm changeset version` to consume the changeset and bump `@cantonkit/core` and `@cantonkit/react` to `1.0.0`
4. Run `pnpm build` to produce publishable artifacts
5. Run `pnpm changeset publish` to push both packages to npm (requires `npm login` with appropriate org permissions)

Note: Changesets escalates a `minor` changeset on a pre-1.0 package (`0.1.0`) to `major` under its default 0ver semantics. The `initial-release.md` intentionally declares `minor` — it describes the shape of the change, not the resulting version jump. The first stable release will be `1.0.0`.

## Open Risks

- **Canton JSON Ledger API v2 wire shapes.** The endpoints and payload shapes (`/v2/state/active-contracts`, `/v2/updates/transaction-by-id/:id`, `/v2/updates/flats`, the filter payload) were written from the design doc, not from a live ledger response. First integration test (planned for v0.3) will expose any drift. Core's `queryACS` and ledger-source stream have inline comments flagging this.
- **`deduplicationDuration` format.** Treated as a pass-through string (ISO-8601 duration per Daml convention). If Canton's API expects a structured object, adjust in v0.2.
- **`TransactionEvent.raw` is typed `unknown`.** Consumers must cast to extract fields. v0.2's codegen could provide typed wallet event shapes too.
