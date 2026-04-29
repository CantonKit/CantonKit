# Counter Chain View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the card-grid view in `examples/counter-app-localnet` with a chain-style timeline. Each lineage of Counter contracts (root → … → head) renders as one horizontal chain with a `+1` button at the end. Multiple lineages stack vertically. Long chains collapse the middle with a click-to-expand placeholder.

**Architecture:** A new pure helper `buildChains` walks the live ledger transaction buffer to derive `archived → created` edges and `created-only` roots, then for every active head in the ACS reconstructs the lineage from root to head. A new `useChains` hook wraps this, applies first-seen rootId stability, and returns a `Chain[]`. The UI is decomposed into `ChainsSection` → `ChainView` → `ChainNode` + `ChainConnector` + `StartChainTile`. `CounterApp` subscribes to the ledger stream with `bufferSize: 1000` so even long chains fit in the in-memory buffer the WebSocket transport already replays from offset 0.

**Tech Stack:** React 18, TypeScript (strict), Vite 5, Tailwind 3, HeroUI v2.8, framer-motion v11, `@cantonkit/react` hooks. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-29-counter-chain-view-design.md`

**Testing note:** This demo package has no unit-test harness, and adding one is out of scope. Verification is per-task via `pnpm --filter @cantonkit-examples/counter-app-localnet build` (full type-check + bundle) plus a manual smoke pass against `http://localhost:5173/` after Task 8. Each task ends with a commit.

**Working directory:** All paths below are relative to `/Users/jason/github/CantonKit`.

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `examples/counter-app-localnet/src/hooks/useChains.ts` | Create | Pure `buildChains` + `useChains` hook with stable rootId ordering. |
| `examples/counter-app-localnet/src/components/ChainNode.tsx` | Create | One node block. Variants: `archived` / `head` / `placeholder`. |
| `examples/counter-app-localnet/src/components/ChainConnector.tsx` | Create | Tiny separator between nodes. Variant: `default` / `brand`. |
| `examples/counter-app-localnet/src/components/ChainView.tsx` | Create | One chain: header + horizontal strip + collapse/expand + `+1` button. |
| `examples/counter-app-localnet/src/components/StartChainTile.tsx` | Create | Full-width "Start a new chain" tile, two sizes (`default` / `large`). |
| `examples/counter-app-localnet/src/components/ChainsSection.tsx` | Create | Vertical container of `<ChainView/>`s + bottom `<StartChainTile/>`. |
| `examples/counter-app-localnet/src/components/StatsStrip.tsx` | Modify | Rename "Counters" → "Chains". |
| `examples/counter-app-localnet/src/CounterApp.tsx` | Rewrite | Drop `useStableCounterOrder`, use `useChains`, set `bufferSize: 1000`, render `<ChainsSection/>`. |
| `examples/counter-app-localnet/src/components/CounterCard.tsx` | Delete | Replaced by `<ChainView/>`. |
| `examples/counter-app-localnet/src/components/CountersGrid.tsx` | Delete | Replaced by `<ChainsSection/>`. |
| `examples/counter-app-localnet/src/components/CreateCounterTile.tsx` | Delete | Replaced by `<StartChainTile/>`. |

`TopNav`, `LiveIndicator`, `StatCard`, `ActivityFeed`, `ActivityItem`, `EmptyState`, `NoPartyState`, `lib/format.ts`, `index.css`, `App.tsx`, `main.tsx` are unchanged.

---

## Task 1: `useChains` hook + `buildChains` pure helper

**Files:**
- Create: `examples/counter-app-localnet/src/hooks/useChains.ts`

- [ ] **Step 1: Create `src/hooks/useChains.ts`**

