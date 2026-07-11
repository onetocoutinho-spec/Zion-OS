# Correção F-01 — criação consistente de usuário (Auth) + perfil

> Escopo: **somente** F-01. Não altera migrações/RLS, nem a integração ML, nem outros itens. Branch `fix/staging-stabilization` (a partir de `b2ce740`).

## Causa raiz
**Não existia fluxo de criação de usuário no app.** Varredura confirmou: nenhum `auth.admin.createUser`/`inviteUserByEmail`/`signUp`; `perfis` era apenas **lido** (`serverAuthorization`, `perfil.ts`), nunca inserido pelo código. Usuários eram criados **à mão** no dashboard do Supabase Auth e os perfis via **SQL** (templates de staging). Isso abria margem para: usuário no Auth **sem** perfil; perfil para usuário inexistente; cliente **sem** empresa; criação duplicada; e registros órfãos por falha parcial.

> Modelo real do projeto (usado sem inventar tabelas): papel ∈ {`equipe`,`cliente`} em `public.perfis`; cliente escopado por `cliente_id`. **Não há `team_id`/`company_id`/`profiles`** — o "tenant" é a própria agência Zion, governada por `eh_equipe()`. "Empresa do mesmo team" = a `clientes` existe.

## Fluxo anterior
Manual, em 2 passos desacoplados (Auth no dashboard + `INSERT perfis` no SQL Editor), sem autorização de app, sem validação, sem idempotência, sem compensação.

## Fluxo novo (único, server-side)
Endpoint **`POST /api/usuarios`** (`src/app/api/usuarios/route.ts`):
1. **Autoriza** com `exigirEquipe(request)` → **só EQUIPE**. Cliente → **403**; sem sessão → **401**.
2. **Valida** o payload com `validarPayloadNovoUsuario` (rejeita campos privilegiados/desconhecidos).
3. Executa `criarUsuarioComPerfil` (lógica pura, deps injetadas) usando o **Supabase Admin (`service_role`, server-only)**:
   - valida a empresa (para cliente) → checa duplicidade por e-mail → **convida** no Auth → **cria o perfil** → **compensa** se o perfil falhar.
4. Responde **sanitizado** por tipo (nunca senha/token/sessão/service_role).

**Decisão criação × convite:** **convite** (`inviteUserByEmail`) — o usuário define a própria senha pelo link; o servidor **nunca** manuseia nem retorna senha. (Se o SMTP do Supabase de staging não estiver configurado, o convite falha e o endpoint responde erro genérico 500 — trocar para `createUser` seria a alternativa, mas exigiria tratar senha; mantivemos o convite por segurança.)

## Autorização aplicada
- `exigirEquipe` (camada `serverAuthorization`, Etapa 1): valida o JWT do solicitante (header `Authorization: Bearer`), carrega o **perfil real** e exige `papel='equipe'` ativo. **Cliente não cria usuários.**
- O **`service_role`** é usado **só no servidor** (nunca vai ao navegador). O navegador manda apenas `{ nome, email, papel, clienteId? }`.

## Como o "team_id" é derivado
Não há `team_id` no modelo. A autorização de tenant é: **só equipe cria**, e o vínculo do novo perfil é o `cliente_id` informado (validado). Não se confia em nenhum `team_id`/`user_id`/privilégio vindo do navegador — esses campos são **rejeitados** pela validação.

## Como cliente/empresa é validado
- Para `papel='cliente'`: `clienteId` obrigatório, **UUID válido**, e a empresa deve **existir** em `clientes` (`empresaExiste`) — senão **404 "Empresa não encontrada."** (resposta segura, não revela outros tenants).
- Para `papel='equipe'`: `clienteId` deve ser ausente/null (se vier valor → 400).

## Estratégia compensatória (consistência sem transação única)
Auth e `perfis` não estão na mesma transação. Ordem: cria no Auth → cria o perfil. Se o **perfil falhar**, tenta **remover o usuário recém-criado** (só ele) → resultado `falha_perfil` (500 "tente novamente"). Se a **remoção também falhar** → `inconsistente` (500 "contate o suporte") + log server-side **só com o `user_id`**. **Nunca** remove usuário pré-existente.

## Tratamento de duplicidade / idempotência
Antes de criar, checa e-mail no Auth (`buscarAuthPorEmail`). Se já existe → `ja_existe` (**409**, "Este e-mail já tem cadastro."), **sem** criar segundo usuário. Clique duplo é barrado na UI (botão desabilitado durante o envio) e no servidor (a checagem por e-mail é idempotente).

## Respostas (sanitizadas)
| Situação | HTTP | Corpo |
|----------|------|-------|
| Criado (convite) | 201 | `{ ok:true, status:"convidado" }` |
| E-mail já cadastrado | 409 | `{ ok:false, status:"ja_cadastrado", erro }` |
| Empresa não encontrada | 404 | `{ erro }` |
| Perfil falhou (compensado) | 500 | `{ erro }` |
| Inconsistente (intervir) | 500 | `{ erro }` |
| Payload inválido | 400 | `{ erro, campo }` |
| Cliente/sem sessão | 403/401 | `{ erro }` |

## Logs (seguros)
Server-side apenas: `[usuarios] convite criado {papel}` / `falha inesperada {papel}` / `estado inconsistente {userId}`. **Nunca** senha, token, sessão, service_role, headers, objeto do usuário ou resposta crua do Supabase.

## Arquivos alterados
| Arquivo | Papel |
|---------|-------|
| `src/lib/services/usuarios.ts` (novo) | Validação + orquestração **puras** (deps injetadas). |
| `src/lib/services/usuarios.test.ts` (novo) | 14 testes com mocks. |
| `src/app/api/usuarios/route.ts` (novo) | Endpoint `POST` (exigirEquipe + admin). |
| `src/app/usuarios/novo/page.tsx` (novo) | Tela mínima da agência (form). |
| `src/components/layout/nav.ts` | Item "Novo Usuário" → `/usuarios/novo`. |

