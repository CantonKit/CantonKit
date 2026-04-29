import { StatCard } from './StatCard'

interface StatsStripProps {
  countersCount: number
  totalCount: number
  eventsCount: number
}

export function StatsStrip({ countersCount, totalCount, eventsCount }: StatsStripProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label="Counters"
        value={countersCount}
        hint="active contracts"
        icon={<span className="text-xl">🔢</span>}
      />
      <StatCard
        label="Total count"
        value={totalCount}
        hint="sum across counters"
        icon={<span className="text-xl">∑</span>}
      />
      <StatCard
        label="Events"
        value={eventsCount}
        hint="seen this session"
        icon={<span className="text-xl">⚡</span>}
      />
    </div>
  )
}
