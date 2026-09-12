# IMP-AIL-001 — Plano de Implementação R-DJ-1 (Decision Journal)

> **Natureza.** Plano técnico da **primeira implementação real** da Adaptive Intelligence
> Layer — a infraestrutura do Decision Journal. **Não escreve código.** Projeta exatamente o
> que muda, com base na arquitetura atual do Zion. Onde faltou evidência: **EVIDÊNCIA
> INSUFICIENTE**.
>
> **Fonte:** RFC-AIL-001 (Decision Journal), RFC-AIL-002 (Modelo Canônico), ARQ-003. Evidência
> de código: `HEAD d2b0fe5`.

---

## 1. Objetivo

Responder: **como implementar o Decision Journal no código existente com o menor risco
possível?**

**Escopo estrito de R-DJ-1** (RFC-AIL-001 §10): entregar **o contrato** — o tipo `Decision`, o
port `registrarDecisao` *fire-and-forget* e uma implementação **no-op** padrão — **sem conectar
nenhum contexto**. Nada de produção chama o Journal ao fim desta release.

**Fora de escopo:** conectar qualquer serviço (R-DJ-2+), Pattern Detector, Suggestion Engine,
persistência real com migração (ver §11 — deferida), qualquer sugestão ou automação.

---

## 2. Estado atual (evidência)

| Fato do código | Evidência | Consequência para o plano |
|---|---|---|
| Persistência via `criarRepositorio<T,Row>` | `lib/repositorio.ts` | Padrão conhecido; **não usado em R-DJ-1** (evitaria tocar `store.ts`/`mappers.ts`) |
| Fallback demo (Supabase **ou** localStorage) | `repositorio.ts` §`supabaseConfigurado` | Qualquer persistência precisa funcionar (ou no-op) nos dois modos |
| Módulos com 5 camadas | `src/modules/catalog/{domain,application,ports,adapters,infrastructure}` | Convenção disponível para alojar a AIL |
| Testes: `tsx --test`, arquivo ao lado | 33 arquivos, **243 testes** verdes | Novos testes seguem o mesmo runner |
| Namespace AIL livre | `adaptive`/`decision-journal`/`registrarDecisao` = **0 usos reais** (única ocorrência é `thinking:{type:"adaptive"}`) | Nenhuma colisão de nome |
| `CollectionName` é um union tipado | `store.ts:33` | Um adaptador real de persistência tocaria `store.ts` + `mappers.ts` + `database.types.ts` — **por isso R-DJ-1 usa no-op** |

**Baseline a preservar:** build verde, **243 testes**, zero telas/regra/fluxo alterados.

---

## 3. Estratégia

**Princípio: uma pasta nova, isolada, que nada importa.** R-DJ-1 adiciona um diretório
autocontido e **não modifica nenhum arquivo existente**. Isso dá as três propriedades exigidas:

- **Reversibilidade total:** apagar a pasta remove a release sem resíduo (nada a referencia).
- **Zero impacto funcional:** nenhum fluxo chama o Journal; o código novo não é exercitado por
  produção.
- **Incrementalidade:** o contrato existe para R-DJ-2 conectar **um** ponto, depois.

**Decisão de localização (com alternativa registrada):**
Proposta: `src/modules/adaptive-intelligence/` seguindo a convenção de módulos (domain/ports/
infrastructure), pois a AIL é uma capacidade transversal nova e a convenção já existe.
*Alternativa:* `src/lib/adaptive/` (mais simples, junto do núcleo operacional). **Ambas são
igualmente reversíveis** (uma pasta). A escolha é de convenção, não de risco — registrada para
o time confirmar. Este plano assume `src/modules/adaptive-intelligence/`.

**Por que no-op, não persistência real, em R-DJ-1:**
Um adaptador real exigiria uma **tabela nova** (migração) + entrada em `CollectionName` +
`mappers.ts` + `database.types.ts` — quatro arquivos existentes tocados e uma mudança de
schema. Para "menor risco possível", R-DJ-1 entrega o **contrato + no-op**, que toca **zero**
arquivos existentes. A persistência real é uma release seguinte, aditiva e isolada (§11).

