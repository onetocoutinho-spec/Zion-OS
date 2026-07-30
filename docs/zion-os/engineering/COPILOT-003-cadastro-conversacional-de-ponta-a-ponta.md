# COPILOT-003 — Cadastro conversacional, de ponta a ponta

**Data:** 2026-07-29
**Ramo:** `feat/copilot-lote-com-escopo-congelado`
**Sucede:** COPILOT-002 (as duas primitives) · COPILOT-001 (segurança, concluída)
**Portão:** 1283 testes · TS 0 · lint sem erros · build ok

A vertical fechada:

```
conversa → fatos → Draft persistido → variantes → busca → resumo
        → Proposal → confirmação → revalidação → reserva → criação → auditoria
```

---

## DOMÍNIO — `draftDeCadastro` e `RascunhoProduto`

`RascunhoProduto` **continua sendo a autoridade**. Não existe um segundo motor.

| | `RascunhoProduto` (`catalog/domain/cadastroManual`) | `DraftDeCadastro` (`assistant/domain`) |
|---|---|---|
| O que é | o crivo do obrigatório | o estado da conversa |
| Vive | num turno de React | numa linha de `copilot_cadastros` |
| Sabe | campos planos, um par cor/tamanho | procedência, grade, conflitos, ciclo de vida |
| Decide | **o que impede criar** | o que perguntar em seguida |

A travessia é uma função só, `paraRascunho`, e depois dela quem manda é
`validarRascunho` + `montarProduto`. **Não existe uma segunda lista de campos
obrigatórios em lugar nenhum** — `prontidao()` chama `validarRascunho` e devolve
o mesmo objeto de problemas.

Provado: `assert.deepEqual(prontidao(d).problemas, validarRascunho(paraRascunho(d)))`.

### O que o Draft sabe a mais, e não se perde

- `modelo` (a referência do lojista) → gravado em `produtos.modelo` na criação
- `ean` → vive na variante; o rascunho não tem variantes
- a grade inteira → vira `produto_variantes`

---

## FATOS — como a procedência é preservada

Cada fato é `{ valor, procedencia }`. A força decide quem sobrescreve quem:

```
informado (3) > catalogo (2) > derivado (1) > inferido (0)
```

- **fonte mais fraca não substitui a mais forte** — devolve o motivo
- **campo crítico não aceita `inferido`** — `aceitarFato` recusa (custo, preço, SKU, EAN, peso)
- **mesma força + valor diferente + campo crítico → CONFLITO**, não a última palavra

O conflito é a decisão mais consequente deste módulo. Dois custos ditos na mesma
conversa não são um erro de digitação presumido: são duas afirmações. O domínio
guarda as duas, **não sobrescreve**, e não fica pronto enquanto o lojista não
disser qual vale — mesmo que `validarRascunho` já aprove o rascunho.

Campo **não** crítico (nome, cor, categoria) aceita a correção direto: ali a
última palavra é claramente a correção.

Dinheiro em **centavos inteiros** o caminho todo; a borda escreve `R$ 47,80`.
O modelo nunca vê `4780` — ele repetiria isso numa frase.

### O SKU do produto pai — investigado, não adaptado

`validarRascunho` exige `sku`, e ele é campo crítico. Com grade:

- **uma variante com SKU** → o pai **deriva** dela. Não é inferência: é
  literalmente o que `CadastrarProduto` faz hoje (o mesmo SKU vai para os dois).
- **duas ou mais** → **não há derivação**. Eleger uma variante como
  representante do pai seria invenção. O domínio pergunta.

---

## VARIANTES — como a grade entra no Draft

`gradeDeVariantes` faz o trabalho; o Draft costura.

- `definirGrade` → cartesiano dos eixos
- **redefinir NÃO apaga identificador**: quem continua existindo (casamento por
  cor+tamanho) mantém SKU e EAN. Sem isso, "ah, também tem bege 39" jogaria fora
  cinco SKUs já informados e ninguém perceberia até o pedido sair errado.
- `associarNaVariante` → recusa alvo ambíguo **com os candidatos**

