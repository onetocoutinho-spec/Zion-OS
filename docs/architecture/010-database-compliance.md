# 010 — Database Compliance

> **Auditoria de banco.** Verifica se o schema atual (Supabase/Postgres) suporta o **Domain Layer** implementado nos PR-001…PR-005, confrontando-o com [000 — Business Domain](000-business-domain.md) e [001 — Product Master](001-product-master.md). Documento de auditoria — **nenhum código, nenhuma migration, nenhuma alteração no banco.**

> **Método:** cada afirmação sobre o schema é **FATO**, verificável nas migrações (`database/migrations/…`, `database/staging/sql-editor/01-base-schema.sql`); cada proposta é **RECOMENDAÇÃO**, marcada como tal.
>
> **Contexto importante:** o Domain Layer (PR-001–005) está **dormente** — os repositórios são **interfaces** (Ports), ainda sem implementação Supabase. Portanto **nada está quebrado hoje**. Esta auditoria mede o que o banco precisa para o **PR-006** (implementação dos repositórios) suportar o modelo canônico, sem quebrar o cliente atual (Chinelaria).

---

## Sumário executivo

| Pilar do domínio (001) | Suporte no banco hoje | Veredito |
|------------------------|-----------------------|----------|
| **Organização** (tenant/agência) | Não existe; o topo é `clientes` (empresa) | ❌ Criar |
| **Cliente** (empresa) | `clientes` | ✅ Reaproveitar |
| **Usuário** | `perfis` (+ RLS) | ✅ Reaproveitar |
| **Origem do Produto** (5 tipos) | Não existe (`produtos.cod_erp` é só o código ERP) | ❌ Criar |
| **Catálogo** (lote recebido) | Não existe (import ad-hoc) | ❌ Criar |
| **Compra/Aquisição** | Não existe | ❌ Criar (opcional) |
| **Produto Mestre** (canônico) | `produtos` (parcial; sem `sku_origem`/`organizacao_id`/`modo_operacao`/`versao_atual`) | ⚠️ Adaptar ou criar |
| **Variante** | `produto_variantes` (estoque/custo são Zion-owned, deveriam ser espelho ERP) | ⚠️ Adaptar |
| **Preço** (por canal) | `precificacao_variantes` | ⚠️ Adaptar |
| **Listing** (publicação) | `anuncios_gerados` (mistura publicação + esteira IA) | ⚠️ Adaptar/dividir |
| **Listing Variante** | `anuncio_variantes` | ⚠️ Adaptar |
| **Atributo Mestre** | `produto_atributos` | ⚠️ Adaptar |
| **Imagem Mestre** | `imagens_produto` | ⚠️ Adaptar |
| **Conta Marketplace** | `canais_marketplace` | ⚠️ Adaptar |
| **Versão do Produto Mestre** (histórico/diff) | Não existe | ❌ Criar |

**Conclusão:** o banco atual **suporta parcialmente** o domínio. O que já modela **produto/variante/anúncio/preço/imagem/atributo/canal** é reaproveitável com adaptações **aditivas**. Faltam as **4 fundações de identidade universal** (Organização, Origem do Produto, Catálogo, e a chave `sku_origem`) e o **versionamento** (`produto_mestre_versao`). Nada exige reescrita destrutiva: a migração pode ser **incremental e paralela** (Strangler Fig), sem tocar nos dados do cliente atual.

---

## Inventário do schema atual (FATO)

**Tabelas base** (`01-base-schema.sql`, ex-`_legado/supabase-schema.sql`): `clientes`, `onboardings`, `onboarding_items`, `produtos`, `anuncios`, `agentes`, `tarefas`, `relatorios`, `financeiro`, `execucoes_agentes`, `reunioes`, `pendencias`.

**Migração 001** (`001-modelagem-produtos-marketplace.sql`): `produto_variantes`, `produto_atributos`, `categoria_templates`, `anuncio_variantes`, `precificacao_variantes`, `imagens_produto`; + colunas em `produtos` (`tipo_produto`, `categoria_marketplace_sugerida`, `descricao_base`, `beneficios`, `cuidados`) e `anuncios` (`categoria_marketplace`, `descricao`, `id_externo_marketplace`, `observacoes`).

