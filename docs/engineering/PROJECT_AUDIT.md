# PROJECT AUDIT — Zion OS

> **Auditoria completa do repositório**, baseada em evidência (contagens, greps e inspeção
> direta), realizada na entrada da Fase de Construção. Nenhuma alteração foi feita.
> Data: 2026-07-22 · objeto: `master` (pós R-PD-1, `7b3257f`+).

---

## 1. Visão geral

**Uma única aplicação Next.js 16** (App Router, TypeScript estrito, Tailwind v4) com backend
embutido (API routes) e Supabase como persistência (com fallback demo em localStorage). **Não é
um monorepo**: `platform/` é um workspace separado e **congelado** (compilador da Zion Platform,
com package.json e node_modules próprios — fora do build do app), e `docs/` + `database/`
acompanham o app.

| Área | Evidência |
|---|---|
| Rotas | **60 páginas** (19 seções da equipe + 13 do portal do cliente `/cliente/*`) + **11 API routes** |
| Camada de dados viva | `src/lib` (94 arquivos): **41 services** + `criarRepositorio` + mappers + store |
| Módulos (bounded contexts materializados) | `src/modules`: adaptive-intelligence (17), integration (8), publication (4), catalog (2), **operation-center (0 — vazio)** |
| Fundação DDD **morta** | `src/domain` (31) + `src/application` (41) + `src/infrastructure` (44) = **116 arquivos com ZERO imports da produção** (verificado hoje) |
| Dependências | Mínimas e saudáveis: `next/react`, `@supabase/supabase-js`, `@anthropic-ai/sdk`, `lucide-react`, `xlsx`, `tailwindcss`, `eslint`, `typescript`. **Sem ORM, sem lib de estado, sem framework de teste** (usa `node:test` via `npx tsx`) |
| Testes | **294 verdes**, distribuídos em 23 diretórios (lib/auth, services, modules/AIL, e ~60% na fundação morta) |
| Banco | **23 migrações sequenciais** (`database/migrations/001–023`), RLS, sem ORM (mappers manuais) |

## 2. Arquitetura encontrada

O repositório contém **três mundos arquiteturais** coexistindo:

**(a) O mundo de produção (vivo, pragmático).** Camadas informais mas consistentes:
`páginas (client components) → services (src/lib/services) → criarRepositorio (dual-mode
Supabase/localStorage) → mappers/Row types`. API routes para o que exige servidor (ML/OAuth,
esteira IA, worker de fila, autorização). Reatividade via `useLiveQuery` caseiro +
`notificarMudanca` (48 páginas). **Não há** event bus, CQRS ou filas formais — exceto uma fila
real em tabela (`fila_otimizacao`) consumida por worker via Vercel Cron: um padrão event-driven
embrionário e funcional.

**(b) O mundo dos módulos (vivo, DDD-lite, crescendo).** Fruto do programa de refatoração
(Releases 001–018) + AIL: módulos com fronteira explícita (`README` com "verdade que possui"),
consumidos pela produção (rotas ML, páginas do cliente, pendências). O
`adaptive-intelligence` é o exemplar mais maduro: `domain/ports/infrastructure`, port
fire-and-forget, núcleo puro determinístico, projeção idempotente — **arquitetura hexagonal
de fato, em miniatura**. Bounded Contexts estão documentados (Cap. 02: Catálogo, Esteira,
Precificação, Conexão, Publicação, Vendas, Identidade) e **parcialmente** materializados.

**(c) O mundo morto (fundação DDD nunca ligada).** `src/domain + application + infrastructure`:
Clean Architecture completa (use-cases, DTOs, ports, value objects, intake engine, conector
Magazord, persistência própria) — internamente coerente, testada contra fakes, e **jamais
importada pela produção**. É o maior bloco de código do repo sem função.

**Shared kernel real:** `src/lib/types.ts` (646 linhas — todos os tipos do app) +
`repositorio.ts`/`store.ts` (agora com os **dois modelos de identidade** via `salvar`, contrato
formalizado em `repository-pattern-identity.md`).

