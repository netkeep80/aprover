/**
 * Unit tests for fileIO module
 *
 * Tests file operations for МТС (Meta-Theory of Links)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getFileExtension,
  isSupportedFile,
  isMtlFile,
  getFilePreview,
  getRecentFiles,
  addRecentFile,
  removeRecentFile,
  clearRecentFiles,
  saveAutosave,
  loadAutosave,
  clearAutosave,
  formatResultsForExport,
  SUPPORTED_EXTENSIONS,
} from '../../src/core/fileIO'
import type { ProofResult } from '../../src/core/prover'

describe('fileIO module', () => {
  describe('getFileExtension', () => {
    it('should return correct extension for .mtl files', () => {
      expect(getFileExtension('test.mtl')).toBe('.mtl')
    })

    it('should return correct extension for .astr files', () => {
      expect(getFileExtension('test.astr')).toBe('.astr')
    })

    it('should return correct extension for .anum files', () => {
      expect(getFileExtension('test.anum')).toBe('.anum')
    })

    it('should handle uppercase extensions', () => {
      expect(getFileExtension('test.MTL')).toBe('.mtl')
    })

    it('should return empty string for files without extension', () => {
      expect(getFileExtension('testfile')).toBe('')
    })

    it('should handle multiple dots in filename', () => {
      expect(getFileExtension('test.backup.mtl')).toBe('.mtl')
    })

    it('should handle hidden files', () => {
      expect(getFileExtension('.mtlrc')).toBe('.mtlrc')
    })
  })

  describe('isSupportedFile', () => {
    it('should return true for .mtl files', () => {
      expect(isSupportedFile('test.mtl')).toBe(true)
    })

    it('should return true for .astr files', () => {
      expect(isSupportedFile('test.astr')).toBe(true)
    })

    it('should return true for .anum files', () => {
      expect(isSupportedFile('test.anum')).toBe(true)
    })

    it('should return false for unsupported extensions', () => {
      expect(isSupportedFile('test.txt')).toBe(false)
      expect(isSupportedFile('test.js')).toBe(false)
      expect(isSupportedFile('test.json')).toBe(false)
    })

    it('should handle uppercase extensions', () => {
      expect(isSupportedFile('test.MTL')).toBe(true)
    })
  })

  describe('isMtlFile', () => {
    it('should return true for .mtl files', () => {
      expect(isMtlFile('test.mtl')).toBe(true)
    })

    it('should return false for non-mtl files', () => {
      expect(isMtlFile('test.astr')).toBe(false)
      expect(isMtlFile('test.anum')).toBe(false)
      expect(isMtlFile('test.txt')).toBe(false)
    })
  })

  describe('getFilePreview', () => {
    it('should return first non-empty, non-comment line', () => {
      const content = `// Comment
// Another comment
∞ = ∞ -> ∞.
other line`
      expect(getFilePreview(content)).toBe('∞ = ∞ -> ∞.')
    })

    it('should truncate long lines', () => {
      const longLine = 'a'.repeat(100) + ' = b.'
      expect(getFilePreview(longLine, 50).endsWith('...')).toBe(true)
      expect(getFilePreview(longLine, 50).length).toBe(53) // 50 chars + '...'
    })

    it('should return first comment if no non-comment lines', () => {
      const content = `// Only comments here
// Another comment`
      expect(getFilePreview(content)).toBe('// Only comments here')
    })

    it('should handle empty content', () => {
      expect(getFilePreview('')).toBe('(empty file)')
    })

    it('should handle whitespace-only content', () => {
      expect(getFilePreview('   \n   \n   ')).toBe('(empty file)')
    })
  })

  describe('localStorage operations', () => {
    let mockStorage: Record<string, string>

    beforeEach(() => {
      mockStorage = {}
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(key => mockStorage[key] || null)
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
        mockStorage[key] = value
      })
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(key => {
        delete mockStorage[key]
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    describe('recent files', () => {
      it('should return empty array when no recent files', () => {
        expect(getRecentFiles()).toEqual([])
      })

      it('should add recent file', () => {
        addRecentFile('test.mtl', 100, '∞ = ∞.')
        const files = getRecentFiles()
        expect(files).toHaveLength(1)
        expect(files[0].name).toBe('test.mtl')
        expect(files[0].size).toBe(100)
        expect(files[0].preview).toBe('∞ = ∞.')
      })

      it('should update existing file entry', () => {
        addRecentFile('test.mtl', 100, 'preview 1')
        addRecentFile('test.mtl', 200, 'preview 2')
        const files = getRecentFiles()
        expect(files).toHaveLength(1)
        expect(files[0].size).toBe(200)
        expect(files[0].preview).toBe('preview 2')
      })

      it('should maintain max 10 recent files', () => {
        for (let i = 0; i < 15; i++) {
          addRecentFile(`file${i}.mtl`, 100, `preview ${i}`)
        }
        const files = getRecentFiles()
        expect(files).toHaveLength(10)
      })

      it('should sort by most recent first', () => {
        addRecentFile('old.mtl', 100, 'old')
        // Small delay to ensure different timestamps
        addRecentFile('new.mtl', 100, 'new')
        const files = getRecentFiles()
        expect(files[0].name).toBe('new.mtl')
      })

      it('should remove recent file', () => {
        addRecentFile('test.mtl', 100, 'preview')
        removeRecentFile('test.mtl')
        expect(getRecentFiles()).toHaveLength(0)
      })

      it('should clear all recent files', () => {
        addRecentFile('file1.mtl', 100, 'preview 1')
        addRecentFile('file2.mtl', 100, 'preview 2')
        clearRecentFiles()
        expect(getRecentFiles()).toHaveLength(0)
      })
    })

    describe('autosave', () => {
      it('should save autosave content', () => {
        saveAutosave('test content')
        expect(loadAutosave()).toBe('test content')
      })

      it('should return null when no autosave', () => {
        expect(loadAutosave()).toBeNull()
      })

      it('should clear autosave', () => {
        saveAutosave('test content')
        clearAutosave()
        expect(loadAutosave()).toBeNull()
      })
    })
  })

  describe('formatResultsForExport', () => {
    const mockResults: { stmt: string; result: ProofResult }[] = [
      {
        stmt: '∞ = ∞ -> ∞',
        result: {
          success: true,
          message: 'Применена аксиома А4',
          appliedAxioms: [
            {
              id: 'A4',
              name: 'Смысл (акорень)',
              formula: '∞ : (∞ → ∞)',
              description: 'Полное самозамыкание',
            },
          ],
        },
      },
      {
        stmt: '♂∞ = ∞♀',
        result: {
          success: false,
          message: 'Невозможно доказать равенство',
          appliedAxioms: [],
        },
      },
    ]

    it('should format results as text', () => {
      const output = formatResultsForExport(mockResults, { format: 'text' })
      expect(output).toContain('aprover - Результаты верификации')
      expect(output).toContain('Всего выражений: 2')
      expect(output).toContain('Успешно: 1/2')
      expect(output).toContain('✓ ∞ = ∞ -> ∞')
      expect(output).toContain('✗ ♂∞ = ∞♀')
    })

    it('should format results as JSON', () => {
      const output = formatResultsForExport(mockResults, { format: 'json' })
      const parsed = JSON.parse(output)
      expect(parsed).toHaveLength(2)
      expect(parsed[0].statement).toBe('∞ = ∞ -> ∞')
      expect(parsed[0].success).toBe(true)
      expect(parsed[0].axioms).toContain('A4')
      expect(parsed[1].success).toBe(false)
    })

    it('should include details when requested', () => {
      const output = formatResultsForExport(mockResults, { includeDetails: true, format: 'text' })
      expect(output).toContain('Аксиомы: A4')
    })

    it('should omit details when not requested', () => {
      const output = formatResultsForExport(mockResults, {
        includeDetails: false,
        format: 'text',
      })
      expect(output).not.toContain('Аксиомы:')
    })
  })

  describe('SUPPORTED_EXTENSIONS', () => {
    it('should include all three supported extensions', () => {
      expect(SUPPORTED_EXTENSIONS).toContain('.mtl')
      expect(SUPPORTED_EXTENSIONS).toContain('.astr')
      expect(SUPPORTED_EXTENSIONS).toContain('.anum')
      expect(SUPPORTED_EXTENSIONS).toHaveLength(3)
    })
  })
})
