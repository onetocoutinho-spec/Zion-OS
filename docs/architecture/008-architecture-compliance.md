# 008 — Architecture Compliance

> **Auditoria estrutural.** Compara a **estrutura real** do projeto (código existente) com a **arquitetura-alvo** definida em 000–007, e mede o suporte a: Domain Layer, Application Layer, Infrastructure Layer, Connector SDK, Marketplace Adapter, Event Bus e Product Master. Documento de auditoria — **nenhum código alterado, nenhum arquivo movido, nenhum commit**.

> **Método:** cada afirmação de estrutura é um **FATO** verificável no repo (`arquivo`); cada proposta é **RECOMENDAÇÃO** e está marcada como tal. Baseline lida em 2026-07-13.

---

## Sumário executivo

| Pilar arquitetural (000–007) | Suporte hoje | Veredito |
|------------------------------|--------------|----------|
| **Domain Layer** | Tipos anêmicos (`src/lib/types.ts`), sem entidades com invariantes/comportamento | ❌ Ausente (só modelo de dados) |
| **Application Layer** | Diluído em `src/lib/services/*` (regra + orquestração + acesso a dados juntos) | ⚠️ Parcial/implícito |
| **Infrastructure Layer** | `repositorio.ts` + `store.ts` + `supabase/*` — boa costura, mas **browser-first** e acoplada às telas | ⚠️ Presente, mal isolada |
| **Connector SDK** | Não existe interface; integração ML é concreta | ❌ Ausente |
| **Marketplace Adapter** | `marketplaces/*` é 100% ML-específico, sem contrato polimórfico | ❌ Ausente |
| **Event Bus** | Não existe; só a fila `fila_otimizacao_produto` + worker cron | ❌ Ausente (existe semente reaproveitável) |
| **Product Master** | Informal: `produtos → produto_variantes → anuncios_gerados`; sem agregado canônico/versionamento | ⚠️ Parcial |

**Conclusão:** o projeto está organizado por **pastas técnicas por feature** (padrão Next.js), **não** por **camadas de domínio**. Ele **funciona** e tem seams aproveitáveis (repositório genérico, mappers, gateway de IA, fila+worker), mas **não suporta ainda** as 7 capacidades-alvo sem refatoração de fronteiras. A boa notícia: as costuras existentes permitem uma migração **incremental e não destrutiva** (Strangler Fig), sem reescrita.

---

## 1. Estrutura atual do projeto

**Árvore real (FATO):**

```
src/
  app/                         # Next.js App Router — telas + API (camada de entrega)
    api/                       # rotas server-side (finas)
      agentes/esteira, agentes/executar
      imagens/gerar
      ml/autorizar, ml/conectar, ml/importar-anuncios, ml/publicar, ml/vendas
      otimizar/worker          # worker da fila (Vercel Cron)
      usuarios
    agentes/ anuncios/ auditoria-massa/ busca/ cliente/ clientes/
    configuracoes/ definir-senha/ esteira/ fila-otimizacao/ financeiro/
    onboarding/ otimizar-lote/ pendencias/ produtos/ relatorios/
    reunioes/ tarefas/ templates/ usuarios/ vendas/
  components/                  # UI (agentes, auth, client-portal, forms, layout, produtos, ui)
  lib/
    *.ts                       # auditoria, constantes, contexto, csv, format, hooks,
                               # onboarding, planilha, repositorio, status, store, types, variantes
    agentes/                   # catalogo.ts (A0–A12), esteira.ts, provedorIA.ts, provedorImagem.ts
    auth/                      # estadoAuth, roteamentoPapel, serverAuthorization, definirSenha (+ testes)
    client-portal/             # metrics.ts
    data/                      # seeds/mocks em memória (produtos.ts, anuncios.ts, ...) — fallback de demo
    marketplaces/              # canalServidor, mercadolivre, mlPayload, mlUserProducts  (100% ML)
    services/                  # ~40 arquivos: 1 por entidade (produtos, anuncios, esteira, publicacaoML, ...)
    supabase/                  # admin, client, database.types, mappers, sessao
database/migrations/           # 001..016 (.sql)
docs/architecture/             # 000..007 (+ este 008)
```

