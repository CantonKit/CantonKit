/// <reference types="vite/client" />
import { useMemo, useRef } from 'react'
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

function useStableCounterOrder(
  rows: CounterRow[] | undefined,
  events: StreamEvent[],
): CounterRow[] | undefined {
  const orderRef = useRef<string[]>([])
  const seenEventsRef = useRef(0)

  return useMemo(() => {
    if (!rows) return rows

    // Walk new stream events: when a transaction archives one contract and
    // creates one in its place (an Increment), swap the id in our order list
    // so the counter keeps its slot instead of jumping to the end.
    const newEvents = events.slice(seenEventsRef.current)
    seenEventsRef.current = events.length
    for (const e of newEvents) {
      if (e.source !== 'ledger') continue
      const archived = e.events
        .filter((ev) => ev.kind === 'archived')
        .map((ev) => ev.contractId)
      const created = e.events
        .filter((ev) => ev.kind === 'created')
        .map((ev) => ev.contractId)
      if (archived.length === 1 && created.length === 1) {
        const idx = orderRef.current.indexOf(archived[0])
        if (idx >= 0) {
          orderRef.current[idx] = created[0]
        }
      }
    }

    // Reconcile order list with the current rows: drop missing ids, append new.
    const ids = new Set(rows.map((r) => r.contractId))
    orderRef.current = orderRef.current.filter((id) => ids.has(id))
    for (const r of rows) {
      if (!orderRef.current.includes(r.contractId)) {
        orderRef.current.push(r.contractId)
      }
    }

    const positions = new Map(orderRef.current.map((id, i) => [id, i]))
    return [...rows].sort(
      (a, b) =>
        (positions.get(a.contractId) ?? 0) - (positions.get(b.contractId) ?? 0),
    )
  }, [rows, events])
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

  const rows = counters.data as CounterRow[] | undefined
  const events = stream.events as unknown as StreamEvent[]
  const sortedRows = useStableCounterOrder(rows, events)

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

  const totalCount =
    sortedRows?.reduce((acc, r) => acc + (r.payload.count ?? 0), 0) ?? 0

  return (
    <>
      <TopNav party={party} connected={stream.isConnected} />
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <StatsStrip
          countersCount={sortedRows?.length ?? 0}
          totalCount={totalCount}
          eventsCount={events.length}
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-base font-semibold">Counters</h2>
              <span className="text-xs text-default-400 nums">
                {sortedRows?.length ?? 0} active
              </span>
            </div>
            <CountersGrid
              counters={sortedRows}
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
