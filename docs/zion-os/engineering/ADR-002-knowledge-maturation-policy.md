# ADR-002 — Knowledge Maturation Policy

> **Status:** **ACEITO** (merge do mantenedor em 2026-07-23 — PR #23)
> **Data:** 2026-07-23 · **Capítulo:** III — Decision Intelligence
> **Autoridade:** segunda ADR sob o Architecture Freeze v1 (RFC-AIL-002 §14).
> **Instrução do mantenedor incorporada:** *"Não assuma que a melhor solução é
> promover um Pattern. Se Knowledge deve ser um agregado independente,
> documente e justifique. Priorize a consistência do modelo de domínio."*
> **Esta ADR não implementa código. Ela define a política que toda
> implementação futura apenas executará — nunca reinterpretará.**

---

## Contexto

O Runtime da Decision Intelligence está completo (E5.0–E5.8): o sistema
registra, detecta, mede, sugere, observa, distingue influência de evidência,
reavalia e explica. O que não existe é a **institucionalização**: um Pattern
nunca muda de natureza — apenas acumula evidências. As quatro lacunas que a
Promotion Readiness (E5.4) declarou como `DEPENDENCIAS_ADR_002` são decididas
aqui.

---

## Questão 1 — O que é conhecimento institucional?

### Decisão

> **Knowledge é um AGREGADO PRÓPRIO, independente do Pattern** — materializado
> por FATOS append-only de maturação (promoção/rebaixamento) que **referenciam**
> o Pattern (PatternId) e **congelam a fotografia da evidência no instante**.
> O estado vigente do Knowledge é uma **projeção** sobre esses fatos — o mesmo
> padrão arquitetural único de toda a plataforma (fatos imutáveis → projeção
> pura → estado derivado).

### Por que NÃO é "o Pattern promovido" (a leitura antiga da 002 §3.5)

A RFC-AIL-002 §3.5/§6 dizia "um Pattern validado É um Knowledge (promoção,
1:1)". Essa leitura antecede três descobertas que a tornam **insuficiente** —
a demonstração que a governança da 002 §14 exige:

1. **Patterns são projeções descartáveis.** A migração 023 declara a tabela
   `padroes` "descartável e reconstituível"; a E5.7 reprojeta por upsert e
   pode produzir **órfãos**. Se a promoção fosse um estado do Pattern, **uma
   reprojeção apagaria conhecimento institucional** — o inaceitável por
   definição. Estado institucional não pode morar em linha recomputável.
2. **Promoção é um ATO com autoridade** (Questão 3): exige assinatura humana,
   instante, motivo — um FATO, como a Oferta (ADR-001). Fatos não moram em
   projeções; moram em logs append-only.
3. **Versionamento exige história própria** (Questão 7). O Pattern não tem
   história além do suporte; o Knowledge precisa de v1 → v2 → … com cada
   versão imutável.

**Consistência do modelo preservada:** Knowledge continua sendo uma das
QUATRO entidades canônicas da 002 — esta ADR não cria uma quinta; ela dá à
quarta o substrato correto. O vínculo semântico "um Knowledge é DE um Pattern"
permanece (referência por PatternId); o que muda é a **cardinalidade**
(1 Pattern : N versões de Knowledge — refinamento exigido pelo versionamento,
que a 002 não abordava) e o **substrato** (fato próprio, não flag em projeção).

**O que um Knowledge NÃO é:** não é uma projeção (institucional não pode ser
recomputável para fora da existência); não é uma evolução in-place do Pattern
(morreria na reprojeção); não é apenas uma fotografia (tem ciclo de vida
próprio, via fatos subsequentes).

---

## Questão 2 — Quando um Pattern pode tornar-se Knowledge?

### Pré-condição estrutural (já implementada — E5.4, consumida sem alteração)

`PromotionReadiness.estruturalmenteElegivel = true`:
confidence no topo da contagem (`consistente`) ∧ slot sem disputa ∧
**sobrevive ao desconto de auto-reforço** (E5.3) ∧ já foi devolvido ao campo
(∃ Outcome).

### Critérios de campo (as 4 dependências, DECIDIDAS)

1. **Quantos Outcomes bastam:** `Outcomes respondidos ≥ 2` (confirmed +
   modified). O número **2** é deliberadamente o MESMO limiar canônico de
   recorrência da RFC-AIL-004 §4.3 — a recorrência de campo espelha a
   recorrência de decisão; nenhum número novo entra no sistema.
2. **O que conta como evidência de campo:** aqui se resolve a tensão com a
   E5.3, por ORTOGONALIDADE — são duas perguntas diferentes:
   - *"O padrão existe?"* → responde-se com **suporte independente** (E5.3:
     confirmed é influência e é descontado da CONTAGEM).
   - *"O padrão funciona quando devolvido?"* → responde-se com **Outcomes
     respondidos** — inclusive `confirmed`: o operador viu a sugestão COM
     explicação e concordou conscientemente. Para a métrica de campo (uso sob
     supervisão humana), a concordância é evidência; para a métrica de
     contagem, é eco. Nenhuma Decision é contada duas vezes na mesma métrica.