### Custo compartilhado — a semântica foi inspecionada

`CadastrarProduto` grava o custo no **produto pai** e copia o mesmo valor para a
variante que cria. O Draft respeita isso: custo e preço são fatos do produto, e
cada variante criada recebe a cópia. **O Draft nunca pergunta custo por
variante** — inventar aqui uma semântica que o resto do sistema não tem daria
dois significados para a mesma coluna.

**Estoque é a exceção, e ela é deliberada.** Com mais de uma variante, o estoque
informado fica no pai e as variantes nascem com **zero**. "40 pares" com seis
variantes não diz quantos são pretos 37: dividir por seis inventaria, repetir 40
em cada uma multiplicaria o estoque por seis. Zero é o que o sistema sabe.

---

## PERSISTÊNCIA — schema e ciclo de vida

**Migração 037**, entregue e **não aplicada**.

### Ciclo de vida

```
ativo ⇄ pronto_para_finalizar → aguardando_confirmacao → criado
  └──────────────┴──────────────────────┴─────────────→ cancelado
```

`criado` e `cancelado` são **terminais**. `pronto_para_finalizar` não é opinião
do modelo: é `validarRascunho` sem problemas **e** zero conflitos abertos, e o
status é **recalculado pelo domínio** a cada fato.

Um fato novo **não** tira o Draft de `aguardando_confirmacao`: a Proposal já foi
montada sobre o estado anterior, e quem decide o destino dela é a revalidação.

### Forma — a pergunta foi "como isso é consultado e atualizado?"

Um Draft é sempre lido inteiro e gravado inteiro. Não existe consulta do tipo
"drafts cujo fato X é Y", nem atualização parcial fora do domínio.

| Coluna | Por quê |
|---|---|
| `cliente_id` | RLS e isolamento — não sustenta política dentro de jsonb |
| `status` | ciclo de vida com `CHECK` — jsonb não aceita |
| `conversa_id` | retomada e a trilha usuário→conversa→cadastro |
| `produto_id`, `proposta_id` | o desfecho e a autorização, com FK real |
| `versao` | escrita concorrente (duas abas na mesma conversa) |

| JSONB | Por quê |
|---|---|
| `fatos`, `variantes`, `conflitos` | só o domínio interpreta, e evoluem com ele |

**Não normalizamos variantes numa tabela.** Elas não são consultadas fora do
Draft, e a única invariante que uma tabela permitiria — SKU único — **é falsa
nesta base**: 117 SKUs e 112 EANs duplicados. Criaria índices para consultas que
não existem e prometeria unicidade que o catálogo real não tem.

`formato smallint` versiona o jsonb. Um `CHECK` garante a coerência do desfecho:
`(status = 'criado') = (produto_id is not null)` — `criado` sem produto é mentira
sobre o que aconteceu; produto sem `criado` é produto nascido fora do caminho.

**Não existe unicidade "um cadastro aberto por conversa".** Pareceria proteção e
seria uma parede: um lojista pode cadastrar dois produtos no mesmo fio. O reuso
acontece no serviço, onde há o que fazer a respeito.

---

## BUSCA — como candidatos são tratados

Reusa a **Busca Forte**. As tentativas saem dos fatos, na ordem de força:
`modelo` → SKUs (do pai **e das variantes**) → EANs → nome (só com 8+ caracteres,
e só quando não há identificador melhor).

| Achados | O que acontece |
|---|---|
| nenhum | segue como produto novo, sem aviso |
| um | *"Já existe um produto que pode corresponder a esse cadastro."* — **não cria, não bloqueia, não funde** |
| vários | mostra todos, numerados; **nunca `results[0]`** |

**Match exato não virou identidade.** SKU/EAN/modelo repetidos não disparam merge
— nesta base a repetição é legítima. Fuzzy nunca bloqueia, cria ou mescla.

A busca roda **a cada fato novo**: é a chegada da referência ou do SKU que a
torna possível, e avisar só no fim faria o lojista descrever seis variantes antes
de descobrir que o produto já existia.

---

## RETOMADA

`escolherParaRetomar(abertos, dica)`:

