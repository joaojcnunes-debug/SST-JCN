import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    const dbPath = path.join(app.getPath('userData'), 'painel-sst.db')
    _db = new Database(dbPath)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    _db.pragma('synchronous = NORMAL')
    applyMigrations(_db)
  }
  return _db
}

export function closeDb(): void {
  _db?.close()
  _db = null
}

function applyMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      operacao     TEXT    NOT NULL,
      tabela       TEXT    NOT NULL,
      payload      TEXT    NOT NULL,
      tentativas   INTEGER DEFAULT 0,
      criado_em    TEXT    DEFAULT (datetime('now')),
      ultimo_erro  TEXT
    );

    CREATE TABLE IF NOT EXISTS pdfs_locais (
      id          TEXT PRIMARY KEY,
      tabela      TEXT NOT NULL,
      doc_id      TEXT NOT NULL,
      pdf_path    TEXT NOT NULL,
      assinado    INTEGER DEFAULT 0,
      hash_sha256 TEXT,
      criado_em   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cache_relatorios (
      tabela        TEXT NOT NULL,
      doc_id        TEXT NOT NULL,
      payload       TEXT NOT NULL,
      atualizado_em TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (tabela, doc_id)
    );

    CREATE INDEX IF NOT EXISTS idx_queue_tentativas ON sync_queue(tentativas);
    CREATE INDEX IF NOT EXISTS idx_pdfs_tabela_doc  ON pdfs_locais(tabela, doc_id);
  `)
}

// ── Sync queue ───────────────────────────────────────────────────

export function enqueueSync(operacao: string, tabela: string, payload: object): void {
  getDb()
    .prepare('INSERT INTO sync_queue (operacao, tabela, payload) VALUES (?, ?, ?)')
    .run(operacao, tabela, JSON.stringify(payload))
}

export interface QueueItem {
  id: number
  operacao: string
  tabela: string
  payload: string
  tentativas: number
}

export function getPendingQueue(limit = 50): QueueItem[] {
  return getDb()
    .prepare('SELECT * FROM sync_queue WHERE tentativas < 5 ORDER BY criado_em LIMIT ?')
    .all(limit) as QueueItem[]
}

export function markQueueDone(id: number): void {
  getDb().prepare('DELETE FROM sync_queue WHERE id = ?').run(id)
}

export function markQueueError(id: number, erro: string): void {
  getDb()
    .prepare('UPDATE sync_queue SET tentativas = tentativas + 1, ultimo_erro = ? WHERE id = ?')
    .run(erro, id)
}

// ── PDF local registry ───────────────────────────────────────────

export function registrarPdfLocal(opts: {
  id: string
  tabela: string
  docId: string
  pdfPath: string
  assinado?: boolean
  hashSha256?: string
}): void {
  getDb()
    .prepare(`
      INSERT INTO pdfs_locais (id, tabela, doc_id, pdf_path, assinado, hash_sha256)
      VALUES (@id, @tabela, @docId, @pdfPath, @assinado, @hashSha256)
      ON CONFLICT(id) DO UPDATE SET
        pdf_path    = excluded.pdf_path,
        assinado    = excluded.assinado,
        hash_sha256 = excluded.hash_sha256,
        criado_em   = datetime('now')
    `)
    .run({
      id: opts.id,
      tabela: opts.tabela,
      docId: opts.docId,
      pdfPath: opts.pdfPath,
      assinado: opts.assinado ? 1 : 0,
      hashSha256: opts.hashSha256 ?? null,
    })
}

export function buscarPdfLocal(tabela: string, docId: string) {
  return getDb()
    .prepare('SELECT * FROM pdfs_locais WHERE tabela = ? AND doc_id = ? ORDER BY criado_em DESC LIMIT 1')
    .get(tabela, docId) as { id: string; pdf_path: string; assinado: number } | undefined
}

// ── Cache relatórios ─────────────────────────────────────────────

export function cacheSet(tabela: string, docId: string, payload: object): void {
  getDb()
    .prepare(`
      INSERT INTO cache_relatorios (tabela, doc_id, payload, atualizado_em)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(tabela, doc_id) DO UPDATE SET
        payload = excluded.payload,
        atualizado_em = datetime('now')
    `)
    .run(tabela, docId, JSON.stringify(payload))
}

export function cacheGet<T = unknown>(tabela: string, docId: string): T | null {
  const row = getDb()
    .prepare('SELECT payload FROM cache_relatorios WHERE tabela = ? AND doc_id = ?')
    .get(tabela, docId) as { payload: string } | undefined
  return row ? (JSON.parse(row.payload) as T) : null
}
