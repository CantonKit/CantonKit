# Counter App Localnet — HeroUI Modern Redesign

## Goal

Polish the `examples/counter-app-localnet` demo into a modern, "Live Ledger Console" dashboard using the HeroUI components and `framer-motion` already installed. Behavior is unchanged; only presentation, structure, and motion improve.

## Non-goals

- No new routes, pages, or dependencies.
- No changes to `LedgerProvider`, `useContracts`, `useSubmit`, `useTransactionStream`, or any data shape.
- No light-mode toggle (demo stays dark).
- No new empty-state illustrations beyond HeroUI icons / inline SVG.

## Visual concept

Dark observability-style dashboard (Linear / Vercel / Stripe vibe).

- Background: `<main>` gets a subtle radial gradient (slate-950 → slate-900) plus a faint indigo glow at top-right.
- Surface: glass cards — `bg-content1/60 backdrop-blur border-white/5`.
- Accent: indigo → violet gradient on primary CTAs and stat headlines.
- Typography: `tabular-nums` for counts, `font-mono` for contract IDs in chips.
- Motion: framer-motion stagger fade-in for counter cards, layout animation on add, scale-tap on `+1`.

## Layout

```
┌─────────────────────────────────────────────────────┐
│  TopNav  🔢 CantonKit · party chip · live · [+ New] │
├─────────────────────────────────────────────────────┤
│  StatsStrip   [counters] [total count] [tx seen]    │
├──────────────────────────────┬──────────────────────┤
│  CountersGrid (2/3)          │  ActivityFeed (1/3)  │
│  ┌──────────┐  ┌──────────┐  │  • created  3s ago   │
│  │  count   │  │  count   │  │  │ contract abc12…  │
│  │   42     │  │    7     │  │  • archived  12s    │
│  │ owner…   │  │ owner…   │  │  • wallet pending   │
│  │  [+1]    │  │  [+1]    │  │                     │
│  └──────────┘  └──────────┘  │                     │
└──────────────────────────────┴──────────────────────┘
```

- Desktop: 12-col grid; counters span 8 cols, activity 4 cols.
- < lg: stacks; counters first, activity below.
- Counters grid: **2 columns on desktop** (spacious), 1 on mobile. Big count `text-5xl tabular-nums`.

## Component breakdown

All new components live in `src/components/` and are <150 lines each.

| File | Responsibility |
|---|---|
| `App.tsx` | Wires `LedgerProvider` (unchanged), renders `<CounterApp/>`. |
| `CounterApp.tsx` (split out of App.tsx) | Reads hooks, derives stats, lays out `TopNav` + `StatsStrip` + grid. Handles the no-`VITE_PARTY` case via `<NoPartyState/>`. |
| `components/TopNav.tsx` | Sticky `nav` with brand, `PartyChip`, `LiveIndicator`, "New counter" Button. |
| `components/LiveIndicator.tsx` | Pulsing-dot chip; "Live" / "Reconnecting…" based on `stream.isConnected`. |
| `components/StatsStrip.tsx` | 3 stat cards: counters count, sum of `count`, total events seen. |
| `components/StatCard.tsx` | Reusable: label, big gradient number, optional icon. |
| `components/CountersGrid.tsx` | Maps `counters.data` → `CounterCard`s; loading spinner; empty state. Uses `<AnimatePresence>` + `<motion.div layout>`. |
| `components/CounterCard.tsx` | Big count, contract id chip, `+1` Button (`framer-motion` `whileTap={{ scale: 0.95 }}`). |
| `components/ActivityFeed.tsx` | Timeline list of `stream.events`. Renders `ActivityItem` per event. Empty state inline. |
| `components/ActivityItem.tsx` | Vertical-line + colored dot, kind chip, contract id, relative time via tiny inline `formatRelative` helper. |
| `components/EmptyState.tsx` | Reusable empty box: icon + title + body + optional action. |

## Data flow

Unchanged. `CounterApp` calls the same three hooks and passes:

- `counters.data` → `CountersGrid`
- `submit.mutate` + `submit.isPending` → `CountersGrid` (and `TopNav` for "New counter")
- `stream.events`, `stream.isConnected` → `ActivityFeed` and `LiveIndicator`
- Derived stats (`countersCount`, `totalCount`, `eventsCount`) → `StatsStrip`

## Edge cases

- **No `VITE_PARTY`**: `<NoPartyState/>` — centered glass card, same copy as today, but with the new background and styling.
- **Loading counters**: HeroUI `Spinner` inside the counters card; grid hidden until resolved.
- **Counters error**: red banner above the grid (HeroUI `Card` with `border-danger/40`).
- **Empty counters / empty activity**: each gets an `EmptyState` with subtle icon and friendly copy.
- **Long contract IDs**: truncated to first 12 chars + `…`, full id available via `title` attribute (tooltip-lite).
- **Stream reconnecting**: indicator shows "Reconnecting…" with amber dot.
- **Submit pending**: both "New counter" and the per-card `+1` use `isLoading` on HeroUI Button.

## Files touched

- **Modified**: `src/App.tsx`, `src/index.css` (add gradient body, tabular-nums utility), `src/main.tsx` (no change expected; verify only).
- **New**: 10 files under `src/components/`.
- **Tailwind**: no config change; HeroUI tokens are already wired.

## Verification

1. `pnpm --filter @cantonkit-examples/counter-app-localnet build` — type check + Vite build clean.
2. Manual via Chrome DevTools MCP at `http://localhost:5173/`:
   - With `VITE_PARTY` unset → no-party card renders.
   - With party set → top nav + stats + empty grid + empty activity render.
   - Click "New counter" → counter card animates in, count = 0.
   - Click `+1` → count increments, activity feed gets a `created`/`archived` pair.
   - Throttle network → live indicator flips to "Reconnecting…".
3. Resize to 375px width → layout collapses cleanly, no horizontal scroll.

## Out of scope (future)

- Per-counter detail drawer.
- Searching / filtering counters.
- Light-mode toggle.
- Persistent per-counter color avatars.