```ts
import { useMemo, useRef } from 'react'
import type { StreamEvent } from '../components/ActivityItem'

export interface CounterPayload {
  owner: string
  count: number
}

export interface ActiveCounter {
  contractId: string
  payload: CounterPayload
}

export interface ChainNodeData {
  contractId: string
  count: number
  archived: boolean
}

export interface Chain {
  rootId: string
  headId: string
  head: ActiveCounter
  nodes: ChainNodeData[]
  partial: boolean
}

interface ChainGraph {
  countById: Map<string, number>
  nextOf: Map<string, string>
  prevOf: Map<string, string>
  rootIds: Set<string>
}

function buildChainGraph(events: StreamEvent[]): ChainGraph {
  const countById = new Map<string, number>()
  const nextOf = new Map<string, string>()
  const prevOf = new Map<string, string>()
  const rootIds = new Set<string>()

  for (const e of events) {
    if (e.source !== 'ledger') continue

    const created: Array<{ contractId: string; count: number }> = []
    const archived: string[] = []
    for (const ev of e.events) {
      if (ev.kind === 'created') {
        const payload = ev.payload as { count?: unknown } | undefined
        const count = typeof payload?.count === 'number' ? payload.count : 0
        countById.set(ev.contractId, count)
        created.push({ contractId: ev.contractId, count })
      } else if (ev.kind === 'archived') {
        archived.push(ev.contractId)
      }
    }

    if (created.length === 1 && archived.length === 0) {
      rootIds.add(created[0].contractId)
    } else if (created.length === 1 && archived.length === 1) {
      nextOf.set(archived[0], created[0].contractId)
      prevOf.set(created[0].contractId, archived[0])
    }
  }

  return { countById, nextOf, prevOf, rootIds }
}

export function buildChains(
  rows: ActiveCounter[],
  events: StreamEvent[],
): Chain[] {
  const graph = buildChainGraph(events)
  const chains: Chain[] = []

  for (const head of rows) {
    // Walk backward to find root
    let cursor = head.contractId
    const seen = new Set<string>([cursor])
    while (!graph.rootIds.has(cursor) && graph.prevOf.has(cursor)) {
      const prev = graph.prevOf.get(cursor) as string
      if (seen.has(prev)) break
      seen.add(prev)
      cursor = prev
    }
    const rootId = cursor
    const partial = !graph.rootIds.has(rootId)

    // Walk forward from root to head, emitting nodes
    const nodes: ChainNodeData[] = []
    let id: string | undefined = rootId
    const visited = new Set<string>()
    while (id && !visited.has(id)) {
      visited.add(id)
      const isHead = id === head.contractId
      const count = isHead ? head.payload.count : graph.countById.get(id) ?? 0
      nodes.push({ contractId: id, count, archived: !isHead })
      if (isHead) break
      id = graph.nextOf.get(id)
    }

    chains.push({
      rootId,
      headId: head.contractId,
      head,
      nodes,
      partial,
    })
  }

  return chains
}

export function useChains(
  rows: ActiveCounter[] | undefined,
  events: StreamEvent[],
): Chain[] | undefined {
  const orderRef = useRef<string[]>([])

  return useMemo(() => {
    if (!rows) return rows
    const chains = buildChains(rows, events)

    // Stable ordering by first-seen rootId. Increment never changes rootId,
    // so chains keep their slot across +1 clicks.
    const currentRoots = new Set(chains.map((c) => c.rootId))
    orderRef.current = orderRef.current.filter((id) => currentRoots.has(id))
    for (const c of chains) {
      if (!orderRef.current.includes(c.rootId)) orderRef.current.push(c.rootId)
    }
    const positions = new Map(orderRef.current.map((id, i) => [id, i]))
    return [...chains].sort(
      (a, b) =>
        (positions.get(a.rootId) ?? 0) - (positions.get(b.rootId) ?? 0),
    )
  }, [rows, events])
}
```

- [ ] **Step 2: Verify build (will still fail since no consumer yet — just type-check this file)**

Run: `pnpm --filter @cantonkit-examples/counter-app-localnet exec tsc --noEmit`
Expected: PASS (the new file alone type-checks; existing files are unchanged so the rest still compiles).

- [ ] **Step 3: Commit**

```bash
git add examples/counter-app-localnet/src/hooks/useChains.ts
git commit -m "feat(counter-demo): useChains hook + buildChains chain reconstruction"
```

---

## Task 2: `ChainNode` component

**Files:**
- Create: `examples/counter-app-localnet/src/components/ChainNode.tsx`

