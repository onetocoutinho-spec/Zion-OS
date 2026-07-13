# 03 — Fluxo Atual (o que o sistema realmente faz)

Fluxos reconstruídos a partir do código, não do desejado. Cada etapa cita o arquivo responsável, entrada, saída, estado no banco e falhas possíveis.

## Visão geral (fato)

```
Cliente conecta o ML (OAuth)  ──►  Importa a base (planilha) OU importa anúncios do ML
        │                                    │
        ▼                                    ▼
  canais_marketplace                 produtos + produto_variantes (+ anuncios_gerados p/ importados)
        │                                    │
        │        ┌───────────────────────────┘
        ▼        ▼
  "Otimizar tudo" ──► fila_otimizacao_produto ──► worker (Cron) ──► roda esteira (IA) ──► anuncios_gerados
                                                                          │ vereditoA10
                                                                          ▼
                                                              aguardando_aprovacao / rascunho
        ┌──────────────────────────────────────────────────────────────┘
        ▼
  Equipe/Cliente aprova ──► publicarNoML (dry-run local → /api/ml/publicar) ──► ML /items ──► ml_item_id/permalink
        │
        ▼
  Vendas (/api/ml/vendas) ──► faturamento, lucro, taxas
```

---

## Fluxo A — Conectar o Mercado Livre (OAuth) — **funcionando**

- **Arquivos**: `src/app/api/ml/autorizar/route.ts` (monta a URL de autorização), `src/app/api/ml/conectar/route.ts` (callback → troca `code` por tokens), `src/lib/services/canaisMarketplace.ts`.
- **Entrada**: cliente clica "Conectar" em `/cliente/conectar-ml`; autoriza na tela do ML.
- **Saída/estado**: `canais_marketplace` recebe `refresh_token`, `seller_id`, `tipo_anuncio` (`unique(cliente_id, marketplace)`), migração 009.
- **Segredo**: `ML_CLIENT_ID/SECRET` só no servidor.
- **Falhas**: `redirect_uri` divergente do app ML; token expirado (renovado no publish).

## Fluxo B — Entrada de produtos

### B1. Importar a base por planilha
- **Arquivos**: `src/lib/services/importacaoProdutos.ts` (459), `importacaoCsv.ts` (348), `importacaoCustos.ts`, com presets de ERP (Bling/Tiny/Magazord).
- **Entrada**: planilha + mapeamento de colunas (manual ou preset).
- **Saída/estado**: `produtos` (pai) + `produto_variantes` (SKU/cor/tamanho/custo/preço/estoque). Grava em **lote** (`criarVarios`, chunk 500 + retry).
- **Falhas**: colunas não mapeadas, SKU duplicado, custo vazio (vira pendência de margem depois).

### B2. Importar anúncios existentes do ML
- **Arquivos**: `src/lib/services/importarAnunciosML.ts` (374), `src/app/api/ml/importar-anuncios/route.ts`.
- **Entrada**: botão "Importar do ML" em `/cliente/produtos`.
- **Processo**: `/users/{id}/items/search` + multiget `/items`; agrupa por **família** (`family_name`/`user_product_id`/título) — 1 produto com variações de tamanho, mas mantém 1 `anuncios_gerados` por MLB (guarda SKU + `ml_item_id`). Importa fotos (`imagens_produto`). Teto ~500 por importação. Modo "novos" (dedup) e "substituir".
- **Saída/estado**: `produtos` + `produto_variantes` + `anuncios_gerados` (status `publicado`, `ml_item_id`/`ml_permalink`).
- **Falhas conhecidas**: custo vem **0** (o ML não expõe) → cliente completa depois; loop um-a-um dava "Failed to fetch" (resolvido com gravação em lote).

## Fluxo C — Otimizar (a esteira de IA) — **o coração do produto**

### C1. Enfileirar
- **Arquivos**: `src/lib/services/filaOtimizacaoProduto.ts`, tela `/cliente/produtos` ("Otimizar tudo").
- **Estado**: insere/atualiza `fila_otimizacao_produto` (status `pendente`, `unique(produto_id)`).

### C2. Worker consome e roda a esteira
- **Arquivos**: `src/app/api/otimizar/worker/route.ts` (Cron/min, `service_role`), `src/lib/agentes/esteira.ts`, `src/lib/contexto.ts` (monta o contexto: produto + variações + tabela de medidas), `src/lib/agentes/provedorIA.ts`.
- **Entrada**: itens `pendente` (lote de `CONCORRENCIA=1`).
- **Processo**: monta contexto → `chamarIAEstruturada` (Gemini/Claude) com `ESQUEMA_ANUNCIO` → parseia JSON (retry até 3x se truncar) → calcula `passouA10 = vereditoA10 === "aprovado" && pendencias.length === 0`.
- **Saída/estado**: grava `anuncios_gerados` com `status = aguardando_aprovacao` (passou A10) ou `rascunho`; atualiza a fila para `concluido` (ou `pendente`/`erro`).
- **Falhas**: 429/quota → item volta pra `pendente` sem gastar tentativa; erro → retry até 3, depois `erro`; worker cai → item preso "processando" >10min volta pra fila.
- **Custo**: **não registrado** (sem tokens/modelo persistidos) — ver [04](./04-PROBLEMAS-E-RISCOS.md) item 4.

