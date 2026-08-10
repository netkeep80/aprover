/**
 * Публичное ядро aprover.
 *
 * `anum_docs` остаётся нормативным источником теории и контрактов МТС. Здесь
 * публикуются только единый parser/runtime, текущие consumers и replay-checker;
 * старые совместимые proof API отсутствуют.
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

export type {
  BundleRole,
  ExpectedBundleRole,
  BundleRoleAt,
  BundleElaboration,
  ResolvedOccurrence,
  LinkValue,
  BundleValue,
  MtsValue,
  FormResolver,
  BundleQueryMemory,
} from './valueBundle'
export {
  BundleElaborationError,
  BundleEvaluationError,
  elaborateBundles,
  evaluateFlatValueBundle,
  valuesEqual,
  expandBundleQuery,
  resolveCorpusForm,
} from './valueBundle'

export type { InterpretationSessionConfig } from './interpretationSession'
export { InterpretationSession } from './interpretationSession'

export type {
  InterpretationSubstitutionView,
  InterpretationAliasView,
  InterpretationPresentation,
} from './interpretationPresentation'
export { formatOccurrencePath, presentInterpretation } from './interpretationPresentation'

export type {
  DefinitionOpeningPathJudgmentV04,
  MtsProofJudgmentV04,
  MtsProofObjectV04,
} from './proofReplayV04'
export {
  MTS_PROOF_SCHEMA_V04,
  MTS_PROOF_CONTRACT_VERSION_V04,
  ProofObjectV04ValidationError,
  parseProofObjectV04,
  parseProofJsonV04,
  checkJudgmentV04,
  checkProofV04,
  checkProofV04Data,
  proofObjectV04ToData,
  canonicalProofV04Json,
} from './proofReplayV04'

export type {
  InterpretProofSearchInput,
  ProvenSearchResult,
  NotProvenSearchResult,
  ProofSearchErrorResult,
  InterpretProofSearchResult,
} from './proofSearch'
export { searchInterpretProof } from './proofSearch'

export type {
  VersionedEmptyProofArtifactView,
  VersionedInvalidProofArtifactView,
  ProofContextView,
  ProofSubstitutionView,
  ProofAliasView,
  ProofJudgmentReplayView,
  ReplayedVersionedProofArtifactView,
  VersionedProofArtifactView,
} from './proofArtifactPresentationVersioned'
export { presentVersionedProofArtifactJson } from './proofArtifactPresentationVersioned'

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
  ANUM_RAW_CARRIER_SCHEMA,
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
  AnumDenotationContext,
  ProtocolAnchor,
  DenotationRef,
  DenotationNode,
  StructuralAnumDenotation,
  RawAnumDenotation,
  QuotedRawAnumDenotation,
  AnumDenotation,
} from './anumDenotation'
export {
  denotateAnum,
  validateAnumDenotation,
  canonicalDenotationJson,
  canonicalAnum,
} from './anumDenotation'

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
