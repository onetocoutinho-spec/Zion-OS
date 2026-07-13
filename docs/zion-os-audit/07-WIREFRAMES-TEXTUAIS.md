# 07 — Wireframes Textuais

> **Esboço de navegação e telas** para o cliente operar sozinho, comparado com as rotas que já existem. Não é o layout final — é a direção. As rotas atuais estão em `src/app/*` (equipe) e `src/app/cliente/*` (cliente).

## Navegação inicial sugerida (Portal do Cliente)

```
Visão Geral      → /cliente            (existe: resumo via portal_resumo())
Catálogo         → /cliente/produtos   (existe)
Anúncios         → /cliente/anuncios   (existe)
Otimizações      → /cliente/otimizar   (existe: ferramentas por agente)
Aprovações       → (novo — hoje diluído em anúncios/pendências)
Publicações      → (novo — hoje dentro de anúncios)
Performance      → /cliente/vendas + /cliente/relatorios (existem)
Integrações      → /cliente/conectar-ml (existe)
Configurações    → /cliente/configuracoes, /cliente/medidas (existem)
```

Mapeamento com o que já existe: a maior parte das telas **já está construída**; o esboço reorganiza a navegação e propõe **Aprovações** e **Publicações** como áreas próprias (hoje estão misturadas com "anúncios" e "pendências").

---

## VISÃO GERAL (`/cliente`)

Alimentada por `portal_resumo()` (migração 005) — já retorna total de produtos, em produção, aprovados, publicados.

```
┌────────────────────────────────────────────────────────┐
│  Olá, {empresa}          Próxima ação: {proxima_acao}  │
├───────────────┬───────────────┬───────────────┬────────┤
│ 1.248 anúncios│ 186 oportuni- │ 32 com erro   │ 74 sem │
│ ativos        │ dades         │               │ publicar│
├───────────────┴───────────────┴───────────────┴────────┤
│ Ações recomendadas                                      │
│  • Otimizar 184 títulos            [Otimizar]           │
│  • Corrigir 26 variações           [Revisar]           │
│  • Completar 73 fichas técnicas    [Completar]         │
├────────────────────────────────────────────────────────┤
│ Fila de otimização: 12 processando · 3 com erro  [Ver] │  ← status de fila_otimizacao_produto
└────────────────────────────────────────────────────────┘
```
*Gap a cobrir:* o card "com erro" e o status da fila dependem de refletir o worker sem refresh (R12).

## CATÁLOGO (`/cliente/produtos`)

```
┌────────────────────────────────────────────────────────┐
│ Buscar [_________]  Filtros: [Marca▾][Status▾][Canal▾] │
│ [Importar planilha] [Importar do ML] [Otimizar tudo]   │
├────────────────────────────────────────────────────────┤
│ ☐ Produto           SKUs  Custo  Status     Ações      │
│ ☐ Papete Modare…    4     ✔      Otimizado  [Medidas]  │
│ ☐ Chinelo Havai…    6     ⚠ s/custo Rascunho [Kit][…]  │
│ … paginação …                                          │
├────────────────────────────────────────────────────────┤
│ Selecionados: 12  → [Otimizar] [Publicar] [Exportar]   │  ← ações em lote
└────────────────────────────────────────────────────────┘
```
*Já existe:* importar planilha/ML, "Otimizar tudo" (enfileira), botões Medidas/Kit. *Gap:* ação em lote **Publicar** (depende de enfileirar publicação — R2).

## ANÚNCIOS (`/cliente/anuncios`)

```
┌────────────────────────────────────────────────────────┐
│ Status: [Rascunho][Aguardando aprovação][Aprovado][Pub]│
├────────────────────────────────────────────────────────┤
│ Título otimizado          Nota  Pendências  Status     │
│ Papete Modare Conforto…    82    0           Aprovado  │
│ Chinelo Slide Nuvem…       58    3 ⚠         Rascunho  │
├────────────────────────────────────────────────────────┤
│  [Abrir]  → detalhe com abas: Conteúdo · Ficha · Medidas · Variações · Imagens · FAQ │
└────────────────────────────────────────────────────────┘
```
*Já existe* em `anuncios_gerados` (nota, pendências, veredito A10, status).

## OTIMIZAÇÕES (`/cliente/otimizar`)