### C3. Modo síncrono / ferramentas do portal
- **Arquivos**: `api/agentes/esteira` (uma passada on-demand), `api/agentes/executar` (1 agente isolado → ferramentas `/cliente/otimizar`).
- **Cota**: `quota_esteira()` (migração 006) compara `limite_esteira_mes` × execuções do mês.

## Fluxo D — Aprovar — **trava de qualidade existe**

- **Arquivos**: telas `/esteira/aprovacoes` (equipe) e `/cliente/*`; `src/lib/services/anunciosGerados.ts`.
- **Estado**: `anuncios_gerados.status` transita `rascunho → aguardando_aprovacao → aprovado → publicado`. Guarda `notaDiagnostico`, `vereditoA10`, `qtdPendencias`, `motivoVeredito`.
- **Limitação**: mostra veredito + pendências, mas **não** um diff campo-a-campo "atual × sugerido × risco × confiança" com aprovação por tipo. Ver [07](./07-WIREFRAMES-TEXTUAIS.md) e [04](./04-PROBLEMAS-E-RISCOS.md) item 5.

## Fluxo E — Publicar no ML — **funciona, mas frágil para escala**

- **Arquivos**: `src/lib/services/publicacaoML.ts` (orquestra no **cliente**), `src/app/api/ml/publicar/route.ts` (servidor), `src/lib/marketplaces/mlPayload.ts` (builder).
- **Processo**:
  1. `montarPreviewML` monta o payload **localmente** (dry-run) — a equipe revê.
  2. Se `go=true`: lê `canal.refreshToken` **no cliente**, POST `/api/ml/publicar` com `{payload, refreshToken, go, titulo}`.
  3. Servidor renova token, prevê categoria se faltar, `criarItem` em `/items`.
  4. Persiste `ml_item_id`/`ml_permalink` em `anuncios_gerados`; salva o `refresh_token` rotacionado.
- **Estado**: `anuncios_gerados.status = publicado` + `ml_item_id`/`ml_permalink`.
- **Falhas / riscos**:
  - Síncrono, **1-a-1, do navegador** → 1.000 anúncios = 1.000 chamadas; sem fila; sem idempotência → **risco de duplicar** se reenviar. (Crítico — [04](./04-PROBLEMAS-E-RISCOS.md) item 2.)
  - `refresh_token` passa pelo browser (Alto — item 3).
  - Categoria de calçado (MLB273770) exige **User Products**; o builder atual é clássico → o ML **rejeita** `title`+`variations`. `mlUserProducts.ts` existe mas não está ligado (Alto — item 7).

## Fluxo F — Vendas / conciliação

- **Arquivos**: `src/app/api/ml/vendas/route.ts`, `src/lib/services/vendasML.ts`, telas `/vendas` e `/cliente/vendas`.
- **Entrada**: pedidos pagos reais do ML.
- **Saída**: faturamento, lucro líquido (cruzando custo por SKU), taxas, ticket médio, mais vendidos.
- **Dependência**: custo por SKU preenchido (importados vêm com custo 0).

## Fluxo G — Auditoria em massa (equipe)

- **Arquivos**: `src/lib/data/auditoriaMassa.ts`, `src/lib/services/auditoriaDaBase.ts`, telas `/auditoria-massa`.
- **Estado**: `importacoes_anuncios` → `auditorias_anuncios` (score 0–100, ABC, prioridade, problemas) → `fila_otimizacao`. Base sólida para a "central de otimização" do [07](./07-WIREFRAMES-TEXTUAIS.md).

## Onde o estado "de verdade" vive (resumo)

| Estado | Tabela |
|--------|--------|
| Empresa/cliente (tenant) | `clientes` |
| Usuário↔papel↔cliente | `perfis` |
| Conexão do canal + refresh_token | `canais_marketplace` |
| Catálogo | `produtos`, `produto_variantes`, `produto_atributos`, `imagens_produto` |
| Anúncio gerado pela IA | `anuncios_gerados` (+ `anuncios`/`anuncio_variantes`) |
| Fila de otimização (servidor) | `fila_otimizacao_produto` |
| Auditoria em massa | `importacoes_anuncios`, `auditorias_anuncios`, `problemas_anuncio`, `fila_otimizacao` |
| Precificação por SKU | `precificacao_variantes` |
| Cota mensal de IA | `clientes.limite_esteira_mes` |
