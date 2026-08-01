# INC-002 — O lote de peso sobrescreve variantes que já tinham peso

```
Status:      PARCIALMENTE CORRIGIDO — duas causas fechadas; a identidade não
Detectado:   2026-07-30, durante o slice de consequência (CONSEQ-001)
Severidade:  era CORRUPÇÃO SILENCIOSA de dado, sem trilha de recuperação
Correção 1:  sobrescrita — mínima aplicada em 2026-07-30 (sem migration)
Correção 2:  referência derivada envelhecida — af0217b, mesclada por bed2a64
             (PR #97), 2026-07-31
```

> **NÃO diga "INC-002 resolvido".** Duas causas foram fechadas; as invariantes
> maiores continuam abertas. A qualificação está em
> [§Estado da correção](#estado-da-correção).

---

## As duas causas, separadas

| | causa | estado |
|---|---|---|
| **1 · histórica** | a mutação escrevia em **todas** as variantes do produto, inclusive as já pesadas — o MAX caía e o frete ia junto | **fechada** por `.lte("peso", 0)` dentro do UPDATE |
| **2 · referência derivada** | o valor derivado de `pesoConhecidoDoProduto` continuava elegível depois que a referência que o justificou mudou ou deixou de existir | **fechada** por uma segunda precondição, `pesoConhecido:<id>` |

A segunda **não estava documentada aqui nem no [INC-002-D](./INC-002-D-desenho-da-primitiva-transacional.md)** — foi encontrada em 2026-07-31, ao reconstituir a cadeia `proposta → precondições → revalidação → escrita`.

---

## Estado da correção

### CORRIGIDO — o preenchimento nunca substitui peso existente

Os **dois** caminhos de escrita passaram a levar `.lte("peso", 0)` **dentro do
UPDATE**, aplicado pelo banco:

| caminho | antes | depois |
|---|---|---|
| lote (`route.ts`) | `.in("produto_id", p.alvos)` | `+ .lte("peso", 0)` |
| individual (`route.ts`) | `.eq("produto_id", produtoId)` | `+ .lte("peso", 0)` |

**Predicado, não filtro em JavaScript.** Filtrar `antesLote` em memória e mandar
só os ids pareceria equivalente e deixaria aberta a janela entre a leitura e a
escrita.

`peso <= 0` e não `IS NULL`: a coluna é `numeric NOT NULL DEFAULT 0`, então
`IS NULL` é inalcançável. É a **mesma** definição que `lerEstadoAtual` já usava —
nenhuma semântica nova entrou.

**Evidência contra o Postgres real, em transação revertida:**

| sentinela | variantes | elegíveis | afetados | preenchidas alteradas | MAX antes → depois |
|---|---:|---:|---:|---:|---|
| **Vizzano** | 39 | 3 | **3** | **0** | **410 g → 410 g** |
| **peso maior** (A vazia, B=500 g, aplica 200 g) | 2 | 1 | **1** | **0** | **→ 500 g** |
| **drift** (A ganha peso antes do UPDATE) | 3 | 3 | **2** | **0** | A preservada em 777 g |

`afetados` passou a contar **linhas realmente escritas**. A mensagem ganhou uma
ressalva quando `afetados < elegiveis`, para não afirmar mais do que aconteceu.

#### O caso extremo, e o que a tela passou a dizer

A corrida não tem só a forma parcial. No limite:

```
N elegíveis no retrato anterior
N preenchidas concorrentemente
0 escritas
proposta marcada `falhou` — e NADA foi sobrescrito
```

Isso tornou alcançável um ramo que, para peso, antes praticamente não era:
`afetados === 0`. A mensagem dizia *"o produto não foi encontrado"* — verdadeira
quando o alvo sumia, **falsa** nesta corrida, em que o produto está inteiro.

Passou a ser: *"Não gravei nada — os dados podem ter mudado desde a confirmação."*
Ela **não diagnostica**, e isso é deliberado: daqui não dá para separar "o alvo
sumiu" de "nada restou elegível". `elegiveis` não serve de prova — é o retrato
**anterior** ao UPDATE e continua > 0 justamente na corrida. Distinguir exigiria
uma consulta nova depois da escrita, e a resposta seria um palpite com cara de
causa. O rastro técnico (`nenhuma linha afetada`), o 409 e o estado `falhou` da
proposta continuam como estavam.

### CORRIGIDO — a referência derivada não sobrevive a si mesma

*(causa 2, encontrada e fechada em 2026-07-31)*

A única precondição do lote era `variacoesSemPeso:<id>` — a **contagem** de
vazias. Ela é cega ao que **justifica** o número.

Demonstrado contra o Postgres real, em transação revertida, na Vizzano:

```
T0     3 vazias, 36 pesadas todas em 410 g   →  proposta de 410 g
drift  UMA pesada vai de 410 para 500, nenhuma esvazia
T1     3 vazias (a precondição PASSA), pesos distintos 1 → 2
escrita  3 variantes receberam 410 g
```

Em T1, `pesoConhecidoDoProduto` devolveria **`null`**: com irmãs discordando não
existe *"o peso do produto"*, e o domínio teria **recusado propor**. A proposta
executou assim mesmo, com a referência de T0.

**Os testes do INC-002-D não pegam isto.** R4 cobre troca de **alvos** — aqui os
alvos não mudam. R10 exige que o MAX permaneça — aqui ele até sobe. A RPC do §E
valida os alvos, nunca a **origem do valor**.

A correção usa o mecanismo que já existia: uma segunda precondição por alvo,
`pesoConhecido:<id>`, congelando a referência.

| | |
|---|---|
| `podeExecutar` | **não mudou** — compara valor a valor como sempre |
| `lerEstadoAtual` | recomputa **do banco**: um peso distinto entre as pesadas, ou `null` |
| unidade | **gramas**, como a proposta congela — nunca o MAX de conjunto heterogêneo (seria o INC-001) |
| escopo | condicional: só `preparar_resolucao` **deriva**; em `propor_gravacao` o lojista **dita** o número |

Prova final, mesma transação revertida: contagem `3 → 3` **passa**, referência
`410 → null` **quebra**, veredito **recusa**, zero escrita, zero resíduo.

16 testes; os de fiação falham no código anterior. Cobrem unidade (não kg, não
string), o não-MAX, chave ausente que **não** vale como satisfeita, e a ordem
`expirada` antes de `obsoleta`. Sem schema, migration, RLS ou RPC.

**Teto:** *uma proposta de peso derivada de outras variantes não pode continuar
elegível quando a referência factual que justificou aquele valor mudou ou deixou
de ser única.* Nada além disso. **Não observada em produção.**

### NÃO CORRIGIDO

1. **A identidade das variantes não é congelada na proposta.** `alvos` são
   produtos; nenhum `varianteId` é persistido.
2. **A revalidação compara cardinalidade, não identidade**
   (`propostaPersistida.ts:217`). A troca {A,B,C} → {B,C,D} com a mesma contagem
   passa.
3. **Drift pode mudar o conjunto entre a proposta e a execução.**
4. **A operação NÃO é all-or-nothing** sobre o conjunto aprovado. A sentinela de
   drift mostra 2 escritas de 3 — e isso é a limitação **conscientemente
   aceita**, não um defeito residual escondido.
5. **O caminho 2 materializa a apresentação a partir de contexto do cliente**
   (`conversa/route.ts:262`). O cartão pode mostrar números que o servidor nunca
   conferiu — a execução, essa sim, é revalidada contra o banco.
6. **R5 não foi demonstrável neste ambiente.** Sem duas conexões controláveis
   (sem `psql`, sem string de conexão, sem `pg`, sessão do MCP não persiste), a
   atomicidade all-or-nothing continua provada só por análise de locking.

O fechamento forte exige autoridade de identidade + revalidação por conjunto +
primitiva transacional demonstrada. O desenho está em
[INC-002-D](./INC-002-D-desenho-da-primitiva-transacional.md).

> Relacionado a [INC-001](./INC-001-peso-parcial-invisivel.md): os dois nascem do
> mesmo `MAX` sobre as variantes. O INC-001 é perda de informação na **leitura**;
> este é perda de dado na **escrita**.

---

## O defeito

### INTENÇÃO ≠ ALVO DA ESCRITA

A superfície promete preencher o que está **ausente**. A mutação escreve em
**tudo**.

**A. O que a superfície comunica** — `modules/assistant/domain/escopoDoLote.ts:87`

```ts
const alvo = `${unidades} variaç${unidades > 1 ? "ões" : "ão"} de ${quantos} produto...`;
const ressalva = deFora > 0
  ? ` ${deFora} produto já tem ${campo} e não será alterado.`
  : "";
return `Aplicar ${comoEscrever(valor)} de ${campo} a ${alvo}.${ressalva}`;
```

O operador lê, por exemplo:

> *"Aplicar 200 g de peso a 159 variações de 14 produtos. 3 produtos já têm peso
> e não serão alterados."*

Duas afirmações, e as duas induzem ao mesmo entendimento: **só o que falta será
tocado**. `unidades` vem de `unidadesSemDado` — a contagem é explicitamente das
variações **sem** o dado.

**B. O conjunto que a proposta apresenta** — `escopoDoLote.ts:69`

```ts
const precisa = (c) => campo === "custo" ? !c.valorAtual : c.unidadesSemDado > 0;
const incluidos = candidatos.filter(precisa);
```

Um produto entra se tiver **pelo menos uma** variante sem peso. A ressalva "já tem
peso e não será alterado" fala dos produtos **inteiramente** preenchidos, que
ficam de fora — não das variantes preenchidas **dentro** de um produto incluído.

**C. O conjunto que a mutação atualiza** — `app/api/assistente/proposta/route.ts`

```ts
const { data, error } = await admin
  .from("produto_variantes")
  .update({ peso: emKgLote })
  .in("produto_id", p.alvos)      // ← TODAS as variantes do produto
  .eq("cliente_id", p.clienteId)
  .select("id, produto_id");
```

Não há filtro por peso ausente. **Toda** variante dos produtos-alvo é
reescrita — inclusive as que já tinham peso, e inclusive com um valor menor.

**D. Uma variante preenchida pode ser sobrescrita?** **Sim.** É o caminho normal,
não uma borda.

---

## Exemplo mínimo, na base real (medido em 2026-07-30, somente leitura)

Produto **"Rasteira Feminina Vizzano 6371.1005"**:

| | |
|---|---:|
| variantes | **39** |
| sem peso | **3** |
| **com peso** | **36** |
| maior peso atual | **0,410 kg (410 g)** |

O operador pede *"200 g nos produtos sem peso"*. O cartão diz que vai mexer em
**3 variações** deste produto. A mutação reescreve **as 39** — e as 36 que tinham
peso passam a valer 200 g.

**Agregado da base**, entre os 14 produtos que entrariam num lote de peso:

| medida | valor |
|---|---:|
| produtos mistos (com e sem peso) | **1** |
| **variantes com peso que seriam sobrescritas** | **36** |
| variações que o operador aprova | **159** |
| **variantes que a mutação atinge** | **195** |

O operador aprova 159 e recebe 195. A diferença — 36 — é dado existente sendo
substituído sem que nada na tela diga isso.

---

## E. O MAX pode diminuir — e o frete vai junto

`modules/pricing/domain/embalagemDoProduto.ts` toma o **maior** peso entre as
variantes, e é ele que alimenta `pesoCobravelGramas` → `custoDeEnvio`.

No exemplo: `MAX` cai de **410 g para 200 g**. O produto passa a ser precificado
como se a caixa fosse mais leve — **frete subestimado, margem superestimada**.

É a mesma família de defeito que a limpeza de 030/031 atacou: um número derivado
de uma entrada que mudou sem ninguém perceber.

`afetados` na resposta também mente por consequência: devolve `data.length` (195),
não as 159 aprovadas. O operador lê "195 variantes atualizadas" depois de aprovar
159.

---

## F. Recuperação: NÃO EXISTE

Três trilhas, nenhuma serve:

| trilha | o que guarda | serve? |
|---|---|---|
| `copilot_acoes.antes` | `{ variacoesLidas, semPesoAntes }` | ❌ **agregado** sobre todos os alvos; nenhum valor por variante |
| `procedencia_de_campo` | uma linha **por produto**, campo `peso`, com o valor NOVO | ❌ `rastroDaEscrita` **não** preenche `valorAnterior` no ramo de peso |
| `decisoes` (AIL) | `categoriaMarketplace`, `precoVenda`, `tabelaMedidas`, `custo` | ❌ **peso não está na lista** (`lib/services/produtos.ts:49-60`) |

**Os pesos anteriores por variante não são recuperáveis por nenhum caminho.** Um
lote aplicado por engano não tem desfazer, e nem sequer tem como saber o que havia.

Isso eleva a severidade: não é só escrever demais — é escrever demais de forma
irreversível e silenciosa.

---

## Comportamento esperado

Uma das duas, e é decisão de produto — não técnica:

1. **A mutação passa a respeitar a intenção:** escrever só onde o peso está
   ausente. Mantém a frase como está e alinha a escrita a ela.
2. **A frase passa a dizer a verdade:** *"substituir o peso de todas as variações
   destes produtos, inclusive as 36 que já têm"*, com o escopo e a contagem
   refletindo isso.

A opção 1 preserva o que o operador entendeu e é a que o nome do fluxo sugere
("preencher o que falta"). A opção 2 é honesta mas provavelmente não é o que
alguém quer de um comando de preenchimento em lote.

**Há um terceiro requisito, independente da escolha:** `afetados` tem que contar
o que foi aprovado, ou a frase de desfecho precisa distinguir aprovado de tocado.

---

## Risco

| dimensão | avaliação |
|---|---|
| Corrupção de dado | **alta** — dado existente substituído sem aviso |
| Reversibilidade | **nenhuma** — sem trilha por variante |
| Alcance hoje | **1 produto, 36 variantes** nesta base |
| Alcance ao crescer | proporcional a produtos com grade parcialmente medida — o padrão em catálogo importado |
| Efeito derivado | frete subestimado → **margem superestimada** no pricing |
| Visibilidade | **nula** — nada na tela indica que algo foi substituído |

---

## Escopo provável da correção

Pequeno em código, e é justamente por isso que **não** deve entrar de carona:

- o filtro da mutação (`.or("peso.is.null,peso.lte.0")` ou equivalente);
- `afetados` e o desfecho, para contarem o conjunto certo;
- os testes de `escopoDoLote` e do lote de peso, que hoje congelam o
  comportamento atual;
- **uma decisão sobre os 36 pesos já existentes**, caso algum lote já tenha sido
  aplicado — hoje `copilot_propostas` tem 0 linhas, então **nada foi sobrescrito
  ainda** por este caminho.

E precisa de uma medição antes/depois na base, porque muda o que o comando faz.

---

## NÃO CORRIGIDO NESTA PR

Deliberado, e por três razões:

1. **Corrigir mudaria a operação cuja consequência o slice CONSEQ-001 está
   medindo.** O slice mede a operação que existe; consertá-la no mesmo commit
   misturaria duas decisões e invalidaria a evidência.
2. **A escolha entre "respeitar a intenção" e "dizer a verdade" é de produto.**
3. **O defeito é anterior a esta PR e não foi ampliado por ela.** O diff do
   CONSEQ-001 não toca nenhuma linha de `update`/`insert`/`delete` — só acrescenta
   `altura, largura, comprimento` ao `select` que já existia antes do UPDATE.

**Nada foi executado para provar este defeito.** Toda a evidência acima vem de
leitura de código e de consultas somente-leitura ao banco.

---

# As cinco camadas, separadas — estado em 2026-07-31 (CICLO G / G.1)

Este incidente virou um guarda-chuva. Cinco propriedades distintas moram sob o
mesmo nome, e confundi-las é como o INC-002 seria declarado fechado sem estar.

| # | propriedade | estado |
|---|---|---|
| 1 | sobrescrita de variante já preenchida | **CORRIGIDA** — `.lte("peso", 0)`, aplicado pelo banco dentro do UPDATE |
| 2 | referência de peso obsoleta entre criação e clique | **CORRIGIDA** — precondição `pesoConhecido:<id>` (CICLO A) |
| 3 | identidade do conjunto aprovado | **CORRIGIDA — CICLO G.1**, abaixo |
| 4 | TOCTOU entre revalidação e escrita | **ABERTA** |
| 5 | atomicidade operacional (`executada` sem mutação) | **FECHADA PARA PESO, CUSTO E PREÇO** — aberta para título e cadastro |

## 3 — a identidade do conjunto (fechada no CICLO G.1)

### O que estava errado

`alvos` guarda **produtos**, não variantes. A escrita **redescobria** as
variantes elegíveis no instante do UPDATE, e a revalidação só conferia
**quantas** estavam vazias. Contagem é cega à troca:

```
aprovado {A,B,C}  →  alguém preenche C e zera D  →  {A,B,D}
contagem 3 = 3  →  a precondição APROVA  →  D recebia 410 g
```

Demonstrado em transação revertida sobre o catálogo real (Vizzano, 39 variantes,
3 sem peso), comparando os dois predicados no mesmo cenário:

| | |
|---|---|
| `\|S0\|` = 3, `\|S1\|` = 3 | contagem idêntica, precondição aprova |
| predicado **antigo** | atingiria 3 variantes — **1 não aprovada** |
| predicado **novo** | atingiria 2 variantes — **0 não aprovadas** |

### A correção

`Precondicao.idsAprovados` carrega a identidade do conjunto na entrada
`variacoesSemPeso:<produtoId>`. Os ids são lidos **no servidor**, na fronteira
que cria a Proposal, com o tenant da sessão e com o **mesmo** predicado
`peso <= 0` que a escrita usa. Sem hash — a execução precisa dos ids reais
porque ela **escreve** no conjunto, não apenas detecta que ele mudou.

É **restrição de escrita**, não precondição: `podeExecutar` não a enxerga. O
banco aplica `id IN (...)` junto de `peso <= 0` e do tenant **no mesmo
statement**, então a escrita é por construção um **subconjunto** do aprovado e
não há janela entre conferir e escrever.

**Semântica: reduzir, não invalidar.** Não foi decisão nova — é o contrato já
registrado em `desfechoDoPreenchimento`, que declara a parcialidade por corrida
em vez de escondê-la. `elegiveis` passou a contar dentro do conjunto aprovado.

**Legacy:** ausência de `idsAprovados` é o contrato antigo, **nunca** conjunto
vazio. Nada foi derivado retrospectivamente. A `903c1830…` continua legacy,
`pendente`, intocada.

## 4 — o TOCTOU que CONTINUA ABERTO

`lerEstadoAtual` faz `SELECT`, a decisão volta à aplicação, e só então o `UPDATE`
acontece. Não há `FOR UPDATE`, advisory lock nem isolation explícito — grep
confirmou zero ocorrências.

Consequência precisa, e ela **limita o alcance do CICLO A**:

> O CICLO A fechou o stale entre a **criação** e o **clique**. Não fechou entre a
> **revalidação** e a **escrita**.

O UPDATE grava `p.valor` congelado, nunca o valor recomputado. Se outra conexão
mudar uma irmã de 410 para 500 depois da revalidação, o UPDATE grava 410 assim
mesmo. `pesoConhecido:` é um portão lido no SELECT, não uma trava.

**A identidade do conjunto (3) NÃO sofre desse problema** — ela é aplicada dentro
do statement, e por isso sobrevive à concorrência. As duas coisas têm garantias
diferentes e não devem ser confundidas.

**NÃO DEMONSTRADO:** a exploração real por concorrência. Exigiria duas conexões
Postgres independentes com barreira entre o SELECT e o UPDATE; o harness
disponível é stateless por chamada e **não** consegue interleavá-las. Simular
sequencialmente e chamar de concorrência seria falsificar a prova.

## 5 — atomicidade, e o que ela é de fato

O lote é **um único UPDATE** cobrindo todos os produtos. O cenário "P1 grava, P2
falha" **não existe**: um statement é atômico no Postgres.

O que não é atômico é a sequência `reservarParaExecucao` → `gravar` →
`registrarAcao` → `registrarVarias` → consequência. Morte entre a reserva e a
escrita deixa a Proposal `executada` com o catálogo intocado.

Isso é problema **separado** e não deve ser resolvido junto: a unidade que
precisa ser atômica para evitar dado incorreto é a **mutação do catálogo** — e
essa já é. Auditoria, procedência e consequência têm requisitos próprios, e a
consequência é deliberadamente best-effort.

## O INC-002-D, revisitado

O desenho da primitiva transacional **continua válido para as camadas 4 e 5** e
ficou **obsoleto para a 3**: ele propunha resolver identidade dentro de uma RPC,
e a identidade acabou fechada sem RPC, sem migration e sem transação nova —
porque o predicado do banco já era o lugar certo para aplicá-la.

Se as camadas 4/5 forem endereçadas, o desenho precisa ser relido sabendo que a
identidade **já não é problema dele**.

## O que este incidente ainda NÃO permite dizer

**INC-002 não está resolvido.** As camadas 1, 2 e 3 estão; a 4 e a 5 não.


---

# Camada 5 — fechada para PESO (CICLO H / H.2)

## O defeito: T1

`reservarParaExecucao` fazia o CAS `pendente → executada` e carimbava
`executada_em` **antes** da mutação, em transação separada — três idas ao
PostgREST antes da escrita. Morte no intervalo:

```
Proposal       = executada, executada_em preenchido
catálogo       = INTACTO
copilot_acoes  = nenhuma linha
nova tentativa = HTTP 200 "Isso já foi feito"
```

A autorização era consumida, nada era gravado, e o sistema **afirmava ao lojista
que havia gravado**. A única evidência era a ausência de linha de auditoria — que
ninguém consulta.

Descoberto ao mapear T0–T6 no CICLO H, junto de dois fatos: `marcarProposta` não
tem guarda de status (pode mover `executada → falhou`), e o estado `aprovada`
existe no CHECK e **não é usado em lugar nenhum**.

## A correção: migração 045

`copilot_executar_peso(p_proposta, p_cliente)`. Numa transação: trava a proposta
com `FOR UPDATE`, valida, grava, e **só então** marca `executada`. A transição de
status é a **última escrita da mesma transação** que faz a mutação.

> **`executada` passa a implicar mutação commitada.** Não existe COMMIT em que
> uma exista sem a outra; qualquer falha antes do commit reverte as duas, e a
> Proposal volta **intacta** a `pendente` — reutilizável, em vez de queimada.

**Dois parâmetros, e só.** `valor`, `alvos` e `idsAprovados` são lidos da linha
persistida **sob lock**. Mandá-los como argumento permitiria combinar "esta
proposta com outro peso", e a autorização passaria a ser o argumento em vez do
objeto aprovado. `p_cliente` é a exceção obrigatória: vem da sessão e é
**conferido** contra a proposta — não autoriza, recusa.

**SECURITY INVOKER**, com execute revogado de `public`/`anon`/`authenticated` e
concedido só a `service_role`, conferido pela própria migração. Diverge do padrão
`portal_*` (DEFINER) porque aquelas são chamadas pelo navegador e precisam
atravessar a RLS; esta é chamada pelo servidor, que já tem `bypassrls`.

**Zero linhas não queima a proposta.** O status não é tocado, ela continua
`pendente`, e o lojista tenta de novo com a mesma autorização — mudança frente ao
caminho antigo, que marcava `falhou`.

Todas as barreiras anteriores seguem dentro do UPDATE: tenant, produtos da
Proposal, `peso <= 0` e `idsAprovados`. **Ausência de `idsAprovados` é predicado
neutro** — contrato legacy, nunca conjunto vazio.

## Provado em transações revertidas

| cenário | resultado |
|---|---|
| sucesso | `ok`, afetados=3, status `executada`, catálogo mudou |
| duplo clique | `ja_executada`, afetados=0 |
| tenant errado | `outro_tenant`, afetados=0 |
| **nada gravado** | **status permanece `pendente`, `executada_em` NULL** |
| legacy sem `idsAprovados` | `ok`, afetados=3 |

Resíduo zero. A `903c1830…` não foi usada como fixture e segue `pendente`.

## Custo, pela migração 046 (CICLO H.3)

O mesmo modelo, com as diferenças que o tipo impõe:

| | |
|---|---|
| **um produto** | `alvos[1]`, não uma lista de variantes — não há conjunto congelado |
| **custo SUBSTITUI** | trocar um custo é o objetivo, não preencher um vazio. **Não existe** predicado equivalente ao `peso <= 0`, e inventar um mudaria a semântica do domínio. Há teste guardando que ele não apareça |
| **sem `elegiveis`** | a rota manda `undefined`, `ressalvaDoPreenchimento` devolve string vazia, e a mensagem continua a de antes. Um número faria a frase falar de uma parcialidade que este tipo não tem |

O que **não** difere: proposta lida sob lock, `valor` e `alvos` vindos dela e não
de argumento, tenant da sessão conferido, e a transição de status como **última
escrita da mesma transação**.

Provado em transação revertida antes de aplicar: sucesso (`0.00 → 77.77`), duplo
clique (`ja_executada`), **alvo inexistente (`nada_gravado`, status permanece
`pendente`)**, tenant errado (`outro_tenant`) e proposta de peso recusada com
`tipo_invalido`. Resíduo zero.

`retratoAntesDoPeso` virou `retratoAntesDaEscrita` e ganhou o ramo de custo —
uma leitura do valor anterior, e continua **fora** da transação.

## Preço, pela migração 047 (CICLO H.4) — e por que ele exigiu um desenho diferente

A escrita de preço toca **duas colunas**: `preco_venda` e `margem`. E a margem
**não está na Proposal** — é `margemLiquida(custo, preco, taxas)`, calculada em
TypeScript sobre o modelo de tarifas do ML (~470 linhas entre `modeloPreco.ts` e
`custosML.ts`, com a tabela de frete encodada).

Portar essa conta para SQL criaria **duas implementações da mesma coisa**, e a
divergência entre elas apareceria como um número errado numa tela — exatamente o
defeito que `embalagemDoProduto` foi extraído para não ter. Foi rejeitado.

A margem viaja como **parâmetro**, e a distinção é o que sustenta o desenho:

| | |
|---|---|
| `valor` | é o **fato autorizado**. Recebê-lo por parâmetro permitiria "esta proposta com outro preço" — é o que a 045 fechou |
| `margem` | **não é autorizada por ninguém**: é subproduto do cálculo |

**Isso foi conferido antes de escrever a migração, não presumido:** `CAMPO_MARGEM`
não existe no repositório; as precondições de preço são exatamente quatro (custo,
preço atual, peso cobrável, configuração) e nenhuma é margem; `podeExecutar` não
a menciona; e na rota ela só aparece em `antesDoPreco` e `rastroDaEscrita`, que
**registram**. Na função ela aparece **uma vez**, no `SET` do UPDATE — há teste
sobre o corpo da função guardando isso, e outros dois congelando a verificação.

O **caminho antigo foi removido**: o ramo de preço em `gravar` agora lança. Não é
defensividade decorativa — os ramos seguintes terminam no write de **peso
individual**, então uma proposta de preço que chegasse ali gravaria peso num
produto.

Provado em transação revertida: sucesso (`152.90 → 149.90`, margem `22.50`),
duplo clique, **margem NULL gravada como NULL e não como 0**, **alvo inexistente
com status permanecendo `pendente`**, tenant errado e proposta de peso recusada.

## O que continua aberto

**Peso, custo e preço foram cobertos.** Título não recebeu desenho
equivalente; **cadastro** é multi-statement, não idempotente e valida em
TypeScript — forçá-lo exigiria reescrever `validarRascunho` em SQL, com risco de
semântica divergente. Ele tem CAS próprio no draft (`aguardando_confirmacao`),
que é desenho separado. **T1 continua aberto para esses dois tipos.**

**Camada 4 continua aberta** — o TOCTOU de `pesoConhecido` entre a revalidação e
a escrita é risco conhecido e aceito. A 045 não o toca de propósito.

**Auditoria, procedência e consequência seguem fora da transação** e continuam
eventuais. Isto **não** é atomicidade operacional completa: é a garantia de que
`executada` não mente sobre o catálogo. Se o processo morrer depois do commit e
antes de `registrarAcao`, o estado é "executada, auditoria pendente" — e não mais
"executada falsamente".

**Concorrência real não observada.** A exclusividade é provada por construção
(`FOR UPDATE` na linha da Proposal); o harness de duas sessões continua
indisponível.

**H4 segue NÃO DEMONSTRADO:** `marcarProposta` sem guarda de status torna
`executada → falhou` estruturalmente alcançável após uma escrita bem-sucedida,
mas nenhum caminho concreto de exceção foi encontrado entre a escrita e a
resposta.

**INC-002 não está encerrado.**