**Migração 002:** auditoria em massa (`auditorias_anuncios`, `problemas_anuncio`, `importacoes_anuncios`, `execucoes_lote`, `fila_otimizacao`).
**003:** `produtos` += `cod_erp`, `preco_minimo`, `margem`, `confianca_custo`; índice `idx_produtos_cod_erp`.
**004 + 009:** `anuncios_gerados` (+ `ml_item_id`, `ml_permalink`).
**005 + 016:** `perfis` (+ `ativo`); funções `eh_equipe()`, `cliente_do_usuario()` (SECURITY DEFINER); portal_* (funções, não views); RLS **deny-by-default**.
**009/011:** `canais_marketplace` (+ RLS `cliente_escopo`).
**010:** imagens no Storage.
**012:** `fila_otimizacao_produto` (fila + worker/cron).
**013/014:** `tabelas_medidas*`. **015:** kit-componentes.

**Chaves/índices (destaques):** PKs `uuid default gen_random_uuid()`; FKs por `cliente_id`/`produto_id`/`variante_id`/`anuncio_id` com `on delete cascade`; `unique (anuncio_id, variante_id)` em `anuncio_variantes`; `unique (cliente_id, marketplace)` em `canais_marketplace`; `unique (produto_id)` em `fila_otimizacao_produto`; índices por `sku`, `cod_erp`, `status`, `cliente_id`.
**Constraints:** estados são `text` com default (sem `check`/enum). Sem `sku_origem`, sem `organizacao_id`.
**RLS:** ligada em todas; política `equipe_total` (`using eh_equipe()`), `cliente_escopo` (`cliente_id = cliente_do_usuario()`) em canais/fila; deny-by-default (016).
**Triggers:** `set_updated_at()` BEFORE UPDATE em todas.
**Views:** **nenhuma** (o "portal" são funções SECURITY DEFINER).

---

## Mapa canônico × atual

| Entidade canônica (001) | Tabela atual mais próxima | Diferença principal |
|--------------------------|---------------------------|---------------------|
| `organizacao` | — | inexistente |
| `cliente` | `clientes` | ok (falta `organizacao_id`) |
| `usuario` | `perfis` | ok (falta `organizacao_id`) |
| `origem_produto` | — | inexistente |
| `catalogo` | — (parcial `importacoes_anuncios`) | inexistente como registro de lote |
| `aquisicao` | — | inexistente |
| `produto_mestre` | `produtos` | falta identidade universal + versão + modo |
| `variante` | `produto_variantes` | estoque/custo Zion-owned (deveriam ser espelho ERP) |
| `preco` | `precificacao_variantes` | ok em conteúdo; falta `canal` canônico + FK ao mestre |
| `listing` | `anuncios_gerados` | mistura publicação + esteira IA; falta `canal_conta_id`/`modelo_publicacao`/`payload_hash` |
| `listing_variante` | `anuncio_variantes` | atrelada a `anuncios`/`anuncio_id`, não a `listing` |
| `imagem_mestre` | `imagens_produto` | ok (falta vínculo ao mestre) |
| `atributo_mestre` | `produto_atributos` | ok (falta `origem_dado` canônico) |
| `conta_marketplace` | `canais_marketplace` | 1 conta por marketplace (canônico admite N) |
| `produto_mestre_versao` | — | inexistente |

---

## 1. Tabelas que podem ser reaproveitadas (sem mudança estrutural)

- **`clientes`** → **Cliente** (empresa). Modelo idêntico; só precisa de `organizacao_id` (aditivo) quando a Organização existir.
- **`perfis`** → **Usuário**. Papel `equipe|cliente` + `ativo` já cobrem 000; RLS deny-by-default (016) é a base correta.
- **`categoria_templates`** → apoio a **Categoria/Atributo** (molde por nicho). Reaproveitável como está.
- **`fila_otimizacao_produto`** → **semente do Event Bus/Engine** (fila + idempotência por `unique(produto_id)` + worker/cron). Reaproveitável como padrão para a fila de operações (evolução, não parte deste PR).
- **Infra transversal:** função `set_updated_at()` + trigger, funções `eh_equipe()`/`cliente_do_usuario()`, modelo de RLS deny-by-default. Reaproveitar em todas as tabelas novas.

