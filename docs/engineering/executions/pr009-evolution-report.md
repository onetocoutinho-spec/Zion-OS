# Evolution Report — PR-009 · ADR-001 — Suggestion Memory

> Capítulo II — Learning Platform · primeiro exercício real da governança do
> Architecture Freeze v1. Decisão completa em
> [ADR-001](../../zion-os/engineering/ADR-001-suggestion-memory.md).

## O que aprendemos sobre Suggestions

"Efêmera" era uma palavra com duas leituras e só uma é compatível com o resto do
modelo: **a Suggestion vive pouco; sua história, não.** A leitura
"efêmera-sem-rastro" contradizia a própria RFC-AIL-002 (§8 exige ler Outcomes
passados; §7 os acumula; princípio 11: "esquecer não é apagar").

## O que aprendemos sobre Outcomes

Continuam deriváveis — desde que os **dois** insumos da derivação sejam
imutáveis. A 002 protegeu um só: guardou as Decisions e deixou as ofertas
evaporarem. A evidência decisiva estava congelada no código desde R-DJ-1:
`Decision.valorAnterior` = "o valor que o sistema havia proposto" — o modelo
sempre soube que a proposta precisa ser lembrada.

## O que aprendemos sobre memória

Na Zion, **tudo que aprende é projeção de logs imutáveis**: `decisoes → padroes`
provou o padrão; `ofertas × decisoes → outcomes` o repete. A memória
organizacional não guarda conclusões; guarda fatos e recomputa conclusões.

## Decisões que saíram mais fortes

- 002 §3.6 (Outcome derivado): **intacto e reafirmado** — a alternativa de
  armazenar Outcomes foi rejeitada exatamente pelo risco R3 que a 002 previu.
- O princípio de projeção do Detector virou o contrato de TODA a AIL.

## Hipóteses descartadas

Armazenar Outcomes (fere R3; congela erros de captura) · Suggestion mutável
(primeiro estado não-append-only da AIL, sem necessidade) · carona na Decision
seguinte (a *ignorada* refuta: não há Decision onde pegar carona).

## Reflection (registro)

Não foi a primeira autocorreção da arquitetura (renumeração de RFC; demoção de 4
entidades-hipótese; deferimentos declarados) — mas foi a primeira encontrada por
**investigação empírica** em vez de durante a escrita. O Freeze funcionou: a
inconsistência foi resolvida por ADR antes da primeira linha do Engine, quando
custava um documento, não uma migração. **A Zion corrigiu-se do jeito que ensina
seus Patterns a se corrigirem:** contradição sustentada rebaixou a leitura
vigente; a evidência acumulada promoveu a nova.
