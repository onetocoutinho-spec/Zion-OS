# 009 — PR-001 Implementation Plan: Domain Layer (Produto Mestre)

> Plano detalhado de implementação do **PR-001 — Domain Layer** do [007 — Execution Roadmap](007-execution-roadmap.md), materializando a refatoração **R1** de [008 — Architecture Compliance](008-architecture-compliance.md) e o modelo canônico de [001 — Product Master](001-product-master.md). Documento de planejamento — **nenhum código implementado, nenhum arquivo existente alterado, nenhum commit**.

> **Escopo estrito do PR-001:** criar o **núcleo de domínio puro** do **Produto Mestre + Variante + Preço** (mais os Value Objects e eventos de domínio que ele exige), **sem I/O**, **sem persistência**, **sem ports**, **sem tela**. `Origem do Produto`, `Catálogo` e `Compra` **não** entram aqui (são PR-021, Fase 3) — o agregado apenas os referencia por **identificador**. O Event Bus não entra (PR-003); o agregado apenas **registra** eventos de domínio em memória para serem coletados por PRs futuros.

---

## Objetivo do PR-001

Extrair o **Domain Layer** hoje inexistente (008/D1): transformar o tipo anêmico `Produto` (`src/lib/types.ts`) em um **agregado rico** `ProdutoMestre` com invariantes de 001 garantidas em código, entidades `Variante`/`Preco`, Value Objects (`SkuOrigem`, `Ean`, `Dinheiro`, `Canal`) e eventos de domínio. O resultado é **puro** (importa nada de `app`/`lib`/Supabase), **testável em isolamento** e **dormente** (ninguém o importa ainda) — logo, **não pode quebrar** nenhuma funcionalidade atual.

---

## 1. Estrutura de pastas que será criada

```
src/domain/                                # NOVA raiz do Domain Layer (não existe hoje)
  shared/
    value-objects/
    (erros, resultado, evento-dominio)
  produto-mestre/
    (agregado, entidades, estados, eventos, versão)
```

Detalhe:

```
src/domain/
  shared/
    resultado.ts                # Result<T> (ok/erro) para invariantes sem exceção de fluxo
    erros-dominio.ts            # ErroDominio + catálogo de erros do núcleo
    evento-dominio.ts           # EventoDominio base (compatível com o envelope do 004, sem transporte)
    value-objects/
      identificador.ts          # Id (uuid branded) + IdOrganizacao/IdCliente/IdProdutoMestre/IdVariante
      sku-origem.ts             # SkuOrigem (chave 1ª de conciliação) — normalização/validação
      ean.ts                    # Ean (GTIN) — validação de dígito, complementar ao SKU
      dinheiro.ts               # Dinheiro (valor + moeda BRL, arredondamento, comparação)
      canal.ts                  # Canal ("zion|mercado_livre|tiktok|shopee")
      index.ts
  produto-mestre/
    produto-mestre.ts           # Agregado raiz ProdutoMestre (invariantes + comportamento)
    variante.ts                 # Entidade Variante (SKU vendável; espelho ERP read-only)
    preco.ts                    # Entidade Preco por canal (piso/margem)
    estados.ts                  # StatusProdutoMestre + máquina de transições (ciclo de vida 001)
    modo-operacao.ts            # ModoOperacao ("revenda|fabricacao_propria") + regra de coerência
    eventos.ts                  # Fábricas dos eventos de domínio (produto_mestre.criado/atualizado, ...)
    versao.ts                   # ProdutoMestreVersao (snapshot + diff + autor) — versionamento
    index.ts                    # Barrel público do agregado
  index.ts                      # Barrel público do Domain Layer
```

**Testes (colocados ao lado, padrão do repo):**

```
src/domain/shared/value-objects/sku-origem.test.ts
src/domain/shared/value-objects/ean.test.ts
src/domain/shared/value-objects/dinheiro.test.ts
src/domain/produto-mestre/produto-mestre.test.ts
src/domain/produto-mestre/estados.test.ts
src/domain/produto-mestre/versao.test.ts
src/domain/produto-mestre/preco.test.ts
```

---

## 2. Arquivos que serão criados

