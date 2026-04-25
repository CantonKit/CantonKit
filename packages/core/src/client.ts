import type { DappClient } from '@canton-network/dapp-sdk'
import type { ActiveContract, QueryACSOptions } from './types/contracts.js'
import type { SubmitOptions, SubmitResult } from './types/commands.js'
import type {
  SubscribeOptions,
  Transaction,
  Unsubscribe,
} from './types/transactions.js'
import { viaLedgerApi, type LedgerTransport } from './transport/viaLedgerApi.js'
import { viaLedgerProvider } from './transport/viaLedgerProvider.js'
import { createLedgerStream, type LedgerStreamConfig } from './transport/viaWebSocket.js'
import { queryACS } from './ledger/queryACS.js'
import { submit } from './ledger/submit.js'
import { submitAndWait } from './ledger/submitAndWait.js'
import { getTransactionById } from './ledger/getTransactionById.js'
import { streamTransactions } from './ledger/streamTransactions.js'
import { submitViaLedger, submitAndWaitViaLedger } from './ledger/submitViaLedger.js'
import { CantonError } from './error.js'

export interface CreateCantonClientOptions {
  /** Existing DappClient instance (typical when used inside React). */
  dappClient: DappClient
  /** Enables source: 'ledger' subscriptions. Required URL + auth. */
  ledgerUrl?: string
  auth?: { token: string }
  maxReconnectAttempts?: number
}

export interface CantonClient {
  queryACS<T = unknown>(opts: QueryACSOptions): Promise<ActiveContract<T>[]>
  getTransactionById(id: string): Promise<Transaction>
  submit(opts: SubmitOptions): Promise<null>
  submitAndWait(opts: SubmitOptions): Promise<SubmitResult>
  subscribeToTransactions(opts: SubscribeOptions): Unsubscribe
  ledger: DappClient['ledgerApi']
  destroy(): void
}

export function createCantonClient(opts: CreateCantonClientOptions): CantonClient {
  const dapp = opts.dappClient
  const transport: LedgerTransport = viaLedgerApi(dapp)
  const ledgerSource =
    opts.ledgerUrl && opts.auth
      ? createLedgerStream({
          ledgerUrl: opts.ledgerUrl,
          auth: opts.auth,
          ...(opts.maxReconnectAttempts !== undefined
            ? { maxReconnectAttempts: opts.maxReconnectAttempts }
            : {}),
        } satisfies LedgerStreamConfig)
      : undefined

  const activeUnsubscribes = new Set<Unsubscribe>()

  return {
    queryACS: <T>(q: QueryACSOptions) => queryACS<T>(transport, q),
    getTransactionById: (id) => getTransactionById(transport, id),
    submit: (p) => submit(dapp, p),
    submitAndWait: (p) => submitAndWait(dapp, p),
    subscribeToTransactions(sub: SubscribeOptions): Unsubscribe {
      const unsub = streamTransactions(
        dapp,
        sub,
        ledgerSource ? { ledgerSource } : {}
      )
      activeUnsubscribes.add(unsub)
      return () => {
        activeUnsubscribes.delete(unsub)
        unsub()
      }
    },
    ledger: dapp.ledgerApi.bind(dapp),
    destroy() {
      for (const u of activeUnsubscribes) u()
      activeUnsubscribes.clear()
    },
  }
}

export interface JsonLedgerClientOptions {
  ledgerUrl: string
  /**
   * The party this client acts as. Not used by the transport directly —
   * callers pass `actAs` explicitly on each command. Stored here so that
   * wrapping providers (e.g. `LedgerProvider`) can surface it as `activeParty`.
   */
  party: string
  getToken: () => string | undefined
  maxReconnectAttempts?: number
}

export function createJsonLedgerClient(opts: JsonLedgerClientOptions): CantonClient {
  const transport = viaLedgerProvider(opts.ledgerUrl, opts.getToken)
  const ledgerSource = createLedgerStream({
    ledgerUrl: opts.ledgerUrl,
    auth: { token: opts.getToken() ?? '' },
    ...(opts.maxReconnectAttempts !== undefined
      ? { maxReconnectAttempts: opts.maxReconnectAttempts }
      : {}),
  })

  const activeUnsubscribes = new Set<Unsubscribe>()

  return {
    queryACS: <T>(q: QueryACSOptions) => queryACS<T>(transport, q),
    getTransactionById: (id) => getTransactionById(transport, id),
    submit: (p) => submitViaLedger(transport, p),
    submitAndWait: (p) => submitAndWaitViaLedger(transport, p),
    subscribeToTransactions(sub: SubscribeOptions): Unsubscribe {
      const unsub = ledgerSource(sub)
      activeUnsubscribes.add(unsub)
      return () => {
        activeUnsubscribes.delete(unsub)
        unsub()
      }
    },
    ledger: (_params) => {
      throw new CantonError('INVALID_ARGUMENT', 'ledger() raw proxy not available in JsonLedgerClient — use queryACS or getTransactionById')
    },
    destroy() {
      for (const u of activeUnsubscribes) u()
      activeUnsubscribes.clear()
    },
  }
}
