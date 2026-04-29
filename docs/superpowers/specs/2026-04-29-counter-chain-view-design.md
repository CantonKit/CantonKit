# Counter App — Chain View Redesign

## Goal

Replace the card-grid view of `examples/counter-app-localnet` with a chain-style timeline that reflects the UTXO nature of Canton: every `Increment` archives the current Counter and creates a successor with `count + 1`. Each lineage of contracts (root → … → head) renders as one horizontal chain with a `+1` button at the end. Multiple lineages stack vertically.

## Non-goals

- No new dependencies.
- No backend changes (Daml model unchanged).
- No light-mode toggle.
- No persistence of chain state across page reloads (we always rebuild from the live stream).
- No archived-contract inspection beyond a hover tooltip.

## Background research (feasibility)

- The Ledger WebSocket transport (`packages/core/src/transport/viaWebSocket.ts:166`) initializes `lastOffset = 0`, so on connect it sends `beginExclusive: 0` and the server replays every matching transaction from the start of history.
- Each `Increment` transaction contains exactly **1 archived event** (old `contractId`) and **1 created event** (new `contractId` with `payload.count = previous + 1`). These pairs form the chain edges.
- Each `New counter` (`CreateCommand`) transaction contains **0 archived + 1 created**. The lone created contract is a chain root.
- `useTransactionStream` defaults to `bufferSize: 50`. We will pass `bufferSize: 1000` from this demo so even long chains fit; chain construction also accumulates incrementally via `onEvent` so the cap on the visible buffer doesn't limit chain depth.

## Concept

Every Counter contract that has ever existed for the active party is a node in some chain. A chain reads left → right: oldest → newest. The rightmost active node is the head. The `+1` button lives just past the head; clicking it issues `Increment` on the head's `contractId`.

```
Chain root              head     action
  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ╭─────╮
  │ 0│──│ 1│──│ 2│──│ 3│──│ +1 ▶│
  └──┘  └──┘  └──┘  └──┘  ╰─────╯
  archived ──────────  active
```

When a chain has more than `COLLAPSE_THRESHOLD = 12` nodes total, the middle is collapsed to a single placeholder node (`…`) and the chain renders as **first 4 oldest + placeholder + last 6 newest** (11 visual items, hiding `length - 10` real nodes). Below or at the threshold, every node is visible. The placeholder shows a HeroUI `Tooltip` on hover listing the hidden range, e.g. `count 4 – 17 (14 nodes hidden)`.

**Click-to-expand:** Clicking the placeholder expands the chain inline — every hidden node renders in place, the placeholder disappears, and the strip retains horizontal scroll. The expanded state is per-chain (each chain tracks its own boolean), held in `<ChainView/>` local state so it resets only on full unmount, not on stream updates. When expanded, a small "Collapse" pill appears in the chain's header row (right of the title) so the user can collapse back without scrolling. Expanded state survives Increment events on that chain.

## Layout

```
┌─ TopNav (sticky) ─────────────────────────────────────┐
│  🔢 CantonKit Counter · party-chip · LiveIndicator    │
├─ StatsStrip ──────────────────────────────────────────┤
│  [ Chains ]  [ Total count ]  [ Events seen ]         │
├─ Two-column on lg: Chains (8/12) | ActivityFeed (4/12)┤
│  Chains                                              │
│  ┌─ Chain 1 (sticky horizontal scroll container) ─┐  │
│  │ ┌──┐ ┌──┐ ┌──┐ ┌──┐ … ┌──┐ ┌──┐ ┌──┐ ╭────╮     │  │
│  │ │ 0│─│ 1│─│ 2│─│ 3│─… │ 9│─│10│─│11│─│ +1 │     │  │
│  │ └──┘ └──┘ └──┘ └──┘   └──┘ └──┘ └──┘ ╰────╯     │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌─ Chain 2 ───────────────────────────────────────┐  │
│  │ ┌──┐ ┌──┐ ╭────╮                                 │  │
│  │ │ 0│─│ 1│─│ +1 │                                 │  │
│  │ └──┘ └──┘ ╰────╯                                 │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌────  + Start a new chain  ────┐                    │
│  │   dashed tile, full width      │                    │
│  └────────────────────────────────┘                    │
└────────────────────────────────────────────────────────┘
```

