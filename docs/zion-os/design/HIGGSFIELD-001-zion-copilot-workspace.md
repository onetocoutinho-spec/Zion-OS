# HIGGSFIELD-001 — Zion Copilot Workspace

**Data:** 2026-07-29
**Base de código:** `dded686`
**Fontes:** COPILOT-003, 004, 005, 006 + inspeção do frontend real
**Status:** handoff para exploração. **Nenhuma direção escolhida.**

Este documento existe para o Higgsfield explorar o Zion OS **como produto** — não
para produzir um mockup bonito de pricing. Todo estado descrito aqui **existe no
backend hoje**. Nada foi inventado para a exploração ficar mais interessante.

---

## VISÃO

O Zion Copilot **não é "ChatGPT dentro de um ERP"**. Ele é a **interface
operacional inteligente do Zion OS**.

A promessa que a experiência precisa transmitir:

> **eu digo o que quero alcançar e o Zion organiza a operação**

O lojista expressa intenção em português. O Zion responde com conversa **e**
dados, cards, estados, decisões, comparações, propostas e progresso — porque a
resposta certa quase nunca é um parágrafo.

---

## USUÁRIO

Lojista de calçados que vende no Mercado Livre. Base real medida: **73 produtos,
684 variantes**. Ele:

- não sabe o que trava a operação dele
- não tem tempo de responder 184 perguntas
- não distingue markup de margem líquida — e essa confusão faz ele vender no prejuízo
- não sabe por que um preço "ficou alto"
- não vai abrir quatro telas para cadastrar um produto

Não é um analista. Não vai ler uma planilha contábil.

## JOB TO BE DONE

> "Quero que meus produtos estejam no ar, corretos e dando lucro — **sem eu
> precisar entender o sistema.**"

---

## A JORNADA INTEGRADA

Derivada dos estados reais. As quatro capacidades **não são quatro telas** — são
um fio só.

```
ENTRAR
  │
  ├─► "O que precisa de mim?"                       [COPILOT-004]
  │      panorama: N pendências · X eu trato sozinho · Y decisões suas
  │
  ├─► DECISÃO AGRUPADA (a de maior impacto primeiro)
  │      "47 variantes sem peso · uma resposta resolve todas"
  │      └─► Proposal → confirmar → aplicado
  │
  ├─► PRICING DESBLOQUEADO                          [COPILOT-006]
  │      "agora consigo calcular o preço desses 47"
  │      ├─ "por quanto posso vender?"  → preço + margem + breakdown
  │      ├─ "simula 79,90 / 84,90 / 89,90" → comparação
  │      ├─ "quero 12% líquido" → preço necessário
  │      └─► Proposal de preço → confirmar → aplicado
  │
  ├─► PREPARAÇÃO DO ANÚNCIO                          [COPILOT-005]
  │      as 5 etapas mudam de estado sozinhas
  │      identidade ✓ · conteúdo ✓ · imagens ✓ · pricing ✓ · publicação apta
  │
  ├─► PRÓXIMA DECISÃO
  │
  └─► CADASTRO NOVO (entra pelo mesmo fio)          [COPILOT-003]
         "quero cadastrar um produto" → Draft vivo → criação → pricing
```

**O ponto de UX mais importante do documento:** cada etapa **muda o estado da
seguinte**. Resolver o peso desbloqueia o pricing, que desbloqueia a preparação.
O usuário não deveria precisar perguntar "e agora?" se a interface pode mostrar a
consequência.

---

## ARQUITETURA ATUAL (o que existe hoje, medido no código)

### Navegação — 5 áreas, cada uma é uma PERGUNTA

| Área | Pergunta | Telas |
|---|---|---|
| **Hoje** | O que importa agora? | Visão geral · **Assistente** · Pendências |
| **Catálogo** | O que sabemos dos produtos? | Produtos · Fotos · Peso e caixa · Tabela de medidas · **Precificação** |
| **Anúncios** | Como dizemos e prometemos? | Criar anúncio · Meus anúncios · Auditoria · Ferramentas avulsas |
| **Pulso** | Como está a loja? | Vendas · Relatórios |
| **Zion** | O que combinamos? | Configurações · Conexão com o ML · Ajuda |

