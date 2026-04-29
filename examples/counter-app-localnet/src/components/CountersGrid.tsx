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
