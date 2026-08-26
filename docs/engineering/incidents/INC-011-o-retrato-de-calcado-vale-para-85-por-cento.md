# INC-011 — O retrato de calçado é passado à mão para 118 anúncios que não são calçado

```
Status:      PARCIAL — 2 dos 5 caminhos consertados em 25/08 (T4)
Detectado:   2026-08-25, no CHECKPOINT 2 do plano (AUD-007)
Severidade:  pendência falsa trava publicação; exigência real fica sem cobrança
Aberto:      os 3 caminhos do assistente, que dependem de mudar o porto
```

## O defeito

Cinco caminhos resolvem atributos obrigatórios passando `OBRIGATORIOS_CALCADO`
**à mão**:

- `api/otimizar/worker/route.ts`
- `app/cliente/anunciar/page.tsx`
- `modules/assistant/domain/propostaDeAnuncio.ts` (dois lugares)
- `modules/publication/domain/preparacaoDoAnuncio.ts` (como padrão)

O comentário de `api/ml/categoria/route.ts` já dizia por quê: *"os cinco
caminhos passam `OBRIGATORIOS_CALCADO` à mão porque NINGUÉM SABE A CATEGORIA"*.

Medido em 25/08/2026 ([AUD-007](../AUD-007-o-que-o-ml-exige-nas-categorias-reais.md)),
a conta tem **seis** categorias, e o retrato só vale para uma:

```
MLB273770   674 anúncios   o retrato está certo
MLB23332     94 anúncios   exige 5, não 6 — não tem FOOTWEAR_TYPE
MLB7022       8 anúncios   exige 2: marca e modelo
MLB1400       8 anúncios   FOOTWEAR_TYPE é `string`, não lista fechada
MLB275574     7 anúncios   exige 5
MLB108791     1 anúncio    exige 7, incluindo SOCKS_TYPE e LENGTH_TYPE
```

**118 de 792 anúncios (15%) estão em categorias onde o retrato erra** — e erra
nas duas direções.

## Os dois estragos, e o primeiro é o que trava

**Cobra o que a categoria não pede.** Em MLB23332 (94 anúncios) o retrato exige
`FOOTWEAR_TYPE`, que aquela categoria não pede. Quando o produto não resolve
esse atributo, nasce uma pendência que **não existe** — e publicar exige a lista
de pendências vazia (`veredito A10`). É o mesmo defeito que o DES-001 arrancou
do A10, voltando por outra porta: ali o A10 inventava exigência de cabeça; aqui
a exigência vem de uma lista certa, aplicada à categoria errada.

**Não cobra o que a categoria pede.** MLB108791 exige `SOCKS_TYPE` e
`LENGTH_TYPE`. Como o retrato não os conhece, ninguém pergunta, o payload sai
sem eles, e quem recusa é o ML — depois do clique, sem causa legível.

## O que foi consertado em 25/08 (T4)

`obrigatoriosDoProduto` (puro, testado) decide qual lista vale, com uma regra que
o INC exigia: **lista vazia não é "não exige nada"**. `atributosObrigatorios`
devolve `[]` quando o ML não responde — aceitar esse vazio liberaria publicação
sem ficha, pior do que pedir um campo a mais. Vazio cai no palpite de calçado,
que é o comportamento de hoje. **Categoria desconhecida não virou parede nova.**

Dois caminhos passaram a perguntar antes:

- **`api/otimizar/worker`** — lê `anuncios_gerados.categoria_ml` do produto
  (banco, sem rede) e busca a lista real. É o caminho silencioso do lote.
- **`app/cliente/anunciar`** — a categoria já estava em memória (`anuncios` traz
  `categoriaMl`); a lista vem de `/api/ml/categoria`, que tem caminho público
  sem token. Nova função `lib/services/categoriaML.ts`, porque
  `mercadolivre.ts` é somente-servidor e uma tela não pode importá-lo.

Provado em `obrigatoriosDoProduto.test.ts`, contra as respostas reais de
MLB23332 e MLB273770 congeladas em fixture: o mesmo produto, com gênero legível
no nome, fica **pronto** pela lista de MLB23332 e **bloqueado** pelo palpite —
por um campo que não existe naquela categoria.

## O que continua aberto

Três caminhos do assistente: `propostaDeAnuncio` (dois lugares) e o padrão de
`preparacaoDoAnuncio`, alcançados por `executarFerramenta` através do porto
`ctx.anuncio.catalogo()`. Ali os produtos chegam em lote, e resolver a categoria
de cada um exige mudar o porto para trazer as exigências junto — fatia própria,
com o mesmo cuidado de não transformar desconhecido em parede.

## Por que não foi tudo de uma vez

Mudar **de onde sai a lista de obrigatórios** altera o que trava publicação em
792 anúncios. Os dois caminhos consertados são per-produto e a categoria chega
barata: um lê o banco, o outro já tinha o dado na tela. Os três que faltam
recebem produtos em LOTE por um porto, e resolver a categoria de cada um sem
transformar a tela num carrossel de requisições é desenho de porto, não fiação.

A ordem das fontes, quando alguém pegar o que falta:

1. `anuncios_gerados.categoria_ml` — medida, sem rede, existe desde 10/08;
2. `domain_discovery` pelo título — `api/ml/categoria`, já pronta, precisa de
   token e serve o produto que ainda não foi ao ar;
3. o retrato de calçado — dito como palpite, nunca como medição.

A terceira é a que impede este INC de virar uma parede nova: categoria
desconhecida não pode passar a travar publicação.
