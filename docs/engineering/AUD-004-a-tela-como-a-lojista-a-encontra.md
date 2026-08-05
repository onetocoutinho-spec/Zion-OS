# AUD-004 — A tela como a lojista a encontra

```
Data:    2026-08-05
Origem:  "seria interessante um estudo de ux e ui nesse plano para melhorarmos"
Régua:   cada afirmação aqui é LIDA NA FONTE, OBSERVADA EM USO REAL, ou marcada
         como NÃO MEDIDO. Nenhuma é gosto.
Método:  leitura do código que PRODUZ a tela + os episódios de uso desta semana
Precede: as decisões de UI do PLANO-001 §B (B2, B4, B8)
```

Este projeto tem duas bibliotecas que não se encontram.

De um lado, a **visão**: `UX-002`, `UX-003`, `UX-004`, `UX-010`, `UI-001` —
palco, missões, capabilities, o modelo mental do sistema operacional. São bons
documentos e não descrevem nenhuma tela que existe.

Do outro, as **auditorias medidas**: `AUD-001` mediu o que a tela *afirma*,
`PLANO-001` mediu a conta, `DES-005` mediu a escala. Nenhuma mediu a tela como
objeto de uso — o que ela pede, o que esconde, e o que faz quando não sabe.

Esta auditoria preenche esse vão. Ela não propõe uma reforma visual: propõe
consertos onde a tela **mente por omissão**, que é o mesmo defeito que
`AUD-001` encontrou nos números, um andar acima.

---

## 1 · O achado que vale mais que todos os outros juntos

**A primeira tela transforma "não sei" em zero. Dez vezes.**

`src/app/cliente/page.tsx` — a Visão geral, a porta do portal — abre **dez**
consultas e de cada uma tira só o dado:

```ts
const { data: produtos } = useLiveQuery(...)
const { data: anuncios } = useLiveQuery(...)
// ...dez vezes
```

`useLiveQuery` devolve três coisas: `data`, `carregando` e `erro`. As duas
últimas são descartadas em todas as dez. E o cálculo faz:

```ts
const prods = produtos ?? [];
const ans   = anuncios ?? [];
```

`useLiveQuery` começa em `data: null, carregando: true`. Então **enquanto
carrega** — e **quando falha** — a lojista vê uma loja com zero produtos, zero
anúncios, nada pendente e nenhuma infração. Uma loja vazia e em paz.

### Por que isto é grave e não é um detalhe de carregamento

Este repositório tem uma regra, e ela está escrita em dezenas de arquivos:

> zero significa "não sei", nunca um valor.

Ela é aplicada com rigor à **procedência do dado** — `infracoes?: number` é
opcional de propósito, e o comentário diz que colapsar `undefined` e `0` "faria
o assistente afirmar conta limpa sem ter olhado". A mesma regra **não é aplicada
ao estado de carga**. O `?? []` faz exatamente o que o `?? 0` é proibido de
fazer.

E o arquivo prova que a equipe já reconhece o padrão: os comentários dele
registram **três** consertos da mesma família, nesta mesma tela —

| o que dizia | o que era |
|---|---|
| "Otimizado" | 791 anúncios, **zero** avaliados pela IA |
| "Ativos: 791" | o Mercado Livre diz **491**. Trezentos que ela pensava estarem vendendo |
| "Sem otimização: 0" | contava produtos sem anúncio, que são zero |

Os três eram a tela afirmando com autoridade o que não sabia. O quarto é o
mesmo, e ainda está lá.

**Conserto:** a Visão geral precisa distinguir três situações — carregando, não
consegui ler, e li e é zero. Não é um *spinner*: é a diferença entre "sua loja
está em paz" e "eu não consegui olhar".

---

## 2 · O que o uso real desta semana ensinou

Quatro episódios, todos com evidência, todos da mesma família.

### 2.1 · "não consegui achar o botão"

O cabeçalho de Meus Produtos tinha **sete** botões. O dono do produto — que
conhece o sistema — não achou o de importar catálogo.

Foi consertado (`2c7f865`, sete → quatro, com uma porta única de importação
nomeada pelo que o vendedor **tem**, não pelo que o sistema faz). Fica aqui como
medida: se quem construiu não acha, ninguém acha.

### 2.2 · "Olá" recebia "Não entendi a sua pergunta"

A primeira frase que qualquer pessoa digita, e a resposta era uma recusa com uma
lista de capacidades. O classificador estava certo — a lista fechada de
intenções não tinha lugar para um cumprimento. **A regra não previa a primeira
frase.**

Consertado em `f057ea3`. A lição de UI é a moldura: o conteúdo da lista não
mudou, e "O que eu consigo responder" virou "Pode me perguntar". A mesma
informação, e a primeira ensina que a ferramenta é difícil.

### 2.3 · A linha cinza que apagava o próprio diagnóstico

> A resposta desta pergunta não chegou. Pergunte de novo.

Quatro perguntas assim num print real. `paraGuardar` gravava pergunta, texto,
resposta, ferramentas e desfecho — e **não gravava o erro**. Toda falha *com
mensagem* era trocada por essa linha no primeiro recarregamento.

E "Pergunte de novo" manda **redigitar**. Consertado em `e898e05`, mas a lição de
UI segue aberta: *um turno que falhou deveria oferecer o clique de repetir, não
instruir a pessoa a reescrever o que ela já escreveu.* **Isto não está feito.**

### 2.4 · O *spinner* que girava para sempre

