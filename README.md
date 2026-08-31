# Zion OS

**Zion OS** é o produto da **Zion**, empresa de software. É um sistema **multi-inquilino** para vender em marketplaces (Mercado Livre, TikTok Shop, Shopee, Amazon): importar a base, gerar e otimizar anúncios com IA, publicar e acompanhar as vendas.

Quem compra:

- **Lojas com equipe própria** — uma loja, operada por quem é dono dela.
- **Agências** — operam a carteira de várias lojas na mesma conta. Inclusive agências que antes concorriam com a Zion.

Por isso o app tem **dois formatos de conta** — não dois ambientes de uma agência:

- **Conta de loja** (`/cliente/*`, papel `cliente`) — a loja opera a si mesma: importa a base, otimiza anúncios com IA, gera fotos, conecta o Mercado Livre, publica e acompanha as vendas. É **isolada** da casca de operador (o `AuthGate` redireciona).
- **Conta de agência** (papel `agencia`) — a casca de carteira, que responde "quais lojas eu opero?": lista de lojas, esteira, auditoria em massa, produtos, pendências, vendas e relatórios. A agência alcança **só as lojas dela** (`clientes.agencia_id`), e quem decide isso é o servidor, não o navegador (`avaliarAcesso` em `src/lib/auth/serverAuthorization.ts` + RLS).

O papel `equipe` é a **Zion como fornecedora do software**, não como agência: divide a casca de operador com a agência e vê a mais o grupo **Zion** do menu — agentes de IA, modelos de categoria, agências, usuários, configurações (`src/components/layout/nav.ts`). A decisão de rota por papel é pura e testável (`src/lib/auth/roteamentoPapel.ts`); a segurança real é o RLS + a autorização no servidor.

> **Estado hoje:** existe **uma única conta pagante**, herdada da época em que a Zion operava como agência. A agência acabou; o que se vende é o software.

---

## Principais recursos

O que muda entre os formatos de conta é **quem opera** — a lista de recursos é a mesma.

**Esteira de Anúncio (IA).** Os prompts reais dos agentes **A0–A12** vivem em `src/lib/agentes/catalogo.ts` (fonte única) e alimentam:
- a esteira em **modo rápido** (uma passada) e **aprofundado** (multi-agente, um agente por chamada, com barra de progresso);
- as **ferramentas da conta de loja** (`/cliente/otimizar`) — cada ferramenta roda o agente correspondente;
- a tela **Agentes IA** (`/agentes`), que é do grupo Zion.
Produz o anúncio completo (título ≤60, descrição, ficha, medidas, variações, imagens, FAQ) + pendências + **veredito A10** (trava: só aprova sem pendências).

**Integração Mercado Livre (`src/lib/marketplaces/`, `src/modules/integration/`, `/api/ml/*`).**
- **Conectar** — OAuth: a loja autoriza a própria conta do ML; o `refresh_token` fica no `canais_marketplace`. O segredo do app ML vive só no servidor.
- **Publicar** — **dry-run 100% local** e depois envio real. O payload é montado no navegador por um builder puro e sem segredo (`montarItemML`, em `src/modules/integration/domain/mlPayload.ts`), então quem opera a conta revê **o mesmo payload que vai subir** antes de subir — a equipe da lojista ou a da agência que atende aquela loja, nunca a Zion. O envio real vai para `/api/ml/publicar`, a única ponta que conhece o segredo do app ML e lê o `refresh_token` do canal (que nunca trafega pelo navegador). Suporta o modelo **User Products** (`mlUserProducts.ts`) exigido por categorias de calçado, com criação da guia de tamanhos: o bundle vai junto sempre que dá para montá-lo, e o servidor só o usa se a categoria prevista exigir esse modelo.
- **Vendas** — puxa os pedidos pagos reais e calcula faturamento, lucro líquido (cruzando com os custos), taxas, ticket médio, mais vendidos (`/cliente/vendas` e `/vendas`).
- **Vinculação** — exporta o CSV **SKU ↔ MLB** para a loja importar no ERP dela.

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
| `OPENAI_API_KEY` | servidor | a IA do projeto (ChatGPT): texto, chat, PDF e imagem. Padrão desde 23/08/2026 |
| `ANTHROPIC_API_KEY` | servidor | opcional — Claude, só com `IA_PROVEDOR=anthropic` |
| `ML_CLIENT_ID` / `ML_CLIENT_SECRET` | servidor | app do Mercado Livre (DevCenter) |
| `ML_REDIRECT_URI` | servidor | `https://SEU-DOMINIO/cliente/conectar-ml` — idêntico ao Redirect URI do app ML |

As `NEXT_PUBLIC_*` e o `ML_*`/`GEMINI_*` são lidos no **build/deploy** — ao alterar na Vercel, é preciso **Redeploy**.

---

## Banco de dados (Supabase)