| Arquivo | Responsabilidade | Superfície pública planejada (assinaturas, sem corpo) |
|---------|------------------|-------------------------------------------------------|
| `shared/resultado.ts` | Resultado de invariante sem lançar no fluxo feliz | `type Result<T> = Ok<T> \| Erro`; `ok(v)`, `erro(cod,msg)` |
| `shared/erros-dominio.ts` | Erros tipados do domínio | `class ErroDominio`; enum `CodigoErroDominio` |
| `shared/evento-dominio.ts` | Base de evento de domínio (alinha ao envelope 004, **sem** transporte) | `interface EventoDominio { tipo; versao_schema; chave_particao; occurred_at; payload }` |
| `shared/value-objects/identificador.ts` | Ids branded | `type IdProdutoMestre`, `IdVariante`, `IdOrganizacao`, `IdCliente`; `novoId()` (injetável) |
| `shared/value-objects/sku-origem.ts` | Chave 1ª de conciliação | `SkuOrigem.criar(raw): Result<SkuOrigem>`; `.valor`; `.igualA()` |
| `shared/value-objects/ean.ts` | GTIN complementar | `Ean.criar(raw): Result<Ean>`; `.valido`; `.valor` |
| `shared/value-objects/dinheiro.ts` | Valor monetário | `Dinheiro.reais(n)`; `.maiorQue()`, `.menorQue()`, `.valor` |
| `shared/value-objects/canal.ts` | Canal de venda | `type Canal`; `CANAIS`; `ehCanal(x)` |
| `produto-mestre/modo-operacao.ts` | Modo revenda × fabricação | `type ModoOperacao`; `exigeCatalogo()`, `exigeOrigemInterna()` |
| `produto-mestre/estados.ts` | Ciclo de vida (001) | `type StatusProdutoMestre`; `podeTransicionar(de,para): boolean` |
| `produto-mestre/eventos.ts` | Fábricas de eventos de domínio | `produtoMestreCriado()`, `produtoMestreAtualizado()`, `varianteAtualizada()`, `precoDefinido()`, `estoqueEspelhado()` |
| `produto-mestre/preco.ts` | Preço por canal | `Preco.definir({canal,preco,precoMinimo}): Result<Preco>`; `.publicavel` |
| `produto-mestre/variante.ts` | SKU vendável + espelho ERP | `Variante.criar(...)`; `.definirPrecoVenda()`; `.aplicarEspelhoErp({estoque,custo})` |
| `produto-mestre/versao.ts` | Versionamento/histórico | `ProdutoMestreVersao.registrar(snapshot,diff,autor)`; `calcularDiff(antes,depois)` |
| `produto-mestre/produto-mestre.ts` | **Agregado raiz** com invariantes/comportamento | ver §"Superfície do agregado" |
| `produto-mestre/index.ts` / `shared/.../index.ts` / `domain/index.ts` | Barrels públicos | reexports |
| `*.test.ts` (7) | Testes unitários puros (`node --test`) | — |

**Superfície do agregado (planejada, sem implementação):**

```
class ProdutoMestre {
  static criarRascunho(dados): Result<ProdutoMestre>      // valida modo_operacao × origem/catálogo (001 §5)
  adicionarVariante(v): Result<void>                       // invariante: variante pertence a este Mestre
  definirPrecoVendaVariante(idVar, Dinheiro): Result<void> // Zion é dono do preço (001 §6) → versiona
  aplicarEspelhoErp(idVar, {estoque, custo}): Result<void> // read-model; único caminho p/ estoque/custo (001 §7)
  editarConteudo(patch, autor): Result<void>               // versiona (001 §8) → registra evento
  enriquecer(autorAgente): Result<void>                    // rascunho → enriquecido
  enviarParaAprovacao(): Result<void>                      // guarda pendências (A10)
  aprovar(autor): Result<void>                             // pendente_aprovacao → aprovado
  marcarPublicado(listingRef): Result<void>                // aprovado → publicado
  pausar()/reativar()/arquivar(): Result<void>             // transições do ciclo de vida
  get versaoAtual(): number
  puxarEventos(): EventoDominio[]                           // coleta e limpa eventos registrados (p/ outbox futuro)
  get status(): StatusProdutoMestre
}
```

> As assinaturas acima são **contrato de design** do PR, não código implementado. Nenhum corpo é entregue neste documento.

---

## 3. Arquivos existentes que serão reutilizados

