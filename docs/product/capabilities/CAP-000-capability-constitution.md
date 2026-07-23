# CAP-000 — Capability Constitution

> A Constituição permanente da arquitetura FUNCIONAL da Zion. Inaugura o eixo
> `capabilities/` — o par operacional do eixo `system/` (que governa o visual).
> Define as leis universais de **qualquer** Capability; jamais modela uma
> específica. Fontes: Constitution (CONST-001) · system/000·002·003·004·005 ·
> SHELL-001/002 · CMP-001.

## Nota de estratos e reconciliação (leia primeiro)

A Capability, a Tool, o Workflow e o Agent são **conceitos internos de
engenharia** — jamais expostos ao Cliente, exatamente como os termos do motor
(Pattern, Confidence). O VOC-001 governa a língua do Cliente; este documento
governa a língua da arquitetura funcional. **Onde CAP-000 nomeia um conceito
que já existe sob outro nome, ele reconcilia — não cria um modelo paralelo:**

| Conceito CAP-000 | JÁ É (fonte constitucional, via CONST-001) |
|---|---|
| **Mission** (pedido de decisão) | a Mission do CMP-001 — a face funcional e a visual do mesmo objeto |
| **Decision** (a resposta coletada) | a Decisão humana (CONST L13); no motor, a Decision do Journal |
| **Gap** | a **Lacuna** (VOC-001 · L3) |
| **Agreement** | o **Combinado** (UI-001) = a Delegação (ADR-002) |
| **Memory** | a **Segunda Verdade** (DOM-001 · L12) = o Journal/Knowledge |
| **Event** | o Veredito/fato registrado (L11/L12) |

**Limitação declarada:** a lista de fontes obrigatórias omite DOM-001/002,
VOC-001, UX-002 e a AIL — que são precisamente onde estes conceitos já vivem.
Uso a CONST-001 como ponte (ela os cita e embute o ciclo operacional). Onde uma
decisão exigiria um desses documentos diretamente, registro a dependência em
vez de reinventar (Parte 22, Lacunas).

---

## Parte 1 · Ontologia

| Termo | O que é | Responsabilidade | Nunca pode |
|---|---|---|---|
| **Capability** | uma competência operacional permanente | executar parte do ciclo, decidir *o quê*, produzir Missões/Gaps/Eventos | conhecer UI/DS/implementação; ser um fluxo/agente/tool |
| **Tool** | uma execução cega | fazer *o que* a Capability mandou (traduzir, chamar, gravar) | ter inteligência, memória, iniciativa ou decisão |
| **Workflow** | uma coordenação de Capabilities | orquestrar a ordem entre competências | conter competência própria; acoplar Capabilities |
| **Agent** | um executor autônomo sob delegação | executar dentro de um Agreement | **decidir** (L10) — propõe, nunca assume |
| **Task** | uma unidade de execução dentro de uma Capability | encapsular uma chamada a uma Tool | persistir estado próprio; decidir |
| **Mission** | um pedido de decisão ao humano | coletar UMA Decision (CMP-001) | conter duas decisões; conhecer a Capability que a criou |
| **Decision** | a resposta humana imputável | fechar o pedido; virar fato | ser tomada por máquina (L13) |
| **Gap** | um fato ausente que trava um propósito | tornar o "não sei" endereçável (L3) | ser preenchido por invenção |
| **Agreement** | uma delegação viva | autorizar execução autônoma, com escopo e volta (L10) | ser configuração; existir sem consentimento |
| **Memory** | a verdade que a operação aprende sobre si | acumular alegações imputáveis (L12) | virar boato (sem origem) |
| **Event** | um fato imutável publicado | tornar toda execução observável (L7) | ser efeito colateral oculto |
| **Contract** | a interface pública de uma Capability | permitir composição sem acoplamento (L5/L8) | expor implementação |
| **Service** | *(termo não-fundamentável nas fontes)* | — | — → **LACUNA declarada (Parte 22)** |

