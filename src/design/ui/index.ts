// Primitive UI (ENG-002 Etapa 2). Componentes cegos a domínio e à AIL:
// consomem Semantic (cor/papel/contexto) e Foundation (métrica invariante),
// nunca a cor da Foundation direto. Superfície pública da slice de design.

export { Text, type TextProps } from "./Text.tsx";
export { Surface, type SurfaceProps } from "./Surface.tsx";
export { textStyle, type TextRole, type TextTone } from "./text-style.ts";
export { surfaceStyle, type SurfaceLevel, type SurfaceRadius, type SpaceKey } from "./surface-style.ts";