As migrações ficam em **`database/migrations/`** — hoje **75 arquivos**, de `001` a `074`. Uma tabela com as 75 linhas envelheceria a cada PR e ninguém a leria; o que vem abaixo é onde a verdade mora, a ordem que não perdoa e os marcos que explicam o produto de hoje.

### Quem manda: o ledger

`public.migracoes_aplicadas` é a **fonte da verdade** sobre o que já rodou — criada na **024**, com a regra estabelecida na **043**: cada migração insere a própria linha como **última instrução do próprio arquivo**. Se rodou, a linha existe; não é disciplina de processo, é conteúdo do arquivo.

```sql
select numero, nome, aplicada_em from public.migracoes_aplicadas order by numero;
```

`supabase_migrations.schema_migrations` **não** é a fonte da verdade: é log da plataforma, só conhece o que passou pelo `apply_migration` e nada sabe do que foi rodado à mão no SQL Editor.

> ⚠️ **A regra está furada hoje:** as migrações **071, 072, 073 e 074 não registram a própria linha**. Até isso ser corrigido, o ledger está atrasado em quatro — e a lição da 035 vale de novo: confira o schema em vez de acreditar no registro.

### Nem tudo em `migrations/` é migração de schema

Três tipos de arquivo dividem a mesma pasta e a mesma numeração:

- **Migrações de schema** — a maioria; idempotentes (`if not exists`) e aditivas.
- **Reparos de dado, uma vez só** — **030**, **031** e **032** consertam a base do **primeiro lojista**, com números medidos naquela base específica (`1.733 de 1.806 produtos`). Não fazem parte da montagem de um banco novo. A **032 se declara `DESTRUTIVA E IRREVERSÍVEL`**: apaga os produtos que entraram por planilha, sem lixeira.
- **Provas de isolamento** — `054-verificacao-do-isolamento.sql` e `055-verificacao-do-ticket.sql` não alteram nada: rodam dentro de uma transação que termina em `rollback`. São seguras em produção, e é para rodá-las **depois** da migração homônima.

### Ordem de aplicação, e as duas armadilhas

Rode em ordem numérica no SQL Editor. Duas coisas quebram se a ordem for ingênua:

1. **A 016 exige os perfis ANTES.** Ela inverte o RLS para **negar por padrão** — antes, "usuário sem perfil" era lido como equipe, com acesso total. Rodar a 016 antes de cadastrar os perfis **tira o acesso da equipe**. A ordem correta está no cabeçalho do arquivo: `database/checks/check-users-without-profile.sql` (diagnóstico) → cadastrar todos os perfis com `fix-missing-profiles-template.sql` → conferir que não sobrou ninguém → só então a 016.
2. **A numeração pula de 016 para 022, de propósito.** As **017–021** (a fundação canônica "Produto Mestre") estão em `database/migrations/arquivadas/`: nada ali foi aplicado, e nada deve ser aplicado sem reabrir a decisão. Os números estão gastos e não são reciclados — reciclar faria duas migrações responderem pelo mesmo número, que é o problema que a 043 fechou. Razão completa no [ADR-011](docs/decisions/ADR-011-arquivar-a-fundacao-canonica-017-021.md).

### Os marcos

| # | O que mudou |
| --- | --- |
| 001–015 | a base: produto pai × variação × anúncio, auditoria em massa, esteira, portal do cliente, canal do ML, imagens, medidas, kits |
| **016** | **o RLS passa a negar por padrão** — sem perfil, sem acesso |
| 022–028 | o Zion observando a si mesmo: decisões, padrões, ofertas, delegação |
| 024 · 043 | o ledger de migrações, e a regra que o mantém honesto |
| 033 · 034 | os custos do lojista e quem paga o frete — a base do lucro líquido |
| 035–040 · 044–048 | o Copilot: conversa, propostas e execução atômica (peso, custo, preço, título) |
| 041 | fecha o RLS que a 005 tinha deixado aberto |
| **054 · 054a · 055a · 055b** | **a agência como inquilino**: tabela `agencias`, `clientes.agencia_id`, `perfis.agencia_id` — e financeiro, tarefas e reuniões **fora** do alcance dela |
| 055 | o `state` do OAuth do ML vira ticket verificável |
| 059 · 061 · 062 | a credencial do ML sai do alcance do navegador e passa a ser cifrada em repouso |
| 060 · 063 | a cota de IA é cobrada no servidor — por mês e por minuto |
| 064–074 | a loja em operação: tarefas, perfil de conteúdo, versões de imagem, execuções de IA, investigações do Copilot |

### O resto de `database/`

| Pasta | O que é |
| --- | --- |
| `checks/` | diagnóstico e backfill de perfis; diagnóstico das migrações em produção |
| `verificacoes/` | `alcance-da-agencia.sql` — a varredura que confere, tabela a tabela, o que a agência alcança |
| `staging/` | bootstrap de um banco de staging, com guardrail que aborta se o banco não estiver marcado como `staging` (ver `database/staging/README.md`) |
| `manutencao/` | correções pontuais e datadas |
| `_legado/` | o setup v1.x — histórico; a fonte atual é `migrations/` |

