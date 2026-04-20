import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CantonClient } from '@cantonkit/core'
import { CantonContext, type CantonContextValue, type ConnectionStatus, type Wallet } from '../context.js'

export interface TestCantonProviderProps {
  client: CantonClient
  status?: ConnectionStatus
  accounts?: Wallet[]
  activeParty?: string | null
  queryClient?: QueryClient
  children: ReactNode
}

export function TestCantonProvider({
  client,
  status = 'connected',
  accounts = [{ partyId: 'Alice' }],
  activeParty,
  queryClient,
  children,
}: TestCantonProviderProps) {
  const qc =
    queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })

  const value: CantonContextValue = {
    client,
    dappClient: {} as never,
    status,
    accounts,
    activeParty: activeParty ?? (accounts[0]?.partyId ?? null),
    connect: async () => undefined,
    disconnect: async () => undefined,
  }

  return (
    <QueryClientProvider client={qc}>
      <CantonContext.Provider value={value}>{children}</CantonContext.Provider>
    </QueryClientProvider>
  )
}
