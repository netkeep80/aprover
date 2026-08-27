import {
  reapproveTheoremRecord,
  type TheoremRecordReapproval,
  type TheoremRecordV01,
} from './theoremLibrary'

export interface TheoremRepositoryPut {
  readonly id: string
  readonly record: TheoremRecordV01
  readonly dependencies?: readonly string[]
}

export interface TheoremRepositoryEntry {
  readonly id: string
  readonly record: TheoremRecordV01
  readonly dependencies: readonly string[]
}

export type TheoremRepositoryUseResult =
  | TheoremRecordReapproval
  | { readonly verdict: 'REJECT'; readonly code: 'not-found' }

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  return value
}

function snapshot<T>(value: T): T {
  return deepFreeze(structuredClone(value))
}

function canonicalKey(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return `s:${JSON.stringify(value)}`
  if (typeof value === 'boolean') return value ? 'b:1' : 'b:0'
  if (typeof value === 'number' && Number.isFinite(value)) return `n:${value}`
  if (Array.isArray(value)) return `a:[${value.map(canonicalKey).join(',')}]`
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalKey(child)}`)
    return `o:{${entries.join(',')}}`
  }
  throw new Error('Theory revision is not deterministically indexable')
}

function normalizedDependencies(values: readonly string[] | undefined): readonly string[] {
  if (values === undefined) return Object.freeze([])
  for (const value of values) {
    if (typeof value !== 'string' || value.length === 0) throw new Error('dependency id must be a non-empty string')
  }
  return Object.freeze([...new Set(values)].sort())
}

function addIndex(index: Map<string, Set<string>>, key: string, id: string): void {
  const ids = index.get(key)
  if (ids === undefined) index.set(key, new Set([id]))
  else ids.add(id)
}

function sorted(index: Map<string, Set<string>>, key: string): readonly string[] {
  return Object.freeze([...(index.get(key) ?? [])].sort())
}

/**
 * Consumer-side theorem storage/indexing only.
 *
 * Repository membership, ids and index hits never establish theorem truth.
 * `use()` always re-enters the existing theorem-record reapproval boundary.
 */
export class InMemoryTheoremRepository {
  private readonly entries = new Map<string, TheoremRepositoryEntry>()
  private readonly byTheoryRevision = new Map<string, Set<string>>()
  private readonly byClaimCoordinate = new Map<string, Set<string>>()
  private readonly byDependency = new Map<string, Set<string>>()

  put(input: TheoremRepositoryPut): TheoremRepositoryEntry {
    if (typeof input.id !== 'string' || input.id.length === 0) throw new Error('theorem id must be a non-empty string')
    if (this.entries.has(input.id)) throw new Error(`theorem id already exists: ${input.id}`)

    const dependencies = normalizedDependencies(input.dependencies)
    const entry = snapshot({ id: input.id, record: input.record, dependencies })
    const revisionKey = canonicalKey(entry.record.proof.expectedTheory.revision)

    this.entries.set(entry.id, entry)
    addIndex(this.byTheoryRevision, revisionKey, entry.id)
    addIndex(this.byClaimCoordinate, String(entry.record.proof.target.claimCoordinate), entry.id)
    for (const dependency of dependencies) addIndex(this.byDependency, dependency, entry.id)
    return entry
  }

  get(id: string): TheoremRepositoryEntry | undefined {
    return this.entries.get(id)
  }

  findByTheoryRevision(revision: unknown): readonly string[] {
    return sorted(this.byTheoryRevision, canonicalKey(revision))
  }

  findByClaimCoordinate(claimCoordinate: number): readonly string[] {
    if (!Number.isInteger(claimCoordinate) || claimCoordinate < 0) return Object.freeze([])
    return sorted(this.byClaimCoordinate, String(claimCoordinate))
  }

  dependencies(id: string): readonly string[] {
    return this.entries.get(id)?.dependencies ?? Object.freeze([])
  }

  dependents(id: string): readonly string[] {
    return sorted(this.byDependency, id)
  }

  async use(id: string): Promise<TheoremRepositoryUseResult> {
    const entry = this.entries.get(id)
    if (entry === undefined) return { verdict: 'REJECT', code: 'not-found' }
    return reapproveTheoremRecord(entry.record)
  }
}
