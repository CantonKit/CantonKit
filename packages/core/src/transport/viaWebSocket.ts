import type {
  LedgerTxEvent,
  SubscribeOptions,
  TransactionEvent,
  Unsubscribe,
} from '../types/transactions.js'
import { CantonError } from '../error.js'

export interface AuthProvider {
  token: string
}

export interface LedgerStreamConfig {
  ledgerUrl: string
  auth: AuthProvider
  maxReconnectAttempts?: number
}

export interface LedgerStreamDeps {
  WebSocketCtor?: typeof WebSocket
  clock?: {
    setTimeout: (fn: () => void, ms: number) => unknown
    clearTimeout: (id: unknown) => void
  }
}

type LedgerSource = (opts: SubscribeOptions) => Unsubscribe

function toWss(url: string): string {
  return url.replace(/^http/, 'ws') + '/v2/updates/flats'
}

function buildRequest(filter: SubscribeOptions['filter']): Record<string, unknown> {
  const parties = filter?.parties ?? []
  const templateIds = filter?.templateIds ?? []
  const filtersByParty: Record<string, unknown> = {}
  for (const p of parties) {
    filtersByParty[p] = {
      cumulative: templateIds.map((t) => ({
        identifierFilter: { templateFilter: { templateId: t } },
      })),
    }
  }
  return { filter: { filtersByParty }, verbose: false }
}

function toLedgerEvent(raw: unknown): LedgerTxEvent | null {
  const t = (raw as { transaction?: unknown }).transaction as
    | {
        updateId: string
        offset: string
        effectiveAt: string
        events: LedgerTxEvent['events']
      }
    | undefined
  if (!t) return null
  return {
    source: 'ledger',
    updateId: t.updateId,
    offset: t.offset,
    effectiveAt: t.effectiveAt,
    events: t.events,
  }
}

export function createLedgerStream(
  config: LedgerStreamConfig,
  deps: LedgerStreamDeps = {}
): LedgerSource {
  const WS = deps.WebSocketCtor ?? (globalThis.WebSocket as typeof WebSocket)
  const clock = deps.clock ?? {
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (id) => globalThis.clearTimeout(id as number),
  }

  if (!WS) {
    throw new CantonError(
      'INVALID_ARGUMENT',
      'WebSocket constructor unavailable; pass WebSocketCtor in deps for non-browser environments'
    )
  }

  const maxAttempts = config.maxReconnectAttempts ?? 5

  return function ledgerSource(opts: SubscribeOptions): Unsubscribe {
    let stopped = false
    let attempt = 0
    let currentSocket: WebSocket | null = null
    let pendingTimer: unknown = null

    const connect = () => {
      if (stopped) return
      const ws = new WS(toWss(config.ledgerUrl), [`jwt.token.${config.auth.token}`])
      currentSocket = ws
      ws.onopen = () => {
        attempt = 0
        ws.send(JSON.stringify(buildRequest(opts.filter)))
      }
      ws.onmessage = (ev: MessageEvent) => {
        try {
          const parsed = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data))
          const event = toLedgerEvent(parsed)
          if (event) {
            const emit: TransactionEvent = event
            opts.onEvent?.(emit)
          }
        } catch (err) {
          opts.onError?.(CantonError.wrap(err, 'UNKNOWN'))
        }
      }
      ws.onerror = (err) => {
        opts.onError?.(CantonError.wrap(err, 'STREAM_CLOSED'))
      }
      ws.onclose = (ev: CloseEvent) => {
        currentSocket = null
        if (stopped || ev.code === 1000) return
        attempt += 1
        if (attempt > maxAttempts) {
          opts.onError?.(
            new CantonError('STREAM_CLOSED', 'Reconnect budget exhausted', {
              status: ev.code,
            })
          )
          stopped = true
          return
        }
        const backoff = Math.min(30_000, 2 ** (attempt - 1) * 1000)
        pendingTimer = clock.setTimeout(connect, backoff)
      }
    }

    connect()

    return () => {
      stopped = true
      if (pendingTimer) clock.clearTimeout(pendingTimer)
      currentSocket?.close()
    }
  }
}
