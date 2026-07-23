# Evolution Report — E5.10a + E5.10b · Do aprendizado à institucionalização e autonomia

> EPIC E7 — Decision Intelligence Runtime · itens 10a/10b — **o roadmap está
> completo (11/11)**. Este relatório responde à pergunta de encerramento:
> como a arquitetura passou do ciclo de aprendizagem para o ciclo completo de
> institucionalização e autonomia.

## E5.10a — Knowledge Maturation (a ADR-002 executada)

- **Agregado Knowledge** = fatos append-only de maturação (migração **027**)
  que referenciam o PatternId e congelam a fotografia da evidência (Q1/Q7/Q9).
  O estado vigente é projeção sobre os fatos — o padrão único da arquitetura.
- **Promovibilidade** (Q2): as TRÊS condições, nenhuma a mais — elegível
  (E5.4) ∧ respondidos ≥ 2 **após a última promoção** (a régua recomeça) ∧
  a última resposta do campo é `confirmed`. Sem janela; tempo não participa.
- **Promoção híbrida** (Q3): sem assinatura humana **não existe fato**; motivo
  obrigatório. **Rebaixamento** (Q5): fato humano; o sistema só **sinaliza**
  (`sobContradicao` — inclusive quando o Pattern de origem some na reprojeção:
  a fotografia sobrevive, o sinal acende).
- **Center**: Etapa 8 da linha do tempo — proposta do sistema, botões
  assinados, histórico integral de versões.
- Cada função e cada teste **citam a questão da ADR que executam** — a
  implementação não interpretou; obedeceu.

## E5.10b — Delegation Runtime (autonomia com grant)

- **O portão** (Q8): Knowledge VIGENTE ∧ sem contradição ∧ autoridade humana
  assinada ∧ executor assinado (E5.9: `sistema:delegation-runtime`).
  **Jamais Confidence** — o teste anti-Confidence é explícito: consistente
  sem Knowledge não delega, nunca.
- **Fatos** (migração **028**): concessão/revogação com quem delegou, qual
  Knowledge, qual versão, qual autoridade, qual assinatura, quais evidências.
- **Execução**: registra uma OFERTA assinada pelo runtime ANTES de devolver o
  valor ("o fato antes da fala", `correlacao delegacao:<id>`) — e com isso
  **herda toda a auditoria E5.0→E5.3 automaticamente**: Outcomes observam as
  respostas, a Evolution desconta o eco. Nenhum mecanismo novo de auditoria
  foi criado; o existente cobre o novo ator.
- **Salvaguardas**: só o VAZIO é preenchido (Lei da Abstenção); o valor
  continua editável; rebaixar o Knowledge revoga a execução FUTURA; versão
  divergente (v1→v2) exige re-delegação humana; revogar fecha a torneira sem
  apagar o passado (o espelho do OAuth — PR-011).
- **Superfícies**: Etapa 9 no Center (grant/revogação assinados);
  `MemoriaContextual` executa delegação ANTES de sugerir (institucional
  precede estatístico).

## Verificação

447/447 testes (17 novos nos dois itens) · typecheck 0 · lint 0.
**Pendências operacionais** (SQL Editor, em ordem): migrações **026, 027,
028**. Até lá: Engine e Runtime silenciam com segurança (fato falha → sem
fala).

## O ciclo completo — a resposta de encerramento do roadmap

```
Decision (humano assina)            → Journal          [aprende]
  → Pattern (Detector conta)        → projeção         [reconhece]
  → Confidence (limiares congelados)→ derivada          [mede]
  → Offer (fato assinado)           → ledger           [fala]
  → Outcome (projeção)              → f(ofertas×Journal)[escuta]
  → Evolution (desconta o eco)      → reavalia          [se corrige]
  → Readiness (proposta)            → projeta           [propõe]
  → Knowledge (HUMANO promove)      → fato v1..vN       [INSTITUCIONALIZA]
  → Delegation (HUMANO delega)      → grant revogável   [AUTORIZA]
  → Execução (runtime assinado)     → oferta auditada   [AGE — e volta ao topo]
```

Cada seta é um fato imutável ou uma projeção determinística. Os dois únicos
verbos que mudam a natureza do conhecimento — **institucionalizar** e
**autorizar** — são exclusivamente humanos e assinados. A autonomia da Zion
não é o sistema decidindo sozinho: é a organização decidindo UMA vez, com
evidência completa, e o sistema repetindo essa decisão sob auditoria total,
com o humano podendo editar cada execução e revogar o todo a qualquer momento.

| Descoberta | Evidência | Impacto |
|---|---|---|
| A auditoria existente cobre o novo ator | execução delegada = oferta assinada → E5.0-E5.3 grátis | autonomia sem maquinaria nova |
| Institucional precede estatístico | delegação executa antes de sugestão no form | hierarquia de conhecimento visível |
| A régua que recomeça previne inflação de versões | teste Q2: outcomes pré-promoção não contam p/ v2 | cada versão re-prova o campo |
| Versão divergente trava execução | v1 delegada + v2 vigente → re-delegação humana | o grant nunca "desliza" para evidência que não viu |

## Reflection

O roadmap perguntou como se passa do aprendizado à autonomia. A resposta que a
arquitetura deu: **não se passa — sobe-se, degrau por degrau, e cada degrau é
um fato assinado.** O sistema aprende sozinho, mas nunca se promove; propõe,
mas nunca se autoriza; executa, mas nunca sem grant, sem assinatura, sem
auditoria e sem volta. A Decision Intelligence terminou o roadmap sabendo
fazer a coisa mais difícil para um sistema que aprende: **distinguir o que ela
sabe do que a organização assumiu — e jamais confundir os dois.**