Sidebar fixa de 240px (`lg:`), vira drawer abaixo disso. Header sticky de 64px.

### O Copilot hoje — **e aqui está o problema central**

Ele existe em **dois lugares**, com a **mesma conversa** (`conversaGuardada`,
chave por cliente):

1. **`PainelDoAssistente`** — botão flutuante no canto inferior direito, abre um
   drawer de 512px sobre a tela. Some na página do assistente.
2. **`/cliente/assistente`** — a conversa com a tela inteira, `h-[calc(100vh-9rem)]`.

**`ChatDaOperacao`** (935 linhas) é o componente único dos dois, e já renderiza
**oito tipos de cartão** dentro do fluxo de mensagens: painel de pendências,
procedência, cadastro, preparação, título, pricing, proposta de preço, proposta
de lote, proposta de anúncio.

> **É exatamente esta a tensão que o Higgsfield precisa resolver:** o Copilot já
> devolve estrutura operacional rica, e está espremido numa coluna de chat de
> 512px — ou numa página onde o resto da operação some.

### Dois modos de conversa, e o usuário escolhe

Há um interruptor textual: *"Ligar modo conversa (mais capaz, mais caro)"*.
Desligado, uma rota de intenção barata (~400 tokens) responde perguntas simples.
Ligado, o laço com ferramentas (~2.600 tokens) faz tudo que este documento
descreve. **Isto é dívida de UX**: o usuário não deveria escolher o motor.

---

## DESIGN SYSTEM ATUAL

### Cor

```
--background   #08080d      quase preto, levemente azulado
--foreground   #e4e4e7      zinc-200
superfície     #0e0e16      cards e tabelas
sidebar        #0b0b12
bordas         white/5, white/10
```

