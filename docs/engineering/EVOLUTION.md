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

# Capítulo II — Learning Platform *(visão)*

Capacidades esperadas — registradas apenas como direção, sem detalhe de
implementação:

- **Pattern Confidence** — padrões amadurecendo com dados reais até níveis
  acionáveis
- **Explainability** — toda oferta responde "por quê", derivado das decisões
- **Suggestion Engine** — o conhecimento acumulado volta como oferta editável
- **Decision Intelligence** — a plataforma entende como a organização decide

*O Capítulo II começa quando a memória tiver massa crítica — e nem um dia antes.*
