import { describe, it, expect, vi } from 'vitest'
import { createFakeDappClient } from './fakeDappClient.js'

describe('createFakeDappClient', () => {
  it('records ledgerApi calls and returns queued responses', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({ ok: true, body: { data: 'hello' } })

    const result = await fake.ledgerApi({ method: 'GET', url: '/v2/health' })

    expect(result).toEqual({ ok: true, body: { data: 'hello' } })
    expect(fake.__calls.ledgerApi).toHaveLength(1)
    expect(fake.__calls.ledgerApi[0]).toEqual({ method: 'GET', url: '/v2/health' })
  })

  it('throws when ledgerApi called with no queued response', async () => {
    const fake = createFakeDappClient()
    await expect(fake.ledgerApi({ method: 'GET', url: '/v2/x' })).rejects.toThrow(
      /no queued response/
    )
  })

  it('drives onTxChanged listeners via emitTx', () => {
    const fake = createFakeDappClient()
    const listener = vi.fn()
    const unsub = fake.onTxChanged(listener)

    fake.__emitTx({ updateId: 'u1' })
    expect(listener).toHaveBeenCalledWith({ updateId: 'u1' })

    unsub()
    fake.__emitTx({ updateId: 'u2' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('drives status and accounts listeners', () => {
    const fake = createFakeDappClient()
    const statusListener = vi.fn()
    const accountsListener = vi.fn()
    fake.onStatusChanged(statusListener)
    fake.onAccountsChanged(accountsListener)

    fake.__emitStatus({ connection: { isConnected: true } })
    fake.__emitAccounts({ accounts: [{ partyId: 'Alice' }] })

    expect(statusListener).toHaveBeenCalledOnce()
    expect(accountsListener).toHaveBeenCalledOnce()
  })

  it('queues prepareExecuteAndWait results and failures', async () => {
    const fake = createFakeDappClient()
    fake.__queue.prepareExecuteAndWait.push({
      kind: 'ok',
      value: { updateId: 'u1', commandId: 'c1', completionOffset: '0' },
    })
    fake.__queue.prepareExecuteAndWait.push({ kind: 'err', error: new Error('rejected') })

    const ok = await fake.prepareExecuteAndWait({ commands: [], actAs: [] })
    expect(ok.updateId).toBe('u1')

    await expect(fake.prepareExecuteAndWait({ commands: [], actAs: [] })).rejects.toThrow(
      'rejected'
    )
  })
})
