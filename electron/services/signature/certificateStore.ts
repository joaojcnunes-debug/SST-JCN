import path from 'path'
import { app } from 'electron'
import fs from 'fs'

export interface CertificateEntry {
  email: string
  nome: string
  pfxPath: string
  cargo?: string
}

function storePath(): string {
  return path.join(app.getPath('userData'), 'certificates.json')
}

function load(): CertificateEntry[] {
  try {
    const p = storePath()
    if (!fs.existsSync(p)) return []
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as CertificateEntry[]
  } catch {
    return []
  }
}

function save(entries: CertificateEntry[]): void {
  fs.writeFileSync(storePath(), JSON.stringify(entries, null, 2), 'utf-8')
}

export function registrarCertificado(entry: CertificateEntry): void {
  save([...load().filter((e) => e.email !== entry.email), entry])
}

export function obterCertificado(email: string): CertificateEntry | null {
  return load().find((e) => e.email === email) ?? null
}

export function listarCertificados(): CertificateEntry[] {
  return load()
}

export function removerCertificado(email: string): void {
  save(load().filter((e) => e.email !== email))
}