- [ ] **Step 1: Create `ChainNode.tsx`**

```tsx
import { Tooltip } from '@heroui/react'
import { motion } from 'framer-motion'
import { truncId } from '../lib/format'

interface CommonProps {
  onClick?: () => void
}

interface NodeProps extends CommonProps {
  variant: 'archived' | 'head'
  count: number
  contractId: string
}

interface PlaceholderProps extends CommonProps {
  variant: 'placeholder'
  hiddenCount: number
  firstHiddenCount: number
  lastHiddenCount: number
}

export type ChainNodeProps = NodeProps | PlaceholderProps

export function ChainNode(props: ChainNodeProps) {
  if (props.variant === 'placeholder') {
    const { hiddenCount, firstHiddenCount, lastHiddenCount, onClick } = props
    return (
      <Tooltip
        content={`count ${firstHiddenCount} – ${lastHiddenCount} (${hiddenCount} nodes hidden) — click to expand`}
        placement="top"
      >
        <motion.button
          type="button"
          onClick={onClick}
          whileTap={{ scale: 0.95 }}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-large border border-dashed border-default-300/40 bg-content2/40 text-default-400 transition-colors hover:border-indigo-400/40 hover:text-default-200"
          aria-label={`Expand ${hiddenCount} hidden nodes`}
        >
          …
        </motion.button>
      </Tooltip>
    )
  }

  const { variant, count, contractId } = props
  const isHead = variant === 'head'
  const sizeCls = isHead ? 'h-16 w-16 text-2xl' : 'h-14 w-14 text-lg'
  const styleCls = isHead
    ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-[0_0_20px_-4px_rgba(139,92,246,0.6)] ring-1 ring-white/20'
    : 'bg-content2/60 text-default-300 ring-1 ring-white/5'

  return (
    <Tooltip content={contractId} placement="top">
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className={`flex shrink-0 items-center justify-center rounded-large font-semibold nums ${sizeCls} ${styleCls}`}
        title={truncId(contractId)}
      >
        {count}
      </motion.div>
    </Tooltip>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @cantonkit-examples/counter-app-localnet exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add examples/counter-app-localnet/src/components/ChainNode.tsx
git commit -m "feat(counter-demo): ChainNode with archived/head/placeholder variants"
```

---

## Task 3: `ChainConnector` component

**Files:**
- Create: `examples/counter-app-localnet/src/components/ChainConnector.tsx`

- [ ] **Step 1: Create `ChainConnector.tsx`**

```tsx
interface ChainConnectorProps {
  variant?: 'default' | 'brand'
}

export function ChainConnector({ variant = 'default' }: ChainConnectorProps) {
  const cls =
    variant === 'brand'
      ? 'bg-gradient-to-r from-indigo-400/60 to-violet-400/60'
      : 'bg-default-300/40'
  return (
    <span
      aria-hidden="true"
      className={`mx-1 inline-block h-px w-4 shrink-0 self-center ${cls}`}
    />
  )
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @cantonkit-examples/counter-app-localnet exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add examples/counter-app-localnet/src/components/ChainConnector.tsx
git commit -m "feat(counter-demo): ChainConnector separator with brand variant"
```

---

## Task 4: `ChainView` component (collapse + expand + auto-scroll)

**Files:**
- Create: `examples/counter-app-localnet/src/components/ChainView.tsx`

