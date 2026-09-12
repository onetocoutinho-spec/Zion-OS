# INC-010 — A leitura pelo nome devolve valores que o Mercado Livre não aceita

```
Status:      Aberto — registrado, TORNADO VISÍVEL, não corrigido
Detectado:   2026-08-25, durante o T3 do plano (tasks/plan.md)
Severidade:  publicação recusada pelo ML sem causa legível para a lojista
Correção:    não feita de propósito — precisa de medição nas categorias reais
```

## O defeito

`/categories/MLB273770/attributes`, medido em 25/08/2026, declara `FOOTWEAR_TYPE`
como `value_type: "list"` — lista **fechada** — com quatro valores, no singular:

```
517585   Sandália
517586   Chinelo
3630523  Tamanco
3630524  Mule
```

`tipoDeCalcadoDoNome`, em
[atributosDoMarketplace.ts](../../../src/modules/publication/domain/atributosDoMarketplace.ts),
devolve dez valores, no **plural**:

```
Chinelos · Sandálias · Tamancos · Papetes · Rasteiras
Babuches · Tênis · Sapatilhas · Botas · Meias
```

Nenhum dos dez é valor aceito nesta categoria. Três erram só no número
("Chinelos" por "Chinelo"); os outros sete não existem na lista.

`GENDER` tem o mesmo problema em um caso: a regra `/\bmenin[ao]s\b/` devolve
**"Meninas e Meninos"**, e a lista do ML tem "Meninas" e "Meninos" separados —
o valor composto não está lá.

## Por que ninguém viu

O valor era dado como **resolvido**. `AtributoResolvido` tinha dois desfechos —
tem valor ou não tem —, e "Chinelos" tem valor. A recusa só aparecia na
publicação, vinda do ML, sem ninguém ligar uma coisa à outra.

Era invisível também porque a lista de valores aceitos **era descartada na
leitura**: `atributosObrigatorios` guardava `{id, nome}` e jogava fora `values`.
Não havia contra o que comparar.

## O que mudou em 25/08

Nada no comportamento. O que mudou é que a divergência **para de ser muda**:

- `exigenciasDaResposta` preserva `values`, `value_type`, `hint` e
  `value_max_length`;
- `OBRIGATORIOS_CALCADO` carrega os valores medidos dos dois atributos `list`;
- `valorForaDaLista` aponta valor fora de lista fechada;
- `briefingDosAtributos` escreve **"VALOR NÃO ACEITO nesta categoria"** e
  enumera os aceitos, em vez de dizer "já resolvido".

## Por que a correção não foi feita junto

Trocar `TIPOS` e `GENEROS` pelos valores do ML é uma decisão que vale **por
categoria**, e este retrato é de uma só. A conta tem produtos em outras
categorias, e nelas os valores aceitos são outros — inclusive podem ser
plurais. Corrigir com base em uma categoria seria repetir o erro que o
de-calçar de 05/08 arrancou daqui: a suposição de calçado morando escondida.

A medição que fecha isto é o **CHECKPOINT 2** de [tasks/plan.md](../../../tasks/plan.md):
rodar o endpoint contra as categorias reais da conta e ver quantos obrigatórios
trazem lista fechada, e quais valores.

## O que NÃO é este defeito

Valor com `origem: "marketplace"` **não** é apontado, e isso é doutrina do
módulo desde o D6: o que veio de `produto_atributos` é o que a própria lojista
informou ao ML, e quem sabe em que categoria o item dela está é ele, não este
retrato. Um teste de 2026 guarda essa regra — e reprovou a primeira versão de
`valorForaDaLista`, que não a respeitava.
