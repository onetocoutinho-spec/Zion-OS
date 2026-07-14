# 005 — Product Workspace (Experiência)

> **Desenho de produto do Workspace do Produto Mestre.** O documento de arquitetura [011 — Product Master Workspace](../architecture/011-product-master-workspace.md) já definiu o **conceito técnico**; este define a **experiência**: como é *trabalhar dentro* de um produto. Usa apenas **diagramas Mermaid e wireframes ASCII** (sem Figma, sem componentes, sem código).

> **Relação com os documentos anteriores.** Aplica a [Product Vision (000)](./000-product-vision.md), os [Design Principles (001)](./001-design-principles.md), a [Information Architecture (002)](./002-information-architecture.md), a [Navigation (003)](./003-navigation.md) e o [Operation Center (004)](./004-operation-center.md). A arquitetura funcional é contexto e **não é copiada**.

> [!important] Registro oficial
> **O Workspace do Produto Mestre é o principal ambiente de trabalho da Zion. Ele não existe para editar produtos — existe para operar produtos.** E **nunca deve parecer um CRUD**: abrir um produto abre um **ambiente**, não um formulário.

---

## 1. Objetivo

Formalizar a **experiência do Workspace** — o ambiente em que o operador trabalha um [Produto Mestre](../architecture/011-product-master-workspace.md) do início ao fim do seu ciclo de vida.

> [!important] Registro oficial
> **O Workspace é o ambiente onde um produto vive.** Não é a "tela de edição de um registro"; é o **lugar do produto** — onde tudo sobre ele coexiste, é entendido e é operado. É o destino natural da maioria das Missões do [Centro de Operações (004)](./004-operation-center.md).

---

## 2. Filosofia

**O usuário não abre um cadastro. Ele entra no contexto do produto.**

| ❌ CRUD | ✅ Workspace |
|---------|--------------|
| Abre um formulário de campos. | Entra no **ambiente do produto**. |
| "Editar → salvar" é a moldura. | Operar é a moldura; editar é uma das ações. |
| Cada aspecto em outra tela. | Tudo relacionado ao produto, **sem trocar de tela**. |
| Mostra dados. | Mostra **situação, contexto e próximo passo**. |

Princípio: **tudo relacionado ao produto deve estar disponível sem trocar de tela.** O operador não "vai ao módulo de preço" nem "abre a tela de estoque" — ele **desce a seção** dentro do mesmo Workspace ([002 §Navegação Local](./002-information-architecture.md)).

---

## 3. Estrutura Geral

O Workspace segue a [Hierarquia da Informação do 001](./001-design-principles.md): identidade e situação no topo, contexto no corpo, histórico ao fim.

```
+--------------------------------------------------------------+
|  HEADER · nome · SKU · categoria · status · Health · [ações] |
+--------------------------------------------------------------+
|  IDENTIDADE DO PRODUTO · marca · origem · relacionamentos    |
+-----------------------------+--------------------------------+
|  🤖 IA COACH                | ❤️ HEALTH (do produto)         |
|  "Título fraco p/ busca —   | Conteúdo 90 · SEO 70 🟡        |
|   aplicar sugestão?"        | Comercial 55 🔴 → ação        |
+-----------------------------+--------------------------------+
|  📝 CONTEÚDO                | 💰 COMERCIAL                   |
|  título · descrição · SEO   | preço · margem · rentabilidade |
|  atributos · mídias         | (sempre com contexto)          |
+-----------------------------+--------------------------------+
|  🏭 ERP (somente leitura)   | 🛒 MARKETPLACES (por canal)    |
|  estoque · custo · fiscal   | ML: ativo · Shopee: erro       |
+--------------------------------------------------------------+
|  🕑 TIMELINE · a vida do produto                             |
+--------------------------------------------------------------+
```

| Região | Papel |
|--------|-------|
| **Header** | Identidade + situação + ações principais (sempre visível). |
| **Identidade** | Procedência e chaves do produto. |
| **IA Coach** | A recomendação contextual do produto. |
| **Health** | A saúde do produto, por dimensão, clicável. |
| **Conteúdo** | O que o comprador vê (título, descrição, SEO, atributos, mídias). |
| **Comercial** | Preço, margem, rentabilidade — sempre com contexto. |
| **ERP** | Estoque/custo/fiscal — **somente leitura**. |
| **Marketplaces** | Situação por canal, sem sair da tela. |
| **Timeline** | A história do produto. |

