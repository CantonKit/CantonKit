/// <reference types="vite/client" />
import {
  LedgerProvider,
  useContracts,
  useSubmit,
  useTransactionStream,
} from '@cantonkit/react'
import { templateId } from '@cantonkit/core'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Code,
  Divider,
  Spinner,
} from '@heroui/react'

const COUNTER = templateId('#counter:Counter:Counter')

interface Counter {
  owner: string
  count: number
}

function CounterApp() {
  const party = import.meta.env.VITE_PARTY as string | undefined

  const counters = useContracts<Counter>({
    templateId: COUNTER,
    parties: party ? [party] : [],
  })
  const submit = useSubmit()
  const stream = useTransactionStream({
    filter: { templateIds: [COUNTER], parties: party ? [party] : [] },
  })

  if (!party) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Card>
          <CardBody className="gap-3 p-8 text-center">
            <h1 className="text-2xl font-semibold">CantonKit Counter — Localnet</h1>
            <p className="text-default-500">
              No party configured. Set <Code size="sm">VITE_PARTY</Code> in your{' '}
              <Code size="sm">.env</Code> file.
            </p>
          </CardBody>
        </Card>
      </div>
    )
  }

  const incrementCounter = (contractId: string) =>
    submit.mutate({
      commands: [
        {
          ExerciseCommand: {
            templateId: COUNTER,
            contractId,
            choice: 'Increment',
            choiceArgument: {},
          },
        },
      ],
      actAs: [party],
    })

  const createCounter = () =>
    submit.mutate({
      commands: [
        {
          CreateCommand: {
            templateId: COUNTER,
            createArguments: { owner: party, count: 0 },
          },
        },
      ],
      actAs: [party],
    })

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            CantonKit Counter
          </h1>
          <p className="text-default-500">Localnet demo</p>
        </div>
        <div className="flex items-center gap-2">
          <Chip variant="flat" color="secondary">
            Party: {party}
          </Chip>
          <Chip
            variant="flat"
            color={stream.isConnected ? 'success' : 'danger'}
            startContent={
              <span
                className={`mx-1 h-2 w-2 rounded-full ${
                  stream.isConnected ? 'bg-success' : 'bg-danger'
                }`}
              />
            }
          >
            stream {stream.isConnected ? 'open' : 'closed'}
          </Chip>
        </div>
      </header>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Your counters</h2>
            <p className="text-sm text-default-500">
              {counters.data?.length ?? 0} active
            </p>
          </div>
          <Button
            color="primary"
            isLoading={submit.isPending}
            onPress={createCounter}
          >
            New counter
          </Button>
        </CardHeader>
        <Divider />
        <CardBody>
          {counters.isLoading && (
            <div className="flex justify-center p-6">
              <Spinner label="Loading counters…" />
            </div>
          )}
          {counters.error && (
            <p className="text-danger">Error: {String(counters.error)}</p>
          )}
          {!counters.isLoading && !counters.data?.length && (
            <p className="text-default-500 text-center py-6">
              No counters yet. Click <strong>New counter</strong> to create one.
            </p>
          )}
          <ul className="space-y-2">
            {counters.data?.map((c) => (
              <li
                key={c.contractId}
                className="flex items-center justify-between rounded-medium border border-default-200 bg-content2 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Code size="sm">{c.contractId.slice(0, 12)}…</Code>
                  <Chip variant="flat" color="primary" size="sm">
                    count {c.payload.count}
                  </Chip>
                </div>
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  isLoading={submit.isPending}
                  onPress={() => incrementCounter(c.contractId)}
                >
                  +1
                </Button>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <h2 className="text-lg font-semibold">Recent transactions</h2>
            <p className="text-sm text-default-500">
              Live stream from the ledger
            </p>
          </div>
        </CardHeader>
        <Divider />
        <CardBody>
          {!stream.events.length && (
            <p className="text-default-500 text-center py-6">
              No transactions yet.
            </p>
          )}
          <ul className="space-y-2">
            {stream.events.map((e) => (
              <li
                key={e.updateId}
                className="rounded-medium border border-default-200 bg-content2 px-4 py-3"
              >
                {e.source === 'ledger' ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Chip size="sm" variant="flat" color="secondary">
                        ledger
                      </Chip>
                      <Code size="sm">{e.updateId.slice(0, 12)}…</Code>
                      <Chip size="sm" variant="flat">
                        offset {e.offset}
                      </Chip>
                      <span className="text-tiny text-default-400">
                        {e.effectiveAt}
                      </span>
                    </div>
                    <ul className="space-y-1 pl-2">
                      {e.events.map((ev, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Chip
                            size="sm"
                            variant="flat"
                            color={ev.kind === 'created' ? 'success' : 'warning'}
                          >
                            {ev.kind}
                          </Chip>
                          <Code size="sm">{ev.contractId.slice(0, 12)}…</Code>
                          {ev.kind === 'created' && Boolean(ev.payload) && (
                            <span className="text-default-500">
                              count = {(ev.payload as Counter).count}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip size="sm" variant="flat" color="warning">
                      wallet
                    </Chip>
                    <Chip size="sm" variant="flat">
                      {e.status}
                    </Chip>
                    <Code size="sm">{e.updateId.slice(0, 12)}…</Code>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  )
}

export function App() {
  return (
    <LedgerProvider
      config={{
        ledgerUrl: import.meta.env.VITE_LEDGER_URL,
        party: import.meta.env.VITE_PARTY,
        auth: {
          mode: 'static',
          token: import.meta.env.VITE_TOKEN || undefined,
        },
      }}
    >
      <CounterApp />
    </LedgerProvider>
  )
}
