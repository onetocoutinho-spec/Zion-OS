# INC-005 — A conversa do banco não é o fio

```
Status:      CORRIGIDO E VALIDADO EM PRODUÇÃO — para a propriedade demonstrada
Detectado:   2026-07-30, durante a Fase 5B do INC-003
Reproduzido: 2026-07-31, produção, SHA 2e535fa
Correção:    3ee7d85, mesclada em master por 54bd865 (PR #95)
Validado:    2026-07-31, produção, SHA 54bd865
Severidade:  histórico fragmentado; duas capacidades silenciosamente inertes
Corrige:     turnos consecutivos de uma mesma conversa ativa são associados à
             mesma conversa persistida
Não corrige: M2 (aba duplicada/restaurada) — limitação conhecida
```

## O fato observado

| quando | turnos | `copilot_conversas` |
|---|---:|---:|
| Fase 5B | 2 | 5 → **7** |
| Fase 6B | 1 | 7 → **8** |

**Uma linha por requisição.** Oito conversas, um único cliente, um único usuário.

A prova mais direta está numa coluna: `atualizada_em` só é escrita no ramo de
reúso de `garantirConversa`. Nas **oito** linhas, `atualizada_em = criada_em`.

> **Esse ramo nunca executou.**

E nenhuma conversa tem mais de um turno.

## A causa, demonstrada

`garantirConversa` **sabe** reutilizar — e valida posse antes:

```ts
if (conversaId) {
  const { data } = await admin.from("copilot_conversas")
    .select("id, cliente_id").eq("id", conversaId).maybeSingle();
  if (linha && linha.cliente_id === clienteId) {   // posse conferida
    await admin.from("copilot_conversas")
      .update({ atualizada_em: … }).eq("id", linha.id);
    return linha.id;                                // REUSA
  }
}
… insert …                                          // só aqui cria
```

A distinção que importa:

> **Não é que `garantirConversa` sempre cria. É que ela nunca recebe o id.**

A cadeia:

| fronteira | `conversaId` | evidência |
|---|---|---|
| rota → resposta HTTP | **devolve** | `...(conversaId ? { conversaId } : {})` |
| `conversaDoAssistente` (tipo) | **declara** | `conversaId?: string` — *"O fio no banco. A tela devolve na próxima chamada."* |
| `conversaDoAssistente` (parse) | **lê** | `typeof e.conversaId === "string" ? { conversaId: e.conversaId } : {}` |
| `ChatDaOperacao` | **ignora** | zero ocorrências de `conversaId` no arquivo |
| `ConversaGuardada` | **não tem campo** | `{ versao, turnos, falas }` — `paraGuardar` não o copiaria |
| `conversar()` → corpo HTTP | **não envia** | `{ mensagem, falas, contexto, produtoAberto }` |
| rota → `garantirConversa` | recebe `null` | `corpo.conversaId ?? null` |

O backend fala; ninguém do outro lado escuta. O contrato está escrito e não
implementado — o comentário do tipo descreve um comportamento que não existe.

Sintoma irmão na mesma cadeia: `rota` e `produto_id` são `null` nas oito linhas,
pelo mesmo motivo — o cliente não os envia.

## Isto não é só histórico fragmentado

Duas capacidades keyadas em `conversaId` ficam **inertes por construção**:

- **`ultimaApresentacao(cliente, conversaId)`** — é o que faz *"o segundo"*
  virar um id no turno seguinte. Filtrando por uma conversa recém-criada, ela
  sempre devolve `[]`. A referência estruturada nunca resolve.
- **`draftAbertoDaConversa(cliente, conversaId)`** — o rascunho de cadastro
  daquele fio. Também nunca encontra. *(Há `draftsAbertos(cliente)`, por
  cliente, que pode compensar em parte — não verificado.)*

Nenhuma das duas falha visivelmente. Elas devolvem vazio, que é
indistinguível de "não havia nada".

## A semântica de fio já está declarada — e é outra

`ChatDaOperacao.tsx`, linha 262:

```ts
/** O fio. Vive aqui, não no servidor: fechar a aba encerra a conversa. */
const [falas, setFalas] = useState<readonly Fala[]>([]);
```

E `conversaGuardada.ts` chama `falas` de *"o histórico no dialeto do provedor —
é o que mantém o fio vivo"*.

**Hoje o fio é `falas`, no cliente.** A linha em `copilot_conversas` não é o
fio: é um artefato por requisição.

O que existe de controle:

- **desligar/ligar modo conversa** → `setFalas([])`, mas **não** limpa `turnos`
  nem o `localStorage`. Limpa a memória do modelo, não a tela.
- **recarregar** → retoma `turnos` e `falas` do `localStorage`.
- **fechar a aba** → declarado como fim da conversa.

Não existe: botão de nova conversa, timeout, conceito de conversa encerrada no
servidor, nem reset por troca de produto.

> Não há definição de quando o fio termina **do lado do servidor**. Não inventei
> uma.

