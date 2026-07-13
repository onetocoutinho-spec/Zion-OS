---
tipo: glossario
area: referencia
aliases: [Glossario, Ubiquitous Language, Linguagem oficial]
---

# 📚 Glossário Oficial

> A **linguagem oficial** (ubiquitous language) da Zion Platform. A definição **canônica** de cada termo vive em [[000-business-domain|000 · Business Domain]] — este glossário **navega** para ela e para as notas-conceito, sem duplicar. Em divergência de nomenclatura, **000 prevalece**.

## Entidades de negócio

| Termo | Definição curta | Dono | Ver |
|-------|-----------------|------|-----|
| **Organização** | Tenant raiz — a agência (ex.: Zion Company). | Zion | [[000-business-domain]] |
| **Cliente** | Empresa-cliente operada pela agência (ex.: Chinelaria Leilane Neves). | Zion + Cliente | [[000-business-domain]] · [[RLS]] |
| **Usuário** | Pessoa autenticada, papel `equipe` ou `cliente`. | Zion (Auth) | [[000-business-domain]] |
| **[[Origem do Produto]]** | De onde o produto vem (5 tipos: Fornecedor, Fabricante, Importador, Distribuidor, Marca Própria). | Origem | [[Origem do Produto]] |
| **[[Catálogo]]** | Lote bruto recebido de uma Origem. | Origem/Zion | [[Catálogo]] |
| **[[Produto Mestre]]** | Representação única e canônica — Fonte da Verdade do marketplace. | Zion | [[Produto Mestre]] · [[001-product-master]] |
| **[[Variante]]** | Derivação vendável (cor/tamanho/voltagem). | Zion + ERP | [[Variante]] |
| **[[SKU Origem\|SKU]]** | Código único da unidade; `sku_origem` é a chave 1ª de conciliação. | Origem/Zion/ERP | [[SKU Origem]] |
| **[[EAN]]** | Código de barras (GTIN), complementar ao SKU. | Origem | [[EAN]] |
| **Preço** | Preço de **venda** por canal. | Zion | [[000-business-domain]] |
| **Custo** | Custo do produto (espelho read-only). | ERP | [[ERP]] |
| **Estoque** | Quantidade disponível (espelho read-only). | ERP | [[ERP]] |
| **Imagem** | Ativo visual (`capa/secundaria/detalhe/medidas/humanizada`). | Zion | [[Produto Mestre]] |
| **SEO** | Inteligência de busca do anúncio. | Zion (A2/A3) | [[IA]] |
| **Categoria** | Classificação Zion × Categoria de Canal (`category_id`). | Zion/Marketplace | [[Mercado Livre]] |
| **Atributo** | Par nome→valor da ficha técnica (filtro de busca). | Zion | [[Produto Mestre]] |
| **[[Listing]]** | Anúncio publicado por canal. | Marketplace (estado) | [[Listing]] |
| **[[Conta Marketplace]]** | Loja conectada de um Cliente (OAuth, server-side). | Zion | [[Conta Marketplace]] |

## Sistemas e contratos

| Termo | Definição curta | Ver |
|-------|-----------------|-----|
| **[[ERP]] (Magazord)** | Fonte da Verdade de estoque/custo/fiscal/nota. | [[ERP]] · [[Magazord]] |
| **[[Marketplace]]** | Plataforma de venda (ML/TikTok/Shopee); dona do estado/pedidos. | [[Marketplace]] |
| **[[Connector SDK]]** | Interface padrão de qualquer integração. | [[Connector SDK]] · [[003-connector-sdk]] |
| **[[Marketplace Adapter]]** | Contrato por canal (regra específica fica no Adapter). | [[Marketplace Adapter]] · [[002-marketplace-adapter]] |
| **[[Marketplace Engine]]** | Runtime que orquestra os adapters. | [[Marketplace Engine]] · [[005-marketplace-engine]] |
| **[[Zion Intake]]** | Capability 000: catálogo → Produto Mestre. | [[Zion Intake]] · [[006-capability-000-zion-intake]] |
| **[[IA\|Workforce A0–A12]]** | Esteira de enriquecimento com trava A10. | [[IA]] |

## Conceitos de plataforma

| Termo | Definição curta | Ver |
|-------|-----------------|-----|
| **Fonte da Verdade** | Regra suprema: cada informação tem **um único** dono. | [[000-business-domain]] · [[Engineering Rules]] |
| **Event Bus** | Backbone de eventos assíncronos, idempotentes, auditáveis. | [[004-event-bus]] · [[Workflow]] |
| **Idempotência** | Reprocessar o mesmo evento não duplica efeito (`idempotency_key`). | [[Marketplace Engine]] |
| **Outbox** | Fato + evento gravados na mesma transação (nunca evento órfão). | [[004-event-bus]] |
| **Dead-letter / Replay** | Falha persistente → dead-letter; replay reprocessa. | [[Marketplace Engine]] |
| **Fan-out** | Publicar 1 Produto Mestre em N canais/contas. | [[Marketplace Engine]] |
| **Pré-Produto** | Staging antes de virar Produto Mestre (conciliação por SKU). | [[Zion Intake]] |
| **[[Versionamento\|Versão / Histórico]]** | old→new, autor/agente, undo. | [[Versionamento]] |
| **[[RLS]]** | Isolamento multiempresa deny-by-default. | [[RLS]] |
| **[[Workflow]]** | Orquestração de etapas (enriquecimento, promoção, publicação). | [[Workflow]] |

---
◀ [[Home]]
