# Checklist de validação de segurança (staging) — Fase 1 (R1/R3/R6)

Use este roteiro em **staging** antes de promover para produção. Marque cada item. Nada aqui deve ser feito direto em produção.

Detalhes de cada mudança: `docs/implementation-phase-1-security/`.

---

## A. Preparação

- [ ] **Backup do banco** (Supabase → Database → Backups / dump).
- [ ] Deploy da branch `fix/multitenancy-security` no ambiente de **staging**.
- [ ] Conferir usuários existentes: `select id, email from auth.users;`
- [ ] Conferir perfis: `select id, papel, cliente_id from public.perfis;`
- [ ] Conferir equipe (todos com perfil?) e clientes (cada um com `cliente_id`).
- [ ] Rodar o diagnóstico `database/checks/check-users-without-profile.sql` (só leitura).
- [ ] **Backfill**: cadastrar todos os perfis faltantes com `database/checks/fix-missing-profiles-template.sql` (não adivinhar equipe × cliente).
- [ ] Reconferir: o bloco 1 do check retorna **0 linhas**.
- [ ] Aplicar `database/migrations/016-fix-multitenancy-security.sql` em staging.
- [ ] Verificar as funções (`pg_get_functiondef`) e a coluna `perfis.ativo` (ver 03-MIGRACAO-RLS).

## B. Isolamento entre duas empresas

Prepare:
```
Empresa A → Usuário A → Produto A
Empresa B → Usuário B → Produto B
```

- [ ] Logado como **A**: vê os dados de A (produtos, anúncios, vendas).
- [ ] Logado como **A**: **não** vê nada de B.
- [ ] Logado como **B**: **não** vê nada de A.
- [ ] Digitar manualmente uma URL de recurso de B enquanto logado como A → **não** vaza dado (RLS/portal barra).
- [ ] Enviar manualmente um `clienteId` de B numa chamada `/api/ml/*` logado como A → resposta **403** (não publica/lê).
- [ ] Usuário **sem perfil** (crie um auth.user sem `perfis`): login mostra **"Acesso não liberado"**; APIs sensíveis respondem **401/403**.
- [ ] Usuário com **perfil inativo** (`ativo=false`): sem acesso.
- [ ] **Equipe** continua acessando o necessário (todos os clientes).

## C. Mercado Livre (refresh token fora do navegador)

Com o DevTools aberto (aba **Network**) durante conectar / publicar / vendas / importar:

- [ ] **Nenhuma resposta** de `/api/ml/*` contém `refresh_token`/`refreshToken` (inspecione o corpo de cada resposta).
- [ ] **Nenhuma requisição** enviada pelo browser contém `refresh_token` no corpo (só `clienteId`, `payload`, etc.).
- [ ] **Nenhum log** (console do browser, logs do servidor/Vercel) mostra o token.
- [ ] Conexão **OAuth** com o ML conclui (status "Conectado" aparece — baseado em `ativo`).
- [ ] **Dry-run** de publicação continua funcionando (a equipe revê o payload).
- [ ] **Publicação controlada** funciona até a etapa real (ou publica 1 item de teste, se autorizado).
- [ ] Tentativa de operar o ML de **outra empresa** (clienteId de B logado como A) → **403**.

## D. Regressão rápida
- [ ] Login de equipe e de cliente funcionam.
- [ ] Portal do cliente carrega (produtos, vendas, imagens).
- [ ] Esteira/otimização e Estúdio IA funcionam para usuário autenticado.
- [ ] Modo demonstração (sem Supabase), se usado, continua abrindo sem login.

## E. Rollback (ensaiar em staging)
- [ ] Reverter a migração 016 (bloco "REVERTER" no arquivo) restaura o comportamento anterior.
- [ ] Reverter o código (`git`) restaura as rotas/serviços.
- [ ] Ver `docs/implementation-phase-1-security/07-ROLLBACK.md`.

---

**Só promova para produção quando A–D passarem em staging.**