## 3. Estado do domínio

| Domínio | Estado | Onde vive |
|---|---|---|
| **Identity** (auth, perfis, organizações) | ✅ existe; ⚠ migração de segurança 016 **parcialmente aplicada em prod** (função `eh_equipe` permissiva ainda ativa) | `lib/auth`, `components/auth`, migrações 016/017 |
| **Company/Workspace** (clientes, organizações) | ✅ existe (agência multi-cliente) | services `clientes`, migração 017 |
| **Catalog** (produtos, variações, medidas, kits) | ✅ rico e vivo; ⚠ tamanhos de variação **não normalizados** (bloqueia SIZE_GRID em massa) | services + `modules/catalog` (parcial) |
| **Esteira/Work** (agentes A0–A12, fila, aprovação) | ✅ vivo (catálogo de prompts como fonte única + worker server-side) | `lib/agentes`, `api/agentes`, `api/otimizar/worker` |
| **Publication** (ML, User Products, guias) | ✅ vivo e validado em produção; ⚠ dívidas conhecidas de idempotência (ver §9) | `lib/marketplaces`, `modules/publication|integration`, `api/ml/*` |
| **Connection** (OAuth ML por cliente) | ✅ vivo (refresh_token server-side, RLS) | `canalServidor`, `api/ml/conectar` |
| **Sales/Finance** | ◐ básico (vendas via API ML; financeiro simples) | `api/ml/vendas`, pages financeiro |
| **AIL** (Journal → Detector) | ✅ completo até R-PD-1, validado em produção; ⏭ falta Suggestion Engine/Knowledge + superfície de invocação da projeção | `modules/adaptive-intelligence` |
| **Knowledge/Events** | ✗ não existem como domínios próprios (Knowledge é fase futura da AIL; eventos só implícitos) | — |

## 4. Backend

- **APIs (11):** `agentes/{esteira,executar}`, `imagens/gerar`, `ml/{autorizar,conectar,diagnostico-guias,importar-anuncios,publicar,vendas}`, `otimizar/worker`, `usuarios`.
- **Sem camada formal de controllers/DTOs no mundo vivo** — as rotas validam auth
  (`serverAuthorization`: `exigirAcessoAoCliente`/`exigirAutenticado`) e orquestram services.
  Os "use cases" reais são os **41 services** — nomeados por intenção (`resolverPendencia`,
  `aprovarAnuncioGerado`), o que funciona bem.
- **Repositories:** um genérico (`criarRepositorio`) parametrizado por entidade — dual-mode,
  com `criar/salvar/atualizar/listar/buscar/excluir` e contrato documentado. Padrão forte.
- A fundação morta tem controllers/use-cases/DTOs formais — **não usados**.

## 5. Frontend

- **60 páginas** em dois produtos no mesmo app: painel da equipe (19 seções) e portal do
  cliente (13 rotas, separação por `AuthGate`).
- **Componentes** (33): `ui/`, `layout/`, `forms/`, `auth/`, `client-portal/`, `produtos/`,
  `agentes/` — design system **informal** (consistente por convenção Tailwind, sem tokens/
  documentação de DS).
- **Estado global:** mínimo e saudável — 1 contexto (client-portal) + `useLiveQuery`
  (pull+invalidation via `notificarMudanca`). Sem Redux/Zustand — **não precisa**.
- Limitação conhecida do modelo: escritas server-side (worker) não notificam telas abertas
  (exige refresh manual).

## 6. Banco de dados

- **Sem ORM** — `@supabase/supabase-js` + **mappers manuais** (`mappers.ts`, 947 linhas) +
  **Row types manuais** (`database.types.ts`, 461 linhas). Funciona, é explícito e testável,
  mas os dois arquivos são god-files em crescimento linear por entidade.