## Por que isto NÃO é um bug de uma linha

Mandar `conversaId` no corpo faria as conversas se unirem — mas responderia por
decreto uma pergunta que o produto não decidiu:

- recarregar continua a mesma conversa, ou começa outra?
- desligar o modo conversa encerra o fio no banco?
- o painel e a página própria são o mesmo fio? (o cache diz que sim)
- o fio termina por tempo? por operação concluída?
- fechar a aba encerra — mas o servidor não fica sabendo. Quem encerra?

Enquanto o cliente for a autoridade do fio e o servidor não tiver como saber que
ele acabou, unir as linhas só muda **onde** a incoerência aparece.

## Segurança — já resolvida, e vale registrar

Reutilizar id **não** abre buraco de tenant:

- posse é conferida (`linha.cliente_id === clienteId`) antes de reusar;
- id de outro cliente → não reusa, cria nova;
- UUID inexistente → `maybeSingle()` devolve `null`, cria nova;
- a escrita usa `service_role`, e o tenant vem da **sessão**, nunca do corpo.

Uma ressalva: `const { data } = await …` descarta o `error`. Um `conversaId`
malformado faria o select errar em silêncio e cair na criação — desfecho
seguro, erro invisível. É o mesmo padrão que causou o INC-004, num lugar onde
ainda não dói.

## O contrato decidido (Fase 7C)

Decisão de produto, não derivação de código:

| regra | |
|---|---|
| **A** | a conversa persistente representa o **fio do modelo** — não a página, o produto ou o request |
| **B** | turnos consecutivos do mesmo fio reutilizam o mesmo `conversaId` |
| **C** | reload **não** encerra o fio |
| **D** | fechar/reabrir a aba não encerra o fio *se o estado persistido daquele fio ainda existir* |
| **E** | trocar produto não encerra |
| **F** | painel e página própria são a mesma conversa |
| **G** | desligar o modo conversa **encerra** o fio do modelo; religar não cria conversa — o próximo turno cria |
| **H** | logout **encerra** o fio persistido daquele cliente naquele navegador |
| **I** | abas independentes **não** compartilham `conversaId` |
| **J** | o servidor não ganha conceito de "conversa ativa" — só recebe, valida posse, reutiliza ou cria |

A REGRA I **reprova** guardar `conversaId` dentro de
`zion:conversa:<clienteId>`: essa chave é de `localStorage` e é compartilhada
por todas as abas.

Separação mínima que decorre disso:

```
localStorage    zion:conversa:<clienteId>        turnos + falas   (compartilhado, durável)
sessionStorage  zion:conversa-id:<clienteId>     conversaId       (por aba, efêmero)
```

## A distinção que resolve a tensão (Fase 7C.1)

São **dois conceitos**, e podem ter tempos de vida diferentes:

| | é | vive em | morre em |
|---|---|---|---|
| **histórico local** | `turnos` + `falas` — continuidade da experiência | `localStorage`, por cliente | logout |
| **conversa ativa** | `conversaId` — o agrupamento no banco daquela interação contínua | `sessionStorage`, por aba | fechar a aba, desligar o modo, logout |

> **"Mesmo contexto do modelo" não implica "mesma linha de conversa no banco."**

Fechar a aba encerra a conversa ativa. Reabrir restaura o histórico local — que
segue alimentando o modelo como contexto — e o próximo turno **cria uma conversa
nova**. Isso é o contrato, não um defeito.

## Por que isso não cria autoridade falsa

O risco era: o modelo "lembrar" de algo que as ferramentas da conversa
persistida não conseguem encontrar.

Não acontece, e a prova é o próprio domínio. Com uma conversa nova,
`ultimaApresentacao` devolve `[]`, `conjuntoVigente` devolve `null`, e
`resolverEscolha` responde:

> *"Eu não mostrei uma lista agora há pouco. Me diga qual produto, pelo nome ou
> pelo código."*

**Recusa perguntando, não adivinhando.** E rejeita id fora do conjunto — o
comentário da função chama isso de *"a definição de alucinação estrutural"*.

Vale dizer o que isso significa: essa inconsistência **já existe hoje, em todo
turno**, porque hoje toda requisição cria conversa nova. A correção não a
introduz — reduz a janela de "sempre" para "só depois que a conversa ativa
terminou".

## Multi-tab: M1 é requisito, M2 é limitação conhecida

**M1 — abas abertas independentemente não compartilham `conversaId`.**
Garantido pela plataforma: `sessionStorage` é por aba.

**M2 — aba duplicada ou restaurada não compartilha.** **Não garantido.** O
Chrome copia o `sessionStorage` na duplicação e o restaura em "reabrir aba
fechada" e em restauração de sessão. Nenhum mecanismo pequeno distingue uma
cópia byte a byte de um reload — um `tabId` seria copiado junto. Fechar exigiria
`BroadcastChannel`, lock ou listener de `storage`.

