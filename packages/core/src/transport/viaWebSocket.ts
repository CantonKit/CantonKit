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

function buildRequest(
  filter: SubscribeOptions['filter'],
  beginExclusive: number
): Record<string, unknown> {
  const parties = filter?.parties ?? []
  const templateIds = filter?.templateIds ?? []
  const cumulative =
    templateIds.length === 0
      ? [
          {
            identifierFilter: {
              WildcardFilter: { value: { includeCreatedEventBlob: false } },
            },
          },
        ]
      : templateIds.map((t) => ({
          identifierFilter: {
            TemplateFilter: {
              value: { templateId: t, includeCreatedEventBlob: false },
            },
          },
        }))
  const filtersByParty: Record<string, unknown> = {}
  for (const p of parties) {
    filtersByParty[p] = { cumulative }
  }
  return {
    beginExclusive,
    updateFormat: {
      includeTransactions: {
        transactionShape: 'TRANSACTION_SHAPE_ACS_DELTA',
        eventFormat: { filtersByParty, verbose: false },
      },
    },
  }
}

interface RawLedgerEventBody {
  contractId: string
  templateId: string
  createArgument?: unknown
  choice?: string
  exerciseArgument?: unknown
  exerciseResult?: unknown
}

interface RawTransaction {
  updateId: string
  offset: string | number
  effectiveAt: string
  events: Array<Record<string, RawLedgerEventBody>>
}

function normalizeEvent(
  envelope: Record<string, RawLedgerEventBody>
): LedgerTxEvent['events'][number] | null {
  if (envelope.CreatedEvent) {
    const e = envelope.CreatedEvent
    return {
      kind: 'created',
      contractId: e.contractId,
      templateId: e.templateId as LedgerTxEvent['events'][number]['templateId'],
      payload: e.createArgument,
    }
  }
  if (envelope.ArchivedEvent) {
    const e = envelope.ArchivedEvent
    return {
      kind: 'archived',
      contractId: e.contractId,
      templateId: e.templateId as LedgerTxEvent['events'][number]['templateId'],
    }
  }
  if (envelope.ExercisedEvent) {
    const e = envelope.ExercisedEvent
    return {
      kind: 'exercised',
      contractId: e.contractId,
      templateId: e.templateId as LedgerTxEvent['events'][number]['templateId'],
      payload: e.exerciseResult,
    }
  }
  return null
}

function toLedgerEvent(raw: unknown): LedgerTxEvent | null {
  const obj = raw as {
    update?: { Transaction?: { value?: unknown } }
    // Pre-3.3 servers send the transaction at the top level
    transaction?: unknown
  }
  const t = (obj.update?.Transaction?.value ?? obj.transaction) as
    | RawTransaction
    | undefined
  if (!t) return null
  const events = (t.events ?? [])
    .map(normalizeEvent)
    .filter((e): e is LedgerTxEvent['events'][number] => e !== null)
  return {
    source: 'ledger',
    updateId: t.updateId,
    offset: String(t.offset),
    effectiveAt: t.effectiveAt,
    events,
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
    // Track the highest offset we've successfully delivered so reconnects
    // resume from there rather than replaying history from offset 0.
    let lastOffset = 0

    const connect = () => {
      if (stopped) return
      const protocols = ['daml.ws.auth']
      if (config.auth.token) protocols.push(`jwt.token.${config.auth.token}`)
      const ws = new WS(toWss(config.ledgerUrl), protocols)
      currentSocket = ws
      ws.onopen = () => {
        attempt = 0
        ws.send(JSON.stringify(buildRequest(opts.filter, lastOffset)))
      }
      ws.onmessage = (ev: MessageEvent) => {
        try {
          const parsed = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data))
          const event = toLedgerEvent(parsed)
          if (event) {
            const numeric = Number(event.offset)
            if (Number.isFinite(numeric) && numeric > lastOffset) {
              lastOffset = numeric
            }
            const emit: TransactionEvent = event
            opts.onEvent?.(emit)
          }
        } catch (err) {
          opts.onError?.(CantonError.wrap(err, 'UNKNOWN'))
        }
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
      const sock = currentSocket
      if (!sock) return
      if (sock.readyState === WS.CONNECTING) {
        sock.addEventListener('open', () => sock.close(1000))
      } else if (sock.readyState === WS.OPEN) {
        sock.close(1000)
      }
    }
  }
}
