# CONSEQ-001 — Desenho: consequência comprovável, do domínio à superfície

**Data:** 2026-07-30 · **Branch:** `feat/copilot-lote-com-escopo-congelado` @ `ebdf2e1`
**Estado:** DESENHO. Nada implementado. Aguarda autorização.

Direção que este desenho serve: **a IA interpreta → o domínio prova → a superfície
mostra a diferença.** O que estamos provando não é que o Copilot está pronto — é
que aquilo que ele diz que uma proposta vai causar é um **fato calculado pelo
Zion**, não uma previsão convincente.

---

## A. Fluxo atual de `/api/assistente/proposta`

`src/app/api/assistente/proposta/route.ts`, 671 linhas. Uma rota, um POST,
`{ propostaId }` no corpo — e mais nada.

```
POST { propostaId }
  │
  ├─ exigirAutenticado          tenant da SESSÃO (nunca do corpo)
  ├─ buscarProposta(id)         SEM filtro de tenant, de propósito
  ├─ lerEstadoAtual(p)          relê o mundo AGORA
  ├─ podeExecutar(p, tenant, agora, estadoAtual)
  │     └─ recusa → registrarAcao(resultado: "recusada")
  │                 marcarProposta("obsoleta" | "expirada")
  │                 409  (ou 200 quando `ja_executada`)
  │
  ├─ reservarParaExecucao(p.id)     transição atômica pendente → executada
  │     └─ perdeu a corrida → 200 { ok:false, jaFeito:true }
  │
  ├─ gravar(p)                      → { afetados, antes, depois }
  ├─ desfechoDaGravacao(afetados, depois)  → sucesso | parcial | falhou
  ├─ registrarAcao(...)             copilot_acoes, com antes/depois
  ├─ registrarVarias(rastroDaEscrita(...))  procedencia_de_campo
  └─ 200 { ok:true, afetados, mensagem, produtoId? }
```

**Ordem que importa e não deve mudar:** a auditoria vem **depois** da gravação, e o
rastro de procedência **depois** da auditoria — *"registrar a origem de um valor que
não chegou a existir criaria uma trilha que aponta para nada"*. A consequência,
seja qual for, entra **depois** dos três. Se ela falhar, nada do que já aconteceu
pode ser desfeito nem posto em dúvida.

### O que `gravar` devolve, por tipo — a matéria-prima da consequência

| tipo | escreve | `afetados` | `depois` |
|---|---|---:|---|
| `peso` (lote) | `produto_variantes.peso` em `.in("produto_id", p.alvos)` | nº de variantes | `{ variacoesAtualizadas, pesoKg }` |
| `peso` (individual) | idem, um produto | nº de variantes | as linhas |
| `custo` | `produtos.custo` | 0 ou 1 | `{ id, custo }` |
| `preco` | `produtos.preco_venda` + margem | 0 ou 1 | `{ preco, margem }` |
| `titulo` | um campo do anúncio | 0 ou 1 | `{ titulo }` |
| `cadastro` | cria produto + grade | 1 | `{ produtoId, nome, sku, variantesCriadas, variantesPedidas, draftId }` |

**`p.alvos` é o conjunto oferecido, literalmente.** Na rota de conversa:

```ts
const alvos = escopoDoLote.incluidos.map((c) => c.id);   // linha 462
...
escopo: { produtosAfetados: escopoDoLote.incluidos.length, ... }   // linha 678
```

O que a proposta grava e o que o cartão mostrou ao lojista são **a mesma lista**.
Isso dá a R1 uma âncora que não precisa ser inventada: *o conjunto oferecido* já
existe, já é persistido em `copilot_propostas.alvos`, e já foi exibido.

---

## B. Contrato atual de `Consequencia`

Existe em `src/modules/workspace/domain/consequencia.ts` (vertical anterior), com
10 testes — e **nunca foi produzido por ninguém**. É tipo e função pura; nenhuma
rota o emite, nenhuma tela o consome.

```ts
interface Desbloqueio {
  modo: ModoDoWorkspace;
  quantos: number | null;    // null = o servidor não contou
  unidade?: string;
}
interface Consequencia {
  resumo: string;
  afetados: number;
  desbloqueios: readonly Desbloqueio[];
}
```

Garantias já implementadas e testadas:

