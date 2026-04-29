import { Chip, Code } from '@heroui/react'
import { formatRelative, truncId } from '../lib/format'

type LedgerSubEvent = {
  kind: 'created' | 'archived' | string
  contractId: string
  payload?: unknown
}

export type StreamEvent =
  | {
      source: 'ledger'
      updateId: string
      offset: number | string
      effectiveAt?: string
      events: LedgerSubEvent[]
    }
  | {
      source: 'wallet'
      updateId: string
      status: string
    }

interface ActivityItemProps {
  event: StreamEvent
  isLast: boolean
}

const dotColor: Record<string, string> = {
  created: 'bg-success',
  archived: 'bg-warning',
  ledger: 'bg-primary',
  wallet: 'bg-secondary',
}

export function ActivityItem({ event, isLast }: ActivityItemProps) {
  const topDot =
    event.source === 'ledger'
      ? dotColor[event.events[0]?.kind ?? 'ledger'] ?? 'bg-primary'
      : 'bg-secondary'

  return (
    <li className="relative pl-6">
      {!isLast && (
        <span className="absolute left-[7px] top-3 h-full w-px bg-default-200/50" />
      )}
      <span
        className={`absolute left-0 top-1.5 h-3 w-3 rounded-full ring-4 ring-background ${topDot}`}
      />
      {event.source === 'ledger' ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Chip size="sm" variant="flat" color="secondary">
              ledger
            </Chip>
            <Code size="sm">{truncId(event.updateId)}</Code>
            <Chip size="sm" variant="flat">
              offset {String(event.offset)}
            </Chip>
            <span className="text-tiny text-default-400">
              {formatRelative(event.effectiveAt)}
            </span>
          </div>
          <ul className="space-y-1">
            {event.events.map((ev, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <Chip
                  size="sm"
                  variant="flat"
                  color={ev.kind === 'created' ? 'success' : 'warning'}
                >
                  {ev.kind}
                </Chip>
                <Code size="sm">{truncId(ev.contractId)}</Code>
                {ev.kind === 'created' &&
                ev.payload &&
                typeof (ev.payload as { count?: unknown }).count === 'number' ? (
                  <span className="text-default-500 nums">
                    count = {(ev.payload as { count: number }).count}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Chip size="sm" variant="flat" color="warning">
            wallet
          </Chip>
          <Chip size="sm" variant="flat">
            {event.status}
          </Chip>
          <Code size="sm">{truncId(event.updateId)}</Code>
        </div>
      )}
    </li>
  )
}
