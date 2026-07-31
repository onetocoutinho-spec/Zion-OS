# INC-004 — Nenhum turno do Copilot chegava a `copilot_mensagens`

```
Status:      CORRIGIDO E VALIDADO EM PRODUÇÃO — para a causa demonstrada
Detectado:   2026-07-30, durante a investigação do INC-003
Causa:       demonstrada 2026-07-31 (logs de produção + reprodução em transação)
Correção:    9f42713, mesclada em master por 2e535fa (PR #94)
Validado:    2026-07-31, produção, SHA 2e535fa
Severidade:  perda silenciosa e TOTAL do histórico; sem corrupção de dado
```

> **Este documento foi reescrito.** A versão anterior apresentava *teardown
> serverless* como hipótese mais forte. **Teardown está falsificado.**

## O fato observado

Em produção, sessão autenticada real:

| tabela | antes | depois |
|---|---:|---:|
| `copilot_conversas` | 5 | **7** |
| `copilot_mensagens` | 0 | **0** |

Sete conversas nasceram ao longo do ciclo. **Zero mensagens.** A tela respondia
normalmente o tempo todo.

## A causa, demonstrada

`gravarTurno` insere as duas falas num único `.insert([...])`, e as duas
tinham **chaves diferentes**:

```ts
{ conversa_id, cliente_id, papel: "lojista",    texto }                        // 4
{ conversa_id, cliente_id, papel: "assistente", texto,
  ferramentas, tokens, metadata }                                              // 7
```

O supabase-js monta a URL com a **união** das chaves — visível no log da API:

```
POST | 400 | /rest/v1/copilot_mensagens
  ?columns="conversa_id","cliente_id","papel","texto","ferramentas","tokens","metadata"
```

E o PostgREST preenche a chave ausente numa linha com **NULL EXPLÍCITO — nunca
com o DEFAULT da coluna**. Como `ferramentas` é `NOT NULL DEFAULT '{}'`, a fala
do lojista derrubava o insert **inteiro**:

```
ERROR: null value in column "ferramentas" of relation "copilot_mensagens"
       violates not-null constraint          -- 23502
```

Seis ocorrências nas 24 h de log examinadas. Uma por turno. Sempre.

### Por que ninguém viu

O cliente Supabase **não lança** em erro de banco: devolve `{ data, error }`.
O retorno era descartado, então:

- o `error` nunca era lido;
- o `catch` nunca era atingido;
- nada era logado;
- a resposta ao lojista seguia normal.

`garantirConversa` e `ultimaApresentacao`, no mesmo arquivo, sempre conferiram
`error`. `gravarTurno` era a única que não.

**E o `catch` era código morto.** Descoberto ao rodar o teste de rede contra o
código anterior: o postgrest-js converte falha de *fetch* em `{ error }`
também. Nem recusa do Postgres nem queda de rede chegavam nele.

## Falsificado

- **Teardown serverless** — a requisição chegou ao PostgREST e foi respondida
  com 400. Não houve promessa perdida.
- **RLS** — habilitada, com apenas policy de SELECT. Mas `copilot_conversas`,
  `copilot_propostas` e `copilot_cadastros` têm configuração **idêntica** e
  gravaram. O cliente que escreve ignora RLS.
- **Grant / permissão** — `service_role` tem INSERT.
- **`conversaId` inválido** — a FK aceitou; o erro é outro.
- **Schema incompleto** — todas as colunas de 037 existem.

Registro de um erro meu: o primeiro teste transacional **passou** e teria
inocentado o payload. Ele usava dois `INSERT` separados, cada um com sua lista
de colunas — não reproduzia a união do PostgREST. Refeito com uma instrução
única e NULL explícito, reproduziu `23502` na hora.

## A correção

Tornar as duas linhas **estruturalmente homogêneas**:

```ts
{ …, papel: "lojista", texto: turno.pergunta,
  ferramentas: [],      // NOT NULL — é esta a chave que faltava
  tokens: null,         // nulável: pertence à geração do assistente
  metadata: null }      // nulável: "não se aplica", não "vazio"
```

E **ler o retorno**:

```ts
const { error } = await getSupabaseAdmin().from("copilot_mensagens").insert([...]);
if (error) console.error("[copilot] falha ao gravar turno em copilot_mensagens:", error);
```

Falha de persistência continua **não** derrubando a resposta — o contrato do
cabeçalho segue de pé. O que mudou é que ela deixou de ser invisível.

## Provas locais

- **17 testes** sobre o payload REAL serializado, capturado por um `fetch` de
  mentira — não por busca de string no fonte. **8 deles falham no código
  anterior**, verificado restaurando-o e rodando.
- A invariante que fecha a **classe**, não só a reprodução: as duas linhas têm
  o mesmo conjunto de chaves. Enquanto valer, a união do PostgREST não inventa
  NULL em ninguém.
- Payload corrigido contra o Postgres real, em transação revertida: **2 linhas
  aceitas, 0 resíduo**.

## NÃO resolvido nesta fase

- **`void gravarTurno`** — a Promise continua sem dono. Não causou este
  incidente, e trocá-la mexeria em latência de todo turno.
- **Fio único** — `garantirConversa` reusa a conversa quando recebe
  `conversaId`; a rota devolve o id e `conversaDoAssistente` o declara *"a tela
  devolve na próxima chamada"*. Mas **`ChatDaOperacao.tsx` nunca o menciona** e
  `conversar()` não o envia. Cada requisição cria uma conversa nova. É o
  candidato a **INC-005** — omissão no cliente, defeito independente deste.
- Retry, idempotência, ownership da Promise.

## A validação em produção

Produção rodando `2e535fa`, sessão real, fio limpo. Um turno: `"obrigado"`.

```
conversa 2c2801e4-a284-4fde-91a8-fc86c414b6d7

lojista     | texto "obrigado"        | ferramentas {}              | tokens null  | metadata null
assistente  | "De nada! Temos 13…"    | ferramentas {proximo_passo} | tokens 10692 | metadata null
```

`copilot_mensagens` **0 → 2**. A linha do lojista tem `ferramentas = {}` e
**não** NULL — era exatamente esse valor que derrubava o insert. A do assistente
preservou a ferramenta real do turno.

Mutação operacional zero: 684 variantes · 159 sem peso · Vizzano `0.000 | 0.410`
· preço 152,90 · ações 0 · cadastros 0 · procedência 0. A proposta pendente da
Fase 5B continua `pendente`, não decidida e não executada.

## O que isto NÃO prova

**Não prova que todo turno sempre persiste.** A evidência é observacional sobre
o caminho exercitado — um turno, de leitura, com uma ferramenta.

O `void gravarTurno` continua sem dono: nada aqui provou que a Promise sobrevive
em qualquer runtime, só que neste turno ela chegou. E o **fio único** continua
aberto — este turno criou a oitava conversa (7 → 8), como o candidato a INC-005
descreve.
