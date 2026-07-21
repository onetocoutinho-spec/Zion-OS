# Plano Executivo da Refatoração Arquitetural

> **Natureza.** Backlog oficial da refatoração. **Organiza a execução** do que já está
> definido; não cria decisão arquitetural, não inventa prioridade, não altera o
> Mapeamento, o Protocolo nem a governança.
>
> **Fundamento de toda classificação:** Mapeamento Arquitetural · Protocolo de Migração
> Arquitetural · governança vigente · bloqueios registrados · evidências já produzidas.
>
> **Documento vivo.** Deve ser atualizado a cada release de refatoração.
>
> **Nota de Revisão.** Revisão documental realizada para alinhar a numeração das Releases
> previstas no roadmap ao histórico efetivamente executado após a institucionalização do
> Plano Executivo na Release 005. Nenhuma decisão técnica, arquitetural ou de governança
> foi alterada.

---

## Fontes de classificação

**Bloqueio de governança vigente** *(decisão de gestão sobre o estado da Sprint 0)*:
bloqueadas as etapas que **movem, dividem ou reorganizam** `mercadolivre.ts` e
`publicar/route.ts`, porque o comportamento de reutilização de guias **não possui linha
de base observada em produção**. *Condição de desbloqueio:* a validação operacional.

**Exigência do Protocolo (Fase 1):** sem **linha de base mensurável**, a migração **não
começa**.

**Linha de base disponível — verificada no repositório:**

| Arquivo de origem | Teste próprio |
|---|---|
| `mlUserProducts.ts` | **SIM** (8 testes — R12, Release 015) |
| `serverAuthorization.ts` | **SIM** |
| `mercadolivre.ts` | **NÃO** |
| `mlPayload.ts` | **SIM** (8 testes — R12, Release 015) |
| `canalServidor.ts` | **SIM** (12 testes — R2, Release 016) |
| `publicacaoML.ts` | **NÃO** |
| `tabelasMedidas.ts` | **NÃO** |

**Módulos existentes em `src/modules/`:** `catalog`, `publication`, `integration`,
`operation-center`. **Não existem** `identity-access` nem `ai-services` — ausência
deliberada registrada na Release 002.

---

# Backlog por responsabilidade

## R9 — Canonização de Tamanhos ✅

- **Origem:** `normalizarTamanho.ts` · **Destino:** `modules/publication/domain` ✔
- **Estado:** **CONCLUÍDA** · **Release:** 003
- **Motivo:** migrada com preservação comprovada — rename 100%, 27 testes idênticos antes
  e depois, build íntegro.

---

## GRUPO A — Migração imediata

*Linha de base suficiente · baixo risco · baixo acoplamento · sem bloqueio de governança.*

### R11 — Determinação de exigência do modelo do canal ✅

- **Origem:** `mlUserProducts.ts` (l. 47–153) · **Destino:**
  `modules/integration/domain/exigenciaModeloCanal.ts` — Capability ✔
- **Estado:** **CONCLUÍDA** · **Release:** 007 · **Data:** 21 de julho de 2026
- **Justificativa da mudança de estado:** migrada por extração com preservação comprovada
  — conteúdo extraído com **sha256 idêntico** ao da origem, assinatura pública inalterada,
  **9 testes** verdes antes e depois (2 no destino, 7 na origem), build íntegro, consumidor
  alterado apenas em linhas de import. R12 e R13 permaneceram intactas.
- **Por que PODE migrar:** *(a)* não vive em `mercadolivre.ts` nem em
  `publicar/route.ts` — o bloqueio de governança, em sua redação, não a alcança; *(b)*
  possui linha de base — `mlUserProducts.test.ts`, 9 testes; *(c)* o Mapeamento
  classifica seu acoplamento como **baixo** e a prioridade de extração como **alta**;
  *(d)* consumidor único identificado (`publicar/route.ts`, apenas import).
- **Pré-requisitos:** nenhum.
- **Evidências mínimas:** assinatura pública das funções e constantes; 9 testes de
  `mlUserProducts` antes e depois; build antes e depois; auditoria de commit; diff do
  consumidor.
- **Dependências:** nenhuma.
- **Risco:** **Baixo** · **Complexidade:** **Baixa**
- **Estratégia:** extrair funções e constantes para arquivo próprio no destino;
  atualizar o import do consumidor. *Atenção:* o consumidor é `publicar/route.ts` —
  alterar **apenas seu import** não constitui reorganização do arquivo, mas exige
  registro explícito da distinção na release.

---

## GRUPO B — Dependem de engenharia adicional