Antes disso (03/08), o mesmo módulo não gravava a `resposta` — e a tela
renderizava "Lendo os seus dados…" indefinidamente. Quatro perguntas presas,
também num print real.

**O padrão dos quatro:** a tela tem estados suficientes, e o *cache* que a
alimenta tem menos. Um estado que não atravessa o disco não existe.

---

## 3 · A arquitetura de informação: o que já foi feito

Isto está bom e merece registro, porque é a maior conquista de UX do projeto e
não está documentada como tal.

O menu do lojista tinha **quinze** itens — Início, Criar anúncio, Vendas, Meus
Produtos, Meus Anúncios, Fotos, Medidas, Peso e caixa, Ferramentas avulsas,
Auditoria, Precificação, Relatórios, Pendências, Configurações, Ajuda.

Hoje são **cinco áreas, cada uma uma pergunta**:

| área | a pergunta que ela responde |
|---|---|
| Hoje | O que importa agora? |
| Catálogo | O que sabemos dos produtos? |
| Anúncios | Como dizemos e prometemos? |
| Pulso | Como está a loja? |
| Zion | O que combinamos? |

Nenhuma rota mudou de lugar. **Trocar a moldura sem mexer no conteúdo** foi o
passo de maior efeito por risco do projeto inteiro.

### O que sobrou dessa reforma

As **17 telas** continuam existindo por trás das cinco portas, e duas coisas
ficaram:

1. **"Ferramentas avulsas"** é o único item do menu nomeado pelo que ele **é**
   para nós, não pelo que ela **quer**. É onde o resto foi parar.
2. Três telas passam de **900 linhas** — `produtos` (1.213), `otimizar` (1.017),
   `anunciar` (968). Tamanho de arquivo não é problema de UX por si; é sinal de
   tela que acumulou responsabilidades, e vale conferir se cada uma ainda
   responde **uma** pergunta.

---

## 4 · A varredura de estados — e por que ela está incompleta

Passei um grep por `carregando`, `erro` e "vazio" nas 17 telas e o resultado
sugeriu que 9 não tratam carregamento, 6 não tratam vazio e 4 não tratam erro.

**Não publico esses números como medida, porque conferi três e dois eram falso
positivo:** `imagens` trata o vazio por `length === 0` (meu padrão não pegava), e
`assistente` delega ao componente do chat, que tem os três estados. `precificacao`
era verdadeiro.

O instrumento é grosseiro e a régua deste repositório não aceita isso. Fica como
**trabalho, não como achado**: uma passagem tela por tela, conferindo na fonte —
e o resultado dela é uma lista de consertos, não um número.

O que **está** medido e verificado é a §1, que é onde o dano é maior.

---

## 5 · A pergunta de UI que o produto ainda não respondeu

Três itens do `PLANO-001` são de UI e estão parados esperando uma decisão de
desenho, não de código:

**B2 — a lista priorizada das capas.** 535 fotos fora do padrão. A tela diz
"535 estão ruins", e ninguém começa um trabalho de semanas. A pergunta de
desenho é: *qual é a menor unidade de trabalho que produz resultado visível?*
Vinte fotos que concentram estoque e exposição são uma tarde.

**B4 — a foto por cor** (DES-003). A associação foto↔cor nunca existiu. Precisa
de aprovação para **quatro** tipos de imagem, não três — o infográfico não cabe
em nenhum dos três originais. É decisão de produto.

**B8 — a tela de medidas que não muda nada.** A lojista preenche
`/cliente/medidas` e a publicação continua lendo a lista do **código**. Uma tela
que não muda nada é pior que nenhuma: ela ensina que preencher não serve.

---

## 6 · O que fazer, em ordem

A ordem é por dano, e o primeiro é o único que eu faria sem perguntar nada.

1. **A Visão geral para de dizer zero quando não sabe** (§1). Verificado na
   fonte, é o dano maior, e é conserto contido numa tela.
2. **Repetir a pergunta com um clique** (§2.3). Um turno que falhou já sabe o
   que foi perguntado; mandar redigitar é a única parte daquele defeito que
   sobrou.
3. **A varredura de estados, tela por tela, conferida na fonte** (§4). Produz a
   lista real.
4. **B8 — ou a tela de medidas afeta a publicação, ou sai do menu.** As duas
   saídas são honestas; a de hoje não é.
5. **B2 — a menor unidade de trabalho visível.** Decisão de desenho antes de
   código.
6. **"Ferramentas avulsas" ganha o nome do que ela quer** (§3), ou some.

---

## 7 · O que esta auditoria NÃO afirma

- **Nada sobre o visual.** Não vi nenhuma tela renderizada. A rede deste
  ambiente não alcança o *preview* (medido: `http=000`) e não há banco para
  popular um servidor local. Tipografia, contraste, espaçamento, hierarquia
  visual e comportamento em telefone **não foram avaliados** — e são metade de
  um estudo de UI. Isso precisa de olhos numa tela real.
- **Que as 17 telas são demais.** Pode ser; não medi. O que medi é que uma delas
  tem nome de ferramenta e três passam de 900 linhas.
- **Que os números do grep da §4 valem.** Não valem — dois de três conferidos
  eram falso positivo, e é por isso que estão marcados como trabalho.
- **Que a moldura de cinco áreas está certa.** Ela é claramente melhor que
  quinze itens. Se cinco é o número certo, e se as perguntas são as certas,
  ninguém observou uma lojista usando — e nenhum documento substitui isso.
