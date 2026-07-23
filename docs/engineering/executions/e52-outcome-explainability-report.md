# Evolution Report — E5.2 · Outcome Explainability

> EPIC E7 — Decision Intelligence Runtime · item 3/11.
> **Explicar não é interpretar** — é revelar a cadeia de evidências.

## O que foi construído

`application/outcome-explainability.ts` — `OutcomeExplanation`, objeto de
leitura **serializável** (JSON puro; zero React, zero apresentação):

- **Origem**: qual Offer, quando, quem a produziu (o sistema, assinado), sob
  qual contrato, com qual confidence **congelada no instante**.
- **Resposta**: qual Decision, quem (rotulado — anônimas = "não registrado"),
  quando, quanto tempo levou.
- **Comparação**: oferecido × decidido, iguais?, diferença.
- **Cadeia de evidências**: sempre 3 elos declarados — `Offer → Observation
  (E5.0) → Outcome (E5.1)` — com respostas subsequentes contadas (nada
  escondido).
- **Nota de auto-reforço** (`NOTA_AUTO_REFORCO`, texto oficial): presente SÓ em
  `confirmed`, derivada do próprio status — nunca recalculada.
- **statusExplicado**: a explanation da E5.1, intocada.

API: `explicarOutcome(outcome, oferta)` pura + `explicarOutcomes(empresa?)`.

## Nota de pureza (desvio declarado da assinatura pedida)

A missão pedia `explicarOutcome(outcome)` — mas contrato vigente, autor da
oferta e instante de criação vivem na **Oferta**, não no Outcome. Pureza exige
receber os fatos como entrada: `explicarOutcome(outcome, oferta)` (null se a
oferta não corresponde — explicação sem origem não pode existir). A variante
`explicarOutcomes` faz o join pelos logs. Nenhuma informação foi criada;
nenhuma foi duplicada no Outcome para contornar a assinatura.

## Verificação

377/377 testes (9 novos: 3 status, cadeia em 3 elos, determinismo, autor,
Offer ausente → null, Decision ausente → pending, serializabilidade roundtrip,
join por empresa) · typecheck 0 · lint 0. Nenhum módulo existente alterado;
nenhuma projeção modificada; Confidence/Patterns intocados.

## Critério de sucesso

Quem falou ✓ (autor da oferta + contrato) · quem respondeu ✓ · quando ✓ ·
qual era a sugestão ✓ · qual foi a decisão ✓ · qual a diferença ✓ · quais
fatos sustentam ✓ (cadeia de 3 elos) — tudo reconstruível só dos fatos, zero
escrita adicional.

## Evolution Report

**O que aprendemos:** que quando as camadas anteriores são honestas, explicar
vira *seleção*, não *produção* — 80% desta release já existia embutida no
Outcome da E5.1; o trabalho foi dar forma serializável e nomear os elos. E que
a fronteira "explicar ≠ interpretar" tem um teste operacional simples: se a
função precisa de algo além dos fatos de entrada, ela está interpretando.

| Descoberta | Evidência | Impacto |
|---|---|---|
| Explicar = selecionar fatos, nunca produzir | zero cálculo novo no módulo | padrão para explicabilidade futura (Confidence, Promotion) |
| A assinatura pura exige os fatos como entrada | desvio declarado da API pedida | contrato honesto para consumidores |
| A cadeia de 3 elos é o formato canônico | Offer→Observation→Outcome | reutilizável no Dashboard (E5.6) |