## Limitações
- **Convite depende de SMTP** configurado no Supabase de staging; sem isso, o convite falha (erro genérico). Alternativa `createUser` exigiria manusear senha — não adotada.
- `buscarAuthPorEmail` usa a 1ª página de `listUsers()` (staging tem poucos usuários); paginação é melhoria futura.
- Sem transação real entre Auth e DB (por natureza do Supabase) — mitigado por compensação.
- Testes cobrem a lógica pura (validação/orquestração/estados); teste de componente/E2E fica para quando houver framework.

## Roteiro de teste manual no Preview (staging, nunca produção)
Logado como **equipe**, em `/usuarios/novo`:
1. **Criar equipe**: nome + e-mail novo + papel "Equipe" → "Convite enviado…"; formulário limpa.
2. **Criar cliente**: papel "Cliente" + selecionar empresa → "Convite enviado…".
3. **E-mail repetido**: reenviar o mesmo e-mail → "Este e-mail já tem cadastro." (não duplica).
4. **Cliente sem empresa**: papel "Cliente" sem selecionar empresa → o `required` do form barra; via API direta → 400.
5. **Duplo clique**: o botão fica desabilitado ("Enviando…") — não cria dois.
6. **Papel/e-mail inválidos** (via API): 400 com `campo`.
7. **Autorização**: logado como **cliente**, chamar `POST /api/usuarios` → **403**; sem sessão → **401**.
8. **DevTools/Network**: a resposta **nunca** contém senha/token/service_role.
9. Conferir no Supabase que o usuário do Auth tem a linha correspondente em `perfis` (sem órfãos).

## Aceitação do convite (definir senha) — complemento
Auditoria do fluxo de aceitação: o `inviteUserByEmail` não tinha `redirectTo` e **não existia página de definição de senha** (cenário E: página faltando + redirect não configurado). Correção mínima adicionada:

- **Página pública `/definir-senha`** (`src/app/definir-senha/page.tsx`): só funciona com a sessão criada pelo convite (o supabase-js detecta o token da URL); campos nova senha + confirmação (mín. 8, com conferência); botão bloqueado no envio; atualiza via `supabase.auth.updateUser({ password })` **no cliente** (a senha **nunca** vai a nenhuma API própria nem a logs); após o sucesso, carrega o perfil e redireciona (**equipe → `/`**, **cliente → `/cliente`**); link inválido/expirado → mensagem genérica.
- **`redirectTo` server-side OBRIGATÓRIO** (endurecido): montado por `montarRedirectConvite(process.env.APP_URL)` — usa só a **origin** da env + a rota fixa `/definir-senha`, **exige https** e rejeita path/query/fragment/valores inválidos. Nunca vem de valor livre do navegador → **sem open redirect**.
- **Allowlist**: `/definir-senha` é isenta do gate de perfil (`AuthGate`) e da casca da equipe (`AppShell`), para o convidado não cair no painel antes de definir a senha.

### Endurecimento da URL de convite (por que trocamos `NEXT_PUBLIC_APP_URL` por `APP_URL`)
- `NEXT_PUBLIC_*` é **embutida no build** do Next. Se a variável faltasse (ou o Preview fosse antigo), `process.env.NEXT_PUBLIC_APP_URL` virava `undefined`, `redirectTo` ficava `undefined` e o convite caía **silenciosamente no Site URL** (base, sem `/definir-senha`).
- Agora usamos **`APP_URL`** — **server-only** (sem `NEXT_PUBLIC_`, nunca vai ao navegador; confirmado que nenhum componente cliente a usava). O endpoint só é **SOMENTE SERVIDOR**.
- **Falha segura:** se `APP_URL` estiver ausente/ inválida/ não-https, o handler **não** chama `inviteUserByEmail`, **não** cria usuário no Auth nem perfil, e responde **503** com a mensagem pública genérica *"O envio de convites está temporariamente indisponível."*, registrando só o código sanitizado **`APP_URL_INVALIDA`** (sem o valor). `redirectTo` **nunca** é `undefined`.
- **Configuração na Vercel (escopo Preview):** `APP_URL=https://<VERCEL_PREVIEW_URL>` (https, só a origin, sem barra no fim) e **Redeploy** (env server-side também é lida no runtime, mas o deploy precisa existir a partir do commit desta correção). Nunca a URL de produção no staging.
- **Configuração no Supabase Staging:** adicionar `https://<VERCEL_PREVIEW_URL>/definir-senha` em Authentication → URL Configuration → **Redirect URLs** (e Site URL = `https://<VERCEL_PREVIEW_URL>`), senão o Supabase ignora o `redirectTo` e usa o Site URL.

**Configuração necessária no Supabase Staging** (Authentication → URL Configuration → Redirect URLs), sem alterar o dashboard aqui:
```
<VERCEL_PREVIEW_URL>/definir-senha
```
(e o Site URL = `<VERCEL_PREVIEW_URL>`). Substituir `<VERCEL_PREVIEW_URL>` pela URL estável do Preview da branch.

Testes adicionados (`src/lib/auth/definirSenha.test.ts`, 9): senha curta → erro; confirmação diferente → erro; válida → ok; equipe → `/`; cliente → `/cliente`; redirectTo usa a origin + rota fixa; ignora path/query arbitrário; env vazia → null; URL inválida/esquema não-http(s) → null. (Convite-sem-sessão, sucesso e link-expirado são comportamentos de runtime da página — no roteiro manual.)