- **0** → "você não tem nenhum cadastro em andamento"
- **1** → retoma
- **N** → mostra numerado, **não escolhe**, e a lista vai para a tela *e* para a
  metadata da mensagem

A `dica` ("continua o da Modare") filtra. Se filtrar para um, retoma. Se não
casar com nada, mostra todos — melhor mostrar demais que dizer "não achei" sobre
algo que existe.

A escolha resolve para `draftId`. **`"o primeiro"` nunca é persistido.**

---

## CANCELAMENTO

`status → cancelado`. **Não apaga.** O cadastro sai da lista de abertos, não
aceita mais dados, não finaliza, e continua legível e auditável.

Um teste encontrou um buraco real aqui e ele foi fechado nos **dois** lugares: um
cadastro cancelado continua tendo nome, SKU e preço, então `prontidao` sozinho o
aprovaria. Agora `propor_criacao` exige Draft aberto **e** `criarProdutoDoDraft`
exige `aguardando_confirmacao` na borda que escreve.

---

## CONTEXTO — "o segundo"

`copilot_mensagens` **não tinha** metadata estruturada. A 037 adiciona
`metadata jsonb`, e a mensagem do assistente passa a guardar o que ela mostrou:

```json
{"candidatos":{"origem":"busca","itens":[{"ordem":1,"tipo":"produto","id":"…","rotulo":"…"}]}}
```

`"o segundo"` resolve para `productId B` **uma vez, no servidor**, contra o
conjunto daquela mensagem. Daí em diante toda ação usa B.

**A regra que impede confundir listas:** só o conjunto da **última** fala do
assistente é referenciável. A varredura para na primeira fala do assistente — se
ela não mostrou lista, não existe lista corrente, e a resposta certa é perguntar.
Continuar procurando acharia a de três turnos atrás e a trataria como "a lista".

Um SKU **não** é um ordinal: `lerOrdinal("01040533")` devolve `null`.

---

## FINALIZAÇÃO — Draft → Proposal → criação

```
propor_criacao
  ├── Draft aberto?         não → recusa
  ├── validarRascunho       problemas → recusa, dizendo o que falta
  ├── busca de AGORA        → congela o conjunto em precondições
  └── devolve o pedido       → a ROTA persiste
                                 salvarDraft
                                 criarProposta(tipo: "cadastro", alvos: [draftId])
                                 aguardarConfirmacao(draft, propostaId)
                                 salvarDraft
```

A Proposal de criação **reusa `copilot_propostas`**. Não existe segunda primitive
de aprovação: as três proteções são as mesmas — identidade, precondições,
idempotência. `tipo` ganhou `'cadastro'` (migração), `alvos` carrega o **id do
Draft**, e uma coluna `draft_id` com FK torna a auditoria um join em vez de uma
interpretação de array de uuids.

**Gemini não monta o objeto final.** Ele extrai fato a fato; o domínio guarda,
converte e valida. Não existe um JSON de produto escrito pelo modelo.

---

## SEGURANÇA

**Tenant.** Vem da sessão, sempre. Nunca do Gemini, nunca do corpo. O contexto do
cadastro (Draft, abertos, referências) é montado **pela rota** — a rota constrói
`ContextoDasFerramentas` campo a campo e este não está entre os que ela lê da
requisição. Draft de outro tenant é **indistinguível de inexistente**:
`draftVisivelPara` decide, a frase é a mesma, e a diferença fica no log.

**Stale.** A Proposal congela o conjunto de possíveis duplicatas: uma precondição
por candidato **mais** o total.

```
candidato que SUMIU     → chave vira null → obsoleta
candidato que APARECEU  → total muda      → obsoleta
um TROCADO por outro    → a chave dele muda → obsoleta   (só o total deixaria passar)
```

O cenário obrigatório está provado: T0 sem `7178.102` → T2 a importação cria um
→ T3 o cliente confirma → `candidatosDoCadastro` passa de 0 para 1 → **nenhum
produto criado**, e a tela diz *"O catálogo mudou desde que preparei este
cadastro."*

