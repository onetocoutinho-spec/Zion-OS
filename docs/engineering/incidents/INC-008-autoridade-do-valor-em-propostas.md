# INC-008 — Autoridade factual do valor numa Proposal

```
Status:      PARCIALMENTE CORRIGIDO — a falsa atribuição de UI foi corrigida.
             A lacuna de autoridade está DESENHADA e BLOQUEADA aguardando
             autorização de migration
Detectado:   2026-07-31, CICLOs E e F, investigando a classe sistêmica do INC-003
Severidade:  autoridade factual. NÃO é falha de integridade operacional
Escopo:      todas as ferramentas do Copilot capazes de produzir Proposal
```

## As três coisas que não são a mesma

O CICLO E provou que a **integridade operacional** está intacta: o sistema grava
exatamente o que foi confirmado. Isso levou à conclusão errada de que o problema
do INC-003 estava contido. Não estava — porque há três propriedades distintas, e
só uma delas estava provada:

| propriedade | pergunta | estado |
|---|---|---|
| **integridade operacional** | o sistema escreveu exatamente o que foi confirmado? | **sim**, provado |
| **autoridade factual** | o valor confirmado tinha fonte válida? | **não demonstrável** |
| **clareza da UI** | o cartão deixou claro o que seria escrito? | sim — mas *mentia sobre a origem* |

> **Autorização não é autoridade.** O clique prova que a pessoa consentiu. Não
> prova que o número veio dela.

## O que foi provado

Turno com a fala *"arruma o que falta nessa rasteira"* — **nenhum número dito,
nenhum no contexto**. `propor_gravacao` com um valor inventado nos argumentos:

```
individual  valor="1234"  ->  { tipo:"pronta", valor:1234,
                                resumo:"Gravar 1234 g de peso em Rasteira …" }

em lote     valor="999"   ->  { valor:999, unidadesAfetadas:6,
                                resumo:"Aplicar 999 g de peso a 6 variações de 2 produtos." }
```

Ambos são objetos válidos que a rota persiste e o cartão renderiza. **Nenhuma
camada perguntou de onde veio o número.** No caso do lote, `derivadoDoPesoConhecido`
está ausente — corretamente, porque nada foi derivado —, o que significa que a
única precondição gravada é a contagem de variantes sem peso. **Nada congela o
valor.**

## A matriz, por superfície

Levantada ferramenta a ferramenta. **`peso` não generaliza** — as superfícies
diferem, e a diferença é o achado mais útil deste incidente.

| ferramenta | o valor sai de | classe | vira Proposal? |
|---|---|---|---|
| `preparar_resolucao` | `pesoConhecidoDoProduto(produto)` — **ignora `args` por completo** | **DERIVADO** | sim |
| `propor_gravacao` (individual) | `texto(args, "valor")` | **SEM_AUTORIDADE** | sim |
| `propor_gravacao` (lote) | `texto(args, "valor")` | **SEM_AUTORIDADE** | sim |
| `propor_preco` — ramo preço | `texto(args, "preco")` | **SEM_AUTORIDADE** | sim |
| `propor_preco` — ramo margem | `precoParaMargem(margemAlvo, e)` sobre entradas do banco | **CALCULADO** | sim |
| `propor_titulo` | porto `gerarTitulo` + `avaliarTituloProposto` | conteúdo autoral | sim |
| `propor_anuncio` | porto do anúncio | — | **não persiste Proposal** |
| `gerenciar_cadastro` | `args` ao longo dos turnos | identidade/conteúdo | sim (tipo `cadastro`) |

### O desenho seguro já existe no repositório

`preparar_resolucao` é a prova. Ela **não lê `args.valor`**: deriva de
`pesoConhecidoDoProduto`, e o CICLO A já fez a referência sobreviver até a
execução como precondição `pesoConhecido:<id>`. Origem autoritativa, referência
estruturada, revalidação no clique — o padrão inteiro, funcionando, numa
ferramenta só.

O que falta não é inventar um mecanismo. É **generalizar o que uma ferramenta já
faz**.

