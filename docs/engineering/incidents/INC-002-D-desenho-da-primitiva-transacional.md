# INC-002 / Opção D — Desenho da primitiva transacional

```
Status:      DESENHO. Nada implementado, nada commitado, nenhuma escrita real.
Data:        2026-07-30
Depende de:  INC-002 (o incidente), CONSEQ-001 (diff congelado, intocado)
```

Fecha a lacuna que a investigação anterior isolou: **validar o conjunto e
escrever o conjunto como uma unidade indivisível**.

---

## A. Contrato atual relevante

| peça | onde | o que garante |
|---|---|---|
| `reservarParaExecucao` | `copilotPropostas.ts:155` | UPDATE atômico com `.eq("status","pendente")` — **um vencedor**, já resolvido |
| `podeExecutar` | `propostaPersistida.ts:217` | `agora !== valorNaCriacao` — **cardinalidade**, não identidade |
| `gravar` lote | `proposta/route.ts:463` | `.in("produto_id", p.alvos)` — todas as variantes |
| `gravar` individual | `proposta/route.ts:495` | `.eq("produto_id", produtoId)` — todas as variantes |

### Correção de terminologia (§3)

`lerEstadoAtual` **não materializa autoridade**. Ele prova apenas:

> *"a precondição numérica congelada ainda coincide com o banco"*

Não prova:

> *"este conjunto foi materializado pelo servidor e é o conjunto autorizado"*

Se o cliente escolheu o produto e mandou uma contagem que por acaso é
verdadeira, a revalidação numérica **não cria procedência para essa escolha**.
Coincidência não é autoridade.

---

## B. Contrato proposto da materialização

Campo próprio na proposta — **não** dentro de `precondicoes`, que existe para
detectar obsolescência e cuja forma (`valorNaCriacao: number | null`) é escalar.

Duas formas comparadas:

| critério | `varianteIds: string[]` (plana) | `produtos: [{produtoId, varianteIds}]` (agrupada) |
|---|---|---|
| validação de tenant | igual (por `id` + `cliente_id`) | igual |
| provar que a variante pertence a `p.alvos` | **precisa de join** | **explícita na estrutura** |
| auditoria por produto | precisa reagrupar | direta |
| mensagem/procedência (linha por produto) | precisa reagrupar | direta |
| tamanho JSON | menor | +~50 B por produto |
| simplicidade da RPC | recebe um array | precisa achatar antes |

**Recomendo a agrupada.** `rastroDaEscrita` e `registrarAcao` já falam em
produto; a forma plana obrigaria a reconstruir o agrupamento — e reconstruir
agrupamento é como o incidente nasceu.

```
alvoMaterializado: {
  tipo: "variantes_sem_peso",
  produtos: [ { produtoId, varianteIds: [...] } ]
}
```

A RPC recebe o **achatado** (`varianteIds`), derivado deste campo no servidor —
uma transformação, não uma segunda fonte.

---

## C. Caminho 1 — a autoridade já existe

```
produtoParaAnalise(clienteId, produtoId)     SERVIDOR, admin, tenant da sessão
  → ProdutoParaAnalise.variantes[].id
  → variantesSemPeso(produto)                VarianteParaAnalise[] COM id
  → faltando                                 ← a materialização
  → unidadesSemDado: faltando.length         ← o número do cartão
  → alvoMaterializado: faltando.map(v => v.id)
```

**O número do cartão é exatamente `faltando.length`.** Apresentado e persistido
saem do mesmo array, sem segunda consulta. P1 e P2 já são SIM; falta só não
descartar.

---

## D. Caminho 2 — três alternativas

| | como | truncável | leitura | ordem do cartão |
|---|---|---|---|---|
| **A** | `ctx.analise.catalogo()` + recusar `truncado` | **sim, 500** | catálogo inteiro | muda (`order by nome`) |
| **B** | leitura nova por `.in("id", candidatoIds)` | **não** | só os candidatos | preservada |
| **C** | cliente segue mandando contexto para linguagem; servidor materializa antes do cartão | **não** | só os candidatos | preservada |

**B e C são a mesma implementação** vistas de ângulos diferentes: B descreve a
query, C descreve o momento. O código confirma — o ponto onde o cartão nasce
(`executarFerramenta:614-621`) é o mesmo onde a materialização precisa entrar.