---

## 4. Header

O Header é fixo e responde de relance: **"que produto é este e como está?"** ([011 §4](../architecture/011-product-master-workspace.md)).

```
+--------------------------------------------------------------+
| Chinelo Slim Feminino          SKU CHNL-SLIM-001             |
| Calçados › Chinelos            Status: Publicado             |
| Health 72 🟡                   [ Publicar ] [ IA ] [ ⋯ ]     |
+--------------------------------------------------------------+
```

Contém: **Nome · SKU · Categoria · Status · Health · Ações principais.** Cada elemento é acionável onde faz sentido (clicar no Status mostra o que falta para avançar; clicar no Health abre a dimensão fraca). As **ações principais** (Publicar, Executar IA, ⋯) ficam sempre ao alcance — nunca escondidas em menus profundos.

---

## 5. Identidade

A seção de **procedência** — de onde o produto vem e como se conecta ([011 §5](../architecture/011-product-master-workspace.md)):

| Elemento | Mostra |
|----------|--------|
| **Marca** | A marca do produto. |
| **Categoria** | Categoria Zion (e a de canal, quando publicado). |
| **Família / Linha / Coleção** | A hierarquia comercial. |
| **Relacionamentos** | Kit/combo, similares, substitutos. |
| **Produtos relacionados** | Atalhos para produtos ligados (abrem outro Workspace, contexto preservado). |

Princípio: as chaves de conciliação (SKU origem → EAN → ERP SKU → item por canal) aparecem **juntas**, deixando explícito "o mesmo produto em todos os sistemas" — nunca campos soltos.

---

## 6. Conteúdo

O que o comprador vê — trabalhado como **conteúdo vivo**, **nunca como formulário gigante**:

| Bloco | O que é |
|-------|---------|
| **Título** | O título do anúncio (com força de busca). |
| **Descrição** | O texto completo. |
| **SEO** | Keyword principal, secundárias, título otimizado. |
| **Atributos** | Ficha técnica (os filtros de busca do marketplace). |
| **Mídias** | Capa, secundárias, infográfico, medidas. |

> [!important] Nunca um formulário gigante
> O Conteúdo não é uma parede de 40 campos. É organizado por **blocos com propósito**, com **revelação progressiva** ([001 §12](./001-design-principles.md)): o essencial visível, o resto sob demanda. Campos obrigatórios faltando aparecem como **"⚠️ informação necessária"** em destaque — e a **IA se oferece para preencher** o que dá (nunca inventa o que falta).

---

## 7. Comercial

A situação de lucro do produto — **sempre com contexto, nunca números isolados** ([001 §Contexto](./001-design-principles.md)). Fonte: [Commercial Intelligence (012)](../architecture/012-commercial-intelligence-engine.md); o Workspace **apresenta**.

```
❌  Margem: 12%   Preço: R$ 39,90

✅  Margem  12% 🔴  ↓ -6% (após custo subir no ERP)
    "Abaixo do piso de 18%. Preço atual R$ 39,90; custo R$ 31,20 + taxas."
    Competitividade: preço 8% acima da mediana do canal.
    [ Revisar preço ]   [ Por quê? ]
```

Mostra: **Preço · Margem · Rentabilidade · Competitividade · Health Comercial** — cada um com comparação, causa e ação. Nenhum cálculo acontece aqui (é do [012](../architecture/012-commercial-intelligence-engine.md)/[013](../architecture/013-cost-engine.md)); o Workspace **mostra o veredito e oferece a ação**.

---

## 8. ERP

Os dados que pertencem ao [ERP Magazord](../architecture/000-business-domain.md) — **somente leitura**, com a origem sempre clara:

```
+--------------------------------------------------------------+
|  🏭 ERP · Magazord            (somente leitura)              |
|  Estoque   142 un.            Custo   R$ 31,20               |
|  Fiscal    NCM 6402.99        Fornecedor  Grendene           |
|  Sincronizado há 6 min        origem: ERP (medido)          |
+--------------------------------------------------------------+
```

| Campo | Origem |
|-------|--------|
| **Estoque / Custo / Fiscal / Fornecedor** | ERP (espelho read-only). |
| **Origem dos dados** | Sempre visível ("origem: ERP"). |

