import { describe, it, expect } from 'vitest'
import { createFakeDappClient } from '../test/fakeDappClient.js'
import { submit } from './submit.js'
import { templateId } from '../types/commands.js'

describe('submit', () => {
  it('calls DappClient.prepareExecute with the command payload and returns null', async () => {
    const fake = createFakeDappClient()
    fake.__queue.prepareExecute.push({ kind: 'ok', value: null })

    const result = await submit(fake as never, {
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

    expect(result).toBeNull()
    expect(fake.__calls.prepareExecute).toHaveLength(1)
  })

  it('maps user rejection to WALLET_REJECTED', async () => {
    const fake = createFakeDappClient()
    const rejection = Object.assign(new Error('rejected by user'), { code: 'USER_REJECTED' })
    fake.__queue.prepareExecute.push({ kind: 'err', error: rejection })

    await expect(
      submit(fake as never, { commands: [], actAs: ['Alice'] })
    ).rejects.toMatchObject({ code: 'WALLET_REJECTED' })
  })

  it('wraps generic failures as UNKNOWN', async () => {
    const fake = createFakeDappClient()
    fake.__queue.prepareExecute.push({ kind: 'err', error: new Error('network blip') })

    await expect(
      submit(fake as never, { commands: [], actAs: ['Alice'] })
    ).rejects.toMatchObject({ code: 'UNKNOWN' })
  })
})
