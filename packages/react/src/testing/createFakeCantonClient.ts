import type { CantonClient } from '@cantonkit/core'

export interface FakeCantonClient extends CantonClient {
  __emitTx: (event: unknown) => void
}

type Overrides = Partial<{
  [K in keyof CantonClient]: CantonClient[K]
}>

/**
 * Minimal in-memory CantonClient fake for hook tests.
 * Consumers inject overrides per test to script behavior.
 */
export function createFakeCantonClient(overrides: Overrides = {}): FakeCantonClient {
  const listeners = new Set<(e: unknown) => void>()

  const base: CantonClient = {
    async queryACS() {
      return []
    },
    async getTransactionById() {
      throw new Error('not implemented in fake')
    },
    async submit() {
      return null
    },
    async submitAndWait() {
      return { updateId: 'fake-u', commandId: 'fake-c', completionOffset: '0' }
    },
    subscribeToTransactions(opts) {
      const listener = (e: unknown) => opts.onEvent?.(e as never)
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    ledger: async () => ({ ok: true, status: 200, body: {} }) as never,
    destroy() {
      listeners.clear()
    },
  }

  return Object.assign({}, base, overrides, {
    __emitTx(event: unknown) {
      listeners.forEach((l) => l(event))
    },
  })
}
