# PD-001 — Suggestion Eligibility · Estudo de Descoberta

> Capítulo III · descoberta que precedeu o E4.2. Pergunta: **quando um Pattern
> deixa de ser conhecimento e passa a ser elegível para virar Suggestion?**
> Resposta-síntese: a elegibilidade já estava congelada (RFC-AIL-005 §6.1);
> este estudo a confrontou com ADR-001, PR-007 e PR-010 — sobreviveu, com dois
> pré-requisitos que ela não conhecia.

## O critério objetivo (implementado no E4.2)

> **SILÊNCIO** — slot sem Pattern (ou registro de oferta indisponível).
> **INFORMAR** — ∃ Pattern materializado (qualquer confidence; disputa → alerta).
> **SUGERIR** — `consistente` ∧ slot `CONSISTENTE` ∧ registro de oferta
> existente ∧ explicação derivável.

Zero números inventados: 3/consistente da 004 §4.3; o veto da disputa da 004
§4.4; a aditividade do silêncio da 005 §6.2; o registro de oferta da ADR-001.

## Bloqueios e suas leis

| O sistema cala quando… | Lei |
|---|---|
| slot sem Pattern | aditividade (005 §6.2) |
| confidence < consistente | 005 §6.1 |
| slot EM_DISPUTA | "nenhum sugere" (004 §4.4) |
| "recém-criado" | já coberto pela contagem; regra temporal é proibida (004 §6.4 — EVIDÊNCIA INSUFICIENTE) |
| sem registro de oferta | ADR-001 — sugestão não-auditável não existe |
| zero `consistente` em produção | prontidão (PR-007) — o silêncio atual É o critério funcionando |

## Níveis (derivados, não inventados)

**0 Silêncio** · **1 Informação** (E4.0/E4.1) · **2 Sugestão** (E4.2 — oferta
editável com fato registrado) · **3 Delegação** (Validado via Outcomes + dois
gatilhos 002 §7 + reversibilidade PR-010 — futuro).

## Contrato de Explainability

Por que apareceu? (match canônico do slot) · Por que agora? (o "agora" é do
operador — matching é pull; o sistema nunca escolhe o momento) · Quais
Decisions? (`decisoes_de_suporte`) · Por que confiar? (`explicarConfidence`) ·
**O que acontece se eu ignorar?** — hoje: nada é registrado; sob R-SE-1 com
ofertas registradas, ignorar torna-se Outcome *ignorada* derivável. A única
resposta do contrato que exigia o Engine.

## Constitution Check

Compatível com todos os artigos; duas exigências extraídas: a oferta deve
**assinar** (accountability do sistema — S-30) e ser **reconstruível**
(registro append-only). Ambas implementadas no E4.2.

## Reflection — o silêncio como inteligência

A guarda de delta cala capturas sem significado; a elegibilidade cala Decisions
que não ensinam; a disputa cala os dois concorrentes (o sistema prefere não
saber a saber errado); a Memória Contextual nem renderiza sem evidência; o
decay foi deferido por escrito por falta de base. O padrão é *Evidence over
Assumptions* aplicado à fala: **o valor de cada palavra da Zion é pago pelo
silêncio de todas as que ela se recusa a dizer.**
