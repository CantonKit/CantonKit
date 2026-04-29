import { StatCard } from './StatCard'

interface StatsStripProps {
  chainsCount: number
  totalCount: number
  eventsCount: number
}

export function StatsStrip({
  chainsCount,
  totalCount,
  eventsCount,
}: StatsStripProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label="Chains"
        value={chainsCount}
        hint="active lineages"
        icon={<span className="text-xl">🔗</span>}
      />
      <StatCard
        label="Total count"
        value={totalCount}
        hint="sum across heads"
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
