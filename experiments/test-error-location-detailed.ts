import { parseWithRecovery } from '../src/core/parser'
import { readFileSync } from 'fs'

const input = readFileSync('examples/test-issue-48-error.mtl', 'utf-8')
const lines = input.split('\n')

console.log('=== Analyzing error position ===\n')

const result = parseWithRecovery(input)

if (result.errorLocation) {
  const errorLine = result.errorLocation.start.line - 1 // 0-indexed
  const errorCol = result.errorLocation.start.column // already 0-indexed from lexer

  const line = lines[errorLine]
  console.log('Line index:', errorLine, '(1-based: line', errorLine + 1, ')')
  console.log('Column:', errorCol)
  console.log('Line content:', JSON.stringify(line))
  console.log('Character at position:', JSON.stringify(line[errorCol]))

  // Show each character with its position
  console.log('\nCharacter breakdown:')
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const marker = i === errorCol ? ' <-- ERROR HERE' : ''
    console.log(`  [${i}] '${char}' (${char.charCodeAt(0)})${marker}`)
  }

  // Visual pointer
  console.log('\n' + line)
  console.log(' '.repeat(errorCol) + '^')
}
