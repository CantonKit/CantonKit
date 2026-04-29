import { LedgerProvider } from '@canton-network/core-provider-ledger'
import { CantonError } from '../error.js'
import type { LedgerTransport } from './viaLedgerApi.js'

export function viaLedgerProvider(
  ledgerUrl: string,
  getToken: () => string | undefined
): LedgerTransport {
  const provider = new LedgerProvider({
    baseUrl: ledgerUrl,
    accessTokenProvider: {
      getAccessToken: async () => getToken() ?? '',
      getAuthContext: async () => {
        throw new CantonError('INVALID_ARGUMENT', 'getAuthContext not supported in viaLedgerProvider')
      },
    },
  })

  async function call<T>(
    requestMethod: 'get' | 'post',
    resource: string,
    extra: { body?: unknown; path?: Record<string, string> }
  ): Promise<T> {
    try {
      return (await provider.request({
        method: 'ledgerApi',
        params: { resource, requestMethod, ...extra },
      } as never)) as T
    } catch (err) {
      throw CantonError.wrap(err, 'LEDGER_HTTP')
    }
  }

  return {
    get: (url, pathParams) =>
      call('get', url, pathParams ? { path: pathParams } : {}),
    post: (url, body) =>
      call('post', url, { body }),
  }
}
