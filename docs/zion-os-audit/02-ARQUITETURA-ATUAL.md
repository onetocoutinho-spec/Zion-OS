# 02 — Arquitetura Atual

Tudo aqui é **FATO** com citação. As recomendações estão em [06](./06-ARQUITETURA-RECOMENDADA.md).

## Stack (fato — `package.json`, `README.md`)

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript 5**.
- **Tailwind CSS v4** (`@tailwindcss/postcss`).
- **Supabase** (`@supabase/supabase-js` ^2.110) — PostgreSQL + Auth + Storage. Realtime é declarado nas migrações (`alter publication supabase_realtime add table …`) mas **não é usado no app**: a atualização de tela é por *polling* interno (`notificarMudanca()` → `useLiveQuery`), ver `src/lib/repositorio.ts:8-9`.
- **IA**: `@anthropic-ai/sdk` ^0.110 (Claude) + Gemini via `fetch` (sem SDK).
- **xlsx** (importação de planilha), **lucide-react** (ícones).
- **Deploy**: Vercel (+ Cloudflare como proxy/DNS); worker agendado por **Vercel Cron** (`vercel.json`: `/api/otimizar/worker` a cada minuto).

## Dois ambientes no mesmo app (fato — `README.md`, `AuthGate`)

- **Painel da equipe** (rotas na raiz de `src/app/*`) — a Zion opera clientes, produtos, esteira, auditoria em massa, tarefas, vendas, financeiro.
- **Portal do Cliente** (`src/app/cliente/*`) — cada cliente opera a própria loja. Isolado por `AuthGate` (client-side) + RLS/RPCs no servidor.

## Camadas (fato)

```
Telas (src/app/**, src/components/**)
        │  nunca falam com o banco direto
        ▼
Serviços de domínio (src/lib/services/**, src/lib/data/**)
        │  regras + orquestração
        ▼
Repositório genérico (src/lib/repositorio.ts)
        │  CRUD + lote (chunk/retry) + notificarMudanca()
        ▼
┌───────────────────────────┬─────────────────────────────┐
│ Supabase (produção)       │ localStorage (modo demo)     │
│ src/lib/supabase/client   │ src/lib/store.ts             │
└───────────────────────────┴─────────────────────────────┘
```

- **Repositório** (`src/lib/repositorio.ts`): `criarRepositorio<T,Row>()` devolve `listar/buscar/criar/criarVarios/atualizar/atualizarVarios/excluir/excluirPorFiltro`. Cada entidade define tabela, `selecao` (colunas/joins), `paraApp`/`paraBanco` (mappers). Se `supabaseConfigurado` for falso, usa localStorage (modo demonstração, sem login).
- **Escrita → notificação**: toda escrita chama `notificarMudanca()`, que dispara o re-fetch das telas abertas (`useLiveQuery`). Não é WebSocket/Realtime — é um pub/sub em memória do cliente.
- **Mappers/tipos**: `src/lib/supabase/mappers.ts` (947 linhas) e `src/lib/supabase/database.types.ts` traduzem linha do banco (snake_case) ↔ tipo do app (camelCase, `src/lib/types.ts`).

## Camada de IA (fato — `src/lib/agentes/`)

- **Provedor** (`provedorIA.ts`): `chamarIAEstruturada({system, mensagem, schema, maxTokens})` → chama **Gemini** ou **Claude** conforme env (`GEMINI_API_KEY` tem preferência; `IA_PROVEDOR` força). Saída **estruturada** (JSON Schema convertido para o subset do Gemini em `paraSchemaGemini`). Retry em 503/429. Sem chave → modo simulado.
  - ⚠️ `maxOutputTokens` do Gemini é fixado em `Math.min(maxTokens, 8192)` (`provedorIA.ts:89`); o Claude usa até 16000.
- **Catálogo de agentes** (`catalogo.ts`): fonte única dos prompts **A0–A12** + `REGRAS_MAE` + `CHECKLIST_QUALIDADE`. Ordem da esteira: `A0→A1→A2→A9→A3→A5→A6→A7→A8→A12→A4→A10` (`ORDEM_ESTEIRA`). A11 (otimizar publicado) fica fora da esteira.
- **Esteira** (`esteira.ts`): compõe todos os agentes num **único system prompt** ("uma passada") e um `ESQUEMA_ANUNCIO` (título, descrição, ficha, medidas, variações, imagens, FAQ, pendências, `vereditoA10`). Módulo puro; a chamada de rede fica nas rotas.
- **Provedor de imagem** (`provedorImagem.ts`) + `imagemIA.ts`: Estúdio IA usa o modelo de imagem do Gemini (melhorar capa 1:1 / infográfico), sempre a partir da foto real.

## Rotas de servidor (fato — `src/app/api/**/route.ts`)

