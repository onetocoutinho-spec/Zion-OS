---
tipo: conceito
area: integracoes
aliases: [ML, Mercado Livre Integration]
---

# Mercado Livre

> Primeiro [[Marketplace Adapter|Adapter]] de marketplace (Fase 2). **Não recriar** a integração existente — **envelopá-la** no [[Marketplace Adapter|Adapter]]/[[Marketplace Engine|Engine]] e fechar as lacunas da auditoria.

**Fonte da verdade (design):** [[002-marketplace-adapter|002]] · [[005-marketplace-engine|005]] · Fase 2 do [[007-execution-roadmap|Roadmap]]

## Já existe (reaproveitar)

- OAuth server-side + refresh token (`trocarCodigoPorToken`, `renovarToken`).
- `criarItem` (POST /items), `preverCategoria`, `criarGuiaTamanhos` (/catalog/charts).
- Importação (`buscarAnunciosDoVendedor`) e vendas (`buscarPedidosML`).
- Builder de **User Products** (`mlUserProducts.ts`) — existe mas **NÃO ligado** ao publish.

## Lacunas a fechar (auditoria)

- Publicação síncrona 1-a-1 disparada do browser → migrar para **assíncrona via [[Marketplace Engine|Engine]]**.
- **Sem idempotência** → risco de anúncio duplicado (R-ML2).
- **User Products não conectado** ao publish.
- **Sem PUT preço / PUT estoque** → overselling/desatualização.
- **Sem webhooks** → estado/venda não reconciliados.

> [!important] Próxima peça crítica (operação viva)
> A categoria de calçado da Chinelaria (**MLB273770**) usa o modelo **User Products** — o ML rejeita o payload clássico. A estrutura já existe (`mlUserProducts.ts` + `criarGuiaTamanhos`); falta **ligá-la ao fluxo de publicar** e testar 1 item real. Depende da normalização de tamanhos da [[Variante]].

## PRs

[[PRs|PR-011..PR-016]] (Adapter, User Products, PUT preço, PUT estoque, webhooks, assíncrono).

Ver também: [[Marketplace Engine]] · [[Listing]] · [[TikTok Shop]] · [[Shopee]]

---
◀ [[Integrações]] · [[Glossário]]
