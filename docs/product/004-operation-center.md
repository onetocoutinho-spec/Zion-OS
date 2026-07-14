# 004 — Operation Center (Experiência)

> **Desenho de produto da Home da Zion.** Este documento define a **experiência** do Centro de Operações — a **principal tela da plataforma**, onde todo usuário começa e onde toda operação termina. Usa apenas **diagramas Mermaid e wireframes ASCII** (sem Figma, sem componentes, sem código).

> **Relação com os documentos anteriores.** Aplica a [Product Vision (000)](./000-product-vision.md), os [Design Principles (001)](./001-design-principles.md), a [Information Architecture (002)](./002-information-architecture.md) e a [Navigation (003)](./003-navigation.md). A arquitetura funcional ([Operation Center 015](../architecture/015-operation-center.md) e demais) é contexto e **não é copiada**.

> [!important] Registro oficial
> **O Centro de Operações NÃO é um dashboard. É um cockpit operacional.** Ele responde continuamente a uma única pergunta — **"o que preciso fazer agora?"** — e é a **Home oficial** da Zion.

---

## 1. Objetivo

Formalizar o **Centro de Operações** como a **Home oficial** da Zion: a tela de abertura que **conduz o trabalho** do dia. Todo papel entra por aqui (com escopo próprio, [003 §11](./003-navigation.md)); toda jornada retorna para cá ([003 §3](./003-navigation.md)).

O Centro de Operações é o lugar onde o operador **descobre o que fazer, entende por quê e começa a agir** — sem procurar, sem montar relatório, sem decidir por onde começar.

---

## 2. Filosofia

O Centro de Operações **não informa, não entretém, não mostra dashboards. Ele conduz trabalho.**

| ❌ O que ele **não** é | ✅ O que ele **é** |
|------------------------|--------------------|
| Um painel de métricas para admirar. | Uma fila de trabalho priorizada para executar. |
| Uma tela de "boas-vindas". | O ponto de partida da ação. |
| Um relatório interativo. | Um cockpit que diz o próximo passo. |
| Gráficos que impressionam. | Missões que resolvem. |

Princípio: se o usuário sai do Centro de Operações tendo **olhado**, mas não **agido**, a tela falhou.

---

## 3. Objetivos da Tela

O que o Centro de Operações precisa fazer o tempo todo:

| Objetivo | Como se manifesta |
|----------|-------------------|
| **Priorizar** | Coloca o trabalho de maior impacto no topo. |
| **Organizar** | Agrupa o caos em Missões e Filas claras. |
| **Explicar** | Diz **por que** cada coisa está ali (contexto e justificativa). |
| **Conduzir** | Aponta o próximo passo e leva ao ponto de trabalho. |
| **Medir** | Mostra a saúde da operação — sempre acionável. |

---

## 4. Estrutura Geral

A tela organiza-se pela [Hierarquia da Informação do 001](./001-design-principles.md): **ação primeiro, contexto depois, detalhe por último**.

```
+----------------------------------------------------------------+
|  HEADER  · org/cliente · busca (⌘K) · notificações · perfil    |
+----------------------------------------------------------------+
|  🎯 MISSÕES PRIORITÁRIAS                                        |
|  [ Missão 1 · impacto alto · ~10min · "por quê" ]  [ agir ]    |
|  [ Missão 2 ]   [ Missão 3 ]                                    |
+-----------------------------------+----------------------------+
|  ❤️ HEALTH DA OPERAÇÃO            |  🤖 IA COACH               |
|  Geral 77 🟡 · Comercial 55 🔴    |  "Hoje recomendo revisar   |
|  → dimensão fraca leva à ação     |   o preço de 5 produtos."  |
+-----------------------------------+----------------------------+
|  🕑 TIMELINE (narrativa recente)  |  📊 ANALYTICS (resumo)     |
|  "Margem subiu após ajuste..."    |  o que mudou · atenção     |
+----------------------------------------------------------------+
|  📥 FILAS INTELIGENTES                                          |
|  Publicações(12) · Aprovação(42) · Custos(5) · Problemas(8)    |
+----------------------------------------------------------------+
```

**Por que essa ordem:** as **Missões vêm primeiro** (o trabalho); **Health e IA** logo abaixo (o porquê e a orientação); **Timeline e Analytics** dão contexto; as **Filas** ficam ao alcance para o trabalho em lote. O olho encontra **o que fazer** antes de qualquer número.

