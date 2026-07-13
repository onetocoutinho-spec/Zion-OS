# 05 — Modelo de Dados: Atual × Sugerido

> **Esboço, não migração.** Nada aqui deve ser aplicado sem revisão. O objetivo é comparar o modelo real com um modelo-alvo de SaaS multiempresa e apontar lacunas.

## Inventário atual (FATO)

### Tabelas base (setup v1.x — `database/_legado/`)
`clientes` · `produtos` · `anuncios` · `agentes` · `tarefas` · `relatorios` · `financeiro` · `execucoes_agentes` · `reunioes` · `pendencias` · `onboardings` · `onboarding_items`

### Tabelas das migrações 001–015 (`database/migrations/`)
| Tabela | Migração | Papel |
|--------|----------|-------|
| `produto_variantes` | 001 | SKU vendável (cor/tamanho/custo/preço/estoque/peso/dimensões) |
| `produto_atributos` | 001 | Ficha técnica dinâmica |
| `categoria_templates` | 001 | Molde por nicho (obrigatórios/recomendados/checklist) |
| `anuncio_variantes` | 001 | Liga variação do produto ↔ variação do anúncio |
| `precificacao_variantes` | 001 | Precificação por SKU (custo, taxas, margem, piso) |
| `imagens_produto` | 001 | Imagens por produto/variação/anúncio (Storage) |
| `importacoes_anuncios` | 002 | Cada carga de base |
| `auditorias_anuncios` | 002 | Score 0–100, ABC, prioridade, problemas |
| `problemas_anuncio` | 002 | Problemas detalhados por auditoria |
| `fila_otimizacao` | 002 | Fila da equipe (auditoria em massa) |
| `execucoes_lote` | 002 | Execução de agente por lote (resumo) |
| `anuncios_gerados` | 004 | Anúncio produzido pela esteira + status de aprovação/publicação |
| `perfis` | 005 | Usuário Auth → papel (equipe/cliente) + `cliente_id` |
| `canais_marketplace` | 009 | Conexão do cliente (refresh_token, seller_id, tipo) |
| `fila_otimizacao_produto` | 012 | Fila do worker (1 por produto) |
| `tabelas_medidas` | 014 | Tabelas de medida gerenciáveis pelo cliente |
| `clientes.limite_esteira_mes` | 006 | Cota mensal de IA (coluna) |
| `produtos.tabela_medidas` / `produtos.componentes` | 013/015 | Override de medidas; kit/combo (jsonb) |

### O que já está BOM no modelo atual
- **Catálogo central separado do canal**: `produtos` → `produto_variantes` → `anuncios(_gerados)`/`anuncio_variantes`. Produto ≠ anúncio ✔ (o que o brief pede em 3.2).
- **SKU como chave transversal** (ERP↔ML↔TikTok) presente na variante e no anúncio ✔.
- **`cliente_id` em todas as tabelas de domínio** com FK `on delete cascade` ✔ (base do multi-tenant).
- **Precificação e imagens por SKU** ✔.
- **Índices** por `produto_id`, `cliente_id`, `status`, `sku` ✔.

### Lacunas do modelo atual (mapeando os ideais do brief)
| Entidade ideal (brief) | Situação atual | Lacuna |
|------------------------|----------------|--------|
| `Organization` | `clientes` faz esse papel | OK (renomear conceito, não a tabela) |
| `User` / `OrganizationUser` | `perfis` (1 usuário → 1 papel → 1 cliente) | **Não suporta multi-usuário por empresa nem 1 usuário em várias empresas** |
| `MarketplaceConnection`/`Account` | `canais_marketplace` | OK; falta multi-conta por marketplace |
| `Product`/`Variant`/`SKU`/`Image`/`Attribute` | produtos/variantes/imagens/atributos | OK |
| `Category`/`AttributeValue` | `categoria_templates` (jsonb) | Parcial (de-para ML não normalizado) |
| `Listing`/`ListingVariant`/`ListingImage` | anuncios/anuncio_variantes/imagens | OK |
| `ListingVersion` | — | **Ausente** (sem histórico/versão/diff) |
| `Inventory`/`Price`/`PriceRule` | estoque na variante; `precificacao_variantes` | Parcial (sem regra de preço reutilizável) |
| `AIProvider`/`AIModel`/`AIExecution` | — | **Ausente** (sem custo/tokens/modelo por chamada) |
| `OptimizationSuggestion` | embutido em `anuncios_gerados`/`auditorias_anuncios` | Parcial (não é diff campo-a-campo) |
| `Approval` | status em `anuncios_gerados` | Parcial (sem entidade própria, sem aprovação por tipo) |
| `Task`/`TaskAttempt` | `fila_otimizacao_produto` (só otimizar) | Parcial (não cobre publicar/sincronizar) |
| `Publication` | resultado em `anuncios_gerados` (ml_item_id) | Parcial (sem histórico de tentativas) |
| `WebhookEvent` | — | **Ausente** (sem webhooks do ML) |
| `AuditLog` | — | **Ausente** |
| `UsageRecord`/`Subscription` | `clientes.limite_esteira_mes` (cota) | Parcial (sem plano/assinatura/uso por token) |

