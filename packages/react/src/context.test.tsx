import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createContext } from 'react'
import {
  CantonContext,
  useCantonClient,
  useCantonConnection,
} from './context.js'

describe('context hooks', () => {
  it('useCantonClient throws outside a provider', () => {
    expect(() => renderHook(() => useCantonClient())).toThrow(/CantonProvider/)
  })

  it('useCantonConnection throws outside a provider', () => {
    expect(() => renderHook(() => useCantonConnection())).toThrow(/CantonProvider/)
  })

  it('returns the context value when wrapped', () => {
    const fakeClient = { destroy: () => undefined } as never
    const value = {
      client: fakeClient,
      dappClient: {} as never,
      status: 'connected' as const,
      accounts: [{ partyId: 'Alice' }] as never,
      activeParty: 'Alice',
      connect: async () => undefined,
      disconnect: async () => undefined,
    }
    const { result } = renderHook(() => useCantonClient(), {
      wrapper: ({ children }) => (
        <CantonContext.Provider value={value}>{children}</CantonContext.Provider>
      ),
    })
    expect(result.current).toBe(fakeClient)
  })
})
