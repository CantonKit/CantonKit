import { describe, it, expect } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { CantonProvider } from './CantonProvider.js'
import { useCantonConnection, useCantonClient } from './context.js'
import { createFakeDappClient } from '@cantonkit/core'

describe('CantonProvider', () => {
  it('exposes a CantonClient to children', () => {
    const fake = createFakeDappClient()
    const { result } = renderHook(() => useCantonClient(), {
      wrapper: ({ children }) => (
        <CantonProvider config={{ gatewayUrl: 'https://gw', dappClient: fake as never }}>
          {children}
        </CantonProvider>
      ),
    })
    expect(result.current).toBeDefined()
    expect(typeof result.current.queryACS).toBe('function')
  })

  it('starts disconnected with no accounts', () => {
    const fake = createFakeDappClient()
    const { result } = renderHook(() => useCantonConnection(), {
      wrapper: ({ children }) => (
        <CantonProvider config={{ gatewayUrl: 'https://gw', dappClient: fake as never }}>
          {children}
        </CantonProvider>
      ),
    })
    expect(result.current.status).toBe('disconnected')
    expect(result.current.accounts).toEqual([])
    expect(result.current.activeParty).toBeNull()
  })

  it('transitions disconnected → connecting → connected during connect()', async () => {
    const fake = createFakeDappClient()
    fake.__queue.connect.push({ kind: 'ok', value: { isConnected: true } })
    fake.__queue.listAccounts.push({ accounts: [{ partyId: 'Alice::hash' }] })

    const { result } = renderHook(() => useCantonConnection(), {
      wrapper: ({ children }) => (
        <CantonProvider config={{ gatewayUrl: 'https://gw', dappClient: fake as never }}>
          {children}
        </CantonProvider>
      ),
    })

    await act(async () => {
      await result.current.connect()
    })

    await waitFor(() => expect(result.current.status).toBe('connected'))
    expect(result.current.activeParty).toBe('Alice::hash')
  })

  it('transitions to error state on connect failure', async () => {
    const fake = createFakeDappClient()
    fake.__queue.connect.push({ kind: 'err', error: new Error('nope') })

    const { result } = renderHook(() => useCantonConnection(), {
      wrapper: ({ children }) => (
        <CantonProvider config={{ gatewayUrl: 'https://gw', dappClient: fake as never }}>
          {children}
        </CantonProvider>
      ),
    })

    await act(async () => {
      await result.current.connect().catch(() => undefined)
    })

    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('calls dapp.disconnect on disconnect()', async () => {
    const fake = createFakeDappClient()
    const { result } = renderHook(() => useCantonConnection(), {
      wrapper: ({ children }) => (
        <CantonProvider config={{ gatewayUrl: 'https://gw', dappClient: fake as never }}>
          {children}
        </CantonProvider>
      ),
    })
    await act(async () => {
      await result.current.disconnect()
    })
    expect(fake.__calls.disconnect).toBe(1)
  })
})
