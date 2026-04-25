import type { LedgerTransport } from '../transport/viaLedgerApi.js'
import type { SubmitOptions, SubmitResult } from '../types/commands.js'
import { CantonError } from '../error.js'

function defaultUuid(): string {
  return globalThis.crypto.randomUUID()
}

export async function submitViaLedger(
  transport: LedgerTransport,
  opts: SubmitOptions
): Promise<null> {
  try {
    await transport.post('/v2/commands/submit', {
      commands: opts.commands,
      actAs: opts.actAs,
      readAs: opts.readAs,
      commandId: opts.commandId,
      deduplicationDuration: opts.deduplicationDuration,
    })
    return null
  } catch (err) {
    throw CantonError.wrap(err, 'LEDGER_HTTP')
  }
}

export async function submitAndWaitViaLedger(
  transport: LedgerTransport,
  opts: SubmitOptions
): Promise<SubmitResult> {
  const commandId = opts.commandId ?? defaultUuid()
  try {
    return await transport.post<SubmitResult>('/v2/commands/submit-and-wait', {
      commands: opts.commands,
      actAs: opts.actAs,
      readAs: opts.readAs,
      commandId,
      deduplicationDuration: opts.deduplicationDuration,
    })
  } catch (err) {
    throw CantonError.wrap(err, 'LEDGER_HTTP')
  }
}