| Área | Papel |
|------|-------|
| **Header** | Identidade do tenant + busca ([Command Palette 003](./003-navigation.md)) + notificações + perfil. |
| **Missões Prioritárias** | O trabalho do dia, ordenado por impacto. |
| **Health** | A saúde da operação, cada dimensão clicável. |
| **IA Coach** | A recomendação do dia, contextual. |
| **Timeline** | A narrativa recente da operação. |
| **Analytics** | O resumo do que merece atenção. |
| **Filas Inteligentes** | O trabalho homogêneo, pronto para lote. |

---

## 5. Missões

> [!important] Missões sempre aparecem primeiro.

A [Missão](../architecture/015-operation-center.md) é o centro do cockpit. Ela ocupa o topo porque **é o trabalho** — tudo o mais é apoio.

**Critérios de priorização** (a Zion calcula; o usuário vê o resultado, não a fórmula):

| Critério | O que pesa |
|----------|-----------|
| **Impacto** | Quanto se ganha/evita ao concluir (receita, risco, qualidade). |
| **Urgência** | Quão sensível ao tempo (ex.: overselling iminente). |
| **Esforço** | Quanto custa resolver (ganho fácil sobe). |
| **Dependências** | O que precisa vir antes (bloqueios descem). |

Cada Missão no cockpit mostra: **título · impacto · tempo estimado · o "por quê" · botão de agir**. Toda prioridade é **explicável** ("por que esta primeiro?") — princípio do [001](./001-design-principles.md).

---

## 6. Health

O Health aparece como **saúde acionável**, nunca número decorativo. Quatro leituras convivem, todas propriedade do [Operational Maturity (014)](../architecture/014-operational-maturity-engine.md) — o cockpit apenas **apresenta**:

| Health | Responde |
|--------|----------|
| **Health Geral** | "A operação está saudável?" |
| **Health Comercial** | "Estou ganhando dinheiro?" |
| **Health Operacional** | "O fluxo está fluindo (ERP, canais, automações)?" |
| **Health da Equipe** | "A equipe está equilibrada?" ([§11](#11-equipe)) |

**Nunca apenas números. Sempre contexto. Sempre ação:**
```
❌  Health Comercial: 55
✅  Health Comercial  55 🔴  ↓ -8 (7 dias)
    "12 produtos abaixo da margem puxaram para baixo."
    [ Revisar preços ]
```
Cada dimensão fraca é **clicável** e leva à Fila/Missão que a resolve ([014](../architecture/014-operational-maturity-engine.md)).

---

## 7. IA Coach

O [IA Coach](../architecture/016-implantation-journey.md) é a voz da inteligência no cockpit — **nunca um chatbot**, sempre **contextual** e propositiva.

Como ele fala:
- *"Hoje recomendo revisar o preço de 5 produtos que caíram abaixo da margem."*
- *"Há risco em 8 anúncios com erro de tamanho — podem estar perdendo venda."*
- *"Você economizará ~2 horas aprovando os 42 produtos prontos de uma vez."*

Regras (herdadas do [001 §IA na Interface](./001-design-principles.md)): **nunca ocupa a tela**, **sempre ao lado da ação**, **sempre explicável**, **sempre opcional**. O Coach **sugere e vira Missão** — não conversa por conversar.

> [!important] O Coach nunca compete com uma Missão
> Se há uma Missão urgente, o Coach **reforça** — não disputa a atenção com uma sugestão paralela (ver [Princípios de Atenção](#seção-especial--princípios-de-atenção)).

---

## 8. Filas Inteligentes

As [Filas](../architecture/015-operation-center.md) agrupam trabalho **homogêneo** para execução em lote e ritmo:

| Fila | Agrupa |
|------|--------|
| **Publicações** | Itens prontos/na fila de publicação. |
| **SEO** | Produtos com oportunidade de otimização. |
| **Custos** | Produtos com custo pendente/precisão baixa. |
| **Produtos** | Catálogo aguardando trabalho (enriquecer, corrigir). |
| **Marketplace** | Problemas/pendências por canal. |
| **Pendências** | "⚠️ informação necessária" espalhadas. |
| **Aprovações** | Produtos parados na trava A10. |

Cada fila mostra **quantidade + prioridade + tempo estimado + responsável** e permite **ação em lote** (aprovar 42, republicar 8) — sempre respeitando as travas de qualidade.

---

## 9. Timeline Operacional

A Timeline no cockpit é **narrativa recente**, não uma lista crua de logs:

```
❌  09:14 produto_mestre.atualizado  ·  09:12 marketplace.listing.erro

✅  "Há 20 min você publicou 42 chinelos no Mercado Livre.
     8 falharam por tamanho — já viraram uma Missão de correção."
```

Ela conta **o que aconteceu e o que significa** — transformando eventos em entendimento ([001 §Narrativas](./001-design-principles.md)). É a visão **viva/recente** da [Timeline da Operação (002 §13)](./002-information-architecture.md); o histórico longo mora no Analytics.

---

## 10. Analytics Resumido

O cockpit **não mostra BI completo** — mostra apenas o que **exige atenção agora**:

| Mostra | Não mostra |
|--------|------------|
| **O que mudou** (deltas com contexto). | Painéis extensos de gráficos. |
| **O que merece atenção** (quedas, anomalias). | Exploração livre de dados. |
| **Oportunidades** (ganhos ao alcance). | Relatórios completos. |

Cada item é **acionável** e, se exigir trabalho, **vira Missão**. O Analytics profundo é um **contexto próprio** ([002](./002-information-architecture.md)), acessível a um clique — mas não invade o cockpit.

---

## 11. Equipe

Cria-se oficialmente o **painel da Equipe** — para o gestor **equilibrar a operação**, nunca vigiar pessoas.

O gestor consegue ver:

| Indicador | Para quê |
|-----------|----------|
| **Quem está online** | Entender capacidade disponível agora. |
| **Quem está executando Missões** | Ver onde o trabalho está fluindo. |
| **Quem está parado** | Redistribuir trabalho / desbloquear. |
| **Quem está sobrecarregado** | Aliviar antes do estresse. |
| **Tempo médio de execução** | Identificar gargalos de processo (não de pessoa). |
| **Produtividade** | Calibrar carga, não ranquear. |
| **Qualidade** | Apoiar desenvolvimento (onde ajudar). |

> [!important] Equilíbrio, nunca vigilância
> Este painel existe para **distribuir trabalho com justiça e desenvolver pessoas** — não para monitorar comportamento. A leitura correta de "quem está sobrecarregado" é *"vamos aliviar"*, não *"quem trabalha menos"*. A Zion mede a **operação** para melhorá-la; nunca transforma pessoas em métricas de vigilância. (Ver [Painel do Gestor](#seção-especial--painel-do-gestor).)

---

## 12. Cliente

O **Cliente** (empresa-cliente, via Portal) vê uma versão **focada em resultado** — não a operação inteira da agência:

| Cliente vê | Cliente não vê |
|-----------|----------------|
| **Health** da sua operação. | A operação de outros clientes ([RLS](../architecture/010-database-compliance.md)). |
| **Missões** que dependem dele/o afetam. | O painel da Equipe da agência. |
| **Resultados** (vendas, margem, evolução). | Detalhes internos de execução da Equipe. |
| **Analytics** da sua empresa. | Configurações de plataforma. |

Princípio: mesma linguagem Zion ([000](./000-product-vision.md)), **escopo reduzido** — o Cliente enxerga *sua* operação com clareza, sem ruído do que não é dele.

---

## 13. Estados da Tela

O cockpit **se adapta ao estado**, mantendo o mesmo mapa mental ([003 §14](./003-navigation.md)):

| Estado | Como o Centro de Operações se comporta |
|--------|----------------------------------------|
| **Primeiro acesso** | O IA Coach guia o primeiro passo; poucas áreas, muita orientação ([016](../architecture/016-implantation-journey.md)). |
| **Empresa nova** | Foco em ativação (importar catálogo, conectar ERP); Health/Analytics ainda enxutos. |
| **Empresa madura** | Todas as áreas ativas; oportunidades e automação em evidência. |
| **Operação saudável** | Missões de **crescimento** no topo; tom calmo. |
| **Operação crítica** | O **urgente** sobe (prejuízo, ruptura, erro); o resto recolhe. |
| **Nenhuma missão** | **Vazio calmo**: "Operação em dia ✅" — nunca uma tela morta ([001](./001-design-principles.md)). |

---

## 14. Navegação

Como o cockpit se conecta ao resto (seguindo o [Modelo de Navegação 003](./003-navigation.md)):

- **Abrir um Workspace:** clicar numa Missão ou produto → deep link ao **ponto de trabalho** ([003 §9](./003-navigation.md)).
- **Abrir Analytics:** clicar num sinal/tendência → contexto Analytics **daquele** objeto.
- **Abrir Missões:** a fila de Missões é o próprio topo; clicar conduz ao contexto correto.
- **Sair:** por qualquer objeto (Missão/produto/sinal) — sempre para o ponto de trabalho.
- **Voltar:** **retorno natural** ao Centro de Operações após concluir a ação.

Princípio: do cockpit ao trabalho e de volta, **poucos cliques e sem becos** ([003](./003-navigation.md)).

---

## 15. Componentes Conceituais

Lista **oficial** de componentes conceituais do cockpit (sem detalhar UI — apenas objetivo):

| Componente | Objetivo |
|-----------|----------|
| **Missão Card** | Apresentar uma Missão: título, impacto, tempo, "por quê", ação. |
| **Health Card** | Mostrar uma dimensão de saúde com contexto e ação. |
| **Coach Card** | Trazer a recomendação da IA, contextual e acionável. |
| **Timeline Card** | Contar a narrativa recente da operação. |
| **Fila Card** | Resumir uma fila (quantidade, prioridade, tempo) e permitir lote. |
| **Equipe Card** | Dar ao gestor a leitura de carga/equilíbrio da equipe. |
| **Analytics Card** | Destacar o que mudou / merece atenção / oportunidade. |

Cada card obedece à regra de ouro: **leva a uma ação** ([001](./001-design-principles.md)).

---

## 16. Princípios

Princípios **oficiais** do Centro de Operações:

1. **A ação sempre aparece antes da informação.**
2. **Toda informação leva a uma ação.**
3. **Toda recomendação gera uma Missão.**
4. **Toda Missão possui contexto.**
5. **Toda prioridade pode ser explicada.**
6. **O vazio comunica calma** ("operação em dia"), nunca abandono.
7. **A saúde é sempre acionável** (dimensão fraca → correção).
8. **A IA acompanha, nunca compete** com o trabalho.

---

## 17. Critérios de Aceite

O Centro de Operações está conforme esta visão quando **todos** os critérios abaixo são verdadeiros:

- [ ] **Home oficial:** todo papel entra aqui; toda jornada retorna aqui.
- [ ] **Cockpit, não dashboard:** a tela conduz trabalho; nenhuma métrica existe sem ação.
- [ ] **Missões primeiro:** o trabalho priorizado ocupa o topo; prioridade explicável.
- [ ] **Health acionável:** Geral/Comercial/Operacional/Equipe com contexto e ação; nenhum número solto.
- [ ] **IA Coach contextual:** recomenda, explica, vira Missão; nunca chatbot, nunca compete.
- [ ] **Filas em lote:** trabalho homogêneo agrupado, com quantidade/prioridade/tempo/responsável.
- [ ] **Timeline narrativa:** conta o que aconteceu e o que significa, não logs crus.
- [ ] **Analytics resumido:** só o que mudou/merece atenção/oportunidade; BI completo fica no contexto Analytics.
- [ ] **Painel da Equipe para equilíbrio:** ajuda a distribuir/desenvolver, nunca vigia.
- [ ] **Visão do Cliente reduzida:** Health/Missões/Resultados/Analytics do próprio tenant; isolado por [RLS](../architecture/010-database-compliance.md).
- [ ] **Estados tratados:** primeiro acesso, nova, madura, saudável, crítica, sem-missões (vazio calmo).
- [ ] **Navegação com retorno:** abre Workspace/Analytics/Missões por objeto; volta natural; sem becos.
- [ ] **Princípios de Atenção respeitados:** uma prioridade máxima, poucos alertas, calma operacional.

---

## Seção especial — Um dia na vida do Alex

Como o Centro de Operações **conduz** o trabalho (não apenas o exibe):

| Momento | O que acontece no cockpit |
|---------|---------------------------|
| **Alex entra** | Vê **apenas três Missões** — não vinte. O topo diz claramente o que fazer primeiro. |
| **Escolhe a do topo** | *"Corrigir margem de 5 chinelos abaixo do piso"* — impacto alto, ~10 min, com o "por quê". |
| **Conclui a Missão** | Ajusta os preços; a Zion confirma o impacto ("margem volta ao piso"). |
| **O Health melhora** | O Health Comercial sobe de 55 🔴 para 63 🟡 — visível, na hora. |
| **A IA sugere a próxima** | O Coach: *"Ótimo. Agora recomendo aprovar os 42 produtos prontos — ~2 min."* |
| **Analytics registra** | A Timeline conta: *"Margem corrigida em 5 produtos; +8 no Health Comercial."* |
| **O cockpit reorganiza a fila** | A Missão concluída sai; a próxima sobe; a prioridade se recalcula sozinha. |

> [!important] O cockpit trabalha junto
> Alex nunca montou um plano nem decidiu por onde começar. O Centro de Operações **priorizou, explicou, conduziu e mediu** — e, a cada Missão concluída, **se reorganizou** para o próximo passo. Ele operou o negócio; a Zion operou a navegação.

---

## Seção especial — Painel do Gestor

Uma visão dedicada ao **gestor** — para conduzir a operação **através de pessoas**, com equilíbrio.

```
+----------------------------------------------------------------+
|  PAINEL DO GESTOR · Chinelaria (hoje)                          |
+---------------------------+------------------------------------+
|  EQUIPE                    |  CARGA                             |
|  4 online · 1 ausente     |  Ana ▓▓▓▓░ · Bruno ▓▓▓▓▓▓ (alerta) |
+---------------------------+------------------------------------+
|  Capacidade: 3 livres     |  Missões atrasadas: 2              |
|  Tempo médio: 11 min      |  IA utilizada: 68% das ações      |
+---------------------------+------------------------------------+
|  Produtividade: saudável  |  Qualidade: 96% aprovadas         |
|  Health da Equipe: 82 🟢  |  → Bruno sobrecarregado [ aliviar ]|
+----------------------------------------------------------------+
```

| Indicador | Leitura correta |
|-----------|-----------------|
| **Equipe / Capacidade / Carga** | Quem pode assumir mais, quem precisa de alívio. |
| **Produtividade** | Calibrar distribuição, não ranquear pessoas. |
| **Missões atrasadas / Tempo médio** | Achar gargalos de **processo**. |
| **IA utilizada** | Quanto a inteligência já apoia a equipe. |
| **Health da Equipe / Qualidade** | Onde **desenvolver** e apoiar. |

> [!important] Desenvolver pessoas, não vigiar
> O objetivo do Painel do Gestor é **melhorar a operação e desenvolver a equipe** — equilibrar carga, remover bloqueios, apoiar quem precisa. **Nunca** é uma ferramenta de vigilância ou punição. "Bruno sobrecarregado" é um convite a **aliviar**, não a cobrar. A dignidade de quem opera é um princípio, não um detalhe.

---

## Seção especial — Princípios de Atenção

Regras **oficiais** para evitar sobrecarga cognitiva e preservar a **calma operacional**:

1. **Nunca mais de uma prioridade máxima.** Um único "faça isto primeiro" por vez — duas prioridades máximas é nenhuma.
2. **Nunca mais de três alertas críticos simultâneos.** Acima disso, agrupa-se ("8 problemas — ver todos"); o cockpit não vira alarme.
3. **A IA nunca compete com uma Missão.** Havendo trabalho urgente, o Coach reforça; não abre uma frente paralela.
4. **Gráficos nunca substituem ações.** Visualização apoia a decisão; ela nunca é o produto da tela.
5. **Toda tela deve transmitir calma operacional.** A sensação-alvo é **controle**, não urgência ([001 §Emoção](./001-design-principles.md)).
6. **Densidade sob controle.** Revelação progressiva ([001 §12](./001-design-principles.md)); o cockpit mostra o essencial, aprofunda sob demanda.

> [!important] Calma é uma decisão de design
> Um cockpit que grita perde o piloto. A Zion **reduz a ansiedade** ao mostrar **poucas coisas certas** com clareza — uma prioridade, um próximo passo, uma explicação. Calma não é ausência de trabalho; é **trabalho sob controle**.

---

> **Registro oficial:** **O Centro de Operações é o coração da experiência da Zion. Ele organiza trabalho, não informações.**

> **Status:** `product/004` — Operation Center (Experiência) **v1.0**. Desenho de produto da Home: cockpit que conduz trabalho, com Missões no centro, Health e IA acionáveis, Filas em lote, Timeline narrativa, Analytics resumido, painéis de Equipe/Gestor para equilíbrio (nunca vigilância) e Princípios de Atenção para preservar a calma. Materializa a Regra de Ouro nº 1 do [003](./003-navigation.md) (Home = Centro de Operações). **Próximo documento sugerido:** `product/005-product-workspace.md` (o desenho de produto do Workspace do Produto Mestre — o segundo contexto detalhado: como o ambiente do produto se organiza em seções, como conteúdo/variantes/preço/ERP/marketplaces/IA convivem numa tela, como o operador trabalha um produto do início ao fim, e como Missão, Health e IA aparecem ali; o par natural desta Home, já que a maioria das Missões do cockpit abre um Workspace).
