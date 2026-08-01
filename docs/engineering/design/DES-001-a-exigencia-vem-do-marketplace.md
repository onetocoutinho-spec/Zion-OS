# DES-001 — A exigência vem do marketplace, não do modelo

```
Estado:     DESENHO — nada implementado
Data:       2026-08-01
Motivo:     4 regerações reais, 13 pendências, ZERO obrigatórias
Precedente: PR #79 (a grade saiu do modelo e passou a vir do cadastro)
```

## O defeito, nomeado

`ESQUEMA_ANUNCIO` pede `pendencias` como campo **required**, preenchido pelo
modelo. É a mesma forma de `variacoes` antes do PR #79, e a lição de lá vale
inteira:

> **Campo obrigatório sem fonte tem uma saída só.**

Só que a consequência aqui é pior que dado inventado. Publicar exige
`pendencias.length === 0`. Uma pendência inventada **trava a publicação para
sempre**, e não há tela onde alguém a resolva — o dado que ela pede não existe.

## A medição que fechou o diagnóstico

Quatro produtos regerados em 2026-08-01, marcas e tipos diferentes:

| produto | nota | pendências |
|---|---|---|
| Modare Papete | 75 | 1 |
| Azaleia Tamanco | 70 | 8 |
| Zaxy Chinelo | 50 | 1 |
| Actvitta Tênis | 50 | 3 |

**13 pendências. Conferidas contra a API pública do Mercado Livre — endpoint
`GET /categories/{id}/attributes`, sem token, sem efeito colateral:**

| categoria | obrigatórios, segundo o ML |
|---|---|
| MLB273770 Sandálias e Chinelos | BRAND · MODEL · GENDER · COLOR · SIZE · FOOTWEAR_TYPE |
| MLB23332 Tênis | BRAND · MODEL · GENDER · COLOR · SIZE |

- **nenhuma das 13 é obrigatória.** Nenhuma.
- **três não existem** como atributo em nenhuma das duas categorias:
  `Ano de lançamento`, `solado`, `tipo de bico`.
- `Ano de lançamento` apareceu em **4 de 4** — é sistemático, não ruído.
- **os 6 que o ML exige não foram mencionados em nenhuma pendência.**

E os quatro `motivoVeredito` citam **exatamente** essas pendências, chamando-as
de *"atributo obrigatório"*:

> *"Atributo obrigatório 'Ano de lançamento' pendente na ficha técnica."*

O veredito não é um portão independente. É um **eco** das pendências.

## O princípio que organiza a correção

> **Cada portão só pode exigir o que ele consegue saber.**

| portão | o que sabe | o que pode exigir |
|---|---|---|
| A10 (esteira) | o cadastro | grade completa, preço, estoque, foto |
| publicar | a categoria (prevista com token) | os atributos obrigatórios **daquela** categoria |

O defeito atual é estrutural, não de prompt: **no A10 o marketplace ainda não
foi escolhido.** Pedir ao modelo que produza a lista de exigências daquela
categoria é pedir informação que não existe naquele momento — e um modelo
solicitado a produzir o que não sabe produz alguma coisa.

## As decisões

### D1 — `pendencias` sai do esquema do modelo

Removido de `properties` e de `required` em `ESQUEMA_ANUNCIO`, exatamente como
`variacoes` no PR #79. Mudança **subtrativa**, que é o padrão que já deu certo.

O modelo continua com `notaDiagnostico`, `vereditoA10` e `motivoVeredito` —
juízo sobre a QUALIDADE do texto, que é o que ele faz bem. Deixa de ser autor da
lista que bloqueia.

### D2 — quem passa a produzir as pendências

`comAGradeDoCadastro` já é a costura onde o domínio manda no modelo. Ela compõe:

1. `pendenciasDaGrade(grade)` — **já existe**, vem do cadastro;
2. **nada de atributo de marketplace** — o A10 não sabe a categoria (ver D4).

### D3 — o modelo não perde a voz, perde o veto

O que ele observa de útil ("faltou foto de perfil", "descrição sem medidas")
passa a um campo novo **`sugestoes`**, que aparece na tela e **não entra** em
`pendencias.length === 0`.

Observação vira conselho. Só o que tem fonte vira bloqueio.

### D4 — a exigência de atributos migra para a publicação

A checagem vai para `/api/ml/publicar`, que **já** prevê a categoria e já tem
token. Ela busca os obrigatórios daquela categoria e devolve 422 nomeando o que
falta — em português, acionável.

É o mesmo movimento do INC-009: **em vez de deixar o marketplace recusar com
prosa em inglês, o sistema diz antes o que impede.**

**Rejeitado: prever a categoria no worker.** Exigiria `renovarToken` num cron —
e `renovarToken` **rotaciona** o refresh token. Um cron rotacionando a
credencial do lojista de minuto em minuto, concorrendo com a publicação, é uma
fábrica de corridas. O ganho não paga.

### D5 — a ficha técnica tem o mesmo defeito

O esquema pede `fichaTecnica` com `{atributo, valor, obrigatorio}` — **o modelo
declara o que é obrigatório**. Mesma doença, segundo lugar. O campo
`obrigatorio` sai do esquema; a obrigatoriedade vem do ML, na publicação.

### D6 — o veredito NÃO é tocado nesta fase

Medido: os quatro motivos citam apenas as pendências inventadas. Removidas
elas, o motivo declarado evapora.

**Isto é uma previsão, não um fato** — e o passo 3 existe para testá-la. Se o
modelo continuar reprovando por conta própria, aí sim há uma segunda decisão a
tomar, com evidência nova.

## Riscos, e como cada um é contido

| risco | contenção |
|---|---|
| mexer no prompt mais sensível do produto | a mudança é **subtrativa**; foi assim que o PR #79 funcionou |
| sem pendências do modelo, passa anúncio ruim | nota, veredito e `pendenciasDaGrade` continuam bloqueando |
| a API do ML muda ou cai | **falha ABERTA**, com aviso: se não dá para saber o que o ML exige, bloquear seria inventar de novo — a mesma regra do INC-009, de não afirmar o que não se sabe |
| a lista muda por categoria | é buscada por categoria e cacheada; nada fixo no código |

## Como se mede que funcionou (passo 3)

Regerar **os mesmos quatro produtos**, mesmo cadastro, só o esquema diferente —
experimento limpo. Comparar:

| | antes | esperado |
|---|---|---|
| variações batendo com o cadastro | 4/4 | 4/4 (não pode regredir) |
| pendências vindas do modelo | 13 | **0** |
| pendências vindas da grade | 0 | 0 |
| veredito aprovado | 0/4 | > 0 — e se continuar 0, ver D6 |

E, na publicação, conferir que os 6 obrigatórios do ML são satisfeitos pelo
payload — ou que a recusa os nomeia.

## O que este desenho NÃO resolve

- **O gargalo de dado continua.** `material`, `palmilha`, `solado`, `salto` são
  opcionais para o ML, mas melhoram o anúncio. Não tê-los é uma perda real —
  só não é um bloqueio.
- **A parede da republicação.** Os 73 produtos já têm anúncio no ar; publicar
  cria duplicata. Decisão de negócio, fora deste desenho.
- **Nada aqui foi implementado.** Nenhuma linha de código mudou.