> [!important] O ERP continua sendo a fonte oficial
> Estes campos **não são editáveis** na Zion. A interface deixa isso **explícito** (etiqueta "somente leitura", origem "ERP", "sincronizado há X") — o operador entende, sem ambiguidade, que **o ERP é dono** de estoque/custo/fiscal. A única ação é **"Sincronizar ERP"** (atualiza o espelho; não escreve no ERP).

---

## 9. Marketplaces

A situação do produto **em cada canal** — **sem nunca abrir outra tela** ([011 §10](../architecture/011-product-master-workspace.md)):

```
+--------------------------------------------------------------+
|  🛒 MARKETPLACES                                             |
|  Mercado Livre  🟢 Ativo    MLB123  ·  publicado há 2 dias   |
|  Shopee         🔴 Erro     tamanho não normalizado [corrigir]|
|  TikTok Shop    ⚪ Não publicado                    [publicar]|
+--------------------------------------------------------------+
```

Para cada canal: **Situação · Publicação · Pendências · Erros · Performance.** Um problema num canal (ex.: erro de tamanho na Shopee) mostra a **causa** e o **botão de correção** ali mesmo — sem trocar de contexto. Cada correção vira ação/Missão, executada pelo [Workflow Engine (019)](../architecture/019-workflow-engine.md).

---

## 10. Timeline

A **vida do produto** em ordem cronológica ([011 §11](../architecture/011-product-master-workspace.md)) — narrativa, não log cru ([001 §Narrativas](./001-design-principles.md)):

```
🕑  Hoje 14:20 · você ajustou o preço (R$ 42,90) → margem voltou ao piso
    Ontem     · IA otimizou o título para busca (Versão 7)
    3 dias    · publicado no Mercado Livre (MLB123)
    5 dias    · custo atualizado pelo ERP (R$ 29 → R$ 31,20)
    7 dias    · enriquecido pela IA · 2 campos pendentes
```

Registra: toda **mudança** do produto, toda **publicação**, toda **IA**, toda **aprovação**, toda **alteração importante** — cada uma com **autor** (humano ou Agente IA) e ligada à sua **Versão**. É imutável, filtrável e sem segredos.

---

## 11. IA Coach

A [IA](../architecture/017-zion-intelligence-operating-system.md) como **especialista daquele produto** — **nunca chatbot**, sempre contextual e propositiva ([011 §12](../architecture/011-product-master-workspace.md)):

| A IA oferece | Exemplo |
|--------------|---------|
| **Sugestões** | "O título pode melhorar para busca — **aplicar**?" |
| **Explicações** | "A margem caiu porque o custo subiu no ERP em abril." |
| **Correções** | "8 anúncios da Shopee falharam por tamanho — **normalizar e republicar**." |
| **Oportunidades** | "Demanda alta e preço abaixo da mediana — **avaliar aumento**." |

Regras: **contextual** (fala deste produto), **explicável** (por quê + confiança), **opcional** (não bloqueia), **próxima da ação** (recomendação + botão). Toda saída é **revisável** antes de virar Versão — a IA acelera, o humano decide.

---

## 12. Estados

O Workspace **muda de ênfase** conforme o estado do produto:

| Estado | Como a interface se comporta |
|--------|------------------------------|
| **Produto novo** | Foco em completar: campos obrigatórios em destaque, IA se oferecendo para enriquecer. |
| **Produto incompleto** | Pendências "⚠️" no topo; Health baixo aponta o que falta; próximo passo claro. |
| **Produto saudável** | Tom calmo; foco em otimização/oportunidade (SEO, preço). |
| **Produto publicado** | Situação por canal em evidência; monitoramento e ajustes. |
| **Produto crítico** | O urgente sobe (prejuízo, erro de publicação, ruptura); a correção vira o foco. |

Princípio: a mesma tela, **ênfases diferentes** — sempre respondendo "o que fazer agora neste produto?" ([001](./001-design-principles.md)).

---

## 13. Navegação

Como o operador entra, circula e volta — sem perder contexto ([003](./003-navigation.md)):

