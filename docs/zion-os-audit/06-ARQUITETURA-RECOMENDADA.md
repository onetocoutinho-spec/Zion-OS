# 06 — Arquitetura Recomendada

> **Princípio: evolução incremental.** O Zion OS já tem camadas corretas (telas → serviços → repositório → Supabase) e ativos reais (gateway de IA, esteira A0–A12, worker com retry). A recomendação **não reconstrói** — adiciona três peças e isola as regras do ML.

## Diagrama-alvo (textual)

```
Frontend (Next.js — painel da equipe + Portal do Cliente)
        │  autorização revalidada no servidor + RLS
        ▼
API / Rotas de servidor (src/app/api/**)
        │
        ▼
Camada de serviços (domínio)
   ├── Catálogo (produtos, variantes, imagens)
   ├── Anúncios / Esteira
   ├── Aprovações            (nova entidade)
   ├── Precificação
   ├── Usuários & Empresas   (multiempresa)
   ├── IA Gateway            (provedorIA + ledger)
   └── Integrações
        │
        ▼
Fila de tarefas unificada (tarefas_processamento)
   ├── Worker Otimização (IA)      ← já existe (reusar)
   ├── Worker Publicação (ML)      ← novo (enfileirar publish)
   ├── Worker Imagens              ← Estúdio IA em lote
   └── Worker Sincronização        ← estoque/preço/status
        │
        ▼
Adaptadores de marketplace  (contrato MarketplaceAdapter)
   ├── MercadoLivreAdapter  ← primeira implementação (extrair do atual)
   ├── ShopeeAdapter        ← futuro
   ├── TikTokShopAdapter    ← futuro
   └── (Amazon / Magalu)    ← futuro
        │
        ▼
APIs externas (Mercado Livre, depois outros) + Webhooks de volta
```

## Peça 1 — Fila de tarefas unificada

**Por quê**: hoje só a *otimização* é enfileirada; *publicação* é síncrona no browser (R2). Unificar dá escala, idempotência e observabilidade.

**Como (reusando o que existe)**:
- Generalizar `fila_otimizacao_produto` → `tarefas_processamento` com `tipo` (otimizar/publicar/sincronizar/imagem), `idempotency_key`, `dead_letter`.
- O worker atual (`src/app/api/otimizar/worker/route.ts`) vira um **dispatcher** por `tipo`, mantendo o que já funciona: `MAX_TENTATIVAS`, `STALE_MIN` (recuperar preso), tratamento de 429, lock por transição de status.
- **Concorrência configurável por tipo** (IA continua 1–2 por quota; publicação ML pode subir respeitando o rate-limit do ML).
- **Idempotência da publicação**: antes de criar em `/items`, checar se já existe `ml_item_id` para `(cliente, produto, marketplace)`; usar `idempotency_key`.

## Peça 2 — Contrato `MarketplaceAdapter`

**Por quê**: as regras do ML estão no builder (`mlPayload.ts`) e nos serviços; sem contrato, cada canal novo espalha `if` (R9).

**Interface (esboço, RECOMENDAÇÃO)**:
```
interface MarketplaceAdapter {
  autenticar(canal): Promise<Tokens>          // OAuth + refresh
  categorias(query): Promise<Categoria[]>
  atributosDaCategoria(categoriaId): Promise<Atributo[]>
  montarPayload(anuncio, produto, opcoes): unknown   // puro (dry-run)
  publicar(tokens, payload): Promise<ResultadoPublicacao>
  atualizar(tokens, itemId, patch): Promise<void>
  pausar(tokens, itemId): Promise<void>
  importar(tokens, filtro): Promise<AnuncioExterno[]>
  vendas(tokens, periodo): Promise<Pedido[]>
  processarWebhook(evento): Promise<void>
  limites(): RateLimit                          // req/s, tamanhos
}
```
- Primeira implementação: **`MercadoLivreAdapter`** — envolve o `mercadolivre.ts`/`mlPayload.ts`/`mlUserProducts.ts` atuais **sem mudar comportamento**. A escolha clássico × User Products vira detalhe interno do adapter (por categoria).
- Ganho imediato: destrava R7 (User Products por categoria) e prepara Shopee/TikTok sem tocar no domínio.

## Peça 3 — Observabilidade (ledger + auditoria)

**Por quê**: custo de IA cego (R4) e sem trilha de alteração (R5).
- **`ai_execucoes`**: gravado dentro de `chamarIAEstruturada` (`provedorIA.ts` já sabe `provedor`/`modelo`; só falta tokens/custo). Habilita billing por uso e alertas de gasto.
- **`auditoria_log`** + `listing_versions`: toda escrita de anúncio registra anterior→novo, autor (humano/agente), modelo, confiança. Habilita a central de aprovação rica e o **desfazer**.
- **Fallback de IA**: `chamarIAEstruturada` tenta o provedor secundário em erro transitório (R8).

## Segurança multiempresa (fechar antes de escalar)

- **Negar por padrão**: inverter `eh_equipe()` (R1) e criar `perfis`/`organization_membership` para **todo** usuário na criação (trigger/fluxo de convite).
- **Autorização no servidor**: revalidar papel/escopo a partir da sessão Supabase em toda rota sensível (não confiar em flag do cliente) — RLS como segunda camada (R6).
- **Segredos server-side**: `refresh_token` do cliente nunca no browser (R3); rota recebe `clienteId` e busca o token com `service_role`.

## Responsabilidades por camada (alvo)

| Camada | Responsabilidade | Não faz |
|--------|------------------|---------|
| Frontend | Render, UX, coleta; chama serviços | Não decide autorização sozinho |
| Rotas API | Autenticar/autorizar no servidor, orquestrar | Não conter regra de marketplace |
| Serviços de domínio | Regras de negócio (catálogo, anúncio, preço, aprovação) | Não falar HTTP externo direto |
| Fila/Workers | Assíncrono, retry, idempotência, dead-letter | Não conter regra de canal |
| Adapters | Traduzir domínio ↔ API do marketplace | Não conter regra de negócio Zion |
| Repositório/DB | Persistência + RLS | Não conter regra de UI |

## Comunicação e dados
- **Domínio ↔ integração**: sempre via contrato `MarketplaceAdapter` (sem acoplamento ao ML fora dos adapters).
- **Assíncrono**: tudo que chama IA ou API externa em volume passa pela fila.
- **Estado de tela**: migrar do polling (`notificarMudanca`) para Realtime nas tabelas do portal e no status da fila (R12) — o worker server-side passa a refletir sem refresh.
- **Observabilidade**: `ai_execucoes` + `auditoria_log` + logs estruturados por tarefa (id da tarefa em todos os logs).

## O que **não** mudar agora
- A arquitetura de camadas e o repositório genérico — funcionam.
- O catálogo de prompts A0–A12 — é ativo, não tocar sem necessidade.
- Não adicionar Shopee/TikTok/Amazon/Magalu antes do contrato de adapter + ML sólido.
- Não trocar Supabase/Vercel nem introduzir infra de fila externa (Redis/SQS) enquanto o volume couber no worker+Cron.