*Sem bloqueio de governança, porém sem linha de base própria ou com acoplamento que
exige preparação.*

### R10 — Conhecimento de medidas por marca ✅

- **Origem:** `tabelasMedidas.ts` · **Destino:**
  `modules/catalog/domain/tabelasMedidas.ts` ✔
- **Estado:** **CONCLUÍDA** · **Release:** 008 · **Data:** 21 de julho de 2026
- **Justificativa da mudança de estado:** movimentação integral com `git mv` — **rename
  100% (R100)** em produção e teste, SHA-256 idêntico antes e depois, assinatura pública
  inalterada (9 exports), **14 testes** e **215** da suíte verdes antes e depois, build
  íntegro, 4 consumidores alterados apenas em linha de import.
- **Pré-requisito — CONCLUÍDO (Release 014):** criar linha de base local. O motivo que
  impedia a migração — *não possuir teste próprio* — deixou de existir:
  `tabelasMedidas.test.ts` institucionaliza **14 testes** cobrindo os **9 símbolos
  públicos**, com detecção de regressão comprovada por mutação (7 de 7). Registro em
  `engineering/linha-de-base-r10.md`.
- **Evidências mínimas:** linha de base criada e verde antes da migração; 5 consumidores
  atualizados; build.
- **Dependências:** nenhuma. **Bloqueia:** R13 (o Mapeamento registra R10 entre suas
  dependências).
- **Risco:** **Médio** — 5 consumidores, três deles telas · **Complexidade:** **Média**
- **Estratégia:** mover arquivo inteiro; atualizar 5 importadores.

### R13 — Composição do conteúdo pretendido ✅

- **Origem:** `mlUserProducts.ts` · **Destino:**
  `modules/publication/domain/composicaoConteudo.ts` ✔
- **Estado:** **CONCLUÍDA** · **Release:** 009 · **Data:** 21 de julho de 2026
- **Justificativa da mudança de estado:** extraída com preservação comprovada — **SHA-256
  idêntico** nos dois blocos extraídos, assinatura pública conservada (9 exports = 4 na
  origem + 5 no destino), **7 testes** e **215** da suíte verdes antes e depois, build
  íntegro, 2 consumidores alterados apenas em linha de import. R12 permaneceu intacta e
  `VariacaoUP` permaneceu **único**, importado pelo novo módulo.
- **Pré-requisitos — CONCLUÍDOS:** R9 (Release 003) e **R10 (Release 008)** migradas.
- **Evidências mínimas:** 7 testes antes e depois; **divisão sem
  alteração de lógica** demonstrada; build; auditoria de commit.
- **Dependências:** **R10** — satisfeita.
- **Risco:** **Alto** · **Complexidade:** **Alta**
- **Estratégia:** dividir de R11/R12; mover a parcela de composição para Publication.

### R12 — Montagem do payload no formato do canal ✅

- **Origem:** `mlUserProducts.ts` e `mlPayload.ts` · **Destino:**
  `modules/integration/domain/` — Tradutor ✔
- **Estado:** **CONCLUÍDA** · **Release:** 010 · **Data:** 21 de julho de 2026
- **Justificativa da mudança de estado:** **movimento integral de quatro arquivos** com
  `git mv` — similaridades **R100** (`mlUserProducts.ts` e seu teste, SHA-256 idêntico),
  **R097** e **R099** (`mlPayload.ts` e seu teste, diferença exclusivamente de caminho de
  import), todas idênticas às previstas na Pré-Abertura. Assinatura pública conservada
  (7 exports), **16 testes** e **231** da suíte verdes antes e depois, build íntegro,
  3 consumidores alterados apenas em linha de import.
- **Pré-requisito — CONCLUÍDO (Release 015):** linha de base para `mlPayload.ts`. A
  cobertura deixou de ser **parcial**: `mlPayload.test.ts` e `mlUserProducts.test.ts`
  institucionalizam **16 testes** protegendo os **7 símbolos públicos** de R12 nos dois
  arquivos que a implementam, com detecção de regressão comprovada por mutação (14 de 14).
  Registro em `engineering/linha-de-base-r12.md`. A dependência de R13 foi satisfeita na
  Release 009.
- **Evidências mínimas:** linhas de base de ambos os arquivos — **disponíveis**;
  consumidores atualizados; build.
- **Dependências:** **R13** — satisfeita (Release 009).
- **Risco:** **Médio** · **Complexidade:** **Média**
- **Estratégia:** mover e separar de R13.

### R15 — Montagem e disparo no cliente

