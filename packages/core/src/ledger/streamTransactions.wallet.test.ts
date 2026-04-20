import { describe, it, expect, vi } from 'vitest'
import { createFakeDappClient } from '../test/fakeDappClient.js'
import { streamTransactions } from './streamTransactions.js'
import { templateId } from '../types/commands.js'

describe('streamTransactions (source: wallet)', () => {
  it('forwards onTxChanged events through onEvent', () => {
    const fake = createFakeDappClient()
    const received: unknown[] = []
    const unsub = streamTransactions(fake as never, {
      source: 'wallet',
      onEvent: (e) => received.push(e),
    })

    fake.__emitTx({ updateId: 'u1' })
    fake.__emitTx({ updateId: 'u2' })

    expect(received).toHaveLength(2)
    expect((received[0] as { source: string }).source).toBe('wallet')
    unsub()
  })

  it('stops delivery after unsubscribe', () => {
    const fake = createFakeDappClient()
    const onEvent = vi.fn()
    const unsub = streamTransactions(fake as never, { source: 'wallet', onEvent })
    unsub()
    fake.__emitTx({ updateId: 'x' })
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('filters by templateIds client-side', () => {
    const fake = createFakeDappClient()
    const onEvent = vi.fn()
    const keep = templateId('#A:M:K')
    streamTransactions(fake as never, {
      source: 'wallet',
      filter: { templateIds: [keep] },
      onEvent,
    })

    fake.__emitTx({ updateId: 'u1', templateId: '#A:M:K' })
    fake.__emitTx({ updateId: 'u2', templateId: '#A:M:OTHER' })

    expect(onEvent).toHaveBeenCalledOnce()
  })

  it('defaults to source=wallet when source omitted', () => {
    const fake = createFakeDappClient()
    const onEvent = vi.fn()
    streamTransactions(fake as never, { onEvent })
    fake.__emitTx({ updateId: 'u1' })
    expect(onEvent).toHaveBeenCalledOnce()
  })
})
