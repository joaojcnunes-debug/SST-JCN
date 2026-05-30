import { getPendingQueue, markQueueDone, markQueueError } from '../database/sqlite'

const SYNC_INTERVAL_MS = 30_000

let _timer: ReturnType<typeof setInterval> | null = null
let _supabaseUrl = ''
let _supabaseKey = ''

export function initSyncEngine(supabaseUrl: string, supabaseKey: string): void {
  _supabaseUrl = supabaseUrl
  _supabaseKey = supabaseKey
}

export function startSyncLoop(): void {
  if (_timer) return
  _timer = setInterval(() => processQueue().catch(console.error), SYNC_INTERVAL_MS)
}

export function stopSyncLoop(): void {
  if (_timer) {
    clearInterval(_timer)
    _timer = null
  }
}

export async function processQueue(): Promise<{ processed: number; errors: number }> {
  if (!_supabaseUrl || !_supabaseKey) return { processed: 0, errors: 0 }

  const items = getPendingQueue()
  let processed = 0
  let errors = 0

  for (const item of items) {
    try {
      await syncItem(item.operacao, item.tabela, JSON.parse(item.payload) as Record<string, unknown>)
      markQueueDone(item.id)
      processed++
    } catch (err) {
      markQueueError(item.id, err instanceof Error ? err.message : String(err))
      errors++
    }
  }

  return { processed, errors }
}

async function syncItem(
  operacao: string,
  tabela: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const methodMap: Record<string, string> = {
    INSERT: 'POST',
    UPDATE: 'PATCH',
    DELETE: 'DELETE',
    UPSERT: 'POST',
  }
  const method = methodMap[operacao] ?? 'POST'
  const preferHeader =
    operacao === 'UPSERT' ? 'resolution=merge-duplicates' : 'return=minimal'

  const res = await fetch(`${_supabaseUrl}/rest/v1/${tabela}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: _supabaseKey,
      Authorization: `Bearer ${_supabaseKey}`,
      Prefer: preferHeader,
    },
    body: operacao !== 'DELETE' ? JSON.stringify(payload) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`[sync] ${tabela}/${operacao} → ${res.status}: ${text}`)
  }
}
