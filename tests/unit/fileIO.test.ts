import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SUPPORTED_EXTENSIONS,
  addRecentFile,
  clearAutosave,
  clearRecentFiles,
  getFileExtension,
  getFilePreview,
  getRecentFiles,
  isMtlFile,
  isSupportedFile,
  loadAutosave,
  removeRecentFile,
  saveAutosave,
} from '../../src/core/fileIO'

describe('fileIO module', () => {
  it('recognizes only supported source/container extensions', () => {
    expect(SUPPORTED_EXTENSIONS).toEqual(['.mtl', '.astr', '.anum'])
    expect(getFileExtension('test.MTL')).toBe('.mtl')
    expect(getFileExtension('archive.test.anum')).toBe('.anum')
    expect(getFileExtension('no-extension')).toBe('')
    expect(isSupportedFile('theory.mtl')).toBe(true)
    expect(isSupportedFile('carrier.astr')).toBe(true)
    expect(isSupportedFile('carrier.anum')).toBe(true)
    expect(isSupportedFile('result.json')).toBe(false)
    expect(isMtlFile('theory.mtl')).toBe(true)
    expect(isMtlFile('carrier.anum')).toBe(false)
  })

  it('builds previews from the first meaningful source line', () => {
    const content = `// comment\n\n∞ : {◁ = ∞, ▷ = ∞}\n(=) : {♀◁ = ♀▷, ◁♂ = ▷♂}`
    expect(getFilePreview(content)).toBe('∞ : {◁ = ∞, ▷ = ∞}')
    expect(getFilePreview('x'.repeat(80), 10)).toBe('xxxxxxxxxx...')
    expect(getFilePreview('')).toBe('(empty file)')
  })

  describe('local storage metadata', () => {
    let storage: Record<string, string>

    beforeEach(() => {
      storage = {}
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(key => storage[key] ?? null)
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
        storage[key] = value
      })
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(key => {
        delete storage[key]
      })
    })

    afterEach(() => vi.restoreAllMocks())

    it('keeps recent files as UI metadata only', () => {
      addRecentFile('a.mtl', 10, 'a')
      addRecentFile('b.mtl', 20, 'b')
      expect(getRecentFiles()).toHaveLength(2)
      expect(getRecentFiles().map(file => file.name)).toContain('b.mtl')

      removeRecentFile('a.mtl')
      expect(getRecentFiles().map(file => file.name)).toEqual(['b.mtl'])

      clearRecentFiles()
      expect(getRecentFiles()).toEqual([])
    })

    it('limits recent file metadata to ten entries', () => {
      for (let index = 0; index < 15; index++) {
        addRecentFile(`file-${index}.mtl`, index, String(index))
      }
      expect(getRecentFiles()).toHaveLength(10)
    })

    it('stores source autosave without proof-result coupling', () => {
      saveAutosave('∞ : {◁ = ∞, ▷ = ∞}')
      expect(loadAutosave()).toBe('∞ : {◁ = ∞, ▷ = ∞}')
      clearAutosave()
      expect(loadAutosave()).toBeNull()
    })
  })
})
