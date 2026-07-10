# Separação Painel da Agência × Portal do Cliente

Correção **cirúrgica** do redirecionamento e da separação de layouts por papel. Escopo limitado a: (1) redirecionamento após login, (2) separação de layouts, (3) navegação por papel, (4) página inicial da agência, (5) proteção contra cliente acessar rotas da equipe.

**Não** houve: redesenho do sistema, alteração da migração 016, mudança de RLS, User Products, fila de publicação, CRM novo, métricas fictícias.

## O problema, em uma linha
Um usuário **equipe** que caísse em `/cliente/*` (URL antiga, link, teste) via a **casca do Portal do Cliente** (vazia, pois `clienteId` é nulo) — porque o `AuthGate` só protegia o papel *cliente*, não o *equipe*.

## Índice
| Doc | Conteúdo |
|-----|----------|
| [01-DIAGNOSTICO-ATUAL.md](./01-DIAGNOSTICO-ATUAL.md) | Por que a equipe aparecia no ambiente do cliente (fatos + arquivos). |
| [02-ROTAS-E-REDIRECIONAMENTO.md](./02-ROTAS-E-REDIRECIONAMENTO.md) | Nova regra de rota por papel (`decidirRota`). |
| [03-LAYOUT-AGENCIA.md](./03-LAYOUT-AGENCIA.md) | Casca e navegação da agência (`AppShell` / `NAV_ITEMS`). |
| [04-LAYOUT-CLIENTE.md](./04-LAYOUT-CLIENTE.md) | Casca do cliente (`ClientPortalShell`) e isolamento. |
| [05-METRICAS-DISPONIVEIS.md](./05-METRICAS-DISPONIVEIS.md) | Métricas reais no dashboard × o que ainda não está integrado. |
| [06-TESTES.md](./06-TESTES.md) | Testes executados + roteiro manual de staging. |
| [07-PENDENCIAS-FUTURAS.md](./07-PENDENCIAS-FUTURAS.md) | Módulos que ainda precisam de evolução. |

## Arquivos alterados
- `src/lib/auth/roteamentoPapel.ts` (novo) — regra pura `decidirRota`/`estaNoPortalCliente`.
- `src/lib/auth/roteamentoPapel.test.ts` (novo) — 10 testes.
- `src/components/auth/AuthGate.tsx` — gates unificados em `RoteadorPapel` (equipe→`/`, cliente→`/cliente`, incompleto→bloqueio).
- `src/components/layout/AppShell.tsx` — detecção de `/cliente` corrigida (não pega `/clientes`).

## Estado
Typecheck ✅ · testes ✅ (10/10 + 13/13 de regressão) · lint ✅ 0 erros. **Sem commit** (aguardando autorização). Migração 016 e RLS **intactos**.
