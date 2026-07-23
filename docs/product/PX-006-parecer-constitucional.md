# PX-006 — Parecer Constitucional

> Auditoria da fundação do produto · 2026-07-23 · **Veredito: CONSISTENTE COM
> AJUSTES** (os 3 ajustes de uma linha foram aplicados neste mesmo registro).

## O achado central: duas constituições, de estratos diferentes

A Ontologia Normativa (`system/000`) **não é a constituição do produto — é a
constituição do sistema de Design Tokens** (31 conceitos: Token, Posição,
Matéria, Resolução, Contexto, Escopo). Ela mesma declara: *"funda os conceitos
do sistema de Tokens; não funda os conceitos de documento."* Sua cadeia
(`Product Laws — system/002`) é a cadeia normativa do design, distinta da
cadeia PX. **Não há conflito — há disjunção de domínios**: PX governa o que o
cliente vive; system governa como o design se expressa. Encontram-se no UX
visual.

## Resultados da auditoria

- **Consistência conceitual/filosófica:** vocabulários disjuntos entre
  estratos; dentro da cadeia PX, conceitos idênticos de ponta a ponta; zero
  contradições. Ressonâncias saudáveis (imputabilidade D5 ↔ assinatura;
  "não declarado não existe" ↔ honestidade).
- **Inconsistências textuais encontradas (e corrigidas):** I-1 — "3 motivos"
  × "4 motivos" de interrupção (PX-002 alinhado a PX-003/004); I-2 — "sem
  menu" × "5 áreas" (nota de reconciliação adicionada ao PX-002); I-3 — nota
  de estratos adicionada ao README.
- **Arquitetural:** nenhum PX expõe conceitos do motor ao cliente. ⚠️ Desvio
  de implementação registrado: o app atual tem Memória/DI Center no menu
  principal — corrige-se com o novo shell (5 áreas); até lá são ferramentas
  de mantenedor mal-endereçadas.
- **Cadeia normativa — dependências ausentes registradas (não inventadas):**
  `system/002 Product Laws` · `system/004` · `ADR-005` — referenciados pela
  Ontologia e ausentes do repositório. Bloqueiam apenas a fase VISUAL do
  design; estrutura e fluxos podem avançar.
- **Testes de coerência/engenharia/design:** uma só Zion emerge dos
  documentos; ambiguidades menores registradas (idioma-alvo; resumo 07:50
  fixo×preferência; critério de expiração de missão dispensada) — resolvem-se
  no UX de telas, documentadas.

## Veredito

> **A fundação está oficialmente estável para o design ESTRUTURAL do produto.**
> Riscos residuais aceitos: cadeia system incompleta (fase visual), desvio do
> menu atual (novo shell), ambiguidades menores (UX de telas). **Há exatamente
> uma Zion descrita nesses documentos.**
