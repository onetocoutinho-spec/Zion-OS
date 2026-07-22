# SEEDS — Sementes Arquiteturais da Plataforma

> Registro permanente de **sementes encontradas no código** durante o Programa de
> Evolução (Archaeological Engineering). Sementes são estruturas já existentes que
> apontam para a visão de longo prazo (Z1–Z8). **Nada aqui é para implementar
> agora** — este registro alimentará o futuro documento de evolução da plataforma.
> Regra: antes de criar algo novo, perguntar "já existe uma semente disso?"

## Registradas no PR-002 (2026-07-22)

| # | Semente | Onde vive hoje | Aponta para |
|---|---|---|---|
| S-01 | **Identity como ciclo de vida** — identidade explícita com estado (`ativo`), taxonomia `sem_perfil`/`perfil_inativo`/`erro` | `perfis(papel, ativo, cliente_id)` · `src/lib/auth/estadoAuth.ts` | Domínio **Identity** |
| S-02 | **Capability checks primitivos** — as primeiras funções de "quem pode o quê"; papel binário hoje, estrutura aceita papéis ricos sem mudar o modelo | `eh_equipe()` · `cliente_do_usuario()` (migrações 005/016) | **Capabilities (Z6)** — autorização evoluindo para capacidades |
| S-03 | **Workspace sobre organizações** — camada acima de clientes, já herdando o modelo de acesso | tabela `organizacoes` (migração 017) | **Workspace Intelligence (Z7)** |
| S-04 | **Tenant embutido na AIL desde o design** — toda Decision/Pattern já carrega `empresa`; quando Identity amadurecer, a memória organizacional particiona sem migração | colunas `empresa` em `decisoes`/`padroes` | **Organizational Memory (Z2)** · AIL (Z5) |
| S-05 | **Migração-como-release** — pré-requisito, verificação e rollback embutidos no próprio artefato | padrão da migração 016 | **Exoesqueleto** — governança operacional (regra dos 3 artefatos) |

## Registradas no PR-003 (2026-07-22)

| # | Semente | Onde vive hoje | Aponta para |
|---|---|---|---|
| S-06 | **Sonda de estado aplicado** — detector artesanal de "migração aplicada?" que virou a fonte do baseline do ledger | `database/checks/diagnostico-migracoes-producao.sql` | Observabilidade operacional |
| S-07 | **Metadados de ambiente no banco** — guardrail de staging via tabela (`environment_metadata`) | `database/staging/sql-editor/01-base-schema.sql` | Família do Migration Ledger |
| S-08 | **Versionamento de schema client-side** — `VERSAO` com re-seed ao mudar | `src/lib/store.ts` | O mesmo conceito (schema versionado + registro), lado demo |
| S-09 | **Infrastructure Metadata** *(oportunidade registrada pelo mantenedor)* — `environment_metadata` + `migracoes_aplicadas` pertencem à mesma família e podem um dia convergir num conceito amplo de metadados de infraestrutura | migração 024 + staging kit | Exoesqueleto · memória própria de cada componente ("a AIL tem memória; o Workspace terá; a organização terá; o banco agora tem") |

## Registradas no PR-004 (2026-07-22)

| # | Semente | Onde vive hoje | Aponta para |
|---|---|---|---|
| S-10 | **Funil de correções** — `atualizarProduto` é o ponto natural por onde decisões de campo convergem (agregado já escalável: campo novo = 1 linha) | `produtos.ts` (CAMPOS_OBSERVADOS) | **Signal Pipeline** sem event bus |
| S-11 | **Confiança qualificada no domínio** — `confiança do custo: alta/media/baixa` já existe em `Produto` | `types.ts` | **Decision Intelligence** — o domínio já pensa em graus de confiança, como a escada da AIL |
| S-12 | **Pub/sub embrionário** — `notificarMudanca` + `useLiveQuery` (48 telas) | `store.ts` | **Event Stream / Workspace Intelligence** |

## Como usar este registro

- Novas sementes: adicionar aqui no PR em que forem descobertas (número sequencial).
- Ao iniciar um trabalho de Z1–Z8: consultar este arquivo ANTES de desenhar —
  reutilizar/consolidar/fortalecer o que já existe.
- Uma semente só sai daqui quando germinar (virar implementação) ou for
  formalmente descartada com justificativa.
