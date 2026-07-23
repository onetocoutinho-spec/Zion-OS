# Evolution Report — E5.1 · Outcome Projection

> EPIC E7 — Decision Intelligence Runtime · item 2/11.
> **Outcome não é fato. Outcome é projeção** — `f(Offer Ledger × Decision
> Journal)`, via Offer Observation (E5.0). A RFC-AIL-002 §3.6 e a ADR-001,
> materializadas ao pé da letra.

## O que foi construído

- **`domain/outcome.ts`** — o tipo `Outcome` (somente leitura, jamais
  persistido) + `outcomeDe(observacao)` pura: outcomeId determinístico
  (`otc:<offerId>` — 1 oferta → 1 outcome), status, decision/autor/tempo,
  evidência bruta (valores, diferença, Pattern, confidence congelada na
  oferta) e **explanation derivada exclusivamente dos fatos**.
- **`application/outcome-projection.ts`** — `projetarOutcome(oferta, decisoes)`
  (pura) e `projetarOutcomes(empresa?)` (leitura dos dois logs). Nenhuma outra
  projeção consultada; nenhuma observação recalculada (E5.0 é a fonte).

## Estados — só os que os fatos sustentam

| Status | Classe E5.0 | Nota |
|---|---|---|
| `pending` | sem_resposta | **sem janela — nunca expira por relógio** (recência deferida, 004 §6.4) |
| `confirmed` | respondida_igual | carrega a regra do auto-reforço no próprio texto |
| `modified` | respondida_diferente | diferença explícita (oferecido → decidido) |

**Não implementados (limitação documentada):** `rejected` (remoção não registra
fato), `expired` (não há política de tempo), `ignored` (indistinguível de
pending sem fato de exibição/engajamento). Cada um exige um FATO novo na fonte
— nunca uma heurística na projeção.

## Regra do auto-reforço — implementada desde já

Todo Outcome `confirmed` declara, em `explanation` e via `decisionId`: **a
Decision que seguiu a oferta NÃO é evidência independente**. O Outcome apenas
descreve; a E5.3 usará o `decisionId` para descontar essa Decision ao evoluir
a Confidence. Nada nesta release altera Confidence, Patterns ou Knowledge —
verificável no diff: nenhum módulo existente foi tocado.

## Determinismo e reprodutibilidade

Sem relógio, sem `NOW()`, sem recência: todo tempo (`responseTimeMs`,
`respondedAt`) deriva dos timestamps DOS FATOS. Confluente: a ordem do Journal
não altera o resultado (testado). Idempotente: projetar N vezes = N resultados
idênticos, zero escrita.

## Critério de sucesso — verificado por teste

Qual Offer recebeu resposta ✓ · qual Decision respondeu ✓ · confirmou ou
modificou ✓ · quanto tempo levou ✓ · quem respondeu ✓ (com "não registrado"
para anônimas) · por que este Outcome existe ✓ — tudo reconstruível só de
`ofertas` + `decisoes`. 368/368 testes (9 novos) · typecheck 0 · lint 0.

## Reflection (registro)

A Offer registra que o sistema falou; o Outcome registra como o humano
respondeu — e entre esses dois fatos nasce o primeiro ciclo completo de
feedback da Decision Intelligence. O Outcome não é conhecimento: é
**evidência**. Evidência precede Confidence (E5.3); Confidence precede
Knowledge (E5.4); Knowledge precede Delegation (E5.10). A ordem do roadmap é a
ordem epistemológica — e cada elo continua sendo uma projeção de fatos que
ninguém pode editar.
