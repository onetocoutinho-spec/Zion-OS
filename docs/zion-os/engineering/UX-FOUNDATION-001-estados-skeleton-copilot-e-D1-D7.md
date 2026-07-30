# UX-FOUNDATION-001 — Estados assíncronos, esqueleto, o mapa do Copilot e D1–D7

**Data:** 2026-07-30 · **Branch:** `feat/copilot-lote-com-escopo-congelado`
**Escopo:** fundação da experiência. **Não** é o redesign C.

Aprovado como direção de produto e registrado aqui: **C — Adaptive Split
Workspace**, absorvendo B como modo operacional denso; e a regra
**o workspace nunca troca de modo sozinho — só a intenção troca o modo.**

---

## 1. LIVQUERY — o problema e a correção

### O problema, na linha exata

`src/lib/hooks.ts`, versão anterior:

```ts
.catch((erro) => {
  console.error("[Zion OS] Falha ao consultar dados:", erro);
  if (ativo) setEstado({ data: null, carregando: false });   // <-
});
```

`{ data: null, carregando: false }` é **o mesmo valor** que uma consulta
bem-sucedida que não achou nada. Para quem desenha, "o servidor recusou" e "não
existe nenhum" eram indistinguíveis — e as duas situações pedem coisas opostas
do lojista: *tente de novo / fale com alguém* contra *cadastre o primeiro*.

Para consultas que devolvem lista havia uma distinção acidental (`[]` no sucesso,
`null` no erro), mas ela nunca foi usada: o padrão em toda tela é `data ?? []`,
que apaga a diferença na primeira linha.

**A consequência medida numa tela real.** `/cliente/pendencias` fazia
`const lista = pendencias ?? []` e depois `lista.length === 0 ?
<VazioAmigavel titulo="Nenhuma pendência 🎉" descricao="Você está em dia!" />`.

Essa mensagem aparecia em **três** situações: sem pendências, **durante o
carregamento**, e **quando a consulta falhava**. As duas últimas são falsas, e a
última é uma afirmação animada sobre a operação de alguém, feita a partir de um
erro de RLS.

### A correção

Três novos campos, e o contrato antigo intacto.

```ts
export interface ConsultaViva<T> {
  data: T | null;        // preservado
  carregando: boolean;   // preservado
  reload: () => void;    // preservado
  estado: EstadoAssincrono;   // "carregando" | "sucesso" | "vazio" | "erro"
  erro: Error | null;
  revalidando: boolean;
}
```

**Por que aditivo e não uma reescrita.** Inspecionei os consumidores antes de
tocar: **73 arquivos**, e todos desestruturam campos nomeados
(`const { data: produtos } = ...`, `const { data, carregando } = ...`,
`const { data, reload } = ...`). Nenhum usa spread, rest, ou repassa o objeto
adiante. Acrescentar campos é seguro por construção; mudar `data` ou `carregando`
não seria.

**`revalidando` — um segundo defeito, encontrado ao ler o hook.** O `setEstado` só
acontece no `then`/`catch`, então quando `deps` muda o estado anterior **permanece**
e `carregando` fica `false`. Clicar no produto B mostra os dados do produto A
enquanto B carrega, sem nada na tela denunciando. Isso importa diretamente para o
drill-down (D5). `revalidando` é `true` quando há uma busca em voo **e** já existe
resposta anterior — a superfície mantém o dado legível e visivelmente não-final,
em vez de piscar para esqueleto a cada mudança do store.

---

## 2. ESTADOS ASSÍNCRONOS — o contrato

`src/lib/estadoAssincrono.ts`, puro e com 24 testes.

```ts
export type EstadoAssincrono = "carregando" | "sucesso" | "vazio" | "erro";
```

### A ordem das perguntas É a regra

```
1. carregando   enquanto a resposta não chegou, nada mais é verdade
2. erro         ANTES de vazio
3. vazio
4. sucesso
```

**`erro` antes de `vazio` não é estilo.** No erro o dado é `null`, e `null` é
vazio pelo default. Se a ordem invertesse, todo erro apareceria como vazio — o
defeito original, reconstruído dentro da própria correção. Tem teste com esse
nome.

### "Vazio" não pode ser decidido só pelo hook

