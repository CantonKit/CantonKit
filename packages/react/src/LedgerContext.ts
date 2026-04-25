import { createContext, useContext } from 'react'

export interface CantonAuthState {
  isAuthenticated: boolean
  token: string | undefined
  login: () => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export const LedgerAuthContext = createContext<CantonAuthState | null>(null)

export function useLedgerAuthContext(): CantonAuthState {
  const ctx = useContext(LedgerAuthContext)
  if (!ctx) throw new Error('useCantonAuth must be used inside <LedgerProvider>')
  return ctx
}
