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

Desde 03/08/2026 **o código também recusa**: a rota consulta `mlbsComInfracao`
antes do PUT e falha fechado — se não consegue conferir, não reativa. Isso não
transfere a responsabilidade de volta para o operador. A trava nunca foi
exercida contra um `forbidden` real, e testar reincidência para ver se a
proteção funciona é a única categoria de teste que custa mais caro quando
**passa** do que quando falha.

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

**Esperado:** as três fontes concordam.

| fonte | valor |
|---|---|
| Mercado Livre | `active` (ou `under_review`) |
| `status_marketplace` no banco | **o mesmo**, com `status_marketplace_em` de agora |
| `/cliente/anuncios` | o mesmo, e o botão **Pausar** de volta |

> A primeira versão deste runbook previa aqui uma **divergência**: o caminho do
> chat não gravava `status_marketplace`, e a tela continuaria dizendo `paused`
> com o anúncio no ar. Isso foi consertado antes da validação, no commit que
> fechou as lacunas. A previsão fica registrada porque é o que esta fase
> continua caçando — se as três fontes divergirem, o conserto não pegou.

**Se `status_marketplace` continuar `paused`:** o PUT passou e a gravação não. O
log tem a resposta — procurar `estado_nao_gravado` (ver Fase 5).

---

## Fase 5 — O log, e o que este runbook NÃO prova

### O rastro

A ação emite uma linha JSON por evento. Nos Runtime Logs da Vercel:

```
grep "chat.reativar"
```

| evento | significa |
|---|---|
| `pedido` | o modelo chamou a ferramenta e a rota assumiu |
| `infracao_nao_conferida` | a consulta ao ML falhou → **não reativou** (falha fechada) |
| `infracao_bloqueado` | o anúncio tem `sub_status: forbidden` → **recusou** |
| `confirmado` | o PUT passou; traz o `estado` que o ML devolveu |
| `estado_gravado` | o eixo do marketplace foi atualizado, e em quantas linhas |
| `estado_nao_gravado` | reativou e **não** conseguiu gravar — é a divergência da Fase 4 |
| `falhou` | não reativou, com o motivo |

`confirmado` sem `estado_gravado` é o par que explica a Fase 4 divergente sem
precisar adivinhar.

### O que NÃO prova

- que o modelo escolhe `reativar_anuncio` de forma confiável em frases ambíguas
  — isso é medição de comportamento, e pede um EXP com N conversas;
- nada sobre anúncios que o **ML** pausou — só sobre os que a lojista pausou;
- o `pausar` pelo chat, que **não existe**: a ferramenta só reativa;
- a trava de infração **contra o ML real**. Ela está guardada por teste
  estrutural (`acaoDeReativar.test.ts`: a consulta precede o PUT, e falhar na
  consulta impede a reativação), e a recusa em si nunca foi exercida contra um
  `forbidden` de verdade — **e não vai ser**, pelo motivo da Fase 0.

---

## Fase 6 — Relatório

`docs/engineering/executions/<data>-validacao-reativar-pelo-chat.md`, com:

- MLB usado e horários de cada fase;
- as três leituras (snapshot, pós-pausa, pós-reativação) **verbatim**;
- o texto que o modelo produziu, copiado — é a evidência de 3.3 e 3.4;
- se `under_review` apareceu, o que o modelo disse;
- a divergência da Fase 4, confirmada ou não;
- veredito: **valida** / **falsifica** / **inconclusivo**, e por quê.

## Desfazer

**Um clique: Pausar em `/cliente/anuncios`.** É a propriedade que autorizou a
ferramenta a existir — se o desfazer exigisse mais que isso, `reativar_anuncio`
não teria passado do tipo `Efeito`.

Isso **depende** da gravação da Fase 4: os botões da tela são condicionados a
`status_marketplace`, e um banco parado em `paused` mostraria **Reativar** no
lugar de **Pausar** — o desfazer sumindo justo depois da ação que ele deveria
desfazer. Foi metade do motivo de fechar aquela lacuna antes de validar.

Se a gravação tiver falhado (Fase 4 divergente), o desfazer continua existindo,
mais longe: **painel do ML**, ou dois cliques na tela (Reativar, que grava a
coluna, e então Pausar). O chat não desfaz — existe `reativar_anuncio`, não
existe `pausar_anuncio`.