- **não tem campo de destino** — e `modosDoWorkspace.aplicar` não aceita nenhum;
- `ofertasQueValem` descarta `quantos === 0` e **deixa passar `null`**;
- `rotuloDoDesbloqueio` acerta o singular;
- `comoEvento` produz um evento que só mexe em `oferecidos`.

**O que falta é exatamente o meio:** ninguém calcula um `Desbloqueio` a partir de
dados reais.

### Contrato de resposta da rota, hoje

```ts
// ok
{ ok: true, afetados: number, mensagem: string, produtoId?: string }
// recusa
{ ok: false, motivo?: string, mensagem: string, jaFeito?: boolean }
```

**Consumidores: um só.** `conversaDoAssistente.confirmarProposta` copia campos
conhecidos para `ResultadoDaConfirmacao` e o único chamador é
`ChatDaOperacao.tsx:435`, que passa por `desfechoDaConfirmacao` /
`desfechoDaCriacao` — e essas funções leem **apenas** `{ ok, jaFeito, mensagem }`.

Um campo novo é ignorado por todo o caminho existente. A evolução aditiva é segura
por inspeção, não por esperança.

---

## C. Dados disponíveis no momento da consequência

Depois da gravação, o servidor tem em mãos, sem nenhuma consulta nova:

| dado | origem |
|---|---|
| `p.alvos` | a proposta — **o conjunto oferecido** |
| `p.tipo`, `p.valor`, `p.resumo` | a proposta |
| `afetados`, `antes`, `depois` | `gravar` |
| `p.clienteId` | a proposta (e confere com a sessão) |

E pode consultar, com portos que **já existem**:

| porto | assinatura | custo |
|---|---|---|
| `precoDoProduto(clienteId, produtoId)` | **um produto por chamada** | 1 produto = ~3 queries |
| `catalogoParaTriagem(clienteId)` | **o catálogo inteiro**, `LIMITE_DA_TRIAGEM = 300` | 1 varredura |
| `produtoParaPreparar(clienteId, produtoId)` | um produto | idem |
| `catalogoParaPreparar(clienteId)` | catálogo, `LIMITE_DE_PRODUTOS = 300` | 1 varredura |

**Os dois portos de catálogo são exatamente o perigo que R1 descreve.** Eles leem o
universo do tenant, não o conjunto oferecido. Usá-los e filtrar depois "funcionaria"
e seria a porta pela qual a ampliação silenciosa entra: basta alguém, um dia,
esquecer o filtro.

**O porto que falta é o único código novo de leitura desta proposta:** um que receba
**a lista de ids** e leia só ela.

### O julgamento determinístico que já existe

`pricing/domain/conversaDePreco.avaliar(entradas)`:

```ts
if (custoEmConflito)                       → { estado: "conflito" }
if (!(custo > 0))                          → bloqueio "o custo do produto"
if (comissao === "indisponivel")           → bloqueio "a comissão do Mercado Livre"
if (envioDoModelo(...) === null)           → bloqueio "o peso da embalagem"
                                           → { estado: "calculavel" | "bloqueado", bloqueios }
```

Sem modelo, sem estimativa, sem "cerca de". É uma função pura sobre entradas do
domínio, e ela **nomeia o bloqueio do peso**. É a peça que torna este slice possível.

`publication/domain/preparacaoDoAnuncio.avaliarPreparacao` faz o equivalente para
as etapas do anúncio, também puro.

---

## D. Matriz dos cinco modos

> **"Desbloqueado" não significa a mesma coisa nos cinco.** Em `pricing` significa
> *a conta agora fecha*. Em `triagem` significa *há mais linhas para olhar* — que é
> uma frase sobre a tela, não sobre o negócio. A matriz existe para não tratar as
> duas como a mesma coisa.

