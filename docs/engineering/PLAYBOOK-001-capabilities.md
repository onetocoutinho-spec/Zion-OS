# PLAYBOOK-001 — Implementação de Capabilities na Zion

**Version 1.0**

---

## Objetivo

A Architecture Freeze v1 foi concluída. A Vertical Slice Zero foi validada. Duas
Capabilities reais foram implementadas utilizando exatamente a mesma arquitetura.

Este documento estabelece o **processo oficial** para implementar qualquer nova
Capability.

- Nenhuma Capability futura deverá reinventar arquitetura.
- Nenhuma Capability poderá alterar infraestrutura.

---

## Arquitetura congelada

As seguintes camadas são **permanentes**. Nenhuma Capability pode modificá-las:

Constitution · Ontology · Vocabulary · Product Laws · UX · Foundation · Semantic ·
Primitive UI · Shell · Mission · Application Runtime · Capability Port · Adaptive
Intelligence · Journal · Feedback.

---

## Regra 1 — Reuso antes de tudo

Toda Capability começa **procurando código existente**. Antes de criar qualquer
arquivo, localizar: serviços · tipos · adapters · builders · eventos existentes.

Se existir: **reutilizar**. Nunca copiar. Nunca duplicar.

## Regra 2 — Quatro responsabilidades

Toda Capability possui exatamente quatro responsabilidades, e nada além disso:

```
Capability → Adapter → Contracts → Tests
```

---

## Estrutura física

Toda nova Capability deverá possuir **exatamente**:

```
src/capabilities/
    <nome>/
        <Nome>Capability.ts
        <Nome>Adapter.ts
        <nome>-contracts.ts
        <nome>-events.ts
        tests/
```

Nenhum Registry. Nenhuma Factory. Nenhum Container.

---

## Contratos das camadas

### Capability
Recebe **exclusivamente** uma `Decision` (via o `CapabilityRequest` do Runtime).
Nunca conhece: React · Mission · Shell · Runtime (implementação) · Foundation ·
Semantic · Design System · Adaptive Intelligence.

### Adapter
**Única** camada autorizada a integrar infraestrutura. Pode utilizar: serviços
existentes · AIL · Journal · Repos · Supabase · APIs. Nada além disso (Lei 16).

### Runtime — nunca modificar
A única comunicação ocorre por **`CapabilityPort`**.

### Mission — nunca modificar
A única comunicação ocorre por **`UserIntent`**.

### Shell — nunca modificar
A única comunicação ocorre por **`RuntimeEvents`**.

---

## Fluxo oficial

```
Mission → UserIntent → Runtime → Decision → Capability → Adapter
        → Infraestrutura existente → RuntimeEvents → Feedback
```

---

## Desenvolvimento (ordem obrigatória)

1. Localizar implementação existente.
2. Explicar o reaproveitamento.
3. Criar Contracts.
4. Criar Adapter.
5. Criar Capability.
6. Criar testes.
7. Executar integração.
8. Executar TypeScript.
9. Demonstrar fluxo completo.

---

## Critérios obrigatórios

Toda Capability deverá provar que permaneceram **intactos**: Runtime · Mission ·
Shell · Adaptive Intelligence · Journal · Design System.

---

## Proibições

Nunca: duplicar serviços · criar Runtime paralelo · criar Mission paralela · criar
Shell paralelo · alterar infraestrutura · inventar eventos · inventar contratos.

---

## Checklist de PR

Todo Pull Request deverá responder:

- **Código existente reutilizado** — lista completa.
- **Código novo** — lista completa.
- **Camadas preservadas** — Runtime · Mission · Shell · AIL · Journal · Design System.
- **Testes** — quantidade e cobertura.
- **Fluxo demonstrado** — `Mission → UserIntent → Decision → Capability → Adapter → Infraestrutura → Feedback`.

---

## Definition of Done

Uma Capability só está concluída quando:

- ✓ reutilizar infraestrutura existente;
- ✓ não alterar arquitetura;
- ✓ possuir testes;
- ✓ possuir integração;
- ✓ possuir demonstração;
- ✓ permitir rollback independente.

---

## Apêndice — Conformidade (registro, não-normativo)

As duas Capabilities de referência que validaram este playbook:

| Capability | Commit | Conformidade com a estrutura física |
|---|---|---|
| **Marketplace** (CAP-002) | `aa578ab` | **Referência canônica** — `MarketplaceCapability.ts`, `MarketplaceAdapter.ts`, `marketplace-contracts.ts`, `marketplace-events.ts`, `tests/`. 100%. |
| **Catalog** (ENG-006) | `83123fd` | Precede este playbook; desvia em 2 pontos cosméticos: adapter é `CatalogCapabilityAdapter.ts` (não `CatalogAdapter.ts`) e `CatalogPort`/`CatalogOperation` vivem dentro de `CatalogCapability.ts` (sem `catalog-contracts.ts`). **Grandfathered** — pode ser alinhado num PR de higiene. |

Padrão de reuso comprovado (ambas): o `Adapter` chama um serviço REAL existente
(`atualizarProduto` / `salvarCanal`) que já dispara a captura da AIL/Journal
(`capturarDecisao`) para um campo observado; os eventos reutilizam
`CapabilityResponse` (ENG-005), convertidos pelo `RuntimeDispatcher` em
`CapabilityCompleted`/`CapabilityFailed`; o `/z` (composition root) traduz os
`RuntimeEvents` em `FeedbackState`. Runtime, Mission, Shell, AIL, Journal e Design
System permaneceram byte-idênticos nas duas.
