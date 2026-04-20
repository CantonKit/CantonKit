import { describe, it, expect } from 'vitest'
import { createFakeDappClient } from '../test/fakeDappClient.js'
import { CantonError } from '../error.js'
import { viaLedgerApi } from './viaLedgerApi.js'

describe('viaLedgerApi', () => {
  it('POSTs and returns the response body', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({ ok: true, status: 200, body: { hello: 'world' } })

    const transport = viaLedgerApi(fake as never)
    const result = await transport.post<{ hello: string }>('/v2/foo', { bar: 1 })

    expect(result).toEqual({ hello: 'world' })
    expect(fake.__calls.ledgerApi[0]).toEqual({
      method: 'POST',
      url: '/v2/foo',
      body: { bar: 1 },
    })
  })

  it('GETs with path parameters substituted', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({ ok: true, status: 200, body: { id: 'u1' } })

    const transport = viaLedgerApi(fake as never)
    await transport.get<{ id: string }>('/v2/updates/transaction-by-id/:id', { id: 'u1' })

    expect(fake.__calls.ledgerApi[0]).toEqual({
      method: 'GET',
      url: '/v2/updates/transaction-by-id/u1',
    })
  })

  it('throws LEDGER_HTTP on non-ok response with status preserved', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({
      ok: false,
      status: 500,
      body: { error: 'boom' },
    })

    const transport = viaLedgerApi(fake as never)
    await expect(transport.post('/v2/foo', {})).rejects.toMatchObject({
      name: 'CantonError',
      code: 'LEDGER_HTTP',
      status: 500,
    })
  })

  it('wraps dapp-sdk network errors as UNKNOWN', async () => {
    const fake = createFakeDappClient()
    // no queued response → fake throws a plain Error
    const transport = viaLedgerApi(fake as never)
    const error = await transport.post('/v2/foo', {}).catch((e) => e as CantonError)
    expect(error).toBeInstanceOf(CantonError)
    expect(error.code).toBe('UNKNOWN')
  })
})
