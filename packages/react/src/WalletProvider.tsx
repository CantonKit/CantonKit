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

export type WalletProviderConfig =
  | {
      mode: 'gateway'
      gatewayUrl: string
      additionalAdapters?: unknown[]
      dappClient?: DappClient
      queryClient?: QC
    }
  | {
      mode: 'extension'
      additionalAdapters?: unknown[]
      dappClient?: DappClient
      queryClient?: QC
    }

export interface WalletProviderProps {
  config: WalletProviderConfig
  children: ReactNode
}

function defaultQueryClient(): QC {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
    },
  })
}

async function constructDappClient(config: WalletProviderConfig): Promise<DappClient> {
  if (config.dappClient) return config.dappClient
  if (!isBrowser) {
    throw new Error('WalletProvider: DappClient can only be constructed in the browser')
  }
  const mod = await import('@canton-network/dapp-sdk')
  const { DappClient, DiscoveryClient, RemoteAdapter, ExtensionAdapter } = mod as unknown as {
    DappClient: new (provider: unknown, opts?: unknown) => DappClient
    DiscoveryClient: { create: (opts: { adapters: unknown[] }) => Promise<{
      connect: () => Promise<void>
      getActiveSession: () => { provider: unknown; adapter: { type: string } } | null
    }> }
    RemoteAdapter: new (opts: { name: string; rpcUrl: string }) => { provider: () => unknown }
    ExtensionAdapter: new () => { provider: () => unknown }
  }

  const modeAdapters =
    config.mode === 'gateway'
      ? [new RemoteAdapter({ name: 'Default Gateway', rpcUrl: config.gatewayUrl })]
      : [new ExtensionAdapter()]

  const adapters = [...modeAdapters, ...((config.additionalAdapters ?? []) as never[])]
  const discovery = await DiscoveryClient.create({ adapters })
  const session = discovery.getActiveSession()
  if (session) {
    return new DappClient(session.provider, { providerType: session.adapter.type })
  }
  const provider = (adapters[0] as { provider: () => unknown }).provider()
  return new DappClient(provider)
}

export function WalletProvider({ config, children }: WalletProviderProps): JSX.Element {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [accounts, setAccounts] = useState<Wallet[]>([])
  const [dappClient, setDappClient] = useState<DappClient | null>(
    config.dappClient ?? null
  )
  const clientRef = useRef<CantonClient | null>(null)
  if (config.dappClient && !clientRef.current) {
    const clientOpts: CreateCantonClientOptions = { dappClient: config.dappClient }
    clientRef.current = createCantonClient(clientOpts)
  }
  const queryClient = useMemo(() => config.queryClient ?? defaultQueryClient(), [config.queryClient])

  useEffect(() => {
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
        clientRef.current = createCantonClient({ dappClient: dc })
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
      clientRef.current?.destroy()
      clientRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config.mode,
    (config as { gatewayUrl?: string }).gatewayUrl,
    config.dappClient,
  ])

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

  const connect = useCallback(async () => {
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
  }, [dappClient])

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