| Rota | Função |
|------|--------|
| `api/agentes/esteira` | Roda a esteira (uma passada) para 1 produto. |
| `api/agentes/executar` | Executa 1 agente isolado (ferramentas do portal). |
| `api/imagens/gerar` | Geração/edição de imagem (Estúdio IA). |
| `api/ml/autorizar` · `api/ml/conectar` | OAuth do cliente com o ML (authorize + callback → refresh_token). |
| `api/ml/importar-anuncios` | Importa anúncios existentes do vendedor (`/users/{id}/items/search` + multiget). |
| `api/ml/publicar` | Renova token e publica em `/items` (segredo do app só aqui). `maxDuration=60`. |
| `api/ml/vendas` | Puxa pedidos pagos → faturamento/lucro/taxas. |
| `api/otimizar/worker` | **Worker da fila** (Cron). `maxDuration=300`, `service_role`. |

## Fila e processamento assíncrono (fato)

- Tabela `fila_otimizacao_produto` (migração 012): `status` (pendente/processando/concluido/erro), `tentativas`, `erro`, `anuncio_id`, **`unique(produto_id)`** (1 item por produto — reenfileirar atualiza = idempotência de enfileiramento).
- Worker `api/otimizar/worker/route.ts`: `CONCORRENCIA=1`, `ORCAMENTO_MS=250s`, `MAX_TENTATIVAS=3`, `STALE_MIN=10` (item "processando" preso volta pra fila). Rate-limit (429) → devolve à fila **sem** gastar tentativa. Lock por transição `pendente→processando` via `.in(id, …)`.
- Existe também a **fila da equipe** `fila_otimizacao` (migração 002) — outro fluxo (auditoria em massa), não consumida pelo mesmo worker.

## Integração com marketplaces (fato — `src/lib/marketplaces/`)

- `mercadolivre.ts` (418 linhas): OAuth (`renovarToken`), `preverCategoria`, `criarItem`, busca de anúncios/vendas.
- `mlPayload.ts`: **construtor puro** do corpo do item ML — modelo **clássico** (`title` + `variations[]` com `SIZE`/`COLOR`), mapeia ficha→atributos ML, injeta `SELLER_SKU`, `EMPTY_GTIN_REASON` sem EAN, `shipping me2` grátis.
- `mlUserProducts.ts`: builder do modelo **User Products** (categorias de calçado que exigem `family_name` + `SIZE_GRID`). **Existe, mas não está ligado ao fluxo de publicar** (o publish usa o `mlPayload` clássico — ver [04](./04-PROBLEMAS-E-RISCOS.md) item 7).
- **Não há interface de adaptador genérica**: a pasta é 100% ML. Shopee/TikTok/Amazon/Magalu não implementados.

## Banco de dados (fato)

- **Fonte da verdade**: `database/migrations/001…015` (aditivas, não destrutivas). O setup base v1.x (tabelas `clientes`, `produtos`, `anuncios`, `agentes`, `tarefas`, `relatorios`, `financeiro`, `execucoes_agentes`, `reunioes`, `pendencias`, `onboardings`) fica em `database/_legado/` (histórico). Inventário completo em [05](./05-MODELO-DE-DADOS-SUGERIDO.md).
- **RLS**: migração 005 troca o "authenticated using(true)" por `equipe_total using eh_equipe()`; self-service (006/007) adiciona políticas escopadas por `cliente_do_usuario()`.

## Segurança (fato, sem expor segredos)

- Segredos do app ML (`ML_CLIENT_ID/SECRET`), chave Gemini/Claude e `SUPABASE_SERVICE_ROLE_KEY`/`CRON_SECRET` são **server-only** (sem `NEXT_PUBLIC_`). Boas práticas documentadas em `.env.example` e `README.md`.
- `refresh_token` do cliente fica em `canais_marketplace` (RLS `eh_equipe()`); mas **transita pelo browser** no publish (ver [04](./04-PROBLEMAS-E-RISCOS.md) item 3).
- Proteção de rota é **client-side** (`AuthGate`); a defesa real é o RLS. O `README.md` reconhece isso em "Limitações conhecidas".
- `credenciais.md` (38 KB) está na raiz do repo com tokens reais (gitignored) — risco de higiene ([04](./04-PROBLEMAS-E-RISCOS.md) item 10).

## Mapa de pastas (fato — resumido)

```
src/
  app/            rotas (App Router)
    cliente/      Portal do Cliente (/cliente/*)
    api/          rotas de servidor (agentes, ml, otimizar/worker, imagens)
    (raiz)        painel da equipe: clientes, produtos, esteira, auditoria-massa,
                  tarefas, vendas, financeiro, relatorios, reunioes, onboarding…
  components/     client-portal/, layout/, ui/, forms/, agentes/, produtos/, auth/
  lib/
    agentes/      catalogo (A0–A12), esteira, provedorIA, provedorImagem
    marketplaces/ mercadolivre, mlPayload, mlUserProducts
    services/     camada de dados/uso (importação, publicação, vendas, canais…)
    data/         repositórios por entidade (produtos, anuncios, tarefas…)
    supabase/     client, admin (service_role), mappers, database.types
    types.ts, store.ts, repositorio.ts, contexto.ts, constantes.ts, csv.ts…
database/
  migrations/     001…015 (fonte da verdade)
  _legado/        setup v1.x (histórico)
docs/             notas + esta auditoria (zion-os-audit/)
```
