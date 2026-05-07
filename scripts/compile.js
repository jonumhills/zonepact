/**
 * compile.js — compile ZonePactRegistry.sol using the solc npm package
 * Works on Apple Silicon (ARM64) unlike the py-solc-x pre-built binaries.
 *
 * Usage:
 *   node scripts/compile.js
 *
 * Output:
 *   scripts/compiled.json  →  { abi, bytecode }
 */

const solc  = require('solc')
const fs    = require('fs')
const path  = require('path')

const ROOT         = path.join(__dirname, '..')
const CONTRACT     = path.join(ROOT, 'contracts', 'ZonePactRegistry.sol')
const OUTPUT_FILE  = path.join(__dirname, 'compiled.json')

const source = fs.readFileSync(CONTRACT, 'utf8')

const input = {
  language: 'Solidity',
  sources:  { 'ZonePactRegistry.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } },
  },
}

const raw    = solc.compile(JSON.stringify(input))
const output = JSON.parse(raw)

// Surface any errors
if (output.errors) {
  const fatal = output.errors.filter(e => e.severity === 'error')
  if (fatal.length) {
    console.error('Compilation errors:')
    fatal.forEach(e => console.error(' ', e.formattedMessage))
    process.exit(1)
  }
  output.errors
    .filter(e => e.severity === 'warning')
    .forEach(e => console.warn('warning:', e.message))
}

const contract = output.contracts['ZonePactRegistry.sol']['ZonePactRegistry']
if (!contract) {
  console.error('Contract not found in compiler output')
  process.exit(1)
}

const result = {
  abi:      contract.abi,
  bytecode: '0x' + contract.evm.bytecode.object,
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2))
console.log('Compiled ZonePactRegistry.sol → scripts/compiled.json')
