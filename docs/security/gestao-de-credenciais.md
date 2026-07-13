# Gestão de Credenciais — Zion OS

> Regra de ouro: **segredos nunca no repositório nem em arquivos de trabalho versionáveis.** Eles vivem apenas nos **provedores** e nas **variáveis de ambiente** de cada ambiente (Vercel/Supabase/Mercado Livre). Este documento **não** contém nenhum valor real.

## Onde cada segredo deve ficar

| Segredo | Onde configurar | Escopo |
|---------|-----------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel (por ambiente) + `.env.local` local | público (build) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | público (build) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (server-only) / Supabase → Settings → API | **secreto, só servidor** |
| `ML_CLIENT_ID` | Vercel (server-only) / ML DevCenter | secreto de app (server) |
| `ML_CLIENT_SECRET` | Vercel (server-only) / ML DevCenter | **secreto, só servidor** |
| `ML_REDIRECT_URI` | Vercel (server-only) | config (server) |
| `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` | Vercel (server-only) | **secreto, só servidor** |
| `CRON_SECRET` | Vercel (server-only) | **secreto, só servidor** |
| `refresh_token` / `access_token` do Mercado Livre (por cliente) | **banco** (`canais_marketplace`, via RLS) — gerado no OAuth | secreto, só servidor |

Regras:
- `NEXT_PUBLIC_*` são os **únicos** que podem ir ao navegador. **Nada** secreto usa esse prefixo.
- `service_role`, `client_secret`, chaves de IA e `CRON_SECRET` são **server-only** (sem `NEXT_PUBLIC_`).
- O `refresh_token`/`access_token` do ML **nunca** trafega pelo navegador (é lido/rotacionado só no servidor).

## Como configurar (sem expor valores)
- **Vercel:** Project → Settings → Environment Variables. Separe por ambiente (**Production** × **Preview/Staging**). Após alterar `NEXT_PUBLIC_*` ou `ML_*`/`GEMINI_*`, faça **Redeploy** (são lidas no build).
- **Local:** copie `.env.example` → `.env.local` (ou `.env.staging.example` → `.env.staging`). Esses `.env*` reais são **ignorados** pelo Git; só os `*.example` (placeholders) são versionados.
- **Cuidado ao colar:** remova `< >` de placeholder, aspas e barra sobrando (o `NEXT_PUBLIC_SUPABASE_URL` é sensível a isso).

## Arquivos de credenciais em disco (ex.: `credenciais.md`)
- **Nunca** versione. O `.gitignore` já bloqueia `credenciais*`, `credentials.md`, `secrets.md`, `senhas.md`, `chaves.md`, `*.secret`, `*.secrets`, `segredos*` e `.env*` (exceto `*.example`).
- Se existir um `credenciais.md` de trabalho no disco (fora do Git), trate-o como sensível:
  - migre os valores para um **cofre** (1Password/Bitwarden/Vault) e para as variáveis de ambiente dos provedores;
  - só então **apague** o arquivo do disco — apenas depois de confirmar que **nenhum acesso depende exclusivamente dele**;
  - se algum segredo já tiver sido exposto (compartilhamento, backup, print), **rotacione** no provedor correspondente.

## Rotação de segredos (quando fazer)
Rotacione no provedor se um valor foi exposto/compartilhado indevidamente:
- **Supabase:** `service_role`/`anon` → Settings → API (regenerar).
- **Mercado Livre:** `client_secret` → DevCenter (regenerar) + reconectar contas.
- **Gemini/Anthropic:** revogar e recriar a API key.
- **CRON_SECRET:** gerar nova string e atualizar na Vercel.
Depois, atualize as variáveis de ambiente (Vercel/local) e faça Redeploy.

## Verificação rápida (higiene)
```
git check-ignore credenciais.md          # deve imprimir o arquivo (está ignorado)
git ls-files | grep -Ei 'credenc|secret|senha|\.env($|\.)'   # só deve listar *.example
git log --all --oneline -- credenciais.md   # deve ser vazio (nunca versionado)
```

## Não fazer
- Não colar valores reais em `.md`, comentários de código, issues, PRs ou logs.
- Não usar `NEXT_PUBLIC_` para segredo.
- Não retornar `refresh_token`/`access_token`/`client_secret`/`service_role` em respostas de API nem no navegador.
