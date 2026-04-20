import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLedgerStream } from './viaWebSocket.js'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  readyState = 0
  onopen?: () => void
  onmessage?: (ev: { data: string }) => void
  onerror?: (ev: unknown) => void
  onclose?: (ev: { code: number; reason: string }) => void
  sent: string[] = []
  closed = false

  constructor(public url: string, public protocols?: string | string[]) {
    FakeWebSocket.instances.push(this)
  }
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.closed = true
    this.onclose?.({ code: 1000, reason: '' })
  }
  __open() {
    this.readyState = 1
    this.onopen?.()
  }
  __message(body: unknown) {
    this.onmessage?.({ data: JSON.stringify(body) })
  }
  __error(err: unknown) {
    this.onerror?.(err)
  }
  __close(code = 1006, reason = 'abnormal') {
    this.onclose?.({ code, reason })
  }
}

describe('createLedgerStream', () => {
  beforeEach(() => {
    FakeWebSocket.instances = []
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const deps = () => ({
    WebSocketCtor: FakeWebSocket as unknown as typeof WebSocket,
    clock: {
      setTimeout: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms),
      clearTimeout: (id: unknown) => globalThis.clearTimeout(id as number),
    },
  })

  it('opens a ws URL with the bearer token in the subprotocols', () => {
    const stream = createLedgerStream(
      { ledgerUrl: 'https://ledger.example', auth: { token: 'TKN' } },
      deps()
    )
    const unsub = stream({ onEvent: () => undefined })
    expect(FakeWebSocket.instances[0]?.url).toBe('wss://ledger.example/v2/updates/flats')
    expect(FakeWebSocket.instances[0]?.protocols).toContain('jwt.token.TKN')
    unsub()
  })

  it('sends a request payload on open with the provided filter', () => {
    const stream = createLedgerStream(
      { ledgerUrl: 'https://ledger.example', auth: { token: 'TKN' } },
      deps()
    )
    stream({
      filter: { templateIds: ['#A:M:T' as never], parties: ['Alice'] },
      onEvent: () => undefined,
    })
    const ws = FakeWebSocket.instances[0]!
    ws.__open()
    expect(ws.sent).toHaveLength(1)
    const payload = JSON.parse(ws.sent[0]!)
    expect(payload.filter.filtersByParty.Alice).toBeDefined()
  })

  it('emits LedgerTxEvent on message', () => {
    const stream = createLedgerStream(
      { ledgerUrl: 'https://ledger.example', auth: { token: 'TKN' } },
      deps()
    )
    const received: unknown[] = []
    stream({ onEvent: (e) => received.push(e) })
    const ws = FakeWebSocket.instances[0]!
    ws.__open()
    ws.__message({
      transaction: {
        updateId: 'u1',
        offset: '10',
        effectiveAt: '2026-04-20',
        events: [],
      },
    })
    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({ source: 'ledger', updateId: 'u1' })
  })

  it('reconnects with exponential backoff on abnormal close', () => {
    const stream = createLedgerStream(
      { ledgerUrl: 'https://ledger.example', auth: { token: 'TKN' } },
      deps()
    )
    stream({ onEvent: () => undefined })
    const ws1 = FakeWebSocket.instances[0]!
    ws1.__open()
    ws1.__close(1006)

    expect(FakeWebSocket.instances).toHaveLength(1) // not yet retried
    vi.advanceTimersByTime(1000) // first backoff ~1s
    expect(FakeWebSocket.instances).toHaveLength(2)
  })

  it('does not reconnect after explicit unsubscribe', () => {
    const stream = createLedgerStream(
      { ledgerUrl: 'https://ledger.example', auth: { token: 'TKN' } },
      deps()
    )
    const unsub = stream({ onEvent: () => undefined })
    FakeWebSocket.instances[0]?.__open()
    unsub()
    vi.advanceTimersByTime(10_000)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('reports STREAM_CLOSED via onError when reconnect budget exhausted', () => {
    const onError = vi.fn()
    const stream = createLedgerStream(
      {
        ledgerUrl: 'https://ledger.example',
        auth: { token: 'TKN' },
        maxReconnectAttempts: 2,
      },
      deps()
    )
    stream({ onEvent: () => undefined, onError })
    // fail 3 times
    for (let i = 0; i < 3; i++) {
      FakeWebSocket.instances[i]?.__close(1006)
      vi.advanceTimersByTime(10_000)
    }
    expect(onError).toHaveBeenCalled()
    const err = onError.mock.calls[0]?.[0]
    expect((err as { code?: string }).code).toBe('STREAM_CLOSED')
  })
})
