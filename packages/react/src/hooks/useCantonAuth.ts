import { useLedgerAuthContext, type CantonAuthState } from '../LedgerContext.js'

export function useCantonAuth(): CantonAuthState {
  return useLedgerAuthContext()
}
