# COPILOT-004 — Proveniência e resolução inteligente de pendências

**Data:** 2026-07-29
**Ramo:** `feat/copilot-lote-com-escopo-congelado`
**Sucede:** COPILOT-003 (cadastro conversacional, concluído em `16b78fa`)
**Portão:** 1366 testes · TS 0 · lint sem erros · build ok

---

## 1. RECONHECIMENTO — o domínio real de pendências

### O que JÁ existia (nada foi reinventado)

| Onde | O que responde | Alvo |
|---|---|---|
| `publication/domain/prontidaoDaLoja` | **quantos** na loja (9 tipos de lacuna) | agregado |
| `catalog/domain/lacunasDoProduto` | **o que falta** neste produto (custo, peso, foto, preço) | produto |
| `assistant/domain/perguntaDaOperacao` | `Capacidade = precificar \| anunciar \| publicar` | loja |
| `publication/domain/jornada` | as 6 etapas até o anúncio no ar | produto |
| `catalog/domain/familiaDeProduto` | os 4 estados de peso; família **derivada do nome** | produto |
| `pricing/domain/custoDigitado` | **anomalia de custo** — referência de modelo, 100× o preço | valor |
| `lib/auditoria` + `auditoriaDaBase` | qualidade de ANÚNCIO (título, foto, ficha) | anúncio |
| tabela `pendencias` | **tarefa interna da equipe Zion** — não é pendência de catálogo | back-office |

**Calculadas, não persistidas.** Nenhuma pendência de catálogo é gravada. Todas
nascem de leitura do estado. Isso é bom e foi preservado: uma pendência
persistida envelhece.

### O buraco que a vertical fechou

Nenhuma das duas primitives tinha **alvo endereçável**. "43 produtos sem custo"
não diz quais; "falta peso" na linha de um produto não diz quais das 39
variantes. Sem alvo não se prepara correção, não se agrupa decisão e não se monta
Proposal.

### Proveniência — o que existia

| Trilha | Cobre | Não cobre |
|---|---|---|
| `decisoes` (022, AIL) | `custo`, `precoVenda`, `categoriaMarketplace`, `tabelaMedidas` — **e só por `produtos.atualizarProduto`** | peso, SKU, EAN, estoque, importação |
| `copilot_acoes` (035) | o que o Copilot gravou, com `antes`/`depois` e a proposta | tudo fora do Copilot |
| `copilot_cadastros` (037) | procedência por campo de produto nascido na conversa | produtos anteriores |
| `produtos.confianca_custo` | **confiança, não origem** — e mistura as duas | — |

**Conclusão:** peso vindo de planilha, SKU vindo do ERP e estoque de qualquer
lugar nunca deixaram rastro. Para os 73 produtos e 684 variantes existentes, a
resposta honesta é **origem desconhecida**.

### Fontes conectadas

O SDK de conectores já tem o mecanismo certo: **capacidades declaradas**
(`conectar`, `ler_custo`, `ler_estoque`, …). O conector Magazord declara
`conectar`, `testar_conexao`, `renovar_credencial`, `sincronizar` — **não declara
`ler_custo` nem `ler_estoque`**. Custo, preço e estoque ficaram fora do escopo
dele. Por isso o Copilot **não promete buscar custo em ERP**.

---

## 2. PROVENIÊNCIA — o modelo implementado

`catalog/domain/procedenciaDeCampo.ts`. Cinco partes, e juntá-las era o erro:

```
ORIGEM     cliente | erp | planilha | marketplace | zion | desconhecida
MÉTODO     cadastro_manual | copilot | importacao | api_marketplace | calculo
ATOR       o humano, quando havia um
MOMENTO    quando
EVIDÊNCIA  o registro que sustenta (proposta, decisão, ação)
```

Origem responde *de onde veio como fato*; método responde *por qual caminho
entrou*. É a separação que responde "esse SKU veio da planilha?" (planilha +
importação) e "esse valor foi calculado pelo Zion?" (zion + calculo).

### Proveniência NÃO é confiança

**Não existe campo de confiança neste módulo** — e um teste prende isso
enumerando as chaves. A hierarquia simplista (ERP bom, IA ruim) é exatamente o
que os incidentes desta base desmentiram: R$ 30.277.872 vieram da planilha, com
selo de "confiança alta", porque a célula foi **lida corretamente**.