Vazio depende da **forma** do dado, e a forma é de quem consulta:

| Forma | Vazio é |
|---|---|
| `T[]` | `length === 0` |
| `T \| null` | `null` |
| `number` | **nunca** — `0` é uma resposta |
| `{ limite, usado }` | **nunca** — o objeto existe |

O default acerta os dois primeiros e recusa-se a chamar `0`, `false` ou objeto
presente de vazio. *"Zero produtos sem custo"* é boa notícia, não tela em branco.
Quem tem noção própria passa `vazio: (d) => …`.

E `vazio` customizado **não consegue** transformar erro em vazio: a ordem é do
módulo, não de quem chama. Também tem teste.

### `comoErro`

`throw "texto"` e `throw { code: 42 }` são legais em JavaScript e chegavam ao
`catch`. `String({code:42})` produz `"[object Object]"`, que é pior que não
mostrar nada porque parece mensagem. `comoErro` normaliza para `Error`, aproveita
`.message` quando existe, e cai numa frase útil quando não.

### A implementação de referência

`/cliente/pendencias` foi convertida: esqueleto de tabela no carregando, painel de
falha com `Tentar de novo` e a frase *"isto é uma falha nossa — não significa que
não há pendências"* no erro, o `VazioAmigavel` só no vazio de verdade, e
`opacity-60` no revalidando.

**As outras 72 telas continuam funcionando sem alteração** e migram
incrementalmente. Isso é o ponto do contrato aditivo: não há big bang, e nenhuma
tela fica pior enquanto espera.

---

## 3. SKELETON — a primitive

`src/components/ui/Skeleton.tsx` (pintura) + `geometriaDoSkeleton.ts` (proporções,
17 testes).

**Três formas, não vinte componentes:** `EsqueletoDeTexto`, `EsqueletoDeBloco`,
`EsqueletoDeTabela`. Mais um invólucro `Superficie` que escolhe entre os quatro
estados — ele existe para que a decisão não seja reescrita em cada tela, que é
onde "falha" e "vazio" voltariam a virar a mesma coisa.

### As duas regras que têm teste

**1. As larguras são DETERMINÍSTICAS.** A tentação é `Math.random()` para o
esqueleto parecer texto. Num app com renderização no servidor isso dá uma largura
no servidor e outra no cliente — divergência de hidratação, que o React conserta
redesenhando. Um esqueleto que causa remontagem faz o oposto do que existe para
fazer. As larguras vêm de um ciclo fixo `[96, 88, 100, 84, 92]`, com a última
linha em 62% (é o que diz "aqui acaba um parágrafo") — e **não** quando há só uma
linha, porque 62% sozinho parece um campo de formulário.

**2. Preserva a geometria do que está chegando.** Na tabela a primeira coluna
recebe 40% e as demais dividem o resto: é a assimetria real das tabelas do portal
(identidade larga, estados estreitos), e é o que faz um esqueleto de tabela ser
reconhecível como tabela em vez de um bloco cinza.

`linhasParaMostrar` tem teto de 8 — esqueleto longo deixa de acalmar e passa a
parecer conteúdo — e usa o **total real** quando ele é conhecido (revalidando uma
tabela de 3 linhas desenha 3, e a página não muda de altura). Total zero ainda
desenha **uma** linha: zero linhas de esqueleto é uma tela em branco,
indistinguível de vazio.

### Movimento reduzido

A animação é `motion-safe:animate-pulse` — CSS, não JavaScript. Acerta desde o
primeiro pixel, sem um render em que o movimento aparece antes de ser desligado.
Com `prefers-reduced-motion: reduce` os blocos ficam parados e continuam
informando a geometria, que é o essencial.

---

## 4. COPILOT ATUAL — o mapa das duas superfícies