3. **"Confirmação sustentada" (002 §7), definida por ORDEM DE FATOS, sem
   janela:** o Outcome respondido **mais recente** do Pattern é `confirmed` —
   isto é, **a última palavra do campo foi concordância**; nenhum `modified`
   posterior ao último `confirmed`. Objetivo, auditável, determinístico.
4. **Tempo:** **não participa.** A maturação é por EVENTOS, nunca por
   calendário — a política de recência permanece deferida (004 §6.4), coerente
   com toda a plataforma (sem NOW, sem janelas).

> **Síntese — "promovível" ⟺** estruturalmente elegível (E5.4) ∧ respondidos
> ≥ 2 ∧ última resposta = confirmed. Três condições, todas projetáveis dos
> fatos existentes, todas explicáveis com ids.

### O que a escada congelada ganha (sem ser alterada)

Os níveis superiores da 002 §7 recebem, ENFIM, semântica operacional —
**derivada, nunca atribuída**:
- **Confiável** = Pattern *promovível* (as três condições acima — projeção).
- **Validado** = Pattern com Knowledge *vigente* (fato de promoção — Questão 3).
- **Automatizável** = Validado + permissão explícita (002 §7, intacto; E5.10).

---

## Questão 3 — Quem possui autoridade para promover?

### Decisão: **promoção HÍBRIDA — o sistema propõe, o humano promove.**

- O sistema **PROPÕE**: quando as condições da Questão 2 valem, o Pattern
  aparece como *promovível* (projeção — sem fato, sem efeito).
- O humano **PROMOVE**: ato explícito de um mantenedor, **assinado**
  (e-mail da sessão — E4.2.3), com motivo, gerando o fato imutável.

