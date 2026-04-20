import { describe, it, expect } from 'vitest'
import { createFakeDappClient } from '../test/fakeDappClient.js'
import { viaLedgerApi } from '../transport/viaLedgerApi.js'
import { getTransactionById } from './getTransactionById.js'

describe('getTransactionById', () => {
  it('GETs /v2/updates/transaction-by-id/:id and returns a Transaction', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({
      ok: true,
      status: 200,
      body: {
        transaction: {
          updateId: 'u1',
          offset: '10',
          effectiveAt: '2026-04-20T00:00:00Z',
          events: [],
        },
      },
    })

    const transport = viaLedgerApi(fake as never)
    const tx = await getTransactionById(transport, 'u1')

    expect(tx.updateId).toBe('u1')
    expect(fake.__calls.ledgerApi[0]).toEqual({
      method: 'GET',
      url: '/v2/updates/transaction-by-id/u1',
    })
  })

  it('url-encodes the id', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({
      ok: true,
      status: 200,
      body: { transaction: { updateId: 'a/b', offset: '0', effectiveAt: '', events: [] } },
    })

    const transport = viaLedgerApi(fake as never)
    await getTransactionById(transport, 'a/b')
    expect(fake.__calls.ledgerApi[0]).toMatchObject({
      url: '/v2/updates/transaction-by-id/a%2Fb',
    })
  })
})