> Reutilizados como **referência/infra de teste** — **nenhum é importado pelo domínio** (o domínio não depende de nada).

| Existente | Como é reutilizado no PR-001 |
|-----------|------------------------------|
| `src/lib/types.ts` | **Referência de mapeamento** (o DTO `Produto`/`ProdutoVariante` que o agregado espelha). Serve de guia para nomes de campo; **não** é importado nem alterado. O mapa DTO↔Domínio será feito em PR futuro (Application/mappers). |
| `docs/architecture/001-product-master.md` | Fonte canônica dos campos, estados, invariantes e eventos que o domínio codifica. |
| `tsconfig.json` (config atual) | O padrão que **exclui `**/*.test.ts`** do build e permite `node --test` sobre TS nativo. O PR **usa** esse padrão; não o edita (ver Riscos R6 se precisar de ajuste). |
| Runner `node --test` + convenção `*.test.ts` | Já usado em `src/lib/auth/*.test.ts` e `src/lib/services/usuarios.test.ts`. O PR segue a mesma convenção. |
| Convenção de nomenclatura PT do repo (`services/*`) | O domínio segue o mesmo idioma (ProdutoMestre, Variante, Preco, definir…, aplicar…) para ler como o código ao redor. |

---

## 4. Arquivos que NÃO devem ser alterados

**Regra do PR-001: additive-only. Nada fora de `src/domain/` é tocado.**

- `src/lib/types.ts` — permanece o DTO das telas (intocado).
- `src/lib/services/**` (todos os ~40) — intocados; continuam a fonte de dados das telas.
- `src/lib/repositorio.ts`, `src/lib/store.ts`, `src/lib/supabase/**` — infra atual intocada.
- `src/lib/marketplaces/**`, `src/lib/agentes/**`, `src/lib/auth/**`, `src/lib/data/**` — intocados.
- `src/app/**` (telas e `api/**`) e `src/components/**` — intocados.
- `database/migrations/**` — **nenhuma migração** no PR-001 (domínio é puro; sem schema).
- `docs/architecture/000–008` — intocados.
- `package.json`, `next.config.ts`, `eslint.config.mjs`, `vercel.json` — intocados (ver R6 sobre `tsconfig`).

---

## 5. Estratégia Strangler Fig (coexistência com o atual)

O PR-001 é a **primeira fibra** do Strangler Fig de 008 §7 (Fase A). Como o domínio nasce **isolado e sem consumidores**, a coexistência é trivial e **risco-zero de regressão**:

1. **Nova árvore paralela.** `src/domain/` nasce ao lado de `src/lib/`. O código atual (`types.ts` + `services/*` + `repositorio.ts`) **continua sendo o caminho de produção**, inalterado.
2. **Domínio dormente.** Em PR-001, **nenhum arquivo de `app`/`lib` importa `src/domain/`**. Ele existe, compila e é testado — mas não participa de nenhum fluxo em runtime. Logo, **não há como quebrar** telas, publicação ML, esteira ou fila.
3. **DTO ≠ Domínio (ponte adiada).** `Produto` (`types.ts`) segue como **DTO da camada de entrega**. A tradução DTO↔`ProdutoMestre` será um **mapper** introduzido em PR posterior (Application/Infra), atrás de flag. O domínio já provê `ProdutoMestre.criarRascunho(...)` pronto para esse mapper.
4. **Eventos sem transporte.** O agregado **registra** eventos de domínio internamente (`puxarEventos()`), mas **não** os despacha. Quando o Event Bus (PR-003) existir, a Application liga a coleta ao outbox — sem tocar o domínio.
5. **Convivência de convenção.** O domínio reusa `node --test`/`*.test.ts`, então roda no mesmo fluxo de verificação sem infraestrutura nova.
6. **Estrangulamento futuro.** Só em PRs seguintes (use-cases → mapper → flag por entidade) o `services/produtos.ts` passa a **delegar** ao domínio. A remoção do caminho legado é o **último** passo, fora deste PR.

**Resultado:** PR-001 entrega valor arquitetural (o núcleo canônico) com **zero acoplamento** ao legado e **zero mudança de comportamento**.

---

## 6. Ordem exata de implementação

