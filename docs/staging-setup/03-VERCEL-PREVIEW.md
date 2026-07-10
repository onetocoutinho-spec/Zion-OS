# 03 — Vercel Preview / Staging

Duas opções para hospedar o app de staging. **Recomendada: Opção A** (mais simples para validar a Etapa 1).

## Opção A — Preview Deploy da branch (recomendada)
- Usa a branch **`fix/multitenancy-security`** (onde está a Etapa 1).
- A Vercel cria um deploy de **Preview** automático para a branch, com uma URL própria (`https://<projeto>-<hash>.vercel.app`).
- **Variáveis:** defina as de staging apenas no escopo **Preview** (Vercel → Project → Settings → Environment Variables → marque **Preview**). **Não** toque nas de **Production**.
- Aponte todas para o **Supabase de staging** e o **app ML de teste** (ver [05](./05-VARIAVEIS-DE-AMBIENTE.md)).
- `ML_REDIRECT_URI` deve ser exatamente `https://<preview-host>/cliente/conectar-ml` e igual ao Redirect URI do app ML de staging.

Passos:
1. Vercel → o projeto do Zion OS → Settings → Environment Variables.
2. Adicione as variáveis de staging com escopo **Preview** (ver lista em [05](./05-VARIAVEIS-DE-AMBIENTE.md)).
3. Faça push/manter a branch `fix/multitenancy-security` (sem merge). A Vercel gera o Preview.
4. Copie a URL do Preview → use como Site URL no Supabase de staging e no Redirect URI do ML de staging.
5. Faça **Redeploy** após ajustar variáveis (as `NEXT_PUBLIC_*` e `ML_*`/`GEMINI_*` são lidas no build).

> ⚠️ Como o mesmo projeto Vercel tem Production e Preview, **cuidado** para não editar as variáveis de Production. Se preferir isolamento total, use a Opção B.

## Opção B — Ambiente de staging permanente
- Crie a branch **`staging`** e um domínio **`staging.zioncompany.online`**.
- Um **projeto Vercel separado** (ou ambiente dedicado) apontando **só** para o Supabase de staging.
- Mais isolado, porém mais trabalho de manutenção. Indicada se staging for durar.

## Recomendação inicial
```
Vercel Preview da branch fix/multitenancy-security + Supabase Staging separado
```
Rápido de montar, isola dados (Supabase separado) e não risca a Production se você marcar as variáveis como **Preview**.

## Cron / worker em staging (opcional)
O `vercel.json` agenda o worker a cada minuto. Em Preview isso normalmente **não** roda como cron de produção — e para validar a Etapa 1 (auth/token) o worker não é necessário. Se quiser exercê-lo, configure `SUPABASE_SERVICE_ROLE_KEY` (staging) e `CRON_SECRET` (staging) e dispare o endpoint manualmente com o header `Authorization: Bearer <CRON_SECRET>`.
