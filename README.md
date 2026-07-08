# Zion OS

Sistema da **Zion Company** — agência que ajuda empresários a iniciar, organizar e escalar vendas em marketplaces (Mercado Livre, TikTok Shop, Shopee, Amazon).

São **dois ambientes** no mesmo app, separados por papel do usuário:

- **Painel da equipe** — a Zion gerencia clientes, produtos, anúncios, esteira de IA, auditoria em massa, tarefas, vendas, relatórios e financeiro.
- **Portal do Cliente** (`/cliente/*`) — cada cliente opera a própria loja: importa a base, otimiza anúncios com IA, gere fotos, conecta o Mercado Livre, publica e acompanha as vendas. É **isolado** do painel interno (o `AuthGate` redireciona o cliente).

---

## Principais recursos

**Esteira de Anúncio (IA).** Os prompts reais dos agentes **A0–A12** vivem em `src/lib/agentes/catalogo.ts` (fonte única) e alimentam:
- a esteira em **modo rápido** (uma passada) e **aprofundado** (multi-agente, um agente por chamada, com barra de progresso);
- as **ferramentas do Portal** (`/cliente/otimizar`) — cada ferramenta roda o agente correspondente;
- a tela **Agentes IA** da equipe.
Produz o anúncio completo (título ≤60, descrição, ficha, medidas, variações, imagens, FAQ) + pendências + **veredito A10** (trava: só aprova sem pendências).

**Integração Mercado Livre (`src/lib/marketplaces/`, `/api/ml/*`).**
- **Conectar** — OAuth: o cliente autoriza a própria conta; o `refresh_token` fica no `canais_marketplace`. O segredo do app ML vive só no servidor.
- **Publicar** — dry-run local (a equipe revê o payload) + envio real. Suporta o modelo **User Products** (`mlUserProducts.ts`) exigido por categorias de calçado, com criação da guia de tamanhos.
- **Vendas** — puxa os pedidos pagos reais e calcula faturamento, lucro líquido (cruzando com os custos), taxas, ticket médio, mais vendidos (`/cliente/vendas` e `/vendas`).
- **Vinculação** — exporta o CSV **SKU ↔ MLB** para o cliente importar no ERP dele.

**Base de produtos.** Assistente de importação por planilha com **mapeamento de ERP** (presets Bling/Tiny/Magazord + ajuste manual). Produto pai × variações × anúncio; precificação pelo modelo Zion.

**Imagens.** Upload (foto a foto e por pasta produto/cor) no Supabase Storage + **Estúdio IA** (Gemini): melhora a capa 1:1 e gera infográficos a partir da foto real, sem descaracterizar o produto.

**Auditoria em massa.** Importa a base inteira, dá **score 0–100**, curva **ABC** e **prioridade** (valor × potencial), com fila de otimização.

---

## Stack

- **Next.js 16** (App Router, Turbopack) + **TypeScript** + **Tailwind CSS v4**
- **Supabase** (PostgreSQL + Auth + Realtime + Storage)
- **IA**: Gemini (padrão, texto + imagem) ou Claude — atrás da mesma interface (`src/lib/agentes/provedorIA.ts`)
- lucide-react

---

## Rodar localmente

```bash
npm install
npm run dev      # http://localhost:3000
```

- **Com** `.env.local` → tela de login (Supabase Auth), dados no Supabase, realtime entre a equipe.
- **Sem** `.env.local` → modo demonstração (localStorage), sem login.

Build de produção: `npm run build && npm start`.

> node/npm podem não estar no PATH; se precisar: `$env:Path = "C:\Program Files\nodejs;" + $env:Path` (PowerShell).

---

## Variáveis de ambiente

Copie `.env.example` → `.env.local`. **Nunca** use a chave `service_role`/`sb_secret_` no frontend nem em `NEXT_PUBLIC_*`. Ao colar valores, cuidado com `< >` de placeholder, aspas e barras sobrando.

| Variável | Onde | Descrição |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | público | `https://<ref>.supabase.co` — **sem** `/rest/v1`, sem barra no fim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | público | chave **anon/public** (JWT `eyJ…` ou publishable) |
| `GEMINI_API_KEY` | servidor | chave do Gemini (esteira, agentes, imagens) |
| `GEMINI_MODEL` | servidor | padrão `gemini-2.5-flash` |
| `GEMINI_IMAGE_MODEL` | servidor | padrão `gemini-2.5-flash-image` (Estúdio IA) |
| `ANTHROPIC_API_KEY` | servidor | opcional — usa Claude no lugar do Gemini |
| `ML_CLIENT_ID` / `ML_CLIENT_SECRET` | servidor | app do Mercado Livre (DevCenter) |
| `ML_REDIRECT_URI` | servidor | `https://SEU-DOMINIO/cliente/conectar-ml` — idêntico ao Redirect URI do app ML |

As `NEXT_PUBLIC_*` e o `ML_*`/`GEMINI_*` são lidos no **build/deploy** — ao alterar na Vercel, é preciso **Redeploy**.

---

