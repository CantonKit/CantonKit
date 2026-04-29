import { Tooltip } from '@heroui/react'
import { motion } from 'framer-motion'
import { truncId } from '../lib/format'

interface CommonProps {
  onClick?: () => void
}

interface NodeProps extends CommonProps {
  variant: 'archived' | 'head'
  count: number
  contractId: string
}

interface PlaceholderProps extends CommonProps {
  variant: 'placeholder'
  hiddenCount: number
  firstHiddenCount: number
  lastHiddenCount: number
}

export type ChainNodeProps = NodeProps | PlaceholderProps

export function ChainNode(props: ChainNodeProps) {
  if (props.variant === 'placeholder') {
    const { hiddenCount, firstHiddenCount, lastHiddenCount, onClick } = props
    return (
      <Tooltip
        content={`count ${firstHiddenCount} – ${lastHiddenCount} (${hiddenCount} nodes hidden) — click to expand`}
        placement="top"
      >
        <motion.button
          type="button"
          onClick={onClick}
          whileTap={{ scale: 0.95 }}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-large border border-dashed border-default-300/40 bg-content2/40 text-default-400 transition-colors hover:border-indigo-400/40 hover:text-default-200"
          aria-label={`Expand ${hiddenCount} hidden nodes`}
        >
          …
        </motion.button>
      </Tooltip>
    )
  }

  const { variant, count, contractId } = props
  const isHead = variant === 'head'
  const sizeCls = isHead ? 'h-16 w-16 text-2xl' : 'h-14 w-14 text-lg'
  const styleCls = isHead
    ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-[0_0_20px_-4px_rgba(139,92,246,0.6)] ring-1 ring-white/20'
    : 'bg-content2/60 text-default-300 ring-1 ring-white/5'

  return (
    <Tooltip content={contractId} placement="top">
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className={`flex shrink-0 items-center justify-center rounded-large font-semibold nums ${sizeCls} ${styleCls}`}
        title={truncId(contractId)}
      >
        {count}
      </motion.div>
    </Tooltip>
  )
}
