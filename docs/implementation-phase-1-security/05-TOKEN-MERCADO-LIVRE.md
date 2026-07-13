# 05 — Refresh token do Mercado Livre (R3)

## Antes (problema)
O `refresh_token` (credencial de longa duração da conta ML do cliente) passava pelo navegador:
- `/api/ml/conectar` **devolvia** o token → o browser chamava `salvarCanal({refreshToken})`.
- `/api/ml/publicar|vendas|importar-anuncios` **recebiam** o token no corpo e **devolviam** o rotacionado.
- `buscarCanal` fazia `select("*")` → `refresh_token` chegava ao browser.

## Depois (corrigido)
O token existe **somente no servidor**. O navegador manda apenas identificadores + a sessão.

### Novo fluxo de conexão (OAuth)
1. Browser recebe o `code` do ML (callback) e chama `POST /api/ml/conectar` com `{ code, clienteId, redirectUri }` + `Authorization: Bearer`.
2. Servidor autoriza (`exigirAcessoAoCliente`), troca o `code` por tokens (segredo do app no env) e **salva o refresh_token no canal** via `salvarRefreshTokenServidor` (RLS).
3. Resposta: `{ ok: true, sellerId }` — **sem token**.

### Novo fluxo de uso (publicar / vendas / importar)
1. Browser chama a rota com `{ clienteId, ... }` (ex.: `{ clienteId, payload, go }`) + `Authorization: Bearer`.
2. Servidor autoriza, **lê** o refresh_token do canal (`lerCanalServidor`, RLS), **renova** o access token, faz a operação e **persiste** o refresh_token rotacionado (`atualizarRefreshTokenServidor`).
3. Resposta **sem** token (ex.: `{ dry, id, permalink, status, sellerId }`).

### Módulo server-only — `src/lib/marketplaces/canalServidor.ts`
`lerCanalServidor` · `salvarRefreshTokenServidor` · `atualizarRefreshTokenServidor`, todos usando o cliente Supabase **com o token do usuário** → o RLS garante que o cliente só toca o próprio canal (migração 011) e a equipe qualquer (migração 009).

### Sanitização do lado do navegador — `src/lib/services/canaisMarketplace.ts`
- `CanalMarketplace` (público) **não tem** `refreshToken`. `buscarCanal`/`salvarCanal` selecionam só colunas públicas (`id, cliente_id, marketplace, seller_id, tipo_anuncio, ativo`).
- "Conectado" passa a ser `canal.ativo` (o token existe, mas fica no servidor).
- `atualizarRefreshToken` (browser) foi **removido**.
- Desconectar (`salvarCanal({ ativo:false })`) limpa o `refresh_token` no servidor (escrita de `null` — não é exposição).

## O que NÃO mudou
- Dry-run continua igual (o builder `mlPayload` é puro e roda no browser sem segredo).
- Modelo clássico × User Products **não** foi tocado (fora de escopo).
- Não há fila de publicação nesta fase (fora de escopo).

## Garantias de não-vazamento (verificado por grep + typecheck)
- Nenhuma rota inclui `refreshToken` na `Response.json`.
- Nenhum arquivo do navegador (`src/lib/services/*`, `src/app/cliente/*`) lê `canal.refreshToken` ou envia token no corpo.
- Referências a `refresh_token` restam **apenas** em código server-only (`src/app/api/ml/*`, `canalServidor.ts`).
- Tokens não vão para logs nem para mensagens de erro (as respostas de erro carregam só texto genérico).
