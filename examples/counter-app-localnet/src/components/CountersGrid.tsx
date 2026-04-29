import { Spinner } from '@heroui/react'
import { AnimatePresence } from 'framer-motion'
import { CounterCard } from './CounterCard'
import { CreateCounterTile } from './CreateCounterTile'

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
  onCreate: () => void
}

export function CountersGrid({
  counters,
  isLoading,
  error,
  isPending,
  onIncrement,
  onCreate,
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

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <AnimatePresence initial={false}>
        {counters?.map((c) => (
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
      <CreateCounterTile isPending={isPending} onPress={onCreate} />
    </div>
  )
}
