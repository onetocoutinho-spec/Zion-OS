# DES-004 — A medida do tamanho, quando a marca numera em pares

```
Estado:  DESENHO — nada implementado
Data:    2026-08-01
Origem:  o Zaxy aprovado não publica; previsto ANTES de a lojista clicar
```

## O caso que originou

Dois anúncios foram aprovados hoje. Rodando o código real contra o cadastro
real, dá para prever os dois desfechos:

```
Modare   "35 BR" → "35" → 23,0 cm   ✅  publica
         "39 BR" → "39" → 25,8 cm   ✅

Zaxy     "37 BR" → "37" → NÃO ENCONTRADA  ❌  422
```

A tabela da Zaxy é do grupo **Grendene**, com chaves em **pares** — `33/34`,
`35/36`, `37/38`. O cadastro tem `37` individual. `cmPorTamanho["37"]` é
`undefined`, a variação é pulada, `variacoes.length === 0`, e
`montarBundleUserProducts` devolve `ok: false`. A rota responde 422.

**E está certo em recusar.** `37` pode ser 24,5 ou 25,0 cm; chutar um número que
vira tabela de medidas para a compradora é invenção — a mesma classe do SKU
inventado.

## O que a medição mostrou, e por que o desenho mudou

Rodei `normalizarTamanho` + `medidasDaMarca` contra os tamanhos reais das 684
variantes. **O normalizador não é o problema:**

| bruto | normalizado | medida |
|---|---|---|
| `33 - 34` (Havaianas) | `33/34` | 21,9 ✅ |
| `34,0 BR` (Modare) | `34` | ✅ |
| `33-38` (Actvitta) | **RECUSADO** | — (faixa ampla, certo) |
| `39-44` | **RECUSADO** | — |

Ele já converte hífen em barra, tira o `BR`, entende decimal e recusa faixa.
**O buraco está na BUSCA DA MEDIDA** — 9 de 18 amostras normalizam bem e não
acham medida. E por **três causas diferentes**, que exigem tratamentos
diferentes:

### (a) número individual contra tabela de pares — o maior grupo

```
Zaxy       37  →  a tabela tem 37/38
Ipanema    25  →  a tabela tem 25/26
Havaianas  37  →  (veio de "37 - 37") a tabela tem 37/38
Havaianas  39  →  (veio de "39.0 BR")  a tabela tem 39/40
```

**É isto que este desenho resolve.**

### (b) a tabela não cobre aquele número

```
Modare      33  →  a tabela começa em 34
Molekinho   19  →  fora do alcance da tabela
Actvitta    34  →  normalizou, sem medida
```

Não é bug de busca: a marca não publica aquele número, ou a tabela está
incompleta. **Não se conserta com código** — se conserta com dado.

### (c) origem corrompida

```
Havaianas  "33.4 BR"   →  "33.4"
Havaianas  "45.46 BR"  →  "45.46"
```

São `33/34` e `45/46` com a **barra virada ponto** em algum export. O
normalizador os trata como decimal, não acha medida, e **pula em silêncio** —
que é o comportamento seguro.

## A armadilha que proíbe conserto automático

A Havaianas tem **sete grafias** do mesmo intervalo: `33 - 34`, `33-34 BR`,
`33.4 BR`… E aí aparece isto:

| token | Havaianas | Modare |
|---|---|---|
| `39.0 BR` | é `39/40` corrompido | é o decimal `39,0` |

**A mesma string, dois significados, dependendo da marca.** Qualquer rotina que
"limpe" o cadastro sozinha teria que saber disso — e não sabe. Consertar a
origem é decisão da lojista, marca por marca.

> Este desenho **não toca no cadastro**. Ele muda como a medida é procurada.

## A decisão

### D1 — a busca aceita o número dentro do par

```ts
medidaDoTamanho(tabela, token): number | undefined
```

1. chave exata → devolve;
2. token é um inteiro **e** a tabela é de pares → acha o par `A/B` em que
   `token === A` ou `token === B` → devolve;
3. token é um par **e** a tabela é individual → **recusa**;
4. nada → `undefined`.

### D2 — a assimetria entre 2 e 3 é o coração do desenho

Um par **contém** o número: `37/38` inclui o 37, e a medida do par é a medida
daquele sapato. Ler isso é **leitura**.

Um número **não determina** qual membro do par se quis: se o cadastro diz
`35/36` e a tabela tem `35 = 23,0` e `36 = 23,7`, escolher qualquer um é
inventar 0,7 cm. **Recusa.**

### D3 — nada de aproximação

Sem vizinho mais próximo, sem interpolação, sem "o 33 fica perto do 34". Se a
tabela começa em 34, o 33 continua sem medida — porque a marca não publica um 33.

Aproximar seria pôr na tabela de medidas da compradora um número que ninguém
mediu, e ela decide o pé por ali.

### D4 — a identidade da variação NÃO muda

A linha da guia e o `SIZE` do item continuam com o token do **cadastro** (`37`),
não com o do par (`37/38`).

Duas razões, e a segunda é evidência:

- identidade vem do cadastro — é a regra que o PR #79 estabeleceu;
- **o anúncio que já está no ar diz `37 BR`.** Medido:
  `MLB7048386242 → "37 BR / Marrom"`. É assim que ela vende hoje, e mudar para
  `37/38` mudaria o que a compradora vê.

O que muda é só de onde sai o **centímetro**.

### D5 — o que sobra vira relatório, não conserto

As causas (b) e (c) não são resolvidas aqui. Mas **somem de vista** se ninguém
as contar. Um diagnóstico por marca — "estes tamanhos não têm medida, e por quê"
— deixa a lojista consertar sabendo o que é gap de tabela e o que é origem
corrompida.

Sem isso, ela vê "não publica" e não sabe onde mexer.

## Como se mede que funcionou

| | antes | esperado |
|---|---|---|
| Zaxy `37` acha medida | não | **sim** — 25,0 cm, de `37/38` |
| Modare `35`, `39` | 23,0 · 25,8 | **idênticos** — sem regressão |
| `33-38`, `39-44` | recusados | **recusados** |
| `33.4`, `45.46` | sem medida | **sem medida** |
| Modare `33`, Molekinho `19` | sem medida | **sem medida** (é gap, não bug) |
| token do `SIZE` publicado | `37` | **`37`** |

A penúltima linha é a que prova o D3, e a última prova o D4.

## O que este desenho NÃO faz

- **Não altera nenhuma variante da lojista.**
- **Não conserta `33.4` nem `45.46`** — origem corrompida é decisão dela.
- **Não preenche tabela de marca.** Se falta o 33, falta.
- **Não liga as tabelas de `/cliente/medidas` ao bundle.** Isso é dívida
  separada e real: `medidasDaMarca` é pura e só lê a lista do código, então a
  tela que ela preenche **não afeta a publicação**. Uma tela que não muda nada é
  pior que nenhuma — mas é outro desenho.