- **Origem:** `publicacaoML.ts` · **Destino:** `modules/publication` — Aplicação
- **Estado:** **BLOQUEADA — decisão arquitetural** · **Release prevista:** 011
- **Por que NÃO pode migrar ainda:** sem teste próprio; o Mapeamento registra **alto
  acoplamento de saída** (6 dependências) e estratégia de **mover para o servidor**, o
  que ultrapassa uma migração de localização.
- **Premissa reavaliada (Release 017):** a **Avaliação Arquitetural da R15** reexaminou a
  premissa sobre o `HEAD` posterior às cinco migrações e concluiu que ela **permanece
  válida**. Registrou que seu **escopo estreitou** — as duas dependências puras (R12 e R13)
  migraram, restando acoplada ao navegador **apenas a E/S** — e identificou um **novo
  impedimento**: o Mapeamento classifica **R14 e R15 juntas como *Orquestração*** (§6),
  e R14 está bloqueada por governança e pela inexistência do Operation Center. Registro em
  `engineering/avaliacao-arquitetural-r15.md`.
- **Pré-requisitos:** linha de base local; decisão sobre a mudança de camada
  (cliente→servidor) — **não coberta** por este plano. **Exige ADR aprovado**; nenhum
  existe. **R15 é a única responsabilidade do Grupo B bloqueada por decisão arquitetural.**
- **Evidências mínimas:** a definir na Fase 1 da respectiva migração.
- **Dependências:** R12, R13.
- **Risco:** **Médio-alto** · **Complexidade:** **Alta**

### R2 — Persistência do vínculo do canal

- **Origem:** `canalServidor.ts` · **Destino:** `modules/integration` — Connection
  (infraestrutura)
- **Estado:** **Não iniciada** · **Release prevista:** 012 · **Categoria A** — linha de
  base própria institucionalizada
- **Pré-requisito — CONCLUÍDO (Release 016):** linha de base local. O motivo que impedia a
  migração — *sem teste próprio* — deixou de existir: `canalServidor.test.ts`
  institucionaliza **12 testes** protegendo os **4 símbolos públicos** e os **8
  invariantes** da responsabilidade, com detecção de regressão comprovada por mutação
  (14 de 14). Registro em `engineering/linha-de-base-r2.md`.
- **Ambiguidade de estratégia — RESOLVIDA (ADR-009, aprovado):** a Pré-Abertura da Release
  012 produziu parecer **NÃO ELEGÍVEL** porque a estratégia registrada no Mapeamento —
  *"Mover atrás de porta"* — admitia dois escopos arquiteturalmente distintos. O
  **ADR-009** fixou que a expressão significa **preservar o ponto único de acesso**, e não
  construir artefato; determinou que **Ports não integram a arquitetura do Zion OS**; e
  autorizou o escopo: **movimento integral para `modules/integration/infrastructure/`**,
  sem Port, sem abstração e sem alterar contrato. Registros em
  `governance/ADR-009-estrategia-de-ports-e-escopo-da-r2.md` e
  `docs/releases/pre-abertura/release-012-checklist-r2.md`.
  *O campo **Estratégia** desta entrada será preenchido **dentro da Release 012**, conforme
  §6.3 e §9 do ADR-009.*
- **Evidências mínimas:** 6 consumidores atualizados; build; auditoria de commit.
- **Dependências:** nenhuma.
- **Risco:** **Médio** · **Complexidade:** **Média**
- **Observação do Mapeamento:** prioridade de extração **baixa** — "coeso e estável;
  mover cedo traria risco sem ganho proporcional".

---

## GRUPO C — Bloqueadas por governança

*Vivem em `mercadolivre.ts` ou `publicar/route.ts`. **Todas** dependem da mesma condição
de desbloqueio: a validação operacional do comportamento de reutilização de guias.*

**Nenhuma possui teste próprio** (verificado) — ao serem desbloqueadas, exigirão também
linha de base, conforme a Fase 1 do Protocolo.

