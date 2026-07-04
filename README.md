# Zion OS v1.7

Sistema interno da **Zion Company** — agência especializada em ajudar empresários a iniciar, organizar e escalar vendas em marketplaces (Mercado Livre, TikTok Shop, Shopee e Amazon).

## O que mudou na v1.7 — Modelagem de produtos para marketplace

A modelagem de produtos passou de "produto simples" para uma estrutura **universal**, que atende calçados, roupas, cosméticos, eletrônicos, casa e utilidades — e produtos simples também.

### Produto pai × Variação × Anúncio (a distinção que importa)

- **Produto pai** (`produtos`): a "ideia" do produto — nome, marca, categoria, descrição base, benefícios, cuidados, **tipo** (simples / com variação / kit / combo / catálogo).
- **Variação / SKU** (`produto_variantes`): cada derivação **vendável** — ex.: *Tênis Preto 38*. Tem SKU, EAN, custo, preço, estoque, peso/dimensões próprios. **É aqui que o estoque real vive** em produtos com variação.
- **Anúncio** (`anuncios`): o produto publicado **em um marketplace** (título, descrição, categoria do marketplace, id externo).
- **Variação no anúncio** (`anuncio_variantes`): quais derivações foram **enviadas** àquele anúncio, com preço/estoque/ID de variação por marketplace.

### O que foi adicionado

- **Página do produto com abas**: Geral · **Variações** · Atributos · Anúncios · **Precificação** · **Imagens**.
- **Gerador de grade de variações**: informe *Cores: Preto, Avelã* × *Tamanhos: 34,35,36,37* e o sistema cria as 8 combinações de uma vez, cada uma com SKU sugerido, custo, preço e estoque. Edição em lote e uma a uma.
- **Atributos dinâmicos** por produto (ficha técnica flexível por categoria).
- **Templates de categoria** (`/templates`): o molde de cada nicho — campos obrigatórios/recomendados, regras de variação, checklist de anúncio e agentes recomendados.
- **Precificação por derivação**: calculadora que considera custo, embalagem, imposto, taxa do marketplace, taxa fixa e comissão → lucro, margem, preço mínimo e saúde da margem.
- **Imagens** por produto, variação e anúncio.
- **Anúncio → "Variações vinculadas ao anúncio"**: selecione as derivações do produto e defina preço/estoque/ID enviados por marketplace.
- **9 novos agentes**: Produto Pai, Variações e SKUs, Gerador de Grade, Atributos por Categoria, Anúncio por Marketplace, Anúncio Variações ML, Precificação por Derivação, Imagens por Variação, Checklist por Categoria.

### Como rodar a migração (Supabase)

Tudo é **aditivo e não destrutivo** — não apaga dados. No SQL Editor, rode nesta ordem:

1. `database/migrations/001-modelagem-produtos-marketplace.sql` — cria as novas tabelas e colunas.
2. `database/migrations/001b-seed-modelagem.sql` *(opcional)* — insere os 6 templates de categoria, um calçado de exemplo com variações e os 9 novos agentes.

Sem Supabase (modo demonstração), tudo já vem no seed local — os campos novos aparecem automaticamente.

### Como testar — produto de calçado (com variação)

1. Abra **Produtos → "Tênis Casual Urbano"** (ou crie um produto com **Tipo = Com variação**).
2. Aba **Variações**: veja as derivações cor × tamanho, cada uma com SKU/EAN/estoque próprios.
3. Clique **"Gerar grade de variações"**, digite `Cores: Verde` e `Tamanhos: 34, 35, 36` → **Gerar** cria as 3 combinações com SKU automático.
4. Aba **Precificação**: escolha uma variação, informe custo e taxas → o sistema calcula lucro, margem e preço mínimo, e salva por derivação.
5. Crie um **anúncio** para o produto e, na página do anúncio, em **"Variações vinculadas ao anúncio"**, vincule as derivações e defina preço/estoque enviados.

### Como testar — produto simples (sem variação)

1. Crie um produto com **Tipo = Simples** (ex.: o "Farol de Milha Universal LED" já existente).
2. A aba **Geral** mostra custo/preço/estoque direto no produto (sem precisar de variações).
3. As abas Variações/Precificação/Imagens continuam disponíveis, mas você não precisa usá-las — o produto simples funciona só com os dados do pai.

### Como isso se conecta com o Mercado Livre (e outros)

