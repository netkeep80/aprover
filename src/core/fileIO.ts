/**
 * Browser file operations for canonical MTS source and Anum carriers.
 *
 * Proof results are intentionally not handled here. Trusted proof objects use
 * the separate mts-proof/v0.2 replay boundary.
 */

import { toCanonicalString } from './normalizer'
import type { ASTNode } from './ast'

export const SUPPORTED_EXTENSIONS = ['.mtl', '.astr', '.anum'] as const
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number]

export interface FileMetadata {
  name: string
  lastAccessed: number
  size: number
  preview: string
}

const RECENT_FILES_KEY = 'aprover_recent_files'
const MAX_RECENT_FILES = 10
const AUTOSAVE_KEY = 'aprover_autosave'

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  return lastDot === -1 ? '' : filename.substring(lastDot).toLowerCase()
}

export function isSupportedFile(filename: string): boolean {
  return SUPPORTED_EXTENSIONS.includes(getFileExtension(filename) as SupportedExtension)
}

export function isMtlFile(filename: string): boolean {
  return getFileExtension(filename) === '.mtl'
}

export async function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Failed to read file as text'))
    }
    reader.onerror = () => reject(new Error(`Failed to read file: ${reader.error?.message || 'Unknown error'}`))
    reader.readAsText(file, 'utf-8')
  })
}

export function getFilePreview(content: string, maxLength = 50): string {
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('//')) {
      return trimmed.length > maxLength ? `${trimmed.substring(0, maxLength)}...` : trimmed
    }
  }
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed) return trimmed.length > maxLength ? `${trimmed.substring(0, maxLength)}...` : trimmed
  }
  return '(empty file)'
}

export function getRecentFiles(): FileMetadata[] {
  try {
    const stored = localStorage.getItem(RECENT_FILES_KEY)
    if (!stored) return []
    return (JSON.parse(stored) as FileMetadata[]).sort((left, right) => right.lastAccessed - left.lastAccessed)
  } catch {
    console.warn('Failed to load recent files from localStorage')
    return []
  }
}

export function addRecentFile(name: string, size: number, preview: string): void {
  try {
    const recent = getRecentFiles().filter(file => file.name !== name)
    recent.unshift({ name, lastAccessed: Date.now(), size, preview })
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_FILES)))
  } catch {
    console.warn('Failed to save recent file to localStorage')
  }
}

export function removeRecentFile(name: string): void {
  try {
    localStorage.setItem(
      RECENT_FILES_KEY,
      JSON.stringify(getRecentFiles().filter(file => file.name !== name))
    )
  } catch {
    console.warn('Failed to remove recent file from localStorage')
  }
}

export function clearRecentFiles(): void {
  try {
    localStorage.removeItem(RECENT_FILES_KEY)
  } catch {
    console.warn('Failed to clear recent files from localStorage')
  }
}

export function saveAutosave(content: string): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, content)
  } catch {
    console.warn('Failed to save autosave to localStorage')
  }
}

export function loadAutosave(): string | null {
  try {
    return localStorage.getItem(AUTOSAVE_KEY)
  } catch {
    console.warn('Failed to load autosave from localStorage')
    return null
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY)
  } catch {
    console.warn('Failed to clear autosave from localStorage')
  }
}

export function formatAstForExport(ast: ASTNode, indent = 0): string {
  const pad = '  '.repeat(indent)
  const lines = [`${pad}${ast.type}`]

  if ('name' in ast && typeof ast.name === 'string') lines.push(`${pad}  name: ${ast.name}`)
  if ('name' in ast && typeof ast.name === 'object' && ast.name !== null) {
    lines.push(`${pad}  name:`)
    lines.push(formatAstForExport(ast.name, indent + 2))
  }
  if ('value' in ast) lines.push(`${pad}  value: ${ast.value}`)
  if ('side' in ast) lines.push(`${pad}  side: ${ast.side}`)
  if ('left' in ast && ast.left) {
    lines.push(`${pad}  left:`)
    lines.push(formatAstForExport(ast.left, indent + 2))
  }
  if ('right' in ast && ast.right) {
    lines.push(`${pad}  right:`)
    lines.push(formatAstForExport(ast.right, indent + 2))
  }
  if ('operand' in ast && ast.operand) {
    lines.push(`${pad}  operand:`)
    lines.push(formatAstForExport(ast.operand, indent + 2))
  }
  if ('form' in ast && ast.form) {
    lines.push(`${pad}  form:`)
    lines.push(formatAstForExport(ast.form, indent + 2))
  }
  if ('inner' in ast && ast.inner) {
    lines.push(`${pad}  inner:`)
    lines.push(formatAstForExport(ast.inner, indent + 2))
  }
  if ('content' in ast && ast.content) {
    lines.push(`${pad}  content:`)
    lines.push(formatAstForExport(ast.content, indent + 2))
  }
  if ('elements' in ast && Array.isArray(ast.elements)) {
    lines.push(`${pad}  elements:`)
    for (const element of ast.elements) lines.push(formatAstForExport(element, indent + 2))
  }
  if ('statements' in ast && Array.isArray(ast.statements)) {
    lines.push(`${pad}  statements:`)
    for (const statement of ast.statements) lines.push(formatAstForExport(statement, indent + 2))
  }
  if ('expr' in ast && ast.expr) {
    lines.push(`${pad}  expr:`)
    lines.push(formatAstForExport(ast.expr, indent + 2))
  }

  return lines.join('\n')
}

export function generateMtlFromAst(ast: ASTNode): string {
  if ('statements' in ast && Array.isArray(ast.statements)) {
    return ast.statements.map(statement => generateMtlFromAst(statement)).join('\n')
  }
  if ('expr' in ast && ast.expr) return `${toCanonicalString(ast.expr)}.`
  return toCanonicalString(ast)
}

export function downloadFile(content: string, filename: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 100)
}

export function openFileDialog(
  accept = '.mtl,.astr,.anum',
  multiple = false
): Promise<FileList | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.style.display = 'none'
    input.onchange = () => {
      resolve(input.files)
      document.body.removeChild(input)
    }
    input.oncancel = () => {
      resolve(null)
      document.body.removeChild(input)
    }
    document.body.appendChild(input)
    input.click()
  })
}