**Automática — rejeitada:** promoção habilita delegação (Questão 8); a cadeia
de autonomia precisa nascer de um grant humano — "toda autoridade é
emprestada, escopada e revogável" (PR-011). Uma promoção sem humano criaria
autoridade nativa do sistema, que a Constituição não admite.
**Humana pura (sem proposta do sistema) — rejeitada:** desperdiçaria a
Readiness e permitiria promover sem evidência ("a maturidade nasce dos fatos,
nunca da ausência deles") — o botão de promover só existe quando o sistema
propõe.
**É o invariante dos dois gatilhos (002 §7) aplicado um nível antes:**
evidência suficiente **E** ato humano — nunca um só.

---

## Questão 4 — O que muda após a promoção?

O Knowledge vigente (e somente ele):

1. **Pode ser citado como conhecimento institucional** — "esta empresa prefere
   X para Y, confirmado em campo" (a semântica que a 002 §3.5 sempre quis).
2. **Recebe versão** (v1, v2, …) e **história própria** (os fatos de maturação).
3. **Possui ciclo de vida**: vigente → rebaixado → (re)promovido.
4. **Torna-se o PRÉ-REQUISITO da Delegation** (E5.10) — a única porta.
5. **Aparece no DI Center** como camada distinta (institucional ≠ estatístico).

**O que deliberadamente NÃO muda:** o Pattern continua projeção viva e
continua contando; a elegibilidade de SUGESTÃO continua a da 005 §6.1
(`consistente` — sugerir nunca exigiu Knowledge; **delegar** exige); nenhuma
automação nasce da promoção por si.

---

## Questão 5 — O conhecimento pode ser rebaixado?

**Sim — por FATO de rebaixamento (append-only), jamais por deleção.**

- **O sistema SINALIZA, nunca rebaixa:** se o Pattern de origem deixa de
  sustentar os critérios (slot entra em disputa por suporte independente;
  confidence deixa de sobreviver ao desconto; um `modified` torna-se a última
  palavra do campo), o Knowledge vigente é marcado *"sob contradição"* —
  projeção, visível no Center, sem efeito institucional automático.
- **O humano REBAIXA:** ato assinado com motivo — o espelho exato da promoção.
  O "esquecimento" do cliente (002 §9) é um rebaixamento com motivo
  `esquecido_pelo_cliente`.
- **Auditabilidade:** a cadeia completa de fatos permanece (promoção v1 →
  rebaixamento → promoção v2 …); o estado vigente é projeção sobre ela.
  "Esquecer não é apagar" — agora também para o conhecimento institucional.
- **Efeito imediato:** rebaixar **revoga a delegação futura** (Questão 8) sem
  desfazer nada do passado — o espelho da revogação de canal (PR-011: fecha-se
  a torneira; a história fica).

---

## Questão 6 — Como continua aprendendo?

**Coexistem — obrigatoriamente.**

- O **Pattern** segue vivo: projeção recomputável, contando cada Decision
  nova, disputável, rebaixável pelo desconto — o organismo.
- O **Knowledge** é a sequência de fotografias institucionais ancoradas nele —
  o registro civil.

Substituir o Pattern pelo Knowledge mataria o aprendizado (a fotografia não
conta). Promover in-place mataria a instituição (a reprojeção apaga). A
separação de substratos (Questão 1) é o que permite os dois ao mesmo tempo — e
o aprendizado contínuo do Pattern é exatamente o que alimenta futuras versões.

---

## Questão 7 — Versionamento

**Cada promoção é uma VERSÃO IMUTÁVEL** — a fotografia congelada do instante
(confidence, suporte independente, outcomes considerados com ids, readiness
serializada), como a Oferta congela a base da sugestão (E4.2). Knowledge v2
nasce por **nova promoção** (mesmos critérios da Questão 2, novo instante,
nova fotografia, novo ato humano); v1 permanece na história para sempre.
**Vigente = a versão mais recente não-rebaixada** (projeção sobre os fatos).
Nada é editado; evolução = apêndice.

---

## Questão 8 — Relação com Authority / Delegation

> **Delegation jamais dependerá de Confidence. Dependerá de Knowledge
> promovido VIGENTE.**

Por quê: Confidence é a medida do sistema sobre si mesmo (derivada, automática);
Knowledge vigente é uma decisão da ORGANIZAÇÃO (fato assinado por humano).
Delegar sobre Confidence seria o sistema emprestando autoridade a si próprio —
a violação exata que o PR-011 tornou impensável. A cadeia legítima:

```
fato humano de promoção (grant institucional, assinado)
   → Knowledge vigente
      → Delegation (E5.10): escopo = o slot do Knowledge; +autoridade válida
        +reversibilidade +auditoria (fatos imutáveis)
         → rebaixamento revoga a delegação FUTURA (o passado permanece)
```

A E5.10 implementará exclusivamente esta cadeia.

---

## Questão 9 — Relação com Explainability

Toda promoção é integralmente reconstruível, porque o fato grava:

| Pergunta | Origem no fato |
|---|---|
| Quem promoveu? | autor humano (e-mail da sessão — E4.2.3/E5.8) |
| Por quê? | motivo declarado + as 3 condições citadas com ids |
| Quais evidências? | decisões independentes (ids) + fotografia da Readiness |
| Quais Outcomes? | outcomeIds considerados (respondidos, e qual foi o último) |
| Qual Confidence? | a congelada no instante (como `confidence_utilizada` da oferta) |
| Qual histórico? | a cadeia append-only de fatos de maturação (v1, v2, …) |
| Sob qual política? | a versão desta ADR, gravada no fato |

Nenhuma resposta é gerada; todas são projeção de fatos — o Artigo IV intacto.

---

## Questão 10 — Compatibilidade

Esta ADR **consome** Promotion Readiness, Confidence Evolution, Outcome
Projection e Analytics **sem alterar nenhuma responsabilidade**: a E5.4
continua respondendo prontidão estrutural (seu bloqueio permanente
`decisao_de_promocao_indefinida_adr_002` passa a resolver-se por ESTA política);
a E5.3 continua descontando eco da contagem; a E5.1 continua projetando
outcomes; a E5.5 poderá contar promovíveis/vigentes como mais uma leitura.
Nenhuma implementação existente é invalidada; nenhum limiar congelado muda.

**Implementação futura (fora desta ADR):** o fato de maturação (log
append-only `conhecimentos`, migração ≥026, id do domínio, RLS — o gêmeo
institucional de `ofertas`), a projeção de estado vigente, a superfície de
promoção no DI Center (botão só quando promovível; ato assinado) e o gate da
E5.10. Toda ela apenas executa esta política.

---

## Restrições respeitadas

Nada de Confidence/Readiness/Outcome/Analytics alterado; zero IA/ML; zero
heurística oculta (o único número novo é o reuso do limiar canônico 2, aqui
justificado); zero peso; toda promoção rastreável por construção.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Promoção virar ritual (carimbo sem leitura) | o botão exibe a fotografia completa antes do ato; o motivo é obrigatório |
| Knowledge órfão de Pattern (reprojeção muda canonicalização) | a fotografia é autossuficiente; o Center sinaliza "Pattern de origem ausente" — rebaixamento é decisão humana |
| Inflação de versões | cada versão exige o ciclo completo de campo novamente (respondidos ≥2 pós-última promoção — a régua recomeça) |

---

## Reflection

Um Pattern é o que o sistema percebe; um Knowledge é o que a organização
assume. Entre os dois existe exatamente um fato: **um humano, diante de toda a
evidência, assinou**. Esta ADR faz da fronteira entre aprender e
institucionalizar aquilo que toda fronteira da Zion já era — um ato com
autoridade, escopo, rastro e volta.