| modo | comprovável hoje? | o que seria "desbloqueado" | por quê |
|---|---|---|---|
| **pricing** | ✅ **sim** | produtos que saíram de `bloqueado` para `calculavel` | `avaliar()` é puro, determinístico e **nomeia o bloqueio do peso**. Basta reavaliar os `alvos` depois da escrita. É o único modo em que a escrita muda diretamente uma entrada que o julgamento consome. |
| **preparacao** | ⚠️ **parcialmente** | produtos que saíram de `bloqueado` na etapa de pricing | `avaliarPreparacao` é puro e determinístico, mas depende de **imagens, conteúdo e categoria** além de preço. Uma proposta de peso mexe em **uma** entrada de **uma** etapa. Comprovável, porém quase sempre 0 — e um número quase sempre zero ensina o lojista a ignorar a área. |
| **fila-de-decisoes** | ❌ **não** | "restam N decisões" | A fila é montada por `resolucaoDePendencias.planejarResolucao` sobre o **catálogo**, não sobre um conjunto. Contar o que resta exige varrer o universo — exatamente o que R1 proíbe. E "restam 12" não é consequência **desta** proposta: é o estado do mundo. |
| **triagem** | ❌ **não** | "N produtos entraram na triagem" | Triagem é uma **visão** com filtro, não um estado do domínio. Nenhum produto "entra" nela; ela mostra o que existe. Um número aqui seria uma afirmação sobre a tela disfarçada de fato. |
| **draft** | ❌ **não** | — | Não existe consequência de sistema para um Draft: ele é o trabalho em curso do próprio lojista, e a conversa já mostra tudo o que ele contém. Um cartão dizendo "seu rascunho avançou" seria o sistema narrando o que a pessoa acabou de fazer. |

**Conclusão:** um modo comprovável de verdade (`pricing`), um comprovável e quase
sempre vazio (`preparacao`), três não comprováveis sem violar R1.

**Isto não pede mudança nos cinco modos.** Nenhum deles muda; três simplesmente não
produzem `Desbloqueio` — o que o contrato já suporta, porque a lista de
`desbloqueios` pode ser vazia.

---

## E. A menor evolução aditiva do contrato

### Na resposta HTTP

```ts
{
  ok: true,
  afetados: number,
  mensagem: string,
  produtoId?: string,
  consequencia: Consequencia | null      // ← ÚNICO campo novo
}
```

**`null` é resultado válido e é o caso comum.** Presente-e-`null` em vez de ausente
para que a tela distinga *"este servidor calculou e não achou nada a oferecer"* de
*"esta resposta não fala de consequência"*. Nas respostas de recusa (`ok: false`)
o campo **não** aparece: não houve escrita, logo não há consequência.

### No tipo do domínio

O `Consequencia` de `workspace/domain` **não muda**. O que se acrescenta é a função
que o produz — pura, e num módulo novo:

```ts
// src/modules/workspace/domain/consequenciaDoLote.ts   (NOVO, puro)

export interface AvaliacaoDeAlvo {
  produtoId: string;
  antes: "calculavel" | "bloqueado" | "conflito";
  depois: "calculavel" | "bloqueado" | "conflito";
}

export interface ConsequenciaDoLote {
  consequencia: Consequencia;
  /** Ids avaliados que NÃO estavam no conjunto oferecido. Deve ser 0. Ver R1. */
  foraDoEscopo: number;
  /** Ids oferecidos que não puderam ser avaliados. Ver a regra do parcial. */
  naoAvaliados: number;
}

export function consequenciaDoLote(entrada: {
  resumo: string;
  afetados: number;
  alvos: readonly string[];             // o conjunto OFERECIDO
  avaliacoes: readonly AvaliacaoDeAlvo[];
}): ConsequenciaDoLote;
```

### As três categorias — e por que são duas

O pedido admitia uma terceira categoria ("parcial"), **somente se determinística**.
O código sustenta detectá-la (`naoAvaliados > 0` é um fato exato), mas ela **não deve
virar categoria**, e a razão é a própria regra:

> Se não avaliamos o conjunto **inteiro**, não podemos provar um número **sobre o
> conjunto**. "12 de 45 dos 47" apresentado ao lado de "12" é indistinguível para
> quem lê, e o 12 parcial seria lido como completo.

**Regra proposta:** `naoAvaliados > 0` ⇒ `quantos: null`. A oferta aparece sem
número — que o contrato já suporta e `ofertasQueValem` já deixa passar. Ficam **duas**
categorias visíveis:

| categoria | forma |
|---|---|
| **comprovada** | `Desbloqueio { quantos: N }`, com `N > 0` |
| **não disponível** | `consequencia: null`, ou `Desbloqueio { quantos: null }` |

`naoAvaliados` e `foraDoEscopo` seguem no retorno interno **para auditoria e teste**,
não para a tela.

