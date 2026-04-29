import { Button, Card, CardBody, Chip } from '@heroui/react'
import { motion } from 'framer-motion'
import { truncId } from '../lib/format'

interface CounterCardProps {
  contractId: string
  owner: string
  count: number
  isPending: boolean
  onIncrement: () => void
}

export function CounterCard({
  contractId,
  owner,
  count,
  isPending,
  onIncrement,
}: CounterCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <Card
        shadow="none"
        classNames={{
          base: 'border border-white/5 bg-content1/60 backdrop-blur hover:border-white/10 transition-colors',
        }}
      >
        <CardBody className="gap-5 p-6">
          <div className="flex items-start justify-between">
            <Chip
              size="sm"
              variant="flat"
              classNames={{ content: 'font-mono text-xs' }}
              title={contractId}
            >
              {truncId(contractId)}
            </Chip>
            <Chip size="sm" variant="dot" color="success">
              active
            </Chip>
          </div>

          <div className="flex flex-col items-start gap-1">
            <span className="text-xs uppercase tracking-wider text-default-400">
              count
            </span>
            <motion.span
              key={count}
              initial={{ scale: 0.92, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="text-5xl font-bold nums text-gradient-brand leading-none"
            >
              {count}
            </motion.span>
            <span
              className="mt-2 text-xs text-default-500 truncate max-w-full"
              title={owner}
            >
              owner · <span className="font-mono">{truncId(owner, 10, 6)}</span>
            </span>
          </div>

          <motion.div whileTap={{ scale: 0.96 }}>
            <Button
              fullWidth
              color="primary"
              variant="flat"
              isLoading={isPending}
              onPress={onIncrement}
              className="font-medium"
            >
              Increment +1
            </Button>
          </motion.div>
        </CardBody>
      </Card>
    </motion.div>
  )
}
