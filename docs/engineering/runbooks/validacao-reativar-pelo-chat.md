# Runbook — validação supervisionada de `reativar_anuncio`

> **A primeira ação que o chat executa sozinha, contra o Mercado Livre real.**
> Regra dos 3 artefatos: **Plano** (este documento) · **Snapshot** · **Relatório**.

O gate verde não prova que o app funciona — é a lição do COPILOT-003, e ela vale
inteira aqui. A suíte prova que nenhuma ferramenta alcança o catálogo e que só
uma ação está autorizada. **Nenhum teste desta suíte já falou com o Mercado
Livre.** O que este runbook valida é exatamente o que os testes não alcançam: o
token, a rede, a resposta do ML e o que o modelo faz com ela.

---

## O que se quer provar, em uma frase

> A lojista pede pelo chat, o anúncio volta ao ar, e **o que o chat diz é o que
> o Mercado Livre confirmou** — não o que o Zion pediu.

Esta última metade é a razão do runbook existir. Em 03/08/2026 o assistente
afirmou sucesso três vezes narrando o *passo seguinte* no lugar do *resultado*.
O código foi escrito contra isso: `definirEstadoDoItem` devolve
`j.status` — a palavra do ML — e não o `"active"` que foi pedido. Falta ver isso
acontecer com um anúncio de verdade.

---

## Fase 0 — Pré-condições

| | verificar |
|---|---|
| ambiente | **produção** (`www.zioncompany.online`). Não dá para validar em local: exige sessão real e o `refresh_token` do canal, que só existe no banco de produção sob RLS |
| sessão | logada como a lojista (Chinelaria Leilane Neves) |
| conexão ML | `/cliente/conectar-ml` mostra conectado. Se o refresh falhar, o teste morre na Fase 2 com erro honesto — o que também é um resultado |
| ramo | a PR #191 mergeada e o deploy da Vercel concluído. **Validar antes do merge não vale**: o preview tem outra URL de redirect |
| anúncio-cobaia | um anúncio **de teste**, publicado, de baixo giro. Não usar um anúncio que vende |
| `status_marketplace` do cobaia | precisa estar em **`active`** — ver abaixo |

### O cobaia precisa ter `status_marketplace = 'active'`

Os botões **Pausar** e **Reativar** de `/cliente/anuncios` são condicionados a
essa coluna: Pausar só aparece com `active`, Reativar só com `paused`. A
migração 050 entrou **sem backfill** — `null` significa *não sabemos* —, então
num anúncio nunca sincronizado **nenhum dos dois botões existe** e a Fase 2 não
tem como começar.

```sql
select ml_item_id, status, status_marketplace
from public.anuncios_gerados
where ml_item_id = '<MLB>';
```

Se vier `null`, rodar a sincronização/importação antes — é ela que traz
`ml.status` do Mercado Livre para a coluna.

### O que fica FORA de teste, e não por esquecimento

**Anúncios com `sub_status: forbidden`.** Os 6 cancelados por infração em
31/07/2026 **não entram neste roteiro em nenhuma hipótese**. Republicar o que o
ML cancelou é reincidência, e a política dele fala em suspensão da conta.

Isso não é só cuidado do operador — é uma **lacuna de código**, e está anotada
na Fase 5 abaixo.

---

## Fase 1 — Snapshot

Antes de tocar em qualquer coisa, registrar:

1. o **MLB** do anúncio-cobaia e o `permalink` dele;
2. o estado que a tela `/cliente/anuncios` mostra (`statusMarketplace`);
3. o estado que o **ML** mostra, por leitura independente.

### As duas leituras independentes

Nenhuma das duas passa por código do Zion — é isso que as torna prova.

| instrumento | como |
|---|---|
| **painel do ML** | `mercadolivre.com.br` → Meus anúncios → o MLB. Mostra o estado com as palavras do ML |
| **permalink anônimo** | abrir o link do anúncio numa **janela sem sessão**. É o que o comprador vê, e "voltou ao ar" quer dizer exatamente isso |

> **Não usar `/api/ml/diagnostico-item` para isto.** Ela é somente-leitura e é
> ótima no que faz, mas não serve de instrumento aqui: `inventariarItem`
> devolve **nomes de campo**, não valores — o `status` do anúncio aparece na
> lista `usados`, sem o valor. E o `deItems.status` que ela expõe é o **HTTP da
> requisição**: ler `200` ali e concluir que o anúncio está no ar é a leitura
> errada mais fácil deste runbook.

Sem os três registros, a Fase 4 não tem contra o quê comparar.

---

## Fase 2 — Pausar pelo caminho ANTIGO

Em `/cliente/anuncios`, no anúncio-cobaia: **Pausar**.

Este passo usa o caminho já existente (`/api/ml/estado-do-anuncio` →
`definirEstadoNoML`), e é de propósito: ele estabelece o estado inicial **e**
serve de grupo de controle. O que ele faz é o que o caminho do chat deveria
fazer.

**Esperado:** a tela passa a mostrar `paused`, e a coluna `status_marketplace`
em `anuncios_gerados` também.

```sql
select ml_item_id, status, status_marketplace, status_marketplace_em
from public.anuncios_gerados
where ml_item_id = '<MLB>';
```

> Se `status_marketplace` não virar `paused` aqui, **pare**: o defeito é no
> caminho antigo e nada do que vem depois é interpretável.

---

## Fase 3 — Reativar pelo CHAT

No chat da operação, pedir com as palavras da lojista — não com o nome da
ferramenta:

> `volta o anúncio <MLB> pro ar`

**O que observar, na ordem em que aparece:**

A linha **"Consultei:"** do turno junta tudo que rodou, separado por ` · `. As
duas entradas que importam caem nela:

| # | observação | esperado |
|---|---|---|
| 3.1 | `reativar_anuncio` na linha "Consultei:" | o modelo escolheu a ferramenta |
| 3.2 | `reativou <MLB>` na MESMA linha | é o `mandar()` da rota, emitido **depois** do PUT. Se 3.1 aparece e 3.2 não, o modelo pediu e o ML recusou |
| 3.3 | o texto do modelo | diz que **voltou ao ar** e credita ao Mercado Livre |
| 3.4 | o texto do modelo, de novo | **não** contém número que nenhuma ferramenta devolveu |

> 3.2 é o sinal mais barato do runbook: ele separa "o modelo tentou" de "o ML
> aceitou" sem sair da tela.

### O caso que interessa mais que o sucesso

Se o ML responder **`under_review`**, o esperado muda e é aqui que o desenho se
prova:

- 3.2 aparece assim mesmo (o PUT passou);
- 3.3 deve dizer que **o pedido foi feito** e que o ML respondeu `under_review`,
  **sem afirmar que está no ar**.

O `comoResponder` da rota instrui exatamente isso. Se o modelo afirmar "está no
ar" tendo recebido `under_review`, **a validação falhou** — e falhou no ponto que
motivou o trabalho todo.

---

## Fase 4 — Conferir contra quem manda

Repetir as duas leituras independentes da Fase 1 — painel do ML e permalink em
janela sem sessão. E o banco:

```sql
select ml_item_id, status, status_marketplace, status_marketplace_em
from public.anuncios_gerados
where ml_item_id = '<MLB>';
```

### Divergência JÁ CONHECIDA — não é surpresa, é o achado

O caminho do chat **não grava `status_marketplace`**. Ele fala com o ML, devolve
a palavra do ML ao modelo, e para por aí. O caminho da tela grava
(`definirEstadoNoML` → `atualizarAnuncioGerado`); o do chat, não.

**Esperado nesta fase, com o código de hoje:**

| fonte | valor |
|---|---|
| Mercado Livre | `active` |
| `/cliente/anuncios` e `status_marketplace` | ainda **`paused`** |

Ou seja: o anúncio volta ao ar de verdade, e a tela continua dizendo que está
pausado até a próxima sincronização. Pela migração 050, `status_marketplace` é
*a palavra do ML sobre o anúncio* — e deixá-la velha é a tela afirmando o que não
sabe, que é o defeito do AUD-001.

**Confirmar a divergência é resultado válido do runbook.** Registrar no relatório
com o horário; o conserto é decisão sua, e cabe em commit próprio.

---

## Fase 5 — O que este runbook NÃO prova, e as duas lacunas

**Não prova:**

- que o modelo escolhe `reativar_anuncio` de forma confiável em frases ambíguas
  (isso é medição de comportamento, e pede um EXP com N conversas);
- nada sobre anúncios que o **ML** pausou — só sobre os que a lojista pausou;
- o `pausar` pelo chat, que **não existe**: a ferramenta só reativa.

**Lacuna 1 — a trava de infração não cobre este caminho.**
`/api/ml/publicar` consulta `mlbsComInfracao` e **falha fechado**: se não
consegue conferir, não publica. O caminho do chat vai direto ao
`definirEstadoDoItem`. A proteção que existe hoje é a descrição da ferramenta
mandando o modelo não reativar o que o ML tirou do ar — e a doutrina deste repo
já respondeu a isso: *o prompt já proibia; proibir não impede*.

O risco é menor que o da publicação (reativar um `forbidden` provavelmente é
recusado pelo próprio ML), mas "provavelmente" não é o padrão desta base para
reincidência. **Fechar antes de ampliar a fronteira.**

**Lacuna 2 — a ação não deixa rastro estruturado.**
A rota emite o chip `reativou <MLB>` para a tela e nada para os logs. Uma ação
que muda a loja e some do registro é a única do sistema com essa propriedade;
todo o resto grava. Enquanto não gravar, a auditoria desta ação é o print do
chat.

---

## Fase 6 — Relatório

`docs/engineering/executions/<data>-validacao-reativar-pelo-chat.md`, com:

- MLB usado e horários de cada fase;
- as três leituras (snapshot, pós-pausa, pós-reativação) **verbatim**;
- o texto que o modelo produziu, copiado — é a evidência de 3.3 e 3.4;
- se `under_review` apareceu, o que o modelo disse;
- a divergência da Fase 4, confirmada ou não;
- veredito: **valida** / **falsifica** / **inconclusivo**, e por quê.

## Desfazer — e a surpresa que a Fase 4 cria

A reversibilidade foi o argumento que autorizou `reativar_anuncio` a existir. Ela
continua verdadeira **no Mercado Livre** — o anúncio se pausa de novo a qualquer
momento. Mas a divergência da Fase 4 tem uma consequência que só aparece aqui:

Como o banco continua dizendo `paused`, `/cliente/anuncios` **mostra o botão
Reativar, não o Pausar**. O desfazer de um clique some da tela justamente depois
da ação que ele deveria desfazer.

Os caminhos que restam, em ordem de preferência:

1. **painel do ML** — pausar direto na origem. Um passo, sem depender do Zion;
2. **pela tela, em dois cliques** — Reativar (o ML confirma `active`, e é isso
   que grava a coluna), depois Pausar, que agora aparece;
3. o chat **não** desfaz: existe `reativar_anuncio`, não existe `pausar_anuncio`.

> Isto reforça a Fase 4 em vez de contradizê-la: a ação é reversível, e ainda
> assim a experiência de reverter piorou. É argumento para gravar
> `status_marketplace` no caminho do chat, não para tirar a ferramenta.