**Árvore ontológica:**
```
Capability (competência permanente)
├─ declara ─► Contract (interface pública)
├─ publica ─► Event (fato observável)
├─ produz  ─► Mission ─► coleta ─► Decision
├─ produz  ─► Gap
├─ consulta/cria ─► Agreement
├─ consulta/registra ─► Memory
├─ possui  ─► Task ─► invoca ─► Tool ─► Result
└─ compõe (via Contract) ─► outra Capability
Workflow ─► coordena ─► Capabilities (por Contract; nunca as acopla)
Agent ─► executa ─► sob Agreement (nunca decide)
```

## Parte 2 · Por que a Capability é assim

**Permanente** (L2: competências permanecem, Missões passam) · **reutilizável**
(uma competência serve a muitos propósitos) · **componível** (L8, por Contract)
· **observável** (L7, por Event) · **isolável** (L9, sem estado global) ·
**testável** (Contract + Event = entrada/saída puras) · **versionável** (a
competência evolui sem quebrar quem a compõe — Parte 18). Estas sete não são
escolhas: derivam das Leis 2, 5, 7, 8, 9.

## Parte 3 · Responsabilidades

**Pertence à Capability:** decidir *o quê* fazer; produzir Missões (pedir
decisão), Gaps (declarar lacuna), Eventos (publicar fato); consultar/registrar
Memory; consultar/criar Agreements; invocar Tools via Task; expor um Contract.
**Nunca pertence:** renderizar; conhecer Shell/Foundation/Semantic/Theme;
executar I/O diretamente (é Tool); orquestrar outras (é Workflow); tomar a
decisão do humano (L13); manter estado global (L9); conter fluxo hardcoded (L1).

## Parte 4 · Identidade (o manifesto obrigatório)

Toda Capability declara: **Identifier** (estável, imutável) · **Display Name** ·
**Description** · **Purpose** (a competência, uma frase) · **Scope** (a fronteira
do que decide) · **Public Contract** · **Input Contracts** · **Output
Contracts** · **Consumed Events** · **Published Events** · **Produced Missions**
· **Produced Gaps** · **Memory Usage** · **Agreement Usage** · **Supported
Workflows** · **Dependencies** (só Contracts de outras Capabilities) · **Owned
Tools** · **Indicators** (Parte 17) · **Version** (SemVer) · **Owner** · **Lifecycle**
(Parte 5). Cada campo existe para tornar a Capability descoberta (registry),
composta (contracts), observada (events/indicators) e evoluída (version) — as
quatro qualidades da Definição Fundamental.

## Parte 5 · Lifecycle

```
Registered → Available → Triggered → Planning → Running ⇄ Waiting → Resuming → Completed → Archived
```

- **Registered:** existe no registry; publica `CapabilityRegistered`. → Available quando o Contract valida.
- **Available:** ociosa, pronta. Entrada: um Input (Parte 6). → Triggered.
- **Triggered:** recebeu um Input; publica `CapabilityTriggered`. → Planning.
- **Planning:** decide *o quê* (não executa). → Running, ou → Waiting (se precisa de decisão humana → cria Mission), ou → Completed (nada a fazer).
- **Running:** invoca Tasks/Tools; publica `CapabilityStarted`. → Waiting (aguarda Mission/Tool/integração) ou → Completed/Failed.
- **Waiting:** suspensa aguardando um fato externo (Decision, Result, Agreement). **Preserva contexto** (L9), nunca estado global. → Resuming.
- **Resuming:** recebeu o fato; publica `CapabilityResumed`. → Running.
- **Completed / Failed:** publica `CapabilityCompleted`/`Failed` + indicadores. → Archived.
- **Archived:** histórica, consultável, imutável (L7).

**Transições proibidas:** Available→Running (sem Trigger/Planning — execução sem
causa observável, viola L7) · Waiting→Completed sem Resuming (perde o fato que a
completou) · qualquer→Running sem publicar Started (execução invisível, L7).

## Parte 6 · Inputs

Eventos (de outra Capability ou do domínio) · Resultados de Tool · Memory
(consulta) · Agreements (uma delegação vigente pode disparar execução autônoma)
· Cron (tempo — um fato temporal) · Webhook (um fato externo) · Missões
concluídas (a Decision retorna) · Decisões · Solicitações (de um Workflow ou de
outra Capability, por Contract) · Resultados de outras Capabilities (por
Contract). **Todo Input é um fato** — nunca uma chamada direta de UI (L4).

## Parte 7 · Outputs

