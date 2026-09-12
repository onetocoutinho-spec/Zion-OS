# EXP-005 — Consulta → refinamento → proposta de ação sobre peso

## Status

```
Status:                    Concluído — hipótese CONFIRMADA (Rodada 1)
Owner:                     Zion OS
Experiment:                EXP-005
Depende de:                EXP-004 (consulta em linguagem natural)
Provedor:                  Gemini (o já configurado)
Rodadas:                   1 — aprovada; R2 não foi necessária
Encerrado em:              2026-07-28
Mutação executada:         NENHUMA
```

> Protocolo aprovado e congelado **antes** da execução, e preservado abaixo sem
> reescrita retroativa. O harness (`experiments/EXP-005/`), a `materializacaoCorrente`
> e a forma da proposta são **instrumento**, não arquitetura de produção. Este
> resultado **não autoriza** implementar chat, UI, confirmação ou execução.

---

## 1. Pergunta falsificável

> Uma sequência de turnos pode produzir uma **proposta determinística** cujo alvo é
> exatamente o conjunto de **variações sem peso** que o operador acompanhou — sem que o
> modelo nomeie registros, sem incluir variação que já tem peso, e **recusando propor
> quando a intenção de refinamento não foi resolvida**?

## 2. Autoridades

| | pode | nunca pode |
|---|---|---|
| **Modelo** | ler linguagem · sinalizar referência ao anterior · sinalizar restrição · extrair valor e unidade | emitir id · emitir contagem · consultar dados · escolher conjunto |
| **Zion** | resolver · materializar variações · restringir sobre o anterior · contar · **decidir acionabilidade** · propor ou recusar | aceitar id do modelo · aplicar restrição não representada · promover seleção a regra · gravar |
| **Humano** | selecionar/desmarcar · confirmar (fora deste experimento) | — |

## 3. Estado mínimo

```
materializacaoCorrente { id · origem · criterio · produtoIds · varianteIdsSemPeso
                         contagens · fronteira[] · acionavel · timestamp }
```

**Uma variável, substituída a cada turno.** Sem pilha, sem histórico, sem "última
acionável" — e essa ausência é deliberada: guardar a última acionável é exatamente o
que produziria retrocesso silencioso (I12).

## 4. Invariantes

| # | invariante | resultado |
|---|---|---|
| I1 | o modelo nunca emite id | **16/16** |
| I2 | **o alvo contém zero variações com `peso > 0`** | **4/4** |
| I3 | "esses" resolve à materialização corrente, exata | provado por identidade em S2 |
| I4 | refinamento estreita o anterior; nunca reconsulta o catálogo | **2/2** |
| I5 | restrição não representada nunca estreita o alvo | provado em S2/S4 |
| I6 | conjunto vazio → nenhuma proposta | S5 |
| I7 | unidade no nome do campo (`pesoGramas`) | contrato |
| I8 | proposta imutável e identificada | `prop-M{n}` |
| I9 | **nenhuma escrita** — zero imports de mutação no harness | verificado |
| I10 | **fronteira pendente torna a materialização não acionável** | **3/3** |
| I11 | **seleção manual cria materialização acionável e NÃO vira regra** | **1/1** |
| I12 | **recusa por I10 nunca recai na materialização anterior acionável** | **2/2** |

> **Redação (ajuste aprovado antes da execução):** fronteira pendente e conjunto vazio
> são as **condições de não acionabilidade conhecidas e testadas nesta fatia**. Não
> constituem definição universal nem bicondicional de acionabilidade.

## 5. Execução — 7 sequências, 16 turnos de modelo

| | consulta | refinamento | acionável | desfecho |
|---|---|---|---|---|
| S1 | M1 6/80 | M2 5/78 (`tênis`) | ✅ | **proposta** 78 var |
| S2 | M3 5/64 | M4 5/64 fronteira | ❌ → ✅ M5 | **recusa** → **proposta** 41 var |
| S3 | M6 1/3 | — | ✅ | **proposta** 3 var |
| S4 | M7 5/78 fronteira `chinelo` | — | ❌ | **recusa** |
| S5 | M8 0/0 | — | ❌ | **recusa** (vazio) |
| S6 | M9 5/64 | — | ✅ | **proposta** 64 var |
| S7 | M10 19/223 | — | ✅ | nenhuma ação pedida |

