# Proposal: CantonKit — Wagmi-Style React SDK for Canton dApp Developers

**Author:** Jason Zhou  
**Status:** Draft  
**Created:** 2026-05-10  
**Category:** Developer Tools  
**Champion:** Seeking a Tech & Ops Committee champion — please reach out if you're interested in sponsoring this proposal.

---

## Abstract

CantonKit is an open-source TypeScript SDK that gives Canton dApp developers a Wagmi-inspired React integration layer on top of the official `@canton-network/dapp-sdk`. The v0.1 foundation — a framework-agnostic client, three React hooks, and testing utilities — is already published and working. This grant funds the next three milestones: a DAR-to-TypeScript codegen CLI (v0.2), SSR / Next.js support with a live-ledger test harness (v0.3), and Vue and Svelte framework adapters (v0.4).

**Total funding requested: 500,000 CC**, disbursed across four milestones.

---

## Motivation

Canton's developer experience for frontend and fullstack engineers is significantly behind what EVM developers have come to expect. Wagmi and Viem have become the dominant pattern for EVM dApp development because they abstract away low-level wallet interactions behind composable hooks that integrate naturally with TanStack Query. Canton has no equivalent.

The gap has real consequences:

- **High onboarding friction.** Developers who know React and Web3 have to learn Canton-specific primitives (UTXO semantics, `prepareSubmission`/`executeSubmission`, template IDs, party identity) before they can write a single component. There is no "connect wallet, read contracts, write contracts" entry point comparable to what Wagmi provides for EVM.
- **Manual type wrangling.** Contract payloads are typed as `unknown` or `Record<string, any>` in most Canton frontends today. Without codegen from DAR archives, every team maintains hand-rolled TypeScript interfaces that drift from the actual Daml templates.
- **Testing gap.** There is no standard way to test Canton dApp components without running a live sandbox. This makes CI slow and brittle, discouraging test-driven development in the ecosystem.
- **Framework monoculture.** The Canton frontend ecosystem is implicitly React-only. Vue and Svelte developers — a significant fraction of the broader web3 frontend market — have no first-party integration path.

CantonKit addresses all four gaps. It is positioned as the DX layer **above** the official `@canton-network/dapp-sdk`: it does not replace CIP-0103 wallet connectivity or compete with lower-level ledger API libraries; it makes those APIs ergonomic for product developers.

**Adoption estimate:** If CantonKit reaches the adoption level of comparable SDK layers in young ecosystems (e.g., RainbowKit in its first year), it could become the default frontend integration path for the majority of Canton dApps within 12 months.

---

## Specification

### Problem

Canton's JSON Ledger API and Wallet Gateway are well-designed, but they expose primitives — `submitAndWait`, `queryACS`, transaction streams — that require significant boilerplate to use correctly from React. A typical Canton dApp team currently needs to:

1. Write a custom React context wrapping `DappClient` connection state.
2. Manually wire TanStack Query or SWR for ACS polling and cache invalidation.
3. Manage WebSocket lifecycle for transaction streams (reconnection, backpressure, cleanup).
4. Write TypeScript interfaces by hand from Daml template definitions.
5. Mock the entire ledger in tests, or skip component tests entirely.

Each of these is solved once in CantonKit and available to every team that installs it.

### Implementation

**`@cantonkit/core`** — Framework-agnostic client wrapping `@canton-network/dapp-sdk`:
- `CantonClient`: thin typed wrapper exposing `queryACS<T>`, `submitAndWait`, `subscribeToTransactions`
- Two transaction sources: `'wallet'` (via `DappClient.onTxChanged`, default for browser dApps) and `'ledger'` (direct WebSocket to JSON Ledger API, for server-side and high-fidelity scenarios)
- Typed error hierarchy: `CantonError`, `CantonSubmitError`, `CantonConnectionError`
- Exponential backoff for ledger WebSocket reconnection

