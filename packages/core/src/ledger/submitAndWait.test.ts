import { describe, it, expect } from 'vitest'
import { createFakeDappClient } from '../test/fakeDappClient.js'
import { submitAndWait } from './submitAndWait.js'
import { templateId } from '../types/commands.js'

describe('submitAndWait', () => {
  it('returns SubmitResult on successful prepareExecuteAndWait', async () => {
    const fake = createFakeDappClient()
    fake.__queue.prepareExecuteAndWait.push({
      kind: 'ok',
      value: { updateId: 'u1', commandId: 'c1', completionOffset: '42' },
    })

    const result = await submitAndWait(fake as never, {
      commands: [
        {
          CreateCommand: {
            templateId: templateId('#App:Mod:T'),
            createArguments: { owner: 'Alice' },
          },
        },
      ],
      actAs: ['Alice'],
    })

    expect(result).toEqual({ updateId: 'u1', commandId: 'c1', completionOffset: '42' })
  })

  it('generates a commandId if not supplied', async () => {
    const fake = createFakeDappClient()
    fake.__queue.prepareExecuteAndWait.push({
      kind: 'ok',
      value: { updateId: 'u1', commandId: 'generated', completionOffset: '0' },
    })

    await submitAndWait(fake as never, { commands: [], actAs: ['A'] })

    const sent = fake.__calls.prepareExecuteAndWait[0] as { commandId?: string }
    expect(sent.commandId).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('preserves caller-supplied commandId', async () => {
    const fake = createFakeDappClient()
    fake.__queue.prepareExecuteAndWait.push({
      kind: 'ok',
      value: { updateId: 'u1', commandId: 'my-id', completionOffset: '0' },
    })

    await submitAndWait(fake as never, { commands: [], actAs: ['A'], commandId: 'my-id' })

    const sent = fake.__calls.prepareExecuteAndWait[0] as { commandId?: string }
    expect(sent.commandId).toBe('my-id')
  })

  it('maps rejection to WALLET_REJECTED', async () => {
    const fake = createFakeDappClient()
    const err = Object.assign(new Error('rejected'), { code: 'USER_REJECTED' })
    fake.__queue.prepareExecuteAndWait.push({ kind: 'err', error: err })

    await expect(
      submitAndWait(fake as never, { commands: [], actAs: ['A'] })
    ).rejects.toMatchObject({ code: 'WALLET_REJECTED' })
  })
})
