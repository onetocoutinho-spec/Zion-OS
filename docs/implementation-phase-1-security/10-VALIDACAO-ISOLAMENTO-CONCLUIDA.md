# 10 — Validação de Isolamento Multiempresa (CONCLUÍDA em staging)

Registro dos resultados **reais** obtidos na validação de autenticação, redirecionamento por papel e isolamento multiempresa da Etapa 1.

> **Sanitização:** este documento **não** contém e-mails, senhas, UUIDs, URLs privadas, tokens, chaves nem dados comerciais reais. Referências a empresas/usuários são rótulos de teste (Empresa A/B, Cliente A/B, Equipe).

## Ambiente

| Item | Valor |
|------|-------|
| Banco | **Supabase Staging** (projeto separado, nunca produção) |
| App | **Vercel Preview** da branch `fix/multitenancy-security` (escopo Preview, não Production) |
| Produção | **Não tocada** em nenhum momento |

## Migrações executadas (só em staging)

| Etapa | Resultado |
|-------|-----------|
| Base legada (schema + rls + realtime, **sem** seed) | ✅ Aplicada |
| Migrações `001–015` (sem `001b`) | ✅ Aplicadas |
| Migração **016** (deny-by-default + `perfis.ativo`) | ✅ Aplicada (isolada, após os perfis) |

## Diagnóstico pré-migração

Antes da 016, o diagnóstico (`database/checks/check-users-without-profile.sql`) confirmou **0 usuários de equipe sem perfil** — pré-condição para aplicar a 016 sem trancar a equipe. (Contagens conferidas em staging; sem expor identificadores.)

## Perfis testados

| Papel de teste | Configuração | Resultado esperado |
|----------------|--------------|--------------------|
| Equipe | `papel=equipe`, ativo | acessa o Painel da Agência e todos os clientes |
| Cliente A | `papel=cliente`, empresa A, ativo | só Empresa A |
| Cliente B | `papel=cliente`, empresa B, ativo | só Empresa B |
| Sem perfil | autenticado, **sem** linha em `perfis` | bloqueado |
| Inativo | `papel=cliente`, `ativo=false` | bloqueado |

## Resultados — autenticação, redirecionamento e isolamento

| # | Cenário | Resultado |
|---|---------|-----------|
| 1 | Migrações base + 001–015 aplicadas em staging | ✅ APROVADO |
| 2 | Migração 016 aplicada em staging | ✅ APROVADO |
| 3 | Usuário da equipe continua com acesso | ✅ APROVADO |
| 4 | Equipe é direcionada ao Painel da Agência em `/` | ✅ APROVADO |
| 5 | Equipe acessa todos os clientes e produtos | ✅ APROVADO |
| 6 | Equipe em `/cliente` é redirecionada para `/` | ✅ APROVADO |
| 7 | Cliente A acessa somente Empresa A e Produto A | ✅ APROVADO |
| 8 | Cliente B acessa somente Empresa B e Produto B | ✅ APROVADO |
| 9 | Cliente em rota administrativa é redirecionado para `/cliente` | ✅ APROVADO |
| 10 | Usuário sem perfil recebe "Acesso não liberado" | ✅ APROVADO |
| 11 | Perfil com `ativo=false` recebe "Acesso não liberado" | ✅ APROVADO |
| 12 | `/clientes` não é confundido com `/cliente` | ✅ APROVADO |
| 13 | Isolamento multiempresa funcionando no fluxo real | ✅ APROVADO |

### Isolamento entre Empresa A e Empresa B
Confirmado no fluxo real: Cliente A vê apenas os dados de A; Cliente B apenas os de B; nenhum dos dois enxerga dados do outro (RLS `cliente_do_usuario()` + migração 016 + redirecionamento por papel). A equipe enxerga ambos (RLS `eh_equipe()`), como esperado.

### Usuário sem perfil e usuário inativo
Ambos recebem a tela **"Acesso não liberado"** (o `meuPerfil()` devolve `null` para sem-perfil/inativo, e o `AuthGate`/`RoteadorPapel` bloqueia). O RLS/016 é a segunda camada — sem perfil/inativo não há escopo de dados.

## Pendências relacionadas ao Mercado Livre (NÃO validadas ainda)

Estas dependem de conectar uma conta ML de teste no staging:

- [ ] Conectar uma conta Mercado Livre de teste no staging
- [ ] DevTools: `refresh_token` **não** aparece nas **requisições** do navegador
- [ ] DevTools: `refresh_token` **não** aparece nas **respostas** da API
- [ ] `refresh_token` **não** aparece nos **logs** (app/Vercel)
- [ ] OAuth do Mercado Livre conecta
- [ ] Importação de anúncios funciona
- [ ] Consulta de vendas funciona
- [ ] Dry-run e publicação controlada funcionam

Runbook para executá-las: [09-STAGING-VALIDATION.md](./09-STAGING-VALIDATION.md) (seção "Runbook", passos de Mercado Livre) e `docs/staging-setup/08-VALIDACAO-ETAPA-1.md`.

## Produção
**Nenhum teste foi realizado em produção.** Toda a validação ocorreu no Supabase Staging + Vercel Preview.

## Veredito

```
ETAPA 1 — AUTENTICAÇÃO E ISOLAMENTO MULTIEMPRESA APROVADOS EM STAGING

A validação de credenciais e fluxos do Mercado Livre permanece pendente.
```