Validade continua com quem já era dono: `custoDigitado` para dinheiro,
`validarRascunho` para o obrigatório.

### A IA nunca é fonte de campo crítico

`iaPodeSerFonte` recusa `zion` + método ≠ `calculo` em custo, preço, peso, SKU,
EAN e **estoque**. A lista de críticos é **importada** de `fatosDoCadastro`, não
copiada; o que existe aqui é tradução de nome (`peso` ↔ `pesoGramas`) e uma
adição justificada: `estoque` é crítico no catálogo vivo (vende o que não há) e
não era no cadastro de um produto que ainda não existe.

`zion` + `calculo` **é** fonte legítima: aritmética determinística (piso, margem)
não é palpite. A distinção mora no método.

---

## 3. HISTÓRICO — o que dá para reconstruir, e desde quando

**Migração 038** cria `procedencia_de_campo`: append-only, com valor, valor
anterior, origem, método, ator, evidência e momento.

### A invariante que vale mais que a tabela

> **ausência de linha É "origem desconhecida"**

`origem` **não aceita** o valor `'desconhecida'` — nem no tipo, nem no CHECK. Uma
linha dizendo "não sei" é indistinguível de um palpite gravado, e o dia em que
alguém precisar de um default vai escolher o mais provável.

**Não há backfill e não deve haver.** A tabela nasce vazia. Ela não reconstrói o
passado — torna o futuro rastreável.

O leitor (`lib/services/procedencia.ts`) **une as quatro trilhas** e devolve
`desconhecida` quando nenhuma sabe. A AIL é **lida e nunca escrita**: ela é
observador lateral com semântica própria de aprendizado.

Uma sutileza implementada: se o valor de hoje **não bate** com o da trilha mais
recente, a procedência volta a `desconhecida`. O catálogo mudou por um caminho
que não registra, e atribuir essa escrita ao Copilot seria falso.

**Escrita ligada agora:** a rota de confirmação registra procedência de todo
custo, peso e cadastro que o Copilot gravar.

---

## 4. CLASSIFICAÇÃO

`assistant/domain/resolucaoDePendencias.ts`. Cinco classes, por **quem consegue
responder**:

| Classe | Quando | Hoje |
|---|---|---|
| `preparavel` | o valor já existe no próprio produto | peso de variantes faltando numa família já pesada |
| `resolvivel_por_fonte` | uma fonte **declara** a capacidade | vazio — nenhum conector declara `ler_custo` |
| `precisa_do_humano` | só o lojista sabe | custo, preço, SKU, EAN, peso total |
| `conflito` | dois valores registrados, ou um que a validação recusa | anomalia de custo; irmãs com pesos divergentes |
| `bloqueada` | não se resolve em conversa | foto (exige upload) |

A ordem das checagens é a política: **conflito antes de preparável** — preparar
com um dos dois valores em disputa é exatamente a escolha automática que esta
vertical existe para não fazer.

**A classificação é código.** O Gemini organiza a comunicação; ele não decide o
que é resolvível.

### Um defeito real que o desenho evitou

Peso parcial só é `preparavel` quando as irmãs pesadas **concordam**. O caminho
de gravação existente desce o peso para **todas** as variantes do produto — com
400 g numa e 450 g em outra, aplicar "o peso do produto" sobrescreveria uma delas
com um número que ninguém aprovou. Divergência → **conflito**.

---

## 5. AGRUPAMENTO — centenas viram poucas decisões

| Escopo | Significado | Onde |
|---|---|---|
| `valor_compartilhado` | **uma** resposta serve para todos | peso: variantes do mesmo produto; produtos de **marca+modelo exatos** |
| `um_por_alvo` | uma pergunta, **N** respostas | custo, preço, SKU, EAN |

**A chave de família é `marca` + `modelo` das COLUNAS.** `familiaDeProduto`
deriva a família do **texto do nome** — ótimo para uma tela de trabalho,
perigoso para uma decisão que grava peso em dezenas de linhas. Produto sem marca
ou sem modelo **não se agrupa com ninguém**; um teste prova que dois produtos de
nome quase idêntico e sem essas colunas ficam separados.

**EAN e SKU nunca propagam.** Eles identificam uma unidade. `destrava = 1`:
responder um não adianta para os outros trinta.

