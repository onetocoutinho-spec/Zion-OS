# Fase 1 — Segurança multiempresa (R1 · R3 · R6)

Implementação da **primeira etapa de estabilização** do Zion OS: fechar o isolamento entre empresas, mover a autorização para o servidor e tirar o refresh_token do Mercado Livre de dentro do navegador.

Branch: **`fix/multitenancy-security`** · Base: `master` · Data: 2026-07-09

## Riscos tratados (da auditoria `docs/zion-os-audit/04-PROBLEMAS-E-RISCOS.md`)

| Risco | Descrição | Situação |
|-------|-----------|----------|
| **R1** | Usuário sem perfil era tratado como equipe (acesso total) | Corrigido (migração 016 + fail-safe do cliente) |
| **R3** | refresh_token do ML trafegava pelo navegador | Corrigido (token 100% server-side) |
| **R6** | Autorização dependia do client-side | Corrigido nas rotas sensíveis (camada server-side) |

## Índice

| Doc | Conteúdo |
|-----|----------|
| [01-PLANO.md](./01-PLANO.md) | Estado atual encontrado + plano de implementação. |
| [02-ARQUIVOS-ALTERADOS.md](./02-ARQUIVOS-ALTERADOS.md) | Cada arquivo criado/alterado e por quê. |
| [03-MIGRACAO-RLS.md](./03-MIGRACAO-RLS.md) | Migração 016, scripts de checagem e ordem de aplicação. |
| [04-AUTORIZACAO-SERVER-SIDE.md](./04-AUTORIZACAO-SERVER-SIDE.md) | Camada `serverAuthorization` e como as rotas usam. |
| [05-TOKEN-MERCADO-LIVRE.md](./05-TOKEN-MERCADO-LIVRE.md) | Novo fluxo do refresh_token (fim do token no browser). |
| [06-TESTES.md](./06-TESTES.md) | O que foi testado de verdade e o que falta em staging. |
| [07-ROLLBACK.md](./07-ROLLBACK.md) | Como reverter migração, serviços, rotas e tipos. |
| [08-PENDENCIAS.md](./08-PENDENCIAS.md) | O que esta fase NÃO resolveu (fora de escopo). |

Checklist operacional de staging: [`docs/security-validation-checklist.md`](../security-validation-checklist.md).

## ⚠️ Ordem obrigatória de aplicação (não pule)

Como o comportamento antigo era "sem perfil = equipe", a equipe atual pode não ter perfil. Aplicar a segurança na ordem errada tranca a equipe.

1. Rodar `database/checks/check-users-without-profile.sql` (diagnóstico, só leitura).
2. Cadastrar **todos** os perfis (equipe + clientes) com `database/checks/fix-missing-profiles-template.sql`.
3. Confirmar que não há usuário-equipe sem perfil.
4. Aplicar a migração `016-fix-multitenancy-security.sql` **em staging**.
5. Validar com o checklist. Só então promover para produção.

> Nada aqui foi aplicado em produção. As migrações são arquivos; a aplicação é manual e controlada pela equipe.
