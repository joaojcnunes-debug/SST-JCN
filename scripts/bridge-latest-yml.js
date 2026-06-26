#!/usr/bin/env node
// Upload de latest.yml "ponte" no Supabase Storage apontando para GitHub Releases.
// Permite que apps instalados com provider genérico (Supabase) atualizem para v0.2.6+.
// Após a atualização, o app novo usa provider github direto.

const fs = require('fs')
const path = require('path')

const SUPABASE_URL = 'https://vifatwpfqhhantordxlq.supabase.co'
const BUCKET = 'atualizacoes'
const GH_OWNER = 'joaojefferson-hash'
const GH_REPO = 'Painel-SST--Chabra'

// Dados do latest.yml do GitHub Release v0.2.7
const VERSION = '0.2.7'
const FILENAME = 'Painel-SST-Setup-0.2.7.exe'
const SHA512 = 'i7uE9J0zrulVdUha5NjK/hEf3D2JwLuW1DRmJdaxbir37LC/oM1D2r3e6zYtxZ1RmVgZt4Wx3P6nXMhRA7Nb/g=='
const SIZE = 176192461
const RELEASE_DATE = '2026-05-30T19:48:15.821Z'

const GH_URL = `https://github.com/${GH_OWNER}/${GH_REPO}/releases/download/v${VERSION}/${FILENAME}`

const LATEST_YML = `version: ${VERSION}
files:
  - url: ${GH_URL}
    sha512: ${SHA512}
    size: ${SIZE}
path: ${GH_URL}
sha512: ${SHA512}
releaseDate: '${RELEASE_DATE}'
`

function loadKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) return null
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/)
    if (m) return m[1].trim()
  }
  return null
}

async function main() {
  const key = loadKey()
  if (!key) {
    console.error('Erro: SUPABASE_SERVICE_ROLE_KEY não encontrada')
    process.exit(1)
  }

  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/latest.yml`
  console.log('Fazendo upload de latest.yml ponte para Supabase Storage...')
  console.log(`  URL do instalador: ${GH_URL}`)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'text/yaml',
      'x-upsert': 'true',
    },
    body: LATEST_YML,
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`Erro HTTP ${res.status}: ${body}`)
    process.exit(1)
  }

  console.log('OK — latest.yml atualizado no Supabase Storage.')
  console.log(`Apps usando provider genérico irão baixar v${VERSION} do GitHub Releases.`)
}

main().catch((err) => { console.error(err.message); process.exit(1) })
