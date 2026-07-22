# ADR-001 — Suggestion Memory

> **Status:** Aceito · **Data:** 2026-07-22 · **Capítulo:** II — Learning Platform
> **Origem:** PR-008 (Outcome Discovery) encontrou a inconsistência; PR-009 a resolveu.
> **Autoridade:** primeira ADR emitida sob a regra de governança do Architecture
> Freeze v1 (RFC-AIL-002 §14 / RFC-AIL-005: mudança conceitual exige ADR).

## Contexto

As RFCs congeladas afirmam simultaneamente:

- **RFC-AIL-002 §3.6:** o Outcome *"não é armazenado como entidade raiz — é
  **computado** da relação entre uma Suggestion e a **Decision seguinte**"*; §4: a
  Suggestion *"deixa de existir ao ser confirmada/contradita/ignorada"*; §10: é
  *"pontual e efêmera"*; §13 R3 proíbe armazenar Outcomes.
- **RFC-AIL-005 §4/§9:** a Confidence acima de Consistente é *"derivada de duas
  entradas determinísticas — `support` (Detector) e o **ledger de Outcomes**
  (Engine)"* — *"função pura, determinística"*.

## Problema

Um Outcome é função do par **(Suggestion, Decision seguinte)**. A Decision
persiste para sempre (Journal append-only, migração 022). Se a Suggestion evapora
sem rastro, a função perde um insumo: no instante em que se quiser **recomputar**
a Confidence — contrato de projeção pura que rege toda a AIL (RFC-AIL-004 §7.3;
`pattern-projection.ts`: "completamente reconstruível") — o ledger não pode
reproduzir Outcome algum. **Função pura de insumo destruído não é recomputável.**

A incompatibilidade só se sustenta sob a leitura *"efêmera = não deixa rastro"* —
leitura que a própria RFC-AIL-002 nunca sustentou: o §8 exige responder *"quais
Outcomes confirmaram?"* (histórico legível), o §7 acumula Outcomes ao longo do
tempo, e o princípio 11 diz "esquecer não é apagar". A evidência decisiva está no
código congelado desde R-DJ-1: `Decision.valorAnterior` é, por definição, *"o
valor que o sistema havia proposto"* (`decision.ts`) — o modelo sempre soube que a
proposta precisa ser lembrada.

## Alternativas consideradas

| | Alternativa | Veredito |
|---|---|---|
| A | Outcome vira entidade armazenada (computado uma vez e gravado) | **Rejeitada** — viola frontalmente 002 §3.6 + R3; congela erros de captura (feedback perdido se a gravação falhar); quebra o princípio de projeção |
| B | Suggestion vira entidade durável **mutável** (`oferecida→confirmada\|…`) | **Rejeitada** — primeiro registro não-append-only da AIL, sem necessidade |
| C | **Registrar o FATO da oferta (append-only); Outcome permanece projeção** | **Aceita** |
| D | Carona na Decision seguinte (`correlacao`/`metadados`) | **Rejeitada por evidência** — o Outcome *ignorada* nasce da **ausência** de Decision (002 §3.6: Outcome→Decision 1:0..1); não há onde pegar carona |

## Decisão

> **A Suggestion é efêmera como OFERTA — pontual, um único destino, nunca
> re-oferecida. O FATO de ter sido oferecida é histórico e imutável.**
>
> O Suggestion Engine, quando existir, registrará em **append-only** o fato mínimo
> da oferta (Pattern, slot, valor oferecido, entidade, instante, correlação). O
> **"ledger de Outcomes" da RFC-AIL-005 fica definido como PROJEÇÃO**:
>
> `Outcomes = f(registros de oferta × Decision Journal)`
>
> computada na leitura, jamais armazenada. Derivações: oferta + Decision seguinte
> com `valorNovo` = oferecido → **confirmada**; ≠ oferecido → **contradita**;
> sem Decision subsequente na janela → **ignorada**.

O Outcome permanece derivado (002 §3.6 **intacto e reafirmado**); a Confidence
permanece função pura de dois insumos imutáveis e recomputáveis; nenhuma entidade
nova é criada — a Suggestion (já canônica) ganha o rastro que toda entidade da
AIL sempre teve.

## Consequências

- O Engine nasce com o mesmo contrato arquitetural do Detector: insumos
  append-only → projeção pura → estado derivado. Nenhum padrão novo.
- "Esquecer não é apagar" passa a valer também para ofertas.
- A explicabilidade (002 §8) torna-se derivável de verdade, sempre auditável.

## Mudanças necessárias

1. Este ADR (o presente documento).
2. **Nota de leitura** (via ADR, sem editar RFCs — RFCs são documentos
   históricos): "efêmera" em 002 §4/§10 = vida da oferta; "ledger de Outcomes"
   em 005 §4/§9 = a projeção aqui definida.
3. SEEDS: S-25 (tensão ledger×efemeridade) marcada como germinada → resolvida.
4. BACKLOG E4: o registro de ofertas é pré-requisito declarado do Engine.

## Mudanças NÃO necessárias

Nenhuma tabela, serviço, evento ou código agora. Nenhuma alteração no Journal,
Detector, Patterns, Pattern Key, limiares, guarda de delta ou produtores.
Nenhuma reescrita de RFC. O Architecture Freeze v1 permanece integral.

## Plano de migração

Zero hoje (nada existe para migrar). Quando E4 iniciar: o desenho do registro de
ofertas (formato, retenção, RLS) será a primeira entrega do Engine, herdando este
ADR como especificação conceitual.

## Questões abertas (para o design do Engine)

1. **Confirmada × ignorada:** distinguir "manteve o valor sugerido" de "nunca
   engajou" pode exigir registrar a **aplicação** da oferta (a aceitação hoje
   morre na guarda de delta — descoberta do PR-007). Resolver sem afrouxar a
   guarda dos produtores atuais.
2. **A janela da *ignorada*:** exige política de recência — a mesma lacuna do
   Pattern Decay (RFC-AIL-004 §6.4, "EVIDÊNCIA INSUFICIENTE"). Ficam
   deliberadamente acopladas: uma futura política temporal resolve as duas.
3. **Dedup de ofertas:** o mesmo slot consultado N vezes na mesma sessão gera N
   registros ou um? (candidata: `correlacao`, hoje ociosa.)