### Depois das migrações: as contas

**Auth → Users** cria o usuário; o acesso vem da linha correspondente em **`perfis`**, e a 054 impõe por `check` uma das três formas:

| Papel | Exige | É |
| --- | --- | --- |
| `cliente` | `cliente_id`, sem `agencia_id` | conta de loja |
| `agencia` | `agencia_id`, sem `cliente_id` | conta de agência (alcança as lojas com aquele `clientes.agencia_id`) |
| `equipe` | nenhum dos dois | a Zion, fornecedora do software |

Usuário sem perfil não entra — desde a 016 isso é o comportamento correto, não um defeito.

---

## Deploy (Vercel + Cloudflare)

1. **Vercel** — importar o repo, framework Next.js. Adicionar todas as variáveis de ambiente acima (Production). Cada push na `master` deploya.
2. **Domínio próprio via Cloudflare** — **um domínio para todo mundo**: lojas, agências e equipe entram pelo mesmo endereço (ex.: `www.zioncompany.online`), com o **proxy do Cloudflare ligado (laranja)** e SSL **Full**. Isso evita problemas de rota/ISP com o `*.vercel.app` e dá uma URL profissional. Cadastre o domínio no Vercel (Settings → Domains) e crie o CNAME no Cloudflare.
3. **Redirect do ML** — `ML_REDIRECT_URI` (Vercel) **e** o Redirect URI do app ML devem ser **idênticos** ao domínio em uso (`https://SEU-DOMINIO/cliente/conectar-ml`).
4. **Supabase → Auth → URL Configuration** — Site URL = o domínio do deploy.

> **Por que um domínio só, e não um por inquilino.** A sessão vive no `localStorage` (`createClient` sem opções, em `src/lib/supabase/client.ts`), que é escopado por **origem**. Se o operador entra por um domínio e o Mercado Livre devolve o código em outro, a página de callback roda numa origem sem sessão: `cabecalhoAutenticacao()` volta vazio e `/api/ml/conectar` responde 401 — a conexão não fecha. Dar um domínio a cada inquilino também multiplicaria os Redirect URIs registrados no DevCenter, e **um app ML por domínio é pior ainda**: o `refresh_token` é emitido atado ao `client_id`, então trocar de app obriga *toda* loja conectada a reconectar (foi o incidente `the client_id does not match the original`, 06/08/2026 — ver `src/modules/integration/domain/credencialRecusada.ts`). Domínio de vaidade por inquilino, se um dia for pedido, é redirect de marketing para este endereço — nunca a origem onde o app roda.

> **Gotcha do Vercel:** o deploy é bloqueado se o **autor do commit** não for uma conta GitHub ligada à Vercel. Use o e-mail (ou o `…@users.noreply.github.com`) da conta conectada como `git config user.email`.

---

## Estrutura

```
src/
  app/          # rotas (App Router)
    cliente/    # conta de loja (/cliente/*)
    api/        # rotas de servidor (agentes, ml)
    ...         # casca de operador — agência/equipe (lojas, produtos, esteira, vendas…)
  components/
    client-portal/  # casca + componentes da conta de loja
    layout/         # AppShell + nav do operador (por papel)
    ui/             # primitivas (Card, Button, StatCard, Table…)
  lib/
    agentes/     # catalogo (prompts A0–A12), esteira, provedorIA/Imagem
    marketplaces/# mercadolivre (cliente HTTP do ML)
    services/    # camada de dados (repositório → Supabase/localStorage)
    supabase/    # client + mappers + tipos das linhas
    types.ts, store.ts, format.ts, csv.ts, ...
  modules/       # domínio por área (integration: mlPayload/mlUserProducts; publication; assistant…)
database/
  migrations/   # 001…074 (+ arquivadas/ 017–021, não aplicadas)
  checks/       # diagnóstico e backfill de perfis
  verificacoes/ # provas de alcance por papel
  staging/      # bootstrap de um banco de staging
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

- A proteção de rota no navegador é só experiência de UI. As camadas reais são a autorização no servidor (`src/lib/auth/serverAuthorization.ts`) e o RLS do Supabase — o que importa num produto multi-inquilino, onde a conta de agência e a conta de loja compartilham o mesmo banco.
- No modo demo (sem Supabase) não há login nem realtime; a IA só roda com `OPENAI_API_KEY` (ou `ANTHROPIC_API_KEY`/`GEMINI_API_KEY`) no servidor.
- A publicação no modelo **User Products** já vai junto no fluxo de publicar (o servidor a usa quando a categoria prevista exige); o teste de item real em produção é o próximo passo.
