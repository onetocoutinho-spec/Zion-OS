# Evolution Report — PR-008 · Outcome Discovery

> Capítulo II — Learning Platform · descoberta pura (zero código alterado)
> Pergunta do ciclo: **o que exatamente é um Outcome dentro da Zion?**

## "Outcome" são três conceitos — e as RFCs nunca os confundem

1. **Outcome-AIL** (RFC-AIL-002 §3.6): o destino de uma Suggestion
   (confirmada/contradita/ignorada). Futuro, derivado, do Engine.
2. **Vereditos do domínio**: aprovação/rejeição/publicação — operacionais,
   existentes, persistidos.
3. **Resultados de infraestrutura**: sucesso/falha técnica — excluídos do
   aprendizado por decreto (RFC-AIL-001 §4.3).

## Evidence Map (síntese)

| Evidência | Origem | Persiste? |
|---|---|---|
| Publicação aceita | `marcarAnuncioPublicado` (status + mlItemId) | ✅ |
| Publicação rejeitada (motivo real) | `extrairErro` → `observacoes` (PR-006) | ✅ |
| Rejeição/aprovação humana | `rejeitarAnuncioGerado` / `aprovarAnuncioGerado` (`aprovadoPor/Em`) | ✅ |
| Veredito A10 | `esteira.ts` → `vereditoA10` | ✅ |
| **Pedido pago (venda)** | `buscarPedidosML` (`order.status=paid`) → `calcularMetricas` | ❌ **efêmero — evapora a cada consulta** |
| Confirmação de categoria (`prevista===usada`) | porta do `capturarDecisao` | ❌ descartada (guarda de delta) |
| Cancelamento / devolução | — | ❌ nem lidos (filtro `paid`) |

## Relação Decision × Outcome — assimétrica nos dois sentidos

A maioria das Decisions morre sem veredito (preço, medidas, pendências: nenhum
retorno). Os vereditos mais valiosos nascem **sem** Decision humana (o veto do
ambiente; a compra do mercado) — e o Outcome-AIL *ignorada* nasce da **ausência**
de Decision (002 §3.6: Outcome→Decision **1:0..1**).

## O ciclo já roda — com humano no meio

`Decision (publicar) → veredito do ambiente (persiste no domínio) → humano LÊ e
corrige → nova Decision (capturada) → Pattern`. O que não existe: o elo
Suggestion→Outcome, o ajuste automático de Confidence, e a leitura do mercado.

## Fronteiras

Outcome-AIL pertence ao **Engine futuro** (005 §4: "computar Outcome" é
responsabilidade única dele); os vereditos reais pertencem ao **domínio** hoje;
as **vendas não pertencem a ninguém** — ninguém as guarda (S-24). O Detector não
escuta Outcome (005, por decreto); o Journal não os recebe (Decision = escolha
humana, 002 §3.2 — PR-006 manteve o veto fora da AIL deliberadamente).

## A descoberta de maior consequência

**Derivar um Outcome exige memória da oferta** — a Suggestion "efêmera" (002) e o
"ledger de Outcomes" (005) não podiam ser ambos verdadeiros sem uma memória que
nenhuma RFC especificou. Registrada como S-25 e **resolvida por ADR-001**
(Suggestion Memory) no PR-009 — antes de qualquer linha do Engine.

## Organizational Knowledge Added

| Descoberta | Evidência | Impacto |
|---|---|---|
| "Outcome" são 3 conceitos | 001 §4.3 × 002 §3.6 × vereditos do domínio | vocabulário preciso antes do Engine |
| O ciclo de feedback roda com humano no meio | loop PR-006 em produção | o Engine automatiza um trecho, não cria o ciclo |
| A venda é o único veredito de sucesso e evapora | `vendasML.ts` | S-24; candidata a ADR futura |
| 4 produtores de veredito, 1 consumidor (humano) | Evidence Map | mapa de quem produz/consome/preserva |
| Derivar Outcome exige memória da oferta | 002 × 005 | S-25 → ADR-001 |
