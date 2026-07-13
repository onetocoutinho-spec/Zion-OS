# 10 — Checklist Final + Veredito

Preencha ao terminar o runbook ([08-VALIDACAO-ETAPA-1.md](./08-VALIDACAO-ETAPA-1.md)). Registre evidências **sanitizadas** (códigos HTTP, contagens — sem tokens, senhas, e-mails completos ou UUIDs completos).

## Ambiente
- [ ] Confirmado que é **staging** (`00-preflight.sql`, sem dados reais, sem canais reais).
- [ ] Supabase de staging separado; variáveis só em **Preview**; app ML de teste.

## Schema e migração
- [ ] Base legada + `001–015` aplicadas em staging.
- [ ] Diagnóstico: 0 usuários de equipe sem perfil.
- [ ] Perfis de teste criados (A, B, equipe, inativo) + usuário sem perfil.
- [ ] `016` aplicada **apenas em staging**; `04-validation-queries.sql` confere deny-by-default + `perfis.ativo`.

## Critério de aprovação (todos precisam passar)
```
[ ] Sem sessão → 401
[ ] Sem perfil → 403
[ ] Perfil inativo → 403
[ ] Cliente A não acessa Empresa B
[ ] Cliente B não acessa Empresa A
[ ] clienteId forjado não burla autorização
[ ] Equipe continua com acesso
[ ] Refresh token não aparece no navegador
[ ] Refresh token não aparece nas respostas
[ ] Refresh token não aparece nos logs
[ ] OAuth continua funcionando
[ ] Importação continua funcionando
[ ] Vendas continuam funcionando
[ ] Dry-run continua funcionando
[ ] Migração 016 aplicada apenas em staging
[ ] Rollback documentado ou validado
```

## Evidências (sanitizadas)
| Item | Evidência |
|------|-----------|
| Matriz de rotas | tabela de HTTP por rota (401/403/ok) |
| Isolamento A/B | descrição do que A viu/não viu |
| DevTools | "nenhum refresh_token em requisições/respostas/logs" |
| 016 | trecho de `pg_get_functiondef` (coalesce false) |
| Rollback | contagens antes/depois iguais |

## Veredito
Use **apenas** um:
```
ETAPA 1 APROVADA EM STAGING
```
ou
```
ETAPA 1 REPROVADA — CORREÇÕES NECESSÁRIAS
```
Se qualquer item do critério falhar → **REPROVADA**, liste o item e a correção; não avance para a Etapa 2.

## Próxima ação (somente se APROVADA)
```
Preparar a Etapa 2: conectar User Products e publicar um único calçado real de forma controlada.
```
Não iniciar a Etapa 2 agora.
