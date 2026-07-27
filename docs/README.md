# Documentação do Zion OS — índice raiz

> **Para que serve este arquivo.** O repositório tem centenas de documentos, acumulados
> ao longo de fases distintas do projeto. Nem todos valem o mesmo: alguns **obrigam**,
> outros **registram o que foi provado**, outros **preservam decisões superadas**.
>
> Este índice declara **qual estrato cada documento ocupa**. Ele não move nada — a
> localização física dos arquivos permanece como está. O que ele resolve é a pergunta
> que realmente importa: *quando dois documentos discordam, qual deles manda?*

## Os três estratos

| Estrato | O que significa | Como tratar |
|---|---|---|
| **NORMA** | vinculante **hoje**. Nenhuma decisão de produto, design, texto, IA ou engenharia pode contrariar. | ler antes de decidir; alterar só por processo explícito |
| **EVIDÊNCIA** | registro do que foi **medido ou provado**. Não obriga, mas sustenta (ou refuta) decisões. | citar ao justificar; nunca reescrever a posteriori |
| **HISTÓRICO** | fases encerradas, planos superados, auditorias antigas. Preservado para rastreabilidade. | **não** usar como fonte de decisão atual |

**Regra de precedência:** NORMA > EVIDÊNCIA > HISTÓRICO. Em conflito dentro do mesmo
estrato, vence o documento mais recente que declare explicitamente o que supera.

---

## NORMA

### Constituição do Produto — `docs/product/`
A fundação do Product Experience. [Índice completo com uma linha por documento](product/README.md).

- **[CONST-001](product/CONST-001-zion-constitution.md)** — a porta de entrada: identidade, 15 leis, precedência, algoritmo decisório
- **PX-001…006** — visão, o dia perfeito, persona, filosofia, blueprint, parecer constitucional
- **DOM-001/002** — modelo do domínio de comércio e as 12 leis permanentes
- **VOC-001** — vocabulário canônico (34 conceitos)
- **UX-002/003/004/010** — fluxos universais, arquitetura de experiência, wireframes, modelo de navegação
- **UI-001 · SHELL-001/002 · CMP-001** — objetos de interface, shell da aplicação, árvore de componentes, componente Missão
- **[CAP-000](product/capabilities/CAP-000-capability-constitution.md)** — constituição das Capabilities (eixo funcional)
- **VAL-001** — stress test constitucional (as emendas aplicadas)

### Cadeia do Design System — `docs/product/system/`
Sob a autoridade da Ontologia. **Ordem de precedência: 000 → 002 → 003 → 004 → 005.**

- **[000 Ontologia Normativa](product/system/000-ontologia-normativa.md)** — a autoridade conceitual; precede todo o resto
- **[002 Product Laws](product/system/002-product-laws.md)** — as leis da expressão visual
- **[003 Design System Foundation](product/system/003-design-system-foundation.md)** — a ontologia das 5 camadas visuais
- **[004 Design Tokens](product/system/004-design-tokens.md)** — os **304 Tokens canônicos**. ⚠️ **Fonte de build**: `src/design/tokens.json` deriva deste documento
- **[005 Semantic Tokens](product/system/005-semantic-tokens.md)** — a camada do significado

### Decisões arquiteturais (ADRs)
Casa canônica: **`docs/decisions/`**. Cinco ADRs anteriores vivem em `docs/zion-os/` por
razões históricas — permanecem **igualmente vinculantes**.