| | `/api/assistente` | `/api/assistente/conversa` |
|---|---|---|
| **Papel** | classifica UMA frase | conduz uma conversa |
| **Devolve** | intenção, de um enum de 7 | texto + cartões + propostas |
| **Modelo** | `provedorIA`: `GEMINI_MODEL ?? "gemini-2.5-flash"` (ou Anthropic) | `GEMINI_MODELO_CONVERSA ?? "gemini-2.5-flash"` |
| **Chamadas ao modelo por turno** | **1** | **1 + uma por rodada de ferramenta** |
| **Contexto enviado** | a frase + o nome do produto aberto | `mensagem` + `falas` (histórico inteiro) + `contexto` (lista de produtos, produto aberto, `paraAnunciar`) |
| **Ferramentas** | **nenhuma, por desenho** | **16** |
| **Streaming** | não — um JSON | **sim** — `ReadableStream`, texto e rastro de ferramenta ao vivo |
| **Persistência** | **nenhuma** | `copilot_conversas`, `copilot_mensagens`, `copilot_propostas`, `copilot_acoes` |
| **Escrita** | nunca | só via Proposal, e só com clique humano |
| **Quem chama** | `assistenteDaOperacao.classificarPergunta` | `conversaDoAssistente.conversar` |
| **Fallback** | lança; a tela mostra o erro | lança; **não** cai para a rota barata |
| **Linhas** | 166 | 795 |

**Quem decide qual:** `ChatDaOperacao.tsx:306`, `if (conversando)`. Um único
`useState(false)` na linha 251.

**O opt-in é um botão de texto** (`ChatDaOperacao.tsx:495`) que diz *"Ligar modo
conversa (mais capaz, mais caro)"*. Ele **limpa o fio** ao alternar
(`setFalas([])`), porque o histórico de um não serve ao outro — a rota barata não
tem histórico.

### Custo — a correção de uma suposição minha

Eu havia tratado isso como "modelo caro contra modelo barato". **Está errado: os
dois usam `gemini-2.5-flash` por default.** A diferença de custo não é de tier, é
de três outras coisas:

1. **Número de chamadas.** A rota barata faz 1. A conversa faz 1 + uma por rodada
   de ferramenta — 2 a 4 é comum.
2. **Tamanho do contexto.** A conversa manda `falas` (o histórico **inteiro**, que
   cresce a cada turno) e a lista de produtos **a cada turno**.
3. **Tamanho do prompt de sistema.** ~80 linhas de instrução contra um schema de
   classificação.

O comentário no código estima **6 a 19 vezes**, e a estrutura acima explica a
faixa: 6× num turno curto sem ferramenta, 19× num turno longo com três rodadas e
histórico acumulado. **Não medi esses números nesta vertical** — eles vêm do
comentário. O que medi é a estrutura que os produz.

Isso muda a solução: **não há um modelo caro para trocar.** O que há é contexto
redundante e rodadas — e as duas são atacáveis sem tocar em qualidade.

---

## 5. AS 16 FERRAMENTAS — por que nenhuma chega à rota barata

**Correção de contagem: são 16, não 17.** `FERRAMENTAS` em
`ferramentasDoAssistente.ts:419` = 10 de leitura + 1 de rascunho + 5 de proposta.
Eu havia reportado 17 na exploração; conferido agora, arquivo na mão, são 16.

| efeito | quantas | quais |
|---|---:|---|
| `le` | 10 | `contar`, `proximo_passo`, `estado_da_loja`, `o_que_impede`, `achar_produto`, `o_que_falta_no_produto`, `pendencias`, `preparacao_de_anuncio`, `pricing`, `procedencia` |
| `rascunha` | 1 | `gerenciar_cadastro` |
| `propoe` | 5 | `propor_gravacao`, `preparar_resolucao`, `propor_preco`, `propor_titulo`, `propor_anuncio` |

**Zero chegam à rota barata, e o motivo não é configuração — é o contrato dela.**

`/api/assistente` devolve `{ intencao, campo, valor, termosDoAlvo, assunto,
capacidade }` de um enum fechado. Ela **não consulta o banco, não conta nada e não
sabe quantos produtos existem** — e isso é deliberado, está escrito no cabeçalho:

> *"Mandar as contagens para cá pareceria mais simples e seria a porta pela qual o
> número errado entra: um modelo que vê '43 sem custo' escreve 'cerca de 40', 'a
> maioria', 'quase todos'. Ele não vê, então não pode."*

Quem responde é `assistant/domain/perguntaDaOperacao`, no cliente, contra o estado
real. A rota barata é um **classificador**; ferramenta é para quem **age**.

