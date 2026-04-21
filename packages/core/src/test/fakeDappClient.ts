/**
 * Minimal fake of @canton-network/dapp-sdk's DappClient surface that we use.
 * Shared by core tests AND re-exported to @cantonkit/react/testing so React
 * tests can drive the same seams.
 *
 * Fields prefixed with `__` are test-only knobs; production code must not
 * touch them (the real DappClient doesn't have them).
 */

type QueuedResult<T> = { kind: 'ok'; value: T } | { kind: 'err'; error: unknown }

export interface FakeDappClient {
  ledgerApi(params: unknown): Promise<unknown>
  prepareExecute(params: unknown): Promise<null>
  prepareExecuteAndWait(params: unknown): Promise<{
    updateId: string
    commandId: string
    completionOffset: string
  }>
  listAccounts(): Promise<Array<{ partyId: string }>>
  connect(): Promise<{ isConnected: boolean }>
  disconnect(): Promise<void>
  status(): Promise<{ connection: { isConnected: boolean } }>
  onTxChanged(listener: (e: unknown) => void): void
  onStatusChanged(listener: (e: unknown) => void): void
  onAccountsChanged(listener: (e: unknown) => void): void
  removeOnTxChanged(listener: (e: unknown) => void): void
  removeOnStatusChanged(listener: (e: unknown) => void): void
  removeOnAccountsChanged(listener: (e: unknown) => void): void

  __queue: {
    ledgerApi: unknown[]
    prepareExecute: QueuedResult<null>[]
    prepareExecuteAndWait: QueuedResult<{
      updateId: string
      commandId: string
      completionOffset: string
    }>[]
    listAccounts: Array<Array<{ partyId: string }>>
    connect: QueuedResult<{ isConnected: boolean }>[]
  }
  __calls: {
    ledgerApi: unknown[]
    prepareExecute: unknown[]
    prepareExecuteAndWait: unknown[]
    listAccounts: number
    connect: number
    disconnect: number
  }
  __emitTx(event: unknown): void
  __emitStatus(event: unknown): void
  __emitAccounts(event: unknown): void
}

export function createFakeDappClient(): FakeDappClient {
  const txListeners = new Set<(e: unknown) => void>()
  const statusListeners = new Set<(e: unknown) => void>()
  const accountsListeners = new Set<(e: unknown) => void>()

  const queue: FakeDappClient['__queue'] = {
    ledgerApi: [],
    prepareExecute: [],
    prepareExecuteAndWait: [],
    listAccounts: [],
    connect: [],
  }
  const calls: FakeDappClient['__calls'] = {
    ledgerApi: [],
    prepareExecute: [],
    prepareExecuteAndWait: [],
    listAccounts: 0,
    connect: 0,
    disconnect: 0,
  }

  function takeQueuedResult<T>(list: QueuedResult<T>[], label: string): T {
    const next = list.shift()
    if (!next) throw new Error(`no queued response for ${label}`)
    if (next.kind === 'err') throw next.error
    return next.value
  }

  return {
    async ledgerApi(params) {
      calls.ledgerApi.push(params)
      const next = queue.ledgerApi.shift()
      if (next === undefined) throw new Error('no queued response for ledgerApi')
      return next
    },
    async prepareExecute(params) {
      calls.prepareExecute.push(params)
      return takeQueuedResult(queue.prepareExecute, 'prepareExecute')
    },
    async prepareExecuteAndWait(params) {
      calls.prepareExecuteAndWait.push(params)
      return takeQueuedResult(queue.prepareExecuteAndWait, 'prepareExecuteAndWait')
    },
    async listAccounts() {
      calls.listAccounts++
      const next = queue.listAccounts.shift()
      return next ?? []
    },
    async connect() {
      calls.connect++
      return takeQueuedResult(queue.connect, 'connect')
    },
    async disconnect() {
      calls.disconnect++
    },
    async status() {
      return { connection: { isConnected: false } }
    },
    onTxChanged(listener) {
      txListeners.add(listener)
    },
    onStatusChanged(listener) {
      statusListeners.add(listener)
    },
    onAccountsChanged(listener) {
      accountsListeners.add(listener)
    },
    removeOnTxChanged(listener) {
      txListeners.delete(listener)
    },
    removeOnStatusChanged(listener) {
      statusListeners.delete(listener)
    },
    removeOnAccountsChanged(listener) {
      accountsListeners.delete(listener)
    },
    __queue: queue,
    __calls: calls,
    __emitTx(event) {
      txListeners.forEach((l) => l(event))
    },
    __emitStatus(event) {
      statusListeners.forEach((l) => l(event))
    },
    __emitAccounts(event) {
      accountsListeners.forEach((l) => l(event))
    },
  }
}