## 2. Tabelas que precisam ser adaptadas (aditivo)

- **`produtos` → base do `produto_mestre`.** Já tem `nome/marca/modelo/categoria/descricao_base/cod_erp/preco_minimo/margem`. Falta identidade universal e versão (ver §4).
- **`produto_variantes` → `variante`.** Já tem `sku/ean/cor/tamanho`. **Mudança de fronteira (001 §7):** `custo`/`preco_base`/`estoque` hoje são Zion-owned; no modelo canônico `custo_erp`/`estoque_erp` são **espelho read-only do ERP**, e `preco_venda` é o write da Zion. Não se apaga nada — adiciona-se o espelho e re-orienta a origem do dado (ver §5).
- **`precificacao_variantes` → `preco`.** Já tem `preco_venda/preco_minimo/margem_liquida/status_margem`. Falta o **`canal` canônico** (`zion|mercado_livre|tiktok|shopee`) — hoje é `marketplace text` — e a FK ao Produto Mestre.
- **`anuncios_gerados` → `listing`.** Tem `ml_item_id/ml_permalink/status`. Precisa **separar** a publicação (Listing) do artefato da esteira IA (`anuncio jsonb`, `nota_diagnostico`, `veredito_a10`), e ganhar `produto_mestre_id`, `canal_conta_id`, `modelo_publicacao`, `payload_hash` (idempotência).
- **`anuncio_variantes` → `listing_variante`.** Reapontar de `anuncio_id` para `listing_id`; já tem `id_variacao_marketplace/preco_enviado/estoque_enviado/status_envio`.
- **`produto_atributos` → `atributo_mestre`.** Já tem `nome/valor/obrigatorio/origem`. Alinhar `origem` → `origem_dado` (`origem|ia|manual`) e vincular ao mestre.
- **`imagens_produto` → `imagem_mestre`.** Já tem `tipo_imagem/url/status/variante_id`. Alinhar `tipo` aos valores canônicos (`capa|secundaria|detalhe|medidas|humanizada`) e `origem_imagem`.
- **`canais_marketplace` → `conta_marketplace`.** Adicionar `organizacao_id`; **relaxar** `unique(cliente_id, marketplace)` para permitir **N contas** por marketplace (000). Manter `refresh_token` **server-side** (já corrigido — R3).

## 3. Tabelas que devem ser criadas

**Fundações de identidade universal (bloqueadoras do PR-006):**
- **`organizacoes`** — o tenant/agência (000). `clientes.organizacao_id` passa a referenciá-la.
- **`origem_produto`** — `tipo (fornecedor|fabricante|importador|distribuidor|marca_propria)`, `nome`, `documento`, `interna bool`, `status`. Âncora do `sku_origem`.
- **`catalogo`** — o lote recebido: `origem_produto_id`, `formato (excel|csv|pdf|xml|api|drive|b2b)`, `referencia`, `quantidade`, `status`.
- **`produto_mestre_versao`** — versionamento/histórico do domínio: `produto_mestre_id`, `versao`, `snapshot jsonb`, `diff jsonb`, `autor_tipo (humano|agente)`, `autor_id`, `agente_codigo`, `created_at`.

**Opcionais / conforme decisão de modelagem:**
- **`aquisicao`** — rastreio de compra (revenda; opcional por 001 §4).
- **`produto_mestre`** *(se optar por tabela nova em vez de estender `produtos`)* — ver §7 (estratégia recomendada).
- **`listing`** *(nova, se optar por separar de `anuncios_gerados`)* — ver §7.

**Fora do escopo deste PR (futuros):** `evento`/`entrega` (Event Bus — 004), `conector_conta`/`execucao_conector` (Connector SDK — 003), `operacao_marketplace` (Marketplace Engine — 005). Citadas para completude; **não** entram na conformidade do Domain Layer atual.

## 4. Colunas faltando (por entidade)

