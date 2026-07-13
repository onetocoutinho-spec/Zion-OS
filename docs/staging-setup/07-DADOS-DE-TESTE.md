# 07 — Dados de Teste

Cenário mínimo para validar isolamento e autorização:

```
Empresa A → Cliente A (perfil cliente, ativo) → Produto A
Empresa B → Cliente B (perfil cliente, ativo) → Produto B
Usuário da equipe (perfil equipe, ativo)
Usuário SEM perfil (só existe no Auth)
Usuário com perfil INATIVO (perfil cliente, ativo=false)
```

## Método correto para criar usuários
**Nunca** insira linhas em `auth.users` por SQL — isso quebra o Supabase Auth (senha/hash/identity). Crie os usuários por um destes caminhos:

- **Painel:** Supabase → Authentication → **Add user** (e-mail + senha). Anote o **User UID** de cada um.
- **Admin API:** `supabase.auth.admin.createUser({ email, password, email_confirm: true })` (server-side, com a `service_role` de staging).

Crie 4 usuários: **Cliente A**, **Cliente B**, **Equipe**, **Inativo**, e um 5º **Sem perfil** (não receberá linha em `perfis`).

## Vincular UUIDs aos perfis/empresas
Depois de ter os UUIDs, use o template **`database/staging/03-seed-test-data-template.sql`**:
1. Substitua `<TEAM_USER_UUID>`, `<USER_A_UUID>`, `<USER_B_UUID>`, `<INACTIVE_USER_UUID>` pelos UUIDs reais.
2. Rode o script (ele cria Empresa A/B, Produto A/B e os perfis; **não** cria o usuário "sem perfil" de propósito).
3. Ordem: o seed roda **antes** da 016 (os perfis entram sem `ativo`). **Depois** de aplicar a 016, marque o inativo:
   ```sql
   update public.perfis set ativo = false where id = '<INACTIVE_USER_UUID>';
   ```

## Regras
- **Nunca** use UUIDs reais de produção nos arquivos versionados — só placeholders.
- Os dados de teste são marcados (`[TESTE STAGING]` nas empresas, `[TESTE]` nos perfis) para a limpeza (`database/staging/05-cleanup-test-data.sql`).
- Não use clientes/produtos reais. Tudo é sintético e identificável.

## O que cada usuário deve provar (no passo de validação)
| Usuário | Resultado esperado |
|---------|--------------------|
| Cliente A | vê A; **não** vê B; APIs de B → 403 |
| Cliente B | vê B; **não** vê A |
| Equipe | vê A e B (não perdeu acesso) |
| Sem perfil | tela "Acesso não liberado"; APIs → 403 |
| Inativo | sem acesso; APIs → 403 |
| (sem sessão) | APIs → 401 |