**A está descartada.** `LIMITE_DE_PRODUTOS = 500` com `.order("nome")` pode
omitir produtos; `truncado` é observável, mas usar um leitor truncável como
autoridade de escrita é aceitar que a autoridade dependa da ordem alfabética.
"O catálogo tem 73" não é contrato.

**B/C eliminam o problema por construção:** ler por `.in("id", ids)` não tem
limite estrutural — o conjunto de candidatos é o que o modelo pediu, e ele já é
finito e conhecido.

---

## E. Desenho da RPC

```sql
preencher_peso_autorizado(
  p_proposta_id   uuid,      -- vincula ao snapshot persistido
  p_variante_ids  uuid[],    -- o achatado do alvoMaterializado
  p_peso_kg       numeric
) returns jsonb
```

**Tenant NÃO é argumento.** Deriva de `copilot_propostas.cliente_id` pela
`p_proposta_id`. Um tenant vindo por parâmetro seria uma string que o chamador
escolhe — a mesma classe de erro que este incidente é.

Pseudocódigo:

```
1. carregar proposta por p_proposta_id           -> tenant, alvos, status
   se não existe            -> {resultado: "autoridade_invalida"}
   se status <> 'executada' -> {resultado: "autoridade_invalida"}   -- ver §G

2. se cardinality(p_variante_ids) = 0            -> {resultado: "vazio", ids: []}
   se existe duplicata em p_variante_ids         -> {resultado: "autoridade_invalida"}

3. SELECT id, peso, produto_id
     FROM produto_variantes
    WHERE id = ANY(p_variante_ids)
      AND cliente_id = tenant
      AND produto_id = ANY(proposta.alvos)
    FOR UPDATE                                   -- ← o cadeado

4. se count(travadas) <> cardinality(p_variante_ids)
      -> drift    (id inexistente, outro tenant, ou fora de p.alvos)
   se existe travada com peso > 0
      -> drift    (alguém preencheu)

5. UPDATE produto_variantes SET peso = p_peso_kg
    WHERE id = ANY(p_variante_ids)
   RETURNING id                                  -- sem predicado extra: o passo 4 já provou

6. {resultado: "escrito", ids: [...]}
```

---

## F. Locking e atomicidade — e uma correção ao meu próprio teste

**O teste que rodei antes é insuficiente, e preciso dizer isso.**

Eu provei tudo-ou-nada com uma subconsulta no `WHERE`:

```sql
and (select count(*) ... ) = (select count(*) from aut)
```

Sequencialmente funciona — 3 autorizadas, 1 na corrida, 0 escritas. **Mas não
sustenta concorrência real.** Em `READ COMMITTED`, a subconsulta é avaliada
com o snapshot da instrução; o predicado da linha, não. Se uma transação
concorrente commitar sobre a variante A **depois** da subconsulta e o UPDATE
alcançar A, o Postgres faz *EvalPlanQual* e reavalia o predicado da linha
contra a versão nova — A é pulada, e as outras duas **já foram escritas**.
Resultado: parcial, exatamente o que a semântica A proíbe.

**Por isso o `SELECT ... FOR UPDATE` do passo 3 é necessário, não decorativo:**

- **quais linhas trava:** as de `id = ANY(ids)` que passam tenant e escopo;
- **quando:** antes de qualquer validação;
- **efeito:** um escritor concorrente **bloqueia**; ao adquirir o lock, o
  `SELECT` enxerga a versão committed mais recente — não a do snapshot;
- **depois do lock:** nenhuma outra transação altera `peso` dessas linhas até o
  commit. A validação do passo 4 vale até o fim;
- **parcialidade:** impossível — o passo 5 só roda se o passo 4 aprovou o
  conjunto **inteiro**, e as linhas estão travadas desde antes.

Isolation: `READ COMMITTED` (o padrão) **basta**, porque `FOR UPDATE` dá a
serialização necessária sobre exatamente estas linhas. Não é preciso
`REPEATABLE READ` nem lock de tabela/tenant.

Deadlock: possível apenas se duas execuções travarem os mesmos ids em ordens
diferentes. Mitigação padrão: `ORDER BY id` no `SELECT ... FOR UPDATE`.