Medido no teste: 20 produtos da mesma família, sem peso, sem custo, 3 variantes
sem EAN cada = **100 pendências → 3 decisões**.

---

## 6. PRIORIDADE

Por **impacto**, usando a `Capacidade` que já existia:

1. quantas capacidades trava (`precificar` / `anunciar` / `publicar`)
2. quantos alvos destrava
3. quantidade

Ordenar por volume mandaria o lojista para 31 EANs — que não destravam
publicação nenhuma — antes de um preço que trava as três capacidades. Há teste
para isso.

**Peso parcial não trava capacidade** (`bloqueia: []`): o frete sai pela maior
variante conhecida. Dizer que trava seria a mesma frase falsa do INC-001.

---

## 7. RESOLUÇÃO — "resolva o que conseguir"

```
pendencias  →  classifica  →  plano estruturado
                                ├── preparaveis     (Proposal sem perguntar valor)
                                ├── decisoes        (agrupadas, priorizadas)
                                ├── conflitos       (decisão humana)
                                ├── bloqueadas      (outra tela)
                                └── consultaveis    (fontes que declaram saber)
```

`preparar_resolucao` **reusa o lote de peso inteiro**: mesmo `montarEscopo`,
mesmo cartão, mesma Proposal com escopo congelado, mesma revalidação, mesma
reserva atômica. Não há segundo caminho de escrita — há um alvo novo para o
caminho já provado.

### "Preparável" ≠ "sem confirmação"

Preparável significa: **consigo montar a correção sem perguntar o valor**. A
gravação continua exigindo clique, Proposal, revalidação e reserva. Um teste
verifica que a frase devolvida ao modelo diz isso.

---

## 8. FONTES — sem acoplamento a ERP

```ts
interface FonteConectada { nome: string; capacidades: ReadonlySet<Capacidade> }
```

`Capacidade` é a do **SDK de conectores que já existe**. O domínio nunca pergunta
"é o Magazord?" — pergunta "alguma fonte declara `ler_custo`?". Um teste prova os
dois lados: uma fonte que declara muda a classificação; uma que não declara não
resolve nada.

Não há `if` de ERP em lugar nenhum, e nenhum conector novo foi construído.

---

## 9. TOOLS

| Tool | Efeito | Intenção |
|---|---|---|
| `pendencias` | `le` | panorama analisado, ou drill-down de um produto |
| `procedencia` | `le` | de onde veio um valor, com frase pronta |
| `preparar_resolucao` | `propoe` | monta o cartão de uma correção preparável |

Três capacidades pequenas que o Gemini compõe — não uma tool por campo.
`Efeito` continua `le | rascunha | propoe`. **Nada novo foi adicionado**, e
`escreve` continua não existindo.

O modelo recebe **contagens e grupos**; o plano inteiro vai para a tela. Um teste
verifica que `plano` não aparece na saída do modelo.

---

## 10. SEGURANÇA

- **Tenant** — o contexto da análise é montado **pela rota**, com portos que já
  carregam o `clienteId` da sessão. Produto de outro tenant é indistinguível de
  inexistente.
- **Nenhuma escrita direta** — teste varre as ferramentas de leitura e confirma
  que nenhuma devolve escopo, proposta ou efeito no cadastro.
- **Proposal para toda mutação** — `preparar_resolucao` devolve `escopo`, que a
  rota persiste como Proposal de peso.
- **Escopo congelado, stale e idempotência** — herdados intactos: a Proposal
  guarda os ids, as precondições `variacoesSemPeso:<id>` são revalidadas
  server-side, e a transição atômica `pendente → executada` continua sendo o que
  impede o duplo clique.
- **Lazy** — a análise só carrega catálogo quando a tool é chamada.

---

## 11. UI — estados implementados

`PainelDePendencias` e `CartaoDeProcedencia` em `ChatDaOperacao`. As decisões
vêm de `cartaoDePendencias.ts` (domínio provado).

| Estado | O que aparece |
|---|---|
| nada a fazer | "Não encontrei nenhuma pendência" |
| panorama | frase + decisões numeradas em ordem de impacto + o que cada uma pede |
| grupo de decisão | pergunta, quantos alvos, "uma resposta resolve N" **ou** "preciso de N valores", o que trava |
| preparável | "consigo preparar sem te perguntar", com o resumo |
| conflito | bloco próprio em âmbar — não some numa contagem |
| bloqueio | "N de foto: se resolve na tela de imagens" |
| proveniência | valor, origem, data, valor anterior, e o aviso de anterior ao registro |