Portanto: o opt-in não é uma preferência de custo. **É a fronteira entre um
classificador de 7 intenções e um agente de 16 ferramentas.** Removê-lo sem
arquitetura não deixaria o Copilot "mais bonito" — deixaria 16 capacidades
inalcançáveis, ou tornaria toda pergunta um turno de agente.

---

## 6. CAMINHO PARA UM COPILOT ÚNICO — sem roteador LLM

O objetivo: **um Copilot na experiência**, sem um turno de agente em toda
interação. Quatro passos, do mais barato ao mais caro, cada um entregável só.

### Passo 1 — O opt-in sai da tela e vira decisão do servidor (barato)

A rota `/conversa` passa a receber a frase e decidir internamente. **O
classificador que já existe** (`/api/assistente`, 1 chamada, schema fechado) roda
primeiro. Se a intenção for uma das 7 que `perguntaDaOperacao` resolve
deterministicamente **e** não houver fio aberto, responde sem tocar em ferramenta.
Caso contrário, entra no laço.

Isto **não é um roteador LLM novo**: é o classificador atual, no lugar onde ele
decide algo em vez de ser um modo. Custo: uma chamada barata na frente de cada
turno — que já era o custo do modo barato.

### Passo 2 — Um fio só (barato, e é o que hoje impede o passo 1)

Alternar hoje faz `setFalas([])`. Enquanto a conversa for descartada ao trocar de
modo, o servidor não pode escolher por turno. O histórico precisa ser único e
sobreviver às duas rotas — a persistência já existe (`copilot_mensagens`, migração
037 aplicada); falta a rota barata **gravar o turno dela** no mesmo fio.

### Passo 3 — Parar de mandar o catálogo a cada turno (médio, corta a maior parte do custo)

Hoje o corpo leva `contexto.produtos` em **todo** turno, e `falas` cresce
indefinidamente. As leituras pesadas já viraram **portos de servidor** nas
verticais 005/006 (`catalogoParaPreparar`, `catalogoParaTriagem`, com LIMITE
300/500) — o mesmo tratamento aplicado à lista de produtos tira o maior bloco de
tokens repetidos. `falas` ganha uma janela (últimos N turnos + resumo), que é
exatamente o que a persistência de 037 permite fazer sem perder histórico.

### Passo 4 — Ferramentas por assunto (médio)

As 16 não precisam ser oferecidas todas em todo turno. O `assunto` que o
classificador **já devolve** (`peso`, `custo`, `foto`, `anuncio`, `aprovacao`,
`publicacao`, `precificacao`) recorta o conjunto. Menos ferramenta declarada é
menos prompt e menos chance de chamada errada.

### O que NÃO fazer

- **Roteador LLM** decidindo entre modelos. Acrescenta uma chamada, uma
  latência e uma classe de erro nova para resolver um problema que o
  classificador determinístico já resolve.
- **Remover o opt-in antes do passo 2.** Com o fio sendo descartado, a escolha
  por turno produz amnésia no meio da conversa.

**Ordem obrigatória: 2 → 1 → 3 → 4.** O passo 2 é pré-requisito do 1.

---

## 7. D1–D7 — as decisões de layout

### O achado que muda os números

De `ClientPortalShell.tsx`, medido:

```
aside     hidden lg:block w-60 shrink-0 fixed   ->  240px, só a partir de lg
conteúdo  flex-1 lg:pl-60                      ->  recuado 240px em lg+
main      px-4 sm:px-6 lg:px-8                 ->  16 / 24 / 32px por lado
interno   mx-auto max-w-5xl                    ->  TETO DE 1024px
```

O `max-w-5xl` é decisivo, e a exploração visual não tinha como vê-lo. **A largura
útil não é a da janela:**

| janela | largura útil |
|---:|---:|
| 1024 (`lg`) | **720px** |
| 1280 (`xl`) | **976px** |
| 1328+ | **1024px** (teto) |
| 1536 (`2xl`) | **1024px** — não cresce mais |

