#!/usr/bin/env node
// Remove ELECTRON_RUN_AS_NODE before spawning Electron.
// Electron 33 uses a presence check (not value == '1'), so any value triggers node mode.
const { spawn } = require('child_process')
const path = require('path')

delete process.env.ELECTRON_RUN_AS_NODE

const electronPath = require(path.join(process.cwd(), 'node_modules', 'electron'))
const args = process.argv.slice(2)

const child = spawn(electronPath, args, {
  env: process.env,
  stdio: 'inherit',
  windowsHide: false,
})

child.on('close', (code, signal) => {
  if (code === null) {
    console.error(electronPath, 'exited with signal', signal)
    process.exit(1)
  }
  process.exit(code)
})
