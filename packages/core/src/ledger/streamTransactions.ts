import type { DappClient } from '@canton-network/dapp-sdk'
import type {
  SubscribeOptions,
  TransactionEvent,
  Unsubscribe,
  WalletTxEvent,
} from '../types/transactions.js'
import { CantonError } from '../error.js'

function toWalletEvent(raw: unknown): WalletTxEvent {
  const r = raw as { updateId?: string; status?: WalletTxEvent['status'] }
  return {
    source: 'wallet',
    updateId: r.updateId ?? '',
    status: r.status ?? 'submitted',
    raw,
  }
}

function matchesFilter(raw: unknown, templateIds: string[] | undefined): boolean {
  if (!templateIds || templateIds.length === 0) return true
  const tplId = (raw as { templateId?: string }).templateId
  if (!tplId) return false
  return templateIds.includes(tplId)
}

interface StreamDeps {
  ledgerSource?: (opts: SubscribeOptions) => Unsubscribe
}

export function streamTransactions(
  dapp: Pick<DappClient, 'onTxChanged'>,
  opts: SubscribeOptions,
  deps: StreamDeps = {}
): Unsubscribe {
  const source = opts.source ?? 'wallet'
  if (source === 'ledger') {
    if (!deps.ledgerSource) {
      throw new CantonError(
        'INVALID_ARGUMENT',
        'source=ledger requires a ledger transport — pass ledgerUrl to createCantonClient'
      )
    }
    return deps.ledgerSource(opts)
  }

  const templateIds = opts.filter?.templateIds
  const unsubscribe = dapp.onTxChanged((raw: unknown) => {
    if (!matchesFilter(raw, templateIds)) return
    const event: TransactionEvent = toWalletEvent(raw)
    opts.onEvent?.(event)
  })

  return unsubscribe
}
