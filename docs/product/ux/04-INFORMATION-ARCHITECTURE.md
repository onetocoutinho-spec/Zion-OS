# Information Architecture — Zion OS

Data: 2026-08-21 · Versão: 1 · Base: [03](03-RECOMMENDED-EXPERIENCE.md)

## Navegação — Agency (equipe e agência)

Fonte única: um `nav.ts` com grupos, cada item com `pergunta`, `papeis` e `exigeLoja`. O mesmo objeto alimenta o menu **e** o guard de rota.

```
[ Agência ▸ Loja ⌄ ]                      ← switcher / indicador de contexto

Visão geral                 /                 "Qual loja precisa de mim?"

Lojas                                         "Quais lojas eu opero?"
 ├── Todas as lojas         /lojas            (hoje /clientes)
 └── Precisam de atenção    /lojas?estado=atencao

Operação                                      "O que estou fazendo nas lojas?"
 ├── Anúncios               /anuncios         esteira · lote · aprovações (abas)   (hoje /esteira, /esteira/lote, /esteira/aprovacoes)
 ├── Auditoria              /auditoria        importar · fila de otimização (abas) (hoje /auditoria-massa, /fila-otimizacao, /otimizar-lote)
 ├── Produtos               /produtos
 ├── Pendências             /pendencias
 └── Vendas                 /vendas

Acompanhamento                                "O que entregamos?"
 └── Relatórios             /relatorios

Zion  (só equipe)                             "Como está o motor?"
 ├── Agentes IA             /agentes
 ├── Inteligência           /ail/inteligencia · /ail/padroes (abas)
 ├── Modelos de categoria   /templates
 ├── Usuários               /usuarios  (lista nova) · /usuarios/novo
 ├── Agências               /agencias  (nova: criar agência, vincular lojas)
 └── Configurações          /configuracoes
```

Critérios: todo item responde a pergunta de portfólio; 2 níveis máximo (3º nível = abas); nenhum item duplica outro; itens "Operação" em contexto de portfólio são cross-store com coluna "Loja" e filtro `?loja=`.

## Navegação — Store (lojista, e agência dentro de uma loja)

Mantém as 5 áreas de `navegacao.ts` (já por pergunta). Mudanças:

```
[ Nome da loja ]      chips: ● Mercado Livre  ○ TikTok Shop      ← sem "Portal do Cliente"
(agência: barra "Operando Loja X · ← Todas as lojas" acima)

Hoje        "O que importa agora?"        Visão geral · Assistente · Pendências
Catálogo    "O que sabemos dos produtos?" Produtos · Fotos · Peso e caixa · Medidas · Precificação   (contador de lacunas)
Anúncios    "Como dizemos e prometemos?"  Criar anúncio · Meus anúncios · Auditoria · Ferramentas
Pulso       "Como está a loja?"           Vendas · Relatórios
Loja        "O que combinamos?"           Configurações · Marketplaces (conexão ML) · Ajuda      (hoje "Zion")
```

"Zion" → "Loja": a área fala da loja dele, não da Zion. A conexão do ML deixa de estar só ali: enquanto não conectada, aparece como lacuna #1 em "Hoje".

## Mapa de rotas

| Rota nova | Rota antiga | Ação | Experiência | Contexto exigido |
|---|---|---|---|---|
| `/` | `/` | redesenhar (Agency overview) | agency | agência (ou equipe) |
| `/lojas` | `/clientes` | renomear + redirect | agency | — |
| `/lojas/novo` | `/clientes/novo` | redirect | agency | — |
| `/lojas/[id]` | `/clientes/[id]` | vira Store overview (reusa `/cliente` page) | store | loja |
| `/lojas/[id]/editar` | `/clientes/[id]/editar` | redirect | store | loja |
| `/lojas/[id]/<área>/<tela>` | `/cliente/<tela>` | **mesmo componente**, `ClientPortalProvider` com loja do contexto | store | loja |
| `/anuncios` | `/esteira` | renomear + abas (esteira · lote · aprovações) | agency | `?loja=` opcional |
| `/anuncios/lote` | `/esteira/lote` | redirect | agency | `?loja=` |
| `/anuncios/aprovacoes` | `/esteira/aprovacoes` | redirect | agency | `?loja=` opcional |
| `/auditoria` | `/auditoria-massa` | renomear + abas (auditoria · importar · fila) | agency | `?loja=` |
| `/auditoria/importar` | `/auditoria-massa/importar` | redirect | agency | `?loja=` obrigatório |
| `/auditoria/[id]` | `/auditoria-massa/[id]` | redirect | agency | — |
| `/auditoria/fila` | `/fila-otimizacao` | redirect | agency | `?loja=` |
| `/auditoria/lote` | `/otimizar-lote` | redirect | agency | `?loja=` obrigatório |
| `/produtos`, `/pendencias`, `/vendas`, `/relatorios` | iguais | manter; ler `?loja=` | agency | `?loja=` opcional (obrigatório em `/vendas`) |
| `/usuarios` | — | nova (lista) | zion | equipe |
| `/agencias`, `/agencias/nova` | — | nova | zion | equipe |
| `/busca` | `/busca` | manter + porta no menu mobile | agency | — |
| `/loja/*` | `/cliente/*` | **fase final, opcional:** renomear + redirect | store | perfil |
| `/cliente/conectar-ml?cliente=` | idem | vira `/lojas/[id]/loja/marketplaces` para agência | store | loja |
| `/z` | `/z` | manter sem link até decisão | — | equipe |

