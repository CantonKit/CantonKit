import { describe, it, expect } from 'vitest'
import { createFakeDappClient } from '../test/fakeDappClient.js'
import { viaLedgerApi } from '../transport/viaLedgerApi.js'
import { queryACS } from './queryACS.js'
import { templateId } from '../types/commands.js'

const TPL = templateId('#App:Mod:T')

describe('queryACS', () => {
  it('POSTs /v2/state/active-contracts with filter payload and returns typed contracts', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({
      ok: true,
      status: 200,
      body: {
        activeContracts: [
          {
            contractId: 'c1',
            templateId: '#App:Mod:T',
            payload: { owner: 'Alice', amount: '100' },
            signatories: ['Alice'],
            observers: [],
          },
        ],
      },
    })

    const transport = viaLedgerApi(fake as never)
    const contracts = await queryACS<{ owner: string; amount: string }>(transport, {
      templateId: TPL,
      parties: ['Alice'],
    })

    expect(contracts).toHaveLength(1)
    expect(contracts[0]).toMatchObject({
      contractId: 'c1',
      payload: { owner: 'Alice', amount: '100' },
    })

    const sent = fake.__calls.ledgerApi[0] as { body: { filter: { filtersByParty: unknown } } }
    expect(sent.body.filter).toBeDefined()
  })

  it('returns empty array on empty activeContracts', async () => {
    const fake = createFakeDappClient()
    fake.__queue.ledgerApi.push({ ok: true, status: 200, body: { activeContracts: [] } })

    const transport = viaLedgerApi(fake as never)
    const contracts = await queryACS(transport, { templateId: TPL, parties: ['Alice'] })
    expect(contracts).toEqual([])
  })

  it('throws INVALID_ARGUMENT when parties is empty', async () => {
    const fake = createFakeDappClient()
    const transport = viaLedgerApi(fake as never)
    await expect(
      queryACS(transport, { templateId: TPL, parties: [] })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })
  })
})