A estrutura espelha como o ML organiza catálogo: **item (produto) → variações (por atributo) → estoque/preço por variação**. Cada `anuncio_variantes` guarda o `id_variacao_marketplace` — o campo onde, numa versão futura com a API do ML, vamos gravar o ID que o marketplace devolve ao publicar cada derivação. Os `categoria_templates` mapeiam os atributos exigidos por categoria (o que o ML chama de "ficha técnica"), reduzindo bloqueio de anúncio. **Nenhuma integração com API de marketplace foi conectada ainda** — a modelagem é que está pronta para receber.

## O que mudou na v1.6

O ciclo **dados → IA → ação** fechou: os resultados dos agentes agora podem ser aplicados de volta no sistema com um clique.

- **Saída estruturada**: além da entrega em Markdown, o Claude retorna (via JSON Schema, `output_config`) dois extras opcionais — um **título otimizado** e até 5 **tarefas sugeridas**.
- **"Aplicar no anúncio"**: quando há um anúncio no contexto e o agente gera um título otimizado, um clique salva direto no campo "Título otimizado" do anúncio.
- **"Criar tarefa"**: cada tarefa sugerida vira tarefa real com um clique — já vinculada ao cliente/produto/anúncio do contexto e ao agente, com prioridade sugerida e prazo de 7 dias.
- No **modo simulado** (sem `ANTHROPIC_API_KEY`), as ações vêm com dados de exemplo marcados como `[SIMULAÇÃO]` — para experimentar o fluxo completo.

## O que mudou na v1.5

- **Agentes com contexto do sistema**: o painel de execução (`/agentes/[id]`) ganhou seletores de **Cliente / Produto / Anúncio**. Ao selecionar, o Zion OS monta automaticamente um bloco com os dados já cadastrados (custo, preço, títulos, status da esteira, observações da equipe…) e envia junto para o Claude — com preview do que será enviado.
- **Atalho "✦ Executar agente IA…"** nas páginas de detalhe de cliente, produto e anúncio: escolha o agente e chegue ao painel com o contexto pré-selecionado. Ex.: da página de um anúncio, execute o Zion SEO ML com título, categoria e esteira já preenchidos.
- Com contexto selecionado, a instrução digitada vira **opcional** — vazio, o agente executa sua função direto sobre os dados.
- Histórico registra o contexto usado (ex.: `[TechSound Brasil · Fone TWS Pro] …`).

## O que mudou na v1.4

- **Execução real dos Agentes IA via API Claude**: na página de cada agente (`/agentes/[id]`), informe a entrada e clique em "Executar agente" — o sistema monta o prompt a partir da definição do agente (objetivo, instruções, saída esperada) e chama o Claude (`claude-opus-4-8`, com adaptive thinking). O resultado aparece na tela e fica salvo no histórico.
- **Histórico tipado**: cada execução agora é marcada como **IA** (real) ou **Simulada**.
- **Segurança**: a `ANTHROPIC_API_KEY` fica somente no servidor (rota `/api/agentes/executar`) — nunca vai para o navegador.
- **Fallback preservado**: sem a chave configurada, o botão continua funcionando em modo simulado, com aviso.

### Como ativar a execução real

