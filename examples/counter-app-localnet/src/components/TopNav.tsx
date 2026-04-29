import { Chip } from '@heroui/react'
import { LiveIndicator } from './LiveIndicator'

interface TopNavProps {
  party: string
  connected: boolean
}

export function TopNav({ party, connected }: TopNavProps) {
  return (
    <nav className="sticky top-0 z-30 border-b border-white/5 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-medium bg-gradient-to-br from-indigo-500/30 to-violet-500/30 text-lg">
            🔢
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">CantonKit Counter</p>
            <p className="text-tiny text-default-400">Localnet demo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Chip
            variant="flat"
            color="secondary"
            size="sm"
            classNames={{ content: 'font-mono text-xs' }}
          >
            {party}
          </Chip>
          <LiveIndicator connected={connected} />
        </div>
      </div>
    </nav>
  )
}
