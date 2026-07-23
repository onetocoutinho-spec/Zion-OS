# Evolution Report — E5.5 · Intelligence Analytics

> EPIC E7 — Decision Intelligence Runtime · item 6/11.
> Pergunta: **como está a saúde da Decision Intelligence?** — respondida só
> com fatos, sem nota, sem score, sem tendência.

## O que foi construído

`application/intelligence-analytics.ts` — `DecisionIntelligenceAnalytics`
(serializável, jamais persistido), com `gerarAnalytics()` e
`gerarAnalyticsEmpresa(empresa)`:

| Seção | Métricas | Fonte |
|---|---|---|
| **Patterns** | total · consistentes · disputados · **sobreviventes ao desconto** | projeção materializada + E5.3 |
| **Offers** | emitidas · respondidas · pendentes (1 oferta → 1 outcome) | E5.0/E5.1 |
| **Outcomes** | confirmed · modified · pending | E5.1 |
| **Confidence** | mantidas · rebaixadas · estáveis | motivos da E5.3 |
| **Promotion Readiness** | elegíveis · bloqueadas · **bloqueios por motivo** | E5.4 |
| **Health** | lista de FATOS + principais bloqueios | seleção das seções acima |

**Honestidade estrutural embutida:** o bloqueio `decisao_de_promocao_indefinida_
adr_002` aparece com quantidade = total de Patterns — porque vale para todos,
por construção. O painel não maquia a dependência de governança; ele a exibe
como o maior bloqueio da plataforma, que é exatamente o que ela é.

## Metodologia como cidadã de primeira classe

Toda seção declara **como foi calculada, de quais projeções, sobre quais
fatos** (`metodologia` — testada como obrigatória em todas as seções). Uma
métrica sem origem declarada não existe neste painel.

## Composição sem recalcular

Cada fonte é carregada **uma vez** (`padroes` + `projetarOutcomes`); evoluções
e avaliações são compostas com as MESMAS funções puras das camadas E5.3/E5.4 —
nenhuma fórmula própria, nenhuma segunda leitura, nenhum estado.

## Verificação

405/405 testes (9 novos: vazio honesto, saudável, disputas + agrupamento,
offers/outcomes, rebaixada sai de estáveis, metodologia obrigatória,
determinismo por ordem, serializabilidade, composição por empresa) ·
typecheck 0 · lint 0.

## Critério de sucesso

Quantos Patterns ✓ · quantos sobreviveram ao desconto ✓ · quantas Offers ✓ ·
quantos Outcomes ✓ · quantos prontos para promoção ✓ · **quais bloqueios
impedem a evolução** ✓ (agrupados, ordenados deterministicamente) — tudo por
projeções determinísticas, zero escrita.

## Evolution Report

**O que aprendemos:** que quando todas as camadas são projeções puras, o
analytics é *quase gratuito* — a release inteira é contagem e agrupamento
sobre resultados que já existiam; o custo real foi decidir **o que não fazer**
(nota, score, pesos, tendência — todos recusados por princípio). E que "saúde"
sem número é mais útil para governança: "35 bloqueados, principal motivo:
ADR-002 inexistente" aponta a ação; "saúde 7.2/10" esconderia exatamente isso.

| Descoberta | Evidência | Impacto |
|---|---|---|
| Analytics puro é contagem sobre projeções | zero fórmula própria no módulo | o Dashboard (E5.6) consome pronto |
| Saúde-sem-nota aponta ação; score esconderia | principais bloqueios nomeados | governança vê onde está a bola |
| O maior bloqueio da plataforma é de governança | ADR-002 = quantidade total, por construção | o painel pressiona a decisão certa |

## Reflection (registro)

A Decision Intelligence aprendeu a registrar, explicar, observar e reavaliar.
Agora aprende a **tornar-se observável para quem a mantém**. Uma plataforma
madura não é apenas capaz de produzir conhecimento — é capaz de mostrar, com
transparência, como esse conhecimento está evoluindo. E na Zion isso significa:
mostrar também, sem constrangimento, o que ainda a impede de evoluir.
