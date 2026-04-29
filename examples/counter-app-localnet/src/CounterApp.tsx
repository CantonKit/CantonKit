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