- **23 migrações** sequenciais, incrementais e não-destrutivas, com comentários operacionais —
  disciplina excelente. Aplicação é **manual** (SQL Editor) — sem tracking automatizado de
  quais migrações cada ambiente recebeu (a causa-raiz do incidente `perfis.ativo`).
- Relacionamentos por FK com `on delete cascade` a partir de `clientes` (limpeza por tenant).
- RLS ativa; modelo atual majoritariamente "equipe autenticada" (agência), com endurecimento
  multi-tenant (016) **incompleto em produção**.

## 7. AIL

Estado da arte do repositório — congelada (Freeze v1) e implementada com fidelidade auditada
(ARCH-REVIEWs 001/002):

- **Existe:** modelo canônico `Decision`; Port fire-and-forget; Journal persistido (`decisoes`);
  Producer canônico (`resolverPendencia` → `(empresa, catalogo, informacaoPendente, ⟨descricao⟩)`);
  Pattern Detector puro (confluente, idempotente, PatternId=SHA-256); projeção materializada
  (`padroes`); 26+ testes; validação em produção (1º Pattern real).
- **Não existe (por design/roadmap):** eventos, filas, workers e observabilidade da AIL
  (métricas da RFC-AIL-001 §9 definidas mas não materializadas); **superfície de invocação da
  projeção** (hoje só via script autenticado); Suggestion Engine (pull) e Knowledge Repository.

## 8. Infraestrutura

| Item | Estado |
|---|---|
| CI | **✗ inexistente** (`.github/workflows` não existe). O único gate é o deploy da Vercel |
| Testes no pipeline | **✗** — 294 testes existem, mas **não há `npm test`** nem execução automática; rodam só manualmente (`npx tsx --test`) |
| Docker | ✗ (não necessário hoje — Vercel + Supabase SaaS) |
| Lint | ✅ ESLint (config Next; regras do React Compiler rebaixadas p/ `warn` por causa do build) |
| Formatador | ✗ sem Prettier — estilo por disciplina |
| Automações | ✅ Vercel Cron → worker da fila de otimização; deploy automático no push do master |
| Ruído no repo | `.obsidian/` e canvases versionados sujam `git status` permanentemente |

## 9. Dívida técnica (somente itens comprovados)

1. **Fundação DDD morta** — 116 arquivos, ~60% da massa de testes, zero uso. Duplica conceitos
   vivos (`produto_mestre` vs `produtos`, persistência própria vs `criarRepositorio`). Custo:
   typecheck/manutenção/confusão de leitura contínuos.
2. **Segurança 016 parcial em produção** — `eh_equipe()` permissivo ainda ativo (usuário sem
   perfil = acesso total). **Risco real de multi-tenancy**, com plano de aplicação já escrito
   (backfill de perfis → aplicar o resto da 016).
3. **Publicação ML (caminho do dinheiro):** loop de N itens **não idempotente** (retry duplica);
   banco grava só o 1º MLB da família; guia recriada a cada publish + `chart_name_unavailable`
   em republicação; `extrairErro` ignora `errors[]` do ML (erros genéricos).
4. **Tamanhos de variação não normalizados** (dados sujos do ML: "38 BR", "33 - 34") — bloqueia
   SIZE_GRID/publicação em massa.
5. **Sem CI/`npm test`** — os 294 testes não protegem nada automaticamente; o incidente
   `perfis.ativo` mostrou o custo de deploy sem gate.
6. **God-files:** `mappers.ts` (947), `types.ts` (646), `mercadolivre.ts` (646) — crescimento
   linear sem fronteira.
7. **`operation-center`** — módulo vazio (0 arquivos ts).
8. **Dual-mode demo (localStorage)** — cada caminho de dados existe em dobro; hoje produção é
   Supabase e o demo serve a testes/dev. Valor decrescente, custo permanente (avaliar no futuro,
   não agora — os testes dependem dele).