> Cada passo compila e é testado antes do seguinte (`npx tsc --noEmit` + `node --test`). Dependências apontam sempre "para dentro" (VOs → entidades → agregado).

1. **`shared/resultado.ts`** — `Result<T>` (base de todas as validações).
2. **`shared/erros-dominio.ts`** — `ErroDominio` + `CodigoErroDominio`.
3. **`shared/value-objects/identificador.ts`** — Ids branded + `novoId()` injetável (sem `Math.random`/`Date` no domínio; geração vem de fora).
4. **`shared/value-objects/dinheiro.ts`** + teste — base monetária (usada por Preço/Variante).
5. **`shared/value-objects/sku-origem.ts`** + teste — normalização/validação da chave 1ª.
6. **`shared/value-objects/ean.ts`** + teste — validação de GTIN (complementar).
7. **`shared/value-objects/canal.ts`** e `shared/value-objects/index.ts` — canais + barrel.
8. **`shared/evento-dominio.ts`** — base de evento (formato alinhado ao envelope 004, sem bus).
9. **`produto-mestre/modo-operacao.ts`** — `ModoOperacao` + regras de coerência (revenda×fabricação).
10. **`produto-mestre/estados.ts`** + teste — `StatusProdutoMestre` + `podeTransicionar()` (máquina do ciclo de vida de 001).
11. **`produto-mestre/preco.ts`** + teste — `Preco` por canal + regra de piso (`publicavel`).
12. **`produto-mestre/variante.ts`** — `Variante` + `definirPrecoVenda()` + `aplicarEspelhoErp()` (read-only ERP).
13. **`produto-mestre/versao.ts`** + teste — `ProdutoMestreVersao` + `calcularDiff()`.
14. **`produto-mestre/eventos.ts`** — fábricas de eventos de domínio.
15. **`produto-mestre/produto-mestre.ts`** + teste — **agregado raiz**, amarrando invariantes, transições, versionamento e registro de eventos.
16. **Barrels** (`produto-mestre/index.ts`, `domain/index.ts`) — superfície pública.
17. **Suite completa** — `node --test` em todos os `src/domain/**/*.test.ts` + `npx tsc --noEmit` + `npm run lint` + `npm run build` verdes.

---

## 7. Plano de testes

**Nível:** 100% **unitário e puro** (`node --test`, sem I/O, sem Supabase, sem rede). Sem integração/E2E neste PR (não há infra).

| Alvo | Casos de teste (mínimos) |
|------|--------------------------|
| `SkuOrigem` | normaliza (trim/upper); rejeita vazio; igualdade; preserva original quando necessário |
| `Ean` | aceita GTIN válido (dígito verificador); rejeita inválido; marca ausência sem quebrar (complementar) |
| `Dinheiro` | soma/comparação; arredondamento BRL; rejeita negativo onde proibido |
| `estados` | toda transição válida do ciclo de vida (001) permitida; transições inválidas negadas (ex.: `rascunho`→`publicado` direto) |
| `Preco` | `publicavel=false` quando preço < piso (001 §9); `true` quando ≥ piso |
| `Variante` | pertence ao Mestre; `aplicarEspelhoErp` altera só espelho; **tentar** setar estoque/custo por outro caminho é rejeitado; `definirPrecoVenda` só via Zion |
| `versao` | `calcularDiff` produz {campo, antes, depois}; toda edição incrementa `versao_atual`; versão anterior reconstruível do snapshot |
| `ProdutoMestre` (agregado) | `criarRascunho` valida modo×origem/catálogo (revenda pode ter catálogo; fabricação própria exige origem interna e `catalogo_id=null`); `adicionarVariante` mantém invariante de pertencimento; editar conteúdo versiona **e** registra `produto_mestre.atualizado`; `puxarEventos()` retorna e limpa; aprovação respeita a máquina de estados |

**Gate do PR:** `npx tsc --noEmit` (0 erros) · `node --test` (todos verdes) · `npm run lint` (0 erros) · `npm run build` (sucesso — provando que a árvore nova não quebra o build, mesmo dormente).

---

## 8. Critérios de aceite