| ADR | Assunto | Local |
|---|---|---|
| [ADR-001](zion-os/engineering/ADR-001-suggestion-memory.md) | Suggestion Memory | `zion-os/engineering` |
| [ADR-002](zion-os/engineering/ADR-002-knowledge-maturation-policy.md) | Política de maturação de Knowledge | `zion-os/engineering` |
| [ADR-003](decisions/ADR-003-declarar-interaction-e-corrigir-consumo-dos-controles.md) | Interaction e consumo dos controles | `decisions` |
| [ADR-005](decisions/ADR-005-escopo-cadeia-de-resolucao.md) | Escopo da cadeia de resolução | `decisions` |
| [ADR-006](decisions/ADR-006-idempotencia-size-charts-mercado-livre.md) | Idempotência de size charts (ML) | `decisions` |
| [ADR-007](zion-os/governance/ADR-007-deliberacao-da-rfc-001.md) | Deliberação da RFC-001 | `zion-os/governance` |
| [ADR-008](zion-os/governance/ADR-008-institucionalizacao-do-checklist-de-elegibilidade.md) | Checklist de elegibilidade | `zion-os/governance` |
| [ADR-009](zion-os/governance/ADR-009-estrategia-de-ports-e-escopo-da-r2.md) | Estratégia de Ports | `zion-os/governance` |
| [ADR-010](decisions/ADR-010-composition-root-de-integracao.md) | Composition Root de Integração | `decisions` |

> **Toda ADR nova nasce em `docs/decisions/`**, com o próximo número livre da sequência global.

### Processo de engenharia
- **[PLAYBOOK-001](engineering/PLAYBOOK-001-capabilities.md)** — o processo oficial de toda Capability nova: estrutura física, reuso obrigatório, camadas congeladas, Definition of Done
- **[ENG-001](product/ENG-001-vertical-slice-zero.md)** — o plano da Vertical Slice Zero (concluída)

---

## EVIDÊNCIA

### Experimentos — `docs/engineering/experiments/`
Protocolos **congelados antes da execução**, com critérios de sucesso e falsificação
definidos a priori. Não são norma: **produzem** a evidência sobre a qual normas se decidem.

- **[EXP-002](engineering/experiments/EXP-002-composition-root-ergonomics.md)** — ergonomia do composition root → resultou na **ADR-010**
- **[EXP-003](engineering/experiments/EXP-003-runtime-factory-adoption.md)** — adoção da runtime-factory em `/z` → Cenário A, validou a ADR-010 sem delta normativo

### Relatórios de execução — `docs/engineering/executions/`
O que foi feito, medido e observado em cada entrega (PRs, épicos E4/E5, auditorias de segurança).

### Auditorias e backlog — `docs/engineering/`
- **[PROJECT_AUDIT](engineering/PROJECT_AUDIT.md)** — as 10 dimensões do projeto, com evidência
- **[ENGINEERING_BACKLOG](engineering/ENGINEERING_BACKLOG.md)** — épicos priorizados
- **[EVOLUTION](engineering/EVOLUTION.md)** · **[GLOSSARY](engineering/GLOSSARY.md)** · **[AIL_SIGNAL_MAP](engineering/AIL_SIGNAL_MAP.md)**

### Motor de inteligência — `docs/zion-os/`
RFCs, capítulos e especificações da Adaptive Intelligence Layer. Mistura norma (as ADRs
acima) e evidência (RFCs, análises) — consulte o cabeçalho de cada documento.

---

## HISTÓRICO

Preservado para rastreabilidade. **Não usar como fonte de decisão atual.**

- `docs/releases/` — notas de versão
- `docs/architecture/` — arquitetura das fases iniciais (000–019)
- `docs/zion-os-audit/` · `docs/staging-setup/` · `docs/staging-stabilization/` — fases encerradas
- `docs/implementation-phase-1-security/` · `docs/agency-panel-separation/` — implementações concluídas
- `docs/obsidian/` — notas de trabalho e canvas

---

## Regra para documentos novos

Todo documento nasce declarando, no cabeçalho:

1. **o estrato** — norma, evidência ou histórico;
2. **o que ele supera**, se substituir algo;
3. **a autoridade** de que deriva, se for norma.

Foi assim que o EXP-002, o EXP-003 e a ADR-010 nasceram — e nenhum dos três gerou
ambiguidade sobre o que manda.