Eventos (sempre — L6/L7) · Missões (pedir decisão — L4) · Gaps (declarar lacuna)
· Resultados (para quem a compôs, por Contract) · Memory (registrar aprendizado)
· Agreements (propor uma delegação — a *proposta*; a concessão é humana, L10) ·
Solicitações (a outra Capability, por Contract) · participação em Workflows.
**Nenhum output é um efeito colateral oculto** (L6): tudo que a Capability faz
sai como Evento ou como um dos artefatos acima.

## Parte 8 · Tool Model

**Tool executa, não pensa.** Não tem inteligência (não decide), não tem memória
(não persiste entre chamadas), não inicia execução (é sempre invocada). Recebe
entrada, produz Result, publica nada por si (a Capability publica o Evento).
```
Capability (decide) ─► Task (unidade de execução) ─► Tool (executa) ─► Result ─► Capability
```
*Justificativa:* Lei 3. Uma Tool que decidisse seria uma Capability disfarçada;
uma Tool com memória violaria L9 (estado fora da Capability dona).

## Parte 9 · Workflow Model

**Workflow coordena, não compete.** Não é Capability porque não tem competência
própria — só ordena a execução de Capabilities independentes, cada uma acionada
por seu Contract. As Capabilities coordenadas **permanecem independentes**:
removê-las do Workflow, elas ainda funcionam; trocar o Workflow não muda a
Capability. *Justificativa:* L8 (compor, nunca acoplar). Um Workflow que
"soubesse" o interior de uma Capability a acoplaria — proibido.

## Parte 10 · Agent Model

**Agent é executor; Capability é competência; Workflow é orquestração; Tool é
execução.** Um Agent age *sob um Agreement* (delegação humana, L10) — executa
autonomamente dentro do escopo concedido, e **jamais decide**: propõe (cria
Mission) ou executa o combinado. Relação:
```
Capability decide ─► (se há Agreement) ─► Agent executa dentro do escopo ─► Tool faz ─► Event
                  └─► (se não há) ─► cria Mission ─► humano decide
```
*Justificativa:* CONST L10/L13 + PX-004 P10 ("a IA trabalha, o humano decide").
Um Agent que decidisse seria autoridade nativa do sistema — impensável
(PR-011). Agent é o rosto executor da autonomia *já concedida*, nunca a origem
dela.

## Parte 11 · Mission Model

A Capability **nunca solicita interface** — cria uma **Mission** (o pedido de
decisão) e suspende-se (Waiting). O Shell materializa a Mission (CMP-001) sobre
o palco; o humano decide; a **Decision** volta como fato; a Capability retoma
(Resuming). Ciclo:
```
Capability(Planning/Running) ─cria─► Mission ─[Shell/CMP-001 apresenta]─► humano
                                        │
Decision ◄──────────────────────────────┘
   └─► Capability(Resuming→Running)   +  DecisionRecorded (Event)
```
**A Mission funcional (CAP-000) e a Mission visual (CMP-001) são o mesmo objeto,
duas faces** — conectadas pelo Shell. A Capability conhece a *anatomia do
pedido* (chamada, preparo, o que se decide), nunca a *tela*.

## Parte 12 · Gap Model

A Capability **produz um Gap** quando um propósito exige um fato ausente (L3/L5):
publica `GapCreated`. **Fecha o Gap** quando o fato chega (por Decision, por
Tool, por outra Capability): publica `GapClosed`. **Quem resolve:** quem detém o
fato — o Cliente (via Mission), um Fornecedor (via mensagem preparada), ou outra
Capability. **Evolui:** um Gap não some sozinho; ou é resolvido, ou o propósito
que o exigia desaparece (então dissolve-se, declarando-se). Nunca é preenchido
por invenção (L3).

## Parte 13 · Agreement Model

**Consultar:** antes de qualquer execução autônoma, a Capability verifica se há
Agreement vigente para o escopo. **Criar:** a Capability *propõe* (com
evidência); a **concessão é humana** (L10) — nasce de uma Mission de
consentimento. **Atualizar:** ajuste de escopo = nova versão do fato
(append-only). **Invalidar:** revogação humana, ou contradição sustentada
(o sistema *sinaliza*, nunca revoga sozinho — ADR-002). **Respeitar:** executar
só dentro do escopo vigente; fora dele, criar Mission. Revogar fecha o futuro,
preserva o passado.

