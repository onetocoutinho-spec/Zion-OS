# Adaptive Intelligence Layer — Documentação Oficial

## Status

- **Adaptive Intelligence Architecture v1**
- **Architecture Freeze**
- **Normative Documentation**

Estes oito documentos formam o **Adaptive Intelligence Documentation Set v1** — o ponto de
entrada e o índice da documentação arquitetural **normativa** da Adaptive Intelligence Layer
(AIL) do Zion OS. Institucionalizado por **PR-DOC-001** em 21 de julho de 2026.

---

## 1. Objetivo da Adaptive Intelligence Layer

A AIL responde a uma pergunta de arquitetura:

> **Como uma decisão do cliente se transforma em inteligência do sistema — de forma explicável,
> auditável, reversível, incremental e controlada pelo cliente?**

Ela **observa** as decisões que o cliente já toma (correções de categoria, tipo de anúncio,
resolução de pendências…), **conta** as recorrências de forma determinística e **oferece** de
volta o que aprendeu — **sem nunca controlar**. Seu invariante central:

> **A AIL observa e oferece; nunca controla. Se for removida, o sistema funciona exatamente como
> hoje.** É aditiva por construção; o Core Domain (a Esteira) permanece a autoridade.

**Nada nela é ML.** É memória disciplinada: contagem determinística, explicável e reversível.

## 2. O Documentation Set congelado

A fase de arquitetura da AIL está **encerrada**. O **Adaptive Intelligence Documentation Set v1**
é composto por **ARQ-003 + RFC-AIL-001…005**, com a **ARCH-REVIEW-001** como revisão de
conformidade. A autoridade de
consolidação e a declaração formal do congelamento estão na **RFC-AIL-005 §11.3**.

A partir do Freeze v1:

1. **Alterações conceituais exigem ADR** — qualquer mudança em entidades, Pattern Key, lifecycle,
   escada de Confidence ou invariantes de reversibilidade/isolamento só por ADR aprovado que
   demonstre, por evidência, a insuficiência do modelo v1 (estende RFC-AIL-002 §14).
2. **Implementações devem seguir os documentos oficiais** — as releases (a começar por R-DJ-3)
   implementam exatamente o que está aqui, sem redecidir arquitetura.
3. **Nenhuma RFC nova deve redefinir conceitos já congelados** — ajustes de parâmetro *dentro* do
   modelo e novas implementações não exigem RFC nova; redefinição conceitual, sim (via ADR).

## 3. Índice e mapa de leitura

A ordem oficial do **Adaptive Intelligence Documentation Set v1**, do fundamento à revisão — cada
seta é uma dependência conceitual:

```
   ARQ-003            (a arquitetura: a camada, o invariante, o roadmap)
      ↓
   RFC-AIL-001        (o Decision Journal: o que se observa e como)
      ↓
   RFC-AIL-002        (o modelo canônico: Decision → Pattern → Suggestion → Knowledge)
      ↓
   RFC-AIL-003        (a Pattern Key: quando duas Decisions são o mesmo aprendizado)
      ↓
   RFC-AIL-004        (o Pattern Detector: como Decisions viram Patterns)
      ↓
   RFC-AIL-005        (o modelo de execução: consolida tudo · Architecture Freeze v1)
      ↓
   ARCH-REVIEW-001    (revisão de conformidade da 1ª implementação — R-DJ-1/R-DJ-2)
```

| # | Documento | Função |
|---|---|---|
| 1 | [ARQ-003 — Adaptive Intelligence Architecture](ARQ-003-adaptive-intelligence-architecture.md) | Define a **camada**: posição, responsabilidade exclusiva, os 12 princípios, o modelo de confiança/memória e o roadmap `observar → detectar → sugerir → automatizar → reaprender`. |
| 2 | [RFC-AIL-001 — Decision Journal](RFC-AIL-001-decision-journal.md) | Projeta o **registro append-only** das decisões: pontos de decisão, critério de entrada, fluxo *fire-and-forget*, auditoria. Fundação de tudo. |
| 3 | [RFC-AIL-002 — Canonical Learning Model](RFC-AIL-002-canonical-learning-model.md) | Fixa as **quatro entidades** (Decision, Pattern, Suggestion, Knowledge) e a linguagem ubíqua; demove Outcome/Confidence/Memory a derivados; elimina Validation. |
| 4 | [RFC-AIL-003 — Canonical Pattern Key](RFC-AIL-003-canonical-pattern-key.md) | Define a **identidade de um Pattern**: a chave `(empresa, contexto, campo, valorNovo)` e o *slot* — quando duas Decisions são o mesmo aprendizado. |
| 5 | [RFC-AIL-004 — Pattern Detector](RFC-AIL-004-pattern-detector.md) | Define o **algoritmo determinístico** que transforma uma sequência de Decisions em Patterns (contagem, Confidence até Consistente, idempotência, confluência). |
| 6 | [RFC-AIL-005 — Adaptive Intelligence Execution Model](RFC-AIL-005-adaptive-intelligence-execution-model.md) | **Consolida** lifecycle, Suggestion, Knowledge, Confidence, explicabilidade e reversibilidade; resolve as pendências; **declara o Architecture Freeze v1**. |
| — | [ARCH-REVIEW-001 — Architecture Review](ARCH-REVIEW-001-adaptive-intelligence.md) | **Revisão de conformidade** da primeira implementação (R-DJ-1/R-DJ-2): verifica invariantes, dependências, reversibilidade e emite parecer de merge. |

