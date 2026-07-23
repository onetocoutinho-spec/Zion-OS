# EVOLUTION — A Evolução da Plataforma Zion

> **A narrativa oficial da evolução arquitetural da Zion.** Este documento não
> descreve implementações — descreve **capacidades permanentes** adquiridas pela
> plataforma. A evolução é organizada por **capítulos**: cada capítulo representa
> um aumento permanente de capacidade. Os PRs são apenas os passos; o resultado é
> a capability adquirida. Regra: só entra aqui o que está **realmente
> implementado e validado** — visão nunca vira realidade por escrito.

---

# Capítulo I — Platform Foundation *(2026-07-22)*

Quatro passos transformaram um sistema funcional em uma **plataforma com
fundação**: verificável, segura, com memória operacional e com memória
organizacional.

| PR | Capability | Pilar | Resultado Permanente |
|---|---|---|---|
| **PR-001** | **Engineering Verification** | Exoesqueleto | A plataforma tornou-se **verificável**: todo push passa por typecheck + 300+ testes, automaticamente. |
| **PR-002** | **Multi-tenant Security** | Exoesqueleto | A plataforma tornou-se **segura por padrão**: nenhum acesso implícito — sem perfil = sem acesso; cada empresa vê só o que é seu. |
| **PR-003** | **Operational Memory** | Exoesqueleto | O estado estrutural do banco tornou-se **observável**: o banco sabe o que recebeu (Migration Ledger) e o drift é detectável por uma consulta. |
| **PR-004** | **Organizational Memory** | Organismo | Decisões humanas relevantes passaram a ser **preservadas**: 5 Signal Sources capturam categoria, preço, medida, tipo de anúncio e pendências resolvidas. |

## Linha do tempo

```
Engineering Verification        (a plataforma se verifica)
        ↓
Multi-tenant Security           (a plataforma se protege)
        ↓
Operational Memory              (o banco se conhece)
        ↓
Organizational Memory           (a plataforma aprende com quem a usa)
```

Há uma progressão deliberada: primeiro o **exoesqueleto** (verificação, proteção,
observabilidade) — só então o **organismo** começou a ganhar memória. *Memória
sem fundação seria memória em terreno instável.*

## Princípios descobertos (comprovados pela implementação)

1. **Discover before Create** — arquitetura emerge da descoberta. As sementes já
   existiam no código (o guardrail de staging era um ledger embrionário; o funil
   de correções já era um signal pipeline); descobrimos antes de criar.
2. **Evidence over Assumptions** — o backlog muda quando a evidência muda. A
   auditoria errou duas vezes (branch de segurança, operation-center); os "9
   erros de lint" nunca estiveram no nosso código; a ordem da AIL foi invertida
   por evidência (Producers antes de Suggestion Engine).
3. **Significant Capture** — nem toda alteração merece memória. Dos ~26 serviços
   de escrita, apenas 4 agregados carregam decisões humanas; o resto é atividade.
4. **Organizational Memory First** — memória precede inteligência. Um motor de
   sugestões sem memória suficiente apenas automatizaria o vazio.
5. **Knowledge Emerges from Decisions** — conhecimento organizacional emerge da
   repetição de decisões humanas: `proposta do sistema → escolha humana`,
   contada deterministicamente, vira padrão.

## Capacidades adquiridas

### Exoesqueleto
- CI (GitHub Actions, Node 22) · Testes (310+) · Typecheck
- Segurança multi-tenant (deny-by-default, validada em produção)
- Migration Ledger (migração 024 — memória operacional do banco)
- Diagnóstico de Drift (detector permanente, ledger × objetos reais)
- Governança: regra dos 3 artefatos · regra de remoção (5 perguntas) ·
  migração-como-release · Seeds Register

### Organismo
- Decision Journal (persistente, append-only, DecisionId do domínio)
- Pattern Detection (núcleo puro, determinístico, confluente, idempotente)
- Signal Sources (5 ativas em 3 Bounded Contexts; Natural Aggregates: Produto,
  Marketplace, Pendências + Curadoria identificado)
- Organizational Memory (captura com delta real, fire-and-forget, fronteira
  única `capturarDecisao`)

## Estado atual

**O que a Zion já sabe fazer:** verificar-se a cada push · proteger cada tenant
por padrão · saber o que seu banco recebeu e detectar drift · capturar decisões
humanas de 5 fontes sem tocar o fluxo de negócio · detectar padrões de forma
determinística e explicável · materializar padrões idempotentemente.

