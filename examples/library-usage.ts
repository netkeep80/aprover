import {
  MTS_CONTRACT_VERSION,
  MTS_PROOF_SCHEMA,
  checkProof,
  parseExpr,
  toCanonicalString,
  type MtsProofObjectV02,
} from '../src/core/index'

// Parse/canonicalize the same MTS v0.2 language published by anum_docs.
const expression = parseExpr('[] = ◁')
console.log(toCanonicalString(expression))

// Trusted proof checking is replay-only. The proof object carries all context
// needed to independently replay canonical interpretation; no A0-A11 state or
// hidden global prover assumptions participate.
const proof: MtsProofObjectV02 = {
  schema: MTS_PROOF_SCHEMA,
  contractVersion: MTS_CONTRACT_VERSION,
  steps: [
    {
      rule: 'interpret',
      expression: '[] = ◁',
      context: { start: 10, end: 12 },
      expected: {
        success: true,
        substitutions: [{ path: [0], link: 10 }],
        aliases: [],
      },
    },
  ],
}

console.log(checkProof(proof) ? 'trusted replay accepted' : 'proof rejected')
