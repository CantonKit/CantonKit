import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { templateId, type ActiveContract } from '@cantonkit/core'
import { createFakeCantonClient, TestCantonProvider } from '../testing/index.js'
import { useContracts } from './useContracts.js'

const TPL = templateId('#App:Mod:T')

function wrap(client: ReturnType<typeof createFakeCantonClient>) {
  return ({ children }: { children: ReactNode }) => (
    <TestCantonProvider client={client}>{children}</TestCantonProvider>
  )
}

describe('useContracts', () => {
  it('fetches on mount and exposes typed data', async () => {
    const client = createFakeCantonClient({
      queryACS: vi.fn(async () => [
        {
          contractId: 'c1',
          templateId: TPL,
          payload: { owner: 'Alice', amount: '10' },
          signatories: ['Alice'],
          observers: [],
        } as ActiveContract<{ owner: string; amount: string }>,
      ]) as never,
    })
    const { result } = renderHook(
      () => useContracts<{ owner: string; amount: string }>({ templateId: TPL }),
      { wrapper: wrap(client) }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0]?.payload.owner).toBe('Alice')
  })

  it('refetches when parties change', async () => {
    const queryACS = vi.fn(async () => [])
    const client = createFakeCantonClient({ queryACS: queryACS as never })
    const { result, rerender } = renderHook(
      ({ party }: { party: string }) =>
        useContracts({ templateId: TPL, parties: [party] }),
      { wrapper: wrap(client), initialProps: { party: 'Alice' } }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    rerender({ party: 'Bob' })
    await waitFor(() => expect(queryACS).toHaveBeenCalledTimes(2))
  })

  it('surfaces CantonError in error state', async () => {
    const client = createFakeCantonClient({
      queryACS: vi.fn(async () => {
        throw Object.assign(new Error('boom'), { code: 'LEDGER_HTTP', name: 'CantonError' })
      }) as never,
    })
    const { result } = renderHook(() => useContracts({ templateId: TPL }), {
      wrapper: wrap(client),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as { code?: string }).code).toBe('LEDGER_HTTP')
  })

  it('is disabled when not connected and no parties supplied', () => {
    const client = createFakeCantonClient({
      queryACS: vi.fn(async () => []) as never,
    })
    const { result } = renderHook(() => useContracts({ templateId: TPL }), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <TestCantonProvider client={client} status="disconnected" activeParty={null} accounts={[]}>
          {children}
        </TestCantonProvider>
      ),
    })
    expect(result.current.fetchStatus).toBe('idle')
  })
})