- [ ] **Step 1: Create `ChainView.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { Button, Card, CardBody, Chip } from '@heroui/react'
import { motion } from 'framer-motion'
import { ChainNode } from './ChainNode'
import { ChainConnector } from './ChainConnector'
import { truncId } from '../lib/format'
import type { Chain } from '../hooks/useChains'

const COLLAPSE_THRESHOLD = 12
const VISIBLE_HEAD = 4
const VISIBLE_TAIL = 6

interface ChainViewProps {
  chain: Chain
  index: number
  isPending: boolean
  onIncrement: (headId: string) => void
}

export function ChainView({
  chain,
  index,
  isPending,
  onIncrement,
}: ChainViewProps) {
  const [expanded, setExpanded] = useState(false)
  const stripRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll the chain strip to the right edge whenever the head changes
  // or the user toggles expansion (so the +1 button stays in view).
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
  }, [chain.headId, expanded])

  const total = chain.nodes.length
  const shouldCollapse = !expanded && total > COLLAPSE_THRESHOLD

  const renderItems: Array<
    | { kind: 'node'; node: Chain['nodes'][number]; isHead: boolean }
    | {
        kind: 'placeholder'
        hiddenCount: number
        firstHiddenCount: number
        lastHiddenCount: number
      }
  > = []

  if (shouldCollapse) {
    const headNodes = chain.nodes.slice(0, VISIBLE_HEAD)
    const tailNodes = chain.nodes.slice(total - VISIBLE_TAIL)
    const hidden = chain.nodes.slice(VISIBLE_HEAD, total - VISIBLE_TAIL)
    for (const node of headNodes) {
      renderItems.push({
        kind: 'node',
        node,
        isHead: node.contractId === chain.headId,
      })
    }
    renderItems.push({
      kind: 'placeholder',
      hiddenCount: hidden.length,
      firstHiddenCount: hidden[0].count,
      lastHiddenCount: hidden[hidden.length - 1].count,
    })
    for (const node of tailNodes) {
      renderItems.push({
        kind: 'node',
        node,
        isHead: node.contractId === chain.headId,
      })
    }
  } else {
    for (const node of chain.nodes) {
      renderItems.push({
        kind: 'node',
        node,
        isHead: node.contractId === chain.headId,
      })
    }
  }

  return (
    <Card
      shadow="none"
      classNames={{
        base: 'border border-white/5 bg-content1/60 backdrop-blur',
      }}
    >
      <CardBody className="gap-3 p-5">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Chain {index + 1}</span>
            <Chip
              size="sm"
              variant="flat"
              classNames={{ content: 'font-mono text-xs' }}
              title={chain.rootId}
            >
              root {truncId(chain.rootId)}
            </Chip>
            <span className="text-xs text-default-400 nums">
              {total} {total === 1 ? 'node' : 'nodes'}
            </span>
            {chain.partial && (
              <Chip size="sm" variant="flat" color="warning">
                partial
              </Chip>
            )}
          </div>
          {expanded && total > COLLAPSE_THRESHOLD && (
            <Button
              size="sm"
              variant="flat"
              onPress={() => setExpanded(false)}
              className="h-7 px-3 text-xs"
            >
              Collapse
            </Button>
          )}
        </header>

        <div
          ref={stripRef}
          className="flex items-center gap-0 overflow-x-auto pb-2"
          style={{ scrollSnapType: 'x proximity' }}
        >
          {chain.partial && (
            <span
              aria-hidden="true"
              className="mr-2 shrink-0 select-none text-default-400"
            >
              …
            </span>
          )}
          {renderItems.map((item, i) => {
            const isLast = i === renderItems.length - 1
            return (
              <span
                key={
                  item.kind === 'node'
                    ? item.node.contractId
                    : `placeholder-${i}`
                }
                className="flex items-center"
              >
                {item.kind === 'node' ? (
                  <ChainNode
                    variant={item.isHead ? 'head' : 'archived'}
                    count={item.node.count}
                    contractId={item.node.contractId}
                  />
                ) : (
                  <ChainNode
                    variant="placeholder"
                    hiddenCount={item.hiddenCount}
                    firstHiddenCount={item.firstHiddenCount}
                    lastHiddenCount={item.lastHiddenCount}
                    onClick={() => setExpanded(true)}
                  />
                )}
                {!isLast && (
                  <ChainConnector
                    variant={
                      item.kind === 'node' && item.isHead ? 'brand' : 'default'
                    }
                  />
                )}
              </span>
            )
          })}

          <ChainConnector variant="brand" />
          <motion.div whileTap={{ scale: 0.96 }} className="shrink-0">
            <Button
              size="md"
              color="primary"
              isLoading={isPending}
              onPress={() => onIncrement(chain.headId)}
              className="bg-gradient-to-br from-indigo-500 to-violet-500 font-medium"
            >
              +1
            </Button>
          </motion.div>
        </div>
      </CardBody>
    </Card>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @cantonkit-examples/counter-app-localnet exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add examples/counter-app-localnet/src/components/ChainView.tsx
git commit -m "feat(counter-demo): ChainView with collapse, click-to-expand, auto-scroll"
```

