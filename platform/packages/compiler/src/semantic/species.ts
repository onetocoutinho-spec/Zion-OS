import type { Content, Species } from '@zion/shared';

// Espécie por FORMA (Ontologia), sem inferência (S3):
//   Atomic    -> Valor (P2, conteúdo terminal);
//   Reference -> Referência (D2);
//   Composite -> Transformação (4.2, se algum operando é Referência) ou Operação (P6).
// Os refinamentos Unidade (4.3) e Restrição (4.1) exigem marcação estrutural explícita da fonte;
// NÃO são inferidos de um payload opaco (S3).
export function speciesOfContent(content: Content): Species {
  if (content.kind === 'atomic') return 'value';
  if (content.kind === 'reference') return 'reference';
  const hasReferenceOperand = content.operands.some((operand) => operand.kind === 'reference');
  return hasReferenceOperand ? 'transformation' : 'operation';
}