## Parte 14 · Memory Model

**Consultar:** por chave de contexto, sempre com origem. **Registrar:** toda
Decision/Veredito vira alegação imputável (L2/L12). **Consolidar:** projeções
sobre os fatos (nunca editar o fato — L4/retificação). **Invalidar:** por
contradição sustentada (rebaixamento, não deleção). **Compartilhar:** por
Contract, nunca por acesso direto ao armazenamento de outra Capability (L9).
*Não implementa Memory* — declara o contrato de uso; a implementação vive na
AIL (Journal/Knowledge), fora deste documento.

## Parte 15 · Event Model (contrato universal)

Todo Evento é imutável, com origem, timestamp e correlação. Catálogo mínimo:
`CapabilityRegistered · Triggered · Started · Planning · Waiting · Resumed ·
Completed · Failed` (ciclo de vida — L7) · `MissionCreated · MissionAnswered ·
DecisionRecorded` (o laço humano — L4/L13) · `GapCreated · GapClosed` (lacunas —
L3) · `AgreementUpdated` (delegação — L10) · `MemoryUpdated` (aprendizado — L12).
**Regra:** nada acontece sem Evento (L6/L7); o Event é a única forma de a
Capability tornar-se observável e de outra Capability reagir — nunca por chamada
direta de implementação (L5).

## Parte 16 · Composição

Capability A compõe B **exclusivamente pelo Contract público de B**: A envia uma
Solicitação (Input de B), recebe um Resultado (Output de B) ou reage a um Evento
de B. **Sem** acoplamento (A não conhece o interior de B), **sem** dependência
circular (o grafo de Contracts é acíclico — Ontologia 5.3.1), **sem** estado
compartilhado (L9), **sem** conhecimento interno. Trocar a implementação de B
não toca A enquanto o Contract se mantém. *Justificativa:* L5 + L8.

## Parte 17 · Observabilidade (indicadores)

Tempo ativo · tempo esperando usuário · tempo esperando Tool · tempo esperando
integração · tempo de Planning · tempo total · nº de Missões · nº de Gaps · nº
de Decisões · nº de Eventos · taxa de sucesso · taxa de falha · taxa de
retomada. Todos derivam dos Eventos do ciclo de vida (Parte 15) — **nenhum exige
instrumentação extra**: a observabilidade é consequência de L7 (toda execução
publica Eventos), não uma camada adicionada. *(Ecoam os indicadores do
Operation Center: time-to-publish, throughput, SLA — instâncias destes.)*

## Parte 18 · Versionamento

**Compatibilidade:** SemVer no Contract. **Aliases:** um Contract pode referir
outro (ponte de migração). **Migração:** a Referência do alias faz a ponte;
consumidores não quebram. **Depreciação:** um Contract superado é redeclarado
apontando o substituto + flag `deprecated`; nunca removido numa minor.
**Quebras:** só em major (mudar a semântica de um Contract existente).
**Evolução:** adicionar Capability/Event = minor. O grafo de Contracts é
acíclico, então versões evoluem sem cascata oculta.

## Parte 19 · Anti-padrões

Capability contendo: UI/React/Flutter/Shell · Foundation/Semantic/Theme · SQL
embutido · HTTP espalhado · estado global · dependência circular · conhecimento
interno de outra Capability · fluxo hardcoded · decisão de interface ·
implementação de Tool · lógica visual. **Cada um viola:** a Regra Absoluta (a
Capability só conhece domínio/contratos/eventos/memory/agreements/tools) ou uma
Lei (fluxo hardcoded → L1; estado global → L9; efeito oculto → L6; acoplamento →
L5/L8; decisão de interface → L4). O mais sutil: **fluxo hardcoded** — uma
Capability que codifica uma sequência fixa de passos virou Workflow disfarçado
(L1: competência, nunca fluxo).

## Parte 20 · Estrutura física

```
capabilities/
  000-capability-constitution/   ← ESTE documento (as leis)
  100-commerce/                  ← competências do ciclo operacional (DOM-001)
    110-catalog/  120-marketplaces/  130-pricing/  140-inventory/  150-demand/
  200-conversation/              ← a voz e o pensamento
    210-memory/  220-planning/  230-reasoning/  240-agreements/
  300-execution/                 ← o fazer
    310-workflows/  320-tools/
  400-learning/                  ← a Segunda Verdade (L12)
  500-observability/             ← os indicadores (L7)
```

