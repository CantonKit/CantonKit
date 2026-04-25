import { describe, it, expect, vi } from 'vitest'
import { submitViaLedger, submitAndWaitViaLedger } from './submitViaLedger.js'
import { templateId } from '../types/commands.js'
import type { LedgerTransport } from '../transport/viaLedgerApi.js'

function makeTransport(response: unknown): LedgerTransport {
  return {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue(response),
  }
}

const OPTS = {
  commands: [
    {
      CreateCommand: {
        templateId: templateId('#App:Mod:T'),
        createArguments: { owner: 'Alice' },
      },
    },
  ],
  actAs: ['Alice'],
}

describe('submitViaLedger', () => {
  it('POSTs to /v2/commands/submit and returns null', async () => {
    const transport = makeTransport({})
    const result = await submitViaLedger(transport, OPTS)
    expect(result).toBeNull()
    expect(transport.post).toHaveBeenCalledWith('/v2/commands/submit', expect.objectContaining({
      commands: OPTS.commands,
      actAs: ['Alice'],
    }))
  })

  it('wraps errors as LEDGER_HTTP', async () => {
    const transport: LedgerTransport = {
      get: vi.fn(),
      post: vi.fn().mockRejectedValue(new Error('timeout')),
    }
    await expect(submitViaLedger(transport, OPTS)).rejects.toMatchObject({ code: 'LEDGER_HTTP' })
  })

  it('auto-generates commandId when not supplied', async () => {
    const transport = makeTransport({})
    await submitViaLedger(transport, { commands: [], actAs: ['Alice'] })
    const call = (transport.post as ReturnType<typeof vi.fn>).mock.calls[0][1] as { commandId: string }
    expect(call.commandId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
  })
})

describe('submitAndWaitViaLedger', () => {
  it('POSTs to /v2/commands/submit-and-wait and returns SubmitResult', async () => {
    const transport = makeTransport({
      updateId: 'u1',
      commandId: 'c1',
      completionOffset: '42',
    })
    const result = await submitAndWaitViaLedger(transport, OPTS)
    expect(result).toEqual({ updateId: 'u1', commandId: 'c1', completionOffset: '42' })
    expect(transport.post).toHaveBeenCalledWith(
      '/v2/commands/submit-and-wait',
      expect.objectContaining({ actAs: ['Alice'] })
    )
  })

  it('auto-generates commandId when not supplied', async () => {
    const transport = makeTransport({ updateId: 'u1', commandId: 'gen', completionOffset: '0' })
    await submitAndWaitViaLedger(transport, { commands: [], actAs: ['Alice'] })
    const call = (transport.post as ReturnType<typeof vi.fn>).mock.calls[0][1] as { commandId: string }
    expect(call.commandId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
  })

  it('preserves caller-supplied commandId', async () => {
    const transport = makeTransport({ updateId: 'u1', commandId: 'my-id', completionOffset: '0' })
    await submitAndWaitViaLedger(transport, { commands: [], actAs: ['Alice'], commandId: 'my-id' })
    const call = (transport.post as ReturnType<typeof vi.fn>).mock.calls[0][1] as { commandId: string }
    expect(call.commandId).toBe('my-id')
  })
})