**`@cantonkit/react`** — React layer built on `@cantonkit/core` and TanStack Query:
- `<CantonProvider>`: wraps `DappClient` initialization, exposes connection state via context
- `<LedgerProvider>`: direct JSON Ledger API mode (no wallet required; used in localnet examples)
- `useCantonConnection()`: `{ status, activeParty, connect, disconnect }`
- `useContracts<T>({ templateId })`: ACS query with automatic stale-while-revalidate
- `useSubmit()`: TanStack mutation wrapping `submitAndWait`; handles loading/error state
- `useTransactionStream({ filter, source?, bufferSize? })`: live contract event stream
- Testing exports: `createFakeCantonClient`, `TestCantonProvider`

**Canton architecture alignment:**
- Respects the privacy model: `useContracts` queries only the connected party's visible contracts; `source: 'ledger'` is gated behind explicit ledger credentials
- `templateId()` helper enforces the `#package:Module:Entity` format at the TypeScript type level, catching malformed IDs at compile time
- Deduplication IDs are generated via `crypto.randomUUID()` per submission — correct-by-default idempotency

**v0.2 — DAR → TypeScript Codegen CLI:**

`cantonkit codegen --dar path/to/archive.dar --out src/generated/`

Parses a compiled DAR archive (using the DA proto schema for LF 1.x / 2.x) and generates:
- TypeScript interfaces for each Daml template's payload and choice arguments
- `templateId(...)` constants for each template, with the correct `#package:Module:Entity` form
- An index file re-exporting everything

This eliminates the primary source of type drift in Canton frontends.

**v0.3 — SSR / Next.js + Live-Ledger Testing:**

- SSR-safe hooks: hydration-safe `useCantonConnection` that initializes wallet detection on the client only
- Next.js reference app (App Router) demonstrating server-side ACS pre-fetching and client-side stream hydration
- `@cantonkit/testing` package: `createLedgerTestClient(sandboxUrl)` — connects to a real Canton sandbox and provides typed fixture helpers for Daml contracts, enabling component tests against real ledger state without mocking

**v0.4 — Vue and Svelte Adapters:**

- `@cantonkit/vue`: composables (`useContracts`, `useSubmit`, `useTransactionStream`) wrapping `@cantonkit/core`
- `@cantonkit/svelte`: Svelte stores + actions with the same API surface

---

## Milestones

### M0 — v0.1 Foundation (Retroactive)

**Payment:** 100,000 CC upon grant approval  
**Status:** Delivered

Already published:
- `@cantonkit/core` and `@cantonkit/react` on npm under Apache-2.0
- `counter-app-localnet` example: full read / write / stream demo against Canton sandbox
- `counter-app-localnet-starter` example: stripped-down starting template
- Testing utilities: `createFakeCantonClient`, `TestCantonProvider`

**Acceptance criteria:** A first-time Canton developer can clone `counter-app-localnet-starter`, follow the README, and have a working React app connected to a local sandbox within 20 minutes — validated by at least 3 community members reporting success on GitHub or Discord.

---

### M1 — v0.2 DAR → TypeScript Codegen (8 weeks post-approval)

**Payment:** 150,000 CC upon acceptance  
**Deadline:** 8 weeks after grant approval

Deliverables:
- `cantonkit codegen` CLI published to npm
- Parses LF 1.x and 2.x DAR archives
- Generates typed TypeScript interfaces and `templateId` constants
- Documentation and `counter-app-localnet` updated to use generated types

**Acceptance criteria:** At least 3 Canton dApp developers (outside this project) have used `cantonkit codegen` in a real project and reported it on GitHub Discussions or the Canton Discord — demonstrating the tool solves a real workflow problem rather than just generating output.

---

### M2 — v0.3 SSR + Live-Ledger Testing (16 weeks post-approval)

**Payment:** 120,000 CC upon acceptance  
**Deadline:** 16 weeks after grant approval

Deliverables:
- `@cantonkit/testing` package on npm with `createLedgerTestClient`
- Hydration-safe hooks for Next.js App Router
- Reference Next.js dApp (open-source) demonstrating SSR + live ACS stream

**Acceptance criteria:** Reference Next.js app is publicly deployed and passes Lighthouse accessibility/performance checks; at least 1 Canton ecosystem project adopts `@cantonkit/testing` for CI component tests.

---

### M3 — v0.4 Vue and Svelte Adapters (26 weeks post-approval)

**Payment:** 130,000 CC upon acceptance  
**Deadline:** 26 weeks after grant approval

