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
