# INC-001 — Produto parcialmente sem peso é apresentado como "com peso"

```
Status:      Aberto — registrado, NÃO corrigido
Detectado:   2026-07-28, durante o desenho do EXP-004
Severidade:  perda de informação na leitura; sem corrupção de dado
Correção:    não autorizada neste ciclo (o EXP-004 não podia tocar produção)
```

## O defeito

`listarProdutosComPeso` agrega o peso do produto pelo **MAIOR entre suas variantes**:

```ts
// src/lib/services/pesoDeProduto.ts:55
const maior = (campo) => vs.reduce((acc, v) => Math.max(acc, Number(v[campo]) || 0), 0);
```

e `contarComPeso` filtra `pesoGramas > 0`:

```ts
// src/modules/catalog/domain/familiaDeProduto.ts:128
return produtos.filter((p) => p.pesoGramas > 0).length;
```

**Consequência:** um produto em que só *algumas* variações têm peso reporta
`pesoGramas > 0` e é contado como completo. O estado parcial desaparece.

A agregação por MAIOR está **certa para o frete** — a caixa que sai é a maior. O
defeito não é a regra; é usá-la também como resposta para "tem peso?".

## Impacto medido na base de produção

| produto | variações | sem peso | a tela mostra |
|---|---|---|---|
| Chinelo Havaianas Masculino Top Max Comfort Original | 18 | **9** | "com peso" |
| Rasteira Feminina Vizzano 6371.1005 | 39 | **3** | "com peso" |

São **12 variações sem peso invisíveis** na tela `/cliente/peso`. O lojista não tem
como chegar até elas: elas não aparecem na contagem, não aparecem na lista e não há
filtro que as revele.

## Por que importa além da tela

Sem peso não há frete, e sem frete o preço mínimo é pendência. Um produto parcial
**calcula preço** (pela maior variação) enquanto algumas variações continuam sem
base de frete própria.

## Agravante já conhecido

`definirPesoDosProdutos(clienteId, produtoIds[], …)` grava em **todas** as variações
dos produtos indicados. Aplicado a um produto parcial, **sobrescreve** as que já
tinham peso. Na Vizzano seriam 36 pesos bons perdidos — e peso **não tem AIL**
(`atualizarVariantesBulk` é cego para o observador), então a perda é irreversível.

Decisão de produto já tomada: **preencher ausente ≠ substituir existente.**

## O que NÃO fazer como correção rápida

Trocar MAX por MIN inverteria o defeito: o frete passaria a ser calculado pela menor
caixa, e o preço mínimo sairia **abaixo** do que se paga. A regra do frete está certa.

## Direção sugerida (não implementada, não autorizada)

A representação mínima já validada no EXP-004 é o par por produto:

```
variacoesTotais · variacoesSemPeso
```

Dele derivam quatro situações — `completo · ausência total · ausência parcial ·
sem grade` — e **`sem grade` nunca equivale a `sem peso`** (3 produtos da base têm
zero variações).

Isso é leitura adicional, não substituição da existente. O EXP-004 exercitou essa
representação em 39 resoluções sem erro.

## Referência

`docs/engineering/experiments/EXP-004-consulta-linguagem-natural.md`