---

## F. O slice vertical escolhido

### **Proposta de PESO em lote → consequência de PRICING**

Uma proposta real, o caminho inteiro, um cartão que já existe.

```
lojista: "põe 420g em todos os chinelos sem peso"
   │
   ├─ conversa → preparar_resolucao → escopo: 12 produtos, 47 variantes
   ├─ CartaoDoLote mostra o escopo         ← o conjunto OFERECIDO
   ├─ clique → /api/assistente/proposta
   │     ├─ grava peso em .in("produto_id", p.alvos)
   │     ├─ audita, registra procedência
   │     └─ NOVO: avalia os 12 alvos com `avaliar()` → consequência
   └─ resposta { ok, afetados: 47, mensagem, consequencia }
         └─ CartaoDoLote renderiza:  "✓ 47 variantes atualizadas
                                       Isso desbloqueou: Pricing — 4 produtos
                                       [Calcular preço]"
```

### Por que este, e não outro

| critério | por quê |
|---|---|
| **maior evidência no domínio** | `avaliar()` já existe, é puro, e **nomeia o bloqueio do peso** (`"o peso da embalagem"`). A escrita muda exatamente a entrada que ele consome. |
| **menor necessidade de inferência** | Zero. Nenhum modelo participa do cálculo. A resposta é uma comparação de dois `avaliar()` sobre as mesmas entradas, uma antes e uma depois. |
| **conjunto oferecido explícito** | `p.alvos` **é** o que o cartão mostrou. R1 tem uma âncora real, não uma convenção. |
| **superfície já existe** | `CartaoDoLote` (`ChatDaOperacao.tsx:1512`) já renderiza o desfecho. Acrescentar um bloco é aditivo — **sem Workspace, sem split, sem drill-down**. |
| **lote é onde a consequência importa** | Uma proposta de um produto o lojista confere sozinho. Quarenta e sete variantes é onde ele não tem como saber o que mudou. |

### O que a base real vai produzir — e por que isso é bom

Medido na auditoria de banco: **30 de 73 produtos têm custo** e **525 de 684
variantes têm peso**.

Um produto sem custo continua `bloqueado` depois de ganhar peso — o bloqueio passa a
ser *"o custo do produto"*. **Na maioria dos casos o número será pequeno ou zero.**

Isso é o comportamento correto, não uma falha do slice: `ofertasQueValem` filtra
`quantos === 0` e **nenhuma oferta aparece**. A tela não vai prometer pricing para
quem ainda não pode precificar — que é exatamente a diferença entre um fato e uma
previsão convincente.

### O código novo, na íntegra

| arquivo | o que | linhas (est.) |
|---|---|---|
| `modules/workspace/domain/consequenciaDoLote.ts` | puro: compara antes/depois, aplica R1 | ~70 |
| `modules/workspace/domain/consequenciaDoLote.test.ts` | testes, inclusive R1 | ~150 |
| `lib/services/avaliacaoDeAlvos.ts` | **porto novo**: lê só os ids dados | ~80 |
| `api/assistente/proposta/route.ts` | chama o porto e o domínio; devolve o campo | ~25 |
| `lib/services/conversaDoAssistente.ts` | repassa o campo | ~4 |
| `components/client-portal/ChatDaOperacao.tsx` | bloco no `CartaoDoLote` | ~30 |

**Nenhuma migração. Nenhum modo novo. Nenhuma Capability. Nenhuma mudança de
domínio** — `avaliar()` e `Consequencia` são consumidos como estão.

### O porto novo, e por que ele é obrigatório

`precoDoProduto` é **um produto por chamada** (~3 queries cada). Para 12 alvos são
36 round-trips, dentro de um `maxDuration = 30`, **depois** de uma escrita que já
aconteceu.

`avaliacaoDeAlvos(clienteId, ids)` lê `produtos` e `produto_variantes` com
`.in("id", ids)` — **duas queries, escopadas ao conjunto oferecido**, e nunca ao
catálogo. É a peça que torna R1 verdadeira por construção em vez de por disciplina.

**Teto de alvos:** o escopo do lote pode ter milhares. Proponho avaliar até **200**
e, acima disso, devolver `quantos: null` (a oferta sem número) em vez de gastar o
orçamento da requisição — pela mesma regra do parcial.

---

