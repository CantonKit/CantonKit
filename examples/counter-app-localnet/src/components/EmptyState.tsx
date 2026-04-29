import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  body?: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-content2 text-default-400">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-default-600">{title}</p>
        {body && <p className="text-sm text-default-400 max-w-sm">{body}</p>}
      </div>
      {action}
    </div>
  )
}
