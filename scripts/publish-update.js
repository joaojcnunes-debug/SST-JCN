#!/usr/bin/env node
// Publica atualização no Supabase Storage após `npm run electron:build`
// Uso: node scripts/publish-update.js
// Requer: SUPABASE_SERVICE_ROLE_KEY definida em .env.local

const fs = require('fs')
const path = require('path')

const VERSION = require('../package.json').version
const SUPABASE_URL = 'https://vifatwpfqhhantordxlq.supabase.co'
const BUCKET = 'atualizacoes'

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) return {}
  const env = {}
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim()
  }
  return env
}

async function upsert(localPath, remoteName, serviceKey) {
  const content = fs.readFileSync(localPath)
  const ext = path.extname(remoteName).toLowerCase()
  const contentType = ext === '.yml' ? 'text/yaml' : 'application/octet-stream'
  const encoded = remoteName.split('/').map(encodeURIComponent).join('/')
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encoded}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: content,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status} ao enviar ${remoteName}: ${body}`)
  }

  const size = (content.length / 1024 / 1024).toFixed(1)
  console.log(`  ok  ${remoteName}  (${size} MB)`)
}

async function main() {
  const env = loadEnvLocal()
  const key = env['SUPABASE_SERVICE_ROLE_KEY']
  if (!key) {
    console.error('Erro: SUPABASE_SERVICE_ROLE_KEY não encontrado em .env.local')
    process.exit(1)
  }

  const installer = `Painel SST Setup ${VERSION}.exe`
  const ymlPath = path.join(__dirname, '..', 'dist', 'latest.yml')
  const exePath = path.join(__dirname, '..', 'dist', installer)

  for (const [p, name] of [[ymlPath, 'latest.yml'], [exePath, installer]]) {
    if (!fs.existsSync(p)) {
      console.error(`Arquivo não encontrado: ${p}\nRode "npm run electron:build" primeiro.`)
      process.exit(1)
    }
  }

  console.log(`Publicando versão ${VERSION}...`)
  await upsert(ymlPath, 'latest.yml', key)
  await upsert(exePath, installer, key)
  console.log(`\nPronto! Versão ${VERSION} disponível para atualização automática.`)
}

main().catch((err) => { console.error(err.message); process.exit(1) })
