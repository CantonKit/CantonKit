import type { DappClient } from '@canton-network/dapp-sdk'
import type { ActiveContract, QueryACSOptions } from './types/contracts.js'
import type { SubmitOptions, SubmitResult } from './types/commands.js'
import type {
  SubscribeOptions,
  Transaction,
  TransactionEvent,
  Unsubscribe,
} from './types/transactions.js'
import { viaLedgerApi, type LedgerTransport } from './transport/viaLedgerApi.js'
import { createLedgerStream, type LedgerStreamConfig } from './transport/viaWebSocket.js'
import { queryACS } from './ledger/queryACS.js'
import { submit } from './ledger/submit.js'
import { submitAndWait } from './ledger/submitAndWait.js'
import { getTransactionById } from './ledger/getTransactionById.js'
import { streamTransactions } from './ledger/streamTransactions.js'

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
      ? createLedgerStream(
          {
            ledgerUrl: opts.ledgerUrl,
            auth: opts.auth,
            maxReconnectAttempts: opts.maxReconnectAttempts,
          } satisfies LedgerStreamConfig
        )
      : undefined

  const activeUnsubscribes = new Set<Unsubscribe>()

  return {
    queryACS: <T>(q: QueryACSOptions) => queryACS<T>(transport, q),
    getTransactionById: (id) => getTransactionById(transport, id),
    submit: (p) => submit(dapp, p),
    submitAndWait: (p) => submitAndWait(dapp, p),
    subscribeToTransactions(sub: SubscribeOptions): Unsubscribe {
      const wrappedOnEvent = sub.onEvent
        ? (e: TransactionEvent) => sub.onEvent!(e)
        : undefined
      const unsub = streamTransactions(
        dapp,
        { ...sub, onEvent: wrappedOnEvent },
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
