# Evolution Report — E4.0 · Pattern Browser

> Capítulo III — Decision Intelligence · primeira capability VISÍVEL da AIL.
> Pergunta do ciclo: **o que a Zion já sabe hoje?** — respondida em tela,
> exclusivamente a partir das projeções existentes.

## O que foi construído

- **Camada de leitura da AIL** (`application/pattern-browser.ts`): view models
  puros + duas consultas (`carregarSlots`, `carregarDetalhePadrao`) sobre as
  projeções `padroes` e `decisoes`. Repositórios injetáveis (padrão provado em
  `projetarPadroes`). O módulo declara os contratos: nunca escreve, nunca
  recomputa confidence, nunca infere — *The Pattern Browser Only Reveals*.
- **`/ail/padroes`** — a memória agrupada por **slot** (empresa, contexto,
  campo): valores, confidence, suporte, última ocorrência; disputa sinalizada
  com a semântica exata da RFC-AIL-004 §4.4 ("nenhum gradua; nada foi apagado").
- **`/ail/padroes/[id]`** — a cadeia de explicabilidade completa: identidade →
  confiança **com o porquê** (`explicarConfidence`, derivada dos limiares
  congelados — nunca gerada) → evidências (as Decisions de suporte com autor,
  proposta→escolha, entidade, origem) → concorrentes do slot (navegação
  relacionada preservando rastreabilidade).
- Entrada na navegação da equipe: **Memória (AIL)**.

## Critério de sucesso — as 5 perguntas do operador

| Pergunta | Onde a tela responde | Origem do dado |
|---|---|---|
| O que aconteceu? | valor aprendido + slot | `padroes.valor/contexto/campo` |
| Por que aconteceu? | evidências (proposta → escolha, origem) | `decisoes` via `decisoes_de_suporte` |
| Quantas vezes? | ocorrências + primeira/última | `padroes.ocorrencias/…_ocorrencia` |
| Quem decidiu? | último autor + autores distintos | `decisoes.autor` (anônimas → "não registrado") |
| Quais evidências sustentam? | tabela completa de Decisions de suporte | a corrente exata gravada pelo Detector |

## Auditoria (Parte 8)

Todo Pattern exibido tem origem (linha materializada + DecisionIds); toda
Confidence tem explicação (função dos limiares congelados, testada); toda
Decision tem autor (real ou o rótulo honesto "não registrado" — as anteriores à
E4.2.3 SÃO anônimas e a tela o admite); divergência não é cálculo novo (é o
`estado_slot` que o Detector já gravou); **nada é inferido ou inventado**.

## Performance (Parte 7)

Só projeções existentes — **nenhuma persistência nova, nenhuma recomputação**.
Evidências carregadas por empresa (isolamento por tenant) e filtradas pelos
DecisionIds de suporte. Risco de inconsistência: apenas a *staleness* inerente à
projeção sob demanda (E4.1.1 dará a superfície oficial de reprojeção) — nunca
inconsistência interna, pois padrões e evidências vêm do mesmo par de projeções.

## Verificação

325/325 testes (7 novos: carregamento, disputa, explicação da confidence,
evidência, autor, concorrentes, detalhe-por-id) · typecheck 0 · lint 0 · rotas
compilam sem erro de servidor. Validação visual autenticada: operador.

## O que aprendemos sobre visualização do conhecimento

Que ela não exigiu NADA de novo do modelo: cada campo da tela já existia nas
duas projeções — a arquitetura de explicabilidade (002 §8: "resposta é projeção,
nunca geração") provou-se literal na primeira tela. O custo inteiro foi view
model + apresentação.

## O que aprendemos sobre Explainability

Que explicar confidence é citar a regra congelada com os números do caso — a
função `explicarConfidence` tem 3 ramos e zero opinião. E que a honestidade
histórica aparece na UI: "não registrado" é uma explicação verdadeira, não um
buraco.

## O que aprendemos sobre adoção da Decision Intelligence

Que o primeiro consumidor da AIL confirma a fronteira dos dois verbos (002 §11):
o Browser usa apenas "consultar" — e o fez sem tocar uma linha do módulo de
domínio. A régua dos níveis (PR-010) posiciona esta tela no **Nível 1 — o
sistema explica**; o Nível 2 (sugerir) continua gated pelos pré-requisitos do E4.

## Organizational Knowledge Added

| Descoberta | Evidência | Impacto |
|---|---|---|
| A explicabilidade estrutural é implementável sem mudança de modelo | tela completa só com projeções | valida 002 §8 na prática |
| O slot é a unidade natural de navegação do conhecimento | agrupamento direto da chave (003 §3.3) | herdado pelo futuro Engine |
| Anonimato histórico é visível e honesto | "não registrado" nas Decisions pré-E4.2.3 | reforça o valor da autoria |

## Reflection

**Uma organização consegue confiar em um conhecimento que não consegue
inspecionar?** As evidências do próprio programa dizem que não — e em dois
níveis. No nível da arquitetura: a confiança da AIL é *definida* como derivação
auditável (Confidence "nunca atribuída, sempre contada"), e uma derivação que
ninguém pode conferir é indistinguível de uma opinião. No nível da história: o
programa só confiou nas próprias conclusões quando elas viraram documentos
inspecionáveis (CR-001) — conhecimento em conversa era estado frágil. O Pattern
Browser aplica ao conhecimento organizacional o mesmo tratamento: antes dele, os
Patterns existiam numa tabela que só uma consulta SQL revelava; agora qualquer
operador pode auditar o que a Zion sabe, por que sabe, e quem a ensinou — **e é
exatamente essa inspeção que legitima o passo seguinte**: só se pode aceitar uma
sugestão de quem se pode auditar.
