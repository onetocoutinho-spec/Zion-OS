# 013a — Architecture Review · Épico 2 (Inteligência Comercial)

> **Revisão arquitetural — não altera a arquitetura.** Este documento **analisa** os quatro documentos do Épico 2 antes da criação do `014`. Ele **não corrige** nada; produz o diagnóstico, a linguagem consolidada e a lista de reconciliações que deverão ser feitas depois, em documentos próprios. Nenhum documento existente é modificado por este.

> **Documentos revisados:** [011 Product Master Workspace](./011-product-master-workspace.md) · [012 Commercial Intelligence Engine](./012-commercial-intelligence-engine.md) · [013 Cost Engine](./013-cost-engine.md) · [015 Operation Center](./015-operation-center.md). **Base:** [000 Business Domain](./000-business-domain.md) · [001 Product Master](./001-product-master.md) · [006 Zion Intake](./006-capability-000-zion-intake.md) · [007 Execution Roadmap](./007-execution-roadmap.md) · [010 Database Compliance](./010-database-compliance.md).

> **Método:** leitura cruzada dos quatro documentos, mapeando conceitos, responsabilidades, nomenclatura, fronteiras e lacunas. As recomendações são **preparatórias** para o `014 — Operational Maturity Engine`.

---

## 1. As dez perguntas obrigatórias

### 1.1 Quais conceitos aparecem repetidos?

| Conceito | Onde aparece | Natureza da repetição |
|----------|--------------|-----------------------|
| **Health Score** | 011 (Health do Produto), 012 (Health Comercial), 015 (Health da Operação) | Três instâncias do **mesmo padrão**, sem definição compartilhada. |
| **Precisão** | 013 (define), 011/012/015 (consomem) | Definida uma vez, referenciada sem base comum. |
| **Origem** | 013 (Origem dos Custos), 012 (origem do dado), 000 (Fonte da Verdade) | Mesmo espírito (proveniência) sob nomes diferentes. |
| **Missão** | 015 (define), 011/012/013 (geram) | Um dono conceitual, vários geradores — repetição de "como surge". |
| **Alertas / Oportunidades** | 012 (produz), 015 (apresenta), 011 (apresenta) | Definidos em 012, redescritos nas telas. |
| **Regra "nunca indicador sem ação"** | 015 (origem), 011 (ecoa) | Princípio repetido — saudável, mas sem fonte única citada. |
| **"Apresentação ≠ cálculo"** | 012, 013, 011, 015 | Fronteira repetida em cada doc (positivo, mas candidata a um princípio central). |
| **Inteligência/Saúde Comercial** | 011 (seções), 012 (engine) | O nome "Inteligência Comercial" nomeia tanto uma seção de UI quanto o engine. |

### 1.2 Quais conceitos deveriam ser compartilhados?