**Padrão de acesso a dados (FATO):**
- `src/lib/services/produtos.ts` cria um repositório genérico via `criarRepositorio<Produto, ProdutoRow>({ tabela, colecao, mappers })` e expõe `listarProdutos/criarProduto/...`.
- `src/lib/repositorio.ts` decide em runtime entre **Supabase** (`supabaseConfigurado`) e **localStorage** (`src/lib/store.ts`) como fallback de demonstração; toda escrita chama `notificarMudanca()` para re-executar consultas das telas (`useLiveQuery`).
- `src/lib/supabase/mappers.ts` converte `Row` (snake_case) ↔ tipo do app (camelCase, `src/lib/types.ts`).
- `src/lib/data/*` são **arrays em memória** (ex.: `data/produtos.ts` exporta `produtos: Produto[]`), usados como seed/fallback — **não** são camada de dados de produção.

**Observações estruturais (FATO):**
- Acesso ao Supabase é **browser-first** (anon key + RLS como defesa); server-side só em `api/ml/*`, `api/otimizar/worker`, `api/usuarios` e `lib/auth/serverAuthorization.ts`.
- **Marketplace** é ML concreto: `marketplaces/mercadolivre.ts` (OAuth, `criarItem`, `preverCategoria`, `criarGuiaTamanhos`, importação, vendas), `mlPayload.ts`, `mlUserProducts.ts` (builder User Products — existe, não ligado ao publish), `canalServidor.ts`.
- **IA**: `agentes/provedorIA.ts` (gateway Gemini/Claude, saída estruturada), `agentes/catalogo.ts` (prompts A0–A12), `agentes/esteira.ts` + `services/esteira.ts` (orquestração).
- **Assíncrono**: só `fila_otimizacao_produto` (migração 012) + `api/otimizar/worker` (cron, service_role, retry, recuperação de preso, 429). **Não há Event Bus** (nem `evento`/`entrega`/outbox).
- **Auditoria/versão**: `lib/auditoria.ts` + migração `002-auditoria-em-massa.sql` guardam resumos; **sem** old→new por campo, sem `versao_schema`, sem histórico reversível do Produto Mestre.

---

## 2. Estrutura ideal segundo a arquitetura (000–007)

**Camadas-alvo (RECOMENDAÇÃO, derivada de 000–007):**

```
src/
  domain/                      # Domain Layer — modelo canônico + invariantes, SEM I/O
    produto-mestre/            # ProdutoMestre (agregado), Variante, Preco, SKU (001)
    origem/                    # OrigemProduto (5 tipos), Catalogo, Compra (000/001)
    marketplace/               # Listing, ContaMarketplace, Pedido (000)
    evento/                    # Evento (envelope canônico), tipos do catálogo (004)
    shared/                    # Value Objects: SkuOrigem, Ean, Dinheiro, IdempotencyKey
  application/                 # Application Layer — casos de uso, SEM detalhe de infra
    produto-mestre/            # CriarProdutoMestre, AtualizarPreco, PromoverPreProduto
    intake/                    # IngerirCatalogo, ConciliarSku, PromoverAProdutoMestre (006)
    publicacao/               # PublicarListing, AtualizarPrecoEstoque (005)
    ports/                     # Interfaces (Ports): Repositorio<T>, EventBus, Clock, IdGen
  infrastructure/              # Infrastructure Layer — adapta o mundo externo aos Ports
    persistence/               # Supabase repos (generaliza repositorio.ts) + mappers
    eventbus/                  # Outbox + tabela evento/entrega + relay (004)
    connectors/                # Connector SDK (003): SupplierConnector, ErpConnector, MarketplaceConnector
      erp/magazord/            # ErpConnector Magazord (Fase 1)
    marketplaces/              # Marketplace Adapters (002): ml/, tiktok/, shopee/
      ml/                      # envelopa mercadolivre.ts/mlPayload/mlUserProducts sob o contrato
    ai/                        # gateway IA (provedorIA/provedorImagem) atrás de um Port
  interface/ (app/)            # Delivery — Next.js telas + rotas finas que só chamam application/
  engine/                      # Marketplace Engine (005) — fila/idempotência/retry/fan-out (generaliza worker)
```

