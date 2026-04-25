export { WalletProvider } from './WalletProvider.js'
export type { WalletProviderConfig, WalletProviderProps } from './WalletProvider.js'

export { LedgerProvider } from './LedgerProvider.js'
export type { LedgerProviderConfig, LedgerProviderProps, LedgerAuthConfig } from './LedgerProvider.js'

export { useCantonAuth } from './hooks/useCantonAuth.js'
export type { CantonAuthState } from './LedgerContext.js'

// Deprecated — kept for one release cycle
export { CantonProvider } from './CantonProvider.js'
export type { CantonProviderConfig, CantonProviderProps } from './CantonProvider.js'

export { CantonContext, useCantonClient, useCantonConnection } from './context.js'
export type { CantonContextValue, ConnectionStatus, Wallet } from './context.js'

export { useContracts } from './hooks/useContracts.js'
export type { UseContractsOptions } from './hooks/useContracts.js'

export { useSubmit } from './hooks/useSubmit.js'
export type { UseSubmitOptions } from './hooks/useSubmit.js'

export { useTransactionStream } from './hooks/useTransactionStream.js'
export type { UseTransactionStreamOptions } from './hooks/useTransactionStream.js'

// Re-export commonly used core types so apps need fewer imports.
export type {
  CantonClient,
  CantonError,
  CantonErrorCode,
  ActiveContract,
  QueryACSOptions,
  SubmitOptions,
  SubmitResult,
  TemplateId,
  Command,
  CreateCommand,
  ExerciseCommand,
  ExerciseByKeyCommand,
  TransactionEvent,
  WalletTxEvent,
  LedgerTxEvent,
  SubscribeOptions,
  Unsubscribe,
  Transaction,
} from '@cantonkit/core'
export { templateId } from '@cantonkit/core'