## Modelo-alvo sugerido (RECOMENDAÇÃO — incremental)

Não é reconstrução: são **adições** sobre o que existe. Prioridade em **negrito**.

### 1. Identidade multiempresa
- **`organization_membership`** (substitui/estende `perfis`): `user_id`, `cliente_id`, `papel` (dono/operador/leitura), `ativo`. Permite **N usuários por empresa** e (futuro) 1 usuário em várias empresas. Fecha R1 e o gap `OrganizationUser`.
- Manter `clientes` como `Organization`.

### 2. Observabilidade de IA
- **`ai_execucoes`**: `id, cliente_id, produto_id, agente_codigo, provedor, modelo, tokens_in, tokens_out, custo_estimado, status, erro, duracao_ms, created_at`. Gravado em `chamarIAEstruturada`. Fecha R4; base de billing por uso.
- `ai_provedores`/`ai_modelos` (opcional) — tabela de preços por modelo para calcular `custo_estimado`.

### 3. Auditoria e versão
- **`auditoria_log`**: `entidade, entidade_id, campo, valor_anterior, valor_novo, autor_tipo (humano/agente), autor_id, agente_codigo, modelo, confianca, created_at`. Fecha R5.
- `listing_versions`: snapshot do `anuncios_gerados` por versão (diff + revert).

### 4. Aprovação como entidade
- `aprovacoes`: `anuncio_id, tipo_alteracao (titulo/descricao/preco/imagem/publicacao), estado_atual, sugerido, motivo, risco, agente, confianca, decisao (aprovado/editado/rejeitado), decidido_por, decidido_em`. Habilita **aprovação em lote e por tipo** (3.8 do brief).

### 5. Fila de tarefas unificada
- **`tarefas_processamento`** (generaliza `fila_otimizacao_produto`): `tipo (otimizar/publicar/sincronizar/imagem)`, `cliente_id`, `alvo_id`, `status`, `tentativas`, `idempotency_key`, `erro`, `resultado_id`, `dead_letter` (bool). Fecha R2/R13.

### 6. Publicação e canais
- `publicacoes`: `anuncio_id, marketplace, ml_item_id, status, payload_hash, tentativa, created_at` — histórico de publicação com idempotência (`payload_hash`/`idempotency_key`).
- `canais_marketplace`: permitir **N contas** por (cliente, marketplace) no futuro.

### 7. Webhooks e billing
- `webhook_events`: `marketplace, topico, recurso_id, payload, processado, created_at` — para receber mudanças de status/pergunta/venda do ML.
- `assinaturas`/`uso_mensal`: plano + consumo real (execuções e tokens), evoluindo de `limite_esteira_mes`.

## Diagrama de relacionamentos (alvo, textual)

```
Organization (clientes)
 ├─ OrganizationMembership (user ↔ papel)
 ├─ MarketplaceConnection (canais_marketplace) ─┐
 ├─ Product (produtos)                          │
 │   ├─ Variant/SKU (produto_variantes)         │
 │   ├─ Attribute (produto_atributos)           │
 │   ├─ Image (imagens_produto)                 │
 │   └─ Pricing (precificacao_variantes)        │
 ├─ Listing (anuncios / anuncios_gerados) ──────┤ publica em
 │   ├─ ListingVariant (anuncio_variantes)      │
 │   └─ ListingVersion (novo)                   │
 ├─ Approval (novo) ── sobre Listing            │
 ├─ Task (tarefas_processamento) ── otimizar/publicar/sincronizar
 ├─ AIExecution (novo) ── custo/tokens por agente
 ├─ AuditLog (novo) ── anterior→novo
 ├─ Publication (novo) ── ml_item_id, idempotência
 ├─ WebhookEvent (novo) ◄── ML notifica
 └─ Subscription/UsageRecord (evolui de limite_esteira_mes)
```

## Prioridade de implementação (dados)
1. `organization_membership` + fechar RLS (R1). **Crítico.**
2. `tarefas_processamento` + `publicacoes` com idempotência (R2). **Alto.**
3. `ai_execucoes` (R4) e `auditoria_log` (R5). **Alto.**
4. `aprovacoes` e `listing_versions`. **Médio.**
5. `webhook_events`, `assinaturas/uso_mensal`. **Médio/futuro.**
