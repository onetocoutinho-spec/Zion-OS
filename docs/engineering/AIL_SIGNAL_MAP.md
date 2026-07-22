# AIL Signal Map — Referência Viva das Signal Sources

> Documento vivo (PR-004): **toda** mudança em Signal Sources atualiza este mapa.
> Fluxo canônico: `Signal Source → capturarDecisao() → registrarDecisao() (Port)
> → persistência (decisoes) → Pattern Detection (padroes)`.

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
| Tipo de anúncio por canal | **Marketplace** | `salvarCanal` | proposta → escolha | `(emp, publicacao, tipoAnuncio, ⟨tipo⟩)` | PR-004 |
| Categoria prevista pelo marketplace → utilizada | **Produto** (mesmo slot) | `publicarNoML` (origem `api/ml/publicar`) | proposta do AMBIENTE → escolha consumada | `(emp, catalogo, categoriaMarketplace, ⟨MLB…⟩)` | PR-006 |

> **Nota (PR-006):** a signal source de categoria da publicação usa o **mesmo slot**
> do agregado Produto (`catalogo/categoriaMarketplace`) de propósito — correções no
> cadastro e divergências na publicação **convergem** no mesmo Pattern. Primeiro
> caso em que o `valorAnterior` é uma **proposta do ambiente** (domain_discovery),
> não um valor humano prévio: o delta significa "o ambiente propôs X, a equipe
> publicou Y".

## Natural Aggregates oficiais

- **Produto** — Signal Source `atualizarProduto` (lista de campos observados;
  campo novo = 1 linha). Já nasceu escalável: atributos, imagens, componentes,
  fornecedor, classificação entram sem mudar arquitetura.
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
