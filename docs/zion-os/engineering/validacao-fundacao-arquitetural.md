# Validação da Fundação Arquitetural — Auditoria Técnica

> **Natureza.** Auditoria de maturidade técnica. Determina **o que está pronto, parcial,
> incompleto ou superado** na Fundação. Não discute se deve ser adotada, não altera código,
> não decide migração.
>
> **Base de evidência:** `HEAD d2b0fe5`. Leitura direta dos arquivos e execução dos testes.
> Onde a evidência não bastou: **EVIDÊNCIA INSUFICIENTE**.

---

## 1. Objetivo

Determinar, por evidência técnica, quais partes da Fundação Arquitetural
(`src/domain` + `src/application` + `src/infrastructure`) são **ativos reutilizáveis** e
quais são **hipóteses não validadas**, estabelecendo base para uma futura decisão de
integração incremental sem interromper a produção.

## 2. Escopo

As três árvores da Fundação: **domain** (31 arquivos), **application** (41),
**infrastructure** (44) — **95 arquivos não-teste + 21 de teste**, ~5.929 linhas. Confirmado
no Diagnóstico Arquitetural: **não é importada por nenhum arquivo alcançável a partir de
`src/app`**.

---

## 3. Inventário

### 3.1 domain

| Categoria | Componentes |
|---|---|
| **Agregados** | `ProdutoMestre` (453 linhas), `Listing` (145) |
| **Entidades / partes** | `Variante`, `Versao`, `ListingVariante` |
| **Value Objects** | `Dinheiro`, `EAN`, `SkuOrigem`, `Canal`, `Identificador` |
| **Eventos de domínio** | `eventos.ts` (5 construtores), base `EventoDominio` |
| **Máquinas de estado** | `estados.ts` (produto-mestre), `estados-listing.ts` |
| **Ports de domínio** | `repositorio-produto-mestre.ts`, `repositorio-listing.ts` *(contratos, sem I/O — declarado)* |
| **Shared** | `resultado.ts`, `erros-dominio.ts`, `modo-operacao.ts`, `preco.ts` |

### 3.2 application

| Categoria | Componentes |
|---|---|
| **Casos de uso** | `CriarProdutoMestre`, `AtualizarProdutoMestre`, `AtualizarPreco`, `AdicionarVariante`, `RegistrarEventosDeDominio` |
| **Commands** | 4 — um por caso de uso de escrita |
| **DTOs** | `ProdutoMestreDTO`, `AutorDTO` |
| **Ports (contratos)** | `Clock`, `IdGenerator`, `Logger`, `EventPublisher`, `ProdutoMestreRepository`, `ListingRepository` |
| **Mappers** | `produto-mestre-mapper`, `autor-mapper` (DTO↔Domínio) |
| **Serviços** | `publicacao-de-eventos.ts` |
| **Intake** | Motor de ingestão: `intake-engine`, `conciliador-produto`, `produto-validator`, `intake-report`, `intake-service` |

### 3.3 infrastructure

| Categoria | Componentes |
|---|---|
| **SDK de conectores** | `conector.ts` + interfaces (`conector-erp`, `conector-marketplace`, `conector-origem`), `conformidade.ts` (contract tests) |
| **Conector ERP** | Magazord — `magazord-connector` (198 linhas), `magazord-api-fetch` (HTTP real), `mapeadores`, `tipos-magazord` |
| **Shared de conectores** | `auth/estrategia-auth`, `canonical/` (produto canônico, identidade, ingestão), `capacidades`, `erros`, `limites`, `operacao`, `sincronizacao` |
| **Persistência** | Supabase — `produto-mestre-repository-supabase`, `listing-repository-supabase`, `mappers/`, `query-builder`, `supabase-context` |

---

## 4. Domínio

**Comportamento real, não estrutura.** `ProdutoMestre` tem **14 métodos públicos, 43
`return`, 453 linhas**, com invariantes implementadas (`criarRascunho` valida antes de
construir), eventos registrados internamente (`puxarEventos`), e máquina de estados própria.

| Agregado | Modelo válido? | Regras implementadas? | Alinhado à produção? |
|---|---|---|---|
| **ProdutoMestre** | Sim — coerente e completo | **Sim** — validação, transições de estado, eventos | **Conceito inexistente em produção** — ver §9 |
| **Listing** | Sim — estrutura coerente (145 linhas) | Parcial — modelo presente; **repositório é stub** (§6) | Conceito inexistente em produção |

