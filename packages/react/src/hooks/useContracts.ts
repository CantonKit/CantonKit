import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query'
import type {
  ActiveContract,
  CantonError,
  QueryACSOptions,
  TemplateId,
} from '@cantonkit/core'
import { useCantonClient, useCantonConnection } from '../context.js'

export interface UseContractsOptions {
  templateId: TemplateId
  parties?: string[]
  filter?: QueryACSOptions['filter']
}

type TanstackOpts<T> = Omit<
  UseQueryOptions<ActiveContract<T>[], CantonError>,
  'queryKey' | 'queryFn'
>

export function useContracts<T = unknown>(
  opts: UseContractsOptions,
  queryOptions?: TanstackOpts<T>
): UseQueryResult<ActiveContract<T>[], CantonError> {
  const client = useCantonClient()
  const { activeParty } = useCantonConnection()
  const parties = opts.parties ?? (activeParty ? [activeParty] : [])
  const enabled = parties.length > 0 && (queryOptions?.enabled ?? true)

  return useQuery<ActiveContract<T>[], CantonError>({
    queryKey: ['canton', 'acs', opts.templateId, parties, opts.filter],
    queryFn: () =>
      client.queryACS<T>({
        templateId: opts.templateId,
        parties,
        ...(opts.filter !== undefined ? { filter: opts.filter } : {}),
      }),
    ...queryOptions,
    enabled,
  })
}