## G. Testes necessários

### R1 — o teste que deve falhar se alguém ampliar o universo

```ts
test("R1: a consequência NÃO conta registros fora do conjunto oferecido", () => {
  const r = consequenciaDoLote({
    resumo: "47 variantes atualizadas",
    afetados: 47,
    alvos: ["a", "b"],                                  // OFERECIDO: dois
    avaliacoes: [
      { produtoId: "a", antes: "bloqueado", depois: "calculavel" },
      { produtoId: "b", antes: "bloqueado", depois: "bloqueado" },
      // veio do catálogo, não da proposta — o cenário que R1 proíbe:
      { produtoId: "z", antes: "bloqueado", depois: "calculavel" },
    ],
  });
  assert.equal(r.consequencia.desbloqueios[0].quantos, 1);  // não 2
  assert.equal(r.foraDoEscopo, 1);
});

test("R1: na fiação real, foraDoEscopo é ZERO", () => {
  // Falha no dia em que alguém trocar `avaliacaoDeAlvos(ids)` por
  // `catalogoParaTriagem(cliente)` e esquecer o filtro.
  assert.equal(rDaFiacaoReal.foraDoEscopo, 0);
});
```

`foraDoEscopo` é o sensor: em vez de lançar exceção **depois de uma escrita já
consumada** — o que transformaria um sucesso em erro 500 —, ele torna a ampliação
visível e testável.

### Os demais

| teste | garante |
|---|---|
| conta só quem **mudou** de `bloqueado` para `calculavel` | quem já era calculável antes não é consequência desta proposta |
| `conflito` → `calculavel` **não** conta | conflito de custo não se resolve com peso; contar seria atribuir um efeito que a escrita não teve |
| todos continuaram bloqueados → `desbloqueios: []` | e `ofertasQueValem` devolve vazio: **nenhum botão** |
| `naoAvaliados > 0` → `quantos: null` | a regra do parcial: sem o conjunto inteiro, sem número |
| `alvos: []` → `consequencia: null` | nada oferecido, nada a concluir |
| a consequência **não** troca o modo | R1 do workspace, já testado — reafirmado com esta origem real |
| `afetados` da consequência = `afetados` da gravação | a consequência não reconta a escrita |

### LiveQuery

O slice **não toca** o hook. As invariantes ficam como estão e já têm teste
(`carregando → erro → vazio → sucesso`, erro antes de vazio, `0`/`false` não são
vazio, `revalidando` não apresenta dado antigo como do novo alvo). **Nenhuma migração
dos 72 consumidores neste trabalho.**

---

## H. Mapa do fio único — para a etapa seguinte, não para agora

### A hipótese está **confirmada**, e é pior do que parecia

`ChatDaOperacao.tsx:496-500`:

```ts
onClick={() => {
  setConversando((v) => !v);
  setFalas([]);          // ← o histórico DO MODELO é apagado
}}
```

`setTurnos` **não** é chamado. Então:

> **A tela continua mostrando a conversa inteira, e o modelo passa a não lembrar de
> nada.** Não é um reset limpo — é amnésia invisível. O lojista diz "e o segundo?"
> logo depois de trocar de modo, vê os três candidatos ainda na tela, e recebe "não
> sei a qual você se refere".

### Onde cada coisa vive

| coisa | onde | forma |
|---|---|---|
| `turnos` | `ChatDaOperacao.tsx:239` | `useState<Turno[]>` — **o que a tela desenha** |
| `falas` | `ChatDaOperacao.tsx:253` | `useState<readonly Fala[]>` — **o que o modelo recebe** |
| `conversando` (o modo) | `ChatDaOperacao.tsx:251` | `useState<boolean>` |
| persistência local | `conversaGuardada` | localStorage por `clienteId`; grava `turnos` **e** `falas` |
| persistência servidor | `copilot_conversas` / `copilot_mensagens` | **só a rota de conversa grava.** A rota barata não grava nada |

**São duas representações paralelas da mesma conversa**, e o modo é um terceiro
estado independente das duas.

### Por que trocar o modo redefine a conversa

Não é uma regra de produto — é uma consequência de forma. `falas` é o formato de
histórico da rota de conversa (`role: "user" | "model"`, com `parts`). A rota barata
**não tem histórico**: ela classifica uma frase isolada. Não havendo tradução entre
os dois formatos, alternar deixaria `falas` com turnos que a outra rota nunca
produziu — e a saída escolhida foi jogar fora.

