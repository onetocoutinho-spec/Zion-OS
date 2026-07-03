# Zion OS v1

Sistema interno da **Zion Company** — agência especializada em ajudar empresários a iniciar, organizar e escalar vendas em marketplaces (Mercado Livre, TikTok Shop, Shopee e Amazon).

Este é um **MVP funcional para uso interno**, com dados mockados. Não há integração real com marketplaces ou banco de dados nesta versão.

## Stack

- [Next.js](https://nextjs.org/) (App Router)
- TypeScript
- Tailwind CSS v4
- lucide-react (ícones)
- Dados mockados em arquivos TypeScript (`src/lib/data/`)

## Como rodar

Pré-requisito: Node.js 18+ instalado.

```bash
cd zion-os
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

Para gerar o build de produção:

```bash
npm run build
npm start
```

## Módulos

| Rota | Módulo |
| --- | --- |
| `/` | Dashboard com indicadores e resumo da operação |
| `/clientes` | Carteira de clientes (status, risco, próximas ações) |
| `/onboarding` | Checklist de entrada de novos clientes |
| `/produtos` | Base de produtos e esteira de cadastro |
| `/anuncios` | Esteira de otimização de anúncios |
| `/agentes` | Agentes de IA da agência (com botão "Executar agente" visual) |
| `/tarefas` | Tarefas da operação com prazos e responsáveis |
| `/relatorios` | Relatórios de período por cliente |
| `/financeiro` | Mensalidades, custos e lucro estimado |
| `/configuracoes` | Dados da agência, equipe e roadmap de integrações |

## Estrutura de pastas

```
src/
├── app/                    # Rotas (App Router) — uma pasta por módulo
│   ├── page.tsx            # Dashboard
│   ├── clientes/page.tsx
│   ├── onboarding/page.tsx
│   ├── produtos/page.tsx
│   ├── anuncios/page.tsx
│   ├── agentes/page.tsx
│   ├── tarefas/page.tsx
│   ├── relatorios/page.tsx
│   ├── financeiro/page.tsx
│   └── configuracoes/page.tsx
├── components/
│   ├── layout/             # AppShell (sidebar + header) e navegação
│   └── ui/                 # Componentes reutilizáveis: Badge, Card,
│                           # StatCard, Table, FilterSelect, PageHeader
└── lib/
    ├── types.ts            # Tipos de todos os módulos
    ├── status.ts           # Mapa status → cor dos badges
    ├── format.ts           # Formatação de moeda e data
    └── data/               # Dados mockados (um arquivo por módulo)
```

## Como evoluir para dados reais

Os componentes de tela consomem os arrays exportados de `src/lib/data/*`. Para conectar um banco (ex.: Supabase):

1. Crie as tabelas espelhando os tipos de `src/lib/types.ts`.
2. Substitua os imports de `lib/data/*` por chamadas de leitura (Server Components ou route handlers).
3. Os tipos e as telas continuam os mesmos — só a fonte de dados muda.

## Próxima versão (roadmap sugerido)

- CRUD real (criar/editar registros nas telas)
- Persistência com Supabase
- Autenticação da equipe
- Execução real dos agentes de IA via API Claude
- Integrações com Mercado Livre, TikTok Shop, Shopee e Amazon
