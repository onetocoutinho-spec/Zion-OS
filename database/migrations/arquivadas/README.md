# Migrações arquivadas

**Nada aqui foi aplicado, e nada aqui deve ser aplicado sem reabrir a decisão.**

Estes arquivos estão íntegros, com os cabeçalhos originais. Foram movidos para cá,
não reescritos — reverter é um `git mv`.

## 017–021 — a fundação canônica (Produto Mestre)

`organizacoes` · `origem_produto` · `catalogo` · `produto_mestre` · `produto_mestre_versao`

Tabelas novas e paralelas (Strangler Fig) do PR-006, para serem populadas pelo Zion
Intake. Arquivadas em 30/07/2026 porque as seis verticais do Copilot foram todas
construídas sobre `produtos`/`produto_variantes` legados, e nada caminha na direção
delas.

**Ordem de dependência, se voltarem:** 017 → 018 → 019 → 020 → 021.
`origem_produto` e `catalogo` têm FK obrigatória para `organizacoes`; nenhuma é útil
isolada.

O código que espera por elas continua em `src/domain/produto-mestre/`,
`src/application/use-cases/` e
`src/infrastructure/persistence/supabase/repositories/produto-mestre-repository-supabase.ts`
— testado contra um Supabase falso, e não instanciado por nenhuma rota.

Razão completa: [ADR-011](../../../docs/decisions/ADR-011-arquivar-a-fundacao-canonica-017-021.md).

## Por que a numeração de `../` pula de 016 para 022

Por causa deste arquivamento, e é deliberado. **Os números 017–021 estão gastos** —
aparecem nos cabeçalhos destes arquivos, nos documentos de arquitetura e no ADR-011.
Reciclá-los faria duas migrações diferentes responderem pelo mesmo número, que é
exatamente o problema que a migração 043 fechou.
