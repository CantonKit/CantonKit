import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import { CantonError } from '@cantonkit/core'
import type { SubscribeOptions, TransactionEvent } from '@cantonkit/core'
import { useCantonClient } from '../context.js'

export interface UseTransactionStreamOptions {
  source?: SubscribeOptions['source']
  filter?: SubscribeOptions['filter']
  /**
   * Called synchronously inside the store's event push, before React
   * schedules a re-render. Suitable for fire-and-forget side effects
   * (toasts, analytics) that must not wait for a render pass.
   */
  onEvent?: (event: TransactionEvent) => void
  bufferSize?: number
}

interface StreamSnapshot {
  events: TransactionEvent[]
  isConnected: boolean
  error: CantonError | null
}

const EMPTY_SNAPSHOT: StreamSnapshot = { events: [], isConnected: false, error: null }

interface StreamStore {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => StreamSnapshot
  clear: () => void
}

function createStreamStore(
  subscribeFn: (push: (event: TransactionEvent) => void, fail: (err: CantonError) => void) => () => void,
  bufferSize: number
): StreamStore {
  let snapshot: StreamSnapshot = { events: [], isConnected: false, error: null }
  const listeners = new Set<() => void>()
  let unsub: (() => void) | null = null

  function emit() {
    listeners.forEach((l) => l())
  }

  function ensureStarted() {
    if (unsub) return
    try {
      unsub = subscribeFn(
        (event) => {
          const next = [event, ...snapshot.events].slice(0, bufferSize)
          snapshot = { ...snapshot, events: next, isConnected: true }
          emit()
        },
        (err) => {
          snapshot = { ...snapshot, isConnected: false, error: err }
          emit()
        }
      )
    } catch (err) {
      snapshot = { ...snapshot, isConnected: false, error: err as CantonError }
      emit()
      return
    }
    if (!snapshot.error) {
      snapshot = { ...snapshot, isConnected: true }
      emit()
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      ensureStarted()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          unsub?.()
          unsub = null
        }
      }
    },
    getSnapshot: () => snapshot,
    clear() {
      snapshot = { ...snapshot, events: [] }
      emit()
    },
  }
}

export function useTransactionStream(opts: UseTransactionStreamOptions): {
  events: TransactionEvent[]
  isConnected: boolean
  error: CantonError | null
  clear: () => void
} {
  const client = useCantonClient()
  const bufferSize = opts.bufferSize ?? 50
  const onEventRef = useRef(opts.onEvent)
  onEventRef.current = opts.onEvent

  // Stable key so changing filter/source resubscribes exactly once.
  const key = useMemo(
    () => JSON.stringify({ source: opts.source, filter: opts.filter }),
    [opts.source, opts.filter]
  )

  const store = useMemo(() => {
    return createStreamStore((push, fail) => {
      return client.subscribeToTransactions({
        ...(opts.source !== undefined ? { source: opts.source } : {}),
        ...(opts.filter !== undefined ? { filter: opts.filter } : {}),
        onEvent: (event) => {
          onEventRef.current?.(event)
          push(event)
        },
        onError: (err) => fail(CantonError.wrap(err, 'STREAM_CLOSED')),
      })
    }, bufferSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, key, bufferSize])

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY_SNAPSHOT)
  const clear = useCallback(() => store.clear(), [store])

  return { ...snapshot, clear }
}
