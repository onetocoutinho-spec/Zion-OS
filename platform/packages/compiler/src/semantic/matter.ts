import type { Matter } from '@zion/shared';

// D4 — Matéria: a espécie de objeto que o Conteúdo determina.
// Para um payload Atomic OPACO, o objeto não é estruturalmente derivável; sob S3 (Non-Inference)
// NÃO é inferido. A resolução é um framework de propagação; na base atômica permanece não resolvida.
//
// REGRA M1 — Matter Opacity:
//   Conteúdos atômicos cuja Matéria não possa ser derivada exclusivamente da Ontologia permanecem
//   em estado `unresolved`. Esse estado representa AUSÊNCIA LEGÍTIMA de informação normativa,
//   nunca erro da análise.
export type MatterResolution =
  { readonly resolved: false } | { readonly resolved: true; readonly matter: Matter };

// Neste nível (sem domínio/linguagem), a Matéria de qualquer cadeia termina numa base atômica opaca:
// não resolvida por S3. Retornar não resolvido é o comportamento correto, nunca um palpite.
export function resolveMatter(): MatterResolution {
  return { resolved: false };
}
