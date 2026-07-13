# 02 — Supabase de Staging

Objetivo: um projeto Supabase **novo e separado** para staging. Nada de produção aqui.

## Passo a passo (painel do Supabase)

1. Acesse o painel do Supabase e clique em **New project**.
2. **Nome sugerido:** `zion-os-staging`.
3. **Organização:** a mesma (ou uma dedicada a testes).
4. **Região:** escolha uma região compatível/perto dos usuários (pode ser a mesma da produção — não há problema, os projetos são isolados).
5. **Database password:** gere uma **senha exclusiva e forte**. **Não** reutilize a senha de produção. Guarde em um cofre (1Password/gerenciador), nunca em arquivo do repositório.
6. Crie o projeto e aguarde provisionar.

## Anote de forma segura (fora do repositório)

Do menu **Project Settings → API** e **Database**:

| Item | Onde | Vai virar (placeholder) |
|------|------|-------------------------|
| Project URL | Settings → API | `SUPABASE_STAGING_URL` |
| anon public key | Settings → API | `SUPABASE_STAGING_ANON_KEY` |
| service_role key | Settings → API | `SUPABASE_STAGING_SERVICE_ROLE_KEY` |
| Database password | (a que você gerou) | usado na connection string do `psql` |
| Project ref | Settings → General | `<STAGING_PROJECT_REF>` |
| Connection string | Settings → Database | usada por `psql`/CLI |

> **Nunca** cole esses valores reais em nenhum documento do repositório. Use os placeholders acima. O arquivo real de variáveis é `.env.staging` (ignorado pelo Git).

## Configurações do projeto de staging

7. **Auth → URL Configuration:**
   - **Site URL:** a URL do deploy de staging (Preview da Vercel ou `staging.zioncompany.online`).
   - **Redirect URLs:** inclua a URL de staging.
8. **Storage:** o bucket de imagens (`produtos-imagens`) é criado pela migração `010` no próprio Supabase de staging — **separado** de produção. Não copie arquivos de produção.
9. **NÃO** copie usuários de produção. Você criará usuários de teste ([07-DADOS-DE-TESTE.md](./07-DADOS-DE-TESTE.md)).
10. **NÃO** copie tokens do Mercado Livre de produção. A conexão de staging usa o app ML de teste.

## Como popular o schema
O projeto nasce vazio. Aplicar o schema (base legada + migrações 001–015) está em [06-APLICACAO-DAS-MIGRACOES.md](./06-APLICACAO-DAS-MIGRACOES.md). A migração de segurança **016** é aplicada só depois, na validação ([08-VALIDACAO-ETAPA-1.md](./08-VALIDACAO-ETAPA-1.md)).

## Backup / restauração
- Supabase mantém backups automáticos do projeto (plano dependente). Para staging, o "backup" relevante é poder **recriar** do zero com estes scripts.
- Alternativa: em vez de partir do vazio, você pode **restaurar um dump de produção** num projeto novo de staging — mas então **anonimize** e **remova** dados/segredos reais antes de testar. (O caminho recomendado aqui é partir do vazio + dados de teste, mais simples e seguro.)
