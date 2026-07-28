# AIL Signal Map — Referência Viva das Signal Sources

> Documento vivo (PR-004): **toda** mudança em Signal Sources atualiza este mapa.
> Fluxo canônico: `Signal Source → capturarDecisao() → registrarDecisao() (Port)
> → persistência (decisoes) → Pattern Detection (padroes)`.

> **Autoria (E4.2.3):** toda captura preenche `autor` = usuário da sessão
> (`autorAtual()` — e-mail, fallback id; `""` em demo). O tipo de autor é sempre
> **humano** por definição (RFC-AIL-002 §3.2: Decision = escolha do cliente);
> não existem producers de sistema/importação — execuções autônomas não são
> Decisions.

## Critério de admissão (as 5 perguntas — todas devem ser SIM)

1. Existe uma **decisão humana**?
2. Existe um **delta observável** (anterior → novo)?
3. Existe **potencial de repetição**?
4. Essa repetição pode **gerar aprendizado**?
5. A captura pode acontecer **sem alterar o comportamento** do sistema?

## Signal Sources ATIVAS

| Signal | Natural Aggregate | Origem | Delta | Pattern Key | Desde |
|---|---|---|---|---|---|
| Informação pendente fornecida | **Pendências** | `resolverPendencia` | ausente → descrição | `(emp, catalogo, informacaoPendente, ⟨descricao⟩)` | R-DJ-2/3 |
| Categoria marketplace corrigida | **Produto** | `atualizarProduto` | MLB → MLB | `(emp, catalogo, categoriaMarketplace, ⟨MLB…⟩)` | PR-004 |
| Preço de venda ajustado | **Produto** | `atualizarProduto` | valor → valor | `(emp, precificacao, precoVenda, ⟨valor⟩)` | PR-004 |
| Override de medida | **Produto** | `atualizarProduto` | guia → guia | `(emp, catalogo, tabelaMedidas, ⟨guia⟩)` | PR-004 |
| Custo definido pelo lojista | **Produto** | `atualizarProduto` · `definirCustoEscolhido` | valor → valor | `(emp, precificacao, custo, ⟨valor⟩)` | PR-009 |
| Tipo de anúncio por canal | **Marketplace** | `salvarCanal` | proposta → escolha | `(emp, publicacao, tipoAnuncio, ⟨tipo⟩)` | PR-004 |
| Categoria prevista pelo marketplace → utilizada | **Produto** (mesmo slot) | `publicarNoML` (origem `api/ml/publicar`) | proposta do AMBIENTE → escolha consumada | `(emp, catalogo, categoriaMarketplace, ⟨MLB…⟩)` | PR-006 |

> **Nota (PR-006):** a signal source de categoria da publicação usa o **mesmo slot**
> do agregado Produto (`catalogo/categoriaMarketplace`) de propósito — correções no
> cadastro e divergências na publicação **convergem** no mesmo Pattern. Primeiro
> caso em que o `valorAnterior` é uma **proposta do ambiente** (domain_discovery),
> não um valor humano prévio: o delta significa "o ambiente propôs X, a equipe
> publicou Y".

## Tipologia dos domínios de valores (PR-007)

> A confiança por contagem pressupõe **domínio de valores fechado**. Tipologia
> descoberta por evidência — consultar antes de admitir uma nova source:

| Tipo de domínio | Sources | Contagem converge? |
|---|---|---|
| Fechado-pequeno (Premium/Clássico) | tipoAnuncio | ✅ rápido |
| Fechado-grande (ids MLB) | categoriaMarketplace (2 fontes) | ✅ o caso ideal |
| Semi-fechado (guias nomeadas) | tabelaMedidas | ✅ moderado |
| **Contínuo** (números) | precoVenda, custo | ❌ estrutural — valores exatos quase nunca recorrem |
| **Texto livre** | informacaoPendente | ❌ suporte 1 para sempre — vale como métrica, não como sugestão |

## Vereditos NÃO são Signal Sources (PR-008)

> Aceite/veto do ML, veredito A10, aprovação/rejeição humana e pedidos pagos são
> **Outcomes do domínio** (pergunta 1 do critério: não são decisão humana de
> correção). Vivem no domínio (`anuncios_gerados.status`/`observacoes`,
> `vereditoA10`) ou no ambiente (vendas — efêmeras, S-24). A AIL não os lê; se um
> veredito levar a uma correção humana, ESSA correção é capturada pelas sources.

## Natural Aggregates oficiais

- **Produto** — Signal Sources `atualizarProduto` (lista de campos observados;
  campo novo = 1 linha) e `definirCustoEscolhido`. Já nasceu escalável:
  atributos, imagens, componentes, fornecedor, classificação entram sem mudar
  arquitetura.
  > **Nota (PR-009):** o segundo caso de um agregado com DUAS origens no mesmo
  > slot (`precificacao/custo`), pelo mesmo motivo do PR-006: corrigir o custo no
  > formulário e escolhê-lo na tela de Precificação são a mesma decisão, e
  > convergem no mesmo Pattern. `definirCustoEscolhido` existe como origem
  > separada porque é o funil de duas portas que **não** passam por
  > `atualizarProduto` — a caixa de ambíguos e a célula de custo — e ambas
  > escrevem por `atualizarProdutosBulk`, que é cego para o observador.
- **Marketplace** — Signal Source `salvarCanal`.
- **Pendências** — Signal Source `resolverPendencia`.
- **Curadoria** — Signal Source `tabelasMedidasCliente` · **status: identificado**
  (guias de medida por marca curadas pelo cliente — Alto valor, próxima onda).

## Sinais conhecidos e NÃO capturados (com motivo)

| Sinal | Motivo |
|---|---|
| Rejeição de anúncio (veto do ML) | **Não é decisão humana** (pergunta 1 = NÃO) → nunca entra na AIL. O gargalo do motivo hardcoded foi **resolvido no PR-006**: `extrairErro` traduz o veredito real (`cause[]` + `errors[]`) e `publicarNoML` o persiste no **domínio** (`observacoes` do anúncio). Se um dia o motivo real levar a uma correção humana, ESSA correção já é capturada pelas sources ativas |
| Aprovação de anúncio | marco operacional, não decisão aprendível (RFC-AIL-001 §4.3) |
| Atributos/ficha (`produtoAtributos`) | Médio valor — candidato P2 (entra pela lista do agregado Produto ou origem própria) |
| Troca de imagem | EVIDÊNCIA INSUFICIENTE (RFC-AIL-001 §4.1) |
| Tarefas, reuniões, financeiro, filas, execuções (~20 serviços) | **Princípio da Captura Significativa**: atividade/estado operacional, não conhecimento — nunca capturar |
| Custo vindo da **importação de planilha** (`importarCustos`) | **Não é decisão humana por produto** (pergunta 1 = NÃO): é execução autônoma sobre milhares de linhas, e a regra de autoria acima já a exclui. Some daí um custo prático: cada captura é um upsert próprio, e 1.806 linhas virariam 1.806 gravações laterais numa importação que o lojista já achou lenta. A decisão humana existe DEPOIS — escolher entre custos ambíguos ou digitar o valor —, e essa é capturada por `definirCustoEscolhido` |