- [ ] `src/domain/` criado com a estrutura da §1; **nada** fora de `src/domain/` alterado.
- [ ] O agregado `ProdutoMestre` codifica as invariantes de 001: variante pertence ao Mestre; `sku_origem` obrigatório; `ean` complementar; `modo_operacao` coerente com origem/catálogo; estoque/custo somente via `aplicarEspelhoErp`; preço de venda somente via Zion; edição material versiona; transição de estado válida pela máquina.
- [ ] Value Objects `SkuOrigem`, `Ean`, `Dinheiro`, `Canal` validam entrada e são imutáveis.
- [ ] Ciclo de vida implementado como máquina de transições espelhando o diagrama de 001.
- [ ] Versionamento: toda mudança material gera `ProdutoMestreVersao` com diff e autor; `versao_atual` incrementa; versão anterior reconstruível.
- [ ] Eventos de domínio são **registrados** (não despachados) e coletáveis por `puxarEventos()`, com formato compatível com o envelope de 004 (`tipo`, `versao_schema`, `chave_particao`, `payload`, `occurred_at`).
- [ ] O domínio **não importa** `app/`, `lib/`, Supabase, React ou qualquer I/O; não usa `Date.now()`/`Math.random()` diretamente (injetados de fora).
- [ ] `tsc --noEmit`, `node --test`, `lint` e `build` verdes.
- [ ] **Nenhum** import de `src/domain/` a partir de `src/app` ou `src/lib` (domínio dormente).

---

## 9. Riscos

| # | Risco | Mitigação |
|---|-------|-----------|
| R1 | **Scope creep** para Origem/Catálogo/Compra ou para ports/infra | Escopo trava em ProdutoMestre+Variante+Preço+VOs; Origem/Catálogo são PR-021; ports são PR seguinte. |
| R2 | **Domínio anêmico** (só re-declarar `types.ts`) | Critério de aceite exige invariantes/comportamento; testes cobrem regras, não só getters. |
| R3 | **Divergência DTO↔Domínio** (`types.ts` camelCase vs domínio) | A ponte é um mapper de PR futuro; PR-001 documenta o de-para em comentário, sem acoplar. |
| R4 | **Over-engineering** de Value Objects | Manter VOs mínimos e justificados por invariante real (SKU, EAN, Dinheiro, Canal). |
| R5 | **Impureza** (usar `Date`/`Math.random`/UUID nativo no núcleo) | `novoId()`/relógio injetados; testes determinísticos; regra checada no aceite. |
| R6 | **Runner TS**: `node --test` sobre `.ts` e resolução de import | Seguir o padrão já validado (`src/lib/auth/*.test.ts`); se exigir ajuste de `tsconfig`, fazê-lo **aditivo** e documentado — nunca alterando build de produção. |
| R7 | **Acoplamento acidental** do legado ao domínio novo | Verificação no aceite: `grep` por imports de `@/domain` em `app`/`lib` deve retornar vazio. |
| R8 | **Ruído no build** por árvore nova | `build` no gate prova que a árvore dormente compila sem afetar produção. |

---

## 10. Impacto na arquitetura

- **Cria o Domain Layer** que 008 apontou como ausente (D1) — a primeira das camadas-alvo, fundação de todas as fases de 007.
- **Fixa a regra de dependência** "domínio importa nada": o núcleo passa a ser o ponto estável para o qual Application/Infra apontarão (inversão de dependência).
- **Materializa 001 em código executável e testado**, sem esperar por banco/eventos — as invariantes de negócio deixam de ser só documento.
- **Prepara o outbox (004)**: o padrão `puxarEventos()` dá o gancho para o Event Bus (PR-003) sem retrabalho no domínio.
- **Habilita os próximos PRs**: Application/ports (use-cases sobre o domínio), mapper DTO↔Domínio, e depois Adapter/Engine — todos consumindo este núcleo.
- **Risco operacional nulo neste PR**: dormente e aditivo; o cliente atual (Chinelaria) segue no caminho legado intocado.
- **Dívida deliberada e explícita**: a ponte DTO↔Domínio e a substituição de `services/*` ficam para PRs seguintes (Strangler Fig) — este PR **não** as antecipa.

---

> **Status:** 009 — PR-001 Implementation Plan **v1.0**. Plano aprovado para execução da **Fase 0 / PR-001** de 007. Nenhum código foi escrito; a implementação começa somente após validação deste plano e cria **exclusivamente** arquivos sob `src/domain/`.