**Regras de dependência-alvo (RECOMENDAÇÃO):**
- `domain` **não importa nada** de `application`/`infrastructure`/`app` (núcleo puro).
- `application` importa só `domain` + `ports` (interfaces).
- `infrastructure` implementa `ports` e conhece Supabase/ML/ERP.
- `app` (telas/rotas) depende só de `application` (casos de uso), **nunca** de Supabase/ML diretamente.
- **Connector SDK** e **Marketplace Adapter** vivem em `infrastructure/connectors|marketplaces`, atrás de interfaces em `application/ports`.
- **Event Bus** e **Engine** são infra transversal, dirigidos por `domain/evento` (envelope canônico de 004).
- **Product Master** é o **agregado central** de `domain/produto-mestre`, com versionamento/histórico.

---

## 3. Diferenças encontradas

| # | Alvo (000–007) | Real (hoje) | Gap |
|---|----------------|-------------|-----|
| D1 | **Domain Layer** puro com invariantes | `types.ts` anêmico; regras espalhadas em `services/*` | Sem domínio isolado; regra de negócio misturada a I/O |
| D2 | **Application Layer** (use-cases) sobre Ports | `services/*` faz regra + orquestração + acesso a dados | Sem separação caso-de-uso × infraestrutura |
| D3 | **Infrastructure** isolada atrás de Ports | `repositorio.ts`/`supabase/*` bons, mas chamados **direto das telas** (browser-first) | Infra vaza para a camada de entrega; lógica no cliente |
| D4 | **Connector SDK** (interfaces) | Não existe; nada de `SupplierConnector`/`ErpConnector` | Sem contrato de integração; ERP inexistente |
| D5 | **Marketplace Adapter** polimórfico | `marketplaces/*` 100% ML concreto | Sem interface `MarketplaceConnector`; TikTok/Shopee impossíveis sem reescrita |
| D6 | **Event Bus** (outbox/eventos/idempotência/DLQ) | Só `fila_otimizacao_produto` + worker | Sem eventos/auditoria/ordenação; acoplamento síncrono |
| D7 | **Product Master** canônico + versão | `produtos`+`produto_variantes`+`anuncios_gerados` informais | Sem agregado/versionamento/histórico reversível |
| D8 | **Preço/Estoque/Custo** com Fonte da Verdade (000) | Estoque/custo em `produtos` (editável na Zion) | Fronteira Zion×ERP não fixada no código |
| D9 | **Rotas finas** que chamam use-cases | Telas chamam `services/*` que chamam Supabase | Sem fronteira application; difícil testar/portar |
| D10 | **Camadas por dependência** | Pastas por feature técnica | Organização não reflete arquitetura de 000–007 |

**Ativos já presentes (reaproveitar, não reescrever):**
- `repositorio.ts` + `mappers.ts` → semente do **Port `Repositorio<T>`** + persistência.
- `fila_otimizacao_produto` + `api/otimizar/worker` → semente do **Event Bus/Engine** (fila, idempotência por status, retry, 429, recuperação).
- `agentes/provedorIA.ts` → semente do **Port de IA** (gateway já abstrai Gemini/Claude).
- `marketplaces/mlUserProducts.ts` → lógica pronta para o **Adapter ML** (só falta o contrato + ligar no publish).
- `auth/serverAuthorization.ts` + RLS (migração 016) → base server-side para mover lógica do browser.

---

## 4. Refatorações necessárias

> Todas **estruturais/aditivas** — nenhuma remove funcionalidade. Cada item é uma RECOMENDAÇÃO.

