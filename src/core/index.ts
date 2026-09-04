/**
 * Публичное application-ядро aprover.
 *
 * `anum_docs` остаётся нормативным источником теории и текущей семантики МТС.
 * Этот barrel публикует только consumer-only syntax/presentation/I/O adapters и
 * тонкий ANUM adapter над exact-pinned `@mts/core` v0.10.
 *
 * Канонический structured-source product — SyntaxAset. Внутреннее parser state
 * не является публичным compatibility API или второй domain authority.
 */

export type { SourceLocation } from './sourceProvenance'

export type { FileToMtlOptions } from './utils'
export { escapeLabel, fileToMtl } from './utils'

export type { TokenType, Token, MtsConformanceToken } from './lexer'
export { Lexer, LexerError, tokenize, toMtsConformanceToken } from './lexer'

export type { SyntaxAsetParseResult } from './syntaxAsetDirectEmitter'
export { ParseError, parseSyntaxAset } from './parser'

export type { NormalizerOptions, SyntaxAsetNormalizationResult } from './normalizer'
export {
  SyntaxAsetNormalizationError,
  normalizeSyntaxAset,
  syntaxAsetEqual,
} from './normalizer'

export type { StringAnumOptions, ConversionStep, StringAnumStats } from './stringAnum'
export {
  StringAnumError,
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

export type {
  PortableProofSearchBounds,
  PortableProofSearchMetrics,
  PortableProofSearchExpand,
  PortableProofSearchRequest,
  PortableProofSearchFound,
  PortableProofSearchNotFound,
  PortableProofSearchResult,
} from './proofSearch'
export { searchPortableStructuralProof } from './proofSearch'

export type {
  TheoremRecordConsumerV01,
  TheoremRecordProofV01,
  TheoremRecordApprovalV01,
  TheoremRecordV01,
  TheoremRecordRejectionCode,
  TheoremRecordReapproval,
} from './theoremLibrary'
export {
  THEOREM_RECORD_SCHEMA,
  THEOREM_RECORD_CONSUMER,
  createTheoremRecord,
  reapproveTheoremRecord,
} from './theoremLibrary'

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
  downloadFile,
  openFileDialog,
} from './fileIO'

export { projectSemanticMemoryToVisualLinkNetwork } from './visualLinkNetwork'
