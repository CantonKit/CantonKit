import { Card, CardBody } from '@heroui/react'
import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
}

export function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <Card
      shadow="none"
      classNames={{
        base: 'border border-white/5 bg-content1/60 backdrop-blur',
      }}
    >
      <CardBody className="flex flex-row items-center justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-default-400">
            {label}
          </p>
          <p className="text-3xl font-semibold nums text-gradient-brand">
            {value}
          </p>
          {hint && <p className="text-xs text-default-500">{hint}</p>}
        </div>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-medium bg-default-100/30 text-default-400">
            {icon}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
