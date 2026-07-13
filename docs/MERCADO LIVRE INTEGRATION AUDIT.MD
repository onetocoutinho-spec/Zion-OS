# MERCADO LIVRE INTEGRATION AUDIT

> Auditoria técnica da integração com o Mercado Livre no Zion OS. **Somente análise — nada foi implementado.** Base: branch `fix/staging-stabilization`, código real do repositório. Toda afirmação de estado vem de arquivo/linha; recomendações estão separadas dos fatos.

## Resumo executivo

A integração com o Mercado Livre está **funcional para o caminho "conectar → importar → publicar (clássico) → ver vendas"**, com o **token do cliente 100% server-side** (corrigido na Etapa 1) e uma boa modelagem de catálogo (família/User Products → produto + variações + anúncio por MLB, com SKU↔MLB preservado). É um **MVP de integração**, não um conector de operação contínua.

Os três buracos que mais pesam:
1. **Publicação real em calçado não funciona** — o builder **User Products** existe (`mlUserProducts.ts` + `criarGuiaTamanhos`) mas **não está ligado** ao fluxo de publicar; a rota monta só o modelo **clássico**, que o ML **rejeita** na categoria MLB273770 (a conta principal da Chinelaria).
2. **Não há sincronização de preço/estoque/status** — a integração **só cria e só lê**. Não existe **update de volta ao ML** (nenhum `PUT /items`), então preço/estoque divergem entre Zion↔ML após publicar, e venda não desconta estoque.
3. **Publicação sem fila nem idempotência** — síncrona, 1-a-1, disparada do navegador → não escala e pode **duplicar anúncio**.

Além disso: **sem webhooks** (o estado do ML — pausado/vendido/pergunta — só é conhecido re-importando à mão), **sem retry/backoff/rate-limit** nas chamadas ao ML, e **sem logs persistidos**.

**Veredito:** pronto para operar 1 conta em fluxo assistido; **não** pronto para publicar calçado de verdade nem para operação multi-conta/escala sem os itens de fila, User Products e sincronização.

---

## O que está PRONTO (funciona)

| Área | Estado | Onde |
|------|--------|------|
| **OAuth — início** | ✅ `GET /api/ml/autorizar` monta a URL de autorização (client_id público; `state=clienteId`). | `src/app/api/ml/autorizar/route.ts` |
| **OAuth — callback** | ✅ `POST /api/ml/conectar` troca `code`→tokens (`trocarCodigoPorToken`), autoriza o cliente (`exigirAcessoAoCliente`) e **salva o refresh_token no canal, server-side**. Não devolve token ao browser. | `conectar/route.ts`, `canalServidor.ts` |
| **Renovação de token** | ✅ `renovarToken` (refresh_token grant); rotacionado e persistido no servidor a cada chamada. | `mercadolivre.ts:68` |
| **Importar anúncios** | ✅ `buscarAnunciosDoVendedor` (lista ids paginado + multiget 20, teto 500) → agrupa por **família/User Products** → cria produtos + variações + `anuncios_gerados` (1 por MLB) + imagens, tudo em **lote**. Idempotente: modo "novos" (dedup por MLB) e "substituir" (apaga+reimporta). Falha parcial tolerada. | `importarAnunciosML.ts`, `mercadolivre.ts:314` |
| **Vendas / métricas** | ✅ `buscarPedidosML` (`/orders/search` status=paid, `date_desc`, teto 300) → total, taxas (`sale_fee`), itens/SKU. Alimenta o dashboard. | `mercadolivre.ts:173`, `vendasML.ts` |
| **Criar anúncio (modelo clássico)** | ✅ `montarItemML` (builder puro) → `POST /items` (`criarItem`), com `SELLER_SKU`, `EMPTY_GTIN_REASON` sem EAN, `shipping me2` grátis, `variations` SIZE/COLOR. Dry-run local para revisão. | `mlPayload.ts`, `publicacaoML.ts`, `publicar/route.ts` |
| **Previsão de categoria** | ✅ `preverCategoria` via `/sites/MLB/domain_discovery/search` (heurística por título). | `mercadolivre.ts:100` |
| **Guia de tamanhos (SIZE_GRID)** | ✅ `criarGuiaTamanhos` (`POST /catalog/charts`, FOOT_LENGTH em cm ±0,2, BR_SIZE). | `mercadolivre.ts:374` |
| **Builder User Products** | ✅ `montarItensUserProducts` (1 item por tamanho, mesmo `family_name`, SIZE_GRID_ID/ROW_ID, IDs reais de gênero/footwear). | `mlUserProducts.ts` |
| **Segurança do token** | ✅ `refresh_token` nunca no navegador; lido/rotacionado só no servidor via RLS; segredos do app só no `.env`. | `canalServidor.ts`, rotas ML |