> **Correção a um número meu.** Na falsificação da arquitetura C eu calculei
> "660px de workspace a 1280". Ignorei `max-w-5xl` e `lg:px-8`. A 1280 sobram 976
> úteis e o workspace fica com **580px**. A conclusão da falsificação — B e C dão
> a mesma largura de tabela — sobrevive; o número não. Há um teste chamado
> *"D2: o workspace NUNCA chega aos 660px que eu havia calculado antes"*.

> **Colisão de rótulos.** HIGGSFIELD-003 §5 já usava "D1" e "D2" para *regras*
> ("só a intenção troca o modo", "a consequência aparece dentro do modo atual").
> Aqui D1–D7 são as **decisões de layout** definidas neste pedido. As duas regras
> passam a ser **R1** e **R2** — dois significados para o mesmo rótulo é o
> problema que acabamos de fechar no banco.

Tudo abaixo é código em
`src/modules/workspace/domain/geometriaDoWorkspace.ts`, com 24 testes.

### D1 — largura e comportamento da conversa

| situação | largura | comportamento |
|---|---|---|
| **sozinha** | `min(720, útil)` | centrada |
| **no split** | **380px** | fixa |

**Sozinha ela não estica até 1024.** Pareceria aproveitar a tela e produziria
linha de ~140 caracteres, que o olho perde no retorno. O teto é 720 porque é o que
os **cartões** dela pedem (lote, pendências, pricing, preparação) — não a prosa.

**No split é fixa, não proporcional.** Conversa não melhora com largura depois de
um ponto; tabela melhora sempre. Todo pixel acima do necessário vai para o lado
que o usa.

**Piso de 360px:** abaixo disso os cartões quebram — são grades de rótulo + valor,
e a 320px o valor desce de linha em todos eles. A prosa caberia; os cartões não.

### D2 — largura e comportamento do workspace

Absorve toda a variação:

| janela | workspace |
|---:|---:|
| 1280 | **580px** |
| 1328+ | **628px** |

`null` quando não há split — e nesse caso o workspace **não encolhe, muda de
forma** (ver D6).

**Piso de 420px:** a superfície densa é a tabela, e ela precisa da coluna de
identidade (~170px para *"Chinelo Havaianas Slim Square Feminino"*) mais três
colunas de estado (~70px) mais respiro. Abaixo de 420 a identidade trunca no meio
do nome, e uma tabela cuja primeira coluna não identifica não serve para escolher
nada — que é a única coisa que se faz nela.

### D3 — comportamento da sidebar

**NÃO MUDA.** `{ forma: "fixa", px: 240, colapsaNoSplit: false }` de `lg` para
cima; gaveta de 256px abaixo, que é do shell e já existe.

É a decisão mais fácil de errar: a tentação é colapsar a sidebar no split para
ganhar 240px. Isso trocaria uma superfície de **navegação** estável por 240px de
superfície de **trabalho**, e faria a barra de navegação aparecer e desaparecer
conforme o workspace — que é exatamente a troca automática que R1 proíbe, com
outro nome. Tem teste para as duas pontas.

### D4 — o breakpoint onde o split deixa de existir

**O split vive de `xl` (1280px) para cima.** Duas condições, ambas necessárias:

**Aritmética:** `380 (conversa) + 16 (gap) + 420 (workspace) = 816px úteis`.

```
janela 1024 (lg)  ->  720 úteis  ->  NÃO CABE
janela 1280 (xl)  ->  976 úteis  ->  cabe
```

**Breakpoint, e não só a aritmética.** Sem a condição `janela >= xl`, uma janela de
**900px passaria** — porque abaixo de `lg` a sidebar é gaveta e não desconta os
240px, então "sobra" largura. Mas 900px é tablet, e tablet é justamente o que esta
vertical não resolve. Um split que aparece a 900, desaparece a 1024 e volta a 1280
seriam três layouts em duas polegadas.

> **Um defeito que os testes pegaram.** A primeira versão somava
> `MINIMO_DA_CONVERSA_PX` (360) em vez da largura real (380). A 844px a conta dizia
> "cabe" e entregava **400px** de workspace — abaixo do próprio mínimo. O mínimo da
> conversa é o piso que justificou *escolher* 380; o que o split consome é 380.

Entre `lg` e `xl` o portal tem sidebar e não tem split — faixa real de telas: 1366
entra por cima, 1280 por baixo.

