# Relatório Posterior — PR-002 · Segurança Multi-tenant (016) em Produção

> Terceiro artefato da regra do programa (Plano → Snapshot → **Relatório**).
> Operação executada em 2026-07-22, sessão contínua no SQL Editor de produção +
> validação logada no site. Janela total aproximada: **18:53–19:30 UTC** (~35 min).
> Horários por fase não foram cronometrados individualmente pelo operador — a
> sequência e os resultados estão integralmente registrados abaixo e no snapshot.

## Diagnóstico inicial
Ver [snapshot](2026-07-22-pr002-security-snapshot.md) (coleta 18:53 UTC):
`eh_equipe` **permissiva** ativa · **1 usuário sem perfil** (`onetocoutinho@gmail.com`,
com acesso total implícito) · 015/016§1/022/023 aplicadas · 016§2-4 pendente ·
**achado novo: 017–021 nunca aplicadas**.

## Ações executadas (em ordem)
1. **Backfill** — perfil `equipe` para `onetocoutinho@gmail.com` (upsert idempotente do
   template oficial; papel confirmado pelo mantenedor antes do insert).
2. **Reconferência** — `usuarios_sem_perfil = 0` ✓.
3. **Migração 016 completa** — `Success. No rows returned` (idempotente; §1 já aplicado
   foi inócuo; §2-4 inverteram as funções; §4 reassegurou RLS nas 28 tabelas).
4. **Verificação embutida** — `✓ eh_equipe DENY-BY-DEFAULT` · `✓ cliente_do_usuario com
   ativo` · `coluna_ativo = 1`.

## Validações realizadas (produção, logado)
| Conta | Papel | Resultado |
|---|---|---|
| zioncontatoss@gmail.com | equipe | ✅ painel completo |
| onetocoutinho@gmail.com | equipe (backfilled nesta operação) | ✅ painel completo — backfill provado sob a regra nova |
| alexaissa@gmail.com | cliente (Chinelaria) | ✅ portal `/cliente/*`, apenas os próprios dados |

## Evidências
Grade do diagnóstico (snapshot) · saída da verificação (`✓/✓/1`) · três logins validados
pelo mantenedor. Screenshots na sessão da operação.

## Problemas encontrados
- Bug no diagnóstico v1 (referência direta a tabela ausente falha no parse — 42P01);
  corrigido em `1aeb54a`. O próprio erro antecipou o achado "017 pendente".
- Nenhum problema durante backfill, migração ou validação.

## Rollback necessário?
**NÃO.** (Procedimento permanece embutido na 016 §REVERTER, disponível a qualquer momento.)

## Resultado final
✅ **Modelo de segurança consolidado em produção: nenhum acesso implícito.**
Sem perfil = sem acesso · perfil inativo = sem acesso · equipe explícita · cliente
confinado ao próprio tenant. Zero downtime; zero impacto em clientes.

## Encaminhamentos registrados
- **017–021 pendentes**: 020/021 (fundação morta) → decisão na colheita (backlog E5.1);
  017/018/019 → aplicar quando as features correspondentes ativarem.
- Reforço do caso do **E1.2** (tracking de migrações) — este diagnóstico vira a linha de
  base.