---

## G. Reserva — fica FORA da RPC

`reservarParaExecucao` já é um UPDATE atômico com `.eq("status","pendente")`:
**um vencedor, sempre.** Composição:

```
reserva (atômica, 1 vencedor)  →  RPC (atômica, tudo-ou-nada)
```

- **duas execuções da mesma proposta:** só uma passa a reserva → só uma chama a
  RPC. **R15 fechado sem mover a reserva.**
- **RPC devolve drift:** a proposta já está `executada`. O código chama
  `marcarProposta(id, "obsoleta")` — máquina que **já existe** para o caminho
  `falhou`.

**Resposta a D2: NÃO.** A reserva não precisa entrar na RPC, e mantê-la fora
deixa a migration menor. (O passo 1 da RPC exige `status = 'executada'`
justamente porque a reserva já aconteceu.)

---

## H. Ausência de peso — uma semântica, com uma divergência latente

`produto_variantes.peso` é **`numeric NOT NULL DEFAULT 0`**. Logo `peso IS NULL`
é inalcançável — o `IS NULL` do meu teste anterior era código morto.

| camada | predicado |
|---|---|
| domínio (`variantesSemPeso`) | `!(pesoGramas > 0)`, com `pesoGramas = round(peso*1000)` |
| serviço | idem |
| revalidação (`route.ts:294`) | `!v.peso \|\| v.peso <= 0` |
| navegador | `!((Number(peso) \|\| 0) > 0)` |

**Divergência latente:** peso em `(0, 0,0005)` kg é *sem peso* no domínio
(arredonda para 0 g) e *com peso* na revalidação.

Medido: **zero linhas** nessa faixa; menor positivo = 0,200 kg; 159 exatamente
em 0. **Hoje as quatro camadas concordam sobre todos os dados existentes.**

**Recomendação:** a RPC usa `peso <= 0` — igual à revalidação, e exato dado o
`NOT NULL`. A divergência de arredondamento fica registrada como nota, não como
bloqueio: é inalcançável hoje e exigiria importar peso sub-grama.

---

## I. Retorno da RPC

```jsonc
{ "resultado": "escrito",             "ids": ["…"] }
{ "resultado": "drift",               "ids": [] }
{ "resultado": "autoridade_invalida", "ids": [] }
{ "resultado": "vazio",               "ids": [] }
```

Os **ids** são a base de `afetados`, auditoria, procedência e da consequência
futura — `count` sozinho não serviria. Nada disso vai ao frontend: a rota
converte em `afetados` e mensagem.

---

## J. Auditoria — fica FORA da RPC

A ordem deliberada não muda:

```
RPC (escrita atômica) → registrarAcao → registrarVarias
```

Se a RPC escreve e `registrarAcao` falha depois, mantém-se **a semântica de
hoje**: escrita consumada, auditoria posterior, falha logada. Não é regressão —
é o comportamento atual, preservado. Colocar auditoria dentro da RPC seria
redesenhar a AIL para ganhar uma atomicidade que ninguém pediu.

---

## K. Compatibilidade

Proposta de peso **sem `alvoMaterializado`** → **recusa**. Sem fallback para
`produtoId`: o fallback é o incidente.

Presença/ausência do campo **basta** — não precisa de versão de schema. Com
`copilot_propostas = 0` o impacto operacional é zero, mas o comportamento fica
explícito no código.

---

## L. Tamanho do snapshot (medido, somente leitura)

| caso | ids | JSON aprox. |
|---|---:|---:|
| Vizzano | 3 | ~120 B |
| Havaianas | 9 | ~355 B |
| maior produto único da base | **27** | **~1,0 KB** |
| todo o catálogo sem peso num lote | **159** | **~6,1 KB** |

`precondicoes`/`alvoMaterializado` são JSONB. **6 KB é materialmente
irrelevante.** Não generalizo além destes dados.

---

## M. Testes que a migration precisaria passar

