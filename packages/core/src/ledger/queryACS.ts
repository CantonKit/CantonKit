import type { LedgerTransport } from '../transport/viaLedgerApi.js'
import type { ActiveContract, QueryACSOptions } from '../types/contracts.js'
import type { TemplateId } from '../types/commands.js'
import { CantonError } from '../error.js'

interface RawActiveContract {
  contractId: string
  templateId: string
  payload: unknown
  signatories: string[]
  observers: string[]
}

interface RawResponse {
  activeContracts: RawActiveContract[]
}

/**
 * Queries the JSON Ledger API v2 active contract set.
 * Endpoint: POST /v2/state/active-contracts
 * Request shape follows the v2 ACS filter format (filtersByParty + templateIds).
 * Verify against the current v2 OpenAPI spec if the server rejects the payload.
 */
export async function queryACS<T = unknown>(
  transport: LedgerTransport,
  opts: QueryACSOptions
): Promise<ActiveContract<T>[]> {
  if (opts.parties.length === 0) {
    throw new CantonError('INVALID_ARGUMENT', 'queryACS requires at least one party')
  }

  const body = {
    filter: {
      filtersByParty: Object.fromEntries(
        opts.parties.map((p) => [
          p,
          { cumulative: [{ identifierFilter: { templateFilter: { templateId: opts.templateId } } }] },
        ])
      ),
    },
    verbose: false,
  }

  const raw = await transport.post<RawResponse>('/v2/state/active-contracts', body)

  return raw.activeContracts.map((c) => ({
    contractId: c.contractId,
    templateId: c.templateId as TemplateId,
    payload: c.payload as T,
    signatories: c.signatories,
    observers: c.observers,
  }))
}
