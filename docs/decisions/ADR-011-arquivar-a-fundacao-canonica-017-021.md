# ADR-011 — Arquivar a fundação canônica (migrações 017–021) em vez de aplicá-la

> **Status:** `Accepted`
> **Data:** 2026-07-30 · **Responsável:** decisão do lojista, registrada na auditoria DB-AUDIT-001
> **Metodologia:** [decisions/000 — Decision Record Methodology](./000-decision-record-methodology.md)

---

## Contexto

A auditoria [DB-AUDIT-001](../zion-os/engineering/DB-AUDIT-001-estado-real-do-banco.md)
encontrou cinco migrações no repositório sem nenhum efeito no banco e sem nenhuma
linha no ledger — a divergência classificada como **DB-FIX-004**:

| Arquivo | Cria |
|---|---|
| `017-organizacoes.sql` | `organizacoes` — o tenant/agência acima de `clientes` |
| `018-origem-produto.sql` | `origem_produto` — âncora do `sku_origem` |
| `019-catalogo.sql` | `catalogo` — o lote recebido de uma Origem |
| `020-produto-mestre.sql` | `produto_mestre` — identidade universal, paralela a `produtos` |
| `021-produto-mestre-versao.sql` | `produto_mestre_versao` — histórico imutável |

Elas **não são código órfão.** São a materialização da fundação canônica descrita
em [`010-database-compliance`](../architecture/010-database-compliance.md) §7,
[`001-product-master`](../architecture/001-product-master.md) e
[`006-capability-000-zion-intake`](../architecture/006-capability-000-zion-intake.md):
tabelas novas e paralelas (Strangler Fig), a serem populadas *daqui para frente*
pelo Zion Intake, com os legados `produtos`/`produto_variantes` seguindo intocados.

E existe código real esperando por elas:

- `src/domain/produto-mestre/` — agregado, eventos, testes
- `src/application/use-cases/` — `criar-produto-mestre`, `atualizar-produto-mestre`,
  `adicionar-variante`, `atualizar-preco`
- `src/application/intake/`
- `src/infrastructure/persistence/supabase/repositories/produto-mestre-repository-supabase.ts`
  — que aponta explicitamente para `produto_mestre` (020) e `produto_mestre_versao` (021)

Esse código **passa no portão** (1515 testes verdes) porque é testado contra um
Supabase falso em memória. E **nenhuma rota ou página o instancia**: não há
importação de `src/app/` para os use-cases nem para o repositório.

## O achado que decidiu

As seis verticais entregues em julho de 2026 — busca forte, proposta de peso,
proposta de custo, cadastro conversacional, procedência, preparação de anúncio,
pricing — foram **todas** construídas sobre `produtos` e `produto_variantes`
legados. As migrações 035–043, inclusive, estendem esse modelo, não o canônico.

Ou seja: a fundação canônica não está bloqueando nada, e nada está caminhando na
direção dela. Ela foi desenhada antes do pivot para self-service
([[zion-pivot-self-service]]) e o produto seguiu por outro caminho.

## Decisão

**Arquivar as cinco migrações** em `database/migrations/arquivadas/`, sem aplicá-las.

O código hexagonal em `src/` **fica onde está**, intocado: é testado, não custa
nada em runtime porque ninguém o instancia, e é o registro executável do desenho
caso a direção volte.

## Alternativas consideradas

**Aplicar as cinco agora.** Criaria cinco tabelas dormentes com RLS que passaria a
precisar de conferência em toda auditoria futura. A DB-AUDIT-001 acabou de gastar
duas migrações (041 e 042) consertando exatamente esse tipo de superfície acumulada
— e a 005 §3 mostrou que política que ninguém exercita é política que ninguém
percebe estar errada. Adicionar cinco tabelas que nada consome é adicionar cinco
oportunidades de repetir aquele erro.

**Aplicar só 017–019** (`organizacoes`, `origem_produto`, `catalogo`), que não
duplicam nada, e deixar `produto_mestre`/`produto_mestre_versao` para quando o
Intake existir. Recusada pelo mesmo argumento em escala menor: três tabelas vazias
com RLS a manter, sem consumidor. E `018`/`019` têm FK obrigatória para
`organizacoes`, então nenhuma delas é útil isolada.

## Consequências

**A numeração fica com um vão: 016 → 022.** É deliberado e não deve ser
"consertado" renumerando. Os números 017–021 estão gastos: aparecem nos cabeçalhos
dos arquivos arquivados, nos documentos de arquitetura e nesta decisão. Reciclá-los
faria duas migrações diferentes responderem pelo mesmo número — que é a categoria
de problema que a DB-FIX-003 acabou de fechar.

**O repositório continua não reproduzindo o banco a partir do zero** — e não é por
causa deste arquivamento. A `032` é destrutiva de dados (apagou 1.733 produtos de
planilha), e rodar as migrações em ordem numa base nova não recria o estado atual.
Reprodutibilidade completa é outro trabalho, ainda não aberto.

**Reverter é um `git mv`.** Nada foi apagado, nada foi reescrito. Se o Zion Intake
voltar à mesa, os arquivos estão íntegros, com os cabeçalhos originais e a ordem de
dependência (017 → 018 → 019 → 020 → 021) preservada.

**Nenhuma linha no ledger.** `migracoes_aplicadas` registra o que foi aplicado, e
estas não foram. Este ADR é o registro. A view `public.migracoes_divergencia`
(migração 043) continuará mostrando 017–021 em nenhuma das duas fontes, o que é a
verdade sobre elas.
