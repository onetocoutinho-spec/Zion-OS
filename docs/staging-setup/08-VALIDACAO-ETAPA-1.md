# 08 — Runbook de Validação da Etapa 1 (executável)

Ordem completa. Refina e substitui o "runbook" de `docs/implementation-phase-1-security/09-STAGING-VALIDATION.md` e o `docs/security-validation-checklist.md`. **Nada em produção.**

```
1. Criar Supabase staging ............ 02-SUPABASE-STAGING.md
2. Configurar variáveis (Preview) .... 05-VARIAVEIS-DE-AMBIENTE.md + .env.staging.example
3. Aplicar schema 001–015 ............ 06-APLICACAO-DAS-MIGRACOES.md
4. Diagnóstico ....................... database/checks/check-users-without-profile.sql
5. Criar/corrigir perfis de teste .... 07-DADOS-DE-TESTE.md + database/staging/03-seed-...
6. Aplicar migração 016 .............. database/staging/02-apply-security-016.sql
7. Marcar usuário inativo ............ update perfis set ativo=false where id='<INACTIVE>'
8. Deploy Preview .................... 03-VERCEL-PREVIEW.md
9. Testar matriz 401/403 ............. (abaixo)
10. Testar isolamento A/B ............ (abaixo)
11. Inspecionar DevTools ............. (abaixo)
12. Testar OAuth ML .................. 04-MERCADO-LIVRE-STAGING.md
13. Importação/vendas/dry-run ........ (abaixo)
14. Validar rollback ................. 09-ROLLBACK-E-LIMPEZA.md
15. Emitir veredito .................. 10-CHECKLIST-FINAL.md
```

## Passo 4 — Diagnóstico (antes da 016)
Rode `database/checks/check-users-without-profile.sql` no SQL Editor de staging. Confirme: **0** usuários de equipe sem perfil (bloco 1). Registre os totais (sanitizados).

## Passo 6 — Aplicar 016 (só staging)
Rode `database/staging/02-apply-security-016.sql` (ou cole `database/migrations/016-*.sql` após conferir o guardrail). Depois rode `database/staging/04-validation-queries.sql` e confirme: `eh_equipe` com `coalesce(...,false)`, `perfis.ativo` existe.

## Passo 9 — Matriz de rotas (HTTP real)
Pegue os **access_token (JWT)** das sessões de teste (ex.: no DevTools do app de staging, `supabase.auth.getSession()` no console, ou via login programático). **Nunca** cole esses JWTs em arquivos/logs. Defina `BASE` = URL do Preview.

Forma dos comandos (exemplos; `<...>` são placeholders, não segredos):
```bash
BASE="https://<preview-host>"

# 401 — sem token
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/ml/vendas" \
  -H 'Content-Type: application/json' -d '{"clienteId":"<A>"}'                 # espera 401

# 401 — token inválido
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/ml/vendas" \
  -H 'Authorization: Bearer token.invalido.aqui' \
  -H 'Content-Type: application/json' -d '{"clienteId":"<A>"}'                 # espera 401

# 403 — usuário SEM perfil
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/ml/vendas" \
  -H "Authorization: Bearer <JWT_SEM_PERFIL>" \
  -H 'Content-Type: application/json' -d '{"clienteId":"<A>"}'                 # espera 403

# 403 — perfil INATIVO
curl ... -H "Authorization: Bearer <JWT_INATIVO>" -d '{"clienteId":"<A>"}'    # espera 403

# autorizado — Cliente A no próprio cliente
curl -s -w '\n%{http_code}\n' -X POST "$BASE/api/ml/vendas" \
  -H "Authorization: Bearer <JWT_CLIENTE_A>" \
  -H 'Content-Type: application/json' -d '{"clienteId":"<A>"}'                 # espera 200 (ou aviso "não conectado")

# 403 — Cliente A forjando clienteId de B
curl ... -H "Authorization: Bearer <JWT_CLIENTE_A>" -d '{"clienteId":"<B>"}'  # espera 403

# equipe acessa A e B
curl ... -H "Authorization: Bearer <JWT_EQUIPE>" -d '{"clienteId":"<A>"}'     # autorizado
curl ... -H "Authorization: Bearer <JWT_EQUIPE>" -d '{"clienteId":"<B>"}'     # autorizado
```

Repita a matriz para cada rota, anotando o HTTP de cada célula:

| Rota | sem token | token inválido | sem perfil | inativo | cliente certo | outro cliente | equipe |
|------|-----------|----------------|-----------|---------|---------------|---------------|--------|
| `/api/ml/conectar` | 401 | 401 | 403 | 403 | ok | 403 | ok |
| `/api/ml/publicar` (`go:false`) | 401 | 401 | 403 | 403 | ok/dry | 403 | ok |
| `/api/ml/vendas` | 401 | 401 | 403 | 403 | ok | 403 | ok |
| `/api/ml/importar-anuncios` | 401 | 401 | 403 | 403 | ok | 403 | ok |
| `/api/agentes/esteira` | 401 | 401 | 403* | 403* | ok | — | ok |
| `/api/agentes/executar` | 401 | 401 | 403* | 403* | ok | — | ok |
| `/api/imagens/gerar` | 401 | 401 | 403* | 403* | ok | — | ok |

\* Rotas de IA exigem só **autenticado com perfil ativo** (`exigirAutenticado`) — sem escopo por cliente; sem perfil/inativo → 403.

## Passo 10 — Isolamento A/B (UI)
Logado como Cliente A no Preview: veja produtos/anúncios/vendas de A; tente abrir uma URL de recurso de B (ID digitado à mão) → não deve vazar. Repita invertendo (Cliente B). Logado como Equipe: acessa A e B.

## Passo 11 — DevTools (token fora do navegador)
Com Network aberto, exerça: conectar ML, configurações, importar, vendas, preview (dry-run), publicar controlado. Confirme:
- Nenhuma **requisição** enviada pelo navegador contém valor de `refresh_token`/`access_token`/`client_secret`.
- Nenhuma **resposta** de `/api/ml/*` retorna esses valores.
- Console/logs (app + Vercel) sem credenciais.
Se algum segredo aparecer, **pare** e reporte só a rota/arquivo (sem o valor).

## Passo 12–13 — Fluxo ML
OAuth conecta a conta de teste; callback salva canal no servidor; frontend recebe só dados públicos (`ativo`/`sellerId`/`tipoAnuncio`); importação e vendas funcionam; dry-run funciona; Cliente A **não** publica com `clienteId` de B (403). Publicação real só com **item de teste** autorizado.

## Passo 14–15
Rollback: ver [09-ROLLBACK-E-LIMPEZA.md](./09-ROLLBACK-E-LIMPEZA.md). Veredito: preencher [10-CHECKLIST-FINAL.md](./10-CHECKLIST-FINAL.md).
