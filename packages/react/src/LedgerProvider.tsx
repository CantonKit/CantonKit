import {
  useCallback,
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
import { createJsonLedgerClient, type CantonClient } from '@cantonkit/core'
import { CantonContext, type CantonContextValue, type Wallet } from './context.js'
import { LedgerAuthContext, type CantonAuthState } from './LedgerContext.js'

export type LedgerAuthConfig =
  | { mode: 'static'; token?: string }
  | { mode: 'oauth2'; issuerUrl: string; clientId: string }

export interface LedgerProviderConfig {
  ledgerUrl: string
  party: string
  auth: LedgerAuthConfig
  maxReconnectAttempts?: number
  queryClient?: QC
}

export interface LedgerProviderProps {
  config: LedgerProviderConfig
  children: ReactNode
}

function defaultQueryClient(): QC {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
    },
  })
}

export function LedgerProvider({ config, children }: LedgerProviderProps): JSX.Element {
  const [token, setToken] = useState<string | undefined>(
    config.auth.mode === 'static' ? config.auth.token : undefined
  )

  // tokenRef lets getToken always read the latest token without rebuilding the client.
  const tokenRef = useRef(token)
  tokenRef.current = token

  const clientRef = useRef<CantonClient | null>(null)
  if (!clientRef.current) {
    clientRef.current = createJsonLedgerClient({
      ledgerUrl: config.ledgerUrl,
      party: config.party,
      getToken: () => tokenRef.current,
      ...(config.maxReconnectAttempts !== undefined
        ? { maxReconnectAttempts: config.maxReconnectAttempts }
        : {}),
    })
  }

  const queryClient = useMemo(
    () => config.queryClient ?? defaultQueryClient(),
    [config.queryClient]
  )

  const login = useCallback(async () => {
    if (config.auth.mode === 'oauth2') {
      throw new Error('OAuth2 login not yet implemented')
    }
    // static mode: no-op
  }, [config.auth.mode])

  const logout = useCallback(async () => {
    setToken(undefined)
  }, [])

  const refresh = useCallback(async () => {
    if (config.auth.mode === 'oauth2') {
      throw new Error('OAuth2 refresh not yet implemented')
    }
    // static mode: no-op
  }, [config.auth.mode])

  const authValue: CantonAuthState = useMemo(
    () => ({ isAuthenticated: token !== undefined, token, login, logout, refresh }),
    [token, login, logout, refresh]
  )

  const party = config.party
  const cantonValue: CantonContextValue = useMemo(
    () => ({
      client: clientRef.current!,
      dappClient: null as never,
      status: token !== undefined ? 'connected' : 'disconnected',
      accounts: token !== undefined ? [{ partyId: party }] as Wallet[] : [],
      activeParty: token !== undefined ? party : null,
      connect: login,
      disconnect: logout,
    }),
    [token, party, login, logout]
  )

  return (
    <QueryClientProvider client={queryClient}>
      <LedgerAuthContext.Provider value={authValue}>
        <CantonContext.Provider value={cantonValue}>
          {children}
        </CantonContext.Provider>
      </LedgerAuthContext.Provider>
    </QueryClientProvider>
  )
}
