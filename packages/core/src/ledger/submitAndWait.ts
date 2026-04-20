import type { DappClient } from '@canton-network/dapp-sdk'
import type { SubmitOptions, SubmitResult } from '../types/commands.js'
import { CantonError } from '../error.js'

function isRejection(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string' &&
    /REJECT/i.test((err as { code: string }).code)
  )
}

export interface SubmitDeps {
  idGenerator?: () => string
}

function defaultUuid(): string {
  // RFC4122 v4 — Node 20+ and modern browsers expose crypto.randomUUID
  return globalThis.crypto.randomUUID()
}

export async function submitAndWait(
  dapp: Pick<DappClient, 'prepareExecuteAndWait'>,
  opts: SubmitOptions,
  deps: SubmitDeps = {}
): Promise<SubmitResult> {
  const commandId = opts.commandId ?? (deps.idGenerator ?? defaultUuid)()
  try {
    const result = (await dapp.prepareExecuteAndWait({
      commands: opts.commands,
      actAs: opts.actAs,
      readAs: opts.readAs,
      commandId,
      deduplicationDuration: opts.deduplicationDuration,
    } as never)) as unknown as SubmitResult
    return result
  } catch (err) {
    if (isRejection(err)) {
      throw new CantonError('WALLET_REJECTED', 'User rejected the transaction', { cause: err })
    }
    throw CantonError.wrap(err, 'UNKNOWN')
  }
}