---

## 4. Pontos de entrada (PASSO 1)

**Onde nasce uma Decision?** No momento em que o cliente **corrige/sobrescreve** uma proposta
do sistema — o que ocorre na **camada de serviço/aplicação** (`src/lib/services/*`), onde a
persistência da correção acontece (evidência: `anunciosGerados.ts` grava aprovação;
`canaisMarketplace.ts` grava `tipoAnuncio`; `pendencias.ts` grava `resolvida`).

**Qual camada deve chamar `registrarDecisao`?**

| Camada | Deve chamar? | Justificativa (evidência) |
|---|---|---|
| **Domain** (`modules/*/domain`, `src/domain`) | **NÃO** | É lógica pura sem I/O; acoplá-la à observação violaria seu isolamento (a Esteira, Core Domain, permanece intocada) |
| **Application / Services** (`src/lib/services`) | **SIM** *(a partir de R-DJ-2)* | É onde a decisão do cliente é persistida — o ponto natural do push *fire-and-forget* |
| **Infrastructure** (`repositorio`, `supabase`) | **NÃO chama; hospeda** | É onde o **adaptador** do Journal viverá (persistência), não quem decide observar |

**Em R-DJ-1, nenhuma camada chama** — o ponto de entrada é **projetado, não conectado**. A
conexão do primeiro serviço é R-DJ-2.

---

## 5. Arquivos impactados (PASSO 2)

### 5.1 Arquivos existentes modificados
**NENHUM.** Esta é a afirmação central do plano: R-DJ-1 não toca um arquivo sequer que já
exista. *(Verificável: o diff da release contém apenas adições em pasta nova.)*

### 5.2 Arquivos novos (todos em `src/modules/adaptive-intelligence/`)

| Arquivo | Papel | Camada |
|---|---|---|
| `domain/decision.ts` | O **tipo canônico `Decision`** (RFC-AIL-002 §4): id, empresa, autor, contexto, entidade, campo, valorAnterior, valorNovo, origem, timestamp, correlação, metadados | domain |
| `ports/decision-journal.port.ts` | A **interface** do port: `registrarDecisao(d: Decision): void` — contrato *fire-and-forget* | ports |
| `infrastructure/decision-journal.noop.ts` | Implementação **no-op**: recebe e descarta; nunca lança | infrastructure |
| `decision-journal.ts` | **Factory/entry point**: devolve a implementação ativa (no-op por ora) | módulo (raiz) |
| `infrastructure/decision-journal.memory.ts` | Adaptador **em memória** — só para teste (registra o recebido); **não** é produção | infrastructure |
| `decision-journal.test.ts` | Testes do contrato | teste |
| `README.md` | Declara o propósito e a fronteira (observador lateral) | doc |

### 5.3 Interfaces, ports, adapters, factories, services

| Elemento | Novo? | Detalhe |
|---|---|---|
| **Interface** | `DecisionJournal` (port) | `registrarDecisao(d: Decision): void` |
| **Port** | `ports/decision-journal.port.ts` | O contrato |
| **Adapter** | `noop` (produção) + `memory` (teste) | Nenhum adapter de persistência real em R-DJ-1 |
| **Factory** | `decision-journal.ts` | Retorna o adapter ativo |
| **Service** | **Nenhum tocado** | Serviços só entram em R-DJ-2 |

---

## 6. Dependências (PASSO 3)

**O que depende do Decision Journal:** **nada**, ao fim de R-DJ-1. É folha isolada.

**O que NÃO deve depender dele:**
- **O Core Domain (Esteira)** — jamais. Princípio 10 da ARQ-003.
- **A camada Domain** de qualquer módulo — lógica pura não observa.
- **Qualquer fluxo de produção** — em R-DJ-1, nenhum.

