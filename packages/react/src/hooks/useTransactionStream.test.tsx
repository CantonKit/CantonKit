import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createFakeCantonClient, TestCantonProvider } from '../testing/index.js'
import { useTransactionStream } from './useTransactionStream.js'

describe('useTransactionStream', () => {
  it('buffers events and exposes them in most-recent-first order', () => {
    const client = createFakeCantonClient()
    const { result } = renderHook(() => useTransactionStream({}), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <TestCantonProvider client={client}>{children}</TestCantonProvider>
      ),
    })

    act(() => {
      client.__emitTx({ source: 'wallet', updateId: 'u1', status: 'submitted', raw: {} })
      client.__emitTx({ source: 'wallet', updateId: 'u2', status: 'submitted', raw: {} })
    })

    expect(result.current.events.map((e) => e.updateId)).toEqual(['u2', 'u1'])
  })

  it('caps events at bufferSize', () => {
    const client = createFakeCantonClient()
    const { result } = renderHook(() => useTransactionStream({ bufferSize: 2 }), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <TestCantonProvider client={client}>{children}</TestCantonProvider>
      ),
    })

    act(() => {
      client.__emitTx({ source: 'wallet', updateId: 'u1', status: 'submitted', raw: {} })
      client.__emitTx({ source: 'wallet', updateId: 'u2', status: 'submitted', raw: {} })
      client.__emitTx({ source: 'wallet', updateId: 'u3', status: 'submitted', raw: {} })
    })

    expect(result.current.events).toHaveLength(2)
    expect(result.current.events.map((e) => e.updateId)).toEqual(['u3', 'u2'])
  })

  it('fires onEvent synchronously before re-render', () => {
    const client = createFakeCantonClient()
    const onEvent = vi.fn()
    renderHook(() => useTransactionStream({ onEvent }), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <TestCantonProvider client={client}>{children}</TestCantonProvider>
      ),
    })
    act(() => {
      client.__emitTx({ source: 'wallet', updateId: 'u1', status: 'submitted', raw: {} })
    })
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ updateId: 'u1' })
    )
  })

  it('tears down subscription on unmount', () => {
    let unsubCalled = false
    const client = createFakeCantonClient({
      subscribeToTransactions: ((opts: never) => {
        return () => {
          unsubCalled = true
        }
      }) as never,
    })
    const { unmount } = renderHook(() => useTransactionStream({}), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <TestCantonProvider client={client}>{children}</TestCantonProvider>
      ),
    })
    unmount()
    expect(unsubCalled).toBe(true)
  })

  it('clear() empties the buffer', () => {
    const client = createFakeCantonClient()
    const { result } = renderHook(() => useTransactionStream({}), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <TestCantonProvider client={client}>{children}</TestCantonProvider>
      ),
    })
    act(() => {
      client.__emitTx({ source: 'wallet', updateId: 'u1', status: 'submitted', raw: {} })
    })
    expect(result.current.events).toHaveLength(1)
    act(() => result.current.clear())
    expect(result.current.events).toHaveLength(0)
  })

  it('surfaces onError and clears isConnected when transport reports an error', () => {
    const client = createFakeCantonClient({
      subscribeToTransactions: ((opts: {
        onError?: (e: unknown) => void
      }) => {
        // Fire an error synchronously on subscribe.
        opts.onError?.(new Error('boom'))
        return () => undefined
      }) as never,
    })
    const { result } = renderHook(() => useTransactionStream({}), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <TestCantonProvider client={client}>{children}</TestCantonProvider>
      ),
    })
    expect(result.current.error).not.toBeNull()
    expect((result.current.error as { code?: string })?.code).toBe('STREAM_CLOSED')
    expect(result.current.isConnected).toBe(false)
  })
})
