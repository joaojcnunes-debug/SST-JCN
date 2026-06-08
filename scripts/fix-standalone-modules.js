// Copia o node_modules traced do standalone para sst-jcn após next build.
//
// O sst-jcn usa node_modules como junction → painel-sst/node_modules.
// Isso faz o Next.js falhar ao criar o symlink em .next/standalone/node_modules
// (EPERM no Windows). Sem o node_modules, o servidor standalone não inicia →
// tela branca no Electron.
//
// A solução: copiar o node_modules traced do painel-sst (que buildou com sucesso)
// para .next/standalone/node_modules no sst-jcn. O código é idêntico, então
// os traced modules são os mesmos.

const { cpSync, existsSync, rmSync } = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const ssstJcnDest = path.join(root, '.next', 'standalone', 'node_modules')
const painelSstSrc = path.join(root, '..', 'painel-sst', '.next', 'standalone', 'node_modules')

if (existsSync(ssstJcnDest)) {
  console.log('✓ .next/standalone/node_modules já existe, pulando cópia')
  process.exit(0)
}

if (!existsSync(painelSstSrc)) {
  console.error('ERRO: painel-sst/.next/standalone/node_modules não encontrado.')
  console.error('Execute primeiro: cd C:\\Users\\PC\\painel-sst && npm run build')
  process.exit(1)
}

console.log('Copiando node_modules traced do painel-sst...')
cpSync(painelSstSrc, ssstJcnDest, { recursive: true })
const count = require('fs').readdirSync(ssstJcnDest).length
console.log(`✓ .next/standalone/node_modules copiado (${count} pacotes)`)