- **Health Score** → um **conceito-primitivo compartilhado** (um "score dimensional 0–100 acionável"), instanciado por cada domínio. Candidato a ser consolidado no `014`.
- **Precisão** → um **atributo de confiança compartilhável** por qualquer número derivado (hoje só o custo tem; amanhã recomendações e scores também deveriam ter).
- **Origem da Informação** → um **conceito transversal de proveniência** (ver [§6](#6-origem-da-informação)), generalizando "Origem dos Custos".
- **Missão** → já é compartilhada (dona: 015); falta padronizar o **contrato de geração** (impacto/prioridade/tempo/justificativa) que 011/012/013 preenchem.
- **Recomendação** → hoje vive no 012 e na IA; deveria ser um **objeto compartilhado** (com justificativa + origem + confiança), reaproveitado por qualquer engine.

### 1.3 Quais nomenclaturas estão inconsistentes?

| Inconsistência | Ocorrências | Observação |
|----------------|-------------|------------|
| **EN × PT** | "Operation Center" × "Centro de Operações"; "Commercial Intelligence" × "Inteligência Comercial"; "Cost Engine" × "Custos" | Mistura de idioma no mesmo conceito. |
| **"Health" × "Saúde"** | Health Score, Saúde Comercial, Saúde Operacional, Saúde da Operação | Quatro grafias para o mesmo tipo de indicador. |
| **"Origem"** | Origem dos Custos (013), origem do dado (012), Origem do Produto (000) | "Origem" já é um termo de 000 (procedência do produto) — colide com "origem do valor". |
| **"Política"** | Política de Custos (013) × Políticas Comerciais (012) | Dois conceitos distintos sob a mesma palavra. |
| **Numeração dos engines** | 015 cita "Commercial Intelligence (011)" e "Cost Engine (012)"; real: 011=Workspace, 012=Commercial Intelligence, 013=Cost Engine | **Inconsistência mais grave** (ver [§8](#8-pontos-para-reconciliação)). |
| **"Inteligência Comercial"** | Seção de UI (011/015) × Engine (012) | O mesmo rótulo nomeia tela e motor. |

### 1.4 Quais responsabilidades estão bem separadas?

- **A cadeia de cálculo → interpretação → decisão** está **limpa**: 013 calcula, 012 interpreta, o operador decide. Reforçada nos dois documentos.
- **Fonte da Verdade (000) respeitada** em todos: ERP dono de custo/estoque; Zion dona de preço/conteúdo; Marketplace dono do estado do anúncio. Nenhum dos quatro docs escreve fora do seu domínio.
- **013 nunca decide; 012 nunca calcula** — a fronteira central do Épico 2 está explícita e recíproca.
- **015 e 011 apenas apresentam/contextualizam** — não recalculam. Bem delimitado.
- **IA como copiloto** (recomenda, nunca executa) — consistente nos quatro.

### 1.5 Quais responsabilidades ainda possuem sobreposição?

| Sobreposição | Detalhe | Gravidade |
|--------------|---------|:---------:|
| **Cálculo do Health Score** | 012 tem dono (interpreta custo→saúde comercial); **Health do Produto (011)** e **Health da Operação (015)** não dizem **quem calcula** — só quem apresenta. | 🔴 Alta |
| **Geração de Missão** | 015 é dono do conceito, mas 012 e 013 "geram" Missões — falta padronizar quem **cria** vs. quem **dispara o gatilho**. | 🟡 Média |
| **Simulação** | 013 define simulação **de custo**; 012 fala de cenários comerciais ("e se subir preço?"). Fronteira do "e se" comercial × custo não está fechada. | 🟡 Média |
| **Alertas/Oportunidades** | Produzidos no 012, mas 015 e 011 os descrevem novamente — risco de definições divergirem. | 🟢 Baixa |
| **"Inteligência Comercial" (nome)** | Seção do Workspace × Engine 012 — sobreposição de rótulo, não de função. | 🟢 Baixa |

### 1.6 Existe algum conceito que deveria virar um Capability próprio?

- **Health / Scoring** — o padrão de Health Score aparece três vezes sem dono de cálculo. Forte candidato a **Capability de Scoring** (ou a ser absorvido pelo `014 Operational Maturity Engine` como o agregador oficial de saúde/maturidade).
- **Analytics** — citado como consumidor em 012 e 013, **nunca definido**. Candidato a Capability próprio (histórico, tendências, relatórios).
- **Simulação** — hoje presa ao Cost Engine; poderia ser um **serviço de simulação transversal** (custo + comercial) se o "e se" crescer.

### 1.7 Existe algum conceito que deveria virar um documento independente?

- **Origem da Informação / Proveniência** — transversal a 012/013 (e a 000); merece um documento de conceito próprio (ver [§6](#6-origem-da-informação)).
- **Precisão / Confiança** — idem; nasce no 013 mas é um atributo geral (ver [§5](#5-precisão)).
- **Políticas** (Comercial + de Custos) — um documento que discipline "o que é política, quem define, quem executa" resolveria a colisão de nome.
- **Health Score (modelo unificado)** — um documento (ou capítulo do 014) que defina o padrão e as três instâncias.
- **Recomendação** — o objeto "recomendação" (com justificativa/origem/confiança/virar-Missão) poderia ter definição própria.

### 1.8 Existe alguma responsabilidade em lugar incorreto?

- **Não há responsabilidade claramente no lugar errado.** A cadeia está correta. Os problemas são de **lacuna** (Health sem dono de cálculo) e de **nome** (numeração/idioma), não de responsabilidade mal colocada.
- **Ponto de atenção:** o **cálculo do Health do Produto** e do **Health da Operação** está implícito nas telas (011/015). Isso os coloca perigosamente perto de "a tela calcula" — o que **violaria** a regra "apresentação ≠ cálculo". Deve ser explicitamente atribuído a um engine (candidato: `014`).

### 1.9 Existe alguma oportunidade de simplificação?

- **Unificar os três Health Scores** sob um modelo único (mesmas faixas, mesma regra de "dimensão fraca → ação") reduz três definições a uma + três instâncias.
- **Unificar "Origem"** num único conceito de proveniência elimina três vocabulários.
- **Padronizar EN/PT** — escolher um idioma canônico por conceito (000 já manda escolher **um** nome).
- **Um objeto "Recomendação" único** evita redescrever alertas/oportunidades em cada tela.
- **Centralizar o princípio "apresentação ≠ cálculo"** em 000/um doc de princípios, e apenas **referenciá-lo** nos demais.

### 1.10 Existe algum conceito importante ainda não documentado?

| Conceito ausente | Onde é referenciado | Impacto |
|------------------|---------------------|---------|
| **Analytics** | 012, 013 (como consumidor) | Consumidor sem definição. |
| **Operational Maturity** | previsto para 014 | Ainda não existe. |
| **Dono do cálculo de Health (Produto/Operação)** | 011, 015 | Lacuna de responsabilidade. |
| **Políticas Comerciais — dono/ciclo** | 012 (fonte de dados) | Sem dono formal (Cliente × Equipe). |
| **Recomendação (objeto)** | 012, IA | Usado, não formalizado. |
| **Ads — dono do dado** | 012 (input comercial), 013 (input de custo) | Ambíguo entre custo e marketing. |
| **Simulação comercial** | 012 (implícita), 013 (só custo) | Fronteira aberta. |

---

## 2. Linguagem Oficial

Consolidação dos **conceitos oficiais** que emergem do Épico 2 (e da base). Esta lista é a **candidata** ao vocabulário canônico da Zion; a promoção formal cabe a [000 Business Domain](./000-business-domain.md) (que prevalece).

| Conceito | Definição curta | Documento-fonte |
|----------|-----------------|-----------------|
| **Produto Mestre** | Representação única e canônica do produto; Fonte da Verdade do marketplace. | [001](./001-product-master.md) |
| **Workspace (do Produto Mestre)** | Ambiente operacional do produto (não é CRUD). | [011](./011-product-master-workspace.md) |
| **Centro de Operações / Operation Center** | Cockpit operacional; ambiente primário da plataforma. | [015](./015-operation-center.md) |
| **Commercial Intelligence** | Motor que **interpreta** dados em decisões comerciais. | [012](./012-commercial-intelligence-engine.md) |
| **Cost Engine** | Motor que **calcula** o custo operacional de comercialização. | [013](./013-cost-engine.md) |
| **Capability** | Unidade de capacidade da plataforma, com responsabilidade única. | [007](./007-execution-roadmap.md) |
| **Health Score** | Indicador dimensional (0–100) acionável de saúde. | 011/012/015 |
| **Health do Produto** | Quão completo/pronto está o produto. | [011](./011-product-master-workspace.md) |
| **Health Comercial** | Quão rentável/competitivo é o produto. | [012](./012-commercial-intelligence-engine.md) |
| **Health da Operação** | Quão saudável está a operação do cliente. | [015](./015-operation-center.md) |
| **Precisão** | Confiança de um número calculado, derivada da qualidade das fontes. | [013](./013-cost-engine.md) |
| **Missão** | Unidade de trabalho derivada de fato; substitui tarefas. | [015](./015-operation-center.md) |
| **Fila Inteligente** | Trabalho homogêneo agrupado e priorizado. | [015](./015-operation-center.md) |
| **Timeline** | Histórico cronológico vivo (produto/operação). | 011/015 |
| **Evento** | Fato assíncrono, idempotente, auditável. | [004](./004-event-bus.md) |
| **Fonte da Verdade** | Quem é **dono** de uma informação. | [000](./000-business-domain.md) |
| **Origem da Informação** | Qual **fonte forneceu** um valor específico (proveniência). | [013](./013-cost-engine.md) (a generalizar) |
| **Política Comercial** | Regras/pisos/metas que governam a **interpretação**. | [012](./012-commercial-intelligence-engine.md) |
| **Política de Custos** | Quais custos participam do **cálculo**. | [013](./013-cost-engine.md) |
| **Centro de Custos** | Custos fixos/estruturais rateáveis. | [013](./013-cost-engine.md) |
| **Rateio** | Distribuição de custo não atribuível diretamente. | [013](./013-cost-engine.md) |
| **Simulação** | Cálculo hipotético isolado ("e se…?"), sem alterar dados reais. | [013](./013-cost-engine.md) |
| **Recomendação** | Ação candidata com justificativa e origem. | [012](./012-commercial-intelligence-engine.md) |
| **Custo Consolidado** | Custo total de comercializar no contexto, por camada. | [013](./013-cost-engine.md) |
| **Pendência** | Informação necessária ausente (não estimada). | 013/012/006 |

---

## 3. Cadeia Oficial de Responsabilidades

A cadeia canônica do Épico 2 — cada elo com **papel exclusivo**:

```mermaid
flowchart LR
  ERP["ERP"] --> CE["Cost Engine"] --> CI["Commercial Intelligence"] --> WS["Workspace"] --> OC["Operation Center"] --> IA["IA"] --> OP(["Operador"])
```

| Elo | Papel **exclusivo** | Nunca faz |
|-----|---------------------|-----------|
| **ERP (Magazord)** | É **Fonte da Verdade** de custo, estoque, fiscal, nota. | Não conhece marketplace nem margem. |
| **Cost Engine (013)** | **CALCULA** o custo de comercialização (+ precisão, pendências, origem). | Nunca decide, nunca altera dado, nunca sobrescreve o ERP. |
| **Commercial Intelligence (012)** | **INTERPRETA** o custo em margem, recomendações, alertas, oportunidades. | Nunca calcula custo, nunca muda preço. |
| **Workspace (011)** | **CONTEXTUALIZA** tudo dentro de um produto. | Nunca calcula, nunca recomenda por conta própria. |
| **Operation Center (015)** | **APRESENTA** o trabalho como Filas/Missões/Alertas. | Nunca calcula, nunca interpreta. |
| **IA** | **RECOMENDA** ações com justificativa. | Nunca executa, nunca inventa dado. |
| **Operador** | **DECIDE** e executa. | — |

> [!important] Regra de leitura da cadeia
> A informação flui **da esquerda (dado bruto/cálculo) para a direita (decisão humana)**. Nenhum elo pode assumir o papel do outro: quem calcula não decide; quem apresenta não calcula; quem recomenda não executa.

---

## 4. Health Scores

Os três Health Scores comparados. O achado central: **só o Health Comercial tem dono de cálculo explícito.**

| Aspecto | **Health do Produto** | **Health Comercial** | **Health da Operação** |
|---------|-----------------------|----------------------|------------------------|
| **Documento** | [011](./011-product-master-workspace.md) | [012](./012-commercial-intelligence-engine.md) | [015](./015-operation-center.md) |
| **Responsabilidade** | Completude/prontidão do produto. | Rentabilidade/competitividade. | Saúde geral da operação do cliente. |
| **Objetivo** | "O produto está pronto?" | "O produto dá lucro?" | "A operação está saudável?" |
| **Dimensões** | Identidade, Conteúdo, SEO, Comercial, Marketplaces, ERP, IA, Publicação. | Margem, Rentabilidade, Competitividade, Desempenho, Ads, Aderência à política. | Produtos, ERP, Marketplaces, IA, Custos, Analytics, Automações, Equipe. |
| **Quem calcula** | ⚠️ **não atribuído** (implícito na completude do Produto Mestre). | **Commercial Intelligence (012)**. | ⚠️ **não atribuído** (agregação transversal). |
| **Quem apresenta** | Workspace (011). | Workspace (011) / Operation Center (015). | Operation Center (015). |
| **Quem consome** | Operador; a dimensão "Comercial" cita o 012. | Workspace, Operation Center, Missões. | Operador; a dimensão "Custos" cita o 012/013. |

**Recomendação:** unificar sob um **modelo único de Health Score** (mesmas faixas, "dimensão fraca → ação") e **atribuir o cálculo** de todos a um engine — candidato natural: o **`014 Operational Maturity Engine`**, que já será o agregador de saúde/maturidade. Isso fecha a lacuna 🔴 de "tela calculando".

---

## 5. Precisão

Consolidação do conceito de **Precisão** (confiança de um número calculado).

| Dimensão | Situação atual |
|----------|----------------|
| **Onde nasce** | No [Cost Engine (013)](./013-cost-engine.md) — hoje é a única capacidade que emite números derivados. |
| **Quem calcula** | O 013, a partir da **qualidade das fontes** (integrada > operador > template > IA > estimativa). |
| **Quem apresenta** | Workspace (011) e Operation Center (015), junto do custo. |
| **Quem utiliza** | Commercial Intelligence (012) para **qualificar recomendações** (recomendação sobre custo de baixa precisão = parcial); e o **operador**, para decidir se confia no número. |

**Recomendação:** promover **Precisão** a **conceito transversal oficial**: todo número derivado (custo hoje; recomendações, scores e simulações amanhã) deveria carregar sua precisão/confiança. Isso evita que decisões sejam tomadas sobre números aparentemente exatos, mas frágeis. O `014` deve tratar precisão como **insumo de maturidade** ("operação madura = números de alta precisão").

---

## 6. Origem da Informação

Consolidação de todas as origens possíveis — registrada aqui como **conceito oficial** (proveniência de um valor).

| Origem | Significado |
|--------|-------------|
| **ERP** | Valor medido no [Magazord](./000-business-domain.md). |
| **Marketplace** | Taxa/estado vindo do canal. |
| **Gateway** | Taxa de pagamento/antecipação. |
| **Transportadora** | Custo de frete. |
| **Operador** | Informado manualmente por humano. |
| **IA** | Sugerido pela IA e confirmado por humano. |
| **Estimativa** | Aproximação explicitamente marcada. |
| **Template** | Padrão pré-configurado. |
| **Integração** | Vindo de sistema externo conectado. |
| **Política** | Definido por uma política (Comercial ou de Custos). |

> [!important] Origem da Informação **≠** Fonte da Verdade
> - **Fonte da Verdade ([000](./000-business-domain.md))** responde *"quem é **dono** deste dado?"* — governança (ex.: o custo é do ERP).
> - **Origem da Informação (este conceito)** responde *"qual fonte **forneceu** este valor específico neste cálculo?"* — proveniência (ex.: esta taxa veio do Gateway; esta embalagem veio de um Template).
>
> São **complementares**. Um valor pode ter o ERP como Fonte da Verdade e, num cálculo específico, ter origem "Estimativa" (quando o ERP ainda não informou) — e isso **rebaixa a precisão**.

**Recomendação:** generalizar a "Origem dos Custos" do 013 para **Origem da Informação**, aplicável a qualquer valor da plataforma, e registrá-la em 000.

---

## 7. Pontos para Reconciliação

Lista do que **deverá ser ajustado depois** (não agora — este documento não altera nada):

| # | Item | Descrição | Prioridade |
|---|------|-----------|:----------:|
| R1 | **Numeração no 015** | O 015 cita "Commercial Intelligence (011)" e "Cost Engine (012)"; o real é 011=Workspace, 012=Commercial Intelligence, 013=Cost Engine. Corrigir as referências internas do 015. | 🔴 Alta |
| R2 | **Links entre docs** | Após R1, revisar todos os links cruzados (011↔012↔013↔015) para consistência. | 🔴 Alta |
| R3 | **Dono do cálculo de Health** | Atribuir explicitamente quem calcula Health do Produto e Health da Operação (candidato: 014). | 🔴 Alta |
| R4 | **Modelo único de Health Score** | Unificar faixas, dimensões-padrão e a regra "dimensão fraca → ação". | 🟡 Média |
| R5 | **Nomenclatura EN/PT** | Escolher um nome canônico por conceito (Operation Center × Centro de Operações etc.). | 🟡 Média |
| R6 | **"Origem"** | Separar "Origem do Produto" (000) de "Origem da Informação" (novo) para não colidir. | 🟡 Média |
| R7 | **"Política"** | Disambiguar Política Comercial (012) × Política de Custos (013) sob um guarda-chuva "Políticas". | 🟡 Média |
| R8 | **Analytics** | Documentar o Capability Analytics (hoje só citado). | 🟡 Média |
| R9 | **Objeto "Recomendação"** | Formalizar recomendação (justificativa+origem+confiança+virar-Missão) como conceito único. | 🟢 Baixa |
| R10 | **Ads — dono do dado** | Definir se Ads é insumo de custo (013) ou de marketing/comercial (012), e quem o fornece. | 🟢 Baixa |
| R11 | **Simulação comercial** | Fechar a fronteira do "e se" comercial (012) × custo (013). | 🟢 Baixa |
| R12 | **Princípio "apresentação ≠ cálculo"** | Centralizar em 000/doc de princípios e referenciar nos demais. | 🟢 Baixa |
| R13 | **Promoção a 000** | Levar a Linguagem Oficial (§2) e a Origem da Informação (§6) ao Business Domain. | 🟡 Média |

---

## Entrega

### Resumo executivo
O Épico 2 está **arquiteturalmente sólido no essencial**: a cadeia **cálculo → interpretação → apresentação/contextualização → recomendação → decisão** é clara, recíproca e respeita a Fonte da Verdade de [000](./000-business-domain.md). Os problemas encontrados são de **consistência e lacuna**, não de arquitetura errada: (a) uma **inconsistência de numeração** no 015; (b) **três Health Scores** sem modelo comum e **sem dono de cálculo** para dois deles; (c) conceitos transversais (**Precisão**, **Origem da Informação**, **Recomendação**, **Políticas**) que nasceram dentro de um doc e precisam ser **promovidos a linguagem oficial**; (d) consumidores citados e não documentados (**Analytics**). Nada disso bloqueia o `014` — mas o `014` é o lugar natural para **fechar a lacuna dos Health Scores** e a **maturidade baseada em precisão**.

### Riscos arquiteturais encontrados
- 🔴 **Health calculado "pela tela"** (Produto/Operação sem engine dono) — risco de violar "apresentação ≠ cálculo".
- 🔴 **Numeração inconsistente** no 015 — quebra a navegação e a confiança no encadeamento.
- 🟡 **Fragmentação de vocabulário** (Health/Saúde, Origem, Política, EN/PT) — risco de divergência semântica ao crescer.
- 🟡 **Consumidores fantasma** (Analytics) — dependência sem contrato.
- 🟢 **Fronteiras "e se" (simulação)** e **Ads** ainda abertas — baixo impacto agora.

### Recomendações
1. **Tratar R1/R2/R3 antes de evoluir o Épico** (numeração, links, dono de Health).
2. **Fazer do `014` o dono do Health/Maturidade** (modelo único + cálculo dos três scores) e o consumidor formal de **Precisão**.
3. **Promover a Linguagem Oficial e a Origem da Informação a [000](./000-business-domain.md)** (R13).
4. **Disambiguar Políticas** e **documentar Analytics** quando entrarem no caminho crítico.
5. Manter o princípio **"apresentação ≠ cálculo"** como lei central, referenciada — não recopiada.

### Conceitos que deverão ser promovidos a linguagem oficial da Zion
**Health Score** (modelo unificado) · **Precisão** (transversal) · **Origem da Informação** (proveniência, distinta de Fonte da Verdade) · **Recomendação** (objeto) · **Política** (Comercial e de Custos, sob guarda-chuva) · **Simulação** · **Missão** (já oficial, formalizar o contrato de geração) · **Capability** · **Custo Consolidado** · **Pendência**.

### Confirmação
✔ **Nenhum documento existente foi alterado.** Este documento é **exclusivamente analítico**: cria apenas `013a-architecture-review-epic2.md`, não modifica 011/012/013/015 nem qualquer outro, e não altera a arquitetura — apenas a **prepara** para o `014 — Operational Maturity Engine`.

---

> **Status:** `013a` — Architecture Review do Épico 2 **v1.0**. Documento **analítico**, não-normativo: não altera a arquitetura. Alimenta a construção do [`014 — Operational Maturity Engine`] e a futura reconciliação (R1–R13). Em divergência de nomenclatura, **[000 Business Domain](./000-business-domain.md) prevalece**.
