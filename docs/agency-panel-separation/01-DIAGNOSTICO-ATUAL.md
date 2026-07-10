# 01 — Diagnóstico (por que a equipe aparecia no ambiente do cliente)

Todos os itens são **FATO** com arquivo/linha (estado antes da correção).

## Arquitetura de layout (antes)
- `src/app/layout.tsx` envolve tudo em `<AuthGate><AppShell>{children}</AppShell></AuthGate>`.
- `AppShell` (casca da equipe) renderiza a sidebar da agência (`NAV_ITEMS`), **exceto** para `/cliente/*`, onde retornava só `{children}` (`AppShell.tsx:77`).
- `src/app/cliente/layout.tsx` envolve `/cliente/*` em `ClientPortalShell` (casca do cliente).
- `AuthGate` decidia o papel: `cliente` → `ClienteGate` (redirige para `/cliente`); `equipe` → renderiza `children` **sem redirecionar**.

## Causa raiz nº 1 — sem guarda para a equipe em `/cliente`
`AuthGate` (antes) só tinha `ClienteGate`, que age quando `papel === "cliente"`. **Não havia** guarda para o papel *equipe*. Consequência: um usuário **equipe** com a URL em `/cliente/*` (deixada de um teste, um link, o histórico do navegador) caía na casca do cliente:
- `AppShell.tsx:77` retornava `{children}` (sem a sidebar da equipe);
- `cliente/layout.tsx` aplicava `ClientPortalShell`;
- `ClientPortalShell` resolve `clienteId` via `meuPerfil()` → para equipe é `null` → o portal mostrava "Minha Loja" vazio.

Resultado: **a experiência visual ficava igual ao Portal do Cliente**, exatamente o sintoma relatado. E como não há redirecionamento pós-login para a equipe, ela permanecia lá.

## Causa raiz nº 2 (latente) — `/clientes` confundido com `/cliente`
`AppShell.tsx:77` usava `pathname.startsWith("/cliente")` **sem barra final**. Isso também casa com **`/clientes`** (a lista de clientes da agência), fazendo o `AppShell` **remover a casca da equipe** nessa rota — a página de Clientes ficava sem sidebar. (O `ClienteGate` já usava a forma correta com barra, `"/cliente/"`, então esse bug estava só no `AppShell`.)

## Como o sistema diferencia equipe × cliente (antes e depois)
- `meuPerfil()` (`src/lib/services/perfil.ts`) lê `perfis.papel`/`cliente_id`/`ativo` (via RLS). Sem perfil/inativo → `null` (= sem acesso, desde a Etapa 1/016).
- `AuthGate` usa esse perfil para escolher a casca. O **corte de dados** real é o RLS (016) — inalterado.

## Respostas às perguntas da Parte 1
- **Para onde vai após o login?** Ficava na rota atual (sem redirect por papel). Se fosse `/cliente`, via a casca do cliente.
- **Como diferencia equipe/cliente?** Por `perfis.papel` (via `meuPerfil`).
- **Equipe sendo mandada para `/cliente`?** Não mandada, mas **não impedida** de ficar lá.
- **Mesmo menu para os dois?** Não — `AppShell`/`NAV_ITEMS` (equipe) × `ClientPortalShell`/`MENU` (cliente) já são separados. O problema era a equipe entrar na casca do cliente.
- **Redirect baseado só em rota salva?** Não há rota salva em localStorage (só dados de demo em `store.ts`). O "grude" vinha da URL/sessão do navegador.
- **Sessão anterior mantém na área errada?** Sim: sem guarda para equipe, uma URL `/cliente` anterior mantinha a equipe na casca do cliente.

## Correção (resumo; detalhe em 02)
Guarda unificada `RoteadorPapel` no `AuthGate` usando a regra pura `decidirRota`: **equipe em `/cliente/*` → redireciona para `/`** (Painel da Agência); cliente fora de `/cliente/*` → `/cliente`; perfil incompleto/inativo → "Acesso não liberado". E `AppShell` passa a usar `estaNoPortalCliente` (com barra final) — `/clientes` volta a ter a casca da equipe.