**Direção das dependências (para garantir ausência de ciclo):**
```
  decision-journal.ts (factory)
        │ importa
        ├─► ports/decision-journal.port.ts
        ├─► infrastructure/decision-journal.noop.ts ──► ports (implementa)
        └─► domain/decision.ts (tipo)
  (memory adapter e testes importam o mesmo; NADA fora da pasta importa para dentro)
```
**Sem ciclo:** `domain` não importa `ports`; `ports` não importa `infrastructure`; a factory é
o único ponto que amarra tudo. **Nada externo importa a pasta** — logo, impossível criar ciclo
com o resto do sistema.

---

## 7. Ordem dos commits (PASSO 4)

Cada commit **compila** e mantém a **suíte verde (243 + os novos)**.

| # | Commit | Conteúdo | Compila? | Testes |
|---|---|---|---|---|
| **C1** | `domain/decision.ts` | O tipo canônico `Decision` (só tipo) | Sim | 243 (inalterada) |
| **C2** | `ports/decision-journal.port.ts` | A interface do port (só tipo) | Sim | 243 |
| **C3** | `infrastructure/decision-journal.noop.ts` | O no-op que implementa o port | Sim | 243 |
| **C4** | `decision-journal.ts` + `README.md` | Factory devolvendo o no-op + fronteira documentada | Sim | 243 |
| **C5** | `infrastructure/decision-journal.memory.ts` + `decision-journal.test.ts` | Adapter de teste + testes do contrato | Sim | **243 + N** |

**Racional da ordem:** tipos primeiro (C1–C2, nada a testar), implementação depois (C3–C4),
testes por último (C5) — quando há o quê testar. Cada commit é isolado e revertível sozinho;
nenhum quebra o anterior.

---

## 8. Estratégia de testes (PASSO 5)

### 8.1 Testes unitários (em `decision-journal.test.ts`)
| Teste | Prova |
|---|---|
| **No-op não lança** | `registrarDecisao` com uma `Decision` válida retorna sem efeito e sem erro |
| **Fire-and-forget engole erro** | Um adapter que lança internamente **não propaga** — o contrato garante silêncio |
| **A `Decision` flui íntegra** | Via `memory` adapter, o objeto recebido tem todos os campos canônicos (RFC-AIL-002 §4) |
| **Forma do tipo `Decision`** | Uma `Decision` mínima compila com os campos obrigatórios; opcionais ausentes não quebram |

### 8.2 Testes de integração
**Nenhum em R-DJ-1** — não há integração: nada é conectado. Integração surge em R-DJ-2 (um
serviço + o Journal). *(Registrado para não haver a expectativa falsa de um teste E2E aqui.)*

### 8.3 Contratos a proteger
- **`registrarDecisao` é fire-and-forget** — nunca lança, nunca bloqueia. É o invariante
  central; o teste "engole erro" o protege.
- **A suíte existente permanece em 243** — nenhum teste existente muda; os novos apenas somam.

---

## 9. Rollback (PASSO 6)

**Três níveis, todos sem resíduo:**
1. **Reverter C5→C1** na ordem inversa — cada commit é independente.
2. **Apagar a pasta `src/modules/adaptive-intelligence/`** — como **nada** a importa (§6), não
   restam referências pendentes; o build volta a compilar; a suíte volta a **243**.
3. **`git revert`** do range da release.

**Garantia de "sem alterar comportamento":** como nenhum arquivo existente foi tocado (§5.1),
qualquer rollback devolve o sistema ao estado **byte-a-byte** anterior nos arquivos de
produção. O único efeito de remover R-DJ-1 é a ausência da pasta nova.

---

## 10. Critérios de aceitação (PASSO 7)