- **R1 — Extrair Domain Layer.** Criar `src/domain/*` com o agregado **ProdutoMestre** (Variante, Preço, SKU, EAN como Value Objects) e invariantes de 001/000. Sem I/O. `types.ts` continua existindo (telas), passando a ser um DTO da camada de entrega.
- **R2 — Definir Ports (Application).** Criar `src/application/ports` com `Repositorio<T>`, `EventBus`, `MarketplaceConnector`, `ErpConnector`, `SupplierConnector`, `ProvedorIA`, `Clock`, `IdGen`. Isola o núcleo de detalhes.
- **R3 — Casos de uso (Application).** Migrar a **regra** hoje em `services/*` para use-cases em `src/application/*` que dependem só de Ports. `services/*` vira **fachada fina** que chama o use-case (compatibilidade — nenhuma tela quebra).
- **R4 — Isolar Infrastructure.** Mover a implementação Supabase de `repositorio.ts` para `infrastructure/persistence`, implementando o Port `Repositorio<T>`. Manter o fallback localStorage como um **segundo adapter** do mesmo Port.
- **R5 — Connector SDK (003).** Criar `infrastructure/connectors` com as interfaces do SDK; primeiro implementador real é o **ErpConnector Magazord** (Fase 1 do 007).
- **R6 — Marketplace Adapter (002).** Introduzir a interface `MarketplaceConnector` e **envelopar** `mercadolivre.ts`/`mlPayload.ts`/`mlUserProducts.ts` em `infrastructure/marketplaces/ml` sem alterar o comportamento atual. Abre caminho para tiktok/shopee.
- **R7 — Event Bus (004).** Criar `infrastructure/eventbus` (outbox + `evento`/`entrega` + relay). **Generalizar** o padrão de `fila_otimizacao_produto`/worker; começar publicando eventos em paralelo ao fluxo atual (dual-write), sem trocar o caminho síncrono de imediato.
- **R8 — Marketplace Engine (005).** Extrair `src/engine` a partir do worker atual: fila `operacao_marketplace`, `idempotency_key`, fan-out. O worker de otimização continua até o Engine assumir.
- **R9 — Fronteira Zion×ERP (000/D8).** Marcar estoque/custo como **espelho read-only** no domínio; escrita só via `erp.*` (Fase 1). Enquanto o ERP não existe, manter como está, mas **tipar** a fronteira.
- **R10 — Rotas/telas finas (D9).** Fazer `app/*` e `app/api/*` chamarem **use-cases** (application), não Supabase/ML direto. Migração tela a tela.

---

## 5. Ordem recomendada das refatorações

Ordem por **dependência** e **menor risco primeiro** (alinha ao 007):

1. **R2 (Ports)** — barato, não muda runtime; habilita todo o resto.
2. **R1 (Domain: ProdutoMestre)** — núcleo canônico; base de tudo (Fase 0 / PR-001/002).
3. **R4 (Infrastructure: persistência atrás do Port)** — envelopa `repositorio.ts`; telas seguem iguais.
4. **R3 (Application: use-cases + services como fachada)** — move regra sem quebrar chamadas existentes.
5. **R7 (Event Bus, dual-write)** — publica eventos em paralelo; nada depende deles ainda (Fase 0 / PR-003/004).
6. **R6 (Marketplace Adapter ML)** — envelopa ML sob contrato (Fase 2 / PR-006/011).
7. **R8 (Marketplace Engine)** — fila/idempotência assumindo publicação (Fase 2 / PR-010/016).
8. **R5 (Connector SDK + ErpConnector Magazord)** — integra ERP (Fase 1 / PR-005/008/009).
9. **R9 (Fronteira Zion×ERP)** — fixa estoque/custo como espelho (junto com Fase 1).
10. **R10 (Rotas/telas finas)** — contínuo, tela a tela, até o fim.

> **Regra:** R2→R1→R4→R3 formam a **fundação de camadas** (Fase 0). Só depois entram Adapter/Engine/SDK (Fases 1–2). Nenhuma refatoração posterior começa sem a anterior com testes verdes.

---

## 6. Riscos de manter a estrutura atual

| Risco | Evidência (real) | Impacto |
|-------|------------------|---------|
| **Acoplamento ML impede multicanal** | `marketplaces/*` concreto ML | TikTok/Shopee (Fases 5/6) exigiriam reescrita, não extensão |
| **Lógica no browser + sem use-cases** | telas → `services/*` → Supabase | Difícil testar, portar para servidor e garantir a Fonte da Verdade; risco de vazamento entre tenants fora da RLS |
| **Sem Event Bus** | só `fila_otimizacao_produto` | Publicação síncrona 1-a-1 (auditoria ML); sem idempotência de domínio, sem auditoria por evento, sem fan-out |
| **Product Master informal** | `produtos`/`anuncios_gerados` | Sem versionamento/histórico/undo; conteúdo e estado sem agregado canônico |
| **Fronteira Zion×ERP não codificada** | estoque/custo editáveis em `produtos` | Risco de overselling e de a Zion "inventar" estoque/custo, violando 000 |
| **Regra espalhada em ~40 services** | `src/lib/services/*` | Mudança de regra toca I/O e UI juntos; alto custo de manutenção e regressão |
| **Domínio anêmico** | `types.ts` só dados | Invariantes (ex.: "toda Variante pertence a um Produto Mestre") não são garantidas em código |
| **Escala de publicação** | publish síncrono do browser | 500–1.000 anúncios sequenciais no cliente; duplicação sem idempotência |

