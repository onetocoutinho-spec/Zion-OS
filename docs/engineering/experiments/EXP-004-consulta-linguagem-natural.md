# EXP-004 — Consulta em linguagem natural sobre estado de peso

## Status

```
Status:                    Concluído — hipótese CONFIRMADA (Rodada 3)
Owner:                     Zion OS
Experiment:                EXP-004
Provedor:                  Gemini (o já configurado; nenhum adaptador novo)
Rodadas:                   3 (R1 reprovada · R2 reprovada · R3 aprovada)
Encerrado em:              2026-07-28
```

> Desenho aprovado **antes** da execução. R1, R2 e R3 preservadas integralmente como
> evidência. Não houve R4 — a regra de parada foi acordada antes de R3.
>
> O harness (`experiments/EXP-004/`) é **instrumento**, não arquitetura de produção.
> Nada dele deve migrar para `src/` sem uma decisão de produto própria.

---

## 1. Pergunta falsificável

> Uma frase natural do operador pode ser decomposta em **restrições que o Zion sabe
> provar** e **restrições que ele não sabe provar**, respondendo deterministicamente à
> parte conhecida e tornando a fronteira explícita — sem inventar classificação e sem
> converter ausência de evidência cadastral em ausência de produto?

## 2. Arquitetura testada

```
frase → PROPOSE (modelo: só critério) → validação → classificação determinística
      → RESOLVE determinístico → desfecho → resposta factual
```

O modelo recebeu **a frase e a enumeração de 12 marcas**. Nunca o catálogo, ids,
contagens, oráculo ou respostas esperadas. **Zero mutação.**

## 3. Os quatro desfechos

| # | desfecho | comportamento correto |
|---|---|---|
| 1 | conhecido e encontrado | resposta factual com contagens |
| 2 | conhecido e vazio | "nenhum" — factual, **sem pergunta** |
| 3 | critério inválido | esclarecer, **nunca aproximar** marca |
| 4 | restrição não representada | resolve o conhecido · declara a fronteira · separa não classificados |

**Precedência:** desfecho 2 precede o 4. Universo vazio dispensa declarar fronteira.

## 4. Baseline (recapturado antes de cada rodada, sem delta)

73 produtos · 684 variações · 12 marcas · 223 variações sem peso em 19 produtos.

| situação | condição | quantidade |
|---|---|---|
| completo | `sem = 0`, `total > 0` | 51 |
| ausência total | `sem = total > 0` | 17 |
| **ausência parcial** | `0 < sem < total` | **2** |
| **sem grade** | `total = 0` | **3** |

`sem grade` **nunca** equivale a `sem peso`.

## 5. Regras declaradas pelo operador (escopo global, congeladas)

| regra | forma | efeito |
|---|---|---|
| `ortopéd` | normalizada sem acento | 5 produtos / 67 variações |
| `tênis\|tenis` | normalizada sem acento | conforme universo |

Literal com acento casaria 4 / 47 — o `Chinelo Ortopedico Modare Feminino Esporao`
não tem acento. A normalização segue `familiaDeProduto.semAcento`.

**Não são ontologia do Zion.** São regras que o operador declarou para este
experimento. Conceito novo vira conhecimento por **declaração humana**, nunca por
inferência do modelo.

Genéricos (enumeração fechada, descartados no Zion): `produto · produtos · item · itens`.

## 6. Resultados

| métrica | R1 | R2 | **R3** | limiar |
|---|---|---|---|---|
| M1 extração estrutural | 13/13 | 13/13 | **13/13** | 13/13 |
| M2 restrição real extraída | 5/5 | 3/5 | **5/5** | 5/5 |
| M3 universo E comprovável | 12/13 | 12/13 | **13/13** | 13/13 |
| M4 honestidade da fronteira | 2/3 | 2/3 | **3/3** | 3/3 |
| M5 declarado filtra de fato | 2/2 | 1/2 | **2/2** | 2/2 |
| M6 vazio como fato | 2/2 | 2/2 | **2/2** | 2/2 |
| M7 marca inválida não aproxima | 1/1 | 1/1 | **1/1** | 1/1 |

Consistência entre eixos (R3): nenhuma duplicação. Nenhum limiar foi reduzido,
nenhum caso removido, nenhuma frase alterada, provedor inalterado.

### Por que R1 e R2 falharam

| rodada | instrução de extração | falha |
|---|---|---|
| R1 | *"TODO tipo ou adjetivo de produto citado"* | trouxe `produto` como qualificador → fronteira falsa em F2 e F9 |
| R2 | *"termos que reduzem… não inclua o genérico"* | **perdeu** `chinelo` (F3) e `tênis` (F9b) — entendeu e não extraiu |
| R3 | *"as palavras que dizem que tipo de coisa ou que característica… não julgue, não omita"* | — |

**A lição da série:** numa arquitetura em que o Zion classifica, **recall é do modelo
e precisão é do código**. Termo a mais é descartado deterministicamente; termo a menos
é irrecuperável. O próprio *nome do campo* participava da causa — `restricoes` pergunta
"isto restringe?", que é o julgamento que a arquitetura tirou do modelo.

**O resolvedor acertou 39 de 39** nas três rodadas com o critério que recebeu.

## 7. Conclusão — teto congelado

> Frase → extração linguística → classificação determinística → resolução
> determinística produz **fato comprovável mais fronteira explícita** para consultas
> de estado de peso **neste catálogo**.

**NÃO prova** que se deva construir um chat. Nada sobre mutação, custo, importação,
anúncio ou publicação. Nada sobre outro cliente, catálogo ou segmento. Vale para
**este contrato e este provedor**.

**Limitação declarada:** as 13 frases são amostra de **um** operador. A capacidade está
demonstrada; a generalização para outras pessoas não foi testada.

## 8. Evidência preservada

```
experiments/EXP-004/
  catalogo.json        fixture do banco real, invariantes assertadas
  instrumento.mts      R1        rodada-1.txt
  instrumento-r2.mts   R2        rodada-2.txt
  instrumento-r3.mts   R3        rodada-3.txt
```

Nenhuma linha de `src/` foi alterada em nenhuma rodada. Gate a cada rodada:
`tsc` 0 · `eslint` 0 erros · 878/878 testes.

## 9. Achado colateral

A leitura por variação enxergou o **estado parcial que a UI atual esconde** —
Vizzano Rasteira 3 de 39, Havaianas Top Max Comfort 9 de 18. Registrado como
incidente separado: `docs/engineering/incidents/INC-001-peso-parcial-invisivel.md`.
