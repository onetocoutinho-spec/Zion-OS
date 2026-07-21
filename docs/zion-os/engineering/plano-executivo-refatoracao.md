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
| `mlUserProducts.ts` | **SIM** (9 testes) |
| `serverAuthorization.ts` | **SIM** |
| `mercadolivre.ts` | **NÃO** |
| `mlPayload.ts` | **NÃO** |
| `canalServidor.ts` | **NÃO** |
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

### R11 — Determinação de exigência do modelo do canal

- **Origem:** `mlUserProducts.ts` (l. 47–153) · **Destino:** `modules/integration` —
  Capability
- **Estado:** **Não iniciada** · **Release prevista:** 007
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

### R10 — Conhecimento de medidas por marca

- **Origem:** `tabelasMedidas.ts` · **Destino:** `modules/catalog`
- **Estado:** **Não iniciada** · **Release prevista:** 008
- **Por que NÃO pode migrar ainda:** não possui teste próprio (verificado); o Protocolo
  (Fase 1) exige linha de base mensurável.
- **Pré-requisitos:** criar linha de base local para `medidasDaMarca`.
- **Evidências mínimas:** linha de base criada e verde antes da migração; 5 consumidores
  atualizados; build.
- **Dependências:** nenhuma. **Bloqueia:** R13 (o Mapeamento registra R10 entre suas
  dependências).
- **Risco:** **Médio** — 5 consumidores, três deles telas · **Complexidade:** **Média**
- **Estratégia:** mover arquivo inteiro; atualizar 5 importadores.

### R13 — Composição do conteúdo pretendido

- **Origem:** `mlUserProducts.ts` (l. 238–310) · **Destino:** `modules/publication` —
  domínio
- **Estado:** **Não iniciada** · **Release prevista:** 009
- **Por que NÃO pode migrar ainda:** o Mapeamento classifica seu acoplamento como
  **alto** — depende de R9 (✔ migrada), **R10 (não migrada)** e do tipo `AnuncioGerado`
  da esteira; e sua estratégia exige **dividir** o arquivo entre dois módulos, o que o
  Mapeamento marca como risco **alto**.
- **Pré-requisitos:** R10 migrada.
- **Evidências mínimas:** 9 testes de `mlUserProducts` antes e depois; **divisão sem
  alteração de lógica** demonstrada; build; auditoria de commit.
- **Dependências:** **R10**.
- **Risco:** **Alto** · **Complexidade:** **Alta**
- **Estratégia:** dividir de R11/R12; mover a parcela de composição para Publication.

### R12 — Montagem do payload no formato do canal

- **Origem:** `mlUserProducts.ts` (l. 90) e `mlPayload.ts` · **Destino:**
  `modules/integration` — Tradutor
- **Estado:** **Não iniciada** · **Release prevista:** 010
- **Por que NÃO pode migrar ainda:** linha de base **parcial** — `mlUserProducts.ts` tem
  testes, `mlPayload.ts` **não**; o Mapeamento registra acoplamento **médio** e 2
  consumidores.
- **Pré-requisitos:** linha de base para `mlPayload.ts`; preferencialmente após R13, que
  separa composição de tradução no mesmo arquivo.
- **Evidências mínimas:** linhas de base de ambos os arquivos; 2 consumidores
  atualizados; build.
- **Dependências:** **R13** (recomendável, para não dividir o mesmo arquivo duas vezes).
- **Risco:** **Médio** · **Complexidade:** **Média**
- **Estratégia:** mover e separar de R13.

### R15 — Montagem e disparo no cliente

- **Origem:** `publicacaoML.ts` · **Destino:** `modules/publication` — Aplicação
- **Estado:** **Não iniciada** · **Release prevista:** 011
- **Por que NÃO pode migrar ainda:** sem teste próprio; o Mapeamento registra **alto
  acoplamento de saída** (6 dependências) e estratégia de **mover para o servidor**, o
  que ultrapassa uma migração de localização.
- **Pré-requisitos:** linha de base local; decisão sobre a mudança de camada
  (cliente→servidor) — **não coberta** por este plano.
- **Evidências mínimas:** a definir na Fase 1 da respectiva migração.
- **Dependências:** R12, R13.
- **Risco:** **Médio-alto** · **Complexidade:** **Alta**

### R2 — Persistência do vínculo do canal

- **Origem:** `canalServidor.ts` · **Destino:** `modules/integration` — Connection
  (infraestrutura)
- **Estado:** **Não iniciada** · **Release prevista:** 012
- **Por que NÃO pode migrar ainda:** sem teste próprio; **6 consumidores** (acoplamento
  **alto** no Mapeamento), cinco deles rotas.
- **Pré-requisitos:** linha de base local.
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
| **R11** | Não iniciada | Nenhum | **007** | Pronta para migrar | Executar migração |
| **R10** | Não iniciada | Sem linha de base | 008 | Aguardando preparação | Criar linha de base |
| **R13** | Não iniciada | Depende de R10 | 009 | Aguardando R10 | Aguardar Release 008 |
| **R12** | Não iniciada | Linha de base parcial | 010 | Aguardando preparação | Criar linha de base p/ `mlPayload` |
| **R15** | Não iniciada | Sem linha de base + mudança de camada | 011 | Aguardando definição | Criar linha de base |
| **R2** | Não iniciada | Sem linha de base | 012 | Aguardando preparação | Criar linha de base |
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

**Resumo:** 1 concluída · 1 pronta para migrar · 5 aguardando engenharia adicional · 8
bloqueadas por governança · 2 sem destino.

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
