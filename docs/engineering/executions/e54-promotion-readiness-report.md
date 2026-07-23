# Evolution Report — E5.4 · Promotion Readiness

> EPIC E7 — Decision Intelligence Runtime · item 5/11.
> **Não promove nada.** Responde: "este Pattern já possui todas as evidências
> necessárias para uma futura promoção?" — e declara honestamente que a decisão
> permanece impossível até a ADR-002.

## O que foi construído

`application/promotion-readiness.ts` — `PromotionReadiness` (somente leitura,
jamais persistido) com as quatro perguntas **objetivas e binárias** — zero
limiares, pesos, percentuais, regras temporais ou heurísticas:

| Pergunta | Fonte | Bloqueio quando NÃO |
|---|---|---|
| Confidence no **topo da contagem**? (= `consistente` — o topo congelado da 004, não um limiar novo) | Pattern materializado | `confidence_abaixo_do_topo_da_contagem` |
| Slot sem disputa? | estado materializado | `slot_em_disputa` |
| **Sobrevive ao desconto de auto-reforço?** (projetada === atual) | E5.3 | `confidence_nao_sobrevive_ao_desconto` |
| Já foi devolvido ao campo? (∃ Outcome — existência, não quantidade) | E5.1 | `sem_outcomes_observados` |

**Bloqueio permanente em TODA avaliação:** `decisao_de_promocao_indefinida_adr_002`.
"Estruturalmente elegível" significa exatamente: *o único bloqueio restante é a
ausência da ADR-002*.

## As lacunas declaradas — dependências da ADR-002

Registradas no próprio objeto (`DEPENDENCIAS_ADR_002`), presentes em toda
avaliação:

1. **Quantos** Outcomes bastam (qualquer quantidade é limiar).
2. O que conta como Outcome **independente** (`confirmed` é influência — E5.3).
3. O que é **"confirmação sustentada"** (002 §7 não congelou número).
4. Se/como o **tempo** participa (recência deferida — 004 §6.4).

Nenhuma foi preenchida com código. Os estados "promovido"/"confiável" **não
existem nesta camada** — verificado por teste sobre a serialização.

## Verificação

396/396 testes (10 novos: elegível-só-ADR, disputado, rebaixado, estável, sem
outcomes, contagem por status, bloqueios, explainability + dependências,
determinismo/idempotência, composição) · typecheck 0 · lint 0. Nenhuma projeção
alterada; nada persistido.

## Critério de sucesso

Maturidade estrutural? ✓ (elegível/não, com o porquê) · Evidências? ✓ (4
afirmações rastreáveis) · O que falta? ✓ (bloqueios objetivos +
dependências da ADR) · Por que não pode ser promovido? ✓ (explanation cita a
ADR-002 e recusa preencher o vazio) — tudo dos fatos, zero fatos novos.

## Evolution Report

**O que aprendemos:** que existe uma camada inteira de valor ANTES da decisão —
saber *o que já se tem* e *o que exatamente falta* é executável hoje, sem uma
única regra nova; a fronteira entre engenharia e governança ficou nítida: as
quatro perguntas respondíveis viraram código, as quatro irrespondíveis viraram
uma lista com nome de ADR. E que o bloqueio permanente é uma feature de
honestidade: um `estruturalmenteElegivel: true` com bloqueio de ADR diz ao
mantenedor exatamente *"a bola está com você"*.

| Descoberta | Evidência | Impacto |
|---|---|---|
| Prontidão ≠ promoção: avaliável sem decidir | 4 perguntas binárias bastam | a ADR-002 receberá candidatos já auditados |
| A fronteira engenharia/governança é enumerável | DEPENDENCIAS_ADR_002 (4 itens) | o escopo exato da ADR-002 já está escrito |
| Elegibilidade estrutural é rara por construção | exige topo + sem disputa + sobrevive ao eco + testado em campo | promoção nunca será barata |

## Reflection (registro)

Até aqui a Decision Intelligence aprendeu a observar (E5.0), explicar (E5.1/2)
e reavaliar a própria memória sem confundir influência com evidência (E5.3).
Promotion Readiness é a última etapa antes da promoção — e seu papel não é
decidir: é tornar visível quando todas as evidências necessárias já existem e,
ao mesmo tempo, declarar honestamente quando a arquitetura ainda não autoriza a
conclusão. **A maturidade do conhecimento deve nascer dos fatos. Nunca da
ausência deles** — e, na Zion, também nunca da pressa de preencher com código o
que pertence à governança.