---

## O que está PARCIAL

| Item | O que falta | Onde |
|------|-------------|------|
| **Publicação User Products** | O builder e a guia **existem mas NÃO estão ligados**: `publicacaoML`/`publicar/route` só chamam `montarItemML` (clássico). Nada chama `precisaUserProducts`/`montarItensUserProducts`/`criarGuiaTamanhos`. Em MLB273770 o ML rejeita o payload clássico. | `publicacaoML.ts`, `mlUserProducts.ts` |
| **Publicação em escala** | Síncrona, 1-a-1, disparada do navegador; sem fila, sem chave de idempotência. | `publicacaoML.ts` |
| **Categoria** | Só heurística por título (`domain_discovery`); se falhar → `422`. Não há **de-para ERP→category_id** persistido nem validação contra `GET /categories/{id}/attributes`. | `publicar/route.ts`, `mercadolivre.ts` |
| **Estado do anúncio no banco** | `anuncios_gerados.status` guarda `publicado` + `ml_item_id`/`ml_permalink`, mas **não** reflete o status real do ML depois (ativo/pausado/fechado/vendido). | migração 004/009 |
| **Resiliência das chamadas ML** | `renovarToken`/`criarItem`/imports **sem retry/backoff**; sem tratamento de **429 (rate limit)** — o `provedorIA` tem, o cliente ML não. | `mercadolivre.ts` |

---

## O que está QUEBRADO ou AUSENTE

| Item | Situação | Impacto |
|------|----------|---------|
| **Atualização de preço/estoque no ML** | **AUSENTE** — nenhum `PUT /items` / update. A integração só **cria** e **lê**. | Após publicar, mudanças de preço/estoque no Zion **não** propagam; venda **não** desconta estoque no ML. |
| **Sincronização contínua (Zion↔ML)** | **AUSENTE** — import é one-shot manual; sem job de sync. | Estado diverge; requer re-importar à mão. |
| **Webhooks / notificações do ML** | **AUSENTE** — sem rota de callback (`orders`, `items`, `questions`, `messages`). | Zion não sabe de venda/pausa/pergunta em tempo real. |
| **Pausar / reativar / excluir anúncio** | **AUSENTE** no SaaS. | Sem gestão de ciclo de vida do anúncio. |
| **Auto-correção de anúncio pausado** | **AUSENTE** no SaaS (existe só diagnóstico read-only no *toolkit Python* fora do repo). | Anúncio pausado por erro fica parado até intervenção manual. |
| **Idempotência de publicação** | **AUSENTE** — sem `external_id`/dedup antes do `POST /items`. | Reenvio/duplo-clique pode **duplicar anúncio** (penalizado pelo ML). |
| **Multi-conta ML por cliente + estoque central** | **AUSENTE** — `canais_marketplace` é 1 canal por (cliente, marketplace). | Não atende operador com N contas ML. |
| **Perguntas/mensagens do ML** | **AUSENTE**. | Sem SAC integrado. |
| **Ledger de custo/uso e auditoria de alteração** | **AUSENTE** para os fluxos ML. | Sem trilha do que mudou/quanto custou. |
| **Logs estruturados** | **AUSENTE** — erros do ML sobem como `Error`/aviso na UI; nada é persistido nem logado no servidor. | Diagnóstico difícil em produção. |

---

## Lista de arquivos relacionados

**Cliente/adaptador ML (server-only):**
- `src/lib/marketplaces/mercadolivre.ts` — OAuth (`trocarCodigoPorToken`, `renovarToken`), `preverCategoria`, `criarItem`, `buscarPedidosML`, `buscarAnunciosDoVendedor`, `criarGuiaTamanhos`, `extrairErro`.
- `src/lib/marketplaces/mlPayload.ts` — builder **clássico** (`montarItemML`, `listingTypeId`, mapa de atributos).
- `src/lib/marketplaces/mlUserProducts.ts` — builder **User Products** (não ligado ao fluxo).
- `src/lib/marketplaces/canalServidor.ts` — leitura/gravação do canal + token no servidor (RLS).

**Rotas de API (`src/app/api/ml/*`):**
- `autorizar/route.ts` (GET) · `conectar/route.ts` (POST) · `publicar/route.ts` (POST) · `vendas/route.ts` (POST) · `importar-anuncios/route.ts` (POST).

