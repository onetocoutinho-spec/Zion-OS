# Staging Setup — Zion OS (Etapa 1 de segurança)

Runbook para **criar um ambiente de staging isolado** e **validar a Etapa 1** (R1/R3/R6) sem nenhum contato com produção. Escrito para ser seguido por uma pessoa não especialista, na ordem.

> **Por que isto existe:** a validação da Etapa 1 ficou **bloqueada** por não haver staging (ver `docs/implementation-phase-1-security/09-STAGING-VALIDATION.md`). Aqui está tudo para destravar.

## Regras de ouro (não quebre)
- **Nada** aqui roda em produção. Banco, Vercel e app do Mercado Livre são **separados**.
- Nunca reutilize senha, `service_role` ou `client_secret` de produção.
- Sem dados comerciais reais em staging. Só dados de teste identificados.
- Callback/OAuth de staging aponta para staging; de produção, para produção.

## Ordem de execução

| Passo | Documento | Painel externo? |
|-------|-----------|-----------------|
| 1 | [01-ARQUITETURA-STAGING.md](./01-ARQUITETURA-STAGING.md) — entender a separação | — |
| 2 | [02-SUPABASE-STAGING.md](./02-SUPABASE-STAGING.md) — criar o Supabase de staging | Supabase |
| 3 | [05-VARIAVEIS-DE-AMBIENTE.md](./05-VARIAVEIS-DE-AMBIENTE.md) — preencher `.env.staging` | — |
| 4 | [06-APLICACAO-DAS-MIGRACOES.md](./06-APLICACAO-DAS-MIGRACOES.md) — aplicar schema 001–015 | Supabase |
| 5 | [04-MERCADO-LIVRE-STAGING.md](./04-MERCADO-LIVRE-STAGING.md) — app ML de teste | Mercado Livre |
| 6 | [03-VERCEL-PREVIEW.md](./03-VERCEL-PREVIEW.md) — deploy de staging | Vercel |
| 7 | [07-DADOS-DE-TESTE.md](./07-DADOS-DE-TESTE.md) — criar usuários/empresas de teste | Supabase |
| 8 | [08-VALIDACAO-ETAPA-1.md](./08-VALIDACAO-ETAPA-1.md) — **rodar a validação** (016 + testes) | Supabase/Vercel |
| 9 | [09-ROLLBACK-E-LIMPEZA.md](./09-ROLLBACK-E-LIMPEZA.md) — reverter e limpar | Supabase |
| 10 | [10-CHECKLIST-FINAL.md](./10-CHECKLIST-FINAL.md) — checklist + veredito | — |

## Scripts que acompanham
- `database/staging/` — preflight, bootstrap, aplicar 016, seed de teste, validação, limpeza (com guardrail contra produção).
- `database/checks/` — diagnóstico de perfis (da Etapa 1).
- `.env.staging.example` — modelo de variáveis (placeholders).

## O que ainda depende de você (ações em painéis)
Estas ações só você pode fazer (exigem login/credenciais nos painéis) — o assistente **não** as executa:
1. **Supabase:** criar o projeto de staging e pegar URL/anon/service_role.
2. **Vercel:** configurar as variáveis de Preview e fazer o deploy da branch.
3. **Mercado Livre:** criar o app de teste e o Redirect URI de staging.

Depois de fornecer os dados de staging, o assistente ajuda a rodar o runbook do passo 8.
