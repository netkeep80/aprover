import type { LinkRef, MemoryView } from './interpreter'

export interface DistinguishedLink {
  readonly id: LinkRef
  readonly start: LinkRef
  readonly end: LinkRef
}

function pairKey(start: LinkRef, end: LinkRef): string {
  return `${start}:${end}`
}

/**
 * Неизменяемое представление уже различённых связей приложения.
 *
 * Это граница, на которой приложение предоставляет существующие связи ядру
 * МТС. Интерпретация получает только операции чтения и не может создавать или
 * удалять связи.
 */
export class ExplicitMemoryView implements MemoryView {
  private readonly linksById: ReadonlyMap<LinkRef, readonly [LinkRef, LinkRef]>
  private readonly linksByPoles: ReadonlyMap<string, LinkRef>
  private readonly startProjections: ReadonlyMap<LinkRef, LinkRef>
  private readonly endProjections: ReadonlyMap<LinkRef, LinkRef>

  constructor(links: readonly DistinguishedLink[]) {
    const byId = new Map<LinkRef, readonly [LinkRef, LinkRef]>()
    const byPoles = new Map<string, LinkRef>()

    for (const link of links) {
      if (byId.has(link.id)) {
        throw new Error(`Duplicate memory link id ${link.id}`)
      }

      const key = pairKey(link.start, link.end)
      const existing = byPoles.get(key)
      if (existing !== undefined && existing !== link.id) {
        throw new Error(
          `Ambiguous canonical Link identity for (${link.start}, ${link.end}): ${existing} and ${link.id}`
        )
      }

      byId.set(link.id, [link.start, link.end] as const)
      byPoles.set(key, link.id)
    }

    const startProjections = new Map<LinkRef, LinkRef>()
    const endProjections = new Map<LinkRef, LinkRef>()

    for (const [link, poles] of byId) {
      const [start, end] = poles
      if (start === link) {
        const existing = startProjections.get(end)
        if (existing !== undefined && existing !== link) {
          throw new Error(`Ambiguous start projection for form ${end}`)
        }
        startProjections.set(end, link)
      }
      if (end === link) {
        const existing = endProjections.get(start)
        if (existing !== undefined && existing !== link) {
          throw new Error(`Ambiguous end projection for form ${start}`)
        }
        endProjections.set(start, link)
      }
    }

    this.linksById = byId
    this.linksByPoles = byPoles
    this.startProjections = startProjections
    this.endProjections = endProjections
  }

  poles(link: LinkRef): readonly [LinkRef, LinkRef] {
    const poles = this.linksById.get(link)
    if (!poles) throw new Error(`Unknown memory link ${link}`)
    return poles
  }

  findLink(start: LinkRef, end: LinkRef): LinkRef | undefined {
    return this.linksByPoles.get(pairKey(start, end))
  }

  findStartProjection(form: LinkRef): LinkRef | undefined {
    return this.startProjections.get(form)
  }

  findEndProjection(form: LinkRef): LinkRef | undefined {
    return this.endProjections.get(form)
  }

  /** Все существующие связи с данным первым полюсом. */
  outgoing(start: LinkRef): readonly LinkRef[] {
    return [...this.linksById.entries()]
      .filter(([, poles]) => poles[0] === start)
      .map(([link]) => link)
      .sort((left, right) => left - right)
  }

  /** Все существующие связи с данным вторым полюсом. */
  incoming(end: LinkRef): readonly LinkRef[] {
    return [...this.linksById.entries()]
      .filter(([, poles]) => poles[1] === end)
      .map(([link]) => link)
      .sort((left, right) => left - right)
  }

  /** Все существующие связи в каноническом порядке идентификаторов. */
  allLinks(): readonly LinkRef[] {
    return [...this.linksById.keys()].sort((left, right) => left - right)
  }

  /** Deterministic copy useful for diagnostics and non-mutation assertions. */
  entries(): readonly (readonly [LinkRef, readonly [LinkRef, LinkRef]])[] {
    return [...this.linksById.entries()]
      .sort(([left], [right]) => left - right)
      .map(([link, poles]) => [link, [poles[0], poles[1]] as const] as const)
  }
}