Deliverables:
- `@cantonkit/vue` published to npm with full composable API
- `@cantonkit/svelte` published to npm with stores + action API
- Each adapter ships with a working counter-app example

**Acceptance criteria:** At least 3 Canton projects (including at least one Vue or Svelte project) list CantonKit as a dependency in their public repositories or published dApps.

---

## Funding Summary

| Milestone | Description | Amount | % |
|-----------|-------------|--------|---|
| M0 | v0.1 foundation (retroactive) | 100,000 CC | 20% |
| M1 | v0.2 DAR → TypeScript codegen CLI | 150,000 CC | 30% |
| M2 | v0.3 SSR / Next.js + live-ledger testing | 120,000 CC | 24% |
| M3 | v0.4 Vue and Svelte adapters | 130,000 CC | 26% |
| **Total** | | **500,000 CC** | **100%** |

Payment is denominated in Canton Coin. The proposer assumes exchange-rate risk per the standard grant terms.

**Effort estimate:**

| Milestone | Estimated hours |
|-----------|-----------------|
| M0 (retroactive) | ~180 hours |
| M1 — codegen CLI | ~130 hours |
| M2 — SSR + testing | ~100 hours |
| M3 — Vue + Svelte | ~140 hours |
| **Total** | **~550 hours** |

---

## Rationale

**Why wrap `@canton-network/dapp-sdk` rather than call the JSON Ledger API directly?**

The official dApp SDK is the correct abstraction boundary for browser dApps: it handles CIP-0103 wallet discovery, the prepare-sign-execute flow, and wallet-mediated transaction events. CantonKit exposes these capabilities with a React-native API rather than duplicating or bypassing the official layer. For scenarios requiring direct ledger access (server-side, multi-party), CantonKit's `source: 'ledger'` path connects to the JSON Ledger API directly — the two modes are complementary, not competing.

**Why Wagmi as the design reference?**

A significant portion of Canton's prospective dApp developer base comes from EVM — they know Wagmi. Mirroring Wagmi's hook API (`useContractRead` → `useContracts`, `useContractWrite` → `useSubmit`) reduces the conceptual distance to zero for that audience. The underlying mechanics differ (UTXO vs. account, party vs. address, template ID vs. contract address), but the compositional pattern is identical.

**Why codegen from DAR rather than from Daml source?**

DAR archives are the canonical artifact: they are what gets deployed to the ledger and what anchors package IDs. Generating from source would require users to run the Daml compiler as part of their TypeScript toolchain — a significant dependency. Parsing the compiled DAR at codegen time produces output that exactly matches what the live ledger exposes, with no risk of divergence from re-compilation.

**Alternatives considered:**

- *Use C7 Digital's TypeScript SDK directly:* C7's libraries target the JSON Ledger API v2 and replace `@daml/ledger` and `@daml/react`. They are an excellent fit for teams connecting directly to validator nodes. CantonKit targets the wallet gateway path (CIP-0103 / `@canton-network/dapp-sdk`) — the standard for consumer-facing browser dApps. The two libraries are complementary and serve different integration patterns.
- *Wait for the official Digital Asset dApp SDK (CIP-0103 proposal):* The Digital Asset proposal funds the core connectivity stack and a reference React wrapper. CantonKit provides a richer DX layer (codegen, testing utilities, multi-framework adapters) that is designed to sit on top of whatever the official SDK ships.

---

## Co-Marketing Commitments

Upon each milestone acceptance, I will:

- Publish a technical blog post or tutorial demonstrating the new capability
- Create a Canton-tagged demo on GitHub with working code
- Engage the Canton Discord developer community with a walkthrough thread
- Coordinate with the Canton Foundation on any joint announcement the Foundation wishes to make

---

## Team

**Jason Zhou** — sole author and maintainer of CantonKit.

- Background in TypeScript / React ecosystem tooling and Web3 frontend development
- Maintains the CantonKit monorepo at [github.com/jasonzhouu/CantonKit](https://github.com/jasonzhouu/CantonKit) (Apache-2.0)
- Contact: jasonzhouu@gmail.com

Long-term maintenance is planned beyond the grant period. CantonKit will continue to track `@canton-network/dapp-sdk` releases and Canton protocol upgrades.