**Value Objects** — comportamento real, com testes: `Dinheiro` (5 testes), `EAN` (4),
`SkuOrigem` (3). Encapsulam validação e igualdade.

---

## 5. Application

**Os casos de uso executam orquestração real.** Exemplo verificado —
`CriarProdutoMestreUseCase`: injeta 5 dependências por Port, executa o fluxo
`idGen → clock → mapper → agregado.criarRascunho → repo.salvar → publicarEventos → DTO`, com
tratamento de falha em cada etapa. **Não é stub.**

| Caso de uso | Comportamento real? | Desacoplado? | Consumidores | Utilizável hoje? |
|---|---|---|---|---|
| `CriarProdutoMestre` | **Sim** | Sim — só depende de Ports | Testes | **Não sem adaptadores** — ver §6 |
| `AtualizarProdutoMestre` | Sim | Sim | Testes | Idem |
| `AtualizarPreco` | Sim | Sim | Testes | Idem |
| `AdicionarVariante` | Sim | Sim | Testes | Idem |
| `RegistrarEventosDeDominio` | Sim | Sim | Testes | Idem |

**Todos dependem de Ports** (`Clock`, `IdGenerator`, `EventPublisher`, repositórios) que
**exigem implementações concretas de infraestrutura** — algumas existem, outras não (§6).

**Motor de Intake** — `intake-engine` (172 linhas), conciliação, validação e relatório.
Comportamento real, 14 testes. **Consumidores em produção: nenhum.**

---

## 6. Infrastructure

### 6.1 Persistência Supabase — split interno decisivo

| Repositório | Estado | Evidência |
|---|---|---|
| **ProdutoMestre** | **Implementado** | Usa tabelas `produto_mestre` (migração 020) e `produto_mestre_versao` (021); upsert real + mapper; sem regra de negócio |
| **Listing** | **Stub deliberado** | `throw new Error(PENDENTE)` em **todos os métodos** — comentário: *"cada método falha com uma mensagem clara até a 022 existir"* |

**Migrações verificadas:** `020-produto-mestre.sql` e `021-produto-mestre-versao.sql`
**existem**; `022` (listing) **não existe**. O stub é honesto: falha esperando uma migração
que não foi criada.

### 6.2 Conector Magazord (ERP)

**Implementado com I/O real.** `magazord-connector.ts` (198 linhas) tem métodos com corpo
(`conectar`, `testarConexao`, `renovarCredencial`); `magazord-api-fetch.ts` usa `fetch`.
Comentário: *"a implementação real fica em PRs futuros"* refere-se ao SDK-base
(`conector.ts`), não ao Magazord — que **está concreto**.

### 6.3 Mercado Livre e IA

| Componente | Na Fundação? | Evidência |
|---|---|---|
| **Conector Mercado Livre** | **Não existe** | Há a interface `conector-marketplace.ts`, mas **nenhuma implementação de ML** na Fundação. A integração ML de produção vive em `src/lib/marketplaces/`, fora da Fundação |
| **IA** | **Não existe na Fundação** | O acesso à IA de produção está em `src/lib/agentes/provedorIA.ts`, fora da Fundação |

### 6.4 Utilização hoje

| Componente | Pode ser usado hoje? | Depende de adaptação? |
|---|---|---|
| Repositório ProdutoMestre | Tabelas existem; **exige fiação a um cliente Supabase real** | Sim — hoje testado só com fake |
| Repositório Listing | **Não** — lança em todo método | Exige migração 022 + implementação |
| Conector Magazord | Código pronto; **nunca foi conectado a produção** | Exige credenciais e fiação |
| SDK de conectores | Contratos + contract tests prontos | É base; não faz I/O por si |

---

## 7. Casos de Uso — síntese

**Todos os 5 executam comportamento real e estão desacoplados por Ports.** Nenhum tem
consumidor em produção. Utilizáveis pela aplicação atual **somente** mediante:
implementações concretas dos Ports `Clock`/`IdGenerator`/`EventPublisher` (não localizadas
como classes concretas de produção — **EVIDÊNCIA INSUFICIENTE** sobre sua existência fora
dos fakes de teste) e um cliente Supabase real fiado ao repositório.

---

## 8. Testabilidade

**113 testes na Fundação, 113 aprovados** — parte dos 243 da suíte.

| Área | Arquivos de teste | Testes | Exercita |
|---|---|---|---|
| domain | 7 | 39 | Agregados, VOs, estados, preço — **lógica pura** |
| application | 4 | 31 | Use cases, mappers, intake, conformidade estrutural |
| infrastructure | 10 | 43 | Conectores, repositórios, mapeadores — **contra fakes** |