**Acento:** `violet-600` (#7c3aed) em botões primários; `violet-500→fuchsia-600`
só no logo. Seleção de texto em violeta 35%.

**Token corrigido com intenção — preservar:** `--color-zinc-500` foi sobrescrito
para `#8b8b94`. O zinc-500 padrão dava **4,06:1** sobre o fundo (abaixo do AA de
4,5:1); 15 de 423 textos reprovavam. O tom novo dá **5,81:1** sem competir com o
texto principal.

**Tons semânticos** (`Badge`/`StatCard`) — sempre `bg-{cor}/10 + text-{cor}-400 +
ring-{cor}/20`:

| verde | âmbar | vermelho | azul | violeta | laranja | ciano | cinza |
|---|---|---|---|---|---|---|---|
| ok / saudável | atenção / estimativa | prejuízo / erro | informação | IA / ação | risco | neutro | ausente |

### Tipografia

Geist Sans (`--font-geist-sans`), Geist Mono disponível e pouco usada.

| Uso | Classe |
|---|---|
| número de destaque | `text-2xl font-semibold tracking-tight text-white` |
| título de seção | `text-sm font-semibold text-zinc-200` |
| corpo | `text-sm text-zinc-200/300` |
| secundário | `text-xs text-zinc-500` |
| micro / rótulo | `text-[11px] uppercase tracking-wider text-zinc-500` |

**Não existe escala tipográfica grande.** O maior texto do produto é `text-2xl`.
Isso é deliberado: é software operacional, não landing page.

### Forma e espaço

- **Radius:** `rounded-lg` (8px) em controles, `rounded-xl` (12px) em cards, `rounded-full` em badges
- **Sombra:** quase nenhuma. Só o logo e o drawer (`shadow-2xl`). Profundidade vem de **borda + superfície**, não de sombra.
- **Padding:** card 20px (`p-5`), célula de tabela 16×12, main `px-4 py-6` → `sm:px-6` → `lg:px-8`
- **Gap:** 2 (8px) entre controles, 4–6 entre blocos

### Componentes existentes

`Button` (primary/ghost/danger/success) · `Card` · `Badge` · `StatCard` ·
`Table`/`Td`/`TdMain` · `EmptyState` · `PageHeader` · `ActionTile` · `Section` ·
`Pill` · `FilterSelect` · `form.tsx`

**Toque:** `[@media(pointer:coarse)]:min-h-11` — 44px **só** em ponteiro grosso.
No mouse, 38px. A regra dos 44px é sobre precisão de toque; inflar o desktop
seria aplicá-la sem entender o motivo.

### Estados de dados

- **Loading:** `useLiveQuery` devolve `{data: null, carregando: true}`. Na prática as telas mostram `Loader2` girando ou nada. **Não há skeleton.**
- **Empty:** `EmptyState` — ícone em círculo, mensagem, ação opcional.
- **Error:** `useLiveQuery` **engole o erro**, loga no console e entrega `data: null`. Ou seja: **falha e vazio são visualmente idênticos.** Dívida real.
- **Streaming do chat:** o texto aparece token a token, e o nome da ferramenta aparece enquanto ela roda ("Consultei: achar_produto · pricing").

---

## ESTADOS REAIS — do backend, não inventados

### CADASTRO CONVERSACIONAL · COPILOT-003

Ciclo de vida: `ativo` ⇄ `pronto_para_finalizar` → `aguardando_confirmacao` →
`criado` · `cancelado` (terminais).

O Draft carrega, por campo, **procedência**: `informado` / `catalogo` /
`derivado` / `inferido`. Campo crítico (custo, preço, SKU, EAN, peso) **recusa
inferência**.

Estados a desenhar:
1. iniciar cadastro (Draft vazio)
2. Draft parcial — o que já sei, com selo de procedência quando não foi ele que disse
3. coleta — lista ordenada do que falta, separada em **bloqueia / não bloqueia**, cada item com o *porquê*
4. variantes — grade por cor, total, quantas sem SKU/EAN
5. **conflito** — "você me disse R$ 47,80 e agora R$ 45,00; qual vale?"
6. possível duplicidade — 1..8 candidatos com **como foi achado** (`sku_exato` ≠ `candidato_textual`)
7. desambiguação — lista numerada, resolve por "o segundo"
8. retomada — N cadastros abertos, incluindo "Produto ainda sem nome"
9. resumo antes de criar
10. Proposal → confirmação
11. **stale** — "o catálogo mudou desde que preparei este cadastro"
12. criado — com o produto real
13. cancelado

### PENDÊNCIAS E PROVENIÊNCIA · COPILOT-004

Classificação (código, não modelo): `preparavel` · `resolvivel_por_fonte` ·
`precisa_do_humano` · `conflito` · `bloqueada`.

**A distinção que muda a pergunta** — e que precisa de desenho:

| escopo | significado | exemplo |
|---|---|---|
| `valor_compartilhado` | **uma** resposta serve para todos | peso de 47 variantes da mesma família |
| `um_por_alvo` | uma pergunta, **N** respostas | 31 EANs — cada um identifica uma unidade |

Prioridade por **impacto** (quantas capacidades trava · quantos alvos destrava),
nunca por volume.

Proveniência: `origem` (cliente/erp/planilha/marketplace/zion/**desconhecida**) ×
`metodo` (cadastro_manual/copilot/importacao/api/calculo) × ator × momento ×
evidência. **Sem campo de confiança** — origem e validade são perguntas
diferentes.

Estados: panorama · o que precisa de mim · decisão agrupada · conflito ·
proveniência · explicação de bloqueio · Proposal · resolução · resultado parcial
· nada a fazer.

### PREPARAÇÃO DO ANÚNCIO · COPILOT-005

Estados: `nao_apto` · `precisa_humano` · `apto_para_preparar` · `preparado` ·
`pronto_para_publicar` · `publicado`.

**As dependências são reais e NÃO lineares:**

```
IDENTIDADE ──► CONTEÚDO      (título/descrição: NÃO depende de custo nem peso)
PRICING                       (independente do conteúdo)
IMAGENS                       (independente dos dois)
   └──────────► PUBLICAÇÃO   (a única que depende de todas)
```

É por isso que "o texto eu consigo agora, o preço depende do peso" é uma resposta
legítima — e a trilha precisa mostrar isso sem parecer linear.

**`em_preparacao` NÃO EXISTE** e não deve ser desenhado: a esteira roda no
navegador, e o servidor não observa o progresso. Uma tela dizendo "preparando"
mentiria para uma aba que já fechou.

### PRICING · COPILOT-006

Estados: `calculavel` · `bloqueado` · `conflito`.
Classes: `prejuizo` · `abaixo_da_margem` · `saudavel` · `sem_preco` ·
`bloqueado` · `conflito`.

**As 7 parcelas do breakdown, que somam de volta ao preço:**

```
Preço de venda                    R$ 129,90
− Custo do produto                R$  47,80
− Comissão do Mercado Livre       R$  24,68
− Taxa fixa por venda             (some quando é zero)
− Frete                           R$  13,85
− Imposto e comissões internas    (some quando é zero)
− Embalagem e etiqueta            (some quando é zero)
= Sobra para você                 R$  43,57 · 33,5%
```

**Margem = margem LÍQUIDA sobre o preço de venda.** Não é markup, não é bruta. A
UI **deve dizer "margem líquida"** onde couber dúvida.

---

## PROPOSALS — o padrão que atravessa tudo

Cinco tipos hoje: `peso` · `custo` · `cadastro` · `titulo` · `preco`.

Todas seguem o mesmo contrato, e **a UI precisa preservá-lo**:

1. o cartão mostra **exatamente o que será feito** antes de existir botão
2. **sem `propostaId` persistido, não há botão** — uma proposta que não chegou ao banco não pode ser confirmada
3. o botão **diz o escopo**: "Aplicar a 47 variações", "Criar produto com 6 variantes", "Aplicar R$ 89,90" — nunca só "Confirmar"
4. **qualquer desfecho tira o botão** (sucesso, stale, recusa, "já feito")
5. "já foi feito" (duplo clique) é **sucesso**, não erro
6. validade de **30 minutos**

## STALE — estado de primeira classe, não erro técnico

Quando um input muda entre a proposta e o clique, **nada é gravado**. O que muda
por tipo:

| Proposal | Precondições vigiadas |
|---|---|
| cadastro | o conjunto de possíveis duplicatas (um por candidato + total) |
| peso | quantas variações estão sem peso |
| custo | o custo anterior |
| título | a impressão do título atual |
| **preço** | **custo · preço atual · peso cobrável · configuração fiscal** |

A linguagem certa é a que o sistema já usa: *"O catálogo mudou desde que preparei
este cadastro. Não criei o produto."* — o usuário precisa entender que foi
**protegido**, não que o sistema falhou.

## CONFLITOS

Dois valores registrados para o mesmo campo crítico, ou um valor que a validação
recusa. **Nunca se elege um vencedor por "confiança".**

O caso real que define o tom: um chinelo de R$ 30 com **custo de R$ 30.277.872**,
gravado com selo de "confiança alta" porque a coluna da planilha foi *lida
corretamente*. Conflito é decisão humana, e o card precisa mostrar **os dois
lados com as origens**.

---

## PRECISÃO DO CÁLCULO — a distinção que não pode sumir nem assustar

| Nível | Quando | Hoje |
|---|---|---|
| **estimativa operacional** | comissão da tabela de Moda | **é o que o Copilot usa** |
| **confirmado pelo Mercado Livre** | tarifa da API para a categoria e o preço exatos | tela de precificação, quando há categoria e conexão |
| **indisponível** | nem uma nem outra | bloqueia — nenhum percentual é inventado |

O motivo é medido: a tarifa exata depende de **categoria + preço + tipo de
anúncio**, exige o token do lojista **rotacionando a credencial a cada chamada**,
e a maioria dos produtos desta base **não tem categoria preenchida**.

**O desafio de UX:** o usuário precisa saber quando olha estimativa — sem um
alerta amarelo gritando em toda resposta. Não inventar "95% de confiança".

---

## RESTRIÇÕES DO DOMÍNIO — invioláveis

1. **O Gemini não calcula dinheiro.** Nenhum número na tela foi somado por um modelo.
2. **`Efeito = le | rascunha | propoe`.** Nenhuma ferramenta escreve no catálogo.
3. **Preparar ≠ publicar.** Nada nesta jornada coloca anúncio no ar.
4. **Aplicar preço muda o catálogo do Zion**, não o anúncio no Mercado Livre.
5. **Casamento exato não é identidade** — 117 SKUs e 112 EANs duplicados nesta base.
6. **Origem desconhecida é a resposta mais comum** e não pode virar célula vazia.
7. **Nada é criado ou alterado sem clique humano.**
8. Não existe: motor de categoria, validação de imagem, repricing automático, publicação autônoma.

---

## PROBLEMAS DE UX IDENTIFICADOS (na inspeção, não na documentação)

| # | Problema | Evidência |
|---|---|---|
| 1 | **O Copilot é um drawer de 512px** que já devolve 8 tipos de cartão estruturado | `PainelDoAssistente` + `ChatDaOperacao` |
| 2 | **Ou a conversa, ou a operação** — na página do assistente o resto some | `/cliente/assistente` ocupa a tela toda |
| 3 | **O usuário escolhe o motor de IA** com um link de texto | "Ligar modo conversa (mais capaz, mais caro)" |
| 4 | **Falha e vazio são idênticos** | `useLiveQuery` engole o erro e devolve `null` |
| 5 | **Sem skeleton** — a tela pisca de vazio para cheio | nenhum componente de loading estrutural |
| 6 | **A consequência não aparece** | resolver peso desbloqueia pricing, e nada na tela diz isso |
| 7 | **Os cartões competem no mesmo fluxo vertical** | 8 tipos empilhados na mesma coluna estreita |
| 8 | **Precificação é tabela de 8 colunas** sem drill-down do breakdown | `/cliente/precificacao` |
| 9 | **Duas superfícies do Copilot** com regras de visibilidade que o usuário não entende | painel some em uma rota específica |

---

## TRÊS DIREÇÕES A EXPLORAR

Precisam ser **genuinamente diferentes**, não variações cosméticas.

### A — Conversational Workspace
Conversa é a superfície principal. O contexto operacional aparece **dentro e ao
redor dela** conforme a necessidade. Cards ricos, ancorados na conversa.
*Testar:* densidade, tarefas longas, comparar cenários numa coluna.

### B — Operational Command Center
A operação é a superfície principal — panorama, listas, tabelas. O Copilot é o
**fio condutor** que conduz decisões *dentro* do workspace, não uma janela
separada.
*Testar:* quanto da inteligência conversacional sobrevive; onde a conversa mora.

### C — Adaptive Split Workspace
Conversa + **superfície contextual dinâmica** que muda conforme a tarefa: em
pricing vira simulador; em cadastro vira estrutura do produto viva; em pendências
vira fila de decisões.
*Testar:* custo cognitivo da mudança de contexto; se a adaptação ajuda ou desorienta.

### Critérios de avaliação

| Critério | Pergunta |
|---|---|
| velocidade | quanto tempo até a primeira decisão útil? |
| compreensão | o lojista entende **por que** o preço é aquele? |
| densidade | quantos números por tela sem virar planilha? |
| contexto | dá para conversar sobre o que se está vendo? |
| risco | uma Proposal pode ser confirmada sem ler? |
| escalabilidade | funciona com 8 tipos de cartão? com 12? |
| mobile | o que sobrevive em 375px? |
| tarefas longas | cadastro de 6 variantes em 5 turnos |
| tarefas rápidas | "esse produto dá prejuízo?" |

---

## RECOMENDAÇÃO INICIAL — a explorar, não a implementar

Minha leitura da inspeção aponta para **C (Adaptive Split Workspace)**, e a razão
é a evidência #1: o Copilot **já produz** superfície contextual — oito tipos de
cartão, com estados, tabelas de simulação e propostas. Ele está espremido numa
coluna de chat porque nasceu como chat, não porque a informação pede isso.

- **A** preserva a conversa mas mantém o problema da densidade.
- **B** resolve a densidade e arrisca perder o que o Copilot tem de melhor: o
  usuário expressar intenção em vez de caçar a tela certa.
- **C** ataca os dois, e o risco é a desorientação — que é justamente o que a
  exploração precisa medir.

**Não implementar até a direção ser escolhida.**

---

## RESPONSIVIDADE

**Desktop-first**, e o produto assume isso (sidebar fixa a partir de `lg:` /
1024px). Mas o handoff precisa de solução mobile real:

- **≥1280px:** conversa + workspace contextual lado a lado
- **1024–1280px:** provavelmente sobreposição ou coluna colapsável
- **<1024px:** sidebar já vira drawer; **as duas superfícies precisam alternar**, não comprimir
- **375px:** o que sobrevive de um breakdown de 7 parcelas? de uma tabela de 3 cenários?

Não comprimir tudo. Alternar superfícies é aceitável.

## ACESSIBILIDADE

- **Contraste AA é requisito**, e já custou uma correção de token — ver `--color-zinc-500`
- **Cor nunca é o único sinal**: prejuízo, estimativa e conflito precisam de texto ou ícone além do tom
- Alvo de toque 44px **em ponteiro grosso**
- Foco visível em todos os controles
- A conversa precisa ser navegável por teclado; `Esc` já fecha o painel
- Cartão de Proposal: o botão precisa de rótulo que faça sentido lido isoladamente por um leitor de tela ("Aplicar R$ 89,90", não "Confirmar")

## MOTION — funcional, não decorativo

Momentos que merecem movimento porque **comunicam mudança de estado**:

| Momento | O que comunicar |
|---|---|
| Draft sendo atualizado | o fato entrou na estrutura |
| Proposal preparada | agora existe algo a decidir |
| cálculo concluído | os números são novos |
| pendência resolvida | o contador diminuiu |
| **etapa desbloqueada** | a consequência da ação anterior — **o mais importante** |
| stale | o chão mudou; nada foi feito |
| transição de contexto | a superfície trocou de assunto |

O texto do chat já chega em streaming — o motion precisa conviver com isso.

---

# PROMPT HIGGSFIELD

> Copiar a partir daqui.

---

**Projeto:** Zion OS — Copilot Workspace
**Tipo:** exploração de produto (SaaS operacional B2B), **não** landing page

Você vai explorar a interface de um **copiloto operacional** para lojistas que
vendem calçados no Mercado Livre. Não é um chatbot com um dashboard ao lado: é a
**interface principal de operação**, onde o usuário expressa intenção em
português e o sistema organiza o trabalho.

**Contexto real:** 73 produtos, 684 variantes. O lojista não sabe o que trava a
operação, não distingue markup de margem líquida, e não vai ler planilha.

## A SESSÃO QUE VOCÊ PRECISA VISUALIZAR

Explore esta sessão inteira, na ordem, como um fluxo contínuo:

1. **Entra no Zion** — o que ele vê antes de perguntar qualquer coisa?
2. **"O que precisa de mim?"** — recebe um panorama: *126 pendências · 92 eu trato sem te pedir nada · 21 dependem de 2 decisões suas · 13 em conflito*
3. **Panorama** — como mostrar isso sem despejar 126 linhas?
4. **A primeira decisão:** *"47 variantes da família Modare estão sem peso. Uma resposta resolve todas."* — o usuário precisa entender **por que essas 47 formam um grupo** sem ver 47 linhas de cara
5. **Ele responde:** "todas usam 0,42 kg" → aparece uma **Proposal** com escopo explícito → confirma → aplicado
6. **O pricing desbloqueia** — a interface mostra a **consequência** sem ele perguntar
7. **"Por quanto posso vender a Modare 7178.102?"** — resposta com preço sugerido, margem líquida, lucro, preço atual, e acesso ao detalhamento
8. **"Simula R$ 79,90, R$ 84,90 e R$ 89,90"** — comparação que responde *"qual é melhor?"* em segundos
9. **"Quero 12% líquido"** — meta, preço necessário, preço atual, diferença, impacto
10. **Proposal de preço** — produto, preço atual → novo preço, margem esperada, escopo, **precisão do cálculo**. O botão diz **"Aplicar R$ 89,90"**, nunca só "Confirmar"
11. **Confirma** — e o **estado da preparação do anúncio muda**: 5 de 5 etapas prontas
12. **O Zion mostra a próxima decisão**

## ESTADOS OBRIGATÓRIOS

Além do fluxo feliz, desenhe:

- **Bloqueado:** *"Falta peso para calcular o preço. 47 variantes estão sem esse dado."* — com caminho de resolução, nunca "erro: missing_weight"
- **Prejuízo:** preço atual, resultado negativo, margem negativa, principal causa (frete / custo / comissão), próxima ação. **Claro, não alarmista.**
- **Stale:** *"O cálculo mudou. Custo usado: R$ 47,80. Custo atual: R$ 52,10. O preço não foi alterado."* + [Recalcular] — é parte da experiência, **não um modal de erro técnico**
- **Conflito:** dois valores registrados, os dois com origem, decisão humana. Nunca escolher um por "confiança"
- **Proveniência sob demanda:** *Custo R$ 47,80 · informado por você · Peso 0,42 kg · Copilot · Comissão · tabela · estimativa*. **Não poluir o card principal** — disclosure progressivo
- **Cadastro conversacional:** conversa + **estrutura viva do produto** que evolui conforme ele fala (marca, modelo, variantes, custo, preço, pendências). Nem formulário tradicional, nem só mensagens
- **Preparação do anúncio:** 5 etapas com dependências **não lineares** — conteúdo não depende de preço. Mostrar pronto / bloqueado / precisa do humano / falta para publicar

## PRECISÃO — resolva isso bem

Existem dois níveis reais e o usuário precisa distingui-los **sem um alerta
gritando em toda resposta**:

- **estimativa operacional** — comissão de tabela (o que o copiloto usa)
- **confirmado pelo Mercado Livre** — tarifa exata da API

Encontre a linguagem visual certa. **Não inventar percentual de confiança.**

## BREAKDOWN

O preço se decompõe em 7 parcelas que **somam de volta**:

```
Preço de venda                 R$ 129,90
− Custo do produto             R$  47,80
− Comissão do Mercado Livre    R$  24,68
− Frete                        R$  13,85
− Imposto e comissões internas R$   9,10
− Embalagem e etiqueta         R$   1,70
= Sobra para você              R$  32,77 · 25,2%
```

**Resumo primeiro, evidência sob demanda.** Não transformar em planilha contábil
se não for necessário — mas permitir aprofundar.

## DIREÇÕES — explore TRÊS, genuinamente diferentes

**A — Conversational Workspace:** conversa dominante, contexto aparece conforme necessidade
**B — Operational Command Center:** operação dominante, copiloto conduz decisões dentro do workspace
**C — Adaptive Split Workspace:** conversa + superfície contextual que muda conforme a tarefa

Não são variações cosméticas. Para cada uma, mostre a mesma sessão acima.

## LINGUAGEM VISUAL

**Preserve a direção atual do produto** (é escuro, sóbrio e operacional):

```
fundo        #08080d      superfície  #0e0e16     sidebar  #0b0b12
texto        #e4e4e7      secundário  #8b8b94
acento       violet-600 (#7c3aed)
bordas       rgba(255,255,255,0.05–0.10)
radius       8px controles · 12px cards · full em badges
tipografia   Geist Sans — maior texto do produto: 24px
sombra       quase nenhuma; profundidade vem de borda + superfície
```

Tons semânticos sempre como `cor/10` de fundo + `cor-400` de texto + `ring cor/20`:
verde = saudável · âmbar = atenção/estimativa · vermelho = prejuízo · violeta = ação/IA.

**Premium NÃO significa:** tudo preto, neon, gradiente roxo em tudo, glassmorphism.
Isto é **software operacional sério**: legibilidade e clareza acima de efeito.

## DENSIDADE

SaaS operacional. **Densidade é aceitável e desejável.** Não use um card gigante
para mostrar três números. Mas não pareça ERP legado — o espaço tem que ser
eficiente, não apertado.

## RESPONSIVO

Desktop-first (≥1280px: conversa + workspace lado a lado). Mas entregue solução
mobile: em 375px as superfícies devem **alternar**, não comprimir. O que sobra de
um breakdown de 7 parcelas e de uma comparação de 3 cenários?

## MOTION

Funcional, não decorativo. Os momentos que importam: Draft atualizado · Proposal
preparada · cálculo concluído · pendência resolvida · **etapa desbloqueada** (o
mais importante — é a consequência ficando visível) · stale · troca de contexto.

## RESTRIÇÕES

- Nada é criado ou alterado sem clique humano
- Toda mudança passa por uma Proposal que **diz exatamente o que fará**
- Botão de confirmação **nomeia a ação**: "Aplicar R$ 89,90", "Criar produto com 6 variantes"
- **Preparar ≠ publicar** — nada nesta jornada coloca anúncio no ar
- "Origem desconhecida" é resposta comum e **não pode virar célula vazia**
- Contraste AA obrigatório; cor nunca é o único sinal

## ENTREGÁVEIS

Para cada uma das três direções:

1. **Tela principal** com a sessão em andamento
2. **Panorama** ("o que precisa de mim")
3. **Decisão agrupada** (47 variantes, mesmo problema)
4. **Pricing** com breakdown expandido
5. **Comparação de 3 cenários**
6. **Proposal de preço** pronta para confirmar
7. **Stale**
8. **Prejuízo**
9. **Cadastro conversacional** com estrutura viva
10. **Preparação do anúncio** (5 etapas, dependências não lineares)
11. **Mobile** de pelo menos 3 destas

> Fim do prompt.

---

## O QUE PRECISAMOS RECEBER DE VOLTA

Para eu conseguir implementar sem reabrir a discussão:

### 1. Decisão de arquitetura — **bloqueante**
Qual direção (A, B ou C), **com a justificativa** contra os 9 critérios de
avaliação. Sem isso, nada é implementável.

### 2. Layout com medidas reais
- larguras das superfícies em ≥1280px, 1024–1280px e <1024px
- o que acontece com a sidebar de 240px
- onde a conversa vive em cada breakpoint
- **onde ficam os 8 tipos de cartão**

### 3. Anatomia de 6 componentes, com espaçamento e hierarquia
- **cartão de Proposal** (o padrão que se repete 5 vezes)
- **painel de panorama**
- **decisão agrupada**
- **breakdown de preço** (colapsado e expandido)
- **comparação de cenários**
- **estrutura viva do cadastro**

### 4. Tokens novos ou alterados
Se a direção exigir cor, espaçamento, radius ou tipografia fora do que existe:
**lista explícita**, com o valor e o motivo. Se não exigir, dizer isso — é uma
resposta válida e a melhor delas.

### 5. Vocabulário visual dos dois níveis de precisão
Como "estimativa" e "confirmado pelo ML" se distinguem sem alarme.

### 6. Especificação de motion
Duração, easing e gatilho dos 7 momentos. Ou a decisão de não animar algum.

### 7. Estratégia mobile
Quais superfícies alternam, como se navega entre elas, o que é cortado.

### 8. O que NÃO mudar
Lista do que a exploração decidiu preservar do produto atual. Tão importante
quanto o resto: evita eu refazer o que já estava certo.

**Formato:** telas em imagem + um documento com as decisões acima. Não preciso de
código — preciso das **decisões**, com medida e motivo.

---

## ALTERAÇÕES DE CÓDIGO NESTA SESSÃO

**Nenhuma.** Só inspeção e este documento. O portão não foi executado porque
nenhum arquivo de código foi tocado.
