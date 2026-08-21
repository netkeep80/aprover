import {
  deserializeAnumStream,
  parseExpr,
  semanticLink,
  toCanonicalString,
} from '../src/core/index'

// Parser/normalizer are application/editor surfaces; successful parsing is not
// theorem acceptance and does not define normative MTS semantics.
const expression = parseExpr('[] = ◁')
console.log(toCanonicalString(expression))

// Current ANUM semantic execution is delegated by aprover to the exact-pinned
// accepted @mts/core v0.10 consumer boundary.
const denotation = deserializeAnumStream('[10]')
console.log(denotation.result)

// The presentation helper delegates semantic Link construction to @mts/core.
console.log(semanticLink('R', 'R'))
