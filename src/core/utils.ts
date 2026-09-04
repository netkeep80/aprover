/**
 * Shared utility functions for МТС (Meta-Theory of Links)
 *
 * General-purpose helpers used across multiple modules.
 */

/**
 * Escape special characters for DOT/Graphviz labels
 */
export function escapeLabel(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
}

/**
 * Options for generic line-by-line file-to-MTL conversion
 */
export interface FileToMtlOptions {
  /** Whether to skip empty lines */
  skipEmptyLines?: boolean
  /** Header comment lines to prepend */
  headerLines: string[]
}

/**
 * Generic line-by-line file-to-MTL converter.
 *
 * Processes lines, preserving comments, skipping empty lines per options,
 * and converting each non-empty, non-comment line to formal notation.
 */
export function fileToMtl(
  content: string,
  options: FileToMtlOptions,
  isEmptyLine: (line: string, trimmed: string) => boolean,
  toFormal: (line: string) => string
): string {
  const lines = content.split('\n')
  const mtlLines: string[] = [...options.headerLines, '']

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('//')) {
      mtlLines.push(trimmed)
      continue
    }

    if (options.skipEmptyLines && isEmptyLine(line, trimmed)) {
      continue
    }

    mtlLines.push(`${toFormal(line)}.`)
  }

  return mtlLines.join('\n')
}