**Ordem deliberada:** tamanho do problema → o quanto **não** é problema dele →
o que sobra. Começar pela cobrança transformaria um alívio em cobrança; há teste
para a ordem da frase.

---

## 12. HIGGSFIELD — estados para exploração de UX

| # | Estado | Dado real por trás |
|---|---|---|
| 1 | **panorama de pendências** | analisadas, sem-novo-dado, decisões, conflitos, bloqueadas |
| 2 | **"o que precisa de mim"** | fila ordenada por impacto, com `destrava` por item |
| 3 | **decisão agrupada** | pergunta pronta, N alvos, compartilhável **ou** um-por-alvo |
| 4 | **conflito** | campo, alvo, os dois lados com origem, explicação |
| 5 | **proveniência** | valor, origem, método, ator, momento, evidência, anteriores |
| 6 | **explicação de bloqueio** | produto → variantes → tipo → quantos → impede → capacidades travadas |
| 7 | **Proposal pronta** | escopo congelado, valor, alvos, de onde o valor veio |
| 8 | **resolução** | escopo aplicado, contagem de variantes |
| 9 | **resultado parcial** | preparáveis + decisões + conflitos + bloqueadas coexistindo |
| 10 | **nada a fazer** | zero pendências (≠ zero decisões humanas) |

Dois eixos que hoje são texto e merecem desenho: a distinção **compartilhável ×
um-por-alvo** (é ela que muda o que se pede), e **origem desconhecida** — que
não pode virar célula vazia.

---

## 13. MIGRATIONS

| # | Estado |
|---|---|
| 035 — propostas e conversas | **APLICADA** |
| 036 — índices da busca forte | **PENDENTE** |
| 037 — cadastro conversacional | **PENDENTE** |
| 038 — procedência de campo | **PENDENTE** (entregue nesta sessão) |

Nenhuma foi aplicada. Nenhuma anterior foi modificada.

---

## 14. TESTES

| Arquivo | Novos |
|---|---|
| `resolucaoDePendencias.test.ts` | 35 |
| `pendenciasPelaFerramenta.test.ts` | 26 |
| `procedenciaDeCampo.test.ts` | 22 |
| **Total novo** | **83** |
| **Suíte** | **1366** (era 1283) |

---

## 15. PORTÃO

```
1366 testes · TS 0 · typecheck:test 0 · lint sem erros · build ok
```

---

## 16. LIMITAÇÕES REAIS

1. **A trilha de procedência começa vazia.** Só escritas do Copilot registram
   origem a partir de agora. Os 73 produtos e 684 variantes existentes respondem
   "origem não registrada" — e essa é a resposta certa.
2. **Importação e cadastro manual ainda não registram procedência.** Os dois
   rodam no NAVEGADOR (cliente anônimo do Supabase) e a tabela é escrita só pelo
   servidor. Ligá-los exige uma rota própria — fora do escopo desta vertical, e
   dentro do código onde os incidentes de importação vivem.
3. **`preparavel` cobre um caso só:** peso de variantes faltantes com irmãs
   concordantes. É o único onde o valor já existe no próprio produto de forma
   provável. Não há outro hoje.
4. **Anomalia só de custo.** É o único campo com invariante de validação pronta
   e provada (`custoDigitado`). Peso, preço e estoque não têm equivalente, e
   inventar limiares agora seria a estatística que esta vertical não faz.
5. **Nenhuma fonte externa resolve nada hoje.** A arquitetura aceita, mas nenhum
   conector ligado declara `ler_custo` ou `ler_estoque`.
6. **A análise cobre 500 produtos por vez**, e o truncamento é DITO ao modelo com
   o total real — nunca escondido.
7. **Nada foi exercido em tela.** A bateria manual continua adiada, e o roteiro
   cresceu de novo.
8. **037 e 038 não aplicadas.** Até lá, `pendencias` e `preparar_resolucao`
   funcionam (leem `produtos`/`produto_variantes`), mas a consulta de
   procedência devolve sempre "não registrada", porque a tabela não existe.
