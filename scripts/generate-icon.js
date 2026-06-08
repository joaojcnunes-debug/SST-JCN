// Gera electron/assets/icon.png a partir do SVG da logo JCN
const sharp = require('../node_modules/sharp')
const path = require('path')
const fs = require('fs')

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
    <linearGradient id="shield" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
  </defs>

  <!-- Fundo arredondado -->
  <rect width="512" height="512" rx="80" fill="url(#bg)"/>

  <!-- Escudo -->
  <path d="M 256,60
    L 420,120
    L 420,280
    Q 420,400 256,460
    Q 92,400 92,280
    L 92,120
    Z"
    fill="url(#shield)"
    stroke="rgba(255,255,255,0.3)"
    stroke-width="4"/>

  <!-- Checkmark branco -->
  <path d="M 165,270 L 225,340 L 350,185"
    stroke="white"
    stroke-width="32"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"/>

  <!-- Texto SST embaixo -->
  <text x="256" y="500"
    font-family="Arial Black, Arial, sans-serif"
    font-size="0"
    fill="white"
    text-anchor="middle"/>
</svg>`

const outPath = path.join(__dirname, '..', 'electron', 'assets', 'icon.png')

sharp(Buffer.from(svgIcon))
  .resize(512, 512)
  .png()
  .toFile(outPath)
  .then(() => {
    const size = fs.statSync(outPath).size
    console.log(`✓ icon.png gerado: ${outPath} (${Math.round(size/1024)}KB)`)
  })
  .catch(err => {
    console.error('Erro:', err.message)
    process.exit(1)
  })
