# 01 — Arquitetura de Staging

## Separação obrigatória

```
PRODUÇÃO                                  STAGING
─────────────────────────────            ─────────────────────────────
zioncompany.online                       staging.zioncompany.online
        │                                (ou a URL de Preview da Vercel)
        ▼                                        │
Vercel (Production)                              ▼
        │                                Vercel (Preview/Staging)
        ▼                                        │
Supabase (Production)                            ▼
        │                                Supabase (Staging — projeto separado)
        ▼                                        │
App Mercado Livre (Production)                   ▼
                                         App Mercado Livre (Staging/Teste separado)
```

Os dois mundos **não se cruzam** em nenhum ponto.

## Regras (todas obrigatórias)

| Recurso | Produção | Staging |
|---------|----------|---------|
| Banco / projeto Supabase | prod | **separado** |
| `service_role` key | prod | **separada** |
| Variáveis de ambiente | Production na Vercel | **Preview/Staging** apenas |
| Storage (bucket de imagens) | prod | **separado** (é do próprio Supabase de staging) |
| Credenciais do ML | app prod | **app de teste separado** (quando possível) |
| Usuários | reais | **de teste** |
| Dados comerciais | reais | **nenhum real** |
| Tokens do ML | prod | **nunca** copiar de prod |
| Webhook / callback | prod → prod | staging → staging |

**Proibições explícitas:**
- Nenhum webhook de staging apontando para produção.
- Nenhum callback de produção apontando para staging.
- Nenhum token/segredo de produção em staging (e vice-versa).

## Guardrail técnico
Além da separação de credenciais, os scripts de escrita em `database/staging/` exigem um marcador `public.environment_metadata` com `environment='staging'`. Produção não tem esse marcador → os scripts **abortam** lá de propósito. Ver [09-ROLLBACK-E-LIMPEZA.md](./09-ROLLBACK-E-LIMPEZA.md) e `database/staging/00-preflight.sql`.

## Fluxo de dados isolado
- O app de staging lê/escreve **só** no Supabase de staging (via `.env.staging` / variáveis de Preview).
- O OAuth do ML de staging usa o **Redirect URI de staging** e salva o `refresh_token` no canal do **Supabase de staging**.
- O worker/cron (se ligado em staging) usa a `service_role` **de staging** e o `CRON_SECRET` de staging.
