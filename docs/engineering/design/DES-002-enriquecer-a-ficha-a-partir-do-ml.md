# DES-002 — Enriquecer a ficha a partir do Mercado Livre

```
Estado:  IMPLEMENTADO em 2026-08-01 (D1-D5). D6 segue pendente.
Data:    2026-08-01
Medido:  500 anúncios · 500 com ficha própria · média de 17,7 atributos
Guardado hoje: 2
```

## O fato

A conferência (modo `medir`, PR #118) leu os 500 anúncios da conta **sem gravar
nada** e devolveu:

> 500 têm ficha própria · média de **17,7** atributos.
> Mais comuns: Marca (500) · Gênero (500) · Condição do item (500) ·
> Modelo (500) · Tipo de calçado (499) · ID da guia de tamanhos (499).

O Zion guardava **dois**. Descartava cerca de **16 por anúncio** — na ordem de
**8.000 informações** que a lojista já tinha dado ao marketplace.

A pergunta que originou isto era *"como prover material, palmilha, salto?"*. A
resposta é: **não precisa prover. Já está lá.** Faltava parar de jogar fora — o
que o PR #117 corrigiu no mapeador. Falta trazer para dentro.

## Um caminho que estava fechado por isso

`montarBundleUserProducts` lê o gênero **da ficha técnica**:

```ts
const genero = generoParaId(fichaValor(anuncio, ["genero", "gênero", …]));
if (!genero) return { ok: false, motivo: "gênero ausente … (obrigatório)" };
```

Com a ficha do importado em [Marca, Modelo], o gênero nunca chegava, o bundle
nunca montava, e `/api/ml/publicar` devolvia **422**. **Publicar calçado
importado era estruturalmente impossível** — por descarte no mapeador, três
camadas antes.

**Limite:** isso valia para os IMPORTADOS. Os anúncios gerados pela esteira têm
gênero e tipo de calçado na ficha (conferido nos quatro regerados em 01/08).
Então este era **um** caminho fechado, não necessariamente **o** motivo de nunca
se ter publicado.

## Onde o dado passa a morar

`produto_atributos` — **já existe e está vazia**:

| coluna | uso aqui |
|---|---|
| `produto_id` | CASCADE só com o produto |
| `nome_atributo` · `valor_atributo` | o par, como o ML devolveu |
| `tipo_atributo` | **`"texto"`** — ver a correção abaixo |
| `origem` | **`"Marketplace"`** — o valor que o enum `OrigemAtributo` já tem |
| `obrigatorio` | **sempre `false`** — ver D3 |

Ela é por PRODUTO, e os atributos vêm por ANÚNCIO (vários MLBs por produto no
modelo User Products). Isso gera a primeira decisão.

> **Corrigido na implementação (01/08).** O desenho dizia que `tipo_atributo`
> guardaria o id estável do ML e que `origem` seria `"Mercado Livre"`. Nenhum dos
> dois cabia: `TipoAtributo` é `"texto" | "numero" | "lista" | "booleano"` e
> `OrigemAtributo` já tem `"Marketplace"`. O id estável **se perde**, e isso é
> aceitável por causa do D2 — cada enriquecimento reescreve o conjunto inteiro do
> produto em vez de casar linha a linha, então um rótulo que muda no ML não gera
> linha órfã.

## As decisões

### D1 — discordância entre anúncios do mesmo produto NÃO se resolve sozinha

Dois MLBs do mesmo produto podem trazer "Material da sola" diferente. Escolher o
mais frequente seria decidir em silêncio sobre dado da lojista.

**Grava quando todos concordam. Discordou, não grava — vira conflito para ela
resolver**, com os valores e quantos anúncios dizem cada coisa.

Precedente no repo: o custo ambíguo, que já tem `ResolverAmbiguos` e a mesma
forma. Não invento mecânica nova.

### D2 — idempotência SEM migração

Rodar duas vezes não pode duplicar. Sem índice único (que seria DDL), a chave é
o escopo:

> por produto, apaga as linhas com `origem = 'Marketplace'` e insere de novo.

Entradas manuais (`origem = 'Manual'`) sobrevivem — o apagão é do que nós mesmos
escrevemos. **Nenhuma migração, nenhuma DDL.**

### D3 — `obrigatorio` nasce `false`, sempre

A coluna é `NOT NULL`, e a tentação é preenchê-la da API por categoria. **Não.**
O DES-001 estabeleceu que a exigência é do marketplace e varia por categoria —
gravá-la aqui cria uma cópia que envelhece no dia em que o ML mudar a lista ou o
produto mudar de categoria.

`false` não é "não é obrigatório": é **"esta tabela não responde isso"**. Quem
responde é o D4 do DES-001, na publicação, consultando a API.

### D4 — o mesmo recorte da ficha

`ATRIBUTOS_COM_CASA_PROPRIA` continua fora: identidade (`SELLER_SKU`, `GTIN`,
`COLOR`, `SIZE`) mora na grade que vem do cadastro, e `PACKAGE_*` já vira peso e
dimensão. Um recorte diferente aqui faria a tela mostrar um número e a ficha
outro.

### D5 — onde entra no fluxo

Uma quarta opção no mesmo diálogo, ao lado de "Só conferir": **"Trazer as
informações do Mercado Livre"**. Mesma leitura, mesma rota, mesma busca.
Escreve **só** em `produto_atributos`.

Nada de produto, variante, custo, peso, foto ou anúncio é tocado. É a diferença
inteira em relação a `substituir` — e o teste é posicional, como no `medir`.

### D6 — o ciclo só fecha quando a esteira ENXERGA

Trazer sem usar seria trocar um descarte por um depósito. `montarContexto`
passa a incluir os atributos do produto, e aí a esteira **lê** material,
palmilha e solado em vez de precisar inventá-los — que é a raiz do que o
DES-001 arrancou.

**Isto é um segundo passo, e deliberadamente separado**: trazer o dado é
verificável sozinho (contar linhas); mudar o contexto do modelo exige rodar
contra o provedor real e comparar, que é mais caro e tem outro portão.

## Como se mede que funcionou

| | antes | esperado |
|---|---|---|
| linhas em `produto_atributos` | 0 | > 0, com `origem = 'Marketplace'` |
| produtos com material/palmilha/solado | 0 | a maioria |
| conflitos | — | listados, não escolhidos |
| custo · peso · fotos · vínculo com anúncios | intactos | **idênticos** |

A última linha é a que importa. Uma consulta antes e depois, e os números não
podem mudar.

## O que este desenho NÃO faz

- **Não publica nada** e não mexe na parede da republicação.
- **Não decide obrigatoriedade** — ver D3.
- **Não preenche o que o ML não tem.** Se um atributo não veio, ele continua
  ausente, e isso é uma resposta.
- **Não toca no prompt da esteira.** Isso é o D6, num passo separado.
