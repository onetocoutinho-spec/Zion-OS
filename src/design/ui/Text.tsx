// Primitivo Text — casca React fina sobre textStyle (núcleo puro).
// Não conhece domínio nem AIL: só recebe papel tipográfico + tom e materializa
// os tokens Semantic/Foundation. É a única forma da slice pintar texto.

import type { CSSProperties, ElementType, ReactNode } from "react";
import { textStyle, type TextRole, type TextTone } from "./text-style.ts";

export interface TextProps {
  role?: TextRole;
  tone?: TextTone;
  as?: ElementType;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function Text({ role = "body-m", tone = "primary", as: Tag = "span", children, style, className }: TextProps) {
  return (
    <Tag className={className} style={{ ...(textStyle(role, tone) as CSSProperties), ...style }}>
      {children}
    </Tag>
  );
}