| ID | Nome | Origem | Destino | Risco | Complexidade | Prioridade no Mapeamento |
|---|---|---|---|---|---|---|
| **R3** | Determinação de categoria | `mercadolivre.ts` 134–144 | Integration / Capability | Baixo | Baixa | **Alta** |
| **R4** | Publicação de item | `mercadolivre.ts` 146–170 | Integration / adaptador | Baixo | Baixa | **Alta** |
| **R8** | Tradução de erros | `mercadolivre.ts` 19–31, 48–66 | Integration / Tradutor | Baixo-médio | Média | Média |
| **R1** | Credenciais do canal | `mercadolivre.ts` 68–132 | Integration / Connection | Médio | Média | Média |
| **R6** | Importação de anúncios | `mercadolivre.ts` 260–388 | Integration / Tradutor | Médio | Média | Média |
| **R7** | Guia de medidas | `mercadolivre.ts` 390–646 | Integration (Mapping/Capability/Communication/Policies) | **Alto** | **Alta** | Alta (contida por risco) |
| **R17** | Telemetria | `route.ts` + `mercadolivre.ts` | Capacidade transversal | **Alto** | Média | Baixa |
| **R14** | Orquestração da publicação | `publicar/route.ts` | Interface + OC + Integration | **Alto** | **Alta** | Última |

**Por que NÃO podem migrar:** o bloqueio de governança as alcança diretamente — todas
residem nos dois arquivos nomeados. Fundamento registrado: *não se prova preservação de
comportamento contra uma linha de base que nunca foi medida.*

**Notas específicas:**

- **R17 (Telemetria)** — o Mapeamento a registra como o **contrato comportamental** usado
  para comprovar preservação nas demais migrações. Alterá-la removeria o instrumento de
  comparação. Deve ser **a última** entre as do Grupo C.
- **R14 (Orquestração)** — além do bloqueio, seu destino exige que o **Operation Center
  exista como implementação**, o que hoje não ocorre.
- **R7 (Guia de medidas)** — é a responsabilidade cujo comportamento a validação
  operacional está justamente medindo. É a mais dependente da condição de desbloqueio.

**Ordem sugerida após o desbloqueio**, derivada da prioridade e do risco registrados no
Mapeamento: **R3 → R4 → R8 → R1 → R6 → R7 → R17 → R14**.

---

## GRUPO D — Sem destino arquitetural definido

*Não devem ser migradas até que a arquitetura correspondente exista.*

### R5 — Leitura de vendas do canal

- **Origem:** `mercadolivre.ts` (l. 172–258) · **Destino:** Integration — fronteira,
  **servindo um domínio ainda não especificado**
- **Estado:** **Bloqueada**
- **Por que NÃO pode migrar:** o Mapeamento registra (B5) que **Vendas/Pedidos** é um
  domínio referenciado pelo código para o qual **não há arquitetura de módulo
  especificada**. Adicionalmente, vive em `mercadolivre.ts` — também alcançada pelo
  bloqueio de governança.
- **Pré-requisitos:** especificação da arquitetura do domínio de Vendas/Pedidos.
- **Risco:** **Médio** · **Complexidade:** **Média**

### R16 — Autorização de acesso

- **Origem:** `serverAuthorization.ts` · **Destino:** capacidade transversal, apoiada em
  **Identity & Access**
- **Estado:** **Bloqueada**
- **Por que NÃO pode migrar:** o módulo `identity-access` **não existe** em
  `src/modules/` — ausência deliberada registrada na Release 002, por não haver
  arquitetura de módulo especificada para ele.
- **Observação favorável:** **possui teste próprio** (`serverAuthorization.test.ts`) —
  quando o destino existir, a linha de base já estará disponível.
- **Pré-requisitos:** arquitetura do módulo Identity & Access; criação do seu espaço.
- **Risco:** **Baixo** · **Complexidade:** **Baixa**
- **Observação do Mapeamento:** prioridade **baixa** — "já isolada e coesa".

---

# Roadmap sugerido

> Sequência derivada dos grupos, das dependências registradas e das prioridades do
> Mapeamento. **Uma responsabilidade por migração**, conforme o Protocolo.

### Release 007 — R11 (Exigência do modelo do canal)
- **Justificativa:** única responsabilidade do Grupo A; linha de base existente,
  acoplamento baixo, consumidor único, sem bloqueio.
- **Risco:** Baixo.
- **Evidências obrigatórias:** assinatura pública; 9 testes de `mlUserProducts` antes e
  depois; build antes e depois; auditoria de commit; diff do consumidor.
- **Conclusão:** R11 em `modules/integration`, testes idênticos, build verde, escopo
  igual ao declarado.

### Release 008 — R10 (Medidas por marca)
- **Justificativa:** desbloqueia R13; sem bloqueio de governança.
- **Pré-requisito:** criação de linha de base local.
- **Risco:** Médio — 5 consumidores.
- **Evidências obrigatórias:** linha de base criada e verde; 5 consumidores atualizados;
  build; auditoria de commit.
- **Conclusão:** R10 em `modules/catalog`; nenhum consumidor quebrado.

