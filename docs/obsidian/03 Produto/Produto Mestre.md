---
tipo: conceito
area: produto
aliases: [Produto, Product Master, Produto canônico]
---

# Produto Mestre

> A **representação única e canônica** de um produto na Zion, independente de origem, ERP e marketplace. **É a Fonte da Verdade do marketplace** (conteúdo, preço de venda, identidade e estado consolidado do anúncio).

**Fonte da verdade (design):** [[001-product-master|001 · Product Master]] · **Domínio:** [[000-business-domain|000 · Business Domain]]

## Em uma frase

1 verdade que abastece N canais, conciliada por [[SKU Origem]].

## Posse da informação

- **Dono:** Zion (conteúdo + preço de venda).
- **Pode alterar:** Equipe, Cliente (Portal), Agente [[IA]] — sempre gerando [[Versionamento|Versão]].
- **Apenas consulta:** [[ERP]] e [[Mercado Livre|Marketplace]] (não escrevem conteúdo/preço de venda).

## Relacionamentos

- Pertence a 1 Cliente; referencia 1 [[Origem do Produto]] e (revenda) 1 [[Catálogo]].
- Tem N [[Variante|Variantes]], N Imagens, N Atributos, N [[Listing|Listings]], N [[Versionamento|Versões]].

## Eventos ([[004-event-bus|Event Bus]])

- **Emite:** `produto_mestre.criado`, `produto_mestre.atualizado`, `variante.atualizada`, `preco.definido`.
- **Consome:** `intake.pre_produto.pronto`, `erp.estoque.mudou`, `marketplace.listing.estado`.

## No banco

Modelo persistido: [[Modelo de Dados — Produto Mestre]] · Compliance: [[010-database-compliance|010]].

Ver também: [[Variante]] · [[EAN]] · [[Workflow]] · [[Fluxo Produto Mestre.canvas|Canvas]]

---
◀ [[Produto]] · [[Glossário]]
