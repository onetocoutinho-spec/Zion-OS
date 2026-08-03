# AUD-001 — O que a tela afirma, e com que direito

```
Data:    2026-08-03
Origem:  "isso faz pensar em toda UI, será que tudo aquilo mesmo é necessário"
Régua:   cada número é FATO MEDIDO, PALAVRA DO MARKETPLACE ou SUPOSIÇÃO NOSSA?
Método:  leitura do código que PRODUZ o número + consulta ao banco de produção
```

A pergunta não nasceu de gosto. Nasceu de uma medida: a regra de capa do Zion
acerta **29%** do que o Mercado Livre realmente pune — mandava refotografar 373
anúncios que ele nunca reclamou, e aprovava 166 que ele pune. O defeito não foi
a regra estar errada. Foi ela ser **apresentada com a autoridade de um fato**.

Esta auditoria procura o mesmo padrão no resto.

---

## As três origens, e por que a distinção não é filosófica

| origem | o que autoriza | como deve aparecer |
|---|---|---|
| **fato medido** | está no banco, alguém contou | afirma |
| **palavra do marketplace** | o ML disse, verbatim | cita |
| **suposição nossa** | inferimos de uma regra que escrevemos | pergunta |

Uma suposição exibida como fato **gera trabalho que não existe**. Foi o que
aconteceu com 373 anúncios: horas de fotografia contra uma regra inventada.

---

## 1. "Otimizado" — o achado mais grave

**Medido no banco de produção em 03/08/2026:**

```
880  anúncios
791  aparecem como "Otimizado" na tela de Produtos
  0  foram efetivamente avaliados pela IA  (avaliadoPelaIA = true em ZERO)
791  têm nota_diagnostico = 0
787  são importados do Mercado Livre
```

A regra é `status === "aprovado" || status === "publicado"` → **"Otimizado"**. E
`importarAnunciosDoCliente` grava todo anúncio importado como `publicado` — o
que é verdade do ponto de vista da esteira (ele ESTÁ no ar) e vira mentira
quando a palavra escolhida para dizer isso é *"Otimizado"*.

A tela mostra **80 produtos "Otimizado" com Score IA "—"** lado a lado. Os dois
campos se contradizem na mesma linha: um diz que a IA trabalhou, o outro diz que
não há nota. **A nota está certa. A palavra está errada.**

É a mesma classe de defeito que já foi corrigida uma vez neste repositório —
*"aprovado · nota 0/100"* era contradição em 790 linhas. A correção tratou a
nota e não tratou o rótulo.

**Conserto:** `estadoPorProduto` precisa de um terceiro estado. "Publicado" não
é "Otimizado". Quem veio do ML e nunca passou pela esteira está **no ar e não
otimizado** — que é, aliás, exatamente a informação útil: são esses os 787 que a
esteira ainda tem para fazer.

---

## 2. "Saudável" — o dobro que ninguém decidiu

`classificarMargem`:

```ts
if (margem < margemMinima)      return "Risco";
if (margem < margemMinima * 2)  return "Atenção";
return "Saudável";
```

O piso (`margemMinima`) é escolha da lojista — legítimo. **O `* 2` não é.**
Ninguém decidiu que "o dobro do piso" é saudável; ele apareceu no código e virou
a palavra mais forte da tela de Precificação.

E quando a lojista ainda não escolheu, `MARGEM_MINIMA_PADRAO = 5` entra no lugar
— o comentário no código é honesto: *"o piso que a Zion assumia pelo lojista"*.
Somando as duas coisas: **margem de 10% aparece como "Saudável" por uma regra
que a lojista nunca viu.**

**Conserto:** ou o segundo limiar vira escolha dela, ou o rótulo diz de onde
vem. "Saudável" sem referência é a mesma autoridade emprestada da capa.

---

## 3. Dois modelos de taxa, e ninguém decidiu qual vale

- **Núcleo oficial** (`modules/pricing/domain`): comissão da API do ML por
  categoria exata + tabela de envio oficial por reputação. **Fato.**
- **`src/lib/variantes.ts`**: `taxaMarketplacePercentual` com **default 16** +
  `comissaoGestorPercentual` separado, usado na área interna. **Suposição.**

Dois números para o mesmo produto, e a pergunta "qual dos dois é o certo"
continua sem resposta do dono do produto — está registrada desde 27/07.

---

## 4. A capa — já corrigido hoje

| | ML reclama | ML não reclama |
|---|---:|---:|
| nossa regra reprova | 139 | **373** |
| nossa regra aprova | **166** | 80 |

Concordância: 219 de 758 — **29%**. Onde o ML falou, a palavra dele passou a
valer; onde ele calou, a nossa regra fala **assumindo que é palpite**.

---

## O que está CERTO e não deve ser mexido

Vale registrar, porque auditoria que só acha defeito treina a ignorar auditoria.

- **"Falta custo / peso / foto"** — ausência medida no banco. Fato, e os chips
  já linkam para onde resolver.
- **Estado no marketplace** (migração 050/051) — a palavra do ML entra verbatim
  e `null` significa *não sabemos*, nunca "está no ar".
- **Pendências** — as três gravidades, o agrupamento por produto e a ordem por
  estoque parado. A ordem se explica na própria tela.
- **A recusa de afirmar causa** — `pendenciasDaConta` diz explicitamente que
  *"foto fora do padrão CAUSE a falta de venda é a explicação mais simples para
  três números medidos — não é prova, e o texto não diz que é"*.

---

## A régua que fica

> **Antes de escrever um rótulo na tela: eu medi, ele disse, ou eu achei?**
>
> Se foi "eu achei", a frase precisa dizer isso — e o custo de não dizer se mede
> em horas de trabalho de outra pessoa.

---

## O que esta auditoria NÃO fez

- **Não mexeu em navegação nem em layout.** Os cinco contextos foram decididos
  em 28/07 (UX-010) e ainda não rodaram tempo suficiente com uma lojista real.
  A evidência de hoje aponta para o CONTEÚDO das telas, não para a moldura.
- **Não auditou Pulso, Relatórios e Ajuda** — a varredura foi pelas telas que
  produzem número de decisão. As três restantes ficam para uma segunda passada.
- **Não conta como corrigido nada além da capa.** Os itens 1, 2 e 3 estão
  medidos e abertos.
