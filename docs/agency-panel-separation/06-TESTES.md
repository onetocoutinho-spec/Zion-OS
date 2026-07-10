# 06 — Testes

## Executados nesta máquina (resultado real)

### Typecheck — ✅
```
npx tsc --noEmit    → exit 0
```

### Unit (lógica pura de rota por papel) — ✅ 10/10
```
node --test src/lib/auth/roteamentoPapel.test.ts   → tests 10 · pass 10 · fail 0
```
Cobre (mapeando a Parte 7):
- **equipe → Painel da Agência**: `equipe + "/"` → ok; `equipe + "/clientes"` → ok (não é portal).
- **equipe não fica presa no cliente**: `equipe + "/cliente"` e `/cliente/produtos` → redirect `/`.
- **cliente → Portal do Cliente**: `cliente + "/cliente(/…)"` → ok.
- **cliente não acessa rota da equipe**: `cliente + "/"`, `/clientes`, `/financeiro` → redirect `/cliente`.
- **sem perfil → bloqueio**: `null` → sem_acesso.
- **perfil inativo → bloqueio**: `ativo=false` → sem_acesso.
- **cliente sem empresa → bloqueio**: `clienteId=null` → sem_acesso.
- **`/clientes` ≠ `/cliente`**: `estaNoPortalCliente("/clientes")` = false (evita remover a casca da equipe).

### Regressão (Etapa 1) — ✅ 13/13
```
node --test src/lib/auth/serverAuthorization.test.ts   → pass 13
```

### Lint — ✅ 0 erros
```
npm run lint   → 0 errors, 49 warnings (pré-existentes, não introduzidos aqui)
```

## Cobertura dos cenários da Parte 7 (via testes puros)
| # | Cenário | Coberto por |
|---|---------|-------------|
| 1 | Equipe → Painel da Agência | decidirRota (equipe, "/") = ok; (equipe, "/cliente") = redirect "/" |
| 2 | Cliente → Portal do Cliente | decidirRota (cliente, "/cliente") = ok |
| 3 | Sem perfil → "Acesso não liberado" | decidirRota(null) = sem_acesso (+ `TelaSemAcesso` no AuthGate) |
| 4 | Perfil inativo → bloqueado | decidirRota(ativo=false) = sem_acesso |
| 5 | Cliente não abre rota admin | decidirRota (cliente, "/…") = redirect "/cliente" |
| 6 | Equipe não presa no layout cliente | decidirRota (equipe, "/cliente") = redirect "/" |
| 7 | Logout limpa sessão/redirect | `signOut()` encerra a sessão; não há estado de redirect à parte (localStorage só tem dados de demo) |
| 8 | Redirect não entra em loop | `/` não está sob `/cliente/*`; regras não se apontam |
| 9 | Equipe vê todos os clientes | inalterado — RLS `eh_equipe()` (016) + rotas da agência |
| 10 | Cliente vê só a própria empresa | inalterado — RLS `cliente_do_usuario()` + redirect |

## Não executado aqui (precisa de staging — sem acesso nesta máquina)
Teste manual ponta a ponta (o ambiente atual não tem staging acessível e o `.env.local` aponta para o Supabase de produção, que não deve ser tocado):
```
Login Agência  → deve cair no Painel da Agência (/)
Login Cliente A → deve cair no Portal do Cliente (/cliente), só dados de A
Login Cliente B → deve cair no Portal do Cliente (/cliente), só dados de B
Equipe abrindo /cliente manualmente → volta para /
Cliente abrindo /clientes ou /financeiro → volta para /cliente
Usuário sem perfil / inativo → tela "Acesso não liberado"
```
Use o Preview de staging da branch (ver `docs/staging-setup/`). Estes passos **não foram executados** — apenas os testes puros + typecheck + lint acima.
