# 01 — Estado atual encontrado + Plano

## Estado atual (FATOS confirmados no código, antes de alterar)

**Arquitetura de auth (a descoberta que guiou tudo):**
- O Supabase roda **no navegador** (`src/lib/supabase/client.ts`, anon key). A sessão vive no browser; **as rotas `/api/*` não tinham sessão de servidor**. `@supabase/ssr` não é dependência.
- O worker usa `service_role` (`src/lib/supabase/admin.ts`).

**R1 confirmado:** `eh_equipe()` (`database/migrations/005-portal-cliente.sql:28-34`) usava `coalesce(..., true)` → **usuário autenticado sem `perfis` = equipe (acesso total)**. O fail-safe se repetia no cliente: `meuPerfil()` (`src/lib/services/perfil.ts`) e `AuthGate.tsx` caíam para equipe quando não achavam perfil. A tabela `perfis` (migração 005) **não tinha coluna `ativo`**.

**R3 confirmado:** o `refresh_token` do ML trafegava pelo navegador em **4 rotas**:
- `POST /api/ml/conectar` devolvia o `refreshToken`, e `conectar-ml/page.tsx` chamava `salvarCanal({refreshToken})`.
- `POST /api/ml/publicar` / `vendas` / `importar-anuncios` **recebiam** o `refreshToken` no corpo e **devolviam** o token rotacionado; os serviços do browser (`publicacaoML.ts`, `vendasML.ts`, `importarAnunciosML.ts`) liam `canal.refreshToken` e o reenviavam.
- `buscarCanal` fazia `select("*")` → expunha `refresh_token` ao browser.

**R6 confirmado:** a proteção era o `AuthGate` (client-side) + RLS. As rotas `/api/*` **não validavam sessão/escopo no servidor**.

**RLS relevante (para não quebrar):** migração 011 dá ao cliente política `cliente_escopo` em `canais_marketplace` (`cliente_id = cliente_do_usuario()`); migração 009 dá `equipe_total` (`eh_equipe()`). Logo, um cliente lê/escreve só o próprio canal; a equipe, todos.

## Plano executado (incremental e reversível)

1. **R1 (dados):** migração aditiva `016` — `perfis.ativo` (default true), `eh_equipe()`/`cliente_do_usuario()` **negam por padrão** e exigem perfil ativo. Nenhuma política reescrita (todas já referenciam as funções). Scripts de checagem/correção em `database/checks/`.
2. **R1 (UI):** `meuPerfil()` passa a devolver `null` (sem acesso) em vez de equipe; `AuthGate` mostra tela "sem acesso" para logado sem perfil válido.
3. **R6:** nova camada `src/lib/auth/serverAuthorization.ts` (valida o JWT enviado pelo browser, carrega o perfil real, decide 401/403). Helper de sessão no cliente (`src/lib/supabase/sessao.ts`) anexa `Authorization: Bearer`. Aplicada às 4 rotas ML (acesso ao cliente) e às 3 rotas de IA (autenticado).
4. **R3:** token 100% server-side. Novo módulo `src/lib/marketplaces/canalServidor.ts` lê/rotaciona o token via RLS com o token do usuário. As 4 rotas passam a receber `clienteId` (nunca o token) e nunca devolvem token. `buscarCanal` deixa de trazer `refresh_token`; `atualizarRefreshToken` do browser foi removido.

## Princípios seguidos
- Sem migração aplicada em produção; só arquivos.
- Sem renomear/apagar tabelas; `016` é aditiva e reversível.
- Alterações mínimas por arquivo; RLS continua como 2ª camada.
- Modo demonstração (sem Supabase) continua funcionando (fail-open só no demo).
- `organization_membership` **não** foi criado (não é necessário para R1; ver [08-PENDENCIAS](./08-PENDENCIAS.md)).
