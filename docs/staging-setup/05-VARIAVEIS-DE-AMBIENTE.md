# 05 — Variáveis de Ambiente (Staging)

Modelo pronto: **`.env.staging.example`** (na raiz do repo). Copie para `.env.staging` (ignorado pelo Git) para rodar localmente, **ou** cole os valores no escopo **Preview** da Vercel.

> **Não** edite `.env.local` (é o ambiente atual). O `.env.staging` real nunca vai para o Git (`.gitignore`: `.env*` + exceção só para os `*.example`).

## Variáveis confirmadas no código

| Variável | Escopo | Usada em | Obrigatória? |
|----------|--------|----------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | público (build) | `src/lib/supabase/client.ts` | **Sim** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | público (build) | `src/lib/supabase/client.ts` | **Sim** |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | `src/lib/supabase/admin.ts` (worker) | Só se testar o worker |
| `ML_CLIENT_ID` | server-only | `src/app/api/ml/*` | Sim (fluxo ML) |
| `ML_CLIENT_SECRET` | server-only | `src/app/api/ml/*` | Sim (fluxo ML) |
| `ML_REDIRECT_URI` | server-only | `api/ml/autorizar`, `conectar` | Sim (fluxo ML) |
| `GEMINI_API_KEY` | server-only | `src/lib/agentes/provedorIA.ts`, `provedorImagem.ts` | Só p/ IA/imagens |
| `GEMINI_MODEL` | server-only | `provedorIA.ts` | Opcional (default no código) |
| `GEMINI_IMAGE_MODEL` | server-only | `provedorImagem.ts` | Opcional |
| `OPENAI_API_KEY` | server-only | `provedorIA.ts`, `openai.ts`, `provedorImagem.ts` | A IA padrão (ChatGPT) desde 23/08/2026 |
| `OPENAI_MODEL` / `OPENAI_MODELO_CONVERSA` | server-only | `roteamentoDeModelo.ts` | Opcional (padrão gpt-5) |
| `ANTHROPIC_API_KEY` | server-only | `provedorIA.ts` | Opcional (só com IA_PROVEDOR=anthropic) |
| `ANTHROPIC_MODEL` | server-only | `provedorIA.ts` | Opcional |
| `IA_PROVEDOR` | server-only | `provedorIA.ts` | Opcional (força openai/anthropic/gemini) |
| `CRON_SECRET` | server-only | `src/app/api/otimizar/worker/route.ts` | Só p/ worker |

> Para os **testes de autenticação/isolamento e do token** (o núcleo da Etapa 1), bastam as 2 do Supabase + as 3 do ML. IA/worker são opcionais.

## Regras
- `service_role`, `client_secret`, chaves de IA e `CRON_SECRET` são **server-only** — **nunca** com prefixo `NEXT_PUBLIC_`.
- Ao colar na Vercel, confira que não sobrou `< >` de placeholder, aspas ou barra no fim (o `NEXT_PUBLIC_SUPABASE_URL` é sensível a isso).
- `NEXT_PUBLIC_*` e `ML_*`/`GEMINI_*` são lidas no **build** → após alterar na Vercel, faça **Redeploy**.

## Git ignora o arquivo real?
Sim. O `.gitignore` foi ajustado:
```
.env*
!.env.example
!.env.staging.example
```
Ou seja: `.env.staging` (real) é **ignorado**; só os `*.example` (placeholders) são versionados. Confirme com:
```bash
git check-ignore .env.staging      # deve imprimir ".env.staging" (está ignorado)
git check-ignore .env.staging.example || echo "rastreável (ok)"
```
