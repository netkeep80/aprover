/**
 * Публичное application-ядро aprover.
 *
 * `anum_docs` остаётся нормативным источником теории и текущей семантики МТС.
 * Этот barrel публикует только consumer-only syntax/presentation/I/O adapters и
 * тонкий ANUM adapter над exact-pinned `@mts/core` v0.10.
 *
 * Исторические interpreter/memory/value-bundle/proof replay/search runtimes
 * отсутствуют в current tree; история хранится в Git, а не compatibility API.
 */

export type {
  SourceLocation,
  ASTNode,
  LinkExpr,
  DefExpr,
  EqExpr,
  NeqExpr,
  MaleExpr,
  FemaleExpr,
  NotExpr,
  SetExpr,
  SequenceExpr,
  InfinityExpr,
  NumExpr,
  IdentExpr,
  AbitLitExpr,
  StringLitExpr,
  LiteralExpr,
  RoundExpr,
  SquareExpr,
  ContextPronounExpr,
  Statement,
  File,
} from './ast'

export {
  isLinkExpr,
  isDefExpr,
  isEqExpr,
  isNeqExpr,
  isMaleExpr,
  isFemaleExpr,
  isNotExpr,
  isSetExpr,
  isSequenceExpr,
  isInfinityExpr,
  isNumExpr,
  isIdentExpr,
  isAbitLitExpr,
  isStringLitExpr,
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

export type { TokenType, Token, MtsConformanceToken } from './lexer'
export { Lexer, LexerError, tokenize, toMtsConformanceToken } from './lexer'

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
  ValidationResult,
  RawCarrierRole,
  RawCarrierRef,
  RawCarrierNode,
  RawCarrierDescription,
  QuatConversionStep,
  QuatAnumStats,
} from './quatAnum'
export {
  VALID_ABITS,
  ABIT_ROLES,
  QuatAnumError,
  isValidAbit,
  validateQuatAnum,
  cleanQuatAnum,
  describeRawCarrier,
  quatAnumToStringAnum,
  quatAnumFileToMtl,
  visualizeQuatConversion,
  getQuatAnumStats,
  isQuatAnumContent,
} from './quatAnum'

export type {
  AnumStreamOperation,
  AnumResolvedValue,
  SemanticLinkExpression,
  AnumStreamDenotation,
  AnumStreamErrorCode,
} from './anumDenotation'
export {
  ANUM_DESERIALIZATION_SCHEMA,
  AnumStreamDeserializationError,
  semanticLink,
  deserializeAnumStream,
} from './anumDenotation'

export type {
  PortableProofTargetSelection,
  PortableProofApprovalRequest,
  PortableProofApprovalRejectCode,
  PortableProofApprovalDigest,
  PortableProofAcceptance,
  PortableProofRejection,
  PortableProofApprovalResult,
} from './proofApproval'
export { approvePortableStructuralProof } from './proofApproval'

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

export { projectSemanticMemoryToVisualLinkNetwork } from './visualLinkNetwork'

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