---

## Task 5: `StartChainTile` component

**Files:**
- Create: `examples/counter-app-localnet/src/components/StartChainTile.tsx`

- [ ] **Step 1: Create `StartChainTile.tsx`**

```tsx
import { motion } from 'framer-motion'
import { Spinner } from '@heroui/react'

interface StartChainTileProps {
  isPending: boolean
  onPress: () => void
  size?: 'default' | 'large'
}

export function StartChainTile({
  isPending,
  onPress,
  size = 'default',
}: StartChainTileProps) {
  const isLarge = size === 'large'
  return (
    <motion.button
      type="button"
      onClick={onPress}
      disabled={isPending}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`group flex w-full flex-col items-center justify-center gap-3 rounded-large border border-dashed border-white/10 bg-content1/30 backdrop-blur transition-colors hover:border-indigo-400/40 hover:bg-content1/50 hover:text-default-200 disabled:cursor-not-allowed disabled:opacity-60 ${
        isLarge ? 'min-h-[260px] p-10 text-default-300' : 'min-h-[120px] p-6 text-default-400'
      }`}
    >
      {isPending ? (
        <Spinner size="sm" />
      ) : (
        <span
          className={`flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-default-300 transition-transform group-hover:scale-105 ${
            isLarge ? 'h-14 w-14 text-3xl' : 'h-10 w-10 text-xl'
          }`}
        >
          +
        </span>
      )}
      <span className={`font-medium ${isLarge ? 'text-base' : 'text-sm'}`}>
        {isPending
          ? 'Creating…'
          : isLarge
            ? 'Start your first chain'
            : 'Start a new chain'}
      </span>
      <span className="text-xs text-default-500">
        Create a fresh Counter contract
      </span>
    </motion.button>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @cantonkit-examples/counter-app-localnet exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add examples/counter-app-localnet/src/components/StartChainTile.tsx
git commit -m "feat(counter-demo): StartChainTile with default and large sizes"
```

---

## Task 6: `ChainsSection` container

**Files:**
- Create: `examples/counter-app-localnet/src/components/ChainsSection.tsx`

- [ ] **Step 1: Create `ChainsSection.tsx`**

```tsx
import { Spinner } from '@heroui/react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChainView } from './ChainView'
import { StartChainTile } from './StartChainTile'
import type { Chain } from '../hooks/useChains'

interface ChainsSectionProps {
  chains: Chain[] | undefined
  isLoading: boolean
  error: unknown
  isPending: boolean
  onIncrement: (headId: string) => void
  onCreate: () => void
}

export function ChainsSection({
  chains,
  isLoading,
  error,
  isPending,
  onIncrement,
  onCreate,
}: ChainsSectionProps) {
  if (isLoading && !chains) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading chains…" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-medium border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
        Error: {String(error)}
      </div>
    )
  }

  if (!chains?.length) {
    return <StartChainTile size="large" isPending={isPending} onPress={onCreate} />
  }

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence initial={false}>
        {chains.map((chain, i) => (
          <motion.div
            key={chain.rootId}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <ChainView
              chain={chain}
              index={i}
              isPending={isPending}
              onIncrement={onIncrement}
            />
          </motion.div>
        ))}
      </AnimatePresence>
      <StartChainTile isPending={isPending} onPress={onCreate} />
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @cantonkit-examples/counter-app-localnet exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add examples/counter-app-localnet/src/components/ChainsSection.tsx
git commit -m "feat(counter-demo): ChainsSection vertical container with empty state"
```

---

## Task 7: Rename "Counters" → "Chains" in `StatsStrip`

**Files:**
- Modify: `examples/counter-app-localnet/src/components/StatsStrip.tsx`

- [ ] **Step 1: Read the file**

Read `examples/counter-app-localnet/src/components/StatsStrip.tsx` to confirm current contents (props are `countersCount`, `totalCount`, `eventsCount`).

