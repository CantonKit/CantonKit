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
