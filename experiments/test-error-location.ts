import { parseWithRecovery } from '../src/core/parser'
import { readFileSync } from 'fs'

const input = readFileSync('examples/test-issue-48-error.mtl', 'utf-8')
console.log('Input file:')
console.log(input)
console.log('\n=== Parsing ===\n')

const result = parseWithRecovery(input)

console.log('Parse result:')
console.log('- Has AST:', !!result.file)
console.log('- Has error:', !!result.error)

if (result.file) {
  console.log('- Statements parsed:', result.file.statements.length)
}

if (result.error) {
  console.log('\nError details:')
  console.log('- Message:', result.error.message)
  console.log('- Token:', result.error.token)
  if (result.errorLocation) {
    console.log('- Error location:', result.errorLocation)
  }
}

// Let's also show the exact character at the error position
if (result.errorLocation) {
  const lines = input.split('\n')
  const errorLine = result.errorLocation.start.line - 1
  const errorCol = result.errorLocation.start.column

  console.log('\nError context:')
  console.log('Line', errorLine + 1, ':', lines[errorLine])
  console.log(
    'Error at column',
    errorCol,
    '-> character:',
    JSON.stringify(lines[errorLine][errorCol])
  )

  // Show visual pointer
  const pointer = ' '.repeat(errorCol) + '^'
  console.log(pointer)
}
