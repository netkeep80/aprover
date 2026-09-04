import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import * as core from '../../src/core/index'
import * as fileIO from '../../src/core/fileIO'
import * as stringAnum from '../../src/core/stringAnum'
import * as utils from '../../src/core/utils'

const runtime = (module: object) => module as Record<string, unknown>
const repoPath = (...parts: string[]) => resolve(process.cwd(), ...parts)

describe('A8.3a public SyntaxAset boundary', () => {
  it('publishes canonical SyntaxAset parsing and normalization from the application core', () => {
    expect(typeof runtime(core).parseSyntaxAset).toBe('function')
    expect(typeof runtime(core).normalizeSyntaxAset).toBe('function')
    expect(typeof runtime(core).syntaxAsetEqual).toBe('function')
  })

  it('does not publish the completed AST compatibility API from the application core', () => {
    for (const name of [
      'parse',
      'parseWithRecovery',
      'parseExpr',
      'normalize',
      'normalizeFile',
      'toCanonicalString',
      'astEqual',
      'makeLoc',
      'makeInfinity',
      'makeLink',
      'makeNot',
      'makeMale',
      'makeFemale',
      'makeAbitLit',
      'makeStringLit',
      'extractLinkChain',
      'formatAstForExport',
      'generateMtlFromAst',
    ]) {
      expect(runtime(core), name).not.toHaveProperty(name)
    }

    const barrel = readFileSync(repoPath('src/core/index.ts'), 'utf8')
    expect(barrel).not.toContain("from './ast'")
    expect(barrel).not.toContain("from './astHelpers'")
  })

  it('removes the expired A1 AST to SyntaxAset oracle', () => {
    expect(existsSync(repoPath('src/core/syntaxAsetOracle.ts'))).toBe(false)
  })

  it('keeps adapters source-oriented instead of exposing completed AST helpers', () => {
    expect(typeof runtime(stringAnum).stringAnumFileToMtl).toBe('function')
    expect(typeof runtime(stringAnum).stringAnumToFormal).toBe('function')
    expect(typeof runtime(fileIO).readFileContent).toBe('function')
    expect(typeof runtime(utils).fileToMtl).toBe('function')

    for (const name of [
      'parseStringAnumLine',
      'parseStringAnum',
      'parseStringAnumExpr',
      'toStringAnum',
      'isStringAnumExpr',
    ]) {
      expect(runtime(stringAnum), name).not.toHaveProperty(name)
    }
    expect(runtime(fileIO)).not.toHaveProperty('formatAstForExport')
    expect(runtime(fileIO)).not.toHaveProperty('generateMtlFromAst')
    expect(runtime(utils)).not.toHaveProperty('parseFileLines')
  })
})
