// Primitivo Surface — casca React fina sobre surfaceStyle (núcleo puro).
// Não conhece domínio nem AIL: recebe nível de superfície + métricas e
// materializa os tokens. Base neutra para empilhar conteúdo.

import type { CSSProperties, ElementType, ReactNode } from "react";
import { surfaceStyle, type SurfaceLevel, type SurfaceRadius, type SpaceKey } from "./surface-style.ts";

export interface SurfaceProps {
  level?: SurfaceLevel;
  radius?: SurfaceRadius;
  pad?: SpaceKey;
  as?: ElementType;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function Surface({ level = "default", radius, pad, as: Tag = "div", children, style, className }: SurfaceProps) {
  return (
    <Tag className={className} style={{ ...(surfaceStyle({ level, radius, pad }) as CSSProperties), ...style }}>
      {children}
    </Tag>
  );
}
