import { useState } from 'react'
import { motion } from 'framer-motion'

interface NodeBaseProps {
  variant: 'archived' | 'head'
  count: number
  contractId: string
}

interface PlaceholderProps {
  variant: 'placeholder'
  hiddenCount: number
  firstHiddenCount: number
  lastHiddenCount: number
  onClick?: () => void
}

export type ChainNodeProps = NodeBaseProps | PlaceholderProps

function shortId(id: string): string {
  if (id.length <= 9) return id
  return `${id.slice(0, 4)}…${id.slice(-4)}`
}

export function ChainNode(props: ChainNodeProps) {
  if (props.variant === 'placeholder') {
    const { hiddenCount, firstHiddenCount, lastHiddenCount, onClick } = props
    return (
      <motion.button
        type="button"
        onClick={onClick}
        whileTap={{ scale: 0.95 }}
        className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-large border border-dashed border-default-300/40 bg-content2/40 text-default-400 transition-colors hover:border-indigo-400/40 hover:text-default-200"
        aria-label={`Expand ${hiddenCount} hidden nodes`}
        title={`count ${firstHiddenCount} – ${lastHiddenCount} (${hiddenCount} hidden)`}
      >
        <span className="text-lg leading-none">…</span>
        <span className="text-[10px] leading-none text-default-500">
          +{hiddenCount}
        </span>
      </motion.button>
    )
  }

  const { variant, count, contractId } = props
  const isHead = variant === 'head'
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contractId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // Clipboard unavailable (e.g., insecure context); fail quietly.
    }
  }

  const sizeCls = isHead ? 'h-20 w-20 gap-1' : 'h-16 w-16 gap-0.5'
  const countCls = isHead ? 'text-2xl' : 'text-lg'
  const idCls = isHead ? 'text-[10px] text-white/70' : 'text-[9px] text-default-400/90'
  const styleCls = isHead
    ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-[0_0_20px_-4px_rgba(139,92,246,0.6)] ring-1 ring-white/20'
    : 'bg-content2/60 text-default-300 ring-1 ring-white/5 hover:ring-white/10'

  return (
    <motion.button
      type="button"
      onClick={handleCopy}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      whileTap={{ scale: 0.95 }}
      title={contractId}
      className={`flex shrink-0 flex-col items-center justify-center rounded-large font-semibold transition-all ${sizeCls} ${styleCls}`}
    >
      <span className={`nums leading-none ${countCls}`}>{count}</span>
      <span className={`font-mono leading-none ${idCls}`}>
        {copied ? '✓ copied' : shortId(contractId)}
      </span>
    </motion.button>
  )
}
