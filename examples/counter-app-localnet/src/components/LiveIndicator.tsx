import { Chip } from '@heroui/react'

interface LiveIndicatorProps {
  connected: boolean
}

export function LiveIndicator({ connected }: LiveIndicatorProps) {
  return (
    <Chip
      variant="flat"
      color={connected ? 'success' : 'warning'}
      classNames={{ base: 'gap-1.5 pl-2 pr-3', content: 'text-xs font-medium' }}
      startContent={
        <span className="relative flex h-2 w-2">
          {connected && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              connected ? 'bg-success' : 'bg-warning'
            }`}
          />
        </span>
      }
    >
      {connected ? 'Live' : 'Reconnecting…'}
    </Chip>
  )
}