R1 Vizzano 3/39 · R2 Havaianas 9/18 · R3 drift 3→2 = 0 escritas ·
R4 drift 3→3 com troca A→D = 0 escritas · R5 corrida pós-validação = 0 parcial ·
R6 id de outro tenant = 0 · R7 id inexistente = 0 · R8 duplicata = 0 ·
R9 array vazio = sem write, resultado explícito · R10 MAX 410 permanece 410 ·
R11 ids retornados == autorizados no sucesso · R12 proposta antiga = recusa ·
R13 caminho 1: apresentado == persistido == escrito ·
R14 caminho 2: idem · R15 duas execuções concorrentes = no máximo uma escrita.

**R5 e R15 exigem teste com duas conexões reais** — não são demonstráveis por
teste puro. Precisam de um harness de integração que hoje **não existe** no
repositório.

---

## N. Arquivos e responsabilidades

| # | arquivo | responsabilidade |
|---|---|---|
| 1 | `database/migrations/0NN-*.sql` | a função + o teste de conferência |
| 2 | `modules/assistant/domain/escopoDoLote.ts` | `CandidatoAoLote` carrega `varianteIds` |
| 3 | `modules/assistant/domain/propostaPersistida.ts` | tipo `alvoMaterializado` |
| 4 | `lib/services/copilotPropostas.ts` | persistir/ler o campo |
| 5 | `modules/assistant/domain/executarFerramenta.ts` | caminhos 1 e 2 materializarem |
| 6 | `app/api/assistente/conversa/route.ts` | leitura por ids do caminho 2 |
| 7 | `app/api/assistente/proposta/route.ts` | chamar a RPC; auditoria pelo conjunto real |
| 8–10 | testes | domínio + fiação estática |
| 11 | `INC-002` | fechamento |

**11 arquivos, 1 migration.**

---

## O. D1–D5

- **D1 — uma RPC pequena fecha P5/P6/P8?** **SIM**, com `FOR UPDATE`.
- **D2 — precisa absorver a reserva?** **NÃO.** `reservarParaExecucao` já é
  atômica e já é a autoridade de execução única.
- **D3 — caminho 1 produz autoridade sem arquitetura nova?** **SIM.** Os ids já
  existem em `variantesSemPeso`, server-side; basta não descartá-los.
- **D4 — caminho 2 sem catálogo truncável?** **SIM**, com leitura por
  `.in("id", candidatoIds)`. Elimina o limite 500 por construção.
- **D5 — a migration é isolada?** **SIM.** Uma função nova, nenhuma tabela
  alterada, nenhuma coluna nova (`precondicoes`/`alvoMaterializado` em JSONB já
  existente). **Não é redesign do mecanismo de proposta** — a proposta ganha um
  campo e a execução ganha uma porta atômica.

---

## P. Riscos

| risco | avaliação |
|---|---|
| **R5/R15 não testáveis** sem harness de integração | **o maior.** A garantia de concorrência ficaria provada por raciocínio de locking, não por teste |
| `FOR UPDATE` esquecido numa revisão futura | mitigável com teste estático exigindo o texto na migration |
| deadlock entre execuções | mitigável com `ORDER BY id` |
| divergência de arredondamento sub-grama | latente, inalcançável hoje, registrada |
| caminho 2 muda a fonte do escopo | **decisão de produto**, não técnica |
| a consequência congelada foi testada contra a mutação antiga | recaptura obrigatória depois — já combinado |

---

## Q. Recomendação

Autorizar **D**, em duas entregas separadas:

1. **INC-002a — caminho 1 + RPC.** D3 já é SIM; fecha o caso Vizzano medido, com
   a primitiva atômica. Não depende de decisão de produto.
2. **INC-002b — caminho 2.** Exige decidir que o escopo do lote passa a ser
   materializado no servidor (leitura por ids). É a decisão que fecha C2.

**Trade-off explícito:** a alternativa de não fazer D é reescrever a frase de
fechamento para *"nunca substitui um peso existente"* — implementável hoje sem
migration, mas perde *"somente nas variações autorizadas"* e aceita escrita
parcial sob corrida.

---

## R. Nada foi feito

Nenhuma migration, nenhuma função SQL, nenhum TypeScript, nenhum commit,
nenhuma escrita real. Os dois testes de atomicidade rodaram em transação
revertida; base em 684 variantes / 159 sem peso / 0 resíduo. O diff congelado da
CONSEQ-001 está intacto.
