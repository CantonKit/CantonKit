import type { LedgerTransport } from '../transport/viaLedgerApi.js'
import type { Transaction } from '../types/transactions.js'

interface RawResponse {
  transaction: Transaction
}

export async function getTransactionById(
  transport: LedgerTransport,
  id: string
): Promise<Transaction> {
  const { transaction } = await transport.get<RawResponse>(
    '/v2/updates/transaction-by-id/:id',
    { id }
  )
  return transaction
}
