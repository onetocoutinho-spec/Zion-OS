// @zion/compiler — fases do compilador.
// PHASE 05: Lexer Engine — mecanismo parametrizado que consome um LexicalContract (Compiler 002).
// PHASE 06: Parser Engine — mecanismo parametrizado que consome um ConstructionContract (Compiler 003).
export * from './lexer';
export * from './parser';
// PHASE 07: Semantic Analysis — resolução direta da Ontologia (S1/S2/S3; Compiler 004/005).
export * from './semantic';
// PHASE 08: Intermediate Representation — projeção do SemanticModel (IR1/IR2/IR3; Compiler 005).
export * from './ir';
// PHASE 09: Validator — invariantes da Ontologia sobre a IR (V1/V2/V3; Compiler 007).
export * from './validator';
// Compiler 006: Pipeline — orquestracao unica das fases (delegada por CLI 014 e LSP 016).
export * from './pipeline';
