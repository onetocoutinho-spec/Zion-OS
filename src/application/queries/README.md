# Application Queries (`src/application/queries/`)

> **Reservado — vazio por design (YAGNI).** O escopo do PR-003 são **5 casos de uso de escrita** (Criar/Atualizar Produto Mestre, Adicionar Variante, Atualizar Preço, Registrar Eventos). Nenhuma **query** (leitura) foi pedida, então nada é implementado aqui.

## Propósito

Separar o lado de **leitura** (queries/read models) do lado de **escrita** (commands/use-cases), no espírito de CQRS leve. Uma query:

- recebe um critério (id, filtro, paginação);
- lê via um Port de repositório (ex.: `ProdutoMestreRepository.porId`);
- converte **Domínio → DTO** com os mappers existentes;
- **não** altera estado, **não** publica eventos, **não** contém regra de negócio.

## Exemplos de futuras queries (ilustrativos — não implementados)

- `ObterProdutoMestrePorId` → `ProdutoMestreDTO | null`.
- `ListarProdutosMestreDoCliente` → `ProdutoMestreDTO[]`.
- `ObterProdutoMestrePorSkuOrigem` (conciliação) → `ProdutoMestreDTO | null`.

Quando uma leitura for realmente necessária, criar `nome-da-query.query.ts` + teste, reutilizando `paraDTO` do mapper e os Ports — mantendo a Application livre de infraestrutura.