Redirects: em `next.config.ts` `redirects()` (permanente: false durante 1 release, depois true). Hoje não existe nenhum redirect — a lista acima é a primeira.

## Padrão de URL

```
Portfólio:      /                       /lojas                 /anuncios?loja=<id>
Dentro da loja: /lojas/<id>             /lojas/<id>/catalogo/produtos?produto=<id>
Lojista:        /cliente (→ /loja)      /cliente/produtos?produto=<id>
```

- **Na URL:** loja (segmento ou `?loja=`), objeto aberto (`?produto=`), filtros de lista (`?estado=`, `?marketplace=`).
- **Em preferência (cookie):** última loja escolhida, largura da sidebar, período padrão.
- **Nunca na URL:** nome da empresa como chave (hoje `?cliente=<empresa>` em 3 formulários → trocar por id).
- Id é o uuid; slug é melhoria futura.

## Fusões e remoções

| Tela | Destino | Justificativa | Risco |
|---|---|---|---|
| `/esteira`, `/esteira/lote`, `/esteira/aprovacoes` | `/anuncios` com 3 abas | uma família, um lugar; `/esteira/lote` hoje é invisível | baixo (redirects) |
| `/auditoria-massa`, `/importar`, `/fila-otimizacao`, `/otimizar-lote` | `/auditoria` com abas | idem; "Otimizar em Massa" e "Fila" são a mesma fila vista de dois ângulos | médio — confirmar com a equipe que a distinção fila × lote não é operacional |
| `/clientes/[id]` (ficha) | `/lojas/[id]` (Store overview) | ficha sem saída operacional vira a home da loja para a agência | baixo |
| "Novo Usuário" (item) | `/usuarios` lista + botão | item de menu sem lista | nenhum |
| tiles inline da home | `StatCard` | duplicação | nenhum |
| "Dashboard" (rótulo) | "Visão geral" | idioma | nenhum |
| `Pill` | `Badge` | duplicação literal | baixo |
| `/cliente/otimizar` "Ferramentas avulsas" | manter, avaliar uso | pode ser redundante com "Otimizar" por linha | — registrar uso antes |
| Nada é removido sem redirect. | | | |

## Glossário da interface

| Conceito | Termo pt-BR na UI | Nunca usar | Onde aparece hoje errado |
|---|---|---|---|
| Unidade operacional (`clientes`) | **Loja** | cliente, empresa, conta, seller, store | `nav.ts:30`, `ClientPortalShell.tsx:57`, `clientes/page.tsx:18`, `cliente/produtos:875` |
| Organização que opera várias lojas (`agencias`) | **Agência** | cliente, org, workspace | — (não aparece em lugar nenhum hoje) |
| Quem contrata a Zion (relação comercial) | **Cliente** — só em telas da equipe (contratos, plano) | — | (emenda a VOC-001 C3: Cliente ≠ Loja) |
| Quem compra no marketplace | **Comprador** | cliente | VOC-001 já define |
| Canal de venda | **Marketplace** | canal, plataforma, integração | ok |
| Conexão OAuth com o marketplace | **Conexão** | integração | `/cliente/conectar-ml` ok |
| Item do catálogo | **Produto** | item, SKU | ok |
| Publicação no marketplace | **Anúncio** | listing, oferta | ok |
| Pendência interna (esteira/cadastro) | **Lacuna** | pendência | `cliente/page.tsx:73-80` |
| Infração/aviso do marketplace | **Pendência do marketplace** | pendência | idem |
| Pessoa com acesso | **Usuário** | membro, colaborador, conta | ok |
| Fila de otimização / esteira | **Esteira** (processo) · **Fila** (o que espera) | otimizar em massa, lote | `nav.ts:34-38` |
| Nota de qualidade | **Nota** | score | `auditoria-massa:71` |
| Situação | **Situação** | status | `clientes/page.tsx:23` |
| Dashboard | **Visão geral** | dashboard | `nav.ts:29` |
| Templates | **Modelos de categoria** | templates | `nav.ts:33` |
| Decision Intelligence / Memória (AIL) | **Inteligência** (abas: Decisões · Padrões) | nomes internos do motor | `nav.ts:42-43` |
