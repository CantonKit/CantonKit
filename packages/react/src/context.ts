import { createContext, useContext } from 'react'
import type { CantonClient } from '@cantonkit/core'
import type { DappClient } from '@canton-network/dapp-sdk'

export interface Wallet {
  partyId: string
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface CantonContextValue {
  client: CantonClient
  dappClient: DappClient
  status: ConnectionStatus
  accounts: Wallet[]
  activeParty: string | null
  connect: (opts?: { additionalAdapters?: unknown[] }) => Promise<void>
  disconnect: () => Promise<void>
}

export const CantonContext = createContext<CantonContextValue | null>(null)

export function useCantonClient(): CantonClient {
  const ctx = useContext(CantonContext)
  if (!ctx) throw new Error('useCantonClient must be used inside <CantonProvider>')
  return ctx.client
}

export function useCantonConnection(): Omit<CantonContextValue, 'client' | 'dappClient'> {
  const ctx = useContext(CantonContext)
  if (!ctx) throw new Error('useCantonConnection must be used inside <CantonProvider>')
  const { status, accounts, activeParty, connect, disconnect } = ctx
  return { status, accounts, activeParty, connect, disconnect }
}

/** @internal — escape hatch for tests and advanced users. */
export function useCantonContextRaw(): CantonContextValue {
  const ctx = useContext(CantonContext)
  if (!ctx) throw new Error('CantonContext must be used inside <CantonProvider>')
  return ctx
}