## 4. Ordem recomendada de leitura

- **Para entender o "porquê" e o todo:** leia **ARQ-003** e depois **RFC-AIL-005** (a consolidação).
  Esses dois, sozinhos, dão a visão completa da camada congelada.
- **Para implementar:** siga a cadeia na ordem do índice (§3). Cada RFC pressupõe a anterior.
- **Para auditar uma implementação:** use **ARCH-REVIEW-001** como modelo de revisão.

## 5. Relação entre os documentos

- **ARQ-003** é a raiz — define a camada e o invariante de reversibilidade que todos os demais
  preservam.
- **RFC-AIL-001** materializa a observação; **RFC-AIL-002** dá o vocabulário; **RFC-AIL-003** dá a
  identidade; **RFC-AIL-004** dá o comportamento. Cada um **depende** do anterior e **não redefine**
  o que já foi decidido.
- **RFC-AIL-005** é a **autoridade de consolidação**: reúne os quatro em um modelo de execução
  único, reconcilia as tensões acumuladas (§7 abaixo) e congela a arquitetura.
- **ARCH-REVIEW-001** é transversal: revisa se a implementação real honra o que os documentos
  definem.

## 6. Architecture Freeze v1 — declaração

> ## **Adaptive Intelligence Architecture v1 — Architecture Freeze**
>
> Vigente a partir de **21 de julho de 2026**. Compõem o congelamento: **ARQ-003** e **RFC-AIL-001,
> 002, 003, 004, 005**; **ARCH-REVIEW-001** é a revisão de conformidade associada.
>
> A partir desta versão:
> - **alterações conceituais exigem ADR;**
> - **implementações devem seguir os documentos oficiais;**
> - **nenhuma RFC nova deve redefinir conceitos já congelados.**
>
> Fonte da declaração: RFC-AIL-005 §11.3.

## 7. Verificação de consistência

Verificação realizada na institucionalização. **Nenhum conteúdo técnico aprovado foi alterado** —
os achados abaixo são **registrados**, não corrigidos no conteúdo.

| Item | Resultado |
|---|---|
| **Numeração** | ✓ Sequência completa: ARQ-003 · RFC-AIL-001…005 · ARCH-REVIEW-001. |
| **Referências cruzadas** | ✓ São por **nome e §seção** (ex.: "RFC-AIL-003 §3.3"); RFC-AIL-005 cita todas as anteriores. Nenhuma referência interna quebrada. |
| **Links internos** | ✓ Nenhum link markdown direto a arquivo entre os docs — logo, nada a quebrar ao versionar. |
| **Documentos órfãos** | ✓ Nenhum dos 7 fica órfão: todos indexados aqui (§3). |
| **Conflitos** | ✓ Nenhum conflito conceitual aberto — F-1…F-5 resolvidos em RFC-AIL-005 §11.1. |

**Inconsistências registradas (não alteradas):**

- **R-1 — título interno do Decision Journal.** O arquivo foi institucionalizado com o nome
  canônico **`RFC-AIL-001-decision-journal.md`** (série RFC-AIL, conforme RFC-AIL-002 "Nota de
  série"), mas seu **título H1 interno permanece "RFC-001 — Decision Journal (R-AIL-1)"** por ser
  registro histórico da colisão de numeração — explicado na própria nota do documento e em
  RFC-AIL-002. **Preservado sem reescrever** (restrição desta PR).
- **R-2 — referências a documentos upstream não incluídos.** Os 7 documentos citam, como **fontes/
  evidência**, artefatos da fase de descoberta que **permanecem não versionados**: **Cap. 02**
  (Bounded Contexts, ~16 menções), **Epic 00** (Memória Comercial, ~7), **Epic 01**, **Plano de
  Convergência** e o plano de implementação **IMP-AIL-001**. Eles são citados como origem, **não**
  como leitura obrigatória para entender o modelo congelado (que é autocontido nos 7).
  **Recomendação:** institucionalizá-los em uma **PR-DOC-002** (corpus de descoberta/fundação).
  Fora do escopo desta PR (que é, por instrução, exatamente os 7).

## 8. Escopo desta institucionalização

**Incluídos (PR-DOC-001):** os 7 documentos oficiais da arquitetura congelada (§3).
**Não incluídos (recomendados para PR-DOC-002):** IMP-AIL-001 e o corpus de descoberta (Cap. 01/02,
Epic 00/01, Diagnóstico, Análise Comparativa, Plano de Convergência, Validação da Fundação).

---

*Adaptive Intelligence Documentation Set v1 · Architecture Freeze · Institucionalizado em 21 de
julho de 2026 · PR-DOC-001 · documentação normativa · sem alteração de código, arquitetura ou
comportamento. A próxima release (R-DJ-3) referencia oficialmente estes documentos.*