**Idempotência.** A mesma transição atômica `pendente → executada` que já
existia. Duplo clique, retry e refresh disputam a linha; um ganha, os outros
recebem "já foi feito" — que na tela aparece como **sucesso**, porque foi.

### A invariante `Efeito` — ela disparou, e isso é o desenho funcionando

O cadastro precisa acumular estado entre turnos. Isso não cabia em `"le"` nem em
`"propoe"`, o `typecheck:test` reprovou a build, e a revisão aconteceu.

**Decisão:** existe um terceiro efeito, `"rascunha"`. Ele toca
`copilot_cadastros` — estado da **conversa**, ao lado de `copilot_mensagens`, que
a rota já grava a cada turno. A garantia que importa continua exatamente onde
estava:

> **nenhuma ferramenta toca em `produtos` nem em `produto_variantes`**

Uma ferramenta `rascunha` **recebe** o Draft e **devolve** o Draft modificado.
Ela não persiste — quem persiste é a rota, com o tenant da sessão.
`executarFerramenta` continua puro. `escreve` continua não existindo, e o
**quarto** efeito reprova a build de novo.

O produto nasce por um caminho só: Proposal → clique humano →
`/api/assistente/proposta` → revalidação → reserva → criação.

---

## AUDITORIA — a trilha produzida

```
auth.users.id            copilot_acoes.executada_por
   └─ conversa           copilot_conversas.id
       └─ mensagens      copilot_mensagens (+ metadata: o que foi mostrado)
       └─ Draft          copilot_cadastros (fatos, procedência, variantes, versao)
           └─ Proposal   copilot_propostas (draft_id, precondições, resumo lido)
               └─ ação   copilot_acoes (antes, depois, resultado, afetados)
                   └─    produtos.id + produto_variantes
```

O Draft **não** é duplicado dentro do log: `copilot_acoes.depois` guarda
`{produtoId, nome, sku, variantesCriadas, variantesPedidas, draftId}`, e o
`draft_id` da Proposal fecha o resto. **Recusas também são auditadas** — cadastro
incompleto, outro tenant e stale entram como `recusada`.

`resultado: "parcial"` existe e é usado: o produto nasceu e a grade não. Chamar
isso de sucesso esconderia seis variantes; de falha, um produto.

---

## TOOLING

**Uma** ferramenta, `gerenciar_cadastro`, com operações controladas:

```
iniciar · informar · variantes · identificador · resumo
retomar · escolher · resolver_conflito · cancelar · propor_criacao
```

Não vinte microferramentas (`adicionar_cor`, `adicionar_sku`, …): vinte nomes
parecidos fariam o modelo escolher entre vinte caminhos a cada frase, e cada nome
novo seria uma chance a mais de errar. Gemini interpreta linguagem; **o domínio
executa transições válidas**.

O modelo nunca recebe o Draft — recebe resumo, contagem e o que falta. Um teste
guarda isso: `assert.equal("fatos" in saida.cadastro, false)`.

---

## UI — estados implementados

`ChatDaOperacao` ganhou `CartaoDoCadastro`. As decisões vêm de
`cartaoDoCadastro.ts` (domínio provado), não do componente.

| Estado | O que aparece |
|---|---|
| `escolha` | "Você tem N cadastros em andamento", numerados, sem botão |
| `coletando` | rótulo, o que já sei (com selo de procedência quando não foi informado), a grade por cor, conflitos, candidatos, e o que falta |
| `pronto` | resumo, **sem** botão (não há autorização ainda) |
| `proposta` | resumo + **[Criar produto com N variantes]** |
| `concluido` | sucesso com link para o produto real, ou stale, ou recusa |
| `cancelado` | "Cadastro cancelado. Nada foi criado." |

**O botão só existe com `propostaId` e `status = aguardando_confirmacao`.**
Qualquer desfecho tira o botão — inclusive o de sucesso.

---

## HIGGSFIELD — estados para exploração de UX

Estes existem de verdade agora, com dado real por trás. São a matéria-prima para
desenhar a experiência.

