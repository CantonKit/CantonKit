import { describe, it, expect } from 'vitest'
import { CantonError } from './error.js'

describe('CantonError', () => {
  it('preserves code, message, status, and cause', () => {
    const cause = new Error('underlying')
    const err = new CantonError('LEDGER_HTTP', 'bad response', { status: 500, cause })
    expect(err.name).toBe('CantonError')
    expect(err.code).toBe('LEDGER_HTTP')
    expect(err.message).toBe('bad response')
    expect(err.status).toBe(500)
    expect(err.cause).toBe(cause)
    expect(err instanceof Error).toBe(true)
  })

  it('supports construction without status or cause', () => {
    const err = new CantonError('NOT_CONNECTED', 'no wallet')
    expect(err.status).toBeUndefined()
    expect(err.cause).toBeUndefined()
  })

  it('has a static wrap helper that converts unknown errors', () => {
    const existing = new CantonError('NOT_CONNECTED', 'already typed')
    expect(CantonError.wrap(existing, 'UNKNOWN')).toBe(existing)

    const wrapped = CantonError.wrap(new Error('raw'), 'UNKNOWN')
    expect(wrapped).toBeInstanceOf(CantonError)
    expect(wrapped.code).toBe('UNKNOWN')
    expect(wrapped.cause).toBeInstanceOf(Error)

    const fromString = CantonError.wrap('oops', 'LEDGER_HTTP')
    expect(fromString.code).toBe('LEDGER_HTTP')
    expect(fromString.message).toBe('oops')
  })
})
