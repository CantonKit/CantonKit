export { createCantonClient, createJsonLedgerClient } from './client.js'
export type { CantonClient, CreateCantonClientOptions, JsonLedgerClientOptions } from './client.js'

export { CantonError } from './error.js'
export type { CantonErrorCode } from './error.js'

export type {
  TemplateId,
  Command,
  CreateCommand,
  ExerciseCommand,
  ExerciseByKeyCommand,
  SubmitOptions,
  SubmitResult,
} from './types/commands.js'
export { templateId } from './types/commands.js'

export type { ActiveContract, QueryACSOptions } from './types/contracts.js'
export type {
  TransactionEvent,
  WalletTxEvent,
  LedgerTxEvent,
  SubscribeOptions,
  Unsubscribe,
  Transaction,
} from './types/transactions.js'

// Test fixture — exported so @cantonkit/react's testing subpath can reuse it.
export { createFakeDappClient } from './test/fakeDappClient.js'
export type { FakeDappClient } from './test/fakeDappClient.js'
