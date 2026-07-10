# 02 — Rotas e Redirecionamento

## Regra (pura) — `src/lib/auth/roteamentoPapel.ts`
`decidirRota(perfil, pathname)` devolve `sem_acesso | ok | redirect(para)`:

| Perfil | Rota | Decisão |
|--------|------|---------|
| sem perfil / `ativo=false` / cliente sem `clienteId` | qualquer | **sem_acesso** → "Acesso não liberado" |
| **equipe** (ativo) | fora de `/cliente/*` (ex.: `/`, `/clientes`, `/vendas`) | **ok** |
| **equipe** (ativo) | `/cliente` ou `/cliente/*` | **redirect → `/`** (Painel da Agência) |
| **cliente** (ativo, com empresa) | `/cliente` ou `/cliente/*` | **ok** |
| **cliente** (ativo, com empresa) | fora de `/cliente/*` (rota da agência) | **redirect → `/cliente`** |

`estaNoPortalCliente(pathname)` = `pathname === "/cliente" || pathname.startsWith("/cliente/")` — **barra final** para não casar `/clientes`.

## Onde é aplicada — `src/components/auth/AuthGate.tsx`
Depois de resolver o perfil (e já tratando `null` → tela "Acesso não liberado"), o `AuthGate` envolve o app em `RoteadorPapel`:
```
const perfilEfetivo = perfil ?? { papel: "equipe", clienteId: null, nome: "" }; // demo = equipe
<RoteadorPapel perfil={perfilEfetivo}>{children}</RoteadorPapel>
```
`RoteadorPapel`:
- calcula `decidirRota(perfil, pathname)`;
- se `redirect` → `router.replace(para)` e mostra `TelaCarregando` (sem piscar a casca errada);
- se `sem_acesso` → `TelaSemAcesso`;
- se `ok` → renderiza os `children`.

## Regras adicionais atendidas
- **Equipe entrando em `/cliente` → Painel da Agência.** Não há (ainda) modo "Visualizar como cliente" — então redireciona, conforme a Parte 2 permite. (Extensão futura em [07](./07-PENDENCIAS-FUTURAS.md).)
- **Cliente entrando em rota administrativa → `/cliente`.** (Comportamento do `ClienteGate` anterior, preservado no `RoteadorPapel`.)
- **Não confia só no menu escondido:** o redirect roda no `AuthGate` (todas as rotas); o RLS/016 é a 2ª camada.
- **Sem loop:** `/` não está sob `/cliente/*` e `/cliente` está — as duas regras nunca se apontam mutuamente.
- **Sem piscar:** durante o redirect, mostra `TelaCarregando`.
- **localStorage:** não há redirect salvo em localStorage (só dados de demo em `store.ts`); nada a limpar. O logout (`signOut`) encerra a sessão; sem estado de redirect à parte.

## Landing pós-login
A tela de login (`TelaLogin`) ocupa a app quando deslogado. Ao logar, a sessão resolve e o `RoteadorPapel` aplica a regra na rota atual:
- **equipe** em `/` → fica (dashboard da agência); em `/cliente*` → vai para `/`.
- **cliente** em qualquer rota da equipe → vai para `/cliente`.

```
equipe → Painel da Agência (/)
cliente → Portal do Cliente (/cliente)
sem perfil / inativo → "Acesso não liberado"
```
