import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  QueryClient,
  QueryClientProvider,
  type QueryClient as QC,
} from '@tanstack/react-query'
import type { DappClient } from '@canton-network/dapp-sdk'
import {
  createCantonClient,
  type CantonClient,
  type CreateCantonClientOptions,
} from '@cantonkit/core'
import {
  CantonContext,
  type CantonContextValue,
  type ConnectionStatus,
  type Wallet,
} from './context.js'
import { isBrowser } from './ssr.js'

export interface CantonProviderConfig {
  gatewayUrl: string
  ledgerUrl?: string
  auth?: { token: string }
  /** Inject an existing DappClient. Typical in tests or when sharing across providers. */
  dappClient?: DappClient
  queryClient?: QC
  additionalAdapters?: unknown[]
}

export interface CantonProviderProps {
  config: CantonProviderConfig
  children: ReactNode
}

function defaultQueryClient(): QC {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
    },
  })
}

async function constructDappClient(
  config: CantonProviderConfig
): Promise<DappClient> {
  if (config.dappClient) return config.dappClient
  if (!isBrowser) {
    throw new Error('CantonProvider: DappClient can only be constructed in the browser')
  }
  // Dynamic import keeps SSR bundles clean.
  const mod = await import('@canton-network/dapp-sdk')
  const { DappClient, DiscoveryClient, RemoteAdapter } = mod as unknown as {
    DappClient: new (provider: unknown, opts?: unknown) => DappClient
    DiscoveryClient: { create: (opts: { adapters: unknown[] }) => Promise<{
      connect: () => Promise<void>
      getActiveSession: () => { provider: unknown; adapter: { type: string } } | null
    }> }
    RemoteAdapter: new (opts: { name: string; rpcUrl: string }) => {
      provider: () => unknown
    }
  }
  const adapters = [
    new RemoteAdapter({ name: 'Default Gateway', rpcUrl: config.gatewayUrl }),
    ...((config.additionalAdapters ?? []) as never[]),
  ]
  const discovery = await DiscoveryClient.create({ adapters })
  // Hydrate from saved session without opening the picker — provider is idle until connect().
  const session = discovery.getActiveSession()
  if (session) {
    return new DappClient(session.provider, { providerType: session.adapter.type })
  }
  const provider = (adapters[0] as { provider: () => unknown }).provider()
  return new DappClient(provider)
}

export function CantonProvider({ config, children }: CantonProviderProps): JSX.Element {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [accounts, setAccounts] = useState<Wallet[]>([])
  // When a DappClient is injected (tests / shared providers), surface it
  // synchronously so context is ready on first render.
  const [dappClient, setDappClient] = useState<DappClient | null>(
    config.dappClient ?? null
  )
  const clientRef = useRef<CantonClient | null>(null)
  if (config.dappClient && !clientRef.current) {
    const clientOpts: CreateCantonClientOptions = { dappClient: config.dappClient }
    if (config.ledgerUrl) clientOpts.ledgerUrl = config.ledgerUrl
    if (config.auth) clientOpts.auth = config.auth
    clientRef.current = createCantonClient(clientOpts)
  }
  const queryClient = useMemo(() => config.queryClient ?? defaultQueryClient(), [config.queryClient])

  useEffect(() => {
    // Skip construction when a DappClient was injected — context is already ready.
    if (config.dappClient) {
      return () => {
        clientRef.current?.destroy()
        clientRef.current = null
      }
    }
    let cancelled = false
    constructDappClient(config)
      .then((dc) => {
        if (cancelled) return
        setDappClient(dc)
        const clientOpts: CreateCantonClientOptions = { dappClient: dc }
        if (config.ledgerUrl) clientOpts.ledgerUrl = config.ledgerUrl
        if (config.auth) clientOpts.auth = config.auth
        clientRef.current = createCantonClient(clientOpts)
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
      clientRef.current?.destroy()
      clientRef.current = null
    }
  }, [config.gatewayUrl, config.ledgerUrl, config.auth?.token, config.dappClient])

  useEffect(() => {
    if (!dappClient) return
    const statusListener = (evt: unknown) => {
      const isConnected = (evt as { connection?: { isConnected?: boolean } }).connection?.isConnected
      setStatus(isConnected ? 'connected' : 'disconnected')
    }
    const accountsListener = (evt: unknown) => {
      const list = (evt as { accounts?: Wallet[] }).accounts ?? []
      setAccounts(list)
    }
    dappClient.onStatusChanged(statusListener as never)
    dappClient.onAccountsChanged(accountsListener as never)
    return () => {
      dappClient.removeOnStatusChanged(statusListener as never)
      dappClient.removeOnAccountsChanged(accountsListener as never)
    }
  }, [dappClient])

  const connect = useCallback(
    async (_opts?: { additionalAdapters?: unknown[] }) => {
      if (!dappClient) throw new Error('DappClient not ready')
      setStatus('connecting')
      try {
        await dappClient.connect()
        const list = await dappClient.listAccounts()
        setAccounts(list as Wallet[])
        setStatus('connected')
      } catch (err) {
        setStatus('error')
        throw err
      }
    },
    [dappClient]
  )

  const disconnect = useCallback(async () => {
    if (!dappClient) return
    await dappClient.disconnect()
    setStatus('disconnected')
    setAccounts([])
  }, [dappClient])

  const value: CantonContextValue | null = useMemo(() => {
    if (!dappClient || !clientRef.current) return null
    return {
      client: clientRef.current,
      dappClient,
      status,
      accounts,
      activeParty: accounts[0]?.partyId ?? null,
      connect,
      disconnect,
    }
  }, [dappClient, status, accounts, connect, disconnect])

  return (
    <QueryClientProvider client={queryClient}>
      {value ? (
        <CantonContext.Provider value={value}>{children}</CantonContext.Provider>
      ) : (
        children
      )}
    </QueryClientProvider>
  )
}
