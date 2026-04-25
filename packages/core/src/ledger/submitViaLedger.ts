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
  const commandId = opts.commandId ?? defaultUuid()
  const body: Record<string, unknown> = {
    commands: opts.commands,
    actAs: opts.actAs,
    commandId,
  }
  if (opts.readAs !== undefined) body.readAs = opts.readAs
  if (opts.deduplicationDuration !== undefined) body.deduplicationDuration = opts.deduplicationDuration
  try {
    await transport.post('/v2/commands/submit', body)
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
  const body: Record<string, unknown> = {
    commands: opts.commands,
    actAs: opts.actAs,
    commandId,
  }
  if (opts.readAs !== undefined) body.readAs = opts.readAs
  if (opts.deduplicationDuration !== undefined) body.deduplicationDuration = opts.deduplicationDuration
  try {
    return await transport.post<SubmitResult>('/v2/commands/submit-and-wait', body)
  } catch (err) {
    throw CantonError.wrap(err, 'LEDGER_HTTP')
  }
}
