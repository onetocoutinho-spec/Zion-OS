// Primitivo Surface — resolução de tokens (núcleo puro, testável sem DOM).
// LEI (ratificada): a superfície (decisão contextual) vem da Semantic; raio e
// padding (métricas invariantes ao Contexto) vêm da Foundation direto.
// NOTA: largura de borda não tem token no 004 ratificado — Surface não expõe
// borda até haver decisão (nada é inventado). Cor de borda (papel) já existe.

import { sem, type SemanticRole } from "../semantic/semantic.generated.ts";
import { fnd } from "../foundation/foundation.generated.ts";

export type SurfaceLevel = "canvas" | "default" | "raised" | "overlay" | "sunken";
export type SurfaceRadius = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "full";
/** Chave de spacing da Foundation (space.N, N = múltiplo). */
export type SpaceKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "8" | "10" | "12" | "16" | "20";

export interface SurfaceProps {
  level?: SurfaceLevel;
  radius?: SurfaceRadius;
  pad?: SpaceKey;
}

/** Estilo do Surface: background (Semantic) + raio/padding (Foundation). */
export function surfaceStyle({ level = "default", radius, pad }: SurfaceProps = {}): Record<string, string> {
  const style: Record<string, string> = {
    background: sem(`color.surface.${level}` as SemanticRole),
  };
  if (radius) style.borderRadius = fnd(`radius.${radius}`); // métrica invariante → Foundation
  if (pad) style.padding = fnd(`space.${pad}`); // métrica invariante → Foundation
  return style;
}