### Erro de contagem documental — registrado, protocolo não reescrito

O protocolo congelado afirma *"Só três sequências geram proposta"* e fixa **N1 = 3/3**.
**A contagem estava errada: são quatro.** S2 contém uma **recusa** e, após a seleção
manual, uma **nova materialização acionável que gera proposta**. O instrumento mediu o
que de fato ocorreu — **I2 = 4/4**.

É erro de redação do protocolo, não divergência entre previsto e observado: as sete
sequências se comportaram exatamente como desenhadas. O texto congelado permanece como
foi aprovado.

## 6. Evidências centrais

### S2 — I10, I11 e I12 por identidade de materialização

| turno | transição | fronteira | acionável |
|---|---|---|---|
| "produtos sem peso da Havaianas" | — → **M3** | — | **true** · 5/64 |
| "Só os masculinos." | M3 → **M4** | `[masculino]` | **false** |
| "Coloca 320g nesses." | ação sobre **M4** | | **RECUSADA** |
| *[seleção manual]* | M4 → **M5** | — | **true** · 3/41 |
| "Coloca 320g nesses." | ação sobre **M5** | | **PROPOSTA** |

> `PROPOSTA RECUSADA: a intenção de refinamento "masculino" não foi resolvida`

**I12** está provado pela identidade: a ação apontou para **M4**, não para **M3** —
que estava acionável e imediatamente atrás. **I11**: M5 nasceu acionável da seleção
humana e `masculino` **continuou não representado**; a seleção produziu um conjunto,
não conhecimento.

### S3 — I2 no caso extremo, 3 de 39

```
alvo:      3 varianteId(s) — 6672e4fa, 4416307d, 392b593f
contagens: 1 produto · 3 variações · 0 já preenchidas
excluidos: 36 variações que JÁ têm peso — dd7e461e, eda7a6f6, 6a3b7be7, e5cebefc, …
   · Rasteira Feminina Vizzano 6371.1005: alvo 3 de 39, preservadas 36
```

### S6 — I2 no parcial Havaianas, 9 de 18

```
excluidos: 9 variações que JÁ têm peso — d318fb8d, 374706cd, 9906fe62, e7f9673b, …
   · Chinelo Havaianas Masculino Top Max Comfort Original: alvo 9 de 18, preservadas 9
```

O produto entra na proposta **pela metade** — não inteiro, não fora.

## 7. Observação sem efeito

Em **S4** o modelo devolveu `relacao: "cumulativa"` onde `alternativa` seria a leitura
natural de "tênis e chinelos". **Não alterou nenhum resultado**: com uma única regra
declarada o resolvedor não consulta `relacao`. Registrado como observação, **não como
correção** — nada foi ajustado.

## 8. Teto da conclusão

> Consulta → refinamento → proposta determinística funciona com **uma variável de
> estado**; o alvo é exatamente as variações sem peso; as já preenchidas aparecem
> nomeadas em `excluidos`; e **fronteira não resolvida bloqueia a ação sem recair no
> conjunto anterior**.

**NÃO prova** nada sobre confirmação, execução, TOCTOU, outra dimensão que não peso,
outro cliente, outro catálogo, nem que se deva construir chat. As sequências vieram de
**um** operador.

## 9. Evidência preservada

```
experiments/EXP-005/
  variantes.json     19 produtos com sem>0, ids de variação, invariantes assertadas
  instrumento.mts    zero imports de escrita
  rodada-1.txt       execução íntegra
```

Gate: `tsc` 0 · `eslint` 0 erros · 878/878 testes · nenhuma linha de `src/` alterada.
