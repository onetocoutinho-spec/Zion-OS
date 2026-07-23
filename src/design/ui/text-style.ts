// Primitivo Text — resolução de tokens (núcleo puro, testável sem DOM).
// LEI (ratificada): cor e size/weight (decisão contextual/papel) vêm da Semantic;
// line-height (métrica invariante ao Contexto) vem da Foundation direto.
// Nenhum valor é digitado; tudo é var(--sem-*)/var(--fnd-*).

import { sem, type SemanticRole } from "../semantic/semantic.generated.ts";
import { fnd } from "../foundation/foundation.generated.ts";

export type TextRole =
  | "display" | "title-l" | "title-m" | "title-s"
  | "body-l" | "body-m" | "body-s"
  | "label" | "caption" | "mono";

export type TextTone =
  | "primary" | "secondary" | "tertiary" | "disabled" | "inverse" | "on-accent";

/** Estilo do Text: size/weight (Semantic) + line-height (Foundation) + cor (Semantic). */
export function textStyle(role: TextRole, tone: TextTone = "primary"): Record<string, string> {
  return {
    fontSize: sem(`type.${role}.size` as SemanticRole),
    fontWeight: sem(`type.${role}.weight` as SemanticRole),
    lineHeight: fnd(`type.${role}.line-height`), // métrica invariante → Foundation
    color: sem(`color.text.${tone}` as SemanticRole),
  };
}
