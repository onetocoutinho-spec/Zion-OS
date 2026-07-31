# INC-007 — Seis escritas do Copilot podiam falhar sem deixar vestígio

```
Status:      CORRIGIDO e DEPLOYADO — comportamento provado por teste,
             NÃO observado sob falha real de banco
Detectado:   2026-07-31, CICLO D, ao investigar por que `procedencia_de_campo`
             está vazia
Severidade:  observabilidade. Nenhuma perda de dado conhecida
Classe:      irmã do INC-004 — a mesma construção, em outras seis tabelas
Commits:     3979870 (correção) · merge e5e29bb (PR #99)
```

## A classe

`supabase-js` **não lança** em erro de banco: devolve `{ data, error }`. Quem
escreve

```ts
await admin.from("tabela").insert({ ... });
```

recebe uma Promise que **resolve com sucesso** mesmo quando o Postgres recusou a
linha. Um `try/catch` em volta não corrige nada — ele nunca é atingido.

Foi assim que o [INC-004](INC-004-turno-do-copilot-pode-nao-persistir.md) durou
meses: as duas falas de cada turno nunca chegavam a `copilot_mensagens`, o
Postgres devolvia `23502`, e **nenhuma linha de log dizia isso**.

Corrigido o INC-004 no seu ponto, a mesma construção continuava em **mais seis
lugares**.

## Os seis

| escrita | tabela | o que sumiria em silêncio |
|---|---|---|
| `registrarAcao` | `copilot_acoes` | uma escrita consumada **sem linha de auditoria** |
| `marcarProposta` | `copilot_propostas` | uma proposta que devia ficar `expirada` seguindo `pendente` para sempre |
| `registrarProcedencia` | `procedencia_de_campo` | um valor gravado sem origem registrada |
| `registrarVarias` | `procedencia_de_campo` | idem, uma grade inteira de uma vez |
| `marcarDraftCriado` | `copilot_cadastros` | um rascunho preso em `aguardando_confirmacao` **com o produto já criado** |
| `garantirConversa` | `copilot_conversas` | o carimbo `atualizada_em` deixando de avançar |

### Duas delas documentavam a propriedade que não tinham

`registrarAcao` dizia, em comentário:

> *"Nunca lança: um erro de auditoria não pode derrubar uma gravação que já
> aconteceu… Falha vai para o log do servidor, onde é vista."*

A primeira metade era verdade. A segunda **não podia ser**: o `catch` não é
alcançado por erro de banco. `registrarProcedencia` prometia o mesmo, pela mesma
construção.

O mais grave dos seis é `registrarAcao`, e não por tamanho: `copilot_acoes` é a
tabela **cuja razão de existir é ser a prova de que algo aconteceu**. Uma
auditoria que pode não gravar e não avisar é pior do que auditoria nenhuma, porque
a ausência de linha passa a ter duas leituras — "não aconteceu" e "não foi
registrado" — e nada distingue as duas.

## O que a correção faz, e o que ela não faz

Cada ponto passou a ler `error` e registrá-lo. Nada além disso:

```diff
-    await getSupabaseAdmin()
+    const { error } = await getSupabaseAdmin()
       .from("copilot_acoes")
       .insert({ ... });
+    if (error) console.error("[copilot] falha ao auditar (a ação em si NÃO foi revertida):", error);
```

**Nenhuma passou a lançar.** Todas rodam **depois** de uma escrita já consumada, e
uma exceção ali trocaria um sucesso por um 500 — trocaria o defeito por outro
pior. A política de falha de cada função é exatamente a de antes; só deixou de
ser cega.

Nenhum `.from`, `.eq`, `.insert`, `.update`, filtro de tenant, alvo ou payload
mudou. Nenhuma ordem de escrita mudou. Os seis `await` continuam `await`.

## A prova

`src/lib/services/escritasQueFalhamEmSilencio.test.ts` prova por
**comportamento, não por regex**. Procurar `if (error)` no fonte provaria que
alguém escreveu o texto certo; o que precisa valer é outra coisa — **com o banco
recusando, alguém registra**.

Um `fetch` de mentira devolve a recusa `23502` do PostgREST, exatamente como a
produção responderia, e o teste observa o `console.error`. Três propriedades por
escrita:

1. banco recusando → **não fica em silêncio**;
2. banco recusando → **não lança**;
3. banco aceitando → **fica calado** (o log não é ruído de rotina).

Mais dois controles que provam que o dublê exercitou o código certo — inclusive
que `garantirConversa` chegou ao `PATCH` de `atualizada_em`, e não ao `INSERT`,
que é outro caminho com a mesma aparência de verde.

### Falsificação

Rodado contra o código **pré-correção**, numa worktree em `HEAD`: **6 de 20
falham**, e são exatamente as seis de *"não fica em silêncio"*. As outras 14
passam dos dois lados — porque aquelas propriedades já valiam, e um teste que
passasse igual antes e depois não provaria nada.

## O que este incidente NÃO diz

**Não diz que toda escrita do sistema agora observa erros.** A varredura foi
deliberadamente escopada ao Copilot. `src/app/api/otimizar/worker/route.ts` tem
**cinco** escritas da mesma classe (`fila_otimizacao_produto`). É outro
subsistema, não foi revisado, e **não entrou** na correção nem no PR. Fica
registrado aqui como dívida delimitada.

**Não diz que alguma dessas falhas chegou a acontecer.** Nenhuma perda foi
observada. `procedencia_de_campo` estar vazia em 2026-07-31 está **inteiramente
explicado** por outra coisa: `copilot_acoes` também tem 0 linhas, nenhuma
proposta foi executada nunca, e `registrarVarias` só é chamada depois de uma
escrita confirmada. Não há defeito de procedência — há ausência de exercício.

**Não diz que o comportamento foi observado em produção.** Ele está
**integrado e deployado** (Production `e5e29bb`, *Deployed (completed)*) e
**provado por teste**. Observá-lo exigiria uma falha real de banco, e fabricar
uma em produção só para ver o log seria trocar uma dívida de evidência por uma
mutação injustificada. Se surgir naturalmente, aparecerá — que é precisamente o
que a correção existe para garantir.

## Um sinal conferido no caminho

Antes de mexer em `garantirConversa`, o último dos seis, o site foi conferido no
banco: a conversa `47dd11cd…` (a validação da FASE 7F do
[INC-005](INC-005-a-conversa-do-banco-nao-e-o-fio.md)) tem `atualizada_em` **139
segundos** depois de `criada_em` e **6 mensagens** — três turnos.

O reuso do fio e o carimbo **funcionam em produção**. O defeito destes seis é de
cegueira, não de quebra. O que estava em risco era a evidência, não o dado — e
`atualizada_em` é justamente o sinal que provou o INC-005 (oito conversas com
`atualizada_em = criada_em`). Um sinal que pode parar de avançar em silêncio
deixa de servir como evidência.
