# COPILOT-002 — Cadastro conversacional: o que está pronto e o que falta

**Data:** 2026-07-29
**Ramo:** `feat/copilot-lote-com-escopo-congelado`
**Último commit:** `f8b189a`
**Portão:** 1149 testes · TS 0 · lint sem erros · build ok

Documento de passagem. Sucede o COPILOT-001, cuja vertical (segurança) está
**concluída** — ver seção final.

---

## O DOMÍNIO REAL — inspecionado, não suposto

### `RascunhoProduto` JÁ EXISTE

`src/modules/catalog/domain/cadastroManual.ts` tem:

| Função | O que faz |
|---|---|
| `RascunhoProduto` | campos `string` planos, um par cor/tamanho |
| `validarRascunho` | **a autoridade sobre o obrigatório** |
| `montarProduto` | rascunho → produto |
| `embalagemDoRascunho` | peso e medidas |
| `avisoDePreco` | quando falta dado para precificar |

**Obrigatório para criar:** `nome`, `sku`, `precoVenda`. Custo e estoque só não
podem ser negativos. Peso e medidas são **opcionais para criar** — o
`avisoDePreco` diz quando faltam para precificar.

### DECISÃO ARQUITETURAL — não reabrir

O Draft conversacional **CONVERTE para `RascunhoProduto`** na finalização.
Não o substitui. `validarRascunho` continua sendo a única autoridade sobre o que
é obrigatório.

O que o Draft acrescenta é o que a tela não precisava:

- **procedência** por campo (informado ≠ inferido)
- **múltiplas variantes** (`RascunhoProduto` tem um par cor/tamanho só)
- **persistência** (hoje é estado de React)
- **modelo/referência e EAN**, que o rascunho não tem

### Schema (confirmado na sessão da busca forte)

```
produtos            nome, marca, modelo, sku(3/73), cor, tamanho
produto_variantes   sku(479/684), ean(444/684), cor, tamanho, codigo_interno(0/684)
```

`modelo` = a "referência" do lojista (73/73). Não existem colunas `referencia`
nem `gtin`.

---

## PRONTO E COMMITADO — não reconstruir

### `modules/assistant/domain/fatosDoCadastro.ts` · 20 testes

Procedência: `informado` | `catalogo` | `derivado` | `inferido`.

**Campos críticos recusam inferência:** `custo`, `precoVenda`, `sku`, `ean`,
`pesoGramas`. `aceitarFato` devolve o motivo, e o campo volta para a fila de
perguntas.

**Dinheiro em CENTAVOS INTEIROS.** `lerDinheiroEmCentavos` cobre:

| Entrada | Saída | Por quê |
|---|---|---|
| `"47,80"` | `4780` | vírgula é decimal |
| `"1.249,90"` | `124990` | ponto é milhar quando há vírgula |
| `"47.80"` | `4780` | decimal de teclado (exatamente 2 dígitos) |
| `"1.249"` | `124900` | grupos de três = milhar |
| **`"1.2"`** | **`null`** | **ambíguo — não se adivinha dinheiro** |

O último caso apareceu escrevendo o teste. Eu havia afirmado `120`; a resposta
certa é não responder.

### `modules/assistant/domain/gradeDeVariantes.ts` · 20 testes

`montarGrade` faz o cartesiano dos eixos. Um eixo sozinho ainda é grade.
Repetição e vazio saem.

`associarIdentificador` **recusa alvo ambíguo com os candidatos**. Não muta a
grade de entrada.

`variantesSem` para a pergunta seguinte ser útil ("faltam 3", não seis
perguntas).

`EIXOS` é lista, não par fixo — um terceiro eixo não exige reescrita. Mas nada
foi generalizado além do que o banco sustenta (cor e tamanho).

---

## O QUE FALTA — é UMA unidade

Estas peças se sustentam mutuamente. Draft sem persistência não retoma;
persistência sem Proposal de criação grava fora do caminho seguro; Proposal sem
revalidação cria duplicata.

| # | Peça | Depende de |
|---|---|---|
| 1 | `draftDeCadastro` — ciclo de vida, o que falta **por estágio** | as duas prontas |
| 2 | **Migration 037** — persistir Draft (entregar `.sql`, não aplicar) | 1 |
| 3 | Serviço server-only do Draft, tenant da sessão | 2 |
| 4 | **Busca antes de criar** — reusar `achar_produto` para candidatos | busca forte ✅ |
| 5 | **Proposal de criação** — reusar `copilot_propostas` + revalidação | 1, 4 |
| 6 | Ferramentas: `iniciar_cadastro`, `informar_dado`, `propor_criacao` | 1–5 |
| 7 | UI: Draft ativo, grade, o que falta, resumo, estados | 6 |
| 8 | **"O segundo"** — inspecionar se `copilot_mensagens` sustenta metadata | 7 |

### Regras que a implementação deve respeitar

- **Draft ≠ Proposal.** Draft é trabalho incompleto; Proposal é autorização.
  Draft **nunca** autoriza escrita.
- **Revalidar antes de criar.** T0 o modelo não existe; T2 a importação o cria;
  T3 o cliente confirma. Não criar cego — usar o `stale` que já existe.
- **Duplicidade não é merge.** SKU/EAN repetidos são **legítimos** nesta base
  (117 e 112 casos). Candidato → desambiguar, nunca fundir.
- **Idempotência** pela transição atômica que já existe.
- Dois Drafts abertos → **mostrar opções**, nunca escolher.

---

## COPILOT-001 — CONCLUÍDO

A vertical de segurança está fechada e em produção:

`copilot_propostas` · confirmação server-side por `propostaId` ·
autenticar→carregar→revalidar→reservar→executar→auditar · stale ·
idempotência provada contra Postgres (`primeira_pegou: 1`, `segunda_pegou: 0`) ·
`copilot_conversas` · `copilot_mensagens` · `copilot_acoes` · tenant da sessão

**Migração 035: APLICADA.** Não listar como pendente.

Depois dela fecharam também: **lote com escopo congelado** (Proposal guarda ids,
não filtro; tudo-ou-nada em stale; custo recusado em lote), **cartão do lote**, e
**busca forte** (SKU, EAN, referência; exato ≠ único).

---

## MIGRATIONS PENDENTES DE APLICAÇÃO MANUAL

| Arquivo | O que faz |
|---|---|
| `036-indices-para-busca-forte.sql` | índices parciais `(cliente_id, ean)` e `(cliente_id, modelo)` |

E a **037** do Draft, quando existir.

---

## RESTRIÇÕES OPERACIONAIS

- Migrações aplicadas **manualmente** pelo dono (a 035 foi exceção, a pedido).
- Nunca `git add .`
- Autoria: `onetocoutinho-spec <299580701+onetocoutinho-spec@users.noreply.github.com>`
- `platform/` congelado · API do ML travada até liberação
- AIL e `suggestion-offers` **intocadas**
- `Efeito = "le" | "propoe"` — a invariante vai disparar se alguém introduzir
  execução autorizada. **Isso é o desenho funcionando.**
- Portão: `npm run gate` + `npm run build`

## NADA VERIFICADO EM TELA

Nenhuma das verticais desde o cartão de proposta foi exercida no navegador. A
bateria manual está adiada por decisão do dono, e o roteiro cresce a cada
vertical.
