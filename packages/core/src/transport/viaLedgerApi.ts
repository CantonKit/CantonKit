import type { DappClient } from '@canton-network/dapp-sdk'
import { CantonError } from '../error.js'

/**
 * `DappClient.ledgerApi` is a low-level proxy. We expect responses of the form
 * `{ ok: boolean, status: number, body: unknown }`. This shape mirrors what
 * dapp-sdk returns for proxied JSON Ledger API calls — verify against a real
 * response the first time you wire this up and adjust if dapp-sdk evolves.
 */
interface LedgerApiResponse {
  ok: boolean
  status: number
  body: unknown
}

export interface LedgerTransport {
  get<T>(url: string, pathParams?: Record<string, string>): Promise<T>
  post<T>(url: string, body: unknown): Promise<T>
}

function substitutePath(url: string, params: Record<string, string> = {}): string {
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replace(`:${key}`, encodeURIComponent(value)),
    url
  )
}

export function viaLedgerApi(dapp: Pick<DappClient, 'ledgerApi'>): LedgerTransport {
  async function call<T>(method: 'GET' | 'POST', url: string, body?: unknown): Promise<T> {
    let response: LedgerApiResponse
    try {
      response = (await dapp.ledgerApi({ method, url, body } as never)) as LedgerApiResponse
    } catch (err) {
      throw CantonError.wrap(err, 'UNKNOWN')
    }
    if (!response.ok) {
      throw new CantonError('LEDGER_HTTP', `Ledger API ${method} ${url} failed`, {
        status: response.status,
        cause: response.body,
      })
    }
    return response.body as T
  }

  return {
    get: (url, pathParams) => call('GET', substitutePath(url, pathParams)),
    post: (url, body) => call('POST', url, body),
  }
}
