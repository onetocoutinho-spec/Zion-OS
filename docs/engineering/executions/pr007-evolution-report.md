# Evolution Report — PR-007 · Pattern Confidence Discovery

> Capítulo II — Learning Platform · descoberta pura (zero código alterado)
> Pergunta do ciclo: **quando a Zion pode confiar no que aprendeu?**

## Lifecycle real dos Patterns (só o que o código prova)

| Estado | Entra | Sai | Evidência |
|---|---|---|---|
| observado/emergente | 1ª Decision elegível da chave | suporte ≥ 2 | `confidenceDe` (`pattern.ts`) |
| recorrente/emergente | suporte ≥ 2 | ↑ ≥3 ∧ slot consistente · ↓ nunca por contagem | RFC-AIL-004 §4.3 |
| consistente/estabelecido | suporte ≥ 3 ∧ único recorrente do slot | slot vira `em_disputa` → rebaixa (suporte intacto) | Cenário 4 — **o único rebaixamento do sistema** |
| confiável/validado/automatizável | — inalcançável | — | fronteira dura §4.3 (exigem Outcomes) |
| aposentado/obsoleto | — **não existe** | — | deferido R-AIL-5 (§6.4, EVIDÊNCIA INSUFICIENTE) |

**Fato estrutural:** um Pattern hoje nunca morre, nunca envelhece, nunca perde
suporte. A única força descendente é a disputa de slot.

## Confidence Signals — inventário

**Existem:** frequência (`ocorrencias`, monotônica) · conflito (`em_disputa`) ·
convergência de fontes (PR-006: cadastro e publicação no mesmo slot).
**Armazenados e nunca lidos:** tempo (`decidido_em`, `primeira/ultima_ocorrencia`)
· origem (`Decision.origem`).
**Não existem:** confirmação (**descartada na porta** — a guarda de delta joga
fora toda aceitação; onde `valorAnterior` é proposta do sistema, a igualdade É
confirmação, RFC-AIL-002 §3.6) · reversão (**invisível por teorema** — a
confluência §7.3 apaga a ordem; A→B→A **fortalece** A) · decay · exceções.

## Descoberta central: contagem pressupõe domínio de valores fechado

| Slot ativo | Domínio de valores | Contagem funciona? |
|---|---|---|
| categoriaMarketplace | fechado-grande (MLB ids), **2 fontes convergem** | ✅ caso ideal |
| tipoAnuncio | fechado-pequeno; `valorAnterior` = proposta | ✅ (e onde a confirmação descartada mais dói) |
| tabelaMedidas | semi-fechado (guias nomeadas) | ✅ moderado |
| precoVenda | **contínuo** — `canonicalizarValor` não normaliza números | ❌ estrutural |
| informacaoPendente | texto livre | ❌ suporte 1 para sempre (vale como métrica) |

## Resposta do ciclo

**A confiança tem duas camadas:** repetição e conflito **emergem sozinhos** da
contagem; confirmação, reversão e envelhecimento **exigem modelagem explícita** —
exatamente os três que a RFC congelada deixou de fora com "EVIDÊNCIA
INSUFICIENTE". *"O que faz uma organização confiar em uma decisão repetida?"*
— (1) ela recorre, (2) nada recorre contra ela, (3) quando devolvida, é mantida.
A terceira perna exige oferecer: **acima de `consistente`, confiar exige o
Suggestion Engine**. Pré-condição honesta: em produção não há sequer um Pattern
`recorrente` — primeiro os dados, depois a oferta.

## Critério de prontidão registrado (E4)

O Suggestion Engine só inicia quando existir **≥ 1 Pattern `consistente` em
produção**. Estado na data: 1 Pattern, suporte 1, `observado`.