### D5 — comportamento do drill-down

```ts
DRILL_DOWN = {
  forma: "substitui-o-workspace",
  profundidadeMaxima: 1,
  preservaAConversa: true,
  temVolta: true,
}
```

Abrir o detalhe **substitui** o conteúdo do workspace, com volta. Não abre terceira
coluna e **não troca o modo**.

Três colunas seriam `380 + 16 + 420 + 16 + 420 = 1252` úteis contra um teto de
1024. **Não cabem em nenhuma janela, em nenhum monitor** — o `max-w-5xl` fecha essa
porta antes de a discussão começar. Tem teste.

Profundidade 1 é decisão, não limitação: detalhe do detalhe é onde se perde de
onde se veio, e a conversa ao lado já é a trilha de volta.

### D6 — quando o workspace deve aparecer

Duas condições, ambas necessárias:

1. **Há modo** — e modo só se define por intenção.
2. **O modo vale a tela** — D7.

**A largura não entra aqui.** "Cabe" e "vale" são perguntas diferentes; misturá-las
produziria um workspace que abre em monitor grande e não abre em pequeno para o
mesmo conteúdo — troca de modo por causa de janela, que é troca sozinho com outro
nome.

### D7 — quando não há contexto suficiente

`valeATela.ts`. A regra do Draft entra aqui.

```
itens < 3                                            -> NÃO vale
itens >= 3 e (comparável lado a lado OU ação em lote) -> vale
```

**O limiar é três, não dois.** Dois fatos são uma frase — *"marca Havaianas, modelo
Slim"* — e a conversa diz isso melhor que uma tela. A partir de três a lista começa
a pedir alinhamento vertical para ser lida de relance.

**Ação sozinha não basta.** Um cartão com dois campos e um "Aplicar" não justifica
tela: esse botão cabe na conversa, e já vive lá. Por isso o `itens >= 3` aparece
nas duas pernas da condição.

**O caso que originou a regra:** o Draft com marca e nada mais abriria 580px para
mostrar um campo preenchido e cinco vazios, e a conversa encolheria de 720 para 380
para dar lugar a isso. **A tela pioraria em troca de nada.**

`porQueAindaNaoVale` devolve a frase para a conversa dizer, e `null` quando vale —
para a superfície não ter o que mostrar em vez de mostrar uma explicação vazia.

---

## 8. OS CINCO MODOS

`modosDoWorkspace.ts`. São os que HIGGSFIELD-003 §3.4 derivou, com os nomes dele:

| modo | superfície |
|---|---|
| **fila-de-decisoes** | cartões de decisão, um a um |
| **triagem** | a tabela densa (o que era a arquitetura B) |
| **pricing** | preço, margem, simulação |
| **draft** | o cadastro em conversa |
| **preparacao** | as etapas do anúncio |

### Os três que caíram, e onde vivem

| era candidato | vive agora | por quê |
|---|---|---|
| **conflito** | tipo de **cartão** na fila de decisões | dois valores, duas origens, uma escolha. Modo inteiro seria abrir 580px para duas linhas e um botão. |
| **proveniência** | **disclosure** dentro do cartão que já mostra o valor | virar modo contradiz o pedido de não abandonar o contexto: *"de onde veio esse custo?"* é pergunta **sobre** o que está na tela, e a resposta não pode substituir a tela. |
| **prejuízo** | o modo **pricing** com resultado negativo | mesmo dado, mesma geometria, mesma ação. Só o sinal do número muda. |

Estão em `NAO_SAO_MODOS`, com teste de que nenhum deles é modo e de que cada um
aponta o hospedeiro. **A regra para não voltar a oito: cartão não justifica modo.**
Um modo tem geometria própria e ação própria; um cartão vive dentro de um.

### A regra R1, como código e não como convenção

```ts
case "consequencia": {
  const novos = evento.consequencia.desbloqueou.filter((m) => m !== estado.modo);
  return { ...estado, oferecidos: [...new Set([...estado.oferecidos, ...novos])] };
}
```

`consequencia` **só** mexe em `oferecidos`. Não pode tocar `modo` — e não é
disciplina de quem escreve, é o que este código faz. O tipo `Consequencia` não tem
campo de destino, então não há o que passar.

