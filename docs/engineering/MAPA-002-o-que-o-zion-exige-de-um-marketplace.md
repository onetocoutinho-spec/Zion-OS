# Mapa — o que o Zion exige de um marketplace

```
Pergunta:  "precisamos pensar nas plataformas que o cliente vai integrar —
            Shopee, TikTok Shop. Como podemos seguir?"
Método:    extraído do NOSSO código. Nada aqui descreve Shopee ou TikTok Shop.
Fonte:     lib/marketplaces/mercadolivre.ts (1.632 linhas) · 12 rotas /api/ml/*
           · canais_marketplace · o modelo de dados
```

> **Este documento não diz como outras plataformas funcionam.** Ele diz o que o
> Zion precisa que uma plataforma faça. É o formulário que a próxima integração
> tem que preencher — e as respostas se preenchem **medindo a API real**, nunca
> de memória. A regra do handoff §2 vale em dobro aqui: *"Nunca adivinhe. Medir
> sem token custa trinta segundos e distingue 403 = existe de 404 = inventei."*

---

## 1 · O estado de hoje, medido

| | |
|---|---|
| arquivos que nomeiam o ML | **136 de 529** (26%) |
| `lib/marketplaces/mercadolivre.ts` | **1.632 linhas** — onde o sistema realmente vive |
| rotas `/api/ml/*` | **12** |
| `capabilities/marketplace/` | 103 linhas, **zero chamadores fora de teste** |

O modelo de dados, porém, está **melhor** do que o código:

| | |
|---|---|
| coluna `marketplace` | já existe em **6 tabelas**, default `'Mercado Livre'` |
| `canais_marketplace` | `unique (cliente_id, marketplace)` — plural por desenho |
| `status_marketplace`, `sub_status_marketplace`, `estoque_marketplace` | nomes genéricos |
| colunas com nome de plataforma | **só duas**: `ml_item_id`, `ml_permalink` |

**O eixo "qual marketplace" já está modelado.** Essa costuma ser a parte cara, e
está feita. O que não existe é a abstração no código — e o que existe com esse
nome abstrai **um campo** (`tipoAnuncio: "Classic" | "Premium"`), que é
vocabulário do próprio Mercado Livre.

---

## 2 · As nove capacidades

Extraídas dos `export` de `mercadolivre.ts` e das 12 rotas. Cada uma é uma
pergunta que a plataforma nova tem que responder.

### C1 · Credencial — obter e manter

`trocarCodigoPorToken` · `renovarToken` · `/api/ml/autorizar` · `/api/ml/conectar`

O Zion guarda **`refresh_token` + `seller_id`** por `(cliente_id, marketplace)`,
rotaciona no servidor e nunca expõe ao navegador.

O que precisa ser respondido: o fluxo é OAuth de três pernas? O token se renova
sozinho ou expira de vez? Existe o conceito de "loja" separado do de "conta"?

> ⚠️ **INC-009** ensinou que `ativo = true` não é o mesmo que credencial válida.
> Qualquer plataforma nova herda essa lição: **validade não se infere de
> intenção.**

### C2 · Ler o catálogo do vendedor

`buscarAnunciosDoVendedor` · `/api/ml/importar-anuncios`

Precisa listar **tudo** que o vendedor tem, paginado, com uma noção honesta de
"a leitura foi completa". O tipo `ParedeDaLeitura` existe só para isso:
`"nenhuma" | "offset-1000" | "teto" | "paginacao-parou"`.

Isso não é detalhe: é a diferença entre *"você tem 781 anúncios"* e *"vi 781 e
não sei se há mais"*. Um sistema que afirma completude sem poder prová-la mente
para a lojista.

### C3 · Ler o estado de cada anúncio

`AnuncioML` · `/api/ml/estado-do-anuncio`

Quatro fatos por anúncio: **estado**, **sub-estado**, **estoque na vitrine** e
**tamanho da foto de capa**. Os quatro são lidos na mesma resposta e gravados
nas colunas genéricas da 050/051.

A invariante que atravessa o sistema inteiro e vale para qualquer plataforma:
**ausência de estado é `NULL`, nunca `"active"`.** Nunca existe `?? "active"` no
código — o Zion não afirma à lojista o que o marketplace não disse.

### C4 · Ler conformidade (infrações)

`mlbsComInfracao` · `/api/ml/diagnostico-infracoes`

O ML declara 1.060 infrações nesta conta, com **remédio em 1.028 delas**. É essa
leitura que ordena o trabalho.

Pergunta aberta e provavelmente a mais divergente entre plataformas: existe
equivalente? É API ou só painel? Tem remédio legível por máquina?

### C5 · Publicar

`criarItem` · `preverCategoria` · `/api/ml/publicar`

Aqui mora o acoplamento mais profundo, e não é técnico — é **de modelo**:

- no ML, cada tamanho de calçado vira **um MLB separado** (User Products), e uma
  publicação cria **N anúncios**. Foi disso que nasceu o órfão de 01/08 e o
  módulo `irmaosDaFamilia`;
- o "tipo de anúncio" (`Premium`/`Clássico`) está gravado em
  `canais_marketplace.tipo_anuncio`, com os nomes internos do ML
  (`gold_pro`/`gold_special`) no comentário da migração.

Pergunta: a plataforma nova tem **um** registro por produto com variações
dentro, ou N registros? Essa resposta muda o desenho, não a implementação.

### C6 · Alterar o que está no ar

