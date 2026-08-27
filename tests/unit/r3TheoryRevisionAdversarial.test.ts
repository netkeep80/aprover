import { describe, expect, it } from 'vitest'
import {
  computePortableStructuralTheoryRevision,
  createPortableStructuralDerivationProvenanceClaim,
  exportPortableStructuralTheory,
  replayPortableStructuralProof,
} from '@mts/core'
import {
  createTheoremRecord,
  reapproveTheoremRecord,
} from '../../src/core/theoremLibrary'

const ARTIFACT = {
  schema: 'mts-portable-structural-derivation/v0.2',
  mtsSemanticBase: 'mts-contract/v0.11',
  topology: {
    schema: 'mts-storage-topology/v0.1',
    root: 0,
    links: [[0,0],[1,0],[0,2],[2,1],[3,0],[4,0],[5,0],[5,6],[6,0],[4,7],[8,0],[8,10],[10,0],[13,11],[0,12],[12,0],[16,14],[12,15],[18,16],[18,12],[18,13],[6,19],[9,20],[19,0],[24,22],[6,23],[15,24],[24,17]],
  },
  theoryCoordinate: 6,
  targetOccurrenceCoordinate: 26,
  nodes: [{
    occurrence: 26,
    judgment: {
      application: {
        act: 24, rule: 19, ruleAdmission: 21, claimedBody: 15,
        expectedInterpreter: { dictionary: 4, grammar: 5, theory: 6 },
        expectedAfterContext: 13,
      },
      judgment: { theory: 6, context: 13, claim: 15 },
    },
    derivationRule: 23,
    derivationRuleAdmission: 25,
    premiseOccurrenceSequence: 0,
  }],
} as const

const TARGET = { theoryCoordinate: 6, targetOccurrenceCoordinate: 26, claimCoordinate: 15 } as const
const SOURCE = {
  locator: 'https://github.com/leanprover-community/mathlib4',
  revision: '0123456789abcdef0123456789abcdef01234567',
  subject: 'Mathlib.Example.theorem',
} as const
const PRODUCER = { id: 'mts-proof-importer', version: '0.1.0' } as const

async function expectedTheoryFor(artifact: unknown = ARTIFACT) {
  const replayed = replayPortableStructuralProof(artifact)
  const theory =
    'theory' in replayed.evidence ? replayed.evidence.theory : replayed.evidence.derivation.theory
  const theoryArtifact = exportPortableStructuralTheory(replayed.memory, theory)
  return {
    artifact: theoryArtifact,
    revision: await computePortableStructuralTheoryRevision(theoryArtifact),
  }
}

async function request() {
  const artifact = structuredClone(ARTIFACT)
  return {
    artifact,
    provenance: await createPortableStructuralDerivationProvenanceClaim(artifact, SOURCE, PRODUCER),
    target: TARGET,
    expectedTheory: await expectedTheoryFor(artifact),
  }
}

describe('R3 theorem reuse Theory-revision boundary', () => {
  it('rejects reuse under another exact valid Theory revision', async () => {
    const record = await createTheoremRecord(await request())
    expect((await reapproveTheoremRecord(record)).verdict).toBe('ACCEPT')

    const replayed = replayPortableStructuralProof(record.proof.artifact)
    const otherTheoryArtifact = exportPortableStructuralTheory(replayed.memory, replayed.memory.root)
    const otherTheoryRevision = await computePortableStructuralTheoryRevision(otherTheoryArtifact)
    expect(otherTheoryRevision).not.toEqual(record.proof.expectedTheory.revision)

    const underAnotherTheory: any = structuredClone(record)
    underAnotherTheory.proof.expectedTheory = {
      artifact: otherTheoryArtifact,
      revision: otherTheoryRevision,
    }

    expect(await reapproveTheoremRecord(underAnotherTheory))
      .toEqual({ verdict: 'REJECT', code: 'proof-rejected' })
  })
})