**Natureza da cobertura — verificada:**

- `integration.test.ts` declara na linha 1: *"Teste PONTA A PONTA (integração), com
  **Supabase fake em memória**"* e usa **Magazord fake**.
- **Nenhum teste da Fundação toca Supabase, Magazord ou ML reais.**

**Consequência auditável:** os 113 testes provam que a **lógica interna** da Fundação é
coerente e funciona contra dublês. **Não provam** que ela se conecta a qualquer sistema
real. É cobertura de **comportamento de código**, não de **integração de produção**.

**Componentes nunca testados:** DTOs, commands e alguns Ports são só tipos — protegidos por
compilação, não por asserção. Não é lacuna: tipos não têm comportamento de runtime.

---

## 9. Compatibilidade com a produção

**A verificação decisiva:** produção usa `produto_mestre` em **0 arquivos** (`src/lib`,
`src/app`).

| Conceito da Fundação | Existe em produção? | Relação |
|---|---|---|
| `ProdutoMestre` (agregado) | **Não** | Produção usa tabelas `produtos` legadas; o conceito canônico não foi adotado |
| `Listing` | **Não** | Produção publica via `mercadolivre.ts` + `modules/`, sem agregado Listing |
| Conector Magazord | **Não conectado** | Produção **não importa** ERP Magazord da Fundação |
| Value Objects (`Dinheiro`, `EAN`) | **Não** | Produção usa tipos primitivos e `lib/types.ts` |
| Motor de Intake | **Não** | Produção importa produtos por `lib/services/importacaoProdutos.ts` |

**Conclusão de compatibilidade:** a Fundação **representa conceitos que não existem em
produção** — não duplica comportamento atual, **propõe um modelo alternativo** (canônico,
por agregados) que a produção nunca adotou. Não está *desatualizada* nem *superada pela
evolução* — está **não integrada desde a origem**.

> **EVIDÊNCIA INSUFICIENTE** para afirmar que qualquer componente da Fundação **substituiria**
> comportamento de produção: substituição exigiria equivalência funcional verificada, que
> esta auditoria não mediu — os dois lados modelam o problema de formas diferentes.

---

## 10. Classificação

Por componente, com evidência.

| Componente | Classificação | Evidência |
|---|---|---|
| **domain — ProdutoMestre + VOs + estados** | **PRONTO** *(como biblioteca de domínio)* | Lógica completa, 39 testes verdes, sem dependência externa |
| **domain — Listing** | **ADAPTÁVEL** | Modelo completo; depende do repositório stub |
| **application — 5 casos de uso** | **ADAPTÁVEL** | Orquestração real; exige Ports concretos |
| **application — Intake** | **ADAPTÁVEL** | Comportamento real; sem consumidor |
| **infrastructure — repo ProdutoMestre** | **ADAPTÁVEL** | Tabelas existem (020/021); testado só com fake; exige fiação |
| **infrastructure — repo Listing** | **INCOMPLETO** | Lança `PENDENTE`; migração 022 inexistente |
| **infrastructure — Magazord** | **EXPERIMENTAL** | Código concreto, **nunca conectado a produção** |
| **infrastructure — SDK de conectores** | **PRONTO** *(como contrato)* | Interfaces + contract tests; é base, não I/O |
| **infrastructure — conector ML** | **INCOMPLETO** | Só interface; sem implementação |
| **Fundação como sistema integrável** | **EXPERIMENTAL** | Nunca executada pela aplicação; 0 imports de produção |

**Nenhum componente é OBSOLETO.** Nenhum foi *superado* — a evidência mostra que a Fundação
nunca competiu com a produção; elas coexistem sem se tocar. Classificar algo como obsoleto
exigiria que tivesse sido usado e depois abandonado: **não é o caso**.

---

## 11. Mapa de integração

Para os classificados **PRONTO** ou **ADAPTÁVEL**. **Não propõe implementação** — registra
potencial e risco.