## Banco de dados (Supabase)

As migrações ficam em **`database/migrations/`** e são a fonte da verdade. Rode **em ordem** no SQL Editor (aditivas e não destrutivas):

| # | Arquivo | O que traz |
| --- | --- | --- |
| 001 / 001b | modelagem-produtos-marketplace · seed | produto pai × variação × anúncio, templates |
| 002 | auditoria-em-massa | auditorias, problemas, fila, execuções |
| 003 | modelo-marketplace-real | `cod_erp`, preço mínimo, margem |
| 004 | anuncios-gerados | fila de aprovação da esteira |
| 005 | portal-cliente | `perfis`, RLS por papel (equipe × cliente), RPCs do portal |
| 006 / 007 | self-service (fase 1 e 2) | cota mensal + cliente importa/audita a própria base |
| 008 | portal-cliente-leituras | pendências/relatórios do cliente |
| 009 | marketplace-ml | `canais_marketplace` + colunas do resultado da publicação |
| 010 | imagens-storage | bucket `produtos-imagens` + políticas |
| 011 | canal-cliente-conecta | cliente cria/edita o próprio canal (OAuth) |

Depois: **Auth → Users** para criar contas da equipe; para clientes, criar o usuário + o registro em `perfis` (papel `cliente`, `cliente_id`).

> Os scripts do setup antigo (v1.x) ficam em **`database/_legado/`** — não são mais usados; a fonte atual é `migrations/`.

---

## Deploy (Vercel + Cloudflare)

1. **Vercel** — importar o repo, framework Next.js. Adicionar todas as variáveis de ambiente acima (Production). Cada push na `master` deploya.
2. **Domínio próprio via Cloudflare** — o cliente acessa por um domínio seu (ex.: `www.zioncompany.online`), com o **proxy do Cloudflare ligado (laranja)** e SSL **Full**. Isso evita problemas de rota/ISP com o `*.vercel.app` e dá uma URL profissional. Cadastre o domínio no Vercel (Settings → Domains) e crie o CNAME no Cloudflare.
3. **Redirect do ML** — `ML_REDIRECT_URI` (Vercel) **e** o Redirect URI do app ML devem ser **idênticos** ao domínio em uso (`https://SEU-DOMINIO/cliente/conectar-ml`).
4. **Supabase → Auth → URL Configuration** — Site URL = o domínio do deploy.

> **Gotcha do Vercel:** o deploy é bloqueado se o **autor do commit** não for uma conta GitHub ligada à Vercel. Use o e-mail (ou o `…@users.noreply.github.com`) da conta conectada como `git config user.email`.

---

## Estrutura

```
src/
  app/          # rotas (App Router)
    cliente/    # Portal do Cliente (/cliente/*)
    api/        # rotas de servidor (agentes, ml)
    ...         # painel da equipe (clientes, produtos, esteira, vendas…)
  components/
    client-portal/  # casca + componentes do portal
    layout/         # AppShell + nav da equipe
    ui/             # primitivas (Card, Button, StatCard, Table…)
  lib/
    agentes/     # catalogo (prompts A0–A12), esteira, provedorIA/Imagem
    marketplaces/# mercadolivre, mlPayload, mlUserProducts
    services/    # camada de dados (repositório → Supabase/localStorage)
    supabase/    # client + mappers + tipos das linhas
    types.ts, store.ts, format.ts, csv.ts, ...
database/
  migrations/   # 001…011 (fonte da verdade)
  _legado/      # setup antigo v1.x (histórico)
docs/           # notas (ex.: publicacao-mercado-livre.md)
```

**Arquitetura de dados:** as telas nunca acessam o banco direto — só os **serviços** (`src/lib/services`), que usam um **repositório** genérico (Supabase quando configurado; localStorage no modo demo). Escritas disparam `notificarMudanca()`; o `useLiveQuery` re-consulta as telas abertas. Segurança real no **RLS** do Supabase (`eh_equipe()` / `cliente_do_usuario()`).

---

## Modelo de produto (resumo)

- **Produto pai** (`produtos`): a ideia do produto — nome, marca, categoria, custo/preço/estoque (atalho do produto simples), `cod_erp`.
- **Variação/SKU** (`produto_variantes`): cada derivação vendável (cor+tamanho, SKU, EAN, custo, preço, estoque). É onde o estoque real vive nos produtos com variação.
- **Anúncio** (`anuncios` / `anuncios_gerados`): o produto publicado num marketplace.

O **SKU único** (código do ERP) atravessa ERP ↔ ML ↔ TikTok — é a chave que liga a base, o anúncio e a conciliação de estoque/venda.

---

## Limitações conhecidas

- Proteção de rota é client-side (adequada para ferramenta interna; os dados são protegidos pelo RLS no servidor).
- No modo demo (sem Supabase) não há login nem realtime; a IA só roda com `GEMINI_API_KEY`/`ANTHROPIC_API_KEY` no servidor.
- A publicação no modelo **User Products** está estruturada; a ativação no fluxo de publicar + teste de item real é o próximo passo.