### Release 009 — R13 (Composição do conteúdo)
- **Justificativa:** com R10 migrada, a dependência registrada é satisfeita.
- **Risco:** Alto — exige **dividir** um arquivo entre dois módulos.
- **Evidências obrigatórias:** 9 testes antes e depois; demonstração de que a divisão não
  alterou lógica; build; auditoria de commit.
- **Conclusão:** composição em Publication, tradução permanecendo em Integration.

### Release 010 — R12 (Payload do canal)
- **Justificativa:** completa a separação iniciada em R13.
- **Pré-requisito:** linha de base para `mlPayload.ts`.
- **Risco:** Médio.
- **Conclusão:** tradução consolidada em Integration.

### Release 011 — R15 (Montagem no cliente)
- **Pré-requisito:** linha de base local **e** decisão sobre a mudança de camada, não
  coberta por este plano.
- **Risco:** Médio-alto.

### Release 012 — R2 (Vínculo do canal)
- **Pré-requisito:** linha de base local.
- **Risco:** Médio — 6 consumidores.

### Releases seguintes — Grupo C, após o desbloqueio
Ordem sugerida: **R3 → R4 → R8 → R1 → R6 → R7 → R17 → R14**, cada uma exigindo criação de
linha de base (nenhuma possui teste próprio).

### Sem previsão — Grupo D
**R5** e **R16**, condicionadas à existência das arquiteturas correspondentes.

---

# Quadro executivo

| Resp. | Estado | Bloqueio | Release | Situação atual | Próxima ação |
|---|---|---|---|---|---|
| **R9** | ✅ Concluída | — | 003 | Migrada, comportamento preservado | Nenhuma |
| **R11** | ✅ Concluída | — | 007 | Migrada, comportamento preservado | Nenhuma |
| **R10** | ✅ Concluída | — | 008 | Migrada, comportamento preservado | Nenhuma |
| **R13** | ✅ Concluída | — | 009 | Migrada, comportamento preservado | Nenhuma |
| **R12** | ✅ Concluída | — | 010 | Migrada, comportamento preservado | Nenhuma |
| **R15** | 🔒 Bloqueada | Decisão arquitetural (sem ADR) | 011 | Premissa confirmada na Release 017 | Deliberar ADR de camada |
| **R2** | Não iniciada | Nenhum | 012 | Estratégia fixada pelo ADR-009 | Reexecutar Pré-Abertura |
| **R3** | Bloqueada | Governança | — | Aguardando validação operacional | Aguardar desbloqueio |
| **R4** | Bloqueada | Governança | — | Aguardando validação operacional | Aguardar desbloqueio |
| **R8** | Bloqueada | Governança | — | Aguardando validação operacional | Aguardar desbloqueio |
| **R1** | Bloqueada | Governança | — | Aguardando validação operacional | Aguardar desbloqueio |
| **R6** | Bloqueada | Governança | — | Aguardando validação operacional | Aguardar desbloqueio |
| **R7** | Bloqueada | Governança | — | É o objeto da validação pendente | Aguardar desbloqueio |
| **R17** | Bloqueada | Governança | — | É o contrato de comparação | Migrar por último no grupo |
| **R14** | Bloqueada | Governança + OC inexistente | — | Aguardando duas condições | Aguardar ambas |
| **R5** | Bloqueada | Domínio inexistente | — | Sem destino arquitetural | Especificar Vendas/Pedidos |
| **R16** | Bloqueada | Módulo inexistente | — | Linha de base já disponível | Especificar Identity & Access |

**Resumo:** 5 concluídas · 2 aguardando engenharia adicional · 8 bloqueadas por
governança · 2 sem destino.

---

## Condição de desbloqueio do Grupo C

Uma única condição desbloqueia **oito responsabilidades** de uma vez: a **validação
operacional do comportamento de reutilização de guias** em produção. Enquanto ela não
ocorrer, mais da metade do backlog permanece parada — e o caminho crítico da refatoração
passa por uma **observação**, não por engenharia.

---

## Observação registrada, fora do escopo deste plano

Durante a verificação de linhas de base, constatou-se a existência de **28 arquivos de
teste** no projeto, incluindo estruturas em `src/domain/`, `src/application/` e
`src/infrastructure/` que **não constam do Mapeamento Arquitetural** — cujo escopo
cobriu as 17 responsabilidades do fluxo de publicação no Mercado Livre.

Registro factual, sem interpretação: **não foi avaliado** se essas estruturas se
relacionam, sobrepõem ou conflitam com `src/modules/`. Qualquer conclusão a respeito
exigiria ampliar o Mapeamento — o que este plano não faz.