9. **Docs:** 12+ diretórios em `docs/`, parte histórica/desatualizada; corpus de descoberta da
   AIL (Cap. 01/02, Épicos, diagnósticos) **ainda não versionado** (PR-DOC-002 pendente);
   migração aplicada ≠ registrada (sem tracking).
10. **Zero marcadores TODO/FIXME/HACK reais** no código — higiene excelente nesse eixo.

## 10. Avaliação crítica

### Pontos fortes
- **Camada de dados exemplar para o tamanho**: `criarRepositorio` + mappers + dual-mode + contrato
  de identidade formalizado. Simples, explícita, testável — **é a espinha dorsal certa**.
- **AIL**: arquitetura congelada, implementação fiel, determinística e validada — o melhor
  código do repo e o template de como módulos devem nascer.
- **Disciplina de migrações e de releases** (planos aprovados, etapas, evidências) — raro e valioso.
- **Domínio de negócio profundo** no código (esteira A0–A12, User Products, medidas por marca).
- Dependências mínimas; sem over-engineering de estado/fetching no front.

### Pontos fracos / riscos
- **Risco nº 1: segurança multi-tenant incompleta em produção** (016 parcial).
- **Risco nº 2: zero CI** — regressão silenciosa a um push de distância.
- **Risco nº 3: idempotência da publicação ML** — retry pode duplicar anúncios reais no
  marketplace (custo財 direto).
- Fundação morta confunde e onera; god-files crescem sem limite; migrações sem tracking.

### O que eu manteria (tudo isto é ativo, não passivo)
Camada services+repositório+mappers · abordagem de módulos com fronteira · AIL inteira ·
catálogo de agentes como fonte única · `serverAuthorization` · disciplina de migrações ·
`useLiveQuery` (suficiente) · dual-mode **por ora** (sustenta os 294 testes).

### O que eu removeria (via arquivamento, nunca delete cego)
- **Fundação DDD morta** — após uma **colheita** deliberada (candidatos a resgate: validadores
  de intake, conector Magazord se a integração Magazord estiver no roadmap, value objects úteis).
  Mover para `archive/` ou branch dedicada; ganhar 116 arquivos de clareza.
- ~~`modules/operation-center` (vazio)~~ — **ERRATA (PR-001):** inspeção mais profunda revelou
  intenção arquitetural documentada e alinhada à visão da plataforma; **mantido como reserva**
  por decisão do programa (ver backlog E1.1.3 e a regra de remoção em `README.md`).
- `.obsidian/` e artefatos pessoais do versionamento (gitignore). *(✅ feito no PR-001)*

### O que eu reescreveria
**Nada em bloco.** Não há justificativa para reescrita — a regra "evoluir por anos" favorece
extração incremental (o programa de refatoração já provou o método: 6 responsabilidades migradas
com `git mv`/SHA-256/testes de mutação).

### Refatoração imediata (ordem de risco×valor)
1. **Aplicar a 016 completa** (com o runbook já existente: check → backfill perfis → aplicar).
2. **CI mínimo**: `npm test` + GitHub Action com `tsc --noEmit` e a suíte — 1 arquivo, protege tudo.
3. **Idempotência da publicação ML** (as 4 dívidas do item §9.3) antes de qualquer publicação em massa.
4. **Normalização de tamanhos das variações** (desbloqueia massa).
5. Colheita+arquivamento da fundação morta (libera leitura e ~40% do tempo de typecheck/testes mortos).

### Oportunidades
- A AIL está a uma release (R-SE-1) de **devolver valor visível** (sugestões) — e resolve de
  quebra a superfície de invocação da projeção.
- O padrão worker+cron existente é a semente natural para processamento assíncrono da AIL.
- O pivot self-service (portal do cliente já com 13 rotas) tem a fundação pronta — falta
  generalizar o cadastro por nicho (bloco já pedido no produto).

---

*Próximo artefato: [ENGINEERING_BACKLOG.md](ENGINEERING_BACKLOG.md) — o trabalho organizado em
EPIC → Feature → Task → Checklist, priorizado por esta auditoria.*