Há um teste que percorre **todos os modos × todos os desbloqueios** e verifica que
o modo nunca muda.

---

## 9. CONSEQUÊNCIA — o contrato

`consequencia.ts`. **Contrato, não implementação** — como você pediu.

O exemplo do enunciado pede dois dados que **hoje ninguém devolve**: "pricing virou
calculável por causa desta escrita" e "2 produtos passaram a poder avançar".

O que existe: `/api/assistente/proposta` devolve o desfecho da escrita (quantos
alvos, sucesso/parcial/falha) e grava antes/depois em `copilot_acoes`. **Não**
devolve o que mudou de possível.

Inventar o número no cliente repetiria o defeito que o Copilot foi desenhado para
não ter — a rota barata não recebe contagens *porque* "um modelo que vê 43 sem
custo escreve cerca de 40". Uma tela que estima "2 produtos podem avançar" erra
pelo mesmo motivo.

```ts
interface Desbloqueio {
  modo: ModoDoWorkspace;
  quantos: number | null;   // null = o servidor não contou
  unidade?: string;
}
interface Consequencia {
  resumo: string;
  afetados: number;              // a rota já devolve
  desbloqueios: readonly Desbloqueio[];
}
```

**`quantos: null` não é descuido, é a resposta honesta.** "Preparação" sem número é
uma oferta honesta; "Preparação — 2 produtos" inventada é uma mentira que o lojista
confere em dez segundos. `semDesbloqueios(resumo, afetados)` é o caminho de hoje —
e não é um caso degradado, é o caso comum.

`ofertasQueValem` filtra `quantos === 0` (botão para tela vazia) e **deixa passar
`null`**: "não contei" é diferente de "contei e deu zero".

`rotuloDoDesbloqueio` acerta o singular — *"1 produtos podem avançar"* denuncia que
a frase foi montada por concatenação e faz duvidar do resto da tela.

**O que falta para implementar o exemplo:** `/api/assistente/proposta` devolver, no
desfecho, quais modos passaram a ser possíveis e com quantos itens. Os dados
existem no servidor (`preparacaoDeAnuncio.catalogoParaPreparar`,
`precificacaoDoCopilot.catalogoParaTriagem`) — falta chamá-los depois da escrita e
incluir o resultado na resposta. Não foi feito nesta vertical: é escrita nova numa
rota que é a única porta de gravação, e merece a sua própria.

---

## 10. MOBILE — o que fica pendente

Registrado, não resolvido:

- **desktop:** Adaptive Split Workspace (C), de `xl` para cima.
- **`lg` a `xl`:** sidebar sim, split não. Conversa sozinha, workspace como
  superfície de largura cheia sob intenção.
- **mobile e tablet (< `lg`):** **arquitetura própria, pendente de exploração e
  validação.**

Não inventei o mobile a partir da ausência de créditos do Higgsfield. O que existe
hoje abaixo de `lg` continua como está (gaveta de navegação, conteúdo em largura
cheia) e **é o fallback seguro** — a implementação de C não deve piorá-lo, e
`comportaSplit` devolvendo `false` garante isso por construção.

---

## 11. HIGGSFIELD — o que ainda vale validar

Nenhum crédito foi comprado ou solicitado. Os seis componentes não validados são
**validação visual pendente, não bloqueio arquitetural** — geometria e
infraestrutura não precisam de geração de imagem, e esta vertical é a prova.

Prioridade quando houver crédito:

1. **mobile** — a única lacuna que é arquitetural
2. **Draft vivo** — o caso que originou D7
3. **tabela densa** — a superfície mais usada, e a que define D2
4. **preparação**

**Conflito e proveniência saem da fila:** deixaram de ser modos (§8) e podem ser
derivados do sistema aprovado — cartão e disclosure.

---

## 12. ALTERAÇÕES

**Novos**

