import { describe, it, expect, vi } from 'vitest'
import { createFakeDappClient } from './test/fakeDappClient.js'
import { createCantonClient } from './client.js'
import { templateId } from './types/commands.js'

describe('createCantonClient', () => {
  it('wires queryACS through the dappClient ledgerApi', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({ ok: true, status: 200, body: { activeContracts: [] } })
    const client = createCantonClient({ dappClient: fake as never })
    const contracts = await client.queryACS({
      templateId: templateId('#A:M:T'),
      parties: ['Alice'],
    })
    expect(contracts).toEqual([])
    expect(fake.__calls.ledgerApi[0]).toMatchObject({ url: '/v2/state/active-contracts' })
  })

  it('wires submitAndWait through prepareExecuteAndWait', async () => {
    const fake = createFakeDappClient()
    fake.__queue.prepareExecuteAndWait.push({
      kind: 'ok',
      value: { updateId: 'u1', commandId: 'c1', completionOffset: '0' },
    })
    const client = createCantonClient({ dappClient: fake as never })
    const result = await client.submitAndWait({ commands: [], actAs: ['A'] })
    expect(result.updateId).toBe('u1')
  })

  it('wires subscribeToTransactions wallet source through onTxChanged', () => {
    const fake = createFakeDappClient()
    const client = createCantonClient({ dappClient: fake as never })
    const onEvent = vi.fn()
    const unsub = client.subscribeToTransactions({ onEvent })
    fake.__emitTx({ updateId: 'u1' })
    expect(onEvent).toHaveBeenCalledOnce()
    unsub()
  })

  it('subscribeToTransactions source=ledger throws without ledgerUrl', () => {
    const fake = createFakeDappClient()
    const client = createCantonClient({ dappClient: fake as never })
    expect(() =>
      client.subscribeToTransactions({ source: 'ledger', onEvent: () => undefined })
    ).toThrow(/source=ledger/)
  })

  it('destroy tears down wallet listeners', () => {
    const fake = createFakeDappClient()
    const client = createCantonClient({ dappClient: fake as never })
    const onEvent = vi.fn()
    client.subscribeToTransactions({ onEvent })
    client.destroy()
    fake.__emitTx({ updateId: 'x' })
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('ledger escape hatch calls through to dappClient.ledgerApi', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({ ok: true, status: 200, body: { foo: 'bar' } })
    const client = createCantonClient({ dappClient: fake as never })
    const raw = (await client.ledger({ method: 'GET', url: '/v2/anything' } as never)) as {
      body: unknown
    }
    expect(raw.body).toEqual({ foo: 'bar' })
  })
})
