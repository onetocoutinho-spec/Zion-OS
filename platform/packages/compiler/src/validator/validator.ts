import type {
  Context,
  Diagnostic,
  DiagnosticCode,
  SourceLocation,
  Symbol,
  IR,
  ValidatedIR,
} from '@zion/shared';
import { hasBlockingError } from '@zion/shared';

function validationDiagnostic(
  code: string,
  location: SourceLocation,
  message: string,
  concept: string,
): Diagnostic {
  return { code: code as DiagnosticCode, severity: 'error', location, message, concept };
}

// Compiler 007 — Validator: confronta a IR com as invariantes da Ontologia (Parte 7).
//
// INVARIANTE V1 — Read Only:
//   O Validator nunca altera Representation, SemanticModel ou IR. Devolve a MESMA referência de IR.
// INVARIANTE V2 — No Derivation:
//   O Validator não cria fatos; apenas verifica os existentes. Um Diagnostic é observação, não fato novo.
// INVARIANTE V3 — Deterministic Diagnostics:
//   Mesma IR => mesmo conjunto de diagnósticos (iteração em ordem de entrada; sem estado externo).
//
// Verificações performáveis sobre a IR contratada (nenhuma invariante inventada — Compiler 007):
//   - Símbolo declarado mais de uma vez (P1: um Símbolo designa unicamente; Parte 7.9 multiplicidade);
//   - mais de uma Resolução para o mesmo Contexto (5.4: elege exatamente um Conteúdo por Contexto).
//
// NÃO performáveis sobre a IR como contratada (documentado, nunca silenciado):
//   - 7.1 Ciclos, 7.2 Dependências para frente, 7.3 Inalcançáveis — exigem o grafo de Dependência
//     (Cadeia/Dependência ainda sem contrato); ciclos já são detectados na Semantic (semantic.cycle);
//   - 7.5 Redundância — exigiria comparar Conteúdo, cujos Valores são opacos (unknown);
//   - D4.1 colisão de Matéria — exigiria o OBJETO da Matéria, não carregado (e `unresolved` por M1);
//   - incompatibilidades (system/004 Parte C) — não reconhecíveis mecanicamente na IR.
// Incompletude (5.5.1) NÃO é error por si só (Compiler 007) e não é reportada aqui.
export function validate(ir: IR): ValidatedIR {
  const diagnostics: Diagnostic[] = [];
  const seenSymbols = new Set<Symbol>();
  for (const node of ir.nodes) {
    if (seenSymbols.has(node.symbol)) {
      diagnostics.push(
        validationDiagnostic(
          'validation.multiplicity',
          node.location,
          'Símbolo declarado mais de uma vez.',
          'Ontologia P1 · Parte 7.9',
        ),
      );
    } else {
      seenSymbols.add(node.symbol);
    }
    const seenContexts = new Set<Context | undefined>();
    for (const resolution of node.resolutions) {
      if (seenContexts.has(resolution.context)) {
        diagnostics.push(
          validationDiagnostic(
            'validation.multiplicity',
            node.location,
            'Mais de uma Resolução para o mesmo Contexto.',
            'Ontologia 5.4 · Parte 7.9',
          ),
        );
      } else {
        seenContexts.add(resolution.context);
      }
    }
  }
  return { ir, diagnostics, apt: !hasBlockingError(diagnostics) };
}