**Produto Mestre** (em `produtos` ou na nova `produto_mestre`):
- `organizacao_id` (FK) · `origem_produto_id` (FK) · `origem_tipo` (espelho) · `catalogo_id` (FK, nullable) · `modo_operacao` (`revenda|fabricacao_propria`) · **`sku_origem`** (chave 1ª de conciliação) · `erp_sku` (hoje `cod_erp` — renomear/alinhar) · `categoria_zion` · `seo jsonb` · `versao_atual int` · `status` canônico (`rascunho|enriquecido|pendente_aprovacao|aprovado|publicado|pausado|arquivado`) — hoje há `status_cadastro/status_seo/…` (flags), não o ciclo de vida do domínio.
- **Índice/constraint:** `unique(organizacao_id, origem_produto_id, sku_origem)`; índices por `sku_origem`, `ean`, `erp_sku`.

**Variante** (`produto_variantes`): `produto_mestre_id` (FK ao mestre) · `sku_zion` · `sku_origem_variacao` · `erp_sku` · `preco_venda` (write Zion) · `custo_erp`/`estoque_erp` (**espelho** read-only).

**Preço** (`precificacao_variantes`): `canal` canônico · FK ao Produto Mestre/Variante canônicos.

**Listing** (`anuncios_gerados`): `produto_mestre_id` · `canal` (`mercado_livre|tiktok|shopee`) · `canal_conta_id` (FK conta) · `modelo_publicacao` (`classico|user_products|canal_especifico`) · `payload_hash` (idempotência).

**Conta Marketplace** (`canais_marketplace`): `organizacao_id`; permitir N contas (rever unique).

**Cliente/Usuário:** `organizacao_id`.

## 5. Colunas que devem ser removidas

**Nenhuma remoção é necessária para a migração incremental.** Regra: **não apagar** — o app atual depende das colunas legadas.

Ressalva **semântica** (não é remoção, é re-origem do dado, 001 §7): em `produto_variantes`, `custo`/`preco_base`/`estoque` deixam de ser *fonte da verdade* da Zion e passam a ser **espelho do ERP** (`custo_erp`/`estoque_erp`, read-only) no modelo canônico. As colunas legadas **permanecem** enquanto o app antigo as usa; a limpeza (drop) é o **último passo**, só após o cutover — fora deste PR.

## 6. Migrations necessárias (plano — sem SQL)

Sequência **aditiva e idempotente** (segue o padrão 001–016; cada uma "Rode UMA vez", reversível). Descritas por objetivo, **sem DDL**:

| # | Objetivo | Tabelas/colunas | Bloqueia PR-006? |
|---|----------|-----------------|------------------|
| **017** | Organização (tenant) | cria `organizacoes`; adiciona `organizacao_id` (nullable→backfill) em `clientes`/`perfis` | Sim |
| **018** | Origem do Produto + Catálogo | cria `origem_produto`, `catalogo` | Sim |
| **019** | Identidade universal no Produto Mestre | adiciona `sku_origem`, `organizacao_id`, `origem_produto_id`, `origem_tipo`, `catalogo_id`, `modo_operacao`, `versao_atual`, `categoria_zion`, `seo`, `status_ciclo` + `unique(organizacao,origem,sku_origem)` e índices | Sim |
| **020** | Variante canônica | adiciona `produto_mestre_id`, `sku_zion`, `sku_origem_variacao`, `erp_sku`, `preco_venda`, espelhos `custo_erp`/`estoque_erp` | Sim |
| **021** | Versionamento | cria `produto_mestre_versao` (snapshot/diff/autor) | Sim |
| **022** | Listing canônico | cria/adequa `listing` + `listing_variante` (separa da esteira IA; add `canal_conta_id`/`modelo_publicacao`/`payload_hash`) | Parcial (Listing só é usado no PR de publicação) |
| **023** | Preço por canal + Conta Marketplace | `preco.canal` canônico; `conta_marketplace.organizacao_id` + N contas | Parcial |
| **024** | (opcional) Aquisição | cria `aquisicao` | Não |
| **025** | RLS + backfill de conformidade | estende RLS para as novas tabelas (deny-by-default, escopo por organizacao/cliente); backfill de `organizacao_id`; **não** dropa nada | Sim |

> **Regra de todas:** aditivas, com `if not exists`, colunas **nullable** primeiro (+ backfill), RLS ligada, trigger `set_updated_at`, e um bloco de **REVERTER** no cabeçalho — exatamente como as migrações 001–016.