Responsabilidade dos grupos: **100-commerce** = as competências que percorrem o
ciclo `Chegada→…→Evolução` (CONST-001); **200-conversation** = a voz (Missões,
Conversas), a Memory, o Planning, os Agreements; **300-execution** = Workflows
(coordenam) e Tools (executam); **400-learning** = a Memory consolidada;
**500-observability** = os indicadores. **Nota:** os *nomes* das competências de
commerce (catalog, pricing…) instanciam o domínio de DOM-001 — **fora do escopo
de fontes deste documento**; a estrutura de pastas é derivada do ciclo (via
CONST-001), as competências específicas serão modeladas depois contra DOM-001
(Parte 22).

## Parte 21 · Template oficial

Toda nova Capability declara obrigatoriamente: Identidade · Objetivo · Escopo ·
Responsabilidades · Entradas · Saídas · Eventos Consumidos · Eventos Publicados
· Ferramentas · Dependências · Memory · Agreements · Missões · Gaps ·
Indicadores · Critérios de Sucesso · Critérios de Falha · Contrato Público ·
Anti-padrões. Uma Capability sem qualquer campo é inválida — o registry a
rejeita (Parte 22).

## Parte 22 · Critério de aceite (validação)

| Regra | Como validar |
|---|---|
| identidade própria | Identifier único no registry; template completo (Parte 21) |
| depende só de contratos | Dependencies lista só Contracts; grep por import concreto = falha |
| reutilizável | zero fluxo hardcoded; Purpose é competência, não sequência |
| componível | compõe só por Contract; grafo acíclico |
| observável | todo estado do lifecycle publica Evento (Parte 15) |
| testável | Contract puro: entrada→saída sem I/O direto |
| isolável | zero estado global; contexto preservado no Waiting |
| não conhece UI/DS/impl | zero string de UI/Foundation/Semantic/Shell/SQL/HTTP |
| não é Workflow/Agent/Tool | tem competência (não só orquestra/executa) |

## Lacunas declaradas (registradas, não preenchidas)

1. **"Service"** — a Definição Fundamental exclui "ferramenta/API/serviço", e
   nenhuma fonte fundamenta "Service" como conceito distinto de Tool/Contract.
   **Não o defino** — registrado como termo sem fundamento.
2. **O catálogo de domínio** (Parte 20: catalog/marketplaces/pricing/inventory/
   demand) instancia DOM-001/UX-002, **fora da lista de fontes**. A *estrutura*
   deriva do ciclo (via CONST-001); as *competências específicas* são modeladas
   depois, contra DOM-001 — não aqui.
3. **A implementação de Memory/Agreement** vive na AIL (Journal/Knowledge/
   Delegation, `docs/zion-os/`), também fora das fontes. CAP-000 define o
   *contrato de uso*; a *materialização* é a AIL já construída — reconciliação,
   não reinvenção (Nota de estratos).

## Veredito

> **A arquitetura das Capabilities está completamente especificada.**

Os 13 conceitos da Ontologia têm definição, responsabilidade e proibição; a
Capability tem identidade (Parte 4), lifecycle com transições legais e proibidas
(Parte 5), inputs/outputs fechados (6/7), e os modelos de Tool/Workflow/Agent/
Mission/Gap/Agreement/Memory/Event derivam das 10 Leis + da Ontologia. Composição
por Contract (L5/L8), observabilidade por Evento (L7), isolamento sem estado
global (L9), versionamento acíclico (Parte 18), anti-padrões com violação citada
(Parte 19) e aceite validável (Parte 22).

**As três lacunas são declaradas e não-bloqueantes** — "Service" (sem
fundamento, corretamente não-definido), o catálogo de domínio (a modelar contra
DOM-001, cuja ausência na lista de fontes é a limitação registrada) e a
implementação de Memory/Agreement (que **já existe** na AIL — este documento a
reconcilia como o motor funcional, sob nomes internos). Nenhuma Capability
precisará definir seu próprio modelo: todas derivam desta Constituição.
