import type { LedgerTransport } from '../transport/viaLedgerApi.js'
import type { ActiveContract, QueryACSOptions } from '../types/contracts.js'
import type { TemplateId } from '../types/commands.js'
import { CantonError } from '../error.js'

interface RawCreatedEvent {
  contractId: string
  templateId: string
  createArgument: unknown
  signatories: string[]
  observers: string[]
}

interface RawACSItem {
  contractEntry?: {
    JsActiveContract?: {
      createdEvent?: RawCreatedEvent
    }
  }
}

interface LedgerEndResponse {
  offset: number
}

export async function queryACS<T = unknown>(
  transport: LedgerTransport,
  opts: QueryACSOptions
): Promise<ActiveContract<T>[]> {
  if (opts.parties.length === 0) {
    throw new CantonError('INVALID_ARGUMENT', 'queryACS requires at least one party')
  }

  const { offset } = await transport.get<LedgerEndResponse>('/v2/state/ledger-end', undefined)

  // templateId must be a string. '#packageName:Module:Entity' uses package-name resolution (preferred).
  // Do NOT strip the '#' prefix — the sandbox uses it to distinguish name vs hash.
  const rawTemplateId = String(opts.templateId)

  const identifierFilter = rawTemplateId.includes(':')
    ? { TemplateFilter: { value: { templateId: rawTemplateId, includeCreatedEventBlob: false } } }
    : { WildcardFilter: { value: { includeCreatedEventBlob: false } } }

  const body = {
    filter: {
      filtersByParty: Object.fromEntries(
        opts.parties.map((p) => [
          p,
          { cumulative: [{ identifierFilter }] },
        ])
      ),
    },
    activeAtOffset: offset,
    verbose: false,
  }

  const raw = await transport.post<RawACSItem[]>('/v2/state/active-contracts', body)

  return raw.flatMap((item) => {
    const event = item.contractEntry?.JsActiveContract?.createdEvent
    if (!event) return []
    return [{
      contractId: event.contractId,
      templateId: event.templateId as TemplateId,
      payload: event.createArgument as T,
      signatories: event.signatories,
      observers: event.observers,
    }]
  })
}
