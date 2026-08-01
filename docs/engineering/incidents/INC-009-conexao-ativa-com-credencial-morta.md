# INC-009 — Conexão "ativa" com credencial morta

**Estado:** CORRIGIDO no código · **NÃO OBSERVADO EM PRODUÇÃO** (o caminho de
publicação não é exercido desde 20/07)
**Classe:** o produto modela intenção onde precisava modelar validade.

---

## O fato

`canais_marketplace` tem 1 linha: `Mercado Livre · ativo = true ·
seller_id 2332812759 · refresh_token presente`. Medido por SELECT.

Tentar publicar produz, hoje, um box vermelho com:

```
Falha ao renovar token do ML: the client_id does not match the original
```

Sem tradução e sem nenhum caminho para reconectar.

## Por que ninguém viu antes

Existem **três** estados reais, e só **dois** estavam modelados:

| estado | como o sistema tratava |
|---|---|
| nunca conectou (`refresh_token` ausente) | 400 em português, com link na tela |
| conectado e válido | publica |
| **conectado e credencial recusada** | catch genérico → 502 com a prosa do ML |

A tela deriva `conectado` de `canais_marketplace.ativo`
([canaisMarketplace.ts](../../../src/lib/services/canaisMarketplace.ts): *"o
'conectado' é derivado de `ativo`"*). `ativo` é um flag de **intenção do
lojista** — ele diz que existe uma conexão, não que ela funciona. Com `ativo =
true`, o aviso âmbar com "Conectar agora" fica escondido, porque sua condição é
`conectado === false`.

A rota, do outro lado, só cobria a **ausência** de token
(`if (!canal?.refreshToken)`). O token existe; a guarda não dispara.

O resultado é que os dois lugares que sabiam falar sobre conexão estavam
olhando para a mesma pergunta errada — *"existe conexão?"* —, e a pergunta que
importava — *"a credencial ainda vale?"* — não tinha dono.

## Por que a validade não pode ser consultada de graça

`renovarToken` **rotaciona** o refresh token e o persiste. Uma ferramenta de
diagnóstico que "testasse a conexão" teria efeito colateral sobre a credencial
do cliente. Isso elimina o caminho óbvio, e é a razão de a correção acontecer
**no momento do uso** e não num check preventivo.

## A correção

1. **`RenovacaoRecusadaError`** ([mercadolivre.ts](../../../src/lib/marketplaces/mercadolivre.ts))
   carrega o HTTP com que o ML respondeu. O chamador separa "a credencial não
   vale" (4xx) de "o ML está fora" (5xx) sem inspecionar prosa em inglês. A
   mensagem é idêntica à anterior — os outros seis chamadores de `renovarToken`
   não mudam de comportamento.

2. **A rota** ([publicar/route.ts](../../../src/app/api/ml/publicar/route.ts))
   dá `catch` próprio ao passo da renovação e devolve `409 { motivo:
   "reconectar" }` com uma frase em português. 5xx e falha de rede seguem para
   o catch genérico: o ML fora do ar não diz nada sobre a validade do token, e
   mandar reconectar seria afirmar o que não se sabe.

3. **O transporte** ([publicacaoML.ts](../../../src/lib/services/publicacaoML.ts))
   converte esse motivo em `ReconectarCanalError` **antes** do Learning Loop
   (2). Credencial morta não é veto ao conteúdo: anexá-la às observações do
   anúncio faria o próximo leitor concluir que o ML reprovou o anúncio.

4. **A tela** ([PublicarAnuncio.tsx](../../../src/components/client-portal/PublicarAnuncio.tsx))
   mostra o motivo com "Reconectar agora" → `/cliente/conectar-ml`, e some com
   a cópia vermelha da mesma mensagem. O botão continua liberado: dá para
   reconectar em outra aba e tentar de novo.

Os dois pontos de entrada (`/cliente/anunciar` e `/cliente/anuncios`) passam
pelo mesmo modal, então a correção vale para os dois.

## O que foi deliberadamente NÃO feito

**Marcar `ativo = false` quando a renovação falha.** Resolveria a UX de graça —
o aviso antigo voltaria a aparecer sozinho. Mas é escrita operacional disparada
por um erro: uma indisponibilidade momentânea do ML derrubaria a conexão de um
lojista que está bem. A validade continua sendo apurada no uso.

Consequência aceita: **o chat não sabe disso.** `o_que_impede("publicar")` só
consegue afirmar que existe uma conta conectada — hoje, verdade e inútil. Para
o chat dizer a verdade, o sistema precisa **lembrar** que a renovação falhou, e
isso é coluna nova em `canais_marketplace`. Fica como Fase 2, sem DDL feita.

## Evidência

- `npm run gate`: **1939 testes, 0 falhas** (eram 1924); lint 0 erros / 61
  avisos; `npm run build` completo.
- [reconexaoDoCanal.test.ts](../../../src/lib/services/reconexaoDoCanal.test.ts)
  — 15 testes. Falsificação executada em quatro pontos, um por vez:

  | mutação | testes que ficaram vermelhos |
  |---|---|
  | `renovarToken` volta a lançar `Error` puro | 2 |
  | o desvio por `motivo` sai de `publicacaoML` | 3 |
  | a guarda de 4xx da rota é invertida | 1 |
  | a tela escuta a classe de erro errada | 1 |

- **NÃO PROVADO:** que a conta de produção volta a publicar depois de
  reconectar. Isso depende do app do ML e de uma ação do lojista, e nada aqui
  foi executado contra o Mercado Livre.

## Portão que continua de pé

Mesmo com a conexão resolvida, os **74 rascunhos não devem ser publicados como
estão**: são anteriores à correção da identidade inventada e criariam SKUs que
o ERP não conhece. Regerar vem antes de publicar.