- Each chain row sits in its own glass card, full width of the chains column.
- Inside the card: title row (small `Chain` label + truncated root contractId chip + node count) above a horizontal scroll strip.
- The horizontal strip uses `overflow-x: auto`, with `scroll-snap-type: x mandatory` and a snap point on the head so the head is always centered or right-aligned after layout. On chain growth (head replaced), the container auto-scrolls right.
- "Start a new chain" tile sits below all chains; replaces the per-counter `Create` tile inside the previous grid.

## Visual style

- Reuse glass-morphism: `bg-content1/60 backdrop-blur border-white/5`.
- Node base: 56×56px rounded-large with `tabular-nums` count.
- Active head: 64×64px, indigo→violet gradient, soft glow ring (`shadow-[0_0_20px_-4px_rgba(139,92,246,0.6)]`).
- Archived nodes: muted (`bg-content2/60`, `text-default-400`, no ring).
- Collapsed placeholder: same size as archived node, dashed border, content `…`. Hover shows a HeroUI `Tooltip` with the hidden range.
- Connector: 16px wide, 1px tall horizontal line `bg-default-300/40`. Last connector before `+1` button gets the brand gradient.
- `+1` button: HeroUI `Button` with the brand gradient, `Increment +1` label, framer-motion `whileTap={{ scale: 0.95 }}`.

## Components (file structure)

| File | Status | Responsibility |
|---|---|---|
| `src/CounterApp.tsx` | Modify | Wire hooks, set `bufferSize: 1000`, pass derived `chains` to `<ChainsSection/>`. |
| `src/hooks/useChains.ts` | Create | Build `Chain[]` from `rows` (ACS) + `events` (transaction buffer). |
| `src/components/ChainsSection.tsx` | Create | Vertical container of `<ChainView/>`s + the bottom `<StartChainTile/>`. Loading + error + empty states. |
| `src/components/ChainView.tsx` | Create | One chain: header row + horizontal scroll strip with `<ChainNode/>`s, connectors, collapse placeholder, and the `+1` button. Auto-scrolls right on length change. |
| `src/components/ChainNode.tsx` | Create | One node block. Variants: `archived` / `head` / `placeholder`. Tooltip with full contractId / range. |
| `src/components/ChainConnector.tsx` | Create | Tiny separator line between two nodes. Variant `brand` for the link before `+1`. |
| `src/components/StartChainTile.tsx` | Create | Renamed `CreateCounterTile` adapted for the new "Start a new chain" copy + full-width layout. |
| `src/components/StatsStrip.tsx` | Modify | Rename "Counters" stat to "Chains". |
| `src/components/CounterCard.tsx` | Delete | Replaced by `<ChainView/>` + `<ChainNode/>`. |
| `src/components/CountersGrid.tsx` | Delete | Replaced by `<ChainsSection/>`. |
| `src/components/CreateCounterTile.tsx` | Delete | Replaced by `<StartChainTile/>`. |

Activity feed, top nav, live indicator, no-party state, format helpers, stat card, empty state, and `index.css` are unchanged.

## Data flow

### `useChains(rows, events)` algorithm

Inputs:
- `rows: ActiveContract<{owner, count}>[]` — current ACS, the candidate heads.
- `events: TransactionEvent[]` — capped buffer (length up to 1000) ordered most-recent-first.

Outputs:
- `Chain[]` where `Chain = { rootId: string, headId: string, head: ActiveContract<Counter>, nodes: Array<{ contractId: string, count: number, archived: boolean }> }`.
- `chainsLoading: boolean` — true until at least one ACS fetch resolves.

Algorithm (recomputed on `rows`/`events` change):

1. Walk `events` once to build:
   - `countById: Map<contractId, number>` — from every `created` event's `payload.count`.
   - `nextOf: Map<archivedId, createdId>` — from every ledger transaction whose `events` field contains exactly one `archived` and one `created` (with the same `templateId`).
   - `rootIds: Set<contractId>` — `createdId` of every ledger transaction whose `events` contain exactly one `created` and zero `archived`. Those are `CreateCommand` transactions for fresh chains.
2. For each `head` in `rows`:
   - Walk **backward** from `head.contractId` using a precomputed inverse map `prevOf` (built once from `nextOf`) until either (a) we reach an id in `rootIds`, or (b) we hit an id with no predecessor.
   - That id is the chain's `rootId`.
   - Then walk forward from `rootId` via `nextOf`, emitting nodes `{contractId, count: countById.get(id) ?? 0, archived: id !== head.contractId}` until we reach `head.contractId`.
