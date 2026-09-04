import {
  deserializeAnumStream,
  normalizeSyntaxAset,
  parseSyntaxAset,
  semanticLink,
} from '../src/core/index'

// SyntaxAset is the current structured-source product. Successful parsing or
// normalization is application behavior, not theorem acceptance or MTS authority.
const syntax = parseSyntaxAset('[] = ◁')
console.log(normalizeSyntaxAset(syntax).canonical)

// Current ANUM semantic execution is delegated by aprover to the exact-pinned
// accepted @mts/core v0.10 consumer boundary.
const denotation = deserializeAnumStream('[10]')
console.log(denotation.result)

// The presentation helper delegates semantic Link construction to @mts/core.
console.log(semanticLink('R', 'R'))