## 7. É possível migração incremental sem quebrar o cliente atual?

**Sim — e é a estratégia recomendada (Strangler Fig, alinhado ao 008).**

**Estratégia recomendada: tabelas canônicas NOVAS em paralelo** (não sobrecarregar `produtos`/`anuncios` com dupla semântica):

1. **Fundações primeiro (017–018):** `organizacoes`, `origem_produto`, `catalogo`. Puramente aditivas; o app atual nem as enxerga.
2. **Produto Mestre canônico:** criar **`produto_mestre`/`variante`/`listing` como tabelas novas** (migr. 019–022), populadas **daqui para frente pelo Zion Intake** (PR-005). O `produto_mestre` referencia `organizacoes/origem_produto/catalogo` e carrega `sku_origem`/`versao_atual`. Os legados `produtos`/`produto_variantes`/`anuncios_gerados` **continuam operando** o app do cliente atual, intocados.
   - *Alternativa* (menor custo, maior acoplamento): **estender `produtos`** com as colunas canônicas e tratá-la como o mestre. Viável, mas mistura o modelo legado e o canônico na mesma tabela — preferir tabelas novas para uma fronteira limpa.
3. **Ponte de leitura (opcional):** uma **view** de compatibilidade (`produto_mestre` ⟵ `produtos`) para telas legadas lerem o novo modelo sem reescrita imediata.
4. **Backfill controlado (025):** migrar `produtos` existentes → `produto_mestre` por cliente, atrás de flag, com `organizacao_id` preenchido; `sku_origem` derivado de `cod_erp`/`sku` quando possível, senão fila de conciliação.
5. **Cutover por entidade:** quando o novo modelo estiver validado em produção, apontar as telas para as tabelas canônicas; só então **aposentar** as legadas (drop = último passo, fora deste PR).

**Salvaguardas (herdadas de 001–016):** tudo aditivo/idempotente; colunas nullable + backfill; RLS deny-by-default nas novas tabelas; `refresh_token`/segredos server-side; cada migração reversível. **O cliente atual (Chinelaria) não é tocado**: o app legado segue lendo/gravando `produtos`/`anuncios`/`anuncios_gerados` enquanto o modelo canônico nasce ao lado.

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **`sku_origem` ausente no legado** (só `sku`/`cod_erp`) | Backfill heurístico + fila de conciliação (Intake já trata `sem_sku`); nunca promover sem chave. |
| **Sobrecarregar `produtos` com dupla semântica** | Preferir tabelas canônicas novas (§7) + view de compatibilidade. |
| **`estoque`/`custo` mudam de dono (Zion→ERP)** | Espelho aditivo (`*_erp`); colunas legadas mantidas até o cutover; sem overselling porque o Intake não inventa números. |
| **Organização inexistente hoje** | Criar `organizacoes` + backfill (1 organização default para o tenant atual) antes de exigir `organizacao_id`. |
| **RLS por organização** | Estender `eh_equipe()`/escopo para incluir `organizacao_id`; deny-by-default já é a base segura. |
| **`anuncios_gerados` mistura publicação + IA** | Separar `listing` (estado do canal) do artefato da esteira; migração 022 não apaga o `anuncio jsonb`. |
| **Estados como `text` livre** | Introduzir `check`/domínio de valores nas tabelas canônicas (o legado permanece `text`). |

## Fora de escopo (desta auditoria e do PR-006)

Event Bus (`evento`/`entrega`), Connector SDK (`conector_conta`/`execucao_conector`), Marketplace Engine (`operacao_marketplace`) — pertencem a PRs futuros (004/003/005) e **não** são requisito de conformidade do Domain Layer atual.

---

> **Status:** 010 — Database Compliance **v1.0**. Diagnóstico de banco; **nenhuma migration, nenhum código, nenhuma alteração no banco**. As migrações 017+ aqui **planejadas** (não escritas) habilitam o **PR-006** (repositórios Supabase) a suportar o modelo canônico de [001](001-product-master.md), de forma incremental e sem quebrar o cliente atual, conforme a estratégia Strangler Fig de [008](008-architecture-compliance.md).
