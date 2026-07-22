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

## Registradas no PR-006 (2026-07-22)

| # | Semente | Onde vive hoje | Aponta para |
|---|---|---|---|
| S-13 | **Knowledge Source** *(hipótese — evidência parcial)* — o ambiente externo não só fornece dados: ele **propõe** (`preverCategoria`/domain_discovery), **veta** (rejeições com motivo estruturado) e **mede** (vendas/visitas). PR-006 fechou os dois primeiros loops; a generalização "fonte externa de conhecimento" como conceito de primeira classe ainda NÃO tem evidência suficiente — exigiria ADR (Architecture Freeze v1) | `preverCategoria` + `extrairErro` (`mercadolivre.ts`) · loops do `publicacaoML.ts` | **AIL (Z5)** — quando ≥3 marketplaces exibirem o mesmo padrão propor/vetar/medir, promover via ADR |
| S-14 | **Publish Status como ciclo de vida** — o anúncio já transita `rascunho → aprovado → publicado` e agora carrega o veredito de rejeição nas `observacoes`; estrutura pronta para um estado `rejeitado` explícito quando a operação precisar filtrar por ele | `anuncios_gerados.status` + `observacoes` | **Workspace Intelligence (Z7)** — visão operacional de funil de publicação |
| S-15 | **External Rules capturadas em código** — regras do ML já vivem como conhecimento executável: categoria decide o modelo (clássico vs User Products), guia de tamanhos tem padrão de nome próprio (`normalizarNomeGuia` + filtro anti-legado), atributos obrigatórios por categoria | `mercadolivre.ts` (charts/User Products) · `mlPayload.ts` | **Organizational Memory (Z2)** — regras externas hoje hardcoded podem um dia ser conhecimento versionado por marketplace |

## Registradas no PR-007 (2026-07-22) — Pattern Confidence Discovery

| # | Semente | Onde vive hoje | Aponta para |
|---|---|---|---|
| S-16 | **Pattern Conflict** *(parcialmente germinada)* — `em_disputa` implementado e testado; falta nome/leitura para o concorrente isolado | `estadoDoSlot` (`pattern.ts`) | Exception Detection |
| S-17 | **Pattern Reinforcement** — convergência de fontes no mesmo slot (cadastro + publicação em `categoriaMarketplace`); a confirmação (`prevista === usada`) chega à porta do `capturarDecisao` e é descartada pela guarda de delta | PR-006 · `chaveDe` | Confidence acima de Consistente |
| S-18 | **Pattern Confidence além da contagem** — escada completa congelada (RFC-AIL-002 §7); níveis superiores gated em Outcomes | `confidenceDe` + fronteira dura (004 §4.3) | Suggestion Engine (E4) |
| S-19 | **Pattern Decay** — sinal cru pronto (`decidido_em`, `ultima_ocorrencia` armazenados, nunca lidos); política deferida com EVIDÊNCIA INSUFICIENTE | migrações 022/023 · RFC-AIL-004 §6.4 | R-AIL-5 (reaprendizado) |
| S-20 | **Exception Detection** — o Journal guarda a trajetória (`valor_anterior` + `decidido_em`); o Detector é cego a ela **por teorema** (confluência §7.3), não por lacuna. Será leitura do Journal, nunca mudança no Detector | 022 · `pattern-detector.ts` | Decision Intelligence |

## Registradas no PR-008 (2026-07-22) — Outcome Discovery

| # | Semente | Onde vive hoje | Aponta para |
|---|---|---|---|
| S-21 | **Outcome Source** — 4 produtores de veredito identificados: ambiente (aceite/veto ML), sistema (veredito A10), humano (curadoria), mercado (pedidos pagos). "Outcome" são 3 conceitos que as RFCs distinguem (destino-de-Suggestion · vereditos do domínio · resultados de infra) | `anunciosGerados.ts` · `esteira.ts` · `vendasML.ts` | Suggestion Engine · Explainability |
| S-22 | **Outcome History** — apêndice append-only textual de vereditos (`comporObservacoesComFalha` preserva sem destruir); `Decision.correlacao` existe e está **ocioso** | `publicacaoML.ts` · 022 | histórico de vereditos estruturado |
| S-23 | **Outcome Aggregation** — `calcularMetricas` já agrega outcomes (pedidos → métricas) como função pura; sobre dados efêmeros | `vendasML.ts` | Decision Intelligence |
| S-24 | **Venda como veredito não-preservado** — o único veredito de **sucesso** (não só aceitação) é buscado (`order.status=paid`), agregado, exibido e **descartado** a cada consulta. Cancelamentos/devoluções nem são lidos | `buscarPedidosML` · `vendasML.ts` | futura ADR (persistir exige caso de uso) |
| S-25 | **Tensão ledger × efemeridade** *(germinada → resolvida)* — derivar Outcome exige memória da oferta; 002 ("efêmera") × 005 ("ledger") não podiam ser ambas verdadeiras sem ela. **Resolvida por [ADR-001](../zion-os/engineering/ADR-001-suggestion-memory.md)**: ledger = projeção de ofertas append-only × Journal | ADR-001 | Suggestion Engine (pré-requisito) |

## Como usar este registro

- Novas sementes: adicionar aqui no PR em que forem descobertas (número sequencial).
- Ao iniciar um trabalho de Z1–Z8: consultar este arquivo ANTES de desenhar —
  reutilizar/consolidar/fortalecer o que já existe.
- Uma semente só sai daqui quando germinar (virar implementação) ou for
  formalmente descartada com justificativa.
