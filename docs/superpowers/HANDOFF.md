# CantonKit v1 — Session Handoff

**Last updated:** 2026-04-20, after Task 16.

## Status

**16 of 26 tasks complete.** Both the core package and the React testing-infrastructure foundation are done. Remaining work is the three React hooks, the provider, and the final wrap-up (CI, README, changeset).

- Branch: `feat/v1-implementation`
- Commits: 20 (the full Task 0-16 history is on the branch, 1 commit per task plus 4 follow-up fix commits)
- All tests green: **43 core tests across 10 files + 3 react tests = 46 tests total**
- Both packages typecheck clean: `pnpm -r --filter './packages/*' typecheck` exits 0
- Core package builds ESM + CJS + .d.ts at 93.2% line coverage

## What's Built

### `@cantonkit/core` (Tasks 0–13, fully shipped)

Framework-agnostic client. Public API in `packages/core/src/index.ts`:

- `createCantonClient({ dappClient, ledgerUrl?, auth?, maxReconnectAttempts? })` → `CantonClient`
- `CantonClient` methods: `queryACS<T>`, `getTransactionById`, `submit`, `submitAndWait`, `subscribeToTransactions`, `ledger` escape hatch, `destroy`
- `CantonError` class with 7-member code union (`NOT_CONNECTED`, `WALLET_REJECTED`, `LEDGER_HTTP`, `LEDGER_TIMEOUT`, `STREAM_CLOSED`, `INVALID_ARGUMENT`, `UNKNOWN`) and idempotent static `wrap()`
- Types: `TemplateId` (branded string), `Command` union, `ActiveContract<T>`, `TransactionEvent` (discriminated by `source`), `SubmitOptions`, `SubmitResult`, etc.
- Test fixture `createFakeDappClient` is re-exported for downstream use

Transports:
- `viaLedgerApi` wraps `DappClient.ledgerApi` with `CantonError` mapping
- `createLedgerStream` (WebSocket) with exponential backoff (1s, 2s, 4s... capped at 30s), configurable `maxReconnectAttempts` (default 5), dependency injection for `WebSocketCtor` and `clock`

### `@cantonkit/react` (Tasks 14–16, foundation only)

- Package scaffolded with dual entry points (`.` and `./testing`), peer deps on core/react/@tanstack/react-query
- `CantonContext`, `useCantonClient()`, `useCantonConnection()` split-selector hooks (so consumers re-render only on the state they read)
- Testing utilities: `createFakeCantonClient(overrides)`, `TestCantonProvider` (skips real DappClient construction), plus re-export of `createFakeDappClient`

## What's Left (Tasks 17–26)

Plan file: `docs/superpowers/plans/2026-04-20-cantonkit-v1-implementation.md`

Hook tasks (each has full inline code in the plan):
- **Task 17** — `useContracts<T>` hook (wraps TanStack's `useQuery`, disabled when disconnected, pass-through for TanStack options)
- **Task 18** — `useSubmit` hook (wraps `useMutation`, prefix-invalidates `['canton', 'acs']` on success, supports `invalidate: false` opt-out)
- **Task 19** — `useTransactionStream` hook (uses `useSyncExternalStore`, buffers events with `bufferSize` cap, supports `clear()`, tears down on unmount)
- **Task 20** — `CantonProvider` (constructs DappClient, wires status/accounts state, lazy-imports dapp-sdk for SSR safety, exposes connect/disconnect)

Integration tasks:
- **Task 21** — Populate `packages/react/src/index.ts` with full public surface, run coverage, build
- **Task 22** — `scripts/check-public-api-coverage.mjs` guards every exported symbol has at least one test reference
- **Task 23** — `examples/counter-app` Vite demo exercising every public API
- **Task 24** — `.github/workflows/ci.yml` for install/typecheck/lint/test/build
- **Task 25** — Root README with Quick Start
- **Task 26** — Final pipeline run + `.changeset/initial-release.md`

## How to Continue

Use subagent-driven development with the risk-weighted review cadence established in this session:

- **Spec-only inline review** for Tasks 21–26 (config and docs — low risk)
- **Full two-stage review (spec agent + code-quality agent)** for Tasks 17–20 (React hooks with real behavior — each has been found to have at least one non-obvious issue during review on similar tasks)
- For every task that writes `.ts`/`.tsx` source: run `pnpm --filter <pkg> typecheck` after the commit. **Vitest transpiles without type-checking**, so `tsc --noEmit` must be a per-task gate. This lesson was learned the hard way in Task 12 (5 hidden type errors) and is captured in the `feedback_typecheck_between_tasks` memory.

To resume:
1. Confirm working dir is `/Users/jason/github/CantonKit`
2. Confirm branch is `feat/v1-implementation` (`git checkout feat/v1-implementation`)
3. Confirm tests still pass (`pnpm -r --filter './packages/*' test --no-coverage`)
4. Read the plan at `docs/superpowers/plans/2026-04-20-cantonkit-v1-implementation.md` starting at Task 17
5. Dispatch implementer subagents one task at a time

## Follow-Up Fixes Applied During Review (worth remembering)

- **Task 4 (CantonError):** Added assertions for `wrapped.name` and `fromString.cause` in the wrap test
- **Task 8 (submit):** Tightened UUID regex to v4-aware form; added `cause` assertions on rejection paths; added payload-forwarding assertion for `submit`
- **Task 11 (WS stream):** Removed `ws.onerror` handler to prevent double `onError` emission on abnormal close (real production bug — WebSocket spec guarantees `error` fires before `close`); added no-reconnect-after-exhaustion assertion; added JSON parse-error test
- **Task 12 (client factory):** Fixed 5 `exactOptionalPropertyTypes` errors surfaced when `tsc --noEmit` first ran across the package (spread `onEvent: undefined`, conditional `maxReconnectAttempts`, `as unknown as` for cross-boundary casts); added `getTransactionById` and `submit` factory wiring tests

## Open Risks / Notes

- **Node v2 OpenAPI spec not verified in code.** The plan mentions this as an open question — endpoint paths `/v2/state/active-contracts`, `/v2/updates/transaction-by-id/:id`, `/v2/updates/flats`, and the filter payload shape were written from the design doc, not from a live ledger. First integration test (v0.3) will expose any drift.
- **pnpm 10 `Ignored build scripts` warning** appears on every `pnpm install` but has not been blocking. esbuild's postinstall builds native binaries; if a future task needs them (e.g., tsup under certain conditions), run `pnpm approve-builds` interactively.
- **`deduplicationDuration` vs `DedupPeriod`.** Plan uses `deduplicationDuration: string` (ISO-8601); design doc §4.4 mentioned `DedupPeriod` (undefined). Plan is more concrete and what's actually implemented. If Canton's real API uses a structured type, we'll adjust in v0.2.