### Duas superfícies com semântica diferente, preservadas

- **Título** — a autoridade relevante é **conteúdo**, não proveniência. Um título
  é para ser composto; perguntar "quem disse este título?" não significa nada. E
  o modelo da conversa não consegue injetá-lo: ele só passa `produtoId`.
- **Cadastro** — a autoridade relevante é **identidade**. Cria linha nova a
  partir da descrição da pessoa; não existe fonte anterior de onde derivar, e o
  risco é diferente: um SKU errado cria um produto errado — visível e
  reversível —, não sobrescreve em silêncio um fato de um produto existente.

Impor "origem do valor" a essas duas seria forçar um contrato onde ele não
descreve nada.

## A falsa atribuição — CORRIGIDA

`proporPreco` lia `const brutoPreco = texto(args, "preco")` e rotulava:

```ts
comoVeio = "o preço que você disse";
```

`ChatDaOperacao.tsx:914` renderiza isso literalmente: `Trocar o preço · {comoVeio}`.
A frase afirma que a pessoa escolheu o número, e o código só sabe que o modelo o
escreveu num argumento. Na esmagadora maioria dos turnos é verdade; no turno em
que não for, a tela atribui à pessoa uma escolha que não foi dela — **na
superfície em que ela decide**.

Substituída por uma formulação derivada do que o sistema de fato sabe:

```ts
comoVeio = "um preço informado na conversa — o Zion não calculou este número";
```

O outro ramo **continua afirmativo**, e deve: *"o menor preço que entrega 25% de
margem líquida"* descreve uma computação que realmente aconteceu sobre entradas
reais. Um descreve o que o sistema **fez**; o outro afirmava o que uma **pessoa**
disse. `atribuicaoDeProveniencia.test.ts` congela a assimetria.

Um teste existente (`precoPelaFerramenta.test.ts:323`) exigia `/você disse/` —
**congelava o defeito como especificação**. Foi corrigida a expectativa, com a
razão registrada na própria linha.

## A proposta 903c1830 — proveniência NÃO DEMONSTRÁVEL

`valor=410`, precondições **só** `variacoesSemPeso:faaed47d…=3`.

| hipótese | compatível? |
|---|---|
| a lojista disse "410" | sim |
| derivado das irmãs (que pesam `0.410 kg`) | sim |
| o modelo produziu 410 | sim |

A conversa dela (`3d8af477…`) tem **0 mensagens** — era a era do INC-004. A
ausência de `pesoConhecido:` não distingue nada: a proposta é anterior ao CICLO A.
**Nenhuma evidência persistida hoje separa as três.** Não foi tocada.

## Procedência não resolve isto — e o motivo importa

`rastroDaEscrita` grava, para os campos vindos da Proposal:

```ts
origem: "cliente", metodo: "copilot", ator: usuario,
evidencia: { registro: "copilot_propostas", id: p.id }
```

`origem: "cliente"` é **fixo**. Ele responde *"quem autorizou a escrita"*, não
*"de onde veio o número"* — e hoje os dois conceitos estão no mesmo campo. Onde o
domínio calculou (margem, título do anúncio) o código usa corretamente
`origem: "zion", metodo: "calculo"`; a lacuna é exatamente nos valores ditados ou
produzidos pelo modelo, que são registrados como afirmação da pessoa.

`OrigemDoValor` não tem valor para "modelo". E `evidencia` aponta para a
Proposal — que carrega o **valor** e não a **origem**. Logo: reconstrói-se *qual
proposta* escreveu, nunca *por que 410*.

Além disso a tabela tem **0 linhas**: nenhuma proposta foi executada, então nem o
que ela sabe registrar foi exercido.

## O desenho — NÃO IMPLEMENTADO

### O que precisa sobreviver

| pergunta | onde a informação existe | onde é descartada |
|---|---|---|
| foi derivado? | `escopo.derivadoDoPesoConhecido`, em memória | sobrevive **só** como precondição, e só para peso |
| foi calculado? | ramo de `proporPreco`, em memória | descartado ao montar `propostaDePreco` |
| foi ditado? | **em lugar nenhum** — só o texto do turno | nunca existiu como estrutura |

