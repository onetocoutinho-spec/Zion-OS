# 12 — O que cadastrar no app do Mercado Livre de staging

```
Data:   2026-08-25
Fonte:  o código, não a memória — src/app/api/ml/autorizar/route.ts e conectar/route.ts
Quem:   você. Criar aplicativo no DevCenter exige entrar na sua conta do ML e
        aceitar os termos, e o resultado é um client_secret.
```

Esta página existe para o cadastro sair certo na primeira vez. Cada valor abaixo
foi lido do código que vai usá-lo — não de documentação nossa, que envelhece.

## Os valores

| Campo no DevCenter | Valor | De onde saiu |
|---|---|---|
| Redirect URI | `https://<host>/cliente/conectar-ml` | [autorizar/route.ts:75](../../src/app/api/ml/autorizar/route.ts:75) |
| Scopes | `offline_access read write` | [autorizar/route.ts:123](../../src/app/api/ml/autorizar/route.ts:123) |
| Tipo de autorização | `response_type=code` (server-side) | [autorizar/route.ts:118](../../src/app/api/ml/autorizar/route.ts:118) |

O app monta a autorização em `https://auth.mercadolivre.com.br/authorization`.

**`offline_access` não é opcional.** Sem ele o ML não devolve `refresh_token`, e
sem `refresh_token` o servidor não renova o acesso — a publicação para no dia
seguinte. O comentário do código diz isso na linha de cima do `set("scope", ...)`.

## A armadilha: o Redirect URI TEM que ser https

`api/ml/autorizar` recusa qualquer `redirect_uri` que não comece com `https://`,
e recusa **de propósito**. O comentário registra o motivo, que é o tipo de coisa
que custa uma tarde:

> "O ML recusa `redirect_uri` que não seja HTTPS, e a recusa acontece na BORDA:
> o vendedor recebe uma página branca da CloudFront com '403 ERROR', sem nenhuma
> pista do que houve."

**Consequência para o T1:** não existe conectar o Mercado Livre a partir de um
`next dev` em `localhost`. Precisa de host https:

- um deploy de preview (Vercel), ou
- um túnel (ngrok, cloudflared) — e a URL do túnel tem que estar cadastrada como
  Redirect URI no app, exatamente igual.

Sem um dos dois, o passo 7 do percurso para no **dry-run** (`go:false`, o payload
montado sem enviar) — que é a queda já prevista em [tasks/todo.md](../../tasks/todo.md)
e não invalida a medição: ela registra "medido até o payload, não até o ar".

## A conta conectada continua sendo decisão sua

Staging protege o BANCO, não a conta do marketplace. O app é outro, mas a conta
que autoriza pode ser a mesma da lojista — e aí um anúncio de teste vai para a
loja que vende. O ML não tem sandbox completo; a
[04](04-MERCADO-LIVRE-STAGING.md) já registra isso, e a guarda continua valendo:
**conta de teste, ou conta controlada autorizada só para isso.**

## Onde os valores vão parar

No `.env.staging` (que não vai para o Git), nas três linhas já marcadas:

```
ML_CLIENT_ID=<do DevCenter>
ML_CLIENT_SECRET=<do DevCenter — server-only, nunca com NEXT_PUBLIC_>
ML_REDIRECT_URI=https://<host>/cliente/conectar-ml
```

E lembre que `.env.staging` não é carregado pelo Next: para rodar local,
`cp .env.staging .env.development.local` (ver [05](05-VARIAVEIS-DE-AMBIENTE.md)).

## Depois de cadastrar

O caminho de conexão é `/cliente/conectar-ml`. Ele passa por
`api/ml/autorizar` (grava um ticket opaco e devolve a URL do ML) e volta em
`api/ml/conectar` (queima o ticket com `consumir_ticket_ml`, atômico, uso único).
O `state` que trafega pelo navegador é o ticket e não carrega informação nenhuma
— quem sabe qual loja é, é a linha no banco. Foi assim de propósito: ler a loja
do `state` seria deixar o navegador escolher a que conta conectar.
