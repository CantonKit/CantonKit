# Counter App HeroUI Modern Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `examples/counter-app-localnet` into a modern dark "Live Ledger Console" using HeroUI + framer-motion, splitting the monolithic `App.tsx` into small focused components.

**Architecture:** Single-page React 18 + Vite app. `App.tsx` keeps `LedgerProvider` wiring; new `CounterApp.tsx` orchestrates hooks + layout; UI is decomposed into 9 small components in `src/components/`. No new dependencies — HeroUI v2.8 and framer-motion v11 are already installed. No backend changes.

**Tech Stack:** React 18, TypeScript (strict), Vite 5, Tailwind 3, HeroUI v2.8, framer-motion v11, `@cantonkit/react` hooks.

**Testing note:** This demo package has no unit-test harness, and adding one is out of scope. Verification is per-task via `pnpm --filter @cantonkit-examples/counter-app-localnet build` (full type-check + bundle) plus manual checks in the running dev server at `http://localhost:5173/`. Each task ends with a commit.

**Spec:** `docs/superpowers/specs/2026-04-29-counter-app-heroui-redesign-design.md`

**Working directory:** All paths below are relative to the repo root `/Users/jason/github/CantonKit`.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `examples/counter-app-localnet/src/App.tsx` | Modify (slim) | `LedgerProvider` wiring only; renders `<CounterApp/>`. |
| `examples/counter-app-localnet/src/CounterApp.tsx` | Create | Reads hooks, derives stats, lays out nav + stats + grid + feed. Handles no-`VITE_PARTY` case. |
| `examples/counter-app-localnet/src/index.css` | Modify | Add background gradient + tabular-nums helper. |
| `examples/counter-app-localnet/src/main.tsx` | Verify only | No change expected. |
| `examples/counter-app-localnet/src/lib/format.ts` | Create | `formatRelative(iso: string)` and `truncId(id: string)` helpers. |
| `examples/counter-app-localnet/src/components/TopNav.tsx` | Create | Sticky nav: brand, party chip, live indicator, "New counter" button. |
| `examples/counter-app-localnet/src/components/LiveIndicator.tsx` | Create | Pulsing-dot chip; "Live" / "Reconnecting…". |
| `examples/counter-app-localnet/src/components/StatsStrip.tsx` | Create | 3-card stat strip. |
| `examples/counter-app-localnet/src/components/StatCard.tsx` | Create | Reusable stat card (label + gradient number + optional icon). |
| `examples/counter-app-localnet/src/components/CountersGrid.tsx` | Create | Map `counters.data` → `CounterCard`s; loading + empty states. |
| `examples/counter-app-localnet/src/components/CounterCard.tsx` | Create | Single counter: big count, owner, contract id chip, +1 button. |
| `examples/counter-app-localnet/src/components/ActivityFeed.tsx` | Create | Timeline list of `stream.events`; empty state. |
| `examples/counter-app-localnet/src/components/ActivityItem.tsx` | Create | Vertical-line timeline row, kind chip, contract id, relative time. |
| `examples/counter-app-localnet/src/components/EmptyState.tsx` | Create | Reusable empty box: icon + title + body + optional action. |
| `examples/counter-app-localnet/src/components/NoPartyState.tsx` | Create | Full-page card shown when `VITE_PARTY` is unset. |

---

## Task 1: Add background + format helpers (foundation)

**Files:**
- Modify: `examples/counter-app-localnet/src/index.css`
- Create: `examples/counter-app-localnet/src/lib/format.ts`

- [ ] **Step 1: Replace `src/index.css` contents**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html,
body,
#root {
  min-height: 100%;
}

body {
  background:
    radial-gradient(80rem 50rem at 100% -10%, rgba(99, 102, 241, 0.18), transparent 60%),
    radial-gradient(60rem 40rem at -10% 110%, rgba(139, 92, 246, 0.12), transparent 60%),
    linear-gradient(180deg, #07080d 0%, #0b0d14 100%);
  background-attachment: fixed;
}

@layer utilities {
  .nums {
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum';
  }
  .text-gradient-brand {
    background: linear-gradient(135deg, #818cf8 0%, #a78bfa 50%, #c084fc 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
  }
}
```

- [ ] **Step 2: Create `src/lib/format.ts`**

```ts
export function truncId(id: string, head = 8, tail = 4): string {
  if (id.length <= head + tail + 1) return id
  return `${id.slice(0, head)}…${id.slice(-tail)}`
}

export function formatRelative(iso: string | undefined, now: number = Date.now()): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const diff = Math.max(0, Math.floor((now - t) / 1000))
  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @cantonkit-examples/counter-app-localnet build`
Expected: PASS (type-check + bundle clean).

- [ ] **Step 4: Commit**

```bash
git add examples/counter-app-localnet/src/index.css examples/counter-app-localnet/src/lib/format.ts
git commit -m "feat(counter-demo): background gradient + format helpers"
```

---

## Task 2: `EmptyState` and `LiveIndicator` primitives

**Files:**
- Create: `examples/counter-app-localnet/src/components/EmptyState.tsx`
- Create: `examples/counter-app-localnet/src/components/LiveIndicator.tsx`

- [ ] **Step 1: Create `EmptyState.tsx`**

```tsx
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  body?: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-content2 text-default-400">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-default-600">{title}</p>
        {body && <p className="text-sm text-default-400 max-w-sm">{body}</p>}
      </div>
      {action}
    </div>
  )
}
```

- [ ] **Step 2: Create `LiveIndicator.tsx`**

```tsx
import { Chip } from '@heroui/react'