**Serviços (orquestração no navegador):**
- `src/lib/services/publicacaoML.ts` — dry-run local + publicar via API.
- `src/lib/services/vendasML.ts` — puxa vendas + calcula lucro (cruza custo por SKU).
- `src/lib/services/importarAnunciosML.ts` — mapeia e grava produtos/variações/anúncios/imagens.
- `src/lib/services/canaisMarketplace.ts` — visão **pública** do canal (sem token) para o navegador.
- `src/lib/supabase/sessao.ts` — header `Authorization: Bearer` para as rotas.

**Telas:**
- `src/app/cliente/conectar-ml/page.tsx` (OAuth) · `src/app/cliente/configuracoes/page.tsx` (status do canal) · `src/app/esteira/aprovacoes/page.tsx` (revisão/publicação) · vendas em `/cliente/vendas` e `/vendas`.

**Config:** `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_REDIRECT_URI` (server-only, `.env.example`).

---

## Tabelas no banco

| Tabela | Papel na integração ML | Migração |
|--------|------------------------|----------|
| `canais_marketplace` | Conexão do cliente: `refresh_token`, `seller_id`, `tipo_anuncio`, `ativo`. `unique (cliente_id, marketplace)`. RLS: equipe (009) + cliente (011). | 009 / 011 |
| `anuncios_gerados` | Anúncio produzido/importado: `status`, `marketplace`, `origem`, `anuncio` (jsonb), **`ml_item_id`**, **`ml_permalink`** (add na 009). | 004 / 009 |
| `produtos` / `produto_variantes` | Catálogo central alimentado pela importação (SKU↔MLB por tamanho). | 001 |
| `imagens_produto` | Fotos reais importadas do ML (bucket Storage). | 001 / 010 |
| `anuncio_variantes` / `precificacao_variantes` | Existem (001) mas **a integração ML não as popula** — o publish lê `anuncio.variacoes` (jsonb), não `anuncio_variantes`. | 001 |

> **Ausentes** (não existem): tabela de **eventos/webhooks**, **fila de publicação**, **histórico de sincronização de preço/estoque**, **log de chamadas ML**.

---

## Riscos

| # | Risco | Gravidade |
|---|-------|-----------|
| R-ML1 | **Publicar calçado real falha** (User Products não ligado) — bloqueia a operação da conta principal. | 🔴 Alto |
| R-ML2 | **Anúncio duplicado** (publish sem idempotência). | 🔴 Alto |
| R-ML3 | **Overselling / preço errado** — sem sync de estoque/preço Zion↔ML após publicar. | 🔴 Alto |
| R-ML4 | **Estado do ML desconhecido** (sem webhooks) → decisões com dado velho. | 🟠 Médio |
| R-ML5 | **Falhas em importação grande** (500 itens, multiget) por **rate limit/429 sem backoff**. | 🟠 Médio |
| R-ML6 | **Categoria prevista errada** (heurística por título) → anúncio na categoria errada. | 🟠 Médio |
| R-ML7 | **Diagnóstico difícil** — sem logs persistidos das chamadas/erros ML. | 🟡 Baixo |
| R-ML8 | **Token/OAuth**: `renovarToken` sem retry; se o refresh falhar, o fluxo quebra sem fallback. | 🟡 Baixo |

---

## Conexão com o futuro "Produto Mestre" do Zion

O **Produto Mestre** (produto canônico único que abastece N marketplaces) já tem **fundação** no modelo atual: `produtos` (pai) → `produto_variantes` (SKU) → `anuncios_gerados` (1 por canal/MLB), com o **SKU como chave transversal** ERP↔ML↔(futuros canais). A importação do ML **já converte família/User Products em 1 produto com variações**, ou seja, já "colapsa" o ML no catálogo central.

**O que falta para o Produto Mestre virar realidade (a partir da integração ML):**
1. **Contrato `MarketplaceAdapter`** — hoje tudo é ML-específico. O Produto Mestre precisa de uma interface (`publicar/atualizar/pausar/importar/sincronizar/webhook/limites`) com `MercadoLivreAdapter` como 1ª implementação. Sem isso, cada canal novo reescreve tudo.
2. **Sincronização bidirecional de preço/estoque** — o Produto Mestre é a **fonte da verdade**; precisa **propagar** preço/estoque para cada canal (o `PUT /items` ausente) e **receber** vendas (webhooks) para debitar estoque central. É o coração do valor multicanal.
3. **Vínculo canônico Produto↔Anúncio por canal** — `anuncio_variantes` deveria ligar cada variante do Produto Mestre ao `ml_item_id`/variação-id do canal (hoje o vínculo vive no jsonb `anuncio` + `ml_item_id` no nível do anúncio, não normalizado por variante).
4. **De-para de categoria/atributos por canal** persistido (ERP→category_id ML→category Shopee…), com a fonte da verdade sendo `GET /categories/{id}/attributes`.
5. **Estado unificado do anúncio** (ativo/pausado/erro/vendido) sincronizado por webhook, para o Produto Mestre saber a saúde em cada canal.

