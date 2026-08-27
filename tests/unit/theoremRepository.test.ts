import { describe, expect, it } from 'vitest'
import type { TheoremRecordV01 } from '../../src/core/theoremLibrary'
import { InMemoryTheoremRepository } from '../../src/core/theoremRepository'

function record(
  revision: unknown,
  claimCoordinate: number,
  marker: string,
): TheoremRecordV01 {
  return {
    schema: 'aprover-theorem-record/v0.1',
    consumer: {
      repository: 'netkeep80/anum_docs',
      upstreamCommit: marker.padEnd(40, '0').slice(0, 40),
      semanticBase: 'mts-contract/v0.11',
      packageName: '@mts/core',
      packageVersion: '0.10.0',
      artifactSha256: marker.padEnd(64, '0').slice(0, 64),
    },
    proof: {
      artifact: { marker },
      provenance: { marker },
      target: {
        theoryCoordinate: 1,
        targetOccurrenceCoordinate: 2,
        claimCoordinate,
      },
      expectedTheory: {
        artifact: { marker: `theory-${marker}` },
        revision,
      },
    },
    approval: {
      semanticBase: 'mts-contract/v0.11',
      occurrenceCount: 1,
      provenanceDigest: { scheme: 'sha256', value: marker.padEnd(64, 'f').slice(0, 64) },
    },
  }
}

describe('non-authoritative theorem repository', () => {
  it('snapshots stored evidence and rejects duplicate ids instead of silently replacing records', () => {
    const repository = new InMemoryTheoremRepository()
    const input = record({ scheme: 'sha256', value: 'rev-a' }, 11, 'a')

    repository.put({ id: 'T1', record: input })
    ;(input.proof.artifact as { marker: string }).marker = 'mutated'

    expect((repository.get('T1')?.record.proof.artifact as { marker: string }).marker).toBe('a')
    expect(() => repository.put({ id: 'T1', record: record({ scheme: 'sha256', value: 'rev-b' }, 12, 'b') }))
      .toThrow('theorem id already exists: T1')
  })

  it('indexes exact Theory revision and claim coordinate with stable id ordering', () => {
    const repository = new InMemoryTheoremRepository()
    const revision = { value: 'same', scheme: 'sha256' }

    repository.put({ id: 'T2', record: record({ scheme: 'sha256', value: 'same' }, 7, 'b') })
    repository.put({ id: 'T1', record: record(revision, 7, 'a') })
    repository.put({ id: 'T3', record: record({ scheme: 'sha256', value: 'other' }, 9, 'c') })

    expect(repository.findByTheoryRevision({ scheme: 'sha256', value: 'same' })).toEqual(['T1', 'T2'])
    expect(repository.findByClaimCoordinate(7)).toEqual(['T1', 'T2'])
    expect(repository.findByClaimCoordinate(9)).toEqual(['T3'])
  })

  it('keeps dependency metadata explicit, snapshotted, and non-inferred', () => {
    const repository = new InMemoryTheoremRepository()
    const dependencies = ['L2', 'L1']

    repository.put({
      id: 'T1',
      record: record({ scheme: 'sha256', value: 'rev' }, 5, 'a'),
      dependencies,
    })
    dependencies.push('L3')

    expect(repository.dependencies('T1')).toEqual(['L1', 'L2'])
    expect(repository.dependents('L1')).toEqual(['T1'])
    expect(repository.dependents('unknown')).toEqual([])
  })

  it('rejects direct and transitive theorem dependency cycles before indexing them', () => {
    const repository = new InMemoryTheoremRepository()

    expect(() => repository.put({
      id: 'self',
      record: record({ scheme: 'sha256', value: 'rev' }, 1, 'a'),
      dependencies: ['self'],
    })).toThrow('theorem dependency cycle: self -> self')

    repository.put({
      id: 'L1',
      record: record({ scheme: 'sha256', value: 'rev' }, 2, 'b'),
      dependencies: ['L2'],
    })
    repository.put({
      id: 'L2',
      record: record({ scheme: 'sha256', value: 'rev' }, 3, 'c'),
      dependencies: ['L3'],
    })

    expect(() => repository.put({
      id: 'L3',
      record: record({ scheme: 'sha256', value: 'rev' }, 4, 'd'),
      dependencies: ['L1'],
    })).toThrow('theorem dependency cycle: L3 -> L1')

    expect(repository.get('L3')).toBeUndefined()
    expect(repository.dependents('L1')).toEqual([])
  })

  it('fails closed when semantic use reapproves forged stored evidence', async () => {
    const repository = new InMemoryTheoremRepository()
    repository.put({
      id: 'forged',
      record: record({ scheme: 'sha256', value: 'not-a-real-theory' }, 5, 'x'),
    })

    expect(await repository.use('missing')).toEqual({ verdict: 'REJECT', code: 'not-found' })
    const result = await repository.use('forged')
    expect(result.verdict).toBe('REJECT')
  })
})