| # | Estado | O que o sistema tem para mostrar |
|---|---|---|
| 1 | **iniciar cadastro** | Draft vazio; "me passa o que você já sabe" |
| 2 | **Draft parcial** | rótulo, fatos com procedência, versão, timestamps |
| 3 | **coleta de informação** | lista ordenada do que falta, separada em bloqueia / não bloqueia, cada item com o *porquê* |
| 4 | **variantes** | grade agrupada por cor, total, quantas sem SKU / sem EAN |
| 5 | **conflito** | campo, os dois valores escritos, e a pergunta "qual vale?" |
| 6 | **possível duplicidade** | 1..8 candidatos com marca, nome, referência, SKU e **como foi achado** (`sku_exato` vs `candidato_textual`) |
| 7 | **desambiguação** | conjunto numerado + resolução por ordinal ("o segundo") |
| 8 | **retomada** | N cadastros abertos com rótulo e data, incluindo "Produto ainda sem nome" |
| 9 | **resumo** | a frase da criação: nome, SKU, preço, custo, nº de variantes |
| 10 | **confirmação** | Proposal com validade de 30 min, risco `alto`, e o texto exato que foi lido |
| 11 | **stale** | "O catálogo mudou desde que preparei este cadastro" + o que mudou |
| 12 | **sucesso** | produtoId real, nome, SKU, variantes criadas vs pedidas (parcial!) |
| 13 | **cancelamento** | cadastro fora dos abertos, ainda legível |

Dois eixos que valem desenho e hoje são texto: a **procedência** por campo
(selo? cor? ícone?) e a distinção entre **bloqueia** e **não bloqueia** na lista
do que falta.

---

## MIGRATIONS

| # | Estado |
|---|---|
| 035 — copilot: propostas e conversas | **APLICADA** |
| 036 — índices para a busca forte | **PENDENTE** de aplicação manual |
| 037 — cadastro conversacional | **PENDENTE** de aplicação manual (entregue nesta sessão) |

Não há 038. Tudo o que a 037 faz é a mesma vertical: a tabela do Draft, o tipo
`cadastro` na Proposal com o `draft_id`, e o `metadata` da mensagem que sustenta
a desambiguação do cadastro. Separar em duas seria numerar por estética.

---

## TESTES

| Arquivo | Novos |
|---|---|
| `draftDeCadastro.test.ts` | 44 |
| `cadastroPelaFerramenta.test.ts` | 31 |
| `candidatosDoCadastro.test.ts` | 25 |
| `referenciasDaConversa.test.ts` | 19 |
| `cartaoDoCadastro.test.ts` | 13 |
| `ferramentasDoAssistente.test.ts` | +2 |
| **Total novo** | **134** |
| **Suíte** | **1283** (era 1149) |

Um teste encontrou defeito real: cadastro cancelado passava em `propor_criacao`.
Corrigido na ferramenta **e** na borda que escreve.

---

## PORTÃO

```
1283 testes · TS 0 · typecheck:test 0 · lint sem erros · build ok
```

---

## LIMITAÇÕES REAIS

1. **Completar um produto existente a partir do Draft não existe.** Quando o
   lojista escolhe um candidato de duplicidade, o sistema diz isso em vez de
   fingir. É outro caminho de escrita (update, não insert) e precisaria da
   própria Proposal.
2. **O cartão do cadastro não sobrevive ao F5.** O `localStorage` guarda o texto
   dos turnos, não o cartão — mesma regra da Proposal, e deliberada: um convite a
   gravar guardado em disco pode ser aceito amanhã. O **Draft** sobrevive, no
   banco, e volta por "continua aquele cadastro".
3. **Estoque por variante não é coletado.** Com grade, as variantes nascem com
   zero. Ver a seção de custo compartilhado.
4. **Nada foi exercido em tela.** A bateria manual continua adiada por decisão do
   dono, e o roteiro cresceu de novo com esta vertical.
5. **037 não aplicada.** Até a aplicação, `gerenciar_cadastro` falha ao gravar o
   Draft (tabela ausente) e a conversa segue sem cadastro — o `salvarDraft`
   devolve `false` e loga, sem derrubar a resposta.
