import { useEffect, useRef, useState } from 'react'
import { Button, Card, CardBody, Chip } from '@heroui/react'
import { motion } from 'framer-motion'
import { ChainNode } from './ChainNode'
import { ChainConnector } from './ChainConnector'
import { truncId } from '../lib/format'
import type { Chain } from '../hooks/useChains'

const COLLAPSE_THRESHOLD = 12
const VISIBLE_HEAD = 4
const VISIBLE_TAIL = 6

interface ChainViewProps {
  chain: Chain
  index: number
  isPending: boolean
  onIncrement: (headId: string) => void
}

export function ChainView({
  chain,
  index,
  isPending,
  onIncrement,
}: ChainViewProps) {
  const [expanded, setExpanded] = useState(false)
  const stripRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll the chain strip to the right edge whenever the head changes
  // or the user toggles expansion (so the +1 button stays in view).
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
  }, [chain.headId, expanded])

  const total = chain.nodes.length
  const shouldCollapse = !expanded && total > COLLAPSE_THRESHOLD

  const renderItems: Array<
    | { kind: 'node'; node: Chain['nodes'][number]; isHead: boolean }
    | {
        kind: 'placeholder'
        hiddenCount: number
        firstHiddenCount: number
        lastHiddenCount: number
      }
  > = []

  if (shouldCollapse) {
    const headNodes = chain.nodes.slice(0, VISIBLE_HEAD)
    const tailNodes = chain.nodes.slice(total - VISIBLE_TAIL)
    const hidden = chain.nodes.slice(VISIBLE_HEAD, total - VISIBLE_TAIL)
    for (const node of headNodes) {
      renderItems.push({
        kind: 'node',
        node,
        isHead: node.contractId === chain.headId,
      })
    }
    renderItems.push({
      kind: 'placeholder',
      hiddenCount: hidden.length,
      firstHiddenCount: hidden[0].count,
      lastHiddenCount: hidden[hidden.length - 1].count,
    })
    for (const node of tailNodes) {
      renderItems.push({
        kind: 'node',
        node,
        isHead: node.contractId === chain.headId,
      })
    }
  } else {
    for (const node of chain.nodes) {
      renderItems.push({
        kind: 'node',
        node,
        isHead: node.contractId === chain.headId,
      })
    }
  }

  return (
    <Card
      shadow="none"
      classNames={{
        base: 'border border-white/5 bg-content1/60 backdrop-blur',
      }}
    >
      <CardBody className="gap-3 p-5">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Chain {index + 1}</span>
            <Chip
              size="sm"
              variant="flat"
              classNames={{ content: 'font-mono text-xs' }}
              title={chain.rootId}
            >
              root {truncId(chain.rootId)}
            </Chip>
            <span className="text-xs text-default-400 nums">
              {total} {total === 1 ? 'node' : 'nodes'}
            </span>
            {chain.partial && (
              <Chip size="sm" variant="flat" color="warning">
                partial
              </Chip>
            )}
          </div>
          {expanded && total > COLLAPSE_THRESHOLD && (
            <Button
              size="sm"
              variant="flat"
              onPress={() => setExpanded(false)}
              className="h-7 px-3 text-xs"
            >
              Collapse
            </Button>
          )}
        </header>

        <div
          ref={stripRef}
          className="flex items-center gap-0 overflow-x-auto pb-2"
          style={{ scrollSnapType: 'x proximity' }}
        >
          {chain.partial && (
            <span
              aria-hidden="true"
              className="mr-2 shrink-0 select-none text-default-400"
            >
              …
            </span>
          )}
          {renderItems.map((item, i) => {
            const isLast = i === renderItems.length - 1
            return (
              <span
                key={
                  item.kind === 'node'
                    ? item.node.contractId
                    : `placeholder-${i}`
                }
                className="flex items-center"
              >
                {item.kind === 'node' ? (
                  <ChainNode
                    variant={item.isHead ? 'head' : 'archived'}
                    count={item.node.count}
                    contractId={item.node.contractId}
                  />
                ) : (
                  <ChainNode
                    variant="placeholder"
                    hiddenCount={item.hiddenCount}
                    firstHiddenCount={item.firstHiddenCount}
                    lastHiddenCount={item.lastHiddenCount}
                    onClick={() => setExpanded(true)}
                  />
                )}
                {!isLast && (
                  <ChainConnector
                    variant={
                      item.kind === 'node' && item.isHead ? 'brand' : 'default'
                    }
                  />
                )}
              </span>
            )
          })}

          <ChainConnector variant="brand" />
          <motion.button
            type="button"
            onClick={() => onIncrement(chain.headId)}
            disabled={isPending}
            whileTap={{ scale: 0.95 }}
            className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-large bg-gradient-to-br from-indigo-500 to-violet-500 font-semibold text-white shadow-[0_0_20px_-4px_rgba(139,92,246,0.6)] ring-1 ring-white/20 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Increment counter"
          >
            <span className="text-2xl leading-none nums">+1</span>
            <span className="text-[10px] leading-none text-white/70">
              {isPending ? 'sending…' : 'increment'}
            </span>
          </motion.button>
        </div>
      </CardBody>
    </Card>
  )
}
