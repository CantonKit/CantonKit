import { motion } from 'framer-motion'
import { Spinner } from '@heroui/react'

interface StartChainTileProps {
  isPending: boolean
  onPress: () => void
  size?: 'default' | 'large'
}

export function StartChainTile({
  isPending,
  onPress,
  size = 'default',
}: StartChainTileProps) {
  const isLarge = size === 'large'
  return (
    <motion.button
      type="button"
      onClick={onPress}
      disabled={isPending}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`group flex w-full flex-col items-center justify-center gap-3 rounded-large border border-dashed border-white/10 bg-content1/30 backdrop-blur transition-colors hover:border-indigo-400/40 hover:bg-content1/50 hover:text-default-200 disabled:cursor-not-allowed disabled:opacity-60 ${
        isLarge ? 'min-h-[260px] p-10 text-default-300' : 'min-h-[120px] p-6 text-default-400'
      }`}
    >
      {isPending ? (
        <Spinner size="sm" />
      ) : (
        <span
          className={`flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 text-default-300 transition-transform group-hover:scale-105 ${
            isLarge ? 'h-14 w-14 text-3xl' : 'h-10 w-10 text-xl'
          }`}
        >
          +
        </span>
      )}
      <span className={`font-medium ${isLarge ? 'text-base' : 'text-sm'}`}>
        {isPending
          ? 'Creating…'
          : isLarge
            ? 'Start your first chain'
            : 'Start a new chain'}
      </span>
      <span className="text-xs text-default-500">
        Create a fresh Counter contract
      </span>
    </motion.button>
  )
}
