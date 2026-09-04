/**
 * Browser file operations for canonical MTS source and Anum carriers.
 *
 * Proof results are intentionally not handled here. Trusted proof objects use
 * the separate mts-proof/v0.2 replay boundary.
 */

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
