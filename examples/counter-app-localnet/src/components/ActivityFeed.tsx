import { Card, CardBody, CardHeader, Divider } from '@heroui/react'
import { ActivityItem, type StreamEvent } from './ActivityItem'
import { EmptyState } from './EmptyState'

interface ActivityFeedProps {
  events: StreamEvent[]
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  return (
    <Card
      shadow="none"
      classNames={{
        base: 'border border-white/5 bg-content1/60 backdrop-blur sticky top-24',
      }}
    >
      <CardHeader className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h2 className="text-sm font-semibold">Live activity</h2>
          <p className="text-xs text-default-400">
            Streaming directly from the ledger
          </p>
        </div>
        <span className="text-xs text-default-500 nums">{events.length}</span>
      </CardHeader>
      <Divider className="bg-white/5" />
      <CardBody className="px-5 py-4 max-h-[70vh] overflow-y-auto">
        {events.length === 0 ? (
          <EmptyState
            icon={<span className="text-xl">⚡</span>}
            title="No activity yet"
            body="Transactions will appear here in real time."
          />
        ) : (
          <ul className="space-y-4">
            {events.map((e, i) => (
              <ActivityItem
                key={e.updateId}
                event={e}
                isLast={i === events.length - 1}
              />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
