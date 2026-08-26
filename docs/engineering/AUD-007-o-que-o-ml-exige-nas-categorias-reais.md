# AUD-007 — O que o Mercado Livre exige nas categorias reais da conta

```
Data:    2026-08-25
Base:    792 anúncios com `anuncios_gerados.categoria_ml` preenchido (conta real, leitura)
Fonte:   /categories/{id}/attributes, endpoint público, uma chamada por categoria
Motivo:  CHECKPOINT 2 de tasks/plan.md
```

O CHECKPOINT 2 perguntava uma coisa só: **quantos atributos obrigatórios trazem a
lista de valores que o ML aceita?** Se a maioria trouxer, a Fase 3 (buscar
concorrente) encolhe. Se poucos trouxerem, ela continua sendo o problema grande.

A resposta é clara. E a medição encontrou, de passagem, um defeito maior do que
a pergunta que veio responder — está em [INC-011](incidents/INC-011-o-retrato-de-calcado-vale-para-85-por-cento.md).

---

## As seis categorias da conta

```
categoria    anúncios   atributos   obrigatórios   fechados  sugeridos  sem valor
MLB273770         674          78              6          2          3          1
MLB23332           94          96              5          1          3          1
MLB7022             8          88              2          0          1          1
MLB1400             8          73              6          1          4          1
MLB275574           7          74              5          1          2          2
MLB108791           1          73              7          3          3          1
                  ---                        ---        ---        ---        ---
                  792                         31          8         16          7
```

- **fechados** — `value_type: "list"`: os valores publicados são o que o ML
  aceita, e mais nada.
- **sugeridos** — outro tipo, mas com valores publicados: o ML mostra o que já
  conhece, e aceita valor fora da lista.
- **sem valor** — o ML não publica valor nenhum: é texto livre de verdade.

## A resposta do CHECKPOINT 2

**24 dos 31 obrigatórios (77%) chegam com valores publicados pelo ML.**

Os 7 que não chegam quase não são um problema:

- **`MODEL` é 6 dos 7.** Em toda categoria da conta ele é `string` com zero
  valores — e sai do **cadastro** (`p.modelo`), não de pesquisa.
- O sétimo é `BRAND` em MLB275574, que também sai do cadastro (`p.marca`).

Ou seja: **nenhum obrigatório desta conta depende de olhar concorrente.** Ou o
ML publica a resposta, ou o cadastro já tem.

> **Decisão:** a **Fase 3 encolhe** e sai do caminho crítico da loja que opera
> sozinha. Buscar concorrente no ML continua fazendo sentido para posicionamento
> — título, preço, o que os melhores anúncios fazem —, que é trabalho de
> *vender melhor*, não de *conseguir publicar*.

---

## O que mais a medição mostrou

**O tipo do mesmo atributo muda entre categorias.** `FOOTWEAR_TYPE` é `list`
fechada com 4 valores em MLB273770 e `string` com 6 sugestões em MLB1400. Quem
tratar o atributo pelo id, sem olhar o `value_type` daquela categoria, erra numa
das duas.

**O número de valores do mesmo atributo muda muito.** `GENDER` tem 6 valores em
MLB273770 e MLB23332, **1** em MLB1400, 4 em MLB275574, 7 em MLB108791. Uma
categoria com um único gênero aceito não é uma pergunta a fazer: é um valor a
preencher.

**Existem obrigatórios que este repositório nunca viu.** MLB108791 exige
`SOCKS_TYPE` e `LENGTH_TYPE`. Nenhum dos dois existe em `OBRIGATORIOS_CALCADO`.

**A quantidade de obrigatórios varia de 2 a 7.** MLB7022 (bolsas) exige dois:
marca e modelo. MLB273770 exige seis. O retrato congelado tem sempre seis.

---

## Como reproduzir

A lista de categorias sai de uma leitura, sem escrita:

```sql
select categoria_ml, count(*) as anuncios
from public.anuncios_gerados
where categoria_ml is not null and categoria_ml <> ''
group by categoria_ml
order by anuncios desc;
```

E cada categoria, do endpoint público (sem token):

```
https://api.mercadolibre.com/categories/{categoria}/attributes
```

Os obrigatórios são os que trazem `required` em `tags`; os valores, `values`; o
tipo, `value_type`. A leitura já existe em `exigenciasDaResposta`
([atributosDoMarketplace.ts](../../src/modules/publication/domain/atributosDoMarketplace.ts)),
e a resposta de MLB273770 está congelada em
`src/testing/fixtures/mlb273770-atributos.json`.