1. Crie uma chave de API em [platform.claude.com](https://platform.claude.com) (Console → API Keys).
2. Adicione ao `.env.local`:
   ```env
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Reinicie o `npm run dev`.
4. **Bancos criados na v1.2/v1.3**: rode `database/supabase-migracao-v1.4.sql` no SQL Editor (adiciona a coluna `tipo` ao histórico). Instalações novas já vêm com ela.

> 🔴 A chave da API Claude é cobrada por uso. Não a commite e não a exponha em variáveis `NEXT_PUBLIC_*`.

## O que mudou na v1.3

- **Login da equipe (Supabase Auth)**: com o Supabase configurado, o sistema exige e-mail/senha antes de entrar; logout e usuário logado no header. Sem Supabase, o modo demonstração continua entrando direto.
- **Realtime**: alterações feitas por um colega (criar/editar/excluir em qualquer módulo) atualizam as telas abertas automaticamente, sem recarregar (`database/supabase-realtime.sql`).
- **Módulo de Reuniões** (`/reunioes`): agenda por cliente com data/hora, pauta e status (Agendada/Realizada/Cancelada), ações rápidas e card de reuniões na página do cliente.
- **Módulo de Pendências** (`/pendencias`): tudo que depende do cliente, com vínculo opcional a tarefa, resolver/reabrir em um clique.
- As tabelas `reunioes` e `pendencias` (criadas na v1.2) agora têm telas.

Histórico: **v1.2** migrou a persistência para Supabase (PostgreSQL) com fallback local · **v1.1** trouxe CRUD, detalhes, onboarding operacional e busca · **v1.0** MVP visual.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Supabase (PostgreSQL + Auth + Realtime, via supabase-js)
- lucide-react

## Configuração do Supabase (passo a passo)

### 1. Criar o projeto
[supabase.com](https://supabase.com) → **New project** (nome, senha do banco, região).

### 2. Rodar os SQLs (no SQL Editor, nesta ordem)
1. `database/supabase-schema.sql` — tabelas, índices e triggers
2. `database/supabase-rls.sql` — Row Level Security (acesso só para autenticados)
3. `database/seed.sql` — dados de demonstração (rode uma única vez)
4. `database/supabase-realtime.sql` — habilita a atualização em tempo real

### 3. Criar os usuários da equipe
1. Dashboard → **Authentication → Users → Add user** → e-mail + senha de cada pessoa (marque "Auto confirm").
2. Recomendado: em **Authentication → Sign In / Up**, desative *"Allow new users to sign up"* — o Zion OS é interno, contas só via administrador.

### 4. Variáveis de ambiente
Copie `.env.example` para `.env.local` e preencha com os valores de **Project Settings → API**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=chave-anon-public
```

Reinicie o `npm run dev` após editar.

> 🔴 **Segurança**: use somente a chave **anon public** no frontend. A chave **service_role ignora o RLS e nunca pode ir para o navegador**. O `.env.local` está no `.gitignore`.

## Como rodar

```bash
cd zion-os
npm install
npm run dev      # http://localhost:3000
```

- **Com** `.env.local` → tela de login → dados compartilhados no Supabase, com atualização em tempo real entre as pessoas.
- **Sem** `.env.local` → modo demonstração local (localStorage), sem login.

Build de produção: `npm run build && npm start`.

## Arquitetura

```
AuthGate (login quando Supabase ativo) + RealtimeSync (postgres_changes → re-consulta)
   ↓
Telas (src/app)  →  Serviços (src/lib/services)  →  Repositório (src/lib/repositorio.ts)
                                                        ├── Supabase (src/lib/supabase/)
                                                        └── localStorage (fallback demo)
```

- As telas nunca acessam o banco direto — só os serviços (assinaturas estáveis desde a v1.1).
- Escritas disparam `notificarMudanca()`; no Supabase, o `RealtimeSync` dispara o mesmo evento quando **outra pessoa** escreve. O `useLiveQuery` re-executa as consultas das telas abertas nos dois casos.
- Vínculos por ID (`cliente_id`, `produto_id`, `anuncio_id`, `agente_id`, `tarefa_id`) com nomes de exibição resolvidos por join.

## Módulos

| Rota | Módulo |
| --- | --- |
| `/` | Dashboard com indicadores em tempo real |
| `/clientes` | Carteira de clientes — visão 360° com tudo vinculado |
| `/onboarding` | Checklist operacional de 14 itens por cliente |
| `/produtos` · `/anuncios` | Base de produtos e esteira de otimização |
| `/agentes` | Agentes IA com histórico de execuções |
| `/tarefas` | Tarefas vinculadas a cliente/produto/anúncio/agente |
| `/reunioes` | **Novo** — agenda de reuniões por cliente |
| `/pendencias` | **Novo** — pendências dos clientes, com vínculo a tarefas |
| `/relatorios` · `/financeiro` · `/configuracoes` · `/busca` | Demais módulos |

## Limitações conhecidas

- Autenticação é por e-mail/senha, sem papéis/permissões por função (todas as contas veem tudo — RLS granular fica para versões futuras).
- A proteção de rota é client-side (adequada para ferramenta interna; os dados em si já são protegidos pelo RLS no servidor).
- No modo demonstração (sem Supabase) não há login nem tempo real — é um sandbox local (a execução via IA funciona normalmente, desde que a `ANTHROPIC_API_KEY` esteja configurada).

## O que falta para a v1.8 (recomendado)

1. **Integração real com o Mercado Livre**: usar a modelagem da v1.7 para publicar anúncios com variações via API (o campo `id_variacao_marketplace` já está pronto).
2. **Permissões por função/cliente** nas políticas RLS.
3. Notificações internas (tarefas atrasadas, pendências antigas, reuniões do dia).
4. Portal do cliente (visão externa read-only).
5. Upload real de imagens (hoje é por URL).
