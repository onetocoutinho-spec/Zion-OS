# 04 — Autorização server-side (R6)

## Contexto
O Supabase roda no navegador; as rotas `/api/*` não tinham sessão. Para autorizar no servidor sem reescrever a base para SSR, o **navegador envia o access_token** (JWT) no header `Authorization: Bearer` e o servidor **valida esse token** e carrega o **perfil real** do banco. Nunca confiamos em `papel`/`clienteId` vindos do corpo.

## Peças

### Cliente — `src/lib/supabase/sessao.ts`
`cabecalhoAutenticacao(): Promise<Record<string,string>>` devolve `{ Authorization: "Bearer <jwt>" }` quando há sessão; `{}` no modo demo/sem sessão. Usado por todos os serviços que chamam `/api/*` sensíveis.

### Servidor — `src/lib/auth/serverAuthorization.ts`
Funções **puras** (testadas, ver [06-TESTES](./06-TESTES.md)):
- `lerTokenBearer(header)` → extrai o JWT (aceita `bearer` minúsculo, apara espaços; rejeita outros esquemas).
- `avaliarAcesso({ perfil, regra, clienteAlvo })` → decide `{ ok }` ou `{ ok:false, status: 401|403, motivo }`. Regras: sem perfil/inativo = 403; `equipe`/`cliente` exigem o papel; `clienteAlvo` → equipe acessa qualquer, cliente só o próprio (senão 403, **sem revelar** se o recurso existe).

Funções de IO / guardas:
- `obterUsuarioAutenticado(req)` → valida o token via `auth.getUser(token)`.
- `obterPerfilDoUsuario(supabase, userId)` → lê `perfis` via RLS (o usuário lê o próprio perfil).
- `exigirAutenticado(req)` · `exigirEquipe(req)` · `exigirCliente(req)` · `exigirAcessoAoCliente(req, clienteId)` → lançam `ErroAutorizacao{status}`.
- `respostaErroAutorizacao(e)` → converte em `Response` (401/403; erro inesperado → 500 sem vazar detalhe).
- **Modo demo** (Supabase não configurado): as guardas liberam (contexto "equipe"), preservando o comportamento sem login.

O contexto devolvido inclui um cliente Supabase **com o token do usuário** (`supabase`) — as consultas subsequentes (ex.: ler o canal) respeitam o RLS, servindo de **2ª camada**.

## Onde foi aplicado

| Rota | Guarda | Motivo |
|------|--------|--------|
| `POST /api/ml/conectar` | `exigirAcessoAoCliente(req, clienteId)` | só conecta o próprio cliente (equipe: qualquer) |
| `POST /api/ml/publicar` | `exigirAcessoAoCliente(req, clienteId)` | publica só para clientes permitidos |
| `POST /api/ml/vendas` | `exigirAcessoAoCliente(req, clienteId)` | lê vendas só de clientes permitidos |
| `POST /api/ml/importar-anuncios` | `exigirAcessoAoCliente(req, clienteId)` | importa só de clientes permitidos |
| `POST /api/agentes/esteira` | `exigirAutenticado` | IA paga: barra chamada sem sessão |
| `POST /api/agentes/executar` | `exigirAutenticado` | idem |
| `POST /api/imagens/gerar` | `exigirAutenticado` | idem |

## Garantias
- `401` quando não autenticado; `403` quando autenticado sem permissão.
- Um `clienteId` "chutado" pelo navegador **não** burla nada: o perfil é lido do banco pelo `auth.uid()` do token, e um cliente só passa se `perfil.clienteId === clienteId`.
- O `AuthGate` continua para UX, mas **não é mais a única proteção** (servidor + RLS).

## Fora de escopo nesta fase
As demais rotas de leitura/escrita de dados do domínio (produtos/anúncios via repositório no browser) continuam protegidas **pelo RLS** (a via principal do app). Estender guardas server-side a todas elas é evolução futura ([08-PENDENCIAS](./08-PENDENCIAS.md)).
