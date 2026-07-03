# Zion OS v1.1

Sistema interno da **Zion Company** — agência especializada em ajudar empresários a iniciar, organizar e escalar vendas em marketplaces (Mercado Livre, TikTok Shop, Shopee e Amazon).

## O que mudou na v1.1

A v1.0 era somente leitura. A v1.1 transforma o Zion OS em uma **ferramenta operacional**:

- **CRUD funcional** em todos os módulos (criar, editar, excluir), com persistência em localStorage
- **Páginas de detalhe**: `/clientes/[id]` (visão 360° com produtos, anúncios, tarefas, relatórios e financeiro vinculados), `/produtos/[id]`, `/anuncios/[id]` (com melhorias sugeridas) e `/agentes/[id]` (com histórico de execuções)
- **Formulários** com validação básica para todas as entidades; campos importantes vazios são salvos como "Informação necessária"
- **Onboarding operacional**: checklist de 14 itens por cliente, cada item com status Pendente / Em andamento / Concluído / Travado — o status geral reflete automaticamente no cadastro do cliente
- **Tarefas vinculadas** a cliente, produto, anúncio e agente, com botão "Criar tarefa relacionada" nas páginas de detalhe
- **Busca global** no header (clientes, produtos, anúncios, tarefas e agentes) com página `/busca`
- **Estados vazios** com mensagens úteis e botões de criação
- **Ações rápidas**: concluir tarefa na lista, marcar pagamento como pago/atrasado, marcar cliente em risco/ativo, alterar implantação de agente

## Stack

- [Next.js](https://nextjs.org/) (App Router) + TypeScript
- Tailwind CSS v4 + lucide-react
- Persistência local: **localStorage**, com seed a partir de `src/lib/data/`

## Como rodar

Pré-requisito: Node.js 18+.

```bash
cd zion-os
npm install
npm run dev      # http://localhost:3000
```

Build de produção: `npm run build && npm start`.

## Como usar o sistema

- **Criar cliente** — botão "Novo cliente" em `/clientes` (ou pelo estado vazio da tabela). Preencha ao menos o nome da empresa; o restante pode ficar como "Informação necessária". Clicar num cliente abre a visão 360° com tudo que está vinculado a ele.
- **Criar produto** — "Novo produto" em `/produtos`, ou o botão "Produto" dentro da página do cliente (já vem com o cliente selecionado).
- **Criar tarefa** — "Nova tarefa" em `/tarefas`, ou "Criar tarefa relacionada" dentro de cliente/produto/anúncio (chega pré-vinculada). Tarefas podem apontar para produto, anúncio e agente. O ✓ na lista conclui a tarefa direto.
- **Onboarding** — em `/onboarding`, cada cliente tem um checklist de 14 itens; altere o status de cada item direto no card. Quando tudo estiver concluído, o cliente vira "Ativo" automaticamente; enquanto estiver em andamento, fica como "Onboarding". Use "Iniciar onboarding de…" para abrir o fluxo de um cliente novo.
- **Agentes IA** — "Executar agente" registra uma execução simulada no histórico do agente (visível em `/agentes/[id]`).
- **Financeiro** — registre mensalidades e use os botões de ação para marcar pago/atrasado.
- **Busca** — digite no campo do header e pressione Enter.
- **Restaurar demonstração** — em `/configuracoes`, o botão "Restaurar dados de demonstração" volta tudo ao estado inicial.

## Arquitetura de dados (pronta para Supabase)

```
Telas (src/app)  →  Serviços (src/lib/services)  →  Store (src/lib/store.ts → localStorage)
                        ↑ funções assíncronas          ↑ seed: src/lib/data/*.ts
```

- As telas **nunca** acessam o store diretamente — só chamam os serviços (`listarClientes()`, `criarTarefa()`, …), todos assíncronos.
- Para migrar para Supabase: crie as tabelas espelhando `src/lib/types.ts` e reimplemente o corpo das funções em `src/lib/services/*` com queries reais. **Nenhuma tela precisa mudar.** O arquivo `store.ts` é descartado.
- O hook `useLiveQuery` (`src/lib/hooks.ts`) re-renderiza as telas quando os dados mudam; pode ser substituído por React Query/realtime na migração.
- Observação: os vínculos entre entidades usam o **nome** do cliente/produto (herança dos mocks). Na migração para Supabase, troque por chaves estrangeiras por id.

## Estrutura de pastas

```
src/
├── app/                       # Rotas — lista, detalhe ([id]), criação (novo) e edição ([id]/editar)
│   ├── busca/                 # Busca global
│   └── <módulo>/…
├── components/
│   ├── layout/                # AppShell (sidebar + header com busca)
│   ├── forms/                 # Um formulário por entidade (criar + editar)
│   └── ui/                    # Badge, Button, Card, EmptyState, FilterSelect,
│                              # form (Field/Input/Select), PageHeader, StatCard, Table
└── lib/
    ├── types.ts               # Tipos de todos os módulos
    ├── constantes.ts          # Listas de status/áreas/equipe válidas
    ├── status.ts              # Mapa status → cor dos badges
    ├── onboarding.ts          # Checklist de onboarding + status geral derivado
    ├── format.ts              # Moeda, data, atraso
    ├── store.ts               # Persistência localStorage (descartável na migração)
    ├── hooks.ts               # useLiveQuery
    ├── services/              # Camada de serviço — a API interna do sistema
    └── data/                  # Seeds de demonstração
```

## Limitações conhecidas

- Dados vivem no navegador: cada máquina/navegador tem seu próprio estado, sem sincronização entre pessoas.
- Execução de agentes é simulada (registra histórico, não chama IA real).
- Sem autenticação e sem integrações externas (por decisão de escopo da v1.1).

## Próximos passos recomendados (v1.2)

1. **Supabase**: tabelas + reimplementação dos serviços (a arquitetura já está pronta)
2. **Autenticação** da equipe (Supabase Auth)
3. **Execução real dos agentes** via API Claude, usando o prompt de cada agente
4. Vínculos por **id** em vez de nome (junto com a migração)
5. Integrações com os marketplaces (começando por Mercado Livre)