`definirEstadoDoItem` · `encerrarItem` · `subirFoto` · `definirFotosDoItem` ·
`variacoesDaFoto` · `/api/ml/quadrar-capa`

Pausar, reativar, encerrar, trocar foto.

> **Nenhuma dessas tem evidência de ter funcionado com o código que está no ar
> hoje** — ver `MAPA-001` §6. É a metade arriscada, e ela ainda não foi provada
> numa plataforma só.

### C7 · Taxonomia — categorias e atributos

`recorteDaCategoria` · `atributosObrigatorios` · `atributosForaDaFicha` ·
`criarGuiaTamanhos` · `/api/ml/diagnostico-guias`

O que a plataforma **exige** por categoria, e o guia de tamanhos.

É o mais específico de todos: `DES-001` existe porque a exigência vem do
marketplace, não do Zion. Cada plataforma tem taxonomia própria, e essa é a
parte com menor chance de reaproveitamento.

### C8 · Custo da venda

`consultarTarifaDeVenda` · `/api/ml/custos`

Quanto a plataforma cobra **deste vendedor** — não a tabela pública. Alimenta a
precificação, e um número errado aqui vira preço errado na loja.

### C9 · Vendas e reputação

`buscarPedidosML` · `consultarReputacao` · `/api/ml/vendas`

Pedidos e reputação do vendedor.

---

## 3 · Onde o Mercado Livre vazou para o desenho

Estes são os pontos que vão doer com a segunda plataforma. Todos verificados no
repositório:

| vazamento | onde | por quê é um problema |
|---|---|---|
| `ml_item_id`, `ml_permalink` | `anuncios_gerados` | as duas únicas colunas com nome de plataforma |
| `tipo_anuncio: Premium/Clássico` | `canais_marketplace` | conceito do ML numa tabela genérica |
| `active`, `paused`, `under_review`, `closed` | `status_marketplace` | vocabulário do ML gravado cru — **de propósito**, para não mentir; mas é vocabulário dele |
| `waiting_for_patch`, `forbidden`, `out_of_stock` | `sub_status_marketplace` | idem |
| MLB dentro de `observacoes` | `produto_variantes` | a associação anúncio↔variante não tem coluna |
| "família" / N anúncios por produto | `irmaosDaFamilia`, publicação | é o modelo do ML para calçado |
| `max_size` da capa | `quadrarCapa` | como o ML declara tamanho de foto |

O vazamento de estado (linhas 3 e 4) é **defensável e eu não mexeria**: gravar a
palavra crua do marketplace é o que impede o Zion de afirmar o que ele não
disse. O custo é que "traduzir estado" vira trabalho por plataforma, e isso é
melhor do que um enum nosso que apaga a diferença.

Os demais são dívida de verdade.

---

## 4 · O formulário

Para cada plataforma nova, responda **medindo**, com token na mão:

| # | pergunta | se a resposta for "não tem" |
|---|---|---|
| C1 | como autentica? o token expira ou renova? | bloqueia tudo |
| C2 | lista o catálogo inteiro, paginado? dá para saber se veio completo? | o Zion não pode afirmar completude |
| C3 | devolve estado + sub-estado + estoque + capa? | a coluna fica `NULL` — e `NULL` já significa "não sabemos" |
| C4 | expõe infrações por API? com remédio? | a priorização perde o eixo principal |
| C5 | um registro por produto ou N por variação? | **muda o desenho**, não o código |
| C6 | pausar / reativar / encerrar / trocar foto? | vira leitura-só, e isso é um produto diferente |
| C7 | categorias e atributos obrigatórios por API? | `DES-001` não se aplica |
| C8 | tarifa deste vendedor, não a pública? | a precificação fica cega |
| C9 | pedidos e reputação? | o painel perde uma aba |

Uma plataforma que responde C1–C3 já entrega o retrato da loja — que é a metade
**provada** do Zion hoje. C5 e C6 são a metade arriscada, e ela ainda não foi
exercida nem no ML.

---

## 5 · A ordem que eu recomendo, e o porquê

1. **Provar a escrita no Mercado Livre primeiro.** `MAPA-001` mostra que nenhum
   caminho de escrita no ML tem evidência de funcionar com o código atual.
   Abrir a segunda frente agora produz dois conjuntos de suposições não
   testadas em vez de um.

2. **Não projetar a abstração em branco.** Com uma plataforma você inventa o que
   varia; com duas você observa. `capabilities/marketplace` é a prova do custo
   de abstrair cedo: 103 linhas, nenhum chamador, e o único conceito que expõe
   é do ML.

3. **Quando a segunda vier, extraia a interface do que doer** — e trate C5 como
   decisão de desenho, não de implementação. Se o modelo de variação for
   diferente, nenhuma camada de adaptação conserta isso escondendo.

4. **A dívida barata de pagar antes:** renomear `ml_item_id` → `item_id_externo`
   e `ml_permalink` → `permalink_externo`. É aditivo (coluna nova + backfill +
   remoção depois), e é o lado seguro da defasagem — ao contrário de restrição.
   Não é urgente; é só barato agora e caro quando houver duas plataformas.

---

## 6 · O que este documento NÃO diz

Não diz como Shopee ou TikTok Shop autenticam, publicam, ou se expõem
infrações. **Eu não medi essas APIs**, e escrever isso de memória seria
exatamente o erro que custou duas tardes em 02–03/08.

As colunas do formulário da §4 estão vazias de propósito. Elas se preenchem com
token na mão, e cada resposta vale mais que qualquer suposição minha.