**O que ainda está aprendendo:** a memória organizacional está **acumulando** —
os primeiros Patterns reais existem (nível *observado*) e amadurecem à medida
que decisões diárias chegam pelas novas fontes.

**O que ainda não existe:** sugestões devolvidas aos usuários · explicabilidade
exposta · Knowledge Repository · Decision Intelligence · Capabilities ·
Workspace Intelligence · IA invisível. *(Por decisão, não por atraso: memória
primeiro.)*

---

# Capítulo II — Learning Platform *(2026-07-22)*

O capítulo em que a plataforma **fechou o primeiro ciclo de aprendizado com o
mundo externo** — e, ao investigar a própria confiança, encontrou e corrigiu a
primeira inconsistência da arquitetura congelada.

| PR | Capability | Natureza | Resultado Permanente |
|---|---|---|---|
| **PR-006** | **Closed Learning Loop** | implementada e validada | O ambiente propõe (`categoriaPrevista`) → o humano decide → a memória captura; o ambiente veta → o motivo real persiste no domínio. Dois feedbacks que evaporavam agora ensinam. |
| **PR-007** | **Pattern Confidence (mapa real)** | conhecimento institucionalizado | O lifecycle verdadeiro dos Patterns (nunca morrem; única força descendente é a disputa); a tipologia dos domínios de valores (contagem exige domínio fechado); confirmação descartada na porta; reversão invisível por teorema. Critério de prontidão do Engine: ≥1 Pattern `consistente`. |
| **PR-008** | **Outcome Model** | conhecimento institucionalizado | "Outcome" são 3 conceitos; 4 produtores de veredito (ambiente, sistema, humano, mercado); o ciclo de feedback já roda com humano no meio; a venda é o único veredito de sucesso — e evapora. |
| **PR-009** | **ADR-001 — Suggestion Memory** | decisão arquitetural | Primeira ADR sob o Freeze: a oferta é efêmera, o fato dela é histórico; o "ledger de Outcomes" é projeção. O Freeze foi testado e funcionou. |

**Princípio consolidado no capítulo:** *Preserve Facts, Derive Knowledge* — todo
subsistema que aprende segue o mesmo padrão: fatos append-only → projeção pura →
estado derivado.

---

# Capítulo III — Decision Intelligence *(em curso, 2026-07-22)*

A pergunta central mudou de "o que a Zion aprende?" para **"quando a Zion pode
agir sozinha?"**. Dois ciclos de descoberta e uma revisão estrutural:

| PR | Capability | Natureza | Resultado Permanente |
|---|---|---|---|
| **PR-010** | **Delegation Map** | conhecimento institucionalizado | Os 6 níveis de delegação já existem dispersos no código; a **Lei da Abstenção** (o sistema só decide no vazio); os 5 saberes da delegação; a fronteira dura: o irreversível não sobe de nível. |
| **PR-011** | **Authority Map** | conhecimento institucionalizado | Toda autoridade do sistema é emprestada, escopada e revogável; o OAuth é um protocolo completo de transferência; a revogação é destrutiva e não desfaz o passado; **as Decisions são anônimas** e o sistema não assina — a única lacuna constitucional aberta (Accountability). |
| **AR-001** | **Constitution Consolidation** | revisão estrutural | 12 invariantes extraídos; um padrão arquitetural único; estrutura da Zion Constitution proposta (10 artigos); maturidade por domínio; veredito: consistente, evolui sem mudança estrutural. |
| **CR-001** | **Knowledge Institutionalization** | consolidação | Cinco ciclos de descoberta transformados em memória permanente (este lote). |
| **E4.2.3** | **Decision Authorship** | implementada e validada | Toda Decision capturada assina seu autor (e-mail da sessão; "" em demo). Primeiro passo do Artigo VIII (Accountability); Journal antigo intocado — append-only é também honestidade histórica. |
| **E4.0** | **Pattern Browser** | implementada e validada | O conhecimento organizacional tornou-se **observável**: memória por slot + cadeia de explicabilidade completa (confiança com o porquê, evidências com autor, divergências). Nível 1 da régua — o sistema explica; nunca aprende, nunca decide. |
| **E4.1** | **Contextual Pattern Matching** | implementada e validada | A memória aparece **onde a decisão acontece**: matching por igualdade canônica de slot (nunca similaridade, nunca score), silencioso sem evidência, sem botão de aplicar — sugestão é evidência, nunca comando. Fronteira do R-SE-1 preservada (sem oferta → ADR-001 não acionada). |
| **PD-001** | **Suggestion Eligibility** | conhecimento institucionalizado | O critério objetivo silêncio/informar/sugerir — zero números inventados, todas as condições citáveis por documento congelado. O silêncio é a primeira inteligência. |
| **E4.2** | **Suggestion Engine (R-SE-1)** | implementada e validada | A primeira capability ATIVA: oferta editável com **o fato antes da fala** — registro append-only (migração 025), base congelada no instante, **assinada pelo sistema** (metade da S-30). Só o vazio é pré-preenchido; a decisão continua humana. Em produção nasce em silêncio: 0 Patterns `consistente` — o critério funcionando. |
| **E5.0** | **Offer Observation** | implementada e validada | O que aconteceu depois de cada oferta — 3 classes de evidência sobre `ofertas × decisoes`, limites declarados (remoção sem fato; criação sem captura; sem janela). Zero escrita, zero recomputação. |
| **E5.1** | **Outcome Projection** | implementada e validada | **Outcome não é fato — é projeção** `f(ofertas × Journal)`: pending/confirmed/modified, determinística (sem relógio), idempotente, jamais persistida; a regra do auto-reforço nasce embutida (confirmed nunca é evidência independente). O primeiro ciclo completo de feedback da Decision Intelligence. |
| **E5.2** | **Outcome Explainability** | implementada e validada | A cadeia de evidências visível e serializável: Offer→Observation→Outcome em 3 elos, origem/resposta/comparação, nota oficial de auto-reforço. **Explicar não é interpretar** — se a função precisa de algo além dos fatos de entrada, ela está interpretando. |
| **E5.3** | **Confidence Evolution** | implementada e validada | A confiança auditada contra o próprio eco: `confidenceDe(suporte independente)` — as funções congeladas sobre a evidência que **existiria mesmo sem sugestão alguma**. Desconto rastreável, elevação bloqueada e declarada (limiar de `confiável` = ADR futura). **O conhecimento não pode aprender consigo mesmo.** |
| **E5.4** | **Promotion Readiness** | implementada e validada | Pronto para promover, **sem promover**: 4 perguntas binárias (topo da contagem, sem disputa, sobrevive ao eco, testado em campo) + bloqueio permanente até a ADR-002. A fronteira engenharia/governança ficou enumerável: as 4 perguntas respondíveis viraram código; as 4 irrespondíveis viraram o escopo exato da ADR-002. |
| **E5.5** | **Intelligence Analytics** | implementada e validada | A plataforma mensurável **sem nota**: fatos e bloqueios nomeados no lugar de scores; metodologia obrigatória em toda métrica; o maior bloqueio exibido sem constrangimento (ADR-002 — governança). Inaugura a camada operacional. |
| **E5.6** | **Decision Intelligence Center** | implementada e validada | A primeira interface operacional: Health + Patterns (atual→projetada, prontidão) + **linha do tempo lógica em 7 etapas** do fato ao veredito, cada etapa com origem. **A transparência não é recurso da interface — é propriedade da arquitetura.** |
| **E5.7** | **Reprojection Runtime** | implementada e validada | O script morreu; o botão audita: reprojeção oficial (completa/parcial) com diffs, órfãos listados-jamais-apagados e **idempotência verificada a cada execução** (núcleo 2× → idêntico). A confluência virou prova viva em produção. |
| **E5.8** | **Typed Author** | implementada e validada | O `Autor` da fundação acorda **como conceito, não como código**: VO de leitura com parse determinístico sobre as strings já gravadas — zero migração, suíte inteira sem mudança de expectativa. **Colher ≠ ressuscitar.** |
| **ADR-002** | **Knowledge Maturation Policy** | decisão arquitetural (ACEITA) | **Knowledge é agregado próprio** — a leitura "Pattern promovido" demonstrada insuficiente (projeções são descartáveis; promoção é ato com autoridade; versões exigem história). Promovível = elegível ∧ respondidos ≥2 ∧ última resposta = confirmed; promoção híbrida (sistema propõe, **humano assina**); Delegation dependerá de Knowledge vigente, jamais de Confidence. *Um Pattern é o que o sistema percebe; um Knowledge é o que a organização assume.* |

**O que destrava o próximo passo:** o Suggestion Engine (E4) tem pré-requisitos
declarados — ADR-001 (registro da oferta), ≥1 Pattern `consistente` em produção,
e a Lei da Abstenção como contrato de comportamento.