| arquivo | o que é |
|---|---|
| `src/lib/estadoAssincrono.ts` | o contrato dos quatro estados, puro |
| `src/lib/estadoAssincrono.test.ts` | 24 testes |
| `src/components/ui/geometriaDoSkeleton.ts` | proporções do esqueleto |
| `src/components/ui/geometriaDoSkeleton.test.ts` | 17 testes |
| `src/components/ui/Skeleton.tsx` | a primitive: 3 formas + `Superficie` |
| `src/modules/workspace/domain/geometriaDoWorkspace.ts` | D1–D5 |
| `src/modules/workspace/domain/geometriaDoWorkspace.test.ts` | 24 testes |
| `src/modules/workspace/domain/modosDoWorkspace.ts` | os 5 modos, R1 como código, D6 |
| `src/modules/workspace/domain/valeATela.ts` | D7 |
| `src/modules/workspace/domain/modosDoWorkspace.test.ts` | 22 testes |
| `src/modules/workspace/domain/consequencia.ts` | o contrato de consequência |
| `src/modules/workspace/domain/consequencia.test.ts` | 10 testes |

**Modificados**

| arquivo | mudança |
|---|---|
| `src/lib/hooks.ts` | `estado`, `erro`, `revalidando` — **aditivo** |
| `src/app/cliente/pendencias/page.tsx` | implementação de referência dos 4 estados; `useMemo` no `lista` (aviso de lint anterior) |

**Não tocados, de propósito:** `ChatDaOperacao.tsx`, o shell, o opt-in, o domínio,
`platform/`, as rotas do assistente.

---

## 13. TESTES E PORTÃO

| | |
|---|---|
| **Novos** | **97** |
| **Total** | **1612** (era 1515) |
| `typecheck` | ✅ |
| `typecheck:test` | ✅ |
| `lint` | ✅ 0 erros (62 avisos, todos anteriores; os arquivos novos não geram nenhum) |
| `test` | ✅ 1612 / 0 falhas |
| `build` | ✅ compilado, 76 páginas |

**Uma lacuna do portão que encontrei e não corrigi:** `npm test` roda
`tsx --test "src/**/*.test.ts"` — **só `.ts`**. Existem 10+ arquivos `.test.tsx`
(`src/mission/tests/*`, `src/shell/**`) que são **typechecked e nunca
executados**. Por isso os testes desta vertical são de lógica pura em `.ts`: é o
que o portão realmente roda. Corrigir o runner muda o resultado do portão e merece
a própria mudança.

**Verificação em navegador:** não feita. A tela alterada
(`/cliente/pendencias`) está atrás de autenticação e eu não tenho — nem devo ter —
credenciais de sessão. Os quatro estados estão cobertos por teste na lógica pura;
a aparência deles em tela ainda não foi vista por ninguém.

---

## 14. PRONTO PARA IMPLEMENTAR C? **Não ainda — e falta pouco.**

O que esta vertical entregou é a fundação: os estados que as superfícies precisam,
o esqueleto que preserva geometria, D1–D7 como código testado, os cinco modos com
R1 impossível de violar, e o contrato de consequência.

**O que ainda bloqueia:**

1. **Nenhum componente de superfície existe.** D1–D7 são decisões e testes; não há
   `<Workspace>`, `<Split>` nem `<FilaDeDecisoes>`. Esta vertical decidiu a
   geometria — não desenhou.
2. **`ChatDaOperacao` tem ~1400 linhas e é a conversa inteira.** C exige separar a
   conversa da superfície contextual. É a maior peça, foi explicitamente excluída
   daqui, e precisa de plano próprio.
3. **A consequência não tem dado.** `/api/assistente/proposta` não devolve o que
   foi desbloqueado. Sem isso o convite `[Calcular preço]` não pode existir sem
   inventar número — e é a peça que dá sentido a R1.
4. **O opt-in ainda está na tela**, e removê-lo exige o passo 2 do §6 (um fio só).
   Enquanto alternar limpar `setFalas([])`, não há Copilot único.
5. **Mobile não tem arquitetura.** Não bloqueia C no desktop —
   `comportaSplit` devolve `false` e o comportamento atual sobrevive — mas bloqueia
   dizer que C está pronto.

**A ordem que eu recomendo:** (3) porque é backend e desbloqueia a UX que dá
sentido à regra; depois (4) passo 2, que é pequeno e libera o Copilot único;
depois (2) com plano escrito; e (1) por último, quando houver o que montar.

Nada disso precisa de crédito do Higgsfield.
