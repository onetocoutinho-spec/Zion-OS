# 06 — Testes

> Regra: só marcamos como "testado" o que foi **executado de verdade**. O resto está listado como pendente de staging (precisa de Supabase + app ML reais).

## Executado nesta máquina (resultado real)

### 1. Typecheck do projeto — ✅ PASSOU
```
npx tsc --noEmit    → exit 0 (sem erros)
```
Cobre todos os arquivos alterados (rotas, serviços, auth, canal, AuthGate, perfil). Garante que o refactor não deixou referência quebrada (ex.: `atualizarRefreshToken` removido, `CanalMarketplace` sem `refreshToken`).

### 2. Testes unitários das funções puras de autorização — ✅ 13/13 PASSARAM
```
node --test src/lib/auth/serverAuthorization.test.ts
→ tests 13 · pass 13 · fail 0
```
Cobrem a lógica de decisão (o coração de R1/R6), sem rede:
- `lerTokenBearer`: header ausente/vazio → null; `Bearer <jwt>` → token; `bearer` minúsculo + espaços; esquema não-Bearer → null; `Bearer` vazio → null.
- `avaliarAcesso`: sem perfil → 403; inativo → 403; regra equipe/cliente exige o papel; equipe acessa qualquer cliente; cliente A acessa A e **não** B; cliente B **não** acessa A; cliente sem `clienteId` nunca casa alvo.

> Rodar de novo: `node --test src/lib/auth/serverAuthorization.test.ts` (Node ≥ 22; executa TS nativamente).

## NÃO executado (requer staging — ver checklist)
Estes cenários dependem de Supabase real, duas empresas e um app ML — **não foram rodados** e estão no `docs/security-validation-checklist.md`:

**Acesso (R1/R6):**
1. Não autenticado → 401 nas rotas sensíveis.
2. Autenticado sem perfil → 403 (e tela "Acesso não liberado").
3. Cliente A acessa recursos de A; **não** acessa B; B não acessa A.
4. Equipe acessa os clientes.
5. Perfil inativo → sem acesso.
6. `clienteId` trocado à mão no corpo não muda a autorização.

**Mercado Livre (R3):**
7. Nenhuma resposta de `/api/ml/*` contém `refresh_token` (DevTools → Network).
8. Nenhuma requisição do browser envia `refresh_token`.
9. Token não aparece em logs.
10. OAuth conecta; dry-run funciona; publicação controlada funciona; tentativa com cliente de outra empresa → 403.

## Observações
- Não há framework de testes instalado no projeto (só `lint`). Usamos o **runner nativo do Node** para não adicionar dependência (conforme a orientação da tarefa). Os testes ficam em `*.test.ts`, excluídos do build via `tsconfig.json`.
- Sugestão futura: adicionar testes de integração das rotas (mock de Supabase/fetch) quando um framework for adotado.
