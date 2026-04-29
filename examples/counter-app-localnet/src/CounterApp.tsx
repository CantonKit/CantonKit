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
): CounterRow[] | undefined {
  const orderRef = useRef<string[]>([])
  const prevIdsRef = useRef<string[]>([])

  return useMemo(() => {
    if (!rows) return rows

    const currIds = rows.map((r) => r.contractId)
    const prevIds = prevIdsRef.current
    const currSet = new Set(currIds)
    const prevSet = new Set(prevIds)
    const disappeared = prevIds.filter((id) => !currSet.has(id))
    const appeared = currIds.filter((id) => !prevSet.has(id))

    // Increment archives the old contract and creates a new one. If exactly
    // one id disappeared and one appeared, treat it as a swap and keep the
    // new contract in the old contract's slot.
    if (disappeared.length === 1 && appeared.length === 1) {
      const idx = orderRef.current.indexOf(disappeared[0])
      if (idx >= 0) {
        orderRef.current[idx] = appeared[0]
      }
    }

    // Reconcile: drop ids not in current rows, append truly new ones.
    orderRef.current = orderRef.current.filter((id) => currSet.has(id))
    for (const id of currIds) {
      if (!orderRef.current.includes(id)) orderRef.current.push(id)
    }

    prevIdsRef.current = currIds

    const positions = new Map(orderRef.current.map((id, i) => [id, i]))
    return [...rows].sort(
      (a, b) =>
        (positions.get(a.contractId) ?? 0) - (positions.get(b.contractId) ?? 0),
    )
  }, [rows])
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
  const sortedRows = useStableCounterOrder(rows)

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
