# AUD-002 — Pulso, Relatórios e Ajuda

```
Data:   2026-08-03
Régua:  cada número é FATO MEDIDO, PALAVRA DO MARKETPLACE ou SUPOSIÇÃO NOSSA?
Escopo: as três telas que a AUD-001 deixou de fora
```

A AUD-001 cobriu as telas que produzem número de decisão e declarou explicitamente
que Pulso, Relatórios e Ajuda ficariam para uma segunda passada. Esta é ela.

**O padrão se repetiu — e uma das repetições era a mesma palavra que a AUD-001
tinha acabado de corrigir em outra tela.**

---

## 1. Relatórios — "Anúncios otimizados", de novo

```ts
const otimizados = ans.filter(
  (a) => a.status === "aprovado" || a.status === "publicado"
).length;
```

Linha por linha, o mesmo defeito fechado horas antes em Meus Produtos: **791
anúncios contariam como "otimizados" com ZERO avaliados pela IA**, porque todo
importado do Mercado Livre nasce `publicado`.

Ele sobreviveu à primeira correção por um motivo que vale mais que o defeito:
**a regra estava escrita duas vezes, em dois arquivos.** Consertar um não
consertava o outro, e nada apontava que existia um segundo.

**Conserto:** as duas telas passam a chamar `estadoDeOtimizacao`, a mesma
função pura com testes. E Relatórios ganha o card que faltava — **"No ar, sem
otimização"** —, porque o número que interessa é o trabalho que falta, não o
que já está no ar.

**De quebra:** a tela lia `listarAnunciosGeradosDoCliente`, trazendo o JSONB da
esteira que é **76,6% do peso da linha** e que ela nunca abre. Passou para a
leitura estreita.

---

## 2. Vendas — o lucro está superestimado por construção

```ts
const lucroLiquido = faturamento - taxas - custo;
```

`custo` só soma os itens **cujo custo existe na base**. Item vendido sem custo
cadastrado entra no faturamento e **não entra no custo** — então cobertura
abaixo de 100% produz lucro **superestimado**, nunca subestimado.

Medido em 03/08/2026: **30 de 80 produtos** têm custo (37,5%); em variantes,
**157 de 970** (16%).

A tela já avisava — havia um rodapé cinza dizendo a cobertura. Mas **rótulo
verde vence rodapé cinza**: o card dizia "Lucro líquido" em verde, e a ressalva
ficava embaixo, opcional de ler.

**Conserto:** com cobertura parcial o rótulo vira **"Lucro líquido (parcial)"**,
o tom vira amarelo e a dica diz *"superestimado — só X% dos itens têm custo"*.
O número não muda; o que muda é ele parar de se apresentar como completo.

---

## 3. Vendas — o terceiro limiar de margem

```ts
tone={m.margem >= 20 ? "green" : m.margem >= 0 ? "yellow" : "red"}
```

Um **20** escrito nesta página, desligado do piso que a lojista escolheu e da
regra que a tela de Precificação usa. Era a terceira régua para a mesma
pergunta:

| onde | regra |
|---|---|
| Precificação | piso dela, e o dobro dele |
| área interna (`variantes.ts`) | `statusMargem` próprio |
| **Vendas** | **`>= 20` fixo** |

Três réguas para "esta margem é boa?" é o mesmo formato dos dois modelos de
comissão que conviveram meses sem ninguém saber qual valia (AUD-001, item 3).

**Conserto:** a cor sai de `classificarMargem(margem, pisoDela)` — a mesma
função da Precificação — e a dica mostra o piso usado.

---

## 4. Ajuda — sem número, com uma afirmação

A tela é conteúdo estático: quatro passos e um FAQ. **Nenhum número calculado**,
então a régua desta auditoria não se aplica a ela.

Mas ela **afirma como o Score IA funciona**:

> *"É a nota de qualidade do anúncio, de 0 a 100. (…) A IA calcula com base em
> título, descrição, ficha técnica, imagens e preço."*

**Não verifiquei se a nota realmente considera esses cinco elementos.** Fica
registrado como pendência de conferência, não como defeito: afirmar que é falso
sem medir seria cometer o erro que esta auditoria persegue.

---

## O que NÃO foi tocado

- **Os quatro passos da Ajuda** descrevem um fluxo (importar → auditar →
  otimizar → revisar) que nasceu antes dos cinco contextos de 28/07. Se ainda
  descrevem o produto atual é pergunta de UX, não de auditoria.
- **`emRevisao` e `corrigidos`** em Relatórios: `corrigidos` usa
  `qtdPendencias === 0 && notaDiagnostico >= 70`. O **70** é mais um limiar
  nosso, e fica **declarado e aberto** — corrigi-lo junto embutiria uma decisão
  que ninguém tomou, que é exatamente o que a AUD-001 pegou.

---

## O que as duas auditorias ensinaram juntas

**Suposição vestida de fato gera trabalho que não existe** — 373 anúncios
mandados para o fotógrafo à toa.

**E regra duplicada sobrevive ao próprio conserto.** O "Otimizado" de
Relatórios não escapou por descuido: escapou porque a mesma decisão estava
escrita em dois arquivos, e consertar um não deixava rastro no outro. Toda
regra que responde a uma pergunta da tela precisa de **um endereço só**.
