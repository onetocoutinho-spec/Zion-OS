# Evolution Report — E4.2.3 · Decision Authorship

> Capítulo III — Decision Intelligence · primeira implementação do capítulo.
> Fecha a dívida descoberta no PR-011 (S-36: Decisions anônimas) — o primeiro
> passo concreto do Artigo VIII (Accountability), o único artigo constitucional
> em aberto (AR-001).

## Escopo executado

| Produtor | Tipo de autor | Identificador | Adaptação |
|---|---|---|---|
| `pendencias.resolverPendencia` | humano | e-mail da sessão | parâmetro no observador |
| `produtos.atualizarProduto` | humano | e-mail da sessão | parâmetro no observador (resolvido só quando haverá captura) |
| `canaisMarketplace.salvarCanal` | humano | e-mail da sessão | spread no wiring — builder puro intocado |
| `publicacaoML.publicarNoML` | humano | e-mail da sessão | spread no wiring — builder puro intocado |

**Por que só "humano":** por definição congelada (RFC-AIL-002 §3.2, Decision =
escolha do cliente). Não existem producers de sistema/marketplace/importação —
execuções autônomas não são Decisions (PR-010/011); a importação não captura.

**Identificador:** e-mail da sessão Supabase (legível nas explicações futuras —
002 §8 "quem tomou?"), fallback id do usuário, `""` em demo/sem sessão/falha —
o valor exato que as Decisions carregavam antes (retrocompatibilidade total).
`autorAtual()` nunca lança e não faz rede (getSession lê o cache).

## Auditoria

- **Decisions futuras:** todas nascem com `autor` preenchido (4/4 pontos de
  captura; `capturarDecisao` já propagava desde PR-004 — faltava alguém entregar).
- **Decisions existentes:** intocadas — o Journal é append-only (022); nenhuma
  migração, nenhum UPDATE.
- **Retrocompatibilidade:** coluna `autor` existe desde a 022 com default `''`;
  demo continua produzindo `""`; nenhum consumidor lê `autor` ainda (o Detector
  não o usa — a Pattern Key não muda, RFC-AIL-003 §5: chave sem autor,
  deliberado — "fragmentaria o aprendizado da empresa por usuário").
- **Comportamento:** zero mudança — autor resolvido só quando haverá captura;
  falha na autoria degrada para `""`, nunca interrompe.

## Verificação

325/325 testes (7 novos) · typecheck 0 · lint 0. Novos: extrator puro
(e-mail/fallback/vazio), demo → `""`, propagação via `capturarDecisao`, o
caminho de spread dos dois builders, assertivas de autoria nos producers.

## O que aprendemos sobre autoria

Que ela já estava desenhada em três camadas — campo na Decision (R-DJ-1),
propagação no `capturarDecisao` (PR-004), coluna no banco (022) — e nenhuma
tinha fornecedor. A implementação inteira coube em "entregar o valor": 154
linhas, metade testes. E que autoria **não** entra na identidade do Pattern por
decisão congelada da RFC-AIL-003 (§5: chave com autor = falso negativo) — a
autoria explica, não fragmenta.

## O que aprendemos sobre accountability

Que ela é incremental: este passo responde "quem produziu esta Decision?" para
todo o futuro, sem tocar o passado (append-only é também honestidade histórica —
as Decisions antigas SÃO anônimas e o registro o admite). Os dois passos
restantes do Artigo VIII seguem mapeados: execuções do sistema não assinam
(S-30) e o `Autor` tipado dorme na fundação (S-35).

## Impacto na Decision Intelligence

A explicabilidade futura (002 §8: "quem tomou a decisão?") deixa de ter resposta
vazia; métricas por autor (RFC-AIL-001 §9) tornam-se possíveis; e o Suggestion
Engine herdará Decisions atribuíveis desde o primeiro dia.

## Reflection

**Uma organização consegue responder por decisões que não consegue atribuir a
alguém?** A evidência do próprio domínio diz que não — e ele sempre soube: toda
autoridade exercida na Zion exige um grant identificável (token do cliente,
papel do perfil, clique com `aprovadoPor`), e a única exceção era justamente a
memória organizacional, que registrava *o que* foi decidido sem *quem*. Um
Journal anônimo podia contar repetições, mas não podia sustentar
responsabilidade — "a empresa decidiu X três vezes" responde ao Detector;
"quem decidiu?" responde à organização. A partir desta release, as duas
perguntas têm resposta.
