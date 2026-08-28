import type { LinkHandle, Memory } from '@mts/core'
import {
  normalizeVisualLinkNetwork,
  type VisualKey,
  type VisualLinkNetwork,
} from '@mts/visual'

const PRESENTATION_KEY_PREFIX = 'memory-link:'

function presentationKey(index: number): VisualKey {
  return `${PRESENTATION_KEY_PREFIX}${index}`
}

function requirePresentationKey(
  keyByLink: ReadonlyMap<LinkHandle, VisualKey>,
  link: LinkHandle,
  role: 'link' | 'start' | 'end',
): VisualKey {
  const key = keyByLink.get(link)
  if (key === undefined) {
    throw new Error(
      `Cannot project semantic Memory: ${role} Link is absent from the allLinks() snapshot`,
    )
  }
  return key
}

/**
 * Projects the accepted semantic Memory surface into presentation-only shared visual data.
 *
 * LinkHandle identity is used only to join one read-only snapshot. Generated VisualKeys are
 * deterministic presentation references and must never be used as semantic or proof identity.
 */
export function projectSemanticMemoryToVisualLinkNetwork(
  memory: Pick<Memory, 'linkCount' | 'allLinks' | 'poles'>,
): VisualLinkNetwork {
  const links = memory.allLinks()
  if (links.length !== memory.linkCount) {
    throw new Error('Cannot project semantic Memory: allLinks() length does not match linkCount')
  }

  const keyByLink = new Map<LinkHandle, VisualKey>()
  links.forEach((link, index) => {
    if (keyByLink.has(link)) {
      throw new Error('Cannot project semantic Memory: allLinks() contains a duplicate Link handle')
    }
    keyByLink.set(link, presentationKey(index))
  })

  return normalizeVisualLinkNetwork({
    links: links.map(link => {
      const { start, end } = memory.poles(link)
      return {
        key: requirePresentationKey(keyByLink, link, 'link'),
        startKey: requirePresentationKey(keyByLink, start, 'start'),
        endKey: requirePresentationKey(keyByLink, end, 'end'),
      }
    }),
  })
}

/**
 * Projects only the transitive pole closure reachable from one explicit Link root.
 *
 * Root-first start/end traversal gives the same presentation ordering for the same rooted
 * topology without consulting whole-Memory enumeration. LinkHandle identity is used only for
 * cycle/duplicate suppression inside this read-only traversal; generated VisualKeys remain
 * presentation references only.
 */
export function projectRootedLinkClosureToVisualLinkNetwork(
  memory: Pick<Memory, 'poles'>,
  root: LinkHandle,
): VisualLinkNetwork {
  const links: LinkHandle[] = []
  const keyByLink = new Map<LinkHandle, VisualKey>()

  const visit = (link: LinkHandle): void => {
    if (keyByLink.has(link)) return

    keyByLink.set(link, presentationKey(links.length))
    links.push(link)

    const { start, end } = memory.poles(link)
    visit(start)
    visit(end)
  }

  visit(root)

  return normalizeVisualLinkNetwork({
    links: links.map(link => {
      const { start, end } = memory.poles(link)
      return {
        key: requirePresentationKey(keyByLink, link, 'link'),
        startKey: requirePresentationKey(keyByLink, start, 'start'),
        endKey: requirePresentationKey(keyByLink, end, 'end'),
      }
    }),
  })
}
