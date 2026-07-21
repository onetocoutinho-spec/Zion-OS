# Arquitetura Oficial do Zion OS

Este diretório contém a **arquitetura vigente** do Zion OS. É a **única localização
oficial** dos artefatos arquiteturais da plataforma.

Este documento **orienta a navegação**. Ele não resume nem reproduz o conteúdo dos
documentos — cada um responde por si.

---

## Documento raiz

**[Manifesto Arquitetural](constitution/zion-os-manifesto-arquitetural.md)** — a
Constituição do Zion OS e a **porta de entrada** de toda a arquitetura. Quem chega
agora deve começar por ele.

---

## Estrutura

```
docs/zion-os/
    constitution/    organization/    modules/    engineering/    governance/
```

### `constitution/` — o que rege

Documentos de **mais alta precedência**. Regem toda a plataforma; nada pode
contradizê-los. Alteração exige ADR aprovado.

- [Manifesto Arquitetural](constitution/zion-os-manifesto-arquitetural.md)
- [Especificação Arquitetural](constitution/operation-center-arquitetura.md)
- [Modelo de Domínio](constitution/operation-center-modelo-dominio.md)
- [Máquina de Estados](constitution/operation-center-maquina-estados.md)
- [Taxonomia de Sinais](constitution/operation-center-taxonomia-sinais.md)
- [Política de Priorização](constitution/operation-center-politica-priorizacao.md)
- [Arquitetura da IA](constitution/operation-center-arquitetura-ia.md)
- [Contrato de Eventos](constitution/operation-center-contrato-eventos.md)
- [Modelo de Consistência e Fronteiras](constitution/zion-os-consistencia-fronteiras.md)
- [Governança Arquitetural](constitution/zion-os-governanca-arquitetural.md)

### `organization/` — como o software se organiza

Derivam da Constituição e não a contradizem.

- [Arquitetura do Sistema](organization/zion-os-arquitetura-do-sistema.md)
- [Arquitetura dos Módulos](organization/zion-os-arquitetura-dos-modulos.md)
- [Glossário Arquitetural](organization/zion-os-glossario-arquitetural.md) — fonte
  oficial única da Linguagem Ubíqua

### `modules/` — a anatomia interna de cada módulo

- [Operation Center](modules/operation-center-arquitetura-do-modulo.md)
- [Publication](modules/publication-arquitetura-do-modulo.md)
- [Integration](modules/integration-arquitetura-do-modulo.md)

### `engineering/` — o que testa e guia

Produzem evidência e orientam o trabalho; **não regem**.

- [Blueprint 001 — Publicação Idempotente](engineering/blueprint-001-publicacao-idempotente.md)
- [Blueprint 002 — Estoque Indisponível](engineering/blueprint-002-estoque-indisponivel.md)
- [Blueprint de Implementação 001](engineering/blueprint-implementacao-001-publicacao-idempotente.md)
- [Plano de Refatoração Arquitetural 001](engineering/plano-refatoracao-001-organizacao-dos-modulos.md)
- [Plano de Encerramento da Sprint 0](engineering/plano-encerramento-sprint-0.md)
- [Plano de Versionamento da Arquitetura Oficial](engineering/plano-versionamento-arquitetura-oficial.md)
- [Avaliação Arquitetural da R15](engineering/avaliacao-arquitetural-r15.md)

### `governance/` — as decisões e o processo

A memória de **por que** a plataforma é como é.

- [ADR-007 — Deliberação da RFC-001](governance/ADR-007-deliberacao-da-rfc-001.md)
- [ADR-009 — Estratégia de Ports e Escopo da R2](governance/ADR-009-estrategia-de-ports-e-escopo-da-r2.md)
- [RFC-001 — Ciclo de Vida da Publication](governance/RFC-001-ciclo-de-vida-da-publication.md)
- [Revalidação Arquitetural do ADR-007](governance/revalidacao-arquitetural-adr-007.md)

Pareceres de pré-abertura ficam em
[`docs/releases/pre-abertura/`](../releases/pre-abertura/) — incluindo a
[Pré-Abertura da Release 012 (R2)](../releases/pre-abertura/release-012-checklist-r2.md),
cujo parecer `NÃO ELEGÍVEL` originou o ADR-009.

---

## Relação entre as categorias

A **Constituição** define o que a plataforma é e as leis que valem para tudo. A
**Organização** traduz essas leis em estrutura de software. Os **Módulos** aplicam a
estrutura a cada verdade específica. A **Engenharia** testa se o conjunto se sustenta
diante de casos reais e guia a construção. A **Governança** registra as decisões que
alteraram qualquer um dos anteriores — e o processo pelo qual isso pode ocorrer.

A precedência é decrescente nessa mesma ordem: onde houver conflito, prevalece a
categoria de maior precedência, e o conflito é registrado — nunca contornado.

---

## Como esta arquitetura evolui

Toda evolução segue o fluxo definido em
[Governança Arquitetural](constitution/zion-os-governanca-arquitetural.md):

**Problema → Blueprint → RFC → Deliberação → ADR → Atualização dos documentos →
Revalidação por Blueprint.**

Nenhuma alteração normativa ocorre sem **ADR aprovado**. A partir da institucionalização
deste diretório, **nenhuma alteração arquitetural é considerada oficial enquanto não
estiver versionada no histórico do repositório**.

---

## Notas de escopo

- **ADR-006** (idempotência de Size Charts) encontra-se versionado na branch da Sprint 0
  e será reconciliado em `governance/` após sua integração.
- **`docs/architecture/`** abriga material **anterior** a esta arquitetura. Ele foi
  **integralmente preservado** e **nenhuma conclusão** sobre sua vigência foi tomada.
  Determinar seu papel histórico é **trabalho futuro**, fora do escopo desta
  institucionalização.
- **ADR-003** e **ADR-005**, em `docs/decisions/`, são anteriores a este ciclo e
  permanecem fora do inventário oficial até que seu conteúdo seja conferido.
