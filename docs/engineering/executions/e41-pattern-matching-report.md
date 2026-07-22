# Evolution Report — E4.1 · Contextual Pattern Matching

> Capítulo III — Decision Intelligence · primeira capability de ASSISTÊNCIA.
> Pergunta do ciclo: **"a Zion já enfrentou uma situação parecida?"** —
> respondida onde a decisão acontece, só com conhecimento existente.

## Decision Context (Parte 1) — nenhum atributo novo

O contexto de uma decisão em andamento é exatamente o que os producers já
conhecem (`CapturaDeDecisao`): **empresa** (obrigatório — tenant), **contexto**
(obrigatório — BC), **campo** (obrigatório) — juntos, o slot da RFC-AIL-003
§3.3 — e **proposta** (opcional — o `valorAnterior` de uma futura captura).
Entidade e operação existem no formulário, mas não participam do matching (a
chave deliberadamente não os inclui — 003 §5: generalização).

## Matching (Parte 2) — igualdade canônica, nunca similaridade

`corresponder()` filtra por slot com as funções canônicas do domínio congelado
(`canonicalizarContexto`; trim estrutural). Ordem = **suporte já contado**
(mesma do Browser). Nenhum score novo, nenhum ranking inteligente, nenhuma
inferência. `propostaSegue()` compara a proposta pela forma canônica (003 §4.2)
contra o valor já canônico do Pattern — informativo, nunca prescritivo.

## Fronteira honesta: isto NÃO é o Suggestion Engine

A Memória Contextual **não escreve em campo algum, não tem botão de aplicar e
não registra oferta**. Sem oferta aplicável não existe fato-de-oferta — a
ADR-001 não é acionada e os pré-requisitos do R-SE-1 (registro de ofertas,
≥1 `consistente` em produção) permanecem intactos. Na régua do PR-010, esta
capability é **assistência de Nível 1½**: o sistema explica *em contexto*; o
Nível 2 (oferta editável com Outcome) continua gated. *Suggestions Are
Evidence, Never Commands.*

## UX (Partes 5–6) — as 5 perguntas em <10s

Componente `MemoriaContextual` no ProdutoForm (campo categoria — o slot mais
forte, com duas fontes convergentes): **silencioso** quando não há memória (a
tela fica exatamente como hoje — aditividade, 005 §6.2). Quando há:

| Pergunta | Resposta no componente |
|---|---|
| Já fizemos isso antes? | "Já fizemos isso antes — N decisões registradas" |
| O que normalmente fazemos? | valor mais frequente (mono) |
| Quão confiável? | badge da confidence materializada (+ "em disputa") |
| Quem tomou? | "por {último autor}" (+ data) |
| Posso inspecionar? | "Por quê? Ver evidências →" abre a cadeia completa do Browser |

Navegação: decisão atual → Pattern → Explainability → Evidence → Journal —
o mesmo PatternId em toda a corrente (testado ponta a ponta).

## Performance/Auditoria (Partes 7–8)

Só projeções (`padroes` + uma consulta ao Journal por empresa para o último
autor); **zero recomputação** (confidence exibida = materializada, provado em
teste); **zero persistência nova**; proposta comparada localmente (sem refetch
por tecla). Todo match tem Pattern; toda confidence tem explicação derivada dos
limiares; toda evidência é Decision com autor (ou "não registrado"); nada é
inventado — sem Patterns no slot, o componente não existe na tela.

## Verificação

333/333 testes (8 novos: match/sem-match, canonicidade, confidence preservada,
autoria, proposta segue/difere/null, disputa, navegação ponta a ponta) ·
typecheck 0 · lint 0 · rotas compilam sem erro de servidor.

## O que aprendemos sobre reutilização de conhecimento

Que reutilizar custou **uma função de filtro**: o conhecimento já estava na
forma exata de consumo (o slot é literalmente a chave de busca que um
formulário conhece). A arquitetura acertou três releases atrás: a Pattern Key
sem `entidade` (003 §5) é o que permite que a decisão sobre o produto A receba
a memória construída nos produtos B e C.

## O que aprendemos sobre assistência contextual

Que a diferença entre "arquivo" e "assistência" é **onde** a informação
aparece, não **o que** ela é — o mesmo ViewModel do Browser, movido para dentro
do formulário, muda de natureza. E que o silêncio é uma feature: um componente
que só existe quando tem evidência nunca vira ruído.

## O que aprendemos sobre adoção da Decision Intelligence

Que dá para subir a régua sem tocar os pré-requisitos do Engine: explicar em
contexto não exige ofertar. A fronteira ficou nítida e documentada — o próximo
degrau (oferta editável) tem nome (R-SE-1), pré-requisitos e ADR esperando.

## Organizational Knowledge Added

| Descoberta | Evidência | Impacto |
|---|---|---|
| O slot é a API natural entre formulários e memória | `corresponder` = filtro pela chave que o form já tem | contrato do futuro Engine |
| Assistência ≠ oferta (fronteira da ADR-001) | sem escrita em campo → sem fato-de-oferta | R-SE-1 intacto e bem delimitado |
| A generalização da Pattern Key paga dividendos | memória de B e C aparece na decisão sobre A | valida 003 §5 na prática |
| Silêncio como aditividade em UI | componente inexistente sem memória | padrão para todos os consumidores |

## Reflection

**Quando uma organização deixa de apenas armazenar conhecimento e passa a
utilizá-lo para apoiar decisões?** A evidência deste ciclo dá uma resposta
operacional: quando o conhecimento passa a ser consultado **pela chave da
decisão em curso, no instante da decisão** — e não pela curiosidade de quem
navega um acervo. O Browser (E4.0) exigia que o operador fosse até a memória;
a Memória Contextual traz a memória até o operador, sem que ele peça. O que
mudou não foi um byte do conhecimento — foi o *sentido da consulta*: de
"o que sabemos?" para "o que sabemos **sobre isto que estou fazendo agora**?".
E o programa inteiro constrange essa passagem com as suas leis já escritas: a
memória apoia sem comandar (Lei da Abstenção), aparece com explicação (Art. IV)
e cala quando não tem evidência. Apoiar decisões, na Zion, é literalmente isto:
**evidência no lugar certo, na hora certa, com o porquê ao lado — e a caneta
na mão do humano.**
