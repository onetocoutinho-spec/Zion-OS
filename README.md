# Zion OS v1.2

Sistema interno da **Zion Company** — agência especializada em ajudar empresários a iniciar, organizar e escalar vendas em marketplaces (Mercado Livre, TikTok Shop, Shopee e Amazon).

## O que mudou na v1.2

A v1.2 migra a persistência do localStorage para o **Supabase (PostgreSQL)**, transformando o Zion OS em um sistema **compartilhado pela equipe**:

- **Banco real**: schema com 12 tabelas, foreign keys, índices e triggers de `updated_at` (`database/supabase-schema.sql`)
- **Segurança básica**: RLS ativo em todas as tabelas; acesso apenas para usuários autenticados (`database/supabase-rls.sql`)
- **Seed SQL** com os dados de demonstração (`database/seed.sql`)
- **Vínculos por ID**: produtos, anúncios, tarefas, relatórios, financeiro e onboarding agora se relacionam por `cliente_id`/`produto_id`/`anuncio_id`/`agente_id` (as telas continuam exibindo nomes, resolvidos por join)
- **Modo demonstração preservado**: sem `.env.local`, o sistema roda 100% local (localStorage), como na v1.1 — útil para testar sem banco
- **Nenhuma tela foi reescrita**: a troca aconteceu na camada de serviços, como planejado na arquitetura da v1.1

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Supabase (PostgreSQL + supabase-js)
- lucide-react

## Configuração do Supabase (passo a passo)

### 1. Criar o projeto

1. Acesse [supabase.com](https://supabase.com) e crie uma conta/organização.
2. **New project** → escolha nome (ex.: `zion-os`), senha do banco e região (São Paulo, se disponível).
3. Aguarde o provisionamento (~2 min).

### 2. Rodar o schema

1. No dashboard do projeto, abra **SQL Editor**.
2. Cole o conteúdo de `database/supabase-schema.sql` e clique **Run**.

### 3. Rodar o RLS

1. Ainda no SQL Editor, cole `database/supabase-rls.sql` e **Run**.
2. ⚠️ **Atenção**: as políticas padrão só liberam usuários **autenticados**. Como a tela de login chega na v1.3, para testar agora você tem duas opções:
   - descomentar o bloco `dev_anon_temporario` no final do arquivo (acesso anônimo **temporário** — remova antes de colocar dados reais), ou
   - aguardar a v1.3 com autenticação.

### 4. Rodar o seed (dados de demonstração)

1. No SQL Editor, cole `database/seed.sql` e **Run** (uma única vez).

### 5. Configurar variáveis de ambiente

1. No dashboard: **Project Settings → API**.
2. Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=chave-anon-public
```

3. Reinicie o `npm run dev` (as variáveis são lidas no start).

> 🔴 **Segurança**: use somente a chave **anon public** no frontend. A chave **service_role ignora o RLS e nunca pode ir para o navegador**, para o código do frontend nem para variáveis `NEXT_PUBLIC_*`. O `.env.local` está no `.gitignore` — não commite chaves.

## Como rodar o projeto

```bash
cd zion-os
npm install
npm run dev      # http://localhost:3000
```

- **Com** `.env.local` configurado → dados no Supabase, compartilhados pela equipe (sidebar mostra "Conectado ao Supabase").
- **Sem** `.env.local` → modo demonstração local, com botão "Restaurar dados de demonstração" em Configurações.

Build de produção: `npm run build && npm start`.

## Como a migração foi estruturada

```
Telas (src/app)
   ↓  (inalteradas — só chamam serviços)
Serviços (src/lib/services/*)          ← assinaturas mantidas
   ↓
Repositório (src/lib/repositorio.ts)   ← decide a fonte de dados
   ├── Supabase (src/lib/supabase/)    quando .env.local configurado
   │     ├── client.ts                 cliente com anon key
   │     ├── database.types.ts         tipos das linhas (snake_case)
   │     └── mappers.ts                linha do banco ↔ tipo do app
   └── localStorage (src/lib/store.ts) fallback de demonstração
```

- Cada serviço cria um repositório apontando para a **tabela** (com o `select` de joins, ex.: `*, clientes(empresa)`) e a **coleção local** equivalente.
- Inserts/updates usam `.select().single()` para devolver o registro atualizado com os nomes de exibição já resolvidos.
- Após cada escrita, `notificarMudanca()` faz o `useLiveQuery` re-executar as consultas das telas abertas — a UI atualiza sem reload (sem Realtime nesta versão; a arquitetura aceita `supabase.channel()` futuramente).
- O onboarding é o único serviço com lógica própria: o checklist vive em `onboarding_items` (uma linha por item, upsert em `onboarding_id + chave`) e o status geral é refletido no cliente.
- Tipos do banco são manuais (`database.types.ts`). Futuramente podem ser gerados: `npx supabase gen types typescript --project-id SEU_ID > src/lib/supabase/database.types.ts` (exigirá adaptar os nomes).

## Módulos

| Rota | Módulo |
| --- | --- |
| `/` | Dashboard com indicadores em tempo real |
| `/clientes` (+ detalhe, novo, editar) | Carteira de clientes — visão 360° |
| `/onboarding` | Checklist operacional de 14 itens por cliente |
| `/produtos` (+ detalhe, novo, editar) | Base de produtos |
| `/anuncios` (+ detalhe, novo, editar) | Esteira de otimização com melhorias sugeridas |
| `/agentes` (+ detalhe, novo, editar) | Agentes IA com histórico de execuções |
| `/tarefas` (+ nova, editar) | Tarefas vinculadas a cliente/produto/anúncio/agente |
| `/relatorios`, `/financeiro`, `/configuracoes`, `/busca` | Demais módulos |

## Limitações conhecidas

- **Sem login ainda** — o RLS exige usuário autenticado; para testar antes da v1.3 é preciso o bloco temporário de acesso anônimo (documentado no `supabase-rls.sql`).
- Execução de agentes continua simulada (registra histórico, não chama IA).
- Sem Realtime: outra pessoa editando só aparece ao recarregar/navegar (a sua própria edição atualiza na hora).
- Tabelas `reunioes` e `pendencias` já existem no banco, mas ainda não têm telas (v1.3).

## O que falta para a v1.3 (recomendado)

1. **Autenticação** (Supabase Auth): tela de login, sessão, e remoção do bloco anônimo do RLS
2. **Realtime** nas listas principais (`supabase.channel`) para colaboração ao vivo
3. Módulos de **reuniões** e **pendências** (tabelas já criadas)
4. **Execução real dos agentes** via API Claude
5. Permissões por função/cliente nas políticas RLS