3. Sort chains by `rootId` first-seen-stable order (track in a ref like the previous `useStableCounterOrder`) so newly created chains append at the bottom instead of reshuffling.
4. Return the assembled `Chain[]` plus a boolean indicating whether the chain set is fully resolved (every head has a backward walk reaching some root).

If a backward walk fails to reach a known root (replay still arriving), the chain is still emitted with whatever segment we have, marked `partial: true`. `<ChainView/>` shows it with a leading "…" indicator instead of a numbered first node.

### Streaming

`CounterApp` calls `useTransactionStream` once with `source: 'ledger'`, the same template/party filter, and `bufferSize: 1000`. The hook already replays history from offset 0, so on initial mount the buffer fills in with the entire chain history before render settles.

### Increment + create

- `+1` button on `ChainView` calls `onIncrement(headId)` → `submit.mutate({ ExerciseCommand: Increment, contractId: headId, ... })`.
- `Start a new chain` tile calls `onCreate()` → `submit.mutate({ CreateCommand: Counter, createArguments: {owner: party, count: 0} })`. The new chain root will appear once the next ACS refetch + stream event arrive.

### Stable ordering

Chains keep their slot via `prevHeadByRoot: Map<rootId, headId>` tracked in a ref:
- A new `rootId` not yet in the map is appended to the order.
- On Increment the chain's `headId` updates but `rootId` is stable → its slot is unchanged.

## Edge cases

- **Empty state (no Counters yet)**: chains list is empty; render only the `<StartChainTile/>` centered with a slightly larger headline ("Start your first chain") so the page isn't blank.
- **Loading**: while `useContracts` is loading and the stream hasn't yielded any history yet, render a single skeleton chain row (3 muted node placeholders).
- **Partial chain**: walk reaches an id that's neither a known root nor in the buffer. Render a "…" placeholder at the left of the chain. Tooltip: "Older history not loaded".
- **No `VITE_PARTY`**: `<NoPartyState/>` (unchanged).
- **Stream disconnect mid-session**: `LiveIndicator` flips to "Reconnecting…". Chain data freezes at last good state; on reconnect, the stream replays from `lastOffset` (already in `viaWebSocket.ts`) and merges naturally.
- **Increment race**: while `submit.isPending`, the `+1` button on every chain shows `isLoading`. We don't disable other chains' buttons (each Increment targets its own head; submissions don't conflict).
- **Long chain (>50 nodes)**: middle collapse always engages above 12 visible nodes; horizontal scroll handles arbitrary length within `bufferSize`.
- **Buffer overflow (chain longer than 1000 events)**: the leading nodes simply won't appear; chain is rendered as `partial: true` with the "…" leading placeholder.
- **Multiple created without archived in one tx (batch creates)**: not produced by this Daml; if encountered, treat all created ids as separate roots (don't add to `nextOf`).

## Verification

1. `pnpm --filter @cantonkit-examples/counter-app-localnet build` → exit 0.
2. Manual smoke at `http://localhost:5173/`:
   - Empty state shows "Start your first chain" tile.
   - Click it → chain row appears with a single highlighted head node `0` and `+1` button.
   - Click `+1` 5 times → nodes `0 1 2 3 4 5` appear, head animates from each previous to the new value, container scrolls right.
   - Click `+1` 8 more times (total 13 nodes including the head) → middle collapses to `…` after the 4th oldest node; the 6 most recent nodes remain visible on the right.
   - Click the `…` placeholder → all hidden nodes render in place, a "Collapse" pill appears in the chain header. Click "Collapse" → returns to the collapsed view.
   - With the chain expanded, click `+1` once more → expanded view stays expanded; the new head node appears at the right.
   - Click "Start a new chain" → second chain row appears below the first; it's empty save for one head and `+1`.
   - Reload page → both chains rebuild from stream replay; ordering stable (chain 1 above chain 2).
   - Hover an archived node → tooltip with full contractId.
3. Resize to 375px width → each chain still scrolls horizontally; right column (activity feed) stacks below; no horizontal page scroll.

## Out of scope (future)

- Per-chain rename / labels.
- Branching chains (multi-archive transactions).
- Persisting chain order across reloads via localStorage.
- A "rewind" affordance to inspect a node's full payload.