### As alternativas

| | o quê | migration | legacy | avaliação |
|---|---|---|---|---|
| **A** | metadata dentro de campo existente | não | tolerante | `copilot_propostas` não tem campo livre adequado; abusar de `precondicoes` misturaria revalidação com autoria |
| **B** | coluna `autoridade` em `copilot_propostas` | **sim** | precisa de regra | menor mudança que resolve; a autoridade fica junto do objeto que ela qualifica |
| **C** | tabela própria de evidência | **sim**, maior | precisa de regra | separa bem, mas duplica ciclo de vida e RLS por um campo |
| **D** | nenhuma persistência: revalidar na execução | não | tolerante | **funciona só para DERIVADO** — a execução consegue rederivar. Não alcança DITADO nem CALCULADO |

**Recomendado: B**, com **D aplicado onde couber**. A autoridade da *Proposal*
(pode existir/executar?) e a procedência do *campo gravado* (por que este valor?)
têm requisitos diferentes e ciclos de vida diferentes — não devem virar a mesma
coluna. O ponto que exige decisão de produto é o mais delicado, e está enunciado
abaixo, não resolvido.

### A pergunta que o desenho não pode responder sozinho

**O sistema não consegue provar DITADO.** Não existe estrutura que ligue um
número a uma fala; a única evidência é texto livre, e comparar prosa foi
explicitamente vedado como barreira. Então:

- rotular como DITADO só porque uma ferramenta `propor_*` recebeu o argumento
  seria **fabricar a autoridade que o incidente existe para não fabricar**;
- recusar toda Proposal sem autoridade demonstrável **quebraria
  `propor_gravacao` legítimo**, que é o caminho normal de quem dita um peso.

É uma decisão de produto, não de engenharia: *o Copilot pode aceitar um valor cuja
origem ele não sabe provar, desde que não afirme saber?* A correção da UI acima é
a metade honesta dessa resposta — parar de afirmar. A outra metade é o schema.

### Compatibilidade com propostas anteriores

Qualquer Proposal criada antes da migration — inclusive a `903c1830…` — não terá
o campo novo. **Ausência não pode ser tratada como recusa**: invalidaria retro-
ativamente objetos legítimos. A regra proposta é `NULL` ⇒ *autoridade não
registrada*, executável pelas regras de hoje, com a ausência visível na auditoria —
o mesmo princípio já adotado para procedência histórica: **ausência significa
origem não registrada, nunca origem inventada**.

### Testes que falhariam hoje

1. lote com valor de argumento produz Proposal sem qualquer precondição sobre o valor;
2. `propor_gravacao` individual idem;
3. `rastroDaEscrita` grava `origem: "cliente"` para um valor que o lojista pode não ter dito;
4. nenhuma consulta reconstrói a origem factual de um valor gravado.

### Risco e rollback

A mudança é aditiva (coluna anulável). Rollback = parar de escrever a coluna; nada
existente depende dela. O risco real não é técnico: é **classificar como DITADO o
que não se pode provar** — trocaria uma lacuna conhecida por uma falsa garantia.

## O limite do que foi demonstrado

- **PROVADO** — valor de argumento vira Proposal válida, individual e em lote; a
  falsa atribuição existia e chegava ao cartão e ao modelo.
- **FALSIFICADO** — escrita sem Proposal, sem confirmação, ou com valor/alvo
  mudando entre o cartão e a escrita.
- **NÃO DEMONSTRADO** — a proveniência do `410`; qualquer ocorrência real desta
  classe em produção.

Isto **não** diz que valores do modelo são seguros: peso e preço foram traçados;
título, anúncio e cadastro têm semântica distinta e foram tratados à parte. Não
diz que há proveniência garantida: o sistema registra autoria da escrita. E **não
encerra o INC-003** — narrativa livre contradizer ferramenta (E1) segue verdadeiro
e é dívida separada, deliberadamente fora deste ciclo.
