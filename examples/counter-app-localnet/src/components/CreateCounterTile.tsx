import { motion } from 'framer-motion'
import { Spinner } from '@heroui/react'

interface CreateCounterTileProps {
  isPending: boolean
  onPress: () => void
}

export function CreateCounterTile({ isPending, onPress }: CreateCounterTileProps) {
  return (
    <motion.button
      type="button"
      onClick={onPress}
      disabled={isPending}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="group flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-large border border-dashed border-white/10 bg-content1/30 p-6 text-default-400 backdrop-blur transition-colors hover:border-indigo-400/40 hover:bg-content1/50 hover:text-default-200 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? (
        <Spinner size="sm" />
      ) : (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-2xl text-default-300 transition-transform group-hover:scale-105">
          +
        </span>
      )}
      <span className="text-sm font-medium">
        {isPending ? 'Creating…' : 'New counter'}
      </span>
      <span className="text-xs text-default-500">
        Create a new Counter contract
      </span>
    </motion.button>
  )
}
