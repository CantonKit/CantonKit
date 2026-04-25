import { describe, it, expect, vi } from 'vitest'
import { viaLedgerProvider } from './viaLedgerProvider.js'

vi.mock('@canton-network/core-provider-ledger', () => ({
  LedgerProvider: vi.fn().mockImplementation(({ accessTokenProvider }) => ({
    _tokenProvider: accessTokenProvider,
    request: vi.fn(),
  })),
}))

import { LedgerProvider } from '@canton-network/core-provider-ledger'

describe('viaLedgerProvider', () => {
  it('POST wraps body into provider.request ledgerApi call', async () => {
    const mockRequest = vi.fn().mockResolvedValue({ activeContracts: [] })
    ;(LedgerProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      request: mockRequest,
    }))

    const transport = viaLedgerProvider('http://localhost:7575', () => 'tok')
    await transport.post('/v2/state/active-contracts', { filter: {} })

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'ledgerApi',
      params: {
        resource: '/v2/state/active-contracts',
        requestMethod: 'post',
        body: { filter: {} },
      },
    })
  })

  it('GET wraps path params into provider.request ledgerApi call', async () => {
    const mockRequest = vi.fn().mockResolvedValue({ transaction: { updateId: 'u1' } })
    ;(LedgerProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      request: mockRequest,
    }))

    const transport = viaLedgerProvider('http://localhost:7575', () => 'tok')
    await transport.get('/v2/updates/transaction-by-id/:id', { id: 'abc' })

    expect(mockRequest).toHaveBeenCalledWith({
      method: 'ledgerApi',
      params: {
        resource: '/v2/updates/transaction-by-id/:id',
        requestMethod: 'get',
        path: { id: 'abc' },
      },
    })
  })

  it('throws LEDGER_HTTP on non-ok response', async () => {
    const mockRequest = vi.fn().mockRejectedValue(Object.assign(new Error('bad'), { status: 404 }))
    ;(LedgerProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      request: mockRequest,
    }))

    const transport = viaLedgerProvider('http://localhost:7575', () => 'tok')
    await expect(transport.post('/v2/state/active-contracts', {})).rejects.toMatchObject({
      code: 'LEDGER_HTTP',
    })
  })

  it('throws NOT_CONNECTED when getToken returns undefined', async () => {
    let capturedProvider2: { getAccessToken: () => Promise<string> } | undefined
    ;(LedgerProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(({ accessTokenProvider }: { accessTokenProvider: { getAccessToken: () => Promise<string> } }) => {
      capturedProvider2 = accessTokenProvider
      return {
        request: async () => {
          await capturedProvider2!.getAccessToken()
          return {}
        },
      }
    })

    const transport = viaLedgerProvider('http://localhost:7575', () => undefined)
    await expect(transport.post('/v2/state/active-contracts', {})).rejects.toMatchObject({
      code: 'NOT_CONNECTED',
    })
  })

  it('getAuthContext throws INVALID_ARGUMENT', async () => {
    let capturedAuth: { getAuthContext: () => Promise<unknown> } | undefined
    ;(LedgerProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(({ accessTokenProvider }: { accessTokenProvider: { getAuthContext: () => Promise<unknown> } }) => {
      capturedAuth = accessTokenProvider
      return { request: vi.fn() }
    })

    viaLedgerProvider('http://localhost:7575', () => 'tok')
    await expect(capturedAuth!.getAuthContext()).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    })
  })
})
