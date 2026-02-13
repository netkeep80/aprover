/**
 * Verify that error highlighting position is correct
 */

// The test line from our example
const testLine = '!x♀ = ♂x.)   // тут некорректная закрывающая скобка'

// Error location from parser (1-based column)
const errorLocation = {
  start: { line: 15, column: 10, offset: 260 },
  end: { line: 15, column: 11, offset: 261 },
}

// Convert to 0-indexed
const errorLine = errorLocation.start.line - 1 // 14
const errorCol = errorLocation.start.column - 1 // 9

console.log('Test line:', testLine)
console.log('Error position (1-based):', errorLocation.start.line, ':', errorLocation.start.column)
console.log('Error position (0-indexed):', errorLine, ':', errorCol)
console.log('Character at error position:', JSON.stringify(testLine[errorCol]))
console.log('Expected character: ")"')

// Visual pointer
console.log('\n' + testLine)
console.log(' '.repeat(errorCol) + '^')

if (testLine[errorCol] === ')') {
  console.log('\n✓ ERROR POSITION IS CORRECT!')
} else {
  console.log('\n✗ ERROR POSITION IS WRONG!')
  console.log('Expected ")" at position', errorCol)
  console.log('Found:', JSON.stringify(testLine[errorCol]))
}