- **Como entra:** por uma Missão do [Centro de Operações](./004-operation-center.md) (deep link ao ponto exato), por busca ([Command Palette](./003-navigation.md)) ou pela lista de Produtos.
- **Como abre Marketplace/Analytics/Timeline:** são **seções do próprio Workspace** — desce-se a seção, não se troca de tela; o Analytics profundo abre no contexto **daquele** produto.
- **Como volta:** **retorno natural** ao Centro de Operações após a ação (a Missão fecha, a próxima sobe).
- **Como abre um relacionado:** clicar num produto relacionado abre **outro Workspace**, com o contexto preservado (e retorno ao anterior).

Princípio: dentro do Workspace, o **objeto (o produto) fica fixo**; muda apenas o **ângulo** — o contexto nunca se rompe.

---

## 14. Componentes Conceituais

Lista **oficial** de componentes conceituais do Workspace (objetivo, sem detalhar UI):

| Componente | Objetivo |
|-----------|----------|
| **Header Card** | Identidade + situação + ações principais, sempre visível. |
| **Identity Card** | Procedência e chaves do produto. |
| **Content Card** | Conteúdo (título/descrição/SEO/atributos/mídias) em blocos, não formulário. |
| **Commercial Card** | Preço/margem/rentabilidade/competitividade com contexto e ação. |
| **ERP Card** | Estoque/custo/fiscal read-only, com origem explícita. |
| **Marketplace Card** | Situação por canal, com correção no lugar. |
| **Timeline Card** | A vida do produto, narrativa e filtrável. |
| **Coach Card** | Recomendação contextual da IA, acionável. |
| **Health Card** | Saúde do produto por dimensão, clicável. |

Todos obedecem à regra de ouro: **levam a uma ação** ([001](./001-design-principles.md)).

---

## 15. Princípios

Princípios **oficiais** do Workspace:

1. **Todo produto possui contexto.**
2. **Toda edição possui impacto** (visível).
3. **Toda recomendação leva a uma ação.**
4. **Toda alteração possui histórico** (Versão + Timeline).
5. **Toda informação possui origem** (Zion / ERP / IA / canal).
6. **Nenhum Workspace parece um formulário.**
7. **O que é somente leitura é declarado** (o ERP é dono).
8. **O Produto Mestre é vivo** — a tela reflete seu estado real, não uma foto parada.

---

## 16. Critérios de Aceite

O Workspace está conforme esta visão quando **todos** os critérios abaixo são verdadeiros:

- [ ] **Ambiente, não CRUD:** abrir um produto abre um contexto com situação/ação/histórico — não um formulário.
- [ ] **Tudo numa tela:** conteúdo/comercial/ERP/marketplaces/IA/timeline convivem sem trocar de tela.
- [ ] **Header fixo e acionável:** nome/SKU/categoria/status/Health/ações sempre visíveis.
- [ ] **Comercial com contexto:** preço/margem/rentabilidade/competitividade nunca aparecem como número solto.
- [ ] **ERP somente leitura e declarado:** estoque/custo/fiscal read-only, com origem "ERP" explícita.
- [ ] **Marketplaces sem sair:** situação/erro/correção por canal, dentro do Workspace.
- [ ] **Conteúdo sem formulário gigante:** blocos com revelação progressiva; pendências em destaque.
- [ ] **IA Coach contextual:** sugere/explica/corrige/aponta oportunidade; nunca chatbot; revisável.
- [ ] **Timeline narrativa:** toda mudança/publicação/IA/aprovação registrada, com autor e Versão.
- [ ] **Estados tratados:** novo/incompleto/saudável/publicado/crítico mudam a ênfase, não o mapa.
- [ ] **Navegação com contexto:** entra por Missão/busca, desce seções, retorna natural; relacionados preservam contexto.
- [ ] **Histórico e origem sempre:** toda alteração versionada; toda informação com origem.
- [ ] **Multiempresa isolado:** o Workspace respeita o tenant ([RLS](../architecture/010-database-compliance.md)).

---

## Seção especial — Uma hora na vida do Alex

Como o Workspace faz Alex **operar um produto** (não editar um registro):