**Por que M2 pode ficar como limitação:** compartilhar `conversaId` numa
duplicação **não produz mutação operacional incorreta**.

- `conjuntoVigente` poderia devolver a lista da outra aba, e `resolverEscolha`
  resolveria "o segundo" contra ela;
- o desfecho é trocar o Draft ativo (`gerenciar_cadastro` tem efeito
  `rascunha`) ou devolver identidade de produto com aviso — **não existe
  caminho de escrita ali**;
- toda mutação continua exigindo Proposal persistida com `alvos` concretos e um
  clique num cartão que **nomeia o alvo**;
- propostas **não** atravessam o `localStorage` (`paraGuardar` as exclui de
  propósito), então a aba duplicada não herda cartão pendente.

O dano possível é **resolução de referência errada no fluxo de cadastro** —
visível, do mesmo cliente, sem escrita. Não é silencioso.

## A implementação (Fase 7D)

Quatro arquivos, **só no cliente**. Backend, `garantirConversa`, schema,
migration e RLS **intocados** — a posse já era conferida lá.

| arquivo | |
|---|---|
| `conversaGuardada.ts` | `+ chaveDoFio()` → `zion:conversa-id:<clienteId>`. Shape e `VERSAO_ATUAL` **inalterados** |
| `ChatDaOperacao.tsx` | estado `conversaId`, hidratado do `sessionStorage` no mount; enviado; regravado do response; removido no toggle do modo |
| `conversaDoAssistente.ts` | `conversar(..., conversaId?)`; o corpo só inclui a chave quando há id |
| `ClientPortalShell.tsx` | `sair()` remove as duas chaves daquele cliente antes do `signOut()` |

O id do **servidor** é a autoridade: se o que foi enviado era inexistente,
malformado ou de outro cliente, `garantirConversa` cria outro e o cliente adota
o que voltou.

### Ciclo de vida

| evento | histórico local | conversa ativa |
|---|---|---|
| turno seguinte · reload · trocar produto · trocar rota | preserva | **preserva** |
| fechar aba · nova aba | preserva | **cria no próximo turno** |
| desligar/religar modo | preserva | **cria no próximo turno** |
| logout | **limpa** | **limpa** |

### Provas

17 testes sobre o **corpo real da requisição**, capturado por um `fetch` de
mentira. **7 deles falham no código anterior**, verificado restaurando-o.

Gate: typecheck · typecheck:test · lint 0 erros · **1753 testes, 0 falhas** ·
build 76 páginas.

O que **não** foi testado por execução: hidratação, toggle e logout vivem em
`.tsx`, que o `npm test` typecheca e **nunca roda**. Estão provados por
construção, com guardas de fonte — inclusive a invariante que sustenta M1: o id
usa `sessionStorage` e **nunca** `localStorage`.

## A validação em produção (Fase 7F)

Produção rodando `54bd865`, sessão real, fio limpo. Três turnos na **mesma aba**,
todos de leitura:

```
sessionStorage  zion:conversa-id:<cliente>  →  ausente

turno 1  "obrigado"                          → proximo_passo  →  id NASCE: 47dd11cd…
turno 2  "quantos produtos estão sem custo?" → contar         →  id INALTERADO
   ── reload da aba ──                                            id SOBREVIVE
turno 3  "quantos produtos estão sem peso?"  → contar         →  id INALTERADO
```

No banco:

```
conversa 47dd11cd-bca2-41c4-8796-e0022c86b87d
  criada_em     03:05:14
  atualizada_em 03:05:51        ← reusada
  6 mensagens, em ordem, os três turnos
```

**Uma conversa. Três turnos.** E `atualizada_em > criada_em`: o ramo de reúso de
`garantirConversa` — que não havia executado em nenhuma das oito conversas
anteriores — **executou**.

| | antes | depois |
|---|---:|---:|
| conversas | 8 | **9** (uma, não três) |
| reusadas | 0 | **1** |
| com mais de um turno | 0 | **1** |

O reload confirmou a REGRA C por observação, e não mais por construção: o id
sobreviveu, os turnos voltaram à tela, e o terceiro caiu na mesma conversa.

Mutação operacional **zero**: 159 variantes sem peso, Vizzano `0.000 | 0.410`,
propostas 1, ações 0, cadastros 0, procedência 0. Só ferramentas `le` rodaram.

## Ainda NÃO validado

- **`ultimaApresentacao` e `draftAbertoDaConversa`** — não exercitados. Exigem
  um turno que apresente lista e outro que diga "o segundo", o que entra em
  `gerenciar_cadastro` (`rascunha`);
- **M2** — aba duplicada ou restaurada, não testada;
- **fechar e reabrir a aba** encerrando a conversa ativa — comportamento
  esperado do contrato, não observado;
- se `draftsAbertos` compensa o draft por conversa;
- retomada entre dispositivos;
- as sete conversas órfãs — **nenhuma limpeza retroativa**.

O que está validado é a propriedade nomeada no cabeçalho, e só ela.
