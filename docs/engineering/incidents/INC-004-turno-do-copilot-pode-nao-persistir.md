# INC-004 — O turno do Copilot pode não persistir

```
Status:      INVESTIGAÇÃO PENDENTE — nada corrigido
Detectado:   2026-07-30, durante a investigação do INC-003
Severidade:  perda silenciosa de histórico; sem corrupção de dado
Correção:    NÃO feita — separada de propósito do INC-003
```

## O fato observado

Em produção, sessão autenticada, um turno do modo conversa:

| tabela | antes | depois |
|---|---:|---:|
| `copilot_conversas` | 0 | **1** |
| `copilot_mensagens` | 0 | **0** |

A conversa nasceu. O turno não.

## O que o código mostra

`app/api/assistente/conversa/route.ts`:

```ts
const conversaId = await garantirConversa(...)   // linha 333 — AGUARDADA
...
void gravarTurno(clienteDaSessao, conversaId, { ... })   // linha ~653 — NÃO aguardada
```

E `lib/services/copilotConversas.ts:94`, dentro de `gravarTurno`, um `catch` que
apenas registra no console — por decisão declarada no próprio arquivo:
*"perder o registro é ruim, perder a resposta é pior"*.

A escrita **aguardada** persistiu. A **não aguardada** não.

## O que NÃO está provado

**A causa.** A hipótese mais forte é que a promessa não aguardada se perca no
encerramento da função serverless — a assimetria entre as duas escritas é
consistente com isso. Mas:

- não há log do provedor examinado;
- o `catch` engole qualquer erro, então uma falha de schema, rede ou contrato
  produziria exatamente o mesmo sintoma;
- não foi feito experimento que distinga as duas explicações.

**Escrever "teardown serverless" como causa seria promover hipótese a fato** —
o mesmo movimento que o INC-003 documenta.

## O que já foi descartado

- **Schema:** `copilot_mensagens` existe com `metadata` (migração 037 aplicada,
  verificada na DB-AUDIT-001). As colunas que `gravarTurno` insere existem todas.
- **RLS:** a escrita usa `service_role`, que ignora RLS. A migração 041 não criou
  política de escrita nas tabelas do Copilot, e não precisaria.

## Relação com o INC-003

**Nenhuma.** O INC-003 é *o modelo narra fato sem consultar*; este é *uma escrita
disparada e não aguardada não chega*. Foram encontrados no mesmo turno e têm
causas diferentes.

## Por que importa

O fio persistido é pré-requisito de duas coisas já mapeadas: a retomada da
conversa entre o painel e a página própria, e o **fio único** (Fase 6A) — que
depende de existir uma história autoritativa de onde partir.

## NÃO corrigido

Trocar `void` por `await` é uma linha, e é justamente por isso que não foi feito
de carona: mudaria o custo de latência de todo turno e ainda não se sabe se
resolve. A investigação precisa primeiro distinguir teardown de erro engolido.
