import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { LedgerProvider } from './LedgerProvider.js'
import { useCantonAuth } from './hooks/useCantonAuth.js'
import { useCantonClient } from './context.js'

const wrapper =
  (token?: string) =>
  ({ children }: { children: React.ReactNode }) =>
    (
      <LedgerProvider
        config={{
          ledgerUrl: 'http://localhost:7575',
          party: 'Alice::abc',
          auth: { mode: 'static', token },
        }}
      >
        {children}
      </LedgerProvider>
    )

describe('LedgerProvider', () => {
  it('exposes a CantonClient to children', () => {
    const { result } = renderHook(() => useCantonClient(), { wrapper: wrapper('tok') })
    expect(typeof result.current.queryACS).toBe('function')
  })

  it('useCantonAuth returns isAuthenticated=true when token is provided', () => {
    const { result } = renderHook(() => useCantonAuth(), { wrapper: wrapper('tok') })
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.token).toBe('tok')
  })

  it('useCantonAuth returns isAuthenticated=false when token is undefined', () => {
    const { result } = renderHook(() => useCantonAuth(), { wrapper: wrapper(undefined) })
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.token).toBeUndefined()
  })

  it('logout clears the token', async () => {
    const { result } = renderHook(() => useCantonAuth(), { wrapper: wrapper('tok') })
    await act(async () => { await result.current.logout() })
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.token).toBeUndefined()
  })

  it('login and refresh are no-ops in static mode', async () => {
    const { result } = renderHook(() => useCantonAuth(), { wrapper: wrapper('tok') })
    await act(async () => { await result.current.login() })
    await act(async () => { await result.current.refresh() })
    expect(result.current.token).toBe('tok')
  })
})
