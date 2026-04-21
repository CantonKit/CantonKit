import { describe, it, expect, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { templateId } from '@cantonkit/core'
import { createFakeCantonClient, TestCantonProvider } from '../testing/index.js'
import { useSubmit } from './useSubmit.js'
import { useContracts } from './useContracts.js'

const TPL = templateId('#App:Mod:T')

describe('useSubmit', () => {
  it('mutates successfully and returns SubmitResult', async () => {
    const submitAndWait = vi.fn(async () => ({
      updateId: 'u1',
      commandId: 'c1',
      completionOffset: '42',
    }))
    const client = createFakeCantonClient({ submitAndWait: submitAndWait as never })
    const { result } = renderHook(() => useSubmit(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <TestCantonProvider client={client}>{children}</TestCantonProvider>
      ),
    })

    await act(async () => {
      await result.current.mutateAsync({ commands: [], actAs: ['Alice'] })
    })

    await waitFor(() => expect(result.current.data?.updateId).toBe('u1'))
    expect(submitAndWait).toHaveBeenCalledWith({ commands: [], actAs: ['Alice'] })
  })

  it('surfaces WALLET_REJECTED error', async () => {
    const client = createFakeCantonClient({
      submitAndWait: vi.fn(async () => {
        throw Object.assign(new Error('rejected'), {
          code: 'WALLET_REJECTED',
          name: 'CantonError',
        })
      }) as never,
    })
    const { result } = renderHook(() => useSubmit(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <TestCantonProvider client={client}>{children}</TestCantonProvider>
      ),
    })
    await act(async () => {
      await result.current.mutateAsync({ commands: [], actAs: ['Alice'] }).catch(() => undefined)
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as { code?: string }).code).toBe('WALLET_REJECTED')
  })

  it('invalidates ACS queries on success (prefix match)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    let queryACSCount = 0
    const client = createFakeCantonClient({
      queryACS: (async () => {
        queryACSCount++
        return []
      }) as never,
      submitAndWait: (async () => ({
        updateId: 'u1',
        commandId: 'c1',
        completionOffset: '0',
      })) as never,
    })
    const { result } = renderHook(
      () => ({
        contracts: useContracts({ templateId: TPL, parties: ['Alice'] }),
        submit: useSubmit(),
      }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <TestCantonProvider client={client} queryClient={qc}>
            {children}
          </TestCantonProvider>
        ),
      }
    )

    await waitFor(() => expect(result.current.contracts.isSuccess).toBe(true))
    expect(queryACSCount).toBe(1)

    await act(async () => {
      await result.current.submit.mutateAsync({ commands: [], actAs: ['Alice'] })
    })

    await waitFor(() => expect(queryACSCount).toBe(2))
  })

  it('respects invalidate: false to skip auto-invalidation', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    let queryACSCount = 0
    const client = createFakeCantonClient({
      queryACS: (async () => {
        queryACSCount++
        return []
      }) as never,
      submitAndWait: (async () => ({
        updateId: 'u1',
        commandId: 'c1',
        completionOffset: '0',
      })) as never,
    })
    const { result } = renderHook(
      () => ({
        contracts: useContracts({ templateId: TPL, parties: ['Alice'] }),
        submit: useSubmit({ invalidate: false }),
      }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <TestCantonProvider client={client} queryClient={qc}>
            {children}
          </TestCantonProvider>
        ),
      }
    )
    await waitFor(() => expect(result.current.contracts.isSuccess).toBe(true))
    await act(async () => {
      await result.current.submit.mutateAsync({ commands: [], actAs: ['Alice'] })
    })
    expect(invalidateSpy).not.toHaveBeenCalled()
    expect(queryACSCount).toBe(1)
  })

  it('calls user-supplied onSuccess after successful submit with invalidate: false', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    const client = createFakeCantonClient({
      submitAndWait: (async () => ({
        updateId: 'u1',
        commandId: 'c1',
        completionOffset: '0',
      })) as never,
    })
    const userOnSuccess = vi.fn()

    const { result } = renderHook(
      () => useSubmit({ invalidate: false, onSuccess: userOnSuccess }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <TestCantonProvider client={client} queryClient={qc}>
            {children}
          </TestCantonProvider>
        ),
      }
    )

    await act(async () => {
      await result.current.mutateAsync({ commands: [], actAs: ['Alice'] })
    })

    expect(userOnSuccess).toHaveBeenCalledOnce()
    expect(userOnSuccess.mock.calls[0]?.[0]).toMatchObject({ updateId: 'u1' })
  })
})
