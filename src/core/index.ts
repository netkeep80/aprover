/**
 * aprover public core API.
 *
 * `anum_docs` is the normative source for MTS theory/contracts. This package
 * exposes the canonical parser/runtime plus the pinned mts-proof/v0.2 replay
 * checker; legacy A0-A11 proof-search semantics are intentionally not public.
 */

export type {
  SourceLocation,
  ASTNode,
  LinkExpr,
  NotLinkExpr,
  DefExpr,
  EqExpr,
  NeqExpr,
  MaleExpr,
  FemaleExpr,
  NotExpr,
  PowerExpr,
  SetExpr,
  InfinityExpr,
  NumExpr,
  IdentExpr,
  AbitLitExpr,
  StringLitExpr,
  LiteralExpr,
  RoundExpr,
  BracketExpr,
  SquareExpr,
  ContextPronounExpr,
  Statement,
  File,
} from './ast'

export {
  isLinkExpr,
  isNotLinkExpr,
  isDefExpr,
  isEqExpr,
  isNeqExpr,
  isMaleExpr,
  isFemaleExpr,
  isNotExpr,
  isPowerExpr,
  isSetExpr,
  isInfinityExpr,
  isNumExpr,
  isIdentExpr,
  isAbitLitExpr,
  isStringLitExpr,
  isBracketExpr,
  astToString,
} from './ast'

export {
  makeLoc,
  makeInfinity,
  makeLink,
  makeNot,
  makeMale,
  makeFemale,
  makeAbitLit,
  makeStringLit,
  extractLinkChain,
} from './astHelpers'

export type { FileParseOptions, FileToMtlOptions } from './utils'
export { escapeLabel, parseFileLines, fileToMtl } from './utils'

export type { TokenType, Token } from './lexer'
export { Lexer, LexerError, tokenize } from './lexer'

export type { ParseResult } from './parser'
export { Parser, ParseError, parse, parseWithRecovery, parseExpr } from './parser'

export type { NormalizerOptions } from './normalizer'
export {
  NormalizationError,
  normalize,
  normalizeFile,
  toCanonicalString,
  astEqual,
  clearNormalizationCache,
  setNormalizationCacheEnabled,
  getNormalizationCacheStats,
  getNormalizationCache,
} from './normalizer'

// Canonical MTS v0.2 contextual interpretation.
export type {
  LinkRef,
  OccurrencePath,
  MemoryView,
  ContextFrame,
  HoleId,
  InterpretationSubstitution,
  InterpretationAlias,
  InterpretationResult,
} from './interpreter'
export { InterpretationError, resolveContextPronoun, interpretConstraints } from './interpreter'

export type { DistinguishedLink } from './memoryView'
export { ExplicitMemoryView } from './memoryView'

export type { InterpretationSessionConfig } from './interpretationSession'
export { InterpretationSession } from './interpretationSession'

export type {
  InterpretationSubstitutionView,
  InterpretationAliasView,
  InterpretationPresentation,
} from './interpretationPresentation'
export { formatOccurrencePath, presentInterpretation } from './interpretationPresentation'

// Candidate mts-proof/v0.2 trusted replay boundary. No proof search lives here.
export type { ProofExpectedResult, InterpretProofStep, MtsProofObjectV02 } from './proofReplay'
export {
  MTS_PROOF_SCHEMA,
  MTS_CONTRACT_VERSION,
  MTS_TRUSTED_PROOF_RULE,
  checkInterpretProofStep,
  checkProof,
} from './proofReplay'

export type { StringAnumOptions, ConversionStep, StringAnumStats } from './stringAnum'
export {
  StringAnumError,
  parseStringAnumLine,
  parseStringAnum,
  parseStringAnumExpr,
  toStringAnum,
  isStringAnumExpr,
  stringAnumToFormal,
  stringAnumFileToMtl,
  visualizeConversion,
  getStringAnumStats,
} from './stringAnum'

export type {
  AbitChar,
  QuatAnumOptions,
  ParsedAbit,
  ParsedContext,
  ValidationResult,
  QuatConversionStep,
  QuatAnumStats,
} from './quatAnum'
export {
  VALID_ABITS,
  ABIT_DEFINITIONS,
  QuatAnumError,
  isValidAbit,
  validateQuatAnum,
  cleanQuatAnum,
  parseAbitToAST,
  quatAnumToFormal,
  quatAnumToStringAnum,
  parseQuatAnumLine,
  parseQuatAnum,
  parseQuatAnumExpr,
  toQuatAnum,
  isQuatAnumExpr,
  quatAnumFileToMtl,
  visualizeQuatConversion,
  getQuatAnumStats,
  isQuatAnumContent,
} from './quatAnum'

export type { FileMetadata, SupportedExtension } from './fileIO'
export {
  SUPPORTED_EXTENSIONS,
  readFileContent,
  isSupportedFile,
  isMtlFile,
  getFileExtension,
  getFilePreview,
  getRecentFiles,
  addRecentFile,
  removeRecentFile,
  clearRecentFiles,
  saveAutosave,
  loadAutosave,
  clearAutosave,
  formatAstForExport,
  generateMtlFromAst,
  downloadFile,
  openFileDialog,
} from './fileIO'

export type {
  LinkGraphNodeType,
  LinkGraphNode,
  LinkGraphEdgeType,
  LinkGraphEdge,
  LinkGraph,
} from './linkGraph'
export {
  projectToGraph,
  projectStatementsToGraph,
  toCytoscapeElements,
  linkGraphToDOT,
} from './linkGraph'
