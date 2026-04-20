export type CantonErrorCode =
  | 'NOT_CONNECTED'
  | 'WALLET_REJECTED'
  | 'LEDGER_HTTP'
  | 'LEDGER_TIMEOUT'
  | 'STREAM_CLOSED'
  | 'INVALID_ARGUMENT'
  | 'UNKNOWN'

export interface CantonErrorOptions {
  status?: number
  cause?: unknown
}

export class CantonError extends Error {
  readonly code: CantonErrorCode
  readonly status: number | undefined
  readonly cause: unknown

  constructor(code: CantonErrorCode, message: string, opts: CantonErrorOptions = {}) {
    super(message)
    this.name = 'CantonError'
    this.code = code
    this.status = opts.status
    this.cause = opts.cause
  }

  static wrap(err: unknown, fallbackCode: CantonErrorCode): CantonError {
    if (err instanceof CantonError) return err
    if (err instanceof Error) {
      return new CantonError(fallbackCode, err.message, { cause: err })
    }
    return new CantonError(fallbackCode, String(err), { cause: err })
  }
}
