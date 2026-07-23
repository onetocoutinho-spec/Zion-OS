# Evolution Report — E5.3 · Confidence Evolution

> EPIC E7 — Decision Intelligence Runtime · item 4/11.
> Pergunta: **a Confidence deste Pattern continua representando corretamente a
> realidade observada?** Resposta operacional: **ela sobrevive quando removemos
> a influência do próprio sistema?**

## A decisão de design central — zero números novos

A missão proíbe heurísticas, pesos e tempo. A escada congelada não tem limiares
acima de `consistente` (002 §7 / 005 §9 dizem "Outcomes confirmam" e
"confirmação sustentada" **sem números**). A única evolução legítima hoje é:

> **`confidenceProjetada = confidenceDe(suporte INDEPENDENTE, slot
> independente)`** — as MESMAS funções congeladas do Detector, aplicadas ao
> suporte após remover as Decisions **consumidas por Ofertas confirmadas**.

Movimentos possíveis: **manter** e **rebaixar** (por desconto).
**Subir está estruturalmente bloqueado** — e TODA evolução declara isso
(`NOTA_ELEVACAO_BLOQUEADA`): definir o limiar de `confiável` exigirá política
canônica via ADR. Não é limitação da implementação; é a implementação
recusando-se a inventar o que a arquitetura não fixou.

## A regra fundamental, implementada

`confirmed` = "o operador concordou com a sugestão", nunca "a realidade
confirmou a sugestão". A Decision permanece no Journal (imutável, rastreável),
mas é **descontada**: `consumida_pela_oferta`, com decisionId + offerId +
outcomeId na lista de descartes. O desconto exige `patternId` correspondente
(confirmação de outro Pattern não vaza).

**O slot passa pelo MESMO desconto** — regra única, nenhum caso especial. Efeito
notável (testado): uma disputa sustentada por auto-reforço pode se desfazer —
se o concorrente só recorria graças a confirmações de ofertas, seu suporte
independente cai, o slot volta a CONSISTENTE e o Pattern legítimo gradua.

**Evidências válidas:** Decisions sem Oferta (o suporte independente) e
Outcomes `modified` (contradição observada — listada, jamais descontada; a
Decision divergente alimenta o concorrente via Detector, como sempre).
`pending` não é evidência de nada.

## Determinismo e fronteiras

Sem relógio, sem NOW, sem recência, sem pesos. Função pura do conjunto
{Patterns materializados, Outcomes projetados}; ordem irrelevante (testado);
idempotente; **jamais persiste, jamais altera Pattern/Confidence/Journal** —
`confidenceAnterior` é sempre a materializada, intocada.

## Verificação

386/386 testes (9 novos: sem outcomes, desconto com rebaixamento 3→2→
`recorrente`, confirmado alheio, modified listado, patternId não vaza, slot
reavaliado com desconto do concorrente, determinismo/idempotência,
explicabilidade completa) · typecheck 0 · lint 0.

## Critério de sucesso

Esta Confidence continua válida? ✓ (motivo tripartite) · Quais fatos sustentam?
✓ (`decisoesIndependentes` + `outcomesModificados`) · Quais foram
deliberadamente ignorados? ✓ (`evidenciasDescontadas` com porquê) · Por quê?
✓ (explanation cita a regra congelada e o resultado) — tudo reconstruível dos
fatos.

## Evolution Report

**O que aprendemos:** que a fronteira dura da 004 podia ser cruzada SEM cruzá-la
— reavaliar com as funções congeladas sobre evidência filtrada não inventa
escada nova, apenas pergunta se a atual se sustenta. E que o maior risco do
roadmap ("aprender consigo mesma") tem antídoto mecânico: o desconto é uma
interseção de conjuntos, não um julgamento.

| Descoberta | Evidência | Impacto |
|---|---|---|
| Reavaliar ≠ subir: dá para auditar sem inventar limiar | confidenceDe sobre suporte independente | a fronteira dura permanece intacta |
| Disputa pode ser artefato de auto-reforço | teste do slot com concorrente descontado | o desconto protege também a graduação legítima |
| O limiar de `confiável` é dívida de ADR, não de código | NOTA_ELEVACAO_BLOQUEADA em toda evolução | próxima decisão de governança já identificada |

## Reflection (registro)

A Confidence nasce dos Patterns, mas amadurece pelos Outcomes — e o maior risco
da Decision Intelligence não é aprender devagar: **é aprender consigo mesma.**
O conhecimento só evolui quando encontra evidências que existiriam mesmo se
nenhuma sugestão tivesse sido feita. Esta release torna essa frase executável:
a pergunta "quanto desta confiança é eco?" agora tem resposta determinística,
com a lista exata do que foi descontado e por quê.
