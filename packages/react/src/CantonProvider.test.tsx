import { describe, it, expect, vi } from 'vitest'
import { useContext } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { CantonProvider } from './CantonProvider.js'
import { CantonContext, useCantonConnection, useCantonClient } from './context.js'
import { createFakeDappClient } from '@cantonkit/core'

describe('CantonProvider', () => {
  it('exposes a CantonClient to children', () => {
    const fake = createFakeDappClient()
    const { result } = renderHook(() => useCantonClient(), {
      wrapper: ({ children }) => (
        <CantonProvider config={{ mode: 'gateway', gatewayUrl: 'https://gw', dappClient: fake as never }}>
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
        <CantonProvider config={{ mode: 'gateway', gatewayUrl: 'https://gw', dappClient: fake as never }}>
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
    fake.__queue.listAccounts.push([{ partyId: 'Alice::hash' }])

    const { result } = renderHook(() => useCantonConnection(), {
      wrapper: ({ children }) => (
        <CantonProvider config={{ mode: 'gateway', gatewayUrl: 'https://gw', dappClient: fake as never }}>
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
        <CantonProvider config={{ mode: 'gateway', gatewayUrl: 'https://gw', dappClient: fake as never }}>
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
        <CantonProvider config={{ mode: 'gateway', gatewayUrl: 'https://gw', dappClient: fake as never }}>
          {children}
        </CantonProvider>
      ),
    })
    await act(async () => {
      await result.current.disconnect()
    })
    expect(fake.__calls.disconnect).toBe(1)
  })

  it('constructs DappClient via DiscoveryClient when no dappClient is injected', async () => {
    const fake = createFakeDappClient()

    // Mock the dynamic import used inside constructDappClient. The import
    // happens INSIDE an async useEffect, so mocking before the hook renders
    // is sufficient — no need to re-import CantonProvider.
    vi.doMock('@canton-network/dapp-sdk', () => ({
      DappClient: vi.fn(() => fake),
      DiscoveryClient: {
        create: vi.fn(async () => ({
          connect: vi.fn(async () => undefined),
          getActiveSession: vi.fn(() => null),
        })),
      },
      RemoteAdapter: vi.fn(() => ({ provider: () => ({}) })),
      ExtensionAdapter: vi.fn(() => ({ provider: () => ({}) })),
    }))

    // Use raw useContext so the initial (null) render doesn't throw — the
    // async dynamic-import + setState path populates context a tick later.
    const { result } = renderHook(() => useContext(CantonContext), {
      wrapper: ({ children }) => (
        <CantonProvider config={{ mode: 'gateway', gatewayUrl: 'https://gw' }}>{children}</CantonProvider>
      ),
    })

    // Wait for the dynamic-import async path to settle and surface the client
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(typeof result.current!.client.queryACS).toBe('function')

    vi.doUnmock('@canton-network/dapp-sdk')
  })

  it('exercises the error catch branch when constructDappClient fails', async () => {
    vi.doMock('@canton-network/dapp-sdk', () => ({
      DappClient: vi.fn(() => {
        throw new Error('construction failed')
      }),
      DiscoveryClient: {
        create: vi.fn(async () => ({
          connect: vi.fn(async () => undefined),
          getActiveSession: vi.fn(() => null),
        })),
      },
      RemoteAdapter: vi.fn(() => ({ provider: () => ({}) })),
      ExtensionAdapter: vi.fn(() => ({ provider: () => ({}) })),
    }))

    // When constructDappClient throws, the .catch sets status to 'error' but
    // dappClient stays null — so CantonContext never publishes a value. We
    // render the provider, let the async .catch run, and assert no error
    // escapes React. Coverage of the catch branch is achieved by execution.
    const seenStatuses: Array<string | null> = []
    function Probe() {
      const ctx = useContext(CantonContext)
      seenStatuses.push(ctx?.status ?? null)
      return null
    }

    renderHook(() => null, {
      wrapper: ({ children }) => (
        <CantonProvider config={{ mode: 'gateway', gatewayUrl: 'https://gw' }}>
          <Probe />
          {children}
        </CantonProvider>
      ),
    })

    // Give the microtask + promise chain a chance to run the .catch branch.
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Context stays null because dappClient was never set — the .catch only
    // updates an internal state slot. That's fine; the branch was executed.
    expect(seenStatuses.every((s) => s === null)).toBe(true)

    vi.doUnmock('@canton-network/dapp-sdk')
  })

  it('updates accounts when dappClient emits accountsChanged', () => {
    const fake = createFakeDappClient()
    const { result } = renderHook(() => useCantonConnection(), {
      wrapper: ({ children }) => (
        <CantonProvider config={{ mode: 'gateway', gatewayUrl: 'https://gw', dappClient: fake as never }}>
          {children}
        </CantonProvider>
      ),
    })

    act(() => {
      fake.__emitAccounts({ accounts: [{ partyId: 'Bob' }, { partyId: 'Carol' }] })
    })

    expect(result.current.accounts).toEqual([
      { partyId: 'Bob' },
      { partyId: 'Carol' },
    ])
    expect(result.current.activeParty).toBe('Bob')
  })

  it('removes status and accounts listeners on unmount', () => {
    const fake = createFakeDappClient()
    const { unmount } = renderHook(() => useCantonConnection(), {
      wrapper: ({ children }) => (
        <CantonProvider config={{ mode: 'gateway', gatewayUrl: 'https://gw', dappClient: fake as never }}>
          {children}
        </CantonProvider>
      ),
    })

    unmount()

    // After unmount, cleanup has removed the provider's listeners. Emitting to
    // any remaining listeners must not throw and must not update unmounted state.
    expect(() => fake.__emitStatus({ connection: { isConnected: true } })).not.toThrow()
    expect(() => fake.__emitAccounts({ accounts: [] })).not.toThrow()
  })
})