### O que dependeria do modo

| chamada | depende de `conversando`? |
|---|---|
| `conversar(...)` → `/api/assistente/conversa` | sim — só no modo ligado |
| `classificarPergunta(...)` → `/api/assistente` | sim — só no modo desligado |
| `confirmarProposta(...)` → `/api/assistente/proposta` | **não** — a proposta é a mesma nos dois |

**A rota de proposta já é independente do modo.** É mais um motivo para o slice de
consequência vir antes: ele não esbarra nesta questão.

### O que precisaria mudar para o modo virar roteamento

1. **Um formato de histórico só.** `falas` passa a ser a representação canônica, e a
   rota barata aprende a **gravar o turno dela** no mesmo fio. A persistência já
   existe (`copilot_mensagens`, migração 037 aplicada) — falta a rota barata usá-la.
2. **A decisão sai do componente e vai para o servidor.** `/conversa` recebe a frase
   e roda o classificador que **já existe** antes de decidir se entra no laço de
   ferramentas.
3. **`conversando` deixa de existir como estado da tela.** Vira, no máximo, um
   indicador do que aconteceu naquele turno — não a identidade da conversa.

**Ordem obrigatória: 1 → 2 → 3.** Enquanto o histórico for descartado na troca, uma
decisão por turno produz amnésia no meio da conversa.

> **Sobre o opt-in:** ele é **fronteira de autoridade** entre um classificador de 7
> intenções e uma operação com 16 ferramentas. **Não é escolha entre modelo barato e
> caro** — os dois usam `gemini-2.5-flash`. O custo vem de número de chamadas,
> tamanho do contexto e tamanho do prompt.

---

## I. Mapa de responsabilidades do `ChatDaOperacao` — sem refatorar

1.421 linhas. Cinco responsabilidades, e **uma delas é 60% do arquivo**.

| responsabilidade | onde | linhas | sai para o Workspace? |
|---|---|---:|---|
| **Estado da conversa** | `turnos`, `falas`, `retomou`, persistência em `conversaGuardada` | 238–294 | **não** — é da conversa |
| **Modo** | `conversando` (251) e o botão (494–509) | ~20 | **sim** — vira roteamento no servidor (§H) |
| **Chamadas de API** | `perguntar` (296–413), `confirmar` (415–460), `descartar` (462) | ~170 | **não** — mas `confirmar` ganha o campo de consequência |
| **Seleção / contexto** | `contexto`, `produtos`, `produtoAberto` vindos por prop | props | **não** — quem monta é `useEstadoDaLoja` |
| **Renderização de cartões** | 15 componentes: `PainelDePreco`, `CartaoDePreco`, `PainelDaPreparacao`, `CartaoDeTitulo`, `PainelDePendencias`, `CartaoDeProcedencia`, `CartaoDoCadastro`, `CartaoDeAnuncio`, `CartaoDoLote`, `CartaoDaProposta`, `Resposta`, `Breakdown`… | 662–1421 (**~760 linhas, 54%**) | **sim, a maioria** |

### O que precisa sair, quando C chegar — e por qual fronteira

**Não por tamanho.** A fronteira que o produto exige é a dos **cinco modos**:

| componente atual | destino |
|---|---|
| `PainelDePreco`, `CartaoDePreco`, `Breakdown` | modo **pricing** |
| `PainelDaPreparacao`, `CartaoDeTitulo` | modo **preparacao** |
| `CartaoDoCadastro` | modo **draft** |
| `PainelDePendencias`, `CartaoDoLote` | modo **fila-de-decisoes** |
| `CartaoDeProcedencia` | **fica** — é disclosure dentro de um cartão, não modo (§8 de UX-FOUNDATION-001) |
| `CartaoDaProposta`, `CartaoDeAnuncio`, `Resposta` | **ficam na conversa** — são a fala, não superfície |

**Fica no `ChatDaOperacao`:** estado da conversa, chamadas de API, a fala e os
cartões pequenos de confirmação. Isso é ~660 linhas — um arquivo grande, e um
arquivo **coerente**.

**Nenhuma dessas extrações é necessária para o slice de consequência.** O bloco novo
entra no `CartaoDoLote` onde ele está.

