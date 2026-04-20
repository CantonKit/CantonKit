import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import {
  CantonContext,
  type CantonContextValue,
  useCantonClient,
  useCantonConnection,
  useCantonContextRaw,
} from './context.js'

function makeValue(): CantonContextValue {
  const fakeClient = { destroy: () => undefined } as never
  return {
    client: fakeClient,
    dappClient: {} as never,
    status: 'connected',
    accounts: [{ partyId: 'Alice' }],
    activeParty: 'Alice',
    connect: async () => undefined,
    disconnect: async () => undefined,
  }
}

function wrap(value: CantonContextValue) {
  return ({ children }: { children: ReactNode }) => (
    <CantonContext.Provider value={value}>{children}</CantonContext.Provider>
  )
}

describe('context hooks', () => {
  it('useCantonClient throws outside a provider', () => {
    expect(() => renderHook(() => useCantonClient())).toThrow(/CantonProvider/)
  })

  it('useCantonConnection throws outside a provider', () => {
    expect(() => renderHook(() => useCantonConnection())).toThrow(/CantonProvider/)
  })

  it('useCantonContextRaw throws outside a provider', () => {
    expect(() => renderHook(() => useCantonContextRaw())).toThrow(/CantonContext/)
  })

  it('useCantonClient returns the client when wrapped', () => {
    const value = makeValue()
    const { result } = renderHook(() => useCantonClient(), { wrapper: wrap(value) })
    expect(result.current).toBe(value.client)
  })

  it('useCantonConnection returns only the connection slice', () => {
    const value = makeValue()
    const { result } = renderHook(() => useCantonConnection(), { wrapper: wrap(value) })
    expect(result.current).toEqual({
      status: 'connected',
      accounts: [{ partyId: 'Alice' }],
      activeParty: 'Alice',
      connect: value.connect,
      disconnect: value.disconnect,
    })
    // client and dappClient must NOT be surfaced
    expect('client' in result.current).toBe(false)
    expect('dappClient' in result.current).toBe(false)
  })

  it('useCantonContextRaw returns the full context value', () => {
    const value = makeValue()
    const { result } = renderHook(() => useCantonContextRaw(), { wrapper: wrap(value) })
    expect(result.current).toBe(value)
  })
})
