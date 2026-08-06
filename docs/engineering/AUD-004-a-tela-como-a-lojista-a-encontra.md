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

## 7 · Passe pela régua do `ui-ux-pro-max` (05/08, tarde)

O dono trouxe a skill `ui-ux-pro-max`. Veio **só o `SKILL.md`** — o motor
(`scripts/search.py`), as `references/` e a base (84 estilos, 192 paletas, 98
diretrizes) ficaram na máquina dele. A própria skill manda não fabricar:
*"Never present a 0-result search as if it returned data."* **Nada abaixo veio
da base.** Tudo veio da tabela de prioridades 1→10, que está no `SKILL.md`.

Stack detectada como a skill pede (Passo 1, "never assume a stack"):
**Next.js 16 · React 19 · Tailwind 4 · lucide-react**. Não é shadcn — há um `ui/`
próprio, que já inclui `EmptyState.tsx` e `Skeleton.tsx`. **A §1 desta auditoria
fica pior com esse dado: os componentes de estado existem e a Visão geral não os
usa.**

### 7.1 · Prioridade 1, resolvido: o indicador de foco não era visível

Todo campo do sistema fazia `outline-none` e punha no lugar uma borda violeta
**translúcida**. Parecia conserto. Medido sobre o fundo real (`#12121c`):

| | contra o fundo |
|---|---|
| borda em repouso (`white/10`) | 1,30:1 |
| borda em foco (`violet-500/60`) | **2,34:1** |
| a MUDANÇA que a pessoa precisa perceber | **1,79:1** |

A régua do WCAG 1.4.11 para indicador não-textual é **3:1**. Havia ainda um
`violet-500/40` — **1,68:1** — e um `violet-400/50`.

**Ninguém pega isso olhando**, e é o ponto: a borda realmente muda de cor, e o
olho de quem já sabe onde clicou completa o resto. Quem depende do indicador é
quem navega por teclado.

**Consertado** para `violet-500` sólido (**4,39:1**) em 27 arquivos — mesma cor
da marca, sem transparência, então a mudança visual é mínima.

**E virou portão, não item de checklist.** Contraste é uma razão entre
luminâncias, portanto é a única parte de um estudo de UI que se prova **sem ver
a tela**: `modules/design/domain/contraste.ts` implementa a fórmula do WCAG e
`focoVisivel.test.ts` **varre todos os arquivos de tela** e reprova qualquer foco
abaixo de 3:1.

> A primeira versão do teste usava uma lista à mão dos arquivos, e ela nasceu
> incompleta — o `sed` do conserto só trocou `/50` e `/60`, e o `/40` de
> `cliente/peso` não estava na lista. **O portão teria aprovado o pior caso.** É
> por isso que ele varre. Mutante plantado nessa exata tela: mata 2 testes.

**Nota de régua:** a skill escreve "contraste 4,5:1", que é a régua de **texto**
(WCAG 1.4.3). Para foco, borda e ícone a régua é **3:1** (1.4.11). Aplicar 4,5 a
tudo reprovaria bordas corretas, e reprovação em excesso ensina a ignorar o
portão. As duas constantes existem, separadas, com teste.

### 7.2 · Prioridade 2, NÃO resolvido: as fotos não têm como ser mexidas no celular

O achado mais grave deste passe, e está parado esperando decisão porque **muda o
visual**.

Em `/cliente/imagens`, os três controles de cada foto — definir capa, tirar do
envio, remover — vivem assim:

```
opacity-0 transition-opacity group-hover:opacity-100     ← só aparecem no hover
flex h-6 w-6                                             ← 24px
```

A régua tem os dois como anti-padrão de prioridade 2, CRITICAL: *"Reliance on
hover only"* e *"Min size 44×44px"*. **Num telefone não existe hover.** A tela
cuja função é gerenciar fotos não tem, no celular, nenhum caminho para definir a
capa — que é exatamente o trabalho que o `PLANO-001 §A2` diz ser o maior ganho de
receita disponível.

Os três botões têm `title` e **não têm `aria-label`**. A régua: *"Icon-only
buttons without labels"*. `title` é dica de mouse, não nome acessível — e em
toque não aparece.

### 7.3 · Prioridade 4: emoji fazendo o papel de ícone

`/cliente/imagens` explica os controles com **★ 👁 🗑** enquanto os botões usam
`Star`, `Eye` e `Trash2` do lucide. A régua: *"SVG icons (no emoji)"*, *"Emoji as
icons"* entre os anti-padrões. Também em `produtos` (`Kit ✓`) e no chat
(`✓`/`!`/`·` como indicador de tom).

Cosmético em comparação com 7.2, e é uma inconsistência real: a legenda descreve
com emoji os ícones que a tela desenha em SVG.

### 7.4 · Uma imagem de produto marcada como decorativa

A galeria usa `alt=""`, que declara *"imagem decorativa, ignore"*. Numa tela cuja
função é gerenciar fotos de produto, ela não é decorativa. As outras duas galerias
usam `alt={\`Foto ${i+1}\`}` — presente, e fraco: "Foto 1" não diz qual produto
nem qual cor, que é o mesmo vão de domínio do `B4` (a associação foto↔cor nunca
existiu) reaparecendo na acessibilidade.

### 7.5 · Onde eu errei neste passe, e o que isso ensina

Três medidas minhas foram **falso positivo**, e todas a favor do projeto:

| eu medi | a verdade |
|---|---|
| "47 focos removidos sem substituto" | tinham substituto (`focus:border-*`), meu padrão só procurava `ring` |
| "3 `<img>` sem alt" | **todos os três têm** — em outra linha, e meu grep era por linha |
| "66 alvos de toque pequenos" | existe `[@media(pointer:coarse)]:min-h-11` — **44px em ponteiro grosseiro, já implementado** |

O único achado de prioridade 1 que sobreviveu à verificação foi o contraste do
foco — e ele sobreviveu porque **não veio de grep, veio de cálculo**. É a lição
do passe: numa auditoria de UI, o que se conta com padrão de texto erra; o que se
computa, não.

---

## 8 · O que esta auditoria NÃO afirma

- **Quase nada sobre o visual.** Não vi nenhuma tela renderizada: a rede deste
  ambiente não alcança o *preview* (medido: `http=000`) e não há banco para
  popular um servidor local. Tipografia, espaçamento e hierarquia visual **não
  foram avaliados** — e são metade de um estudo de UI. Isso precisa de olhos numa
  tela real.
  **A exceção é o contraste** (§7.1): ele é uma razão entre luminâncias, então se
  calcula a partir das cores escritas no código. É a única parte que virou teste.
- **Que as 17 telas são demais.** Pode ser; não medi. O que medi é que uma delas
  tem nome de ferramenta e três passam de 900 linhas.
- **Que os números do grep da §4 valem.** Não valem — dois de três conferidos
  eram falso positivo, e é por isso que estão marcados como trabalho.
- **Que a moldura de cinco áreas está certa.** Ela é claramente melhor que
  quinze itens. Se cinco é o número certo, e se as perguntas são as certas,
  ninguém observou uma lojista usando — e nenhum documento substitui isso.