- [ ] **Step 2: Replace `StatsStrip.tsx` with the new version**

```tsx
import { StatCard } from './StatCard'

interface StatsStripProps {
  chainsCount: number
  totalCount: number
  eventsCount: number
}

export function StatsStrip({
  chainsCount,
  totalCount,
  eventsCount,
}: StatsStripProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label="Chains"
        value={chainsCount}
        hint="active lineages"
        icon={<span className="text-xl">🔗</span>}
      />
      <StatCard
        label="Total count"
        value={totalCount}
        hint="sum across heads"
        icon={<span className="text-xl">∑</span>}
      />
      <StatCard
        label="Events"
        value={eventsCount}
        hint="seen this session"
        icon={<span className="text-xl">⚡</span>}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verify build still passes for this file in isolation**

Run: `pnpm --filter @cantonkit-examples/counter-app-localnet exec tsc --noEmit`
Expected: FAIL — `CounterApp.tsx` still passes the old `countersCount` prop. That's expected; it gets fixed in Task 8. Continue without committing this file alone.

- [ ] **Step 4: Skip commit until Task 8**

Do not commit this file by itself; the rename is bundled with Task 8 to keep the build green per commit.

---

## Task 8: Wire `CounterApp` to chains and bump `bufferSize`

**Files:**
- Modify: `examples/counter-app-localnet/src/CounterApp.tsx`

- [ ] **Step 1: Replace `src/CounterApp.tsx`**

```tsx
/// <reference types="vite/client" />
import {
  useContracts,
  useSubmit,
  useTransactionStream,
} from '@cantonkit/react'
import { templateId } from '@cantonkit/core'
import { TopNav } from './components/TopNav'
import { StatsStrip } from './components/StatsStrip'
import { ChainsSection } from './components/ChainsSection'
import { ActivityFeed } from './components/ActivityFeed'
import { NoPartyState } from './components/NoPartyState'
import { useChains, type ActiveCounter } from './hooks/useChains'
import type { StreamEvent } from './components/ActivityItem'

const COUNTER = templateId('#counter:Counter:Counter')

interface Counter {
  owner: string
  count: number
}

