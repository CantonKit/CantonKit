import { Card, CardBody, Code } from '@heroui/react'

export function NoPartyState() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-6">
      <Card
        shadow="none"
        classNames={{
          base: 'w-full border border-white/5 bg-content1/60 backdrop-blur',
        }}
      >
        <CardBody className="gap-4 p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-default-100/30 text-2xl">
            🔢
          </div>
          <h1 className="text-2xl font-semibold text-gradient-brand">
            CantonKit Counter
          </h1>
          <p className="text-sm text-default-500">
            No party configured. Set <Code size="sm">VITE_PARTY</Code> in your{' '}
            <Code size="sm">.env</Code> file and reload.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
