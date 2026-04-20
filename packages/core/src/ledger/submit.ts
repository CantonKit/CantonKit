import type { DappClient } from '@canton-network/dapp-sdk'
import type { SubmitOptions } from '../types/commands.js'
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

export async function submit(
  dapp: Pick<DappClient, 'prepareExecute'>,
  opts: SubmitOptions
): Promise<null> {
  try {
    return await dapp.prepareExecute({
      commands: opts.commands,
      actAs: opts.actAs,
      readAs: opts.readAs,
      commandId: opts.commandId,
      deduplicationDuration: opts.deduplicationDuration,
    } as never)
  } catch (err) {
    if (isRejection(err)) {
      throw new CantonError('WALLET_REJECTED', 'User rejected the transaction', { cause: err })
    }
    throw CantonError.wrap(err, 'UNKNOWN')
  }
}