---

## J. Riscos, lacunas e regra de parada

### A regra de parada **não** disparou

| gatilho | disparou? |
|---|---|
| inferência do LLM | **não** — `avaliar()` é puro; nenhum modelo participa |
| mudança ampla de domínio | **não** — `avaliar()` e `Consequencia` são consumidos como estão |
| nova arquitetura | **não** — nenhuma Capability, Mission ou Platform |
| migration | **não** — nenhuma |
| alterar os cinco modos para provar um | **não** — os cinco ficam; três não produzem `Desbloqueio`, e o contrato já permite lista vazia |
| refatoração grande do `ChatDaOperacao` | **não** — bloco novo num cartão existente |
| definição de produto que não temos | **não** — "produto calculável" já está definido em `avaliar()` |

### Riscos, com a mitigação proposta

| risco | mitigação |
|---|---|
| **A consequência falha depois da escrita consumada.** Um erro no cálculo viraria 500 numa operação que **deu certo**. | O cálculo vai em `try/catch` próprio, **depois** da auditoria e do rastro, e o `catch` devolve `consequencia: null`. Um sucesso nunca vira erro por causa de um enfeite. |
| **Custo de tempo.** 12 alvos com `precoDoProduto` seriam ~36 queries dentro de `maxDuration = 30`. | O porto novo lê em **duas** queries com `.in("id", ids)`. Teto de 200 alvos; acima disso, `quantos: null`. |
| **Ampliação silenciosa** — alguém troca o porto por `catalogoParaTriagem`. | `foraDoEscopo` no retorno + teste que exige `0` na fiação real. |
| **O número quase sempre zero.** Só 30 de 73 produtos têm custo. | É o comportamento certo: `ofertasQueValem` filtra `0` e nenhum botão aparece. Vale medir na base real antes de considerar o slice bem-sucedido. |
| **Duplo clique.** `jaFeito: true` não recalcula consequência. | Correto e deliberado: a consequência é da **execução**, não do clique. Na resposta `jaFeito` o campo não vem. |

### Lacunas de evidência — declaradas, não contornadas

1. **Aparência nunca validada.** Os +97 testes da vertical anterior e os deste slice
   provam lógica, **não** aparência. Continuam sem validação autenticada:
   `loading`, `erro`, `vazio`, `sucesso`, `revalidando`, overflow e **legibilidade da
   consequência**. Não tenho credencial de sessão e **não vou alterar autenticação
   nem criar bypass** — registro como evidência faltante.

2. **`.test.tsx` não executam.** `npm test` roda `tsx --test "src/**/*.test.ts"` —
   só `.ts`. Os 10+ arquivos `.test.tsx` (`src/mission/tests/*`, `src/shell/**`) são
   typechecked e nunca executados. **Registrado como débito próprio, fora deste
   trabalho**, mesmo tratamento dado ao débito anterior de typecheck. O slice não
   depende disso: todo teste dele é lógica pura em `.ts`.

3. **O "6 a 19 vezes" do custo do Copilot** vem de um comentário no código. Medi a
   **estrutura** que produz a faixa, não a faixa.

### D1–D7 e mobile

**Congelados como estão** (D1 380/720 · D2 580–628 · D3 sidebar não colapsa · D4 só
de `xl` · D5 profundidade 1 · D6 modo + vale a tela · D7 menos de 3 itens não abre).
**Nenhum componente de Workspace neste slice.** Abaixo de `xl` nada é forçado, e a
arquitetura mobile continua **não resolvida** — funcional e honesta é o suficiente
por enquanto.

---

## Resumo da decisão que peço

**Autorizar o slice:** proposta de **peso em lote** → `avaliacaoDeAlvos` (porto novo,
lê só os alvos) → `consequenciaDoLote` (puro, R1 por construção) →
`consequencia: Consequencia | null` na resposta → bloco no `CartaoDoLote`.

**Seis arquivos, ~360 linhas, sem migração, sem Workspace, sem tocar no domínio.**

Se preferir, há uma versão ainda menor: entregar o cálculo e o contrato **sem** o
bloco na tela, e ver o campo chegando no `network` antes de desenhar qualquer coisa.
Perde a prova de ponta a ponta que o pedido descreve — mas é a menor coisa que
prova que o número é um fato.