Ou seja: a integração ML atual é um **bom primeiro adaptador**, mas foi construída como **fluxo direto**, não como **adaptador plugável de um catálogo mestre**. O maior trabalho para o Produto Mestre é **extrair o adaptador** e **adicionar sincronização + webhooks**.

---

## Próximos passos recomendados (ordem)

1. **Ligar User Products no publish** (desbloqueia publicar calçado real) — escolher clássico × User Products por categoria (`precisaUserProducts`), criar a guia (`criarGuiaTamanhos`) e publicar cada item da família. *(Fecha R-ML1.)*
2. **Enfileirar a publicação + idempotência** — mover `publicarNoML` para fila+worker (reusar o padrão de `fila_otimizacao_produto`), com chave `(cliente, produto, marketplace)` e checagem de `ml_item_id` existente. *(Fecha R-ML2; escala.)*
3. **Sincronização de preço/estoque** — implementar `PUT /items` (e variações) e um job/gatilho que propaga mudanças do Produto Mestre → ML; receber vendas para debitar estoque. *(Fecha R-ML3.)*
4. **Webhooks do ML** — rota de callback (`orders_v2`, `items`, `questions`) + tabela `webhook_events`, para status/venda/pergunta em tempo real. *(Fecha R-ML4.)*
5. **Resiliência** — retry/backoff + tratamento de 429 no cliente ML; logs estruturados por chamada. *(Fecha R-ML5, R-ML7, R-ML8.)*
6. **Extrair `MarketplaceAdapter`** (com o ML como 1ª implementação) — pré-requisito do Produto Mestre e de novos canais.
7. **De-para de categoria/atributos** persistido + validação por `categories/{id}/attributes`. *(Fecha R-ML6.)*

---

## Checklist objetiva — correções e tarefas da próxima sprint

**Desbloqueio (P0/P1):**
- [ ] Ligar **User Products** por categoria no `publicar/route.ts` (usar `precisaUserProducts` → `criarGuiaTamanhos` → `montarItensUserProducts` → publicar N itens da família).
- [ ] Testar **1 item real de calçado** (MLB273770) ponta a ponta, controlado.
- [ ] **Idempotência de publicação**: não publicar se já houver `ml_item_id` para `(cliente, produto, marketplace)`; chave de idempotência.
- [ ] **Fila de publicação** (worker + cron, reusando o padrão do `fila_otimizacao_produto`).

**Sincronização (P1):**
- [ ] `atualizarItemML` (`PUT /items` + variações) para preço/estoque.
- [ ] Gatilho de propagação Produto Mestre → ML ao alterar preço/estoque.
- [ ] **Webhooks**: rota `/api/ml/webhook` + tabela `webhook_events` (orders/items/questions).
- [ ] Debitar estoque central ao receber venda (webhook).

**Robustez/observabilidade (P2):**
- [ ] Retry/backoff + tratamento de **429** no cliente ML (`mercadolivre.ts`).
- [ ] **Logs estruturados** por chamada ML (sem token) + persistência mínima de erros.
- [ ] Refletir o **status real do ML** em `anuncios_gerados.status` (via webhook ou sync).
- [ ] **Pausar/reativar/excluir** anúncio no SaaS.

**Fundação Produto Mestre (P2):**
- [ ] Extrair contrato **`MarketplaceAdapter`** (ML como 1ª implementação).
- [ ] Normalizar vínculo **variante↔ml_item_id/variação** em `anuncio_variantes`.
- [ ] Persistir **de-para de categoria/atributos** por canal + validar via `categories/{id}/attributes`.

**Verificação (todas as tarefas):** `npx tsc --noEmit` · `node --test` · `npm run lint` · `npm run build` verdes; testar em **staging** (nunca produção); publicar apenas **item de teste** controlado.

---

*Auditoria gerada sem alterar código. Fatos com `arquivo:linha`; recomendações separadas dos fatos.*
