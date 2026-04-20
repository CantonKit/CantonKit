import type { TemplateId } from './commands.js'

export interface WalletTxEvent {
  source: 'wallet'
  updateId: string
  status: 'submitted' | 'accepted' | 'rejected'
  raw: unknown // opaque payload from DappClient.onTxChanged
}

export interface LedgerTxEvent {
  source: 'ledger'
  updateId: string
  offset: string
  effectiveAt: string
  events: Array<{
    templateId: TemplateId
    contractId: string
    kind: 'created' | 'archived' | 'exercised'
    payload?: unknown
  }>
}

export type TransactionEvent = WalletTxEvent | LedgerTxEvent

export interface SubscribeOptions {
  source?: 'wallet' | 'ledger'
  filter?: {
    templateIds?: TemplateId[]
    parties?: string[]
  }
  onEvent?: (event: TransactionEvent) => void
  onError?: (error: unknown) => void
}

export type Unsubscribe = () => void

export interface Transaction {
  updateId: string
  offset: string
  effectiveAt: string
  events: LedgerTxEvent['events']
}