interface LiveIndicatorProps {
  connected: boolean
}

export function LiveIndicator({ connected }: LiveIndicatorProps) {
  return (
    <Chip
      variant="flat"
      color={connected ? 'success' : 'warning'}
      classNames={{ base: 'gap-1.5 pl-2 pr-3', content: 'text-xs font-medium' }}
      startContent={
        <span className="relative flex h-2 w-2">
          {connected && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              connected ? 'bg-success' : 'bg-warning'
            }`}
          />
        </span>
      }
    >
      {connected ? 'Live' : 'Reconnecting…'}
    </Chip>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @cantonkit-examples/counter-app-localnet build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add examples/counter-app-localnet/src/components/EmptyState.tsx examples/counter-app-localnet/src/components/LiveIndicator.tsx
git commit -m "feat(counter-demo): EmptyState and LiveIndicator primitives"
```

---

## Task 3: `StatCard` and `StatsStrip`

**Files:**
- Create: `examples/counter-app-localnet/src/components/StatCard.tsx`
- Create: `examples/counter-app-localnet/src/components/StatsStrip.tsx`

- [ ] **Step 1: Create `StatCard.tsx`**

```tsx
import { Card, CardBody } from '@heroui/react'
import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
}

export function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <Card
      shadow="none"
      classNames={{
        base: 'border border-white/5 bg-content1/60 backdrop-blur',
      }}
    >
      <CardBody className="flex flex-row items-center justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-default-400">
            {label}
          </p>
          <p className="text-3xl font-semibold nums text-gradient-brand">
            {value}
          </p>
          {hint && <p className="text-xs text-default-500">{hint}</p>}
        </div>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-medium bg-default-100/30 text-default-400">
            {icon}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
```

- [ ] **Step 2: Create `StatsStrip.tsx`**

```tsx
import { StatCard } from './StatCard'

interface StatsStripProps {
  countersCount: number
  totalCount: number
  eventsCount: number
}

export function StatsStrip({ countersCount, totalCount, eventsCount }: StatsStripProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label="Counters"
        value={countersCount}
        hint="active contracts"
        icon={<span className="text-xl">🔢</span>}
      />
      <StatCard
        label="Total count"
        value={totalCount}
        hint="sum across counters"
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

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @cantonkit-examples/counter-app-localnet build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add examples/counter-app-localnet/src/components/StatCard.tsx examples/counter-app-localnet/src/components/StatsStrip.tsx
git commit -m "feat(counter-demo): StatCard and StatsStrip"
```

---

## Task 4: `TopNav`

**Files:**
- Create: `examples/counter-app-localnet/src/components/TopNav.tsx`

- [ ] **Step 1: Create `TopNav.tsx`**

```tsx
import { Button, Chip } from '@heroui/react'
import { LiveIndicator } from './LiveIndicator'

interface TopNavProps {
  party: string
  connected: boolean
  isCreating: boolean
  onCreate: () => void
}

export function TopNav({ party, connected, isCreating, onCreate }: TopNavProps) {
  return (
    <nav className="sticky top-0 z-30 border-b border-white/5 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-medium bg-gradient-to-br from-indigo-500/30 to-violet-500/30 text-lg">
            🔢
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">CantonKit Counter</p>
            <p className="text-tiny text-default-400">Localnet demo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Chip
            variant="flat"
            color="secondary"
            size="sm"
            classNames={{ content: 'font-mono text-xs' }}
          >
            {party}
          </Chip>
          <LiveIndicator connected={connected} />
          <Button
            color="primary"
            size="sm"
            isLoading={isCreating}
            onPress={onCreate}
            className="bg-gradient-to-br from-indigo-500 to-violet-500 font-medium"
          >
            New counter
          </Button>
        </div>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @cantonkit-examples/counter-app-localnet build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add examples/counter-app-localnet/src/components/TopNav.tsx
git commit -m "feat(counter-demo): TopNav with brand, party chip, live indicator"
```

---

## Task 5: `CounterCard` and `CountersGrid`

**Files:**
- Create: `examples/counter-app-localnet/src/components/CounterCard.tsx`
- Create: `examples/counter-app-localnet/src/components/CountersGrid.tsx`

- [ ] **Step 1: Create `CounterCard.tsx`**

```tsx
import { Button, Card, CardBody, Chip } from '@heroui/react'
import { motion } from 'framer-motion'
import { truncId } from '../lib/format'

interface CounterCardProps {
  contractId: string
  owner: string
  count: number
  isPending: boolean
  onIncrement: () => void
}

export function CounterCard({
  contractId,
  owner,
  count,
  isPending,
  onIncrement,
}: CounterCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <Card
        shadow="none"
        classNames={{
          base: 'border border-white/5 bg-content1/60 backdrop-blur hover:border-white/10 transition-colors',
        }}
      >
        <CardBody className="gap-5 p-6">
          <div className="flex items-start justify-between">
            <Chip
              size="sm"
              variant="flat"
              classNames={{ content: 'font-mono text-xs' }}
              title={contractId}
            >
              {truncId(contractId)}
            </Chip>
            <Chip size="sm" variant="dot" color="success">
              active
            </Chip>
          </div>

          <div className="flex flex-col items-start gap-1">
            <span className="text-xs uppercase tracking-wider text-default-400">
              count
            </span>
            <motion.span
              key={count}
              initial={{ scale: 0.92, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="text-5xl font-bold nums text-gradient-brand leading-none"
            >
              {count}
            </motion.span>
            <span
              className="mt-2 text-xs text-default-500 truncate max-w-full"
              title={owner}
            >
              owner · <span className="font-mono">{truncId(owner, 10, 6)}</span>
            </span>
          </div>

          <motion.div whileTap={{ scale: 0.96 }}>
            <Button
              fullWidth
              color="primary"
              variant="flat"
              isLoading={isPending}
              onPress={onIncrement}
              className="font-medium"
            >
              Increment +1
            </Button>
          </motion.div>
        </CardBody>
      </Card>
    </motion.div>
  )
}
```

- [ ] **Step 2: Create `CountersGrid.tsx`**

```tsx
import { Spinner } from '@heroui/react'
import { AnimatePresence } from 'framer-motion'
import { CounterCard } from './CounterCard'
import { EmptyState } from './EmptyState'

export interface CounterRow {
  contractId: string
  payload: { owner: string; count: number }
}

interface CountersGridProps {
  counters: CounterRow[] | undefined
  isLoading: boolean
  error: unknown
  isPending: boolean
  onIncrement: (contractId: string) => void
}

export function CountersGrid({
  counters,
  isLoading,
  error,
  isPending,
  onIncrement,
}: CountersGridProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading counters…" />
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

  if (!counters?.length) {
    return (
      <EmptyState
        icon={<span className="text-xl">🔢</span>}
        title="No counters yet"
        body="Click “New counter” in the top bar to create your first counter contract."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <AnimatePresence initial={false}>
        {counters.map((c) => (
          <CounterCard
            key={c.contractId}
            contractId={c.contractId}
            owner={c.payload.owner}
            count={c.payload.count}
            isPending={isPending}
            onIncrement={() => onIncrement(c.contractId)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @cantonkit-examples/counter-app-localnet build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add examples/counter-app-localnet/src/components/CounterCard.tsx examples/counter-app-localnet/src/components/CountersGrid.tsx
git commit -m "feat(counter-demo): spacious 2-col counter grid with animated cards"
```

---

## Task 6: `ActivityItem` and `ActivityFeed`

**Files:**
- Create: `examples/counter-app-localnet/src/components/ActivityItem.tsx`
- Create: `examples/counter-app-localnet/src/components/ActivityFeed.tsx`

The activity feed renders the same shape as the existing `stream.events` array used in `App.tsx` today: a discriminated union with `source: 'ledger' | 'wallet'`.

- [ ] **Step 1: Create `ActivityItem.tsx`**

```tsx
import { Chip, Code } from '@heroui/react'
import { formatRelative, truncId } from '../lib/format'

type LedgerSubEvent = {
  kind: 'created' | 'archived' | string
  contractId: string
  payload?: unknown
}

export type StreamEvent =
  | {
      source: 'ledger'
      updateId: string
      offset: number | string
      effectiveAt?: string
      events: LedgerSubEvent[]
    }
  | {
      source: 'wallet'
      updateId: string
      status: string
    }

interface ActivityItemProps {
  event: StreamEvent
  isLast: boolean
}

const dotColor: Record<string, string> = {
  created: 'bg-success',
  archived: 'bg-warning',
  ledger: 'bg-primary',
  wallet: 'bg-secondary',
}

export function ActivityItem({ event, isLast }: ActivityItemProps) {
  const topDot =
    event.source === 'ledger'
      ? dotColor[event.events[0]?.kind ?? 'ledger'] ?? 'bg-primary'
      : 'bg-secondary'

  return (
    <li className="relative pl-6">
      {!isLast && (
        <span className="absolute left-[7px] top-3 h-full w-px bg-default-200/50" />
      )}
      <span
        className={`absolute left-0 top-1.5 h-3 w-3 rounded-full ring-4 ring-background ${topDot}`}
      />
      {event.source === 'ledger' ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Chip size="sm" variant="flat" color="secondary">
              ledger
            </Chip>
            <Code size="sm">{truncId(event.updateId)}</Code>
            <Chip size="sm" variant="flat">
              offset {String(event.offset)}
            </Chip>
            <span className="text-tiny text-default-400">
              {formatRelative(event.effectiveAt)}
            </span>
          </div>
          <ul className="space-y-1">
            {event.events.map((ev, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <Chip
                  size="sm"
                  variant="flat"
                  color={ev.kind === 'created' ? 'success' : 'warning'}
                >
                  {ev.kind}
                </Chip>
                <Code size="sm">{truncId(ev.contractId)}</Code>
                {ev.kind === 'created' &&
                  ev.payload &&
                  typeof (ev.payload as { count?: unknown }).count ===
                    'number' && (
                    <span className="text-default-500 nums">
                      count = {(ev.payload as { count: number }).count}
                    </span>
                  )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Chip size="sm" variant="flat" color="warning">
            wallet
          </Chip>
          <Chip size="sm" variant="flat">
            {event.status}
          </Chip>
          <Code size="sm">{truncId(event.updateId)}</Code>
        </div>
      )}
    </li>
  )
}
```

- [ ] **Step 2: Create `ActivityFeed.tsx`**

```tsx
import { Card, CardBody, CardHeader, Divider } from '@heroui/react'
import { ActivityItem, type StreamEvent } from './ActivityItem'
import { EmptyState } from './EmptyState'

interface ActivityFeedProps {
  events: StreamEvent[]
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  return (
    <Card
      shadow="none"
      classNames={{
        base: 'border border-white/5 bg-content1/60 backdrop-blur sticky top-24',
      }}
    >
      <CardHeader className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h2 className="text-sm font-semibold">Live activity</h2>
          <p className="text-xs text-default-400">
            Streaming directly from the ledger
          </p>
        </div>
        <span className="text-xs text-default-500 nums">{events.length}</span>
      </CardHeader>
      <Divider className="bg-white/5" />
      <CardBody className="px-5 py-4 max-h-[70vh] overflow-y-auto">
        {events.length === 0 ? (
          <EmptyState
            icon={<span className="text-xl">⚡</span>}
            title="No activity yet"
            body="Transactions will appear here in real time."
          />
        ) : (
          <ul className="space-y-4">
            {events.map((e, i) => (
              <ActivityItem
                key={e.updateId}
                event={e}
                isLast={i === events.length - 1}
              />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @cantonkit-examples/counter-app-localnet build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add examples/counter-app-localnet/src/components/ActivityItem.tsx examples/counter-app-localnet/src/components/ActivityFeed.tsx
git commit -m "feat(counter-demo): timeline-style live activity feed"
```

---

## Task 7: `NoPartyState`

**Files:**
- Create: `examples/counter-app-localnet/src/components/NoPartyState.tsx`

- [ ] **Step 1: Create `NoPartyState.tsx`**

```tsx
import { Card, CardBody, Code } from '@heroui/react'

export function NoPartyState() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-6">
      <Card
        shadow="none"
        classNames={{
          base: 'w-full border border-white/5 bg-content1/60 backdrop-blur',
        }}
      >
        <CardBody className="gap-4 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-default-100/30 text-2xl">
            🔢
          </div>
          <h1 className="text-2xl font-semibold text-gradient-brand">
            CantonKit Counter
          </h1>
          <p className="text-sm text-default-500">
            No party configured. Set <Code size="sm">VITE_PARTY</Code> in your{' '}
            <Code size="sm">.env</Code> file and reload.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @cantonkit-examples/counter-app-localnet build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add examples/counter-app-localnet/src/components/NoPartyState.tsx
git commit -m "feat(counter-demo): NoPartyState landing card"
```

---

## Task 8: `CounterApp` orchestrator and slim `App.tsx`

**Files:**
- Create: `examples/counter-app-localnet/src/CounterApp.tsx`
- Modify: `examples/counter-app-localnet/src/App.tsx`

- [ ] **Step 1: Create `CounterApp.tsx`**

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
import { CountersGrid, type CounterRow } from './components/CountersGrid'
import { ActivityFeed } from './components/ActivityFeed'
import { NoPartyState } from './components/NoPartyState'
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
    filter: { templateIds: [COUNTER], parties: party ? [party] : [] },
  })

  if (!party) {
    return <NoPartyState />
  }

  const incrementCounter = (contractId: string) =>
    submit.mutate({
      commands: [
        {
          ExerciseCommand: {
            templateId: COUNTER,
            contractId,
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

  const rows: CounterRow[] | undefined = counters.data as CounterRow[] | undefined
  const totalCount = rows?.reduce((acc, r) => acc + (r.payload.count ?? 0), 0) ?? 0
  const events = stream.events as unknown as StreamEvent[]

  return (
    <>
      <TopNav
        party={party}
        connected={stream.isConnected}
        isCreating={submit.isPending}
        onCreate={createCounter}
      />
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <StatsStrip
          countersCount={rows?.length ?? 0}
          totalCount={totalCount}
          eventsCount={events.length}
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-base font-semibold">Counters</h2>
              <span className="text-xs text-default-400 nums">
                {rows?.length ?? 0} active
              </span>
            </div>
            <CountersGrid
              counters={rows}
              isLoading={counters.isLoading}
              error={counters.error}
              isPending={submit.isPending}
              onIncrement={incrementCounter}
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

- [ ] **Step 2: Replace `src/App.tsx` contents**

```tsx
/// <reference types="vite/client" />
import { LedgerProvider } from '@cantonkit/react'
import { CounterApp } from './CounterApp'

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

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @cantonkit-examples/counter-app-localnet build`
Expected: PASS.

- [ ] **Step 4: Manual smoke test in browser**

Open `http://localhost:5173/` (Vite HMR should reload).

Verify:
- TopNav renders with brand, party chip, "Live" indicator (green pulsing dot), and "New counter" button.
- StatsStrip shows three cards with gradient numbers.
- Counters area shows either spacious 2-col cards (if any) or "No counters yet" empty state.
- Activity feed shows timeline (if events) or "No activity yet" empty state.
- Clicking "New counter" creates a counter; it animates into the grid.
- Clicking "Increment +1" on a card bumps its count with a pop animation; a `created`/`archived` pair appears in the activity feed.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add examples/counter-app-localnet/src/CounterApp.tsx examples/counter-app-localnet/src/App.tsx
git commit -m "feat(counter-demo): wire new components in CounterApp; slim App.tsx"
```

---

## Task 9: Visual polish pass

**Files:**
- Modify (only if needed): any of the components from Tasks 2–8

- [ ] **Step 1: Browser visual review**

Use Chrome DevTools MCP at `http://localhost:5173/`:
- Take a full-page screenshot at 1440px width.
- Take a full-page screenshot at 375px width (mobile).

Check against the spec:
- Background gradient visible behind cards.
- Cards have subtle border + glass blur (not solid).
- Counter numbers use the indigo→violet gradient text.
- TopNav stays sticky on scroll.
- Activity feed is sticky on desktop (lg+) and stacks below grid on mobile.
- No horizontal scroll at 375px.

- [ ] **Step 2: Apply targeted fixes inline**

If anything in Step 1 fails the spec, edit the smallest component responsible and re-verify. Do not rewrite — adjust class names or props only.

- [ ] **Step 3: Final type-check + build**

Run: `pnpm --filter @cantonkit-examples/counter-app-localnet build`
Expected: PASS.

- [ ] **Step 4: Commit if changes were made**

```bash
git add examples/counter-app-localnet/src
git commit -m "polish(counter-demo): visual review fixes"
```

If no changes were needed in Step 2, skip the commit.

---

## Done criteria

- All 9 tasks committed.
- `pnpm --filter @cantonkit-examples/counter-app-localnet build` passes.
- Manual smoke test in Step 8.4 passes.
- Visual review in Step 9.1 passes.
- `src/App.tsx` is < 30 lines and only handles `LedgerProvider` wiring.
- No new dependencies added to `package.json`.