| # | Critério | Como verificar |
|---|---|---|
| 1 | **Nenhuma tela alterada** | Diff não toca `src/app` nem `src/components` |
| 2 | **Nenhuma regra alterada** | Diff não toca `src/lib`, `src/modules/{catalog,integration,publication}`, `src/domain` |
| 3 | **Nenhum fluxo alterado** | Diff só adiciona a pasta nova |
| 4 | **Journal sem consumidores** | `grep registrarDecisao src/` retorna apenas a própria pasta |
| 5 | **Zero impacto funcional** | Build verde; **243** testes existentes idênticos; comportamento inalterado |
| 6 | **Novos testes verdes** | Os N testes do contrato passam |
| 7 | **Sem ciclo de dependência** | Nada fora da pasta importa para dentro |
| 8 | **Fire-and-forget comprovado** | O teste "engole erro" passa |

---

## 11. Riscos e a persistência deferida

| # | Risco | Nível | Mitigação |
|---|---|---|---|
| **R1** | A pasta virar código morto esquecido | Baixo | É **intencional** até R-DJ-2; o README declara o propósito |
| **R2** | Escolha de localização gerar retrabalho | Baixo | Mover uma pasta isolada é trivial e reversível; §3 registra a alternativa |
| **R3** | Alguém conectar um serviço "de brinde" | Médio | Critério 4 barra: R-DJ-1 **proíbe** consumidores; conexão é R-DJ-2 |
| **R4** | Persistência real precisar de migração | — | **Deferida**: R-DJ-1 usa no-op; a persistência real (tabela append-only + `CollectionName` + `mappers`) é uma release aditiva própria, com seu rollback (drop table). Não entra aqui |

**Estimativa (PASSO 8 — sem horas):**

| Dimensão | Avaliação |
|---|---|
| **Complexidade** | **Baixa** — tipos + no-op + testes; sem I/O, sem migração |
| **Risco** | **Muito baixo** — zero arquivos existentes tocados; nada conectado |
| **Dependências** | **Nenhuma** — folha isolada |
| **Bloqueadores** | **Nenhum** |
| **Esforço relativo** | **Pequeno** — 5 commits curtos, uma pasta |

---

## 12. Próximos passos

| Passo | Entrega | Depende de |
|---|---|---|
| **R-DJ-1b** *(opcional)* | Adaptador de persistência real (tabela append-only, aditiva) — **ainda sem consumidores** | R-DJ-1 |
| **R-DJ-2** | Conectar **o primeiro serviço** (correção de categoria) via *fire-and-forget* | R-DJ-1 (+1b se persistir) |
| **R-DJ-3** | Segundo/terceiro pontos (tipo de anúncio, override de medida) | R-DJ-2 |
| **R-DJ-4** | Cobertura completa dos pontos de alto/médio valor | R-DJ-3 |
| **RFC-AIL-003** | Pattern Detector (consome o Journal) | Journal com dados |

---

## 13. Conclusão

R-DJ-1 é a implementação de **menor risco concebível** para inaugurar a Adaptive Intelligence
Layer: **uma pasta nova, isolada, que nenhum arquivo existente importa**, contendo o tipo
canônico `Decision`, o port `registrarDecisao` *fire-and-forget* e um no-op — validados por
testes de contrato. **Nenhum arquivo de produção é tocado; nenhum fluxo é exercitado; o
rollback é apagar a pasta.**

A escolha de entregar **contrato + no-op** (e deferir a persistência real) é o que torna a
primeira release **byte-a-byte inócua** ao comportamento atual — cumprindo a exigência de que,
removida, o sistema funcione exatamente como hoje. É o primeiro Pull Request seguro da AIL: ele
**estabelece a fronteira** sem cruzar nenhuma.

> **R-DJ-1 não observa nada ainda. Ele apenas cria o lugar por onde a observação passará —
> vazio, testado e reversível.** A primeira Decision real só é registrada em R-DJ-2, quando um
> único serviço chamar o port que este plano projeta.

---

*Produzido em 21 de julho de 2026 · `HEAD d2b0fe5` · plano técnico · sem escrever código, sem
alterar comportamento.*