| Componente | Quem poderia consumir | Comportamento que substituiria | Benefício esperado | Risco |
|---|---|---|---|---|
| **VOs de domínio** (`Dinheiro`, `EAN`, `SkuOrigem`) | Qualquer serviço de `lib/` que hoje usa primitivos | Validação dispersa de valores | Validação centralizada e testada | Baixo — são puros e isolados |
| **Agregado ProdutoMestre** | Um futuro fluxo de produto canônico | O modelo `produtos` legado | Modelo com invariantes e eventos | **Alto** — exige migrar dados e reescrever o acesso; conceito ausente em produção |
| **Casos de uso ProdutoMestre** | Rotas de `app/api/` de produto | Lógica hoje em `lib/services/produtos.ts` | Orquestração desacoplada | **Alto** — exige Ports concretos e o agregado |
| **Repo ProdutoMestre Supabase** | Os casos de uso acima | — | Persistência canônica | Médio — tabelas existem; fiação a cliente real não verificada |
| **SDK de conectores + Magazord** | Um futuro fluxo de ingestão ERP | Importação atual em `lib/services/importacaoProdutos.ts` | Conector padronizado com contract tests | **Alto** — nunca conectado; exige credenciais e validação em produção |

**Padrão observado:** o **risco cresce com a profundidade**. VOs são de baixo risco
(isolados, puros); agregados e casos de uso são de alto risco (exigem substituir o modelo de
dados da produção). A integração incremental seria, por evidência, **mais segura de fora
para dentro** — dos VOs para os agregados —, **mas esta auditoria não recomenda sequência**;
apenas registra o gradiente de risco.

---

## 12. Limitações

- **EVIDÊNCIA INSUFICIENTE** sobre existência de implementações concretas dos Ports
  (`Clock`, `IdGenerator`, `EventPublisher`) fora dos fakes de teste — não localizadas, mas
  a busca não foi exaustiva por todas as formas possíveis.
- **EVIDÊNCIA INSUFICIENTE** sobre equivalência funcional entre a Fundação e a produção — os
  dois modelam produto de formas distintas; comparar exigiria execução lado a lado.
- Não foi avaliado o **motivo** de a Fundação nunca ter sido integrada — é fato histórico,
  não medível por código.
- A qualidade interna do código (coesão, duplicação) **não** foi auditada além de tamanho e
  testes.
- O conteúdo das migrações 020/021 foi confirmado por existência, **não** por leitura
  completa de esquema.

---

## 13. Conclusão

A Fundação Arquitetural é um **corpo de código internamente coerente e testado, construído
como uma base incremental planejada** — os comentários referenciam "PRs futuros" e migrações
numeradas, revelando uma sequência de construção deliberada (domínio → aplicação →
infraestrutura). Dentro dela há **um vertical quase completo** — ProdutoMestre, do agregado
ao repositório com migrações reais — e **um vertical em stub** — Listing, aguardando a
migração 022.

**Nada disso foi jamais ligado à produção.** O conceito central — ProdutoMestre — não existe
no banco que a produção usa. Os 113 testes verdes provam a **coerência da lógica contra
dublês**, não a **integração com sistemas reais**, que nunca ocorreu.

---

## Parecer final

**A Fundação Arquitetural é:**

☑ **Uma fundação reutilizável** — *no sentido de biblioteca de domínio e contratos*
☑ **Um conjunto de conceitos úteis** — VOs, agregados e SDK de conectores são ativos
concretos e testados

**Com as seguintes ressalvas de evidência:**

- **Não é uma arquitetura madura** — maturidade exigiria uso em produção, que **nunca
  ocorreu** (0 imports; conceito ausente do banco).
- **Não é apenas um experimento** — experimento sugere código descartável; aqui há lógica
  completa, migrações reais e 113 testes verdes.
- **É parcialmente pronta** — com um gradiente auditável: VOs **PRONTO**, casos de uso e
  repositório ProdutoMestre **ADAPTÁVEL**, repositório Listing e conector ML **INCOMPLETO**,
  a Fundação-como-sistema **EXPERIMENTAL**.

**Formulação precisa, sustentada por evidência:**

> **A Fundação é uma base de domínio e infraestrutura tecnicamente coerente e testada
> internamente, parcialmente implementada, com um vertical (ProdutoMestre) próximo de pronto
> e outro (Listing) incompleto, que nunca foi integrada à produção e cujos testes validam
> lógica, não integração.** É um **ativo reutilizável de baixo nível** (value objects,
> contratos) e um **modelo alternativo não validado** de alto nível (agregados, casos de uso,
> conectores).

**Esta auditoria não recomenda adoção, sequência ou descarte.** Estabelece que a Fundação
contém ativos reais e hipóteses não validadas, distingue uns dos outros por evidência, e
deixa a decisão — que é de arquitetura, não de medição — para quem a tomar.

---

*Produzido em 21 de julho de 2026 · `HEAD d2b0fe5` · sem alteração de código, arquitetura ou
governança.*