```
Ação única para o cliente: [ Otimizar anúncio ]
   (internamente roda a esteira A0→…→A10; o cliente não vê os agentes)

Ferramentas avulsas (cada uma = 1 agente do catálogo):
 [Título A3] [Descrição A5] [SEO A2] [Ficha A6] [Medidas A7] [Imagens A12] [Auditoria A1] [FAQ]
```
*Já existe:* `agentePorFerramenta()` liga cada ferramenta ao agente (`catalogo.ts`). Recomendação do brief (3.7) já atendida: o cliente vê "Otimizar", os agentes rodam por baixo.

## APROVAÇÕES (novo — hoje diluído)

Esta é a tela que mais **falta** para o cliente operar com confiança. Depende de `auditoria_log`/`aprovacoes` (R5, [05](./05-MODELO-DE-DADOS-SUGERIDO.md)).

```
┌──────────────────────────────────────────────────────────────┐
│ 47 alterações aguardando aprovação   [Aprovar seguras] [▾]    │
├──────────────────────────────────────────────────────────────┤
│ Produto: Papete Modare 7208.101                              │
│ ┌─ Título ────────────────────────────────────────────────┐ │
│ │ Atual:    Papete Modare feminina preta 34 nobuck        │ │
│ │ Sugerido: Papete Modare Nobuck Conforto Feminina        │ │
│ │ Motivo:   keyword na frente, sem cor/tamanho (A3)       │ │
│ │ Risco: baixo   Agente: A3   Confiança: 0.86             │ │
│ │        [Aprovar] [Editar] [Rejeitar]                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─ Preço ─────────────────── exige aprovação manual ──────┐ │
│ │ Atual: R$ 79,90  →  Sugerido: R$ 89,90 (margem 22%)     │ │
│ └─────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│ Aprovar em lote por tipo: [Títulos] [Descrições] [Fichas]   │
│ Automático para alterações seguras: [ativado]  Preço/publicar: [sempre pedir] │
└──────────────────────────────────────────────────────────────┘
```
*Requisitos de dados:* estado atual, sugerido, motivo, risco, agente, confiança (não existem hoje campo-a-campo). *Requisitos de fluxo:* aprovar/editar/rejeitar, em lote, por tipo, automação de alterações seguras, trava para preço/publicação (3.8 do brief).

## PUBLICAÇÕES (novo — hoje dentro de anúncios)

```
┌────────────────────────────────────────────────────────┐
│ Fila de publicação: 8 na fila · 120 publicados · 2 erro│
├────────────────────────────────────────────────────────┤
│ Anúncio            Canal  Status      MLB       Ação    │
│ Papete Modare…     ML     Publicado   MLB123…   [Ver]  │
│ Chinelo Slide…     ML     Erro: cat.  —         [Reproc]│
└────────────────────────────────────────────────────────┘
```
*Gap:* depende de enfileirar publicação (R2) e do modo User Products (R7). Hoje a publicação é síncrona e o status vive em `anuncios_gerados`.

## PERFORMANCE (`/cliente/vendas`, `/cliente/relatorios`)

```
┌────────────────────────────────────────────────────────┐
│ Faturamento (30d): R$ 48.900   Lucro líq.: R$ 9.120    │
│ Ticket médio: R$ 82   Pedidos: 596   Taxa ML: R$ 14.6k │
├────────────────────────────────────────────────────────┤
│ Mais vendidos                Anúncios que caíram         │
│ 1. Papete Modare  120 un.    • Chinelo X: visitas -40%   │
└────────────────────────────────────────────────────────┘
```
*Já existe* via `/api/ml/vendas` + `vendasML.ts` (cruza custo por SKU). *Dependência:* custo preenchido (importados vêm com 0).

## INTEGRAÇÕES (`/cliente/conectar-ml`)

```
Mercado Livre   ● Conectado (seller {id})     [Reconectar]
TikTok Shop     ○ Em breve
Shopee          ○ Em breve
```
*Já existe* o card do ML (OAuth funcionando). Os demais aparecem quando houver adapter ([06](./06-ARQUITETURA-RECOMENDADA.md)).

## Avaliação de usabilidade (FATO/observação)
- **Pontos fortes**: as telas centrais existem; "Otimizar tudo" e "Importar do ML" reduzem cliques; ferramentas por agente com nomes simples (sem jargão).
- **Lacunas p/ o cliente operar sozinho**: (1) tela de **Aprovações** com diff e lote; (2) status de **fila/publicação** refletindo o worker sem refresh (R12); (3) sinalização clara de **pendências** que travam a publicação (custo, EAN, tamanho não normalizado).