Manter como está **não quebra o cliente atual (Chinelaria)**, mas **bloqueia** as Fases 1–6 do 007 e mantém os riscos da auditoria ML abertos.

---

## 7. Plano de migração incremental (sem quebrar funcionalidades)

**Estratégia: Strangler Fig** — construir as camadas ao lado do código atual, redirecionar aos poucos, remover o legado só quando o novo estiver verde. **Nada é movido/apagado nesta auditoria.**

**Fase A — Fundação de camadas (não muda runtime):**
1. Criar `application/ports` (R2) e `domain/produto-mestre` (R1) **sem** ligar às telas ainda. Testes unitários puros (`node --test`).
2. Implementar `infrastructure/persistence` como adapter do Port `Repositorio<T>` **envelopando** `repositorio.ts` (R4). `services/*` passam a instanciar o repo pela infra — assinatura pública **inalterada**.
3. **Feature-flag** por entidade: se algo falhar, o repositório antigo continua atrás da flag.

**Fase B — Casos de uso por fachada (compatível):**
4. Para cada entidade, criar o use-case em `application/*` e transformar `services/<entidade>.ts` em **fachada** que chama o use-case (R3). As telas continuam importando `services/*` — **zero mudança de import**.
5. Migrar entidade a entidade, começando por **Produto Mestre**; rodar `tsc --noEmit` + `lint` + `build` a cada passo.

**Fase C — Eventos em paralelo (dual-write):**
6. Introduzir `infrastructure/eventbus` (R7) publicando eventos **junto** ao caminho atual, sem ninguém consumir criticamente. Auditoria e idempotência ganham base sem risco.
7. Ligar um primeiro consumidor não-crítico (auditoria/analytics) para validar entrega/idempotência.

**Fase D — Adapter + Engine (envelopar ML):**
8. Definir `MarketplaceConnector` e envelopar ML (R6) — o publish atual continua disponível atrás de flag; o novo caminho é validado por testes de paridade.
9. Extrair o **Engine** do worker (R8): publicar via fila/idempotência; migrar o publish do browser para assíncrono **por cliente/flag**.

**Fase E — ERP + fronteira de dados:**
10. Implementar `ErpConnector` Magazord (R5) e marcar estoque/custo como espelho read-only (R9) — só quando a Fase 1 do 007 rodar.

**Fase F — Entrega fina + limpeza:**
11. Migrar telas/rotas para chamar use-cases diretamente (R10), tela a tela.
12. Quando uma entidade estiver 100% na nova camada e verde em produção, **aposentar** o caminho legado (remoção é o **último** passo, fora desta auditoria).

**Salvaguardas em toda a migração:**
- Toda mudança atrás de **feature-flag** reversível; caminho legado vivo até o novo passar.
- Gate por passo: `npx tsc --noEmit` + `npm run lint` + `npm run build` verdes; testes `node --test` da peça.
- **Assinaturas públicas de `services/*` preservadas** até a Fase F (as telas não sabem que a implementação mudou).
- Migrações SQL sempre **aditivas com down**; nada renomeia/remove coluna em uso.
- Nenhum segredo migra para o browser; a migração **reduz** exposição (lógica volta ao servidor).

---

## Rastreabilidade (compliance × documentos)

| Pilar | Doc de origem | Refatoração | Fase do 007 | PRs do 007 |
|-------|---------------|-------------|-------------|-----------|
| Product Master | 001 | R1 | Fase 0 | PR-001/002 |
| Domain/Application/Infra | 000 (princípios) | R1/R2/R3/R4 | Fase 0 | PR-001..007 |
| Event Bus | 004 | R7 | Fase 0 | PR-003/004 |
| Connector SDK | 003 | R5 | Fase 1 | PR-005/008/009 |
| Marketplace Adapter | 002 | R6 | Fase 2 | PR-006/011/012 |
| Marketplace Engine | 005 | R8 | Fase 2 | PR-010/016 |
| Fronteira Zion×ERP | 000/001 | R9 | Fase 1 | PR-009/014 |

---

> **Status:** 008 — Architecture Compliance **v1.0**. Diagnóstico estrutural; **nenhum código, arquivo ou commit alterado**. As refatorações aqui recomendadas alimentam a Fase 0 do [007 — Execution Roadmap](007-execution-roadmap.md) e não contrariam a fronteira de Fonte da Verdade de [000 — Business Domain](000-business-domain.md).
