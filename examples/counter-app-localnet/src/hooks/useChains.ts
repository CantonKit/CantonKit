import { useMemo, useRef } from 'react'
import type { StreamEvent } from '../components/ActivityItem'

export interface CounterPayload {
  owner: string
  count: number
}

export interface ActiveCounter {
  contractId: string
  payload: CounterPayload
}

export interface ChainNodeData {
  contractId: string
  count: number
  archived: boolean
}

export interface Chain {
  rootId: string
  headId: string
  head: ActiveCounter
  nodes: ChainNodeData[]
  partial: boolean
}

interface ChainGraph {
  countById: Map<string, number>
  nextOf: Map<string, string>
  prevOf: Map<string, string>
  rootIds: Set<string>
}

function buildChainGraph(events: StreamEvent[]): ChainGraph {
  const countById = new Map<string, number>()
  const nextOf = new Map<string, string>()
  const prevOf = new Map<string, string>()
  const rootIds = new Set<string>()

  for (const e of events) {
    if (e.source !== 'ledger') continue

    const created: Array<{ contractId: string; count: number }> = []
    const archived: string[] = []
    for (const ev of e.events) {
      if (ev.kind === 'created') {
        const payload = ev.payload as { count?: unknown } | undefined
        const count = typeof payload?.count === 'number' ? payload.count : 0
        countById.set(ev.contractId, count)
        created.push({ contractId: ev.contractId, count })
      } else if (ev.kind === 'archived') {
        archived.push(ev.contractId)
      }
    }

    if (created.length === 1 && archived.length === 0) {
      rootIds.add(created[0].contractId)
    } else if (created.length === 1 && archived.length === 1) {
      nextOf.set(archived[0], created[0].contractId)
      prevOf.set(created[0].contractId, archived[0])
    }
  }

  return { countById, nextOf, prevOf, rootIds }
}

export function buildChains(
  rows: ActiveCounter[],
  events: StreamEvent[],
): Chain[] {
  const graph = buildChainGraph(events)
  const chains: Chain[] = []

  for (const head of rows) {
    // Walk backward to find root
    let cursor = head.contractId
    const seen = new Set<string>([cursor])
    while (!graph.rootIds.has(cursor) && graph.prevOf.has(cursor)) {
      const prev = graph.prevOf.get(cursor) as string
      if (seen.has(prev)) break
      seen.add(prev)
      cursor = prev
    }
    const rootId = cursor
    const partial = !graph.rootIds.has(rootId)

    // Walk forward from root to head, emitting nodes
    const nodes: ChainNodeData[] = []
    let id: string | undefined = rootId
    const visited = new Set<string>()
    while (id && !visited.has(id)) {
      visited.add(id)
      const isHead = id === head.contractId
      const count = isHead ? head.payload.count : graph.countById.get(id) ?? 0
      nodes.push({ contractId: id, count, archived: !isHead })
      if (isHead) break
      id = graph.nextOf.get(id)
    }

    chains.push({
      rootId,
      headId: head.contractId,
      head,
      nodes,
      partial,
    })
  }

  return chains
}

export function useChains(
  rows: ActiveCounter[] | undefined,
  events: StreamEvent[],
): Chain[] | undefined {
  const orderRef = useRef<string[]>([])

  return useMemo(() => {
    if (!rows) return rows
    const chains = buildChains(rows, events)

    // Stable ordering by first-seen rootId. Increment never changes rootId,
    // so chains keep their slot across +1 clicks.
    const currentRoots = new Set(chains.map((c) => c.rootId))
    orderRef.current = orderRef.current.filter((id) => currentRoots.has(id))
    for (const c of chains) {
      if (!orderRef.current.includes(c.rootId)) orderRef.current.push(c.rootId)
    }
    const positions = new Map(orderRef.current.map((id, i) => [id, i]))
    return [...chains].sort(
      (a, b) =>
        (positions.get(a.rootId) ?? 0) - (positions.get(b.rootId) ?? 0),
    )
  }, [rows, events])
}
