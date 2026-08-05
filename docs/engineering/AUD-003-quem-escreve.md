# AUD-003 — Quem escreve no catálogo

```
Data:   2026-08-05
Pedido: HANDOFF-2026-08-04 §8.2 — "ler quem escreve, ANTES de restringir qualquer coisa"
Escopo: produtos · produto_variantes · anuncios_gerados · imagens_produto
Régua:  toda escrita, por qualquer mecanismo — e onde a mesma regra está dita duas vezes
```

A 053 foi aplicada, passou um DoD inteiro e quebrou três telas. O relatório dela
concluiu que a ordem certa é `código em produção → restrição`, e que a leitura
que faltou era esta. Esta é ela.

**O resultado que importa: um dos caminhos estava quebrado EM PRODUÇÃO.** A
varredura foi feita acreditando que o índice tinha sido derrubado em 04/08 — é o
que o relatório da 053 e o handoff afirmam. Medido em 05/08 antes de propor
reaplicá-lo: **o índice está no ar** (§5). Então os dois caminhos que a #193 não
alcançou não eram risco futuro; um deles falhava a cada uso.

---

## 1 · O primeiro instrumento estava cego, e por um motivo que se repete

Procurar `.from("tabela")` seguido de `insert/update/delete` encontrou **10
escritas**. O número está errado, e dava para saber sem contar nada: ele
devolveu **zero** escritas em `imagens_produto` — a tabela cujo caminho de
escrita eu tinha acabado de ler.

Há três mecanismos, e o grep só enxerga o primeiro:

| # | mecanismo | por que escapa | escritas |
|---|---|---|---|
| A | `.from("t").insert(…)` direto | — | **10** |
| B | `criarRepositorio({ tabela: "t" })` | o nome da tabela é **dado**, não texto no lugar da escrita | **25 funções, ~40 chamadas** |
| C | funções `rpc(…)` | a escrita acontece **dentro do Postgres** | **4** |

O mecanismo B é a maior parte do sistema e é invisível a qualquer busca por
nome de tabela: `imagensProduto.ts` diz `tabela: "imagens_produto"` uma vez, e
daí em diante quem escreve chama `criarImagem`. O C não está em TypeScript
nenhum — `copilot_executar_peso/custo/preco/titulo` (045–048) gravam em
`produtos` e `produto_variantes` de dentro do banco.

> Uma varredura por nome de tabela mede quem **escreve o nome**, não quem
> escreve na tabela. Foi o que devolveu zero para a única tabela que eu sabia
> de cor que tinha escrita.

---

## 2 · O mapa

### `imagens_produto` — 4 caminhos

| caminho | como | passa pela regra? |
|---|---|---|
| `storageImagens.uploadImagemProduto` | B | ✅ desde a #193 |
| `storageImagens.trocarCapaDoProduto` | B | ✅ troca explícita, com desfazer |
| `components/produtos/AbaImagens.tsx` | B — `criarImagem` **direto** | ❌ **não** |
| `importarAnunciosML.ts` | B — `criarImagensBulk` | ❌ **não** |
| `app/cliente/imagens/page.tsx` · `tornarCapa` | B — `atualizarImagem` ×2 | ❌ cópia à mão |

### `produtos` — 14 caminhos

`ProdutoForm` · `CadastrarProduto` · `cliente/produtos` · `z/page` ·
`CatalogCapabilityAdapter` · `catalog-events` · `correcaoPeloChat` ·
`atualizarFreteML` · `importacaoCustos` · `importacaoProdutos` ·
`importarAnunciosML` · `precificacaoDoCopilot` (A) · `assistente/proposta` (A, ×2) ·
RPC `copilot_executar_custo` e `copilot_executar_preco` (C)

### `produto_variantes` — 12 caminhos

`AbaVariacoes` · `GeradorDeGrade` · `CadastrarProduto` · `importacaoCustos` ·
`importacaoPeso` · `importacaoProdutos` · `importarAnunciosML` · `pesoDeProduto` ·
`assistente/proposta` (A, ×2) · `assistente/conversa` (A) ·
RPC `copilot_executar_peso` (C)

### `anuncios_gerados` — 13 caminhos

`cliente/anunciar` · `cliente/anuncios` · `cliente/otimizar` ·
`esteira/aprovacoes` · `esteira/lote` · `esteira/page` · `estadoDoAnuncioML` ·
`importarAnunciosML` · `migracaoAnuncio` · `publicacaoML` ·
`preparacaoDeAnuncio` (A) · `otimizar/worker` (A) · `assistente/conversa` (A)

---

## 3 · A regra da capa estava em cinco lugares, não em quatro

A #193 tirou três cópias das telas e deixou a regra em `papelDaFotoNova`. Ela
não alcançou duas, e a razão é a mesma nos dois casos: **a #193 consertou
`uploadImagemProduto`, e estes não passam por lá.**

