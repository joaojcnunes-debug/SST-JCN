#!/usr/bin/env node
// Publica atualização no Supabase Storage após `npm run electron:build`
// Local: lê SUPABASE_SERVICE_ROLE_KEY do .env.local
// CI:    lê SUPABASE_SERVICE_ROLE_KEY da variável de ambiente

const fs = require('fs')
const path = require('path')

const VERSION = require('../package.json').version
const SUPABASE_URL = 'https://vifatwpfqhhantordxlq.supabase.co'
const BUCKET = 'atualizacoes'
const TUS_THRESHOLD = 50 * 1024 * 1024 // 50 MB — acima disso usa TUS resumável

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

async function uploadRest(localPath, objectName, serviceKey) {
  const content = fs.readFileSync(localPath)
  const ext = path.extname(objectName).toLowerCase()
  const contentType = ext === '.yml' ? 'text/yaml' : 'application/octet-stream'
  const encoded = objectName.split('/').map(encodeURIComponent).join('/')
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encoded}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': contentType, 'x-upsert': 'true' },
    body: content,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  console.log(`  ok  ${objectName}  (${(content.length / 1024 / 1024).toFixed(1)} MB)`)
}

function uploadTus(localPath, objectName, serviceKey) {
  const { Upload } = require('tus-js-client')
  const stat = fs.statSync(localPath)
  const sizeMB = (stat.size / 1024 / 1024).toFixed(1)

  return new Promise((resolve, reject) => {
    const upload = new Upload(fs.createReadStream(localPath), {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      uploadSize: stat.size,
      retryDelays: [0, 3000, 5000, 10000, 30000],
      headers: { authorization: `Bearer ${serviceKey}`, 'x-upsert': 'true' },
      metadata: {
        bucketName: BUCKET,
        objectName,
        contentType: 'application/octet-stream',
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024,
      onError: reject,
      onProgress(sent, total) {
        process.stdout.write(`\r  ${objectName}: ${((sent / total) * 100).toFixed(1)}%  `)
      },
      onSuccess() {
        process.stdout.write(`\r  ok  ${objectName}  (${sizeMB} MB)                    \n`)
        resolve()
      },
    })
    upload.start()
  })
}

async function upload(localPath, objectName, serviceKey) {
  const size = fs.statSync(localPath).size
  if (size > TUS_THRESHOLD) return uploadTus(localPath, objectName, serviceKey)
  return uploadRest(localPath, objectName, serviceKey)
}

async function main() {
  const key = loadKey()
  if (!key) {
    console.error('Erro: SUPABASE_SERVICE_ROLE_KEY não encontrada (env var ou .env.local)')
    process.exit(1)
  }

  const installer = `Painel SST Setup ${VERSION}.exe`
  const ymlPath = path.join(__dirname, '..', 'dist', 'latest.yml')
  const exePath = path.join(__dirname, '..', 'dist', installer)

  for (const p of [ymlPath, exePath]) {
    if (!fs.existsSync(p)) {
      console.error(`Arquivo não encontrado: ${p}\nRode "npm run electron:build" primeiro.`)
      process.exit(1)
    }
  }

  console.log(`Publicando versão ${VERSION}...`)
  await upload(ymlPath, 'latest.yml', key)
  await upload(exePath, installer, key)
  console.log(`\nPronto! Versão ${VERSION} disponível para atualização automática.`)
}

main().catch((err) => { console.error(err.message); process.exit(1) })
