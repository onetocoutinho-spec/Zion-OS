# Domain Services (`src/domain/services/`)

> **Reservado — vazio por design (YAGNI).** Esta pasta é o lugar oficial dos **Domain Services** da Zion Platform. No PR-001 ela contém **apenas este README**: nenhuma classe, nenhum stub, nenhum código sem uso. Um Domain Service só nasce aqui quando uma regra real precisar dele.

## O que é um Domain Service

Um **Domain Service** é uma peça de **lógica de domínio pura** que **não pertence naturalmente a uma única entidade ou agregado**. Quando uma regra de negócio:

- envolve **mais de um agregado** (ex.: comparar um candidato com um `ProdutoMestre` existente), ou
- é uma **operação de domínio sem estado próprio** que ficaria artificial dentro de uma entidade,

ela vira um Domain Service — uma função/classe **stateless**, nomeada pela linguagem do negócio (000), operando **só sobre objetos de domínio**.

Se a regra cabe **dentro** de um agregado (invariante do próprio `ProdutoMestre`, `Variante`, `Listing`), ela **NÃO** é um Domain Service — vive no agregado. Domain Services são a exceção, não a regra.

## Responsabilidades

- Conter **regra de negócio pura** que cruza agregados ou não tem um dono natural.
- Receber e devolver **objetos de domínio** (`ProdutoMestre`, `Variante`, `SkuOrigem`, `Ean`, `Preco`, `Dinheiro`, `Listing`…) e `Result<T>`.
- Ser **determinístico e testável em isolamento** (100% unitário, sem mocks de infra).

## Fronteiras — o que um Domain Service NÃO faz

- **Sem I/O.** Nada de Supabase, HTTP, arquivo, rede, `fetch`, ORM.
- **Sem relógio nem geração de id.** Timestamps (`agora: string`) e ids chegam **injetados** (mesma regra do restante do domínio).
- **Sem orquestração de caso de uso.** Buscar no repositório, publicar evento no bus, coordenar transação → isso é **Application Service** (camada superior, PR futuro), não Domain Service.
- **Sem dependência de framework** (Next.js/React) nem de `src/lib`/`src/app`.
- **Sem persistência.** Repositórios são **interfaces** e vivem no agregado correspondente (`produto-mestre/repositorio-produto-mestre.ts`, `listing/repositorio-listing.ts`); um Domain Service pode **receber** dados já carregados, mas não os busca.

## Domain Service × Application Service (não confundir)

| | Domain Service (`src/domain/services/`) | Application Service / Use-Case (PR futuro) |
|---|---|---|
| Natureza | Regra de negócio pura | Orquestração |
| Conhece Ports (Repositório/EventBus)? | **Não** | **Sim** |
| Faz I/O? | Nunca | Sim (via Ports) |
| Exemplo | "este SKU casa com aquele produto?" | "importar catálogo → conciliar → salvar → emitir evento" |

## Exemplos de FUTUROS serviços (ilustrativos — ainda não implementados)

> Nenhum destes existe hoje. Servem para mostrar o tipo de lógica que **justificaria** um arquivo aqui quando a necessidade real aparecer.

- **`ConciliadorDeIdentidade`** — dado um candidato (`SkuOrigem` + `Ean` opcional) e um conjunto de `ProdutoMestre` já carregados, decide o veredito de conciliação (`casado_sku` → `casado_ean` → `ambiguo` → `sem_chave`), aplicando 001 §1 (SKU manda; EAN só desempata). Cruza vários agregados → não é invariante de um só.
- **`CalculadoraDeMargem`** — a partir de `custo_erp` (espelho) + `preco` (`Dinheiro`) + política de piso, calcula `margem_liquida` e o `status_margem`, alimentando a decisão `Preco.publicavel` (001 §9). Regra de cálculo sem estado próprio.
- **`ReconciliadorDeEstadoDeListing`** — dadas as regras puras de consolidação, mapeia o estado reportado por um canal para a transição legal do `Listing`/`ProdutoMestre` (sem chamar o canal — quem chama é o Engine).
- **`NormalizadorDeGrade`** — normaliza tamanhos/variações "sujos" ("38 BR", "33-34") em grade limpa antes da conciliação; regra de domínio reutilizável por vários fluxos.

Quando um destes for realmente necessário, criar **um arquivo por serviço** (`conciliador-de-identidade.ts` + `conciliador-de-identidade.test.ts`), exportá-lo no barrel do domínio e cobri-lo com testes unitários puros — seguindo exatamente as fronteiras acima.

## Estado atual

Vazia intencionalmente. Manter assim até existir uma regra concreta que **não caiba** num agregado — preparando a arquitetura (o lugar existe e está documentado) **sem** introduzir código sem uso (YAGNI).