| onde | o que dizia | contra o índice, que está no ar |
|---|---|---|
| `AbaImagens.tsx` | seletor nascia em `"Principal"`, ia direto ao repositório | **`unique_violation` a cada foto** — os 80 produtos têm capa |
| `importarAnunciosML.ts` | `i === 0 ? "Principal" : "Secundária"` | passava por sorte: só grava em produto recém-criado |
| `cliente/imagens` · `tornarCapa` | rebaixa e promove à mão | ordem certa, **sem desfazer** |

O caso de `AbaImagens` é o que fecha o argumento do relatório da 053. Um
seletor que já vem em `"Principal"` **é** `tipo ?? "Principal"` — o mesmo padrão
invertido, desenhado na tela em vez de escrito no serviço. Ausência de opinião
significando "esta é a capa", de novo.

`tornarCapa` era o defeito que `trocarCapaDoProduto` foi escrito para não ter:
rebaixava a antiga e, se a promoção falhasse, ninguém devolvia. Produto sem capa
não publica — é pior que duas capas.

### O que foi feito

1. `AbaImagens` pergunta a `papelDaFotoNova`, lendo o estado **do banco** (o
   `useLiveQuery` da tela pode estar defasado, e decidir capa por cache é como a
   segunda capa entrava calada). O seletor passa a nascer em `"Secundária"`.
2. `importarAnunciosML` decide pelo que já entrou no lote, com a regra — em vez
   de reafirmá-la como posição.
3. `tornarCapa` virou `promoverImagemACapa`, ao lado de `trocarCapaDoProduto`:
   rebaixa antes, restaura se falhar.
4. Sentinela `aCapaTemUmLugarSo.test.ts`: varre o `src` inteiro e reprova quem
   declarar `tipoImagem: "Principal"` fora do módulo que troca capa de propósito.

---

## 4 · A sentinela precisou ser conferida, e ela se acusou primeiro

A primeira versão tinha uma auto-verificação que procurava a linha proibida
escrita nela mesma. Falhou: uma sonda escrita em **código** não é comentário e
não é removida pelo filtro.

Foi a terceira vez na semana em que o instrumento, e não o alvo, estava errado —
depois dos dois testes que acusaram inocentes em 04/08. E o instrumento só vale
depois de reprovar de propósito: plantei um arquivo com a linha proibida, a
sentinela nomeou o arquivo, e o arquivo saiu.

> Sentinela que nunca falhou não é sentinela — é uma linha verde.

---

## 5 · A 053 não precisa voltar — ela nunca saiu

Esta seção existia para planejar a reaplicação. A medição desmontou o plano.

```
idx_imagens_produto_uma_capa   EXISTE, definição idêntica ao arquivo 053
ledger 053                     2026-08-04 03:22:18 UTC (carimbo original)
imagens_produto                651 linhas · 80 Principais · 0 com variante_id
chaves (produto, variante) com duas capas   0
```

Pelo banco não dá para distinguir "o `drop` nunca rodou" de "rodou e alguém
recriou": o `if not exists` do índice e o `on conflict do nothing` do ledger
produzem este mesmo estado nos dois casos. Rodar a 053 hoje é no-op.

> O relatório da 053 afirmou o estado do banco a partir do que foi **mandado**
> fazer, não do que foi **medido** depois. Um `drop index` escrito num documento
> não é um índice derrubado.

O que falta é o que **só o dono faz**, e é um passo só: **exercer os cinco
caminhos com sessão real** — subir foto no portal, importar pasta, melhorar capa
no Estúdio, tornar capa, e a aba Imagens do painel. Os quatro primeiros são o
grupo de controle; o último é o que falhava.

Não é zelo: é a única coisa que teria pego o defeito de 04/08, e continua sendo
a única que ainda não foi feita.

---

## 6 · O que esta varredura NÃO decidiu

**O escopo da capa em relação à variação.** O índice da 053 tem a chave
`(produto_id, coalesce(variante_id, …))` — ou seja, ele já trata a capa como
sendo **por cor**. `papelDaFotoNova` olha o produto inteiro. Enquanto
`variante_id` estiver vazio nas 651 linhas os dois concordam, e hoje concordam.

`AbaImagens` tem seletor de variação e **pode** gravar `variante_id`. Deixei a
regra no escopo do produto — a escolha conservadora, que nunca cria uma segunda
`Principal` sob nenhum dos dois critérios. Quando o DES-003 decidir onde mora a
foto por cor (HANDOFF §6.2, decisão do dono), a regra e o índice precisam ser
lidos **juntos**: é uma linha em `papelDaFotoNova`, e não uma migração.

Registrado aqui para não ser redescoberto: hoje é acordo por coincidência, não
por desenho.