export function CounterApp() {
  const party = import.meta.env.VITE_PARTY as string | undefined

  const counters = useContracts<Counter>({
    templateId: COUNTER,
    parties: party ? [party] : [],
  })
  const submit = useSubmit()
  const stream = useTransactionStream({
    source: 'ledger',
    filter: { templateIds: [COUNTER], parties: party ? [party] : [] },
    bufferSize: 1000,
  })

  const rows = counters.data as ActiveCounter[] | undefined
  const events = stream.events as unknown as StreamEvent[]
  const chains = useChains(rows, events)

  if (!party) {
    return <NoPartyState />
  }

  const incrementCounter = (headId: string) =>
    submit.mutate({
      commands: [
        {
          ExerciseCommand: {
            templateId: COUNTER,
            contractId: headId,
            choice: 'Increment',
            choiceArgument: {},
          },
        },
      ],
      actAs: [party],
    })

  const createCounter = () =>
    submit.mutate({
      commands: [
        {
          CreateCommand: {
            templateId: COUNTER,
            createArguments: { owner: party, count: 0 },
          },
        },
      ],
      actAs: [party],
    })

  const totalCount =
    chains?.reduce((acc, c) => acc + (c.head.payload.count ?? 0), 0) ?? 0

  return (
    <>
      <TopNav party={party} connected={stream.isConnected} />
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <StatsStrip
          chainsCount={chains?.length ?? 0}
          totalCount={totalCount}
          eventsCount={events.length}
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-base font-semibold">Chains</h2>
              <span className="text-xs text-default-400 nums">
                {chains?.length ?? 0} active
              </span>
            </div>
            <ChainsSection
              chains={chains}
              isLoading={counters.isLoading}
              error={counters.error}
              isPending={submit.isPending}
              onIncrement={incrementCounter}
              onCreate={createCounter}
            />
          </section>
          <aside className="lg:col-span-1">
            <ActivityFeed events={events} />
          </aside>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify full build (StatsStrip rename + CounterApp rewrite together)**

Run: `pnpm --filter @cantonkit-examples/counter-app-localnet build`
Expected: PASS (only the pre-existing 500 kB chunk-size warning).

- [ ] **Step 3: Commit StatsStrip rename + CounterApp rewrite together**

```bash
git add examples/counter-app-localnet/src/components/StatsStrip.tsx examples/counter-app-localnet/src/CounterApp.tsx
git commit -m "feat(counter-demo): switch CounterApp to chain-view with bufferSize=1000"
```

---

## Task 9: Delete superseded files

**Files:**
- Delete: `examples/counter-app-localnet/src/components/CounterCard.tsx`
- Delete: `examples/counter-app-localnet/src/components/CountersGrid.tsx`
- Delete: `examples/counter-app-localnet/src/components/CreateCounterTile.tsx`

- [ ] **Step 1: Confirm no remaining imports**

Run: `grep -rn "CounterCard\|CountersGrid\|CreateCounterTile" examples/counter-app-localnet/src/`
Expected: NO matches (the rewrites in Task 8 removed every reference).

- [ ] **Step 2: Delete the three files**

Run: `rm examples/counter-app-localnet/src/components/CounterCard.tsx examples/counter-app-localnet/src/components/CountersGrid.tsx examples/counter-app-localnet/src/components/CreateCounterTile.tsx`

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @cantonkit-examples/counter-app-localnet build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -u examples/counter-app-localnet/src/components/
git commit -m "chore(counter-demo): drop superseded card/grid/tile components"
```

---

## Task 10: Manual smoke test

**Files:** none modified — verification only.

- [ ] **Step 1: Verify dev server is hot-reloaded**

Open `http://localhost:5173/` in a browser. The dev server (`pnpm dev`) should already be running per session context.

- [ ] **Step 2: Run the spec verification checklist**

Confirm each of the following against the spec's `Verification` section:

1. Empty state: only the large "Start your first chain" tile is visible.
2. Click the tile → a chain row appears with one highlighted head node `0` and a `+1` button.
3. Click `+1` five times → nodes `0 1 2 3 4 5` appear in order, each Increment animates the new head into place, the strip auto-scrolls to keep `+1` visible.
4. Click `+1` eight more times (chain length now 13) → middle collapses to `…`; first 4 nodes (`0 1 2 3`) and last 6 nodes (`8 9 10 11 12 13`) are visible.
5. Click the `…` placeholder → all 13 nodes render inline; "Collapse" pill appears in the chain header.
6. Click `+1` once more → expansion stays expanded; new head node appears at the right.
7. Click "Collapse" pill → middle re-collapses, "Collapse" pill disappears.
8. Click "Start a new chain" tile at the bottom → a Chain 2 row appears below Chain 1 with one head `0` + `+1`.
9. Hard reload → both chains reappear with stable order (Chain 1 above Chain 2).
10. Hover any archived node → tooltip shows the full contractId.
11. Resize the window to 375 px wide → each chain still scrolls horizontally; the activity feed stacks below; no horizontal page-level scroll.

- [ ] **Step 3: Apply targeted fixes if any check fails**

If a check fails, edit only the smallest component responsible. Do not re-architect. Re-run the build and re-verify the failed check.

- [ ] **Step 4: Commit if any fixes were made**

```bash
git add examples/counter-app-localnet/src
git commit -m "polish(counter-demo): chain-view smoke-test fixes"
```

If no fixes were needed, skip the commit.

---

## Done criteria

- All 10 tasks committed (with Task 7 bundled into Task 8's commit).
- `pnpm --filter @cantonkit-examples/counter-app-localnet build` passes.
- Manual smoke test from Task 10 passes 1–11.
- `src/components/CounterCard.tsx`, `CountersGrid.tsx`, and `CreateCounterTile.tsx` no longer exist.
- `useStableCounterOrder` no longer exists; `useChains` is the only ordering hook.
- `useTransactionStream` is invoked with `bufferSize: 1000` and `source: 'ledger'`.
- No new dependencies added to `package.json`.
