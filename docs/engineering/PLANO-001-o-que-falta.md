# PLANO-001 — O que falta, medido

```
Data:    2026-08-02
Base:    Chinelaria Leilane Neves — 781 anúncios no ML, 80 produtos no Zion
Origem:  a primeira leitura completa da conta, depois que sete defeitos mudos caíram
```

Este plano não é uma lista de ideias. Cada linha tem um número medido atrás, e
o que **não** foi medido está marcado como tal.

---

## O retrato, em três números

```
28 vendas no total
533 anúncios no ar sem vender nenhuma      (de 544 ativos)
535 de 781 capas fora do padrão do ML      (68%)
656 dos 781 em Premium (gold_pro)
```

Lidos numa execução só, em 02/08/2026, com `medir` — que não grava nada.

A leitura dos três juntos é uma história coerente: **foto fora do padrão → o ML
tira exposição → o anúncio não aparece → não vende — e ela paga comissão
Premium por isso.** É hipótese, não prova: o ML não confirma a cadeia. Mas os
três números são medidos, e nenhum outro caminho os explica ao mesmo tempo.

---

## A — O que só a lojista pode fazer

Nada aqui é software. Estão em ordem de risco, não de esforço.

### A1 — Os 7 anúncios bloqueados `forbidden`

```
MLB4815179721  MLB4815162875  MLB7048338914  MLB7048338934
MLB7048338956  MLB4820506463  MLB4820493495
```

Bloqueio é violação de política. É o único item que pode custar a **conta**, não
o anúncio — e reincidência é o que pesa. Abrir cada um no painel do ML, ler a
acusação, corrigir ou encerrar.

**Por que não automatizo:** a API não diz qual política foi violada. Só o painel
diz, e a decisão de corrigir ou encerrar é dela.

### A2 — As 535 capas fora do padrão

O maior ganho de receita disponível, e é trabalho de fotografia.

As piores, medidas pelo `max_size` do próprio ML:

```
MLB4819774959  165x93
MLB7046926898  165x93
MLB7046926910  165x93
MLB7048846974  185x90
```

`165x93` é tamanho de ícone. O ML pede quadrada e ≥ 1200 de lado.

**O que o software faz por ela:** a lista priorizada (B2). O que não faz: a foto.

### A3 — A foto Marrom que não existe

O `Papete Slide Modare 7208.101 Nobuck` foi publicado com foto de outra cor.
A foto Marrom não está no ML, nem no bucket, nem no ERP. **Alguém precisa
fotografar** — nenhum código resolve.

### A4 — Os 60 anúncios sem estoque

`out_of_stock` é fato, não defeito: ou repõe, ou encerra. Vale conferir se estão
zerados **na loja** ou só no ML — o Zion tem o estoque do ERP e dá para cruzar.

### A5 — Os 6 conflitos de atributo

Anúncios do mesmo produto discordam sobre o mesmo campo. O Zion não gravou
nenhum deles, de propósito: escolher seria decidir por ela.

### A6 — Premium vs Clássico

656 anúncios em `gold_pro` pagando comissão de Premium. 533 nunca venderam.
Rebaixar os que não vendem há meses é decisão de margem, e agora a precificação
sabe o tipo de cada um.

---

## B — O que o software precisa fazer

### B1 — O silêncio de saúde e catálogo *(defeito meu, higiene)*

`health` e `catalog_listing` foram pedidos e vieram VAZIOS. Na tela, a linha só
aparece quando o número é maior que zero — então **"não veio" e "é zero" ficam
idênticos**. É o mesmo defeito mudo do dia inteiro, agora na apresentação.

Pequeno, e precisa vir antes de qualquer decisão baseada nesses campos.

### B2 — A lista priorizada das capas

Cruzar, por anúncio: **tamanho da capa × estoque × está no ar × já vendeu**.
Devolve "refotografe estes 20 primeiro" em vez de "535 estão ruins".

535 fotos é trabalho de semanas; os 20 que concentram estoque e exposição são
trabalho de uma tarde. Sem a ordem, ela não começa.

### B3 — A descrição de verdade

**O `781 sem descrição` NÃO vale.** O campo `descriptions` da API de itens é
legado e devolve vazio mesmo quando existe descrição; o texto real está em
`/items/{id}/description`.

Enquanto não buscarmos de lá, o número é ruído — e ruído com cara de diagnóstico
é pior que ausência.

### B4 — DES-003: a foto por cor

A associação foto↔cor **nunca existiu**. É a causa de *"o título e/ou as fotos
não correspondem ao produto"* no painel, e do anúncio Marrom com foto Nude.

Desenhado, não implementado. Precisa de aprovação para **quatro** tipos de
imagem, não três — o infográfico não cabe em nenhum dos três originais.

### B5 — Guardar o original, não a redução

O Zion guarda a variante `-O` do CDN: **500px**. O original da lojista é maior.
Se o Estúdio IA ou uma republicação usar o que está guardado, sobe imagem
degradada — e degradada é exatamente o que o ML está punindo.

### B6 — O bucket vazio e as URLs que vão morrer

As fotos no banco são URLs do CDN do ML, apontando para anúncios que estão sendo
encerrados. O bucket próprio existe e está **vazio**. Quando um anúncio morre, a
URL morre junto.

### B7 — `imagens_produto` sem índice único

Não há restrição em `(produto_id, tipo_imagem)`. Uma segunda "Principal" entra
calada. É pré-requisito de qualquer lote de imagem — e é **DDL**, precisa de
autorização.

### B8 — A tela de medidas que não muda nada

`medidasDaMarca` lê só a lista do código. A tela de `/cliente/medidas`, que a
lojista preenche, **não afeta a publicação**. Uma tela que não muda nada é pior
que nenhuma.

### B9 — Os 11 MLBs órfãos

O Zion tem 11 MLBs que a leitura completa de 781 não devolveu — anúncios
apagados da conta. Ficam `null` de propósito: ausência não é encerramento.
Decidir o que fazer com eles é decisão de modelo, não de código.

### B10 — O mojibake nos nomes

`Zãper`, `Gorgurã£o`, `Canelado/elã¡stico`. Resíduo do defeito de encoding da
importação antiga. Cosmético até alguém publicar com esse nome.

---

## C — O que está construído e nunca foi provado

Cada um destes existe, tem portão verde, e **nunca rodou de verdade**:

| o quê | falta |
|---|---|
| Pausar / reativar anúncio | um clique num anúncio real |
| Publicação Zaxy (DES-004) | uma publicação real |
| Irmãos da família (os MLBs extras) | uma publicação de família |
| Auto-cadastro | nunca validado em produção |

---

## D — A parede que nenhum conserto de catálogo derruba

**Billing não existe. Zero linhas.**

Se "pronto" inclui cobrar, isso não sai de mais nada nesta lista. Se "pronto" é
"a lojista opera o catálogo dela sozinha", A e B levam lá.

É a única decisão de escopo que muda a ordem de tudo acima.

---

## O que este plano NÃO afirma

- Que foto ruim **causa** a falta de venda. Os três números são medidos; a
  cadeia entre eles é a explicação mais simples, não uma prova.
- Que os 535 são todos consertáveis. Alguns podem ser do fornecedor.
- Que `health` existe para esta conta. Foi pedido e veio vazio — pode ser
  restrição de API, não ausência de nota.
- Que os 155 `under_review` vêm de uma edição em massa. **Falsificado**: as
  alterações estão espalhadas em pelo menos três dias (88 em 04/07, 87 em 15/07,
  59 em 02/07).