| Momento | O que acontece no Workspace |
|---------|------------------------------|
| **Recebe uma Missão** | No cockpit: *"Melhorar o Chinelo Slim — SEO fraco e margem no limite."* Clica. |
| **Abre o Workspace** | Cai no produto, **no ponto certo**: o Coach já aponta o título fraco e a margem 🔴. |
| **Corrige o SEO** | Aceita a sugestão da IA (título otimizado); vê a Versão ser criada. |
| **Atualiza as imagens** | Sobe uma capa melhor; a seção de Mídias reflete na hora. |
| **Analisa a margem** | No Comercial: *"12% 🔴, abaixo do piso — custo subiu no ERP."* Ajusta o preço para R$ 42,90. |
| **Publica** | Um clique; o Workflow executa; a situação do canal passa a "publicando → ativo". |
| **A IA explica** | *"Preço ajustado: margem volta a 18%. Título deve melhorar o ranqueamento."* |
| **A Timeline registra** | "Preço ajustado · SEO otimizado (V8) · republicado no ML." |
| **O Health melhora** | SEO 70→88, Comercial 55→64 — visível no Header. |
| **O Centro de Operações atualiza** | A Missão fecha sozinha; no cockpit, a próxima já subiu. |

> [!important] Uma tela, um fluxo, um produto
> Alex nunca "abriu outra tela" nem "salvou um formulário". Ele **entrou no produto**, entendeu a situação, agiu com a IA ao lado, viu o impacto e a Missão se fechar. Ele **operou o produto** — a Zion cuidou do resto.

---

## Seção especial — Antes e Depois

A diferença entre um cadastro e um ambiente de trabalho:

```
❌ ERP TRADICIONAL                    ✅ WORKSPACE ZION
─────────────────────                 ──────────────────────
Abre cadastro                         Abre o contexto do produto
   ↓                                     ↓
Edita campos                          Entende a situação (Health, problemas)
   ↓                                     ↓
Salva                                Recebe a orientação da IA
                                        ↓
(e agora? outra tela?)               Executa a Missão (corrige, publica)
                                        ↓
                                     Acompanha o impacto (Health sobe, canal ativo)
```

| Dimensão | ERP tradicional | Workspace Zion |
|----------|-----------------|----------------|
| **O que o usuário faz** | Preenche e salva. | Entende e opera. |
| **Foco** | O registro. | O produto vivo e seu resultado. |
| **A IA** | Ausente. | Copiloto ao lado da ação. |
| **O impacto** | Invisível. | Visível na hora (Health, canal, margem). |
| **O próximo passo** | O usuário adivinha. | A Zion aponta. |

Princípio: no ERP tradicional o produto é um **registro que se edita**; no Workspace Zion o produto é uma **operação que se conduz**.

---

## Seção especial — Os Dez Mandamentos do Workspace

Lista **oficial** — inegociável para qualquer tela de Workspace:

1. **Nunca abrir um formulário gigante.**
2. **Nunca esconder problemas** (pendências e erros aparecem, não se escondem).
3. **Sempre mostrar impacto** (o efeito de cada ação é visível).
4. **Sempre mostrar contexto** (nenhum número/estado solto).
5. **Sempre preservar histórico** (toda alteração vira Versão + Timeline).
6. **Sempre mostrar origem** (Zion / ERP / IA / canal).
7. **Sempre mostrar o próximo passo** (nunca um beco sem saída).
8. **Sempre manter a IA próxima** (contextual, ao lado da ação).
9. **Sempre manter o Health visível** (a saúde do produto, acionável).
10. **Sempre lembrar que o Produto Mestre é vivo** (a tela reflete o estado real, não uma foto).

---

> **Registro oficial:** **O Workspace do Produto Mestre é o principal ambiente de trabalho da Zion. Ele não existe para editar produtos — existe para operar produtos.**

> **Status:** `product/005` — Product Workspace (Experiência) **v1.0**. Desenho de produto do segundo contexto: o ambiente onde um produto vive, com tudo numa tela, IA especialista ao lado, ERP declarado read-only, marketplaces sem sair, timeline narrativa e Health sempre visível. Materializa o [011](../architecture/011-product-master-workspace.md) como experiência; é o par natural do [Centro de Operações (004)](./004-operation-center.md). **Próximo documento sugerido:** `product/006-client-portal.md` (o desenho de produto do Portal do Cliente — a experiência da empresa-cliente: o que o Cliente vê e faz por si mesmo (Health, Missões que o afetam, resultados, Analytics da sua operação), como o Portal se diferencia do painel da Equipe mantendo o mesmo idioma Zion, o escopo reduzido e o isolamento por tenant, e como o Cliente colabora com a agência sem ruído — fechando a trilha dos ambientes principais de trabalho).
