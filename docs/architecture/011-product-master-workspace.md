# 011 — Workspace do Produto Mestre (Product Master Workspace)

> **Visão de Produto da Zion Platform — Épico 1: Experiência do Operador.** Define a **tela mais importante da Zion**: o ambiente em que o operador trabalha o [Produto Mestre](./001-product-master.md) durante **todo o seu ciclo de vida**. É um documento de **produto e UX** — **sem implementação**. Não descreve componentes, banco, API ou código; descreve **o que a experiência deve fazer**, **por quê** e **quais princípios** a governam.

> **Autoridade e escopo.** Este documento **não altera** os documentos `000`–`010`, o `015` nem os conceitos planejados. Ele os **consome**. Em divergência de nomenclatura, **[000 — Business Domain](./000-business-domain.md) prevalece**; em divergência de escopo do dado canônico, prevalece **[001 — Product Master](./001-product-master.md)**. O Workspace é uma **experiência** sobre o Produto Mestre; ele nunca redefine o modelo canônico, apenas o **apresenta e opera**.

> **Referências:** [000 Business Domain](./000-business-domain.md) · [001 Product Master](./001-product-master.md) · [006 Zion Intake](./006-capability-000-zion-intake.md) · [007 Execution Roadmap](./007-execution-roadmap.md) · [008 Architecture Compliance](./008-architecture-compliance.md) · [010 Database Compliance](./010-database-compliance.md) · [015 Operation Center](./015-operation-center.md).

---

## 1. Objetivo

O **Workspace do Produto Mestre** é o ambiente onde o operador **trabalha um produto** — do recebimento à publicação, da manutenção ao arquivamento. Fica registrado oficialmente: **abrir um Produto Mestre não abre um formulário; abre um Workspace.**

> [!important] Registro oficial — **não é um CRUD**
> O usuário **nunca** deve enxergar um CRUD (uma tabela de campos para "criar/editar/salvar/excluir"). O Produto Mestre abre um **ambiente operacional completo**, com contexto, inteligência, histórico e ações — tudo em um único lugar. "Editar" é apenas **uma** das ações possíveis, nunca a moldura da experiência.

**Propósito em uma frase:** dar ao operador, ao abrir um produto, **todo o contexto e todas as ações** de que ele precisa para conduzir aquele produto ao longo da vida — sem pular entre telas, sem reconstruir contexto, sem calcular nada manualmente.

**O que o Workspace é:**
- O **ambiente de trabalho** de um único [Produto Mestre](./001-product-master.md) e suas [Variantes](./001-product-master.md).
- O ponto onde **conteúdo, comercial, ERP, marketplaces, IA, histórico e ações convivem**.
- O destino natural de uma [Missão](./015-operation-center.md) do [Centro de Operações](./015-operation-center.md) (ex.: "corrigir publicação de {produto}" abre o Workspace já no ponto certo).

**O que ele não é:**
- Não é um formulário de cadastro.
- Não é uma planilha de campos.
- Não é um visualizador estático — é um ambiente de **ação**.

---

## 2. Filosofia

O Workspace segue princípios explícitos, herdados da filosofia do [Centro de Operações](./015-operation-center.md) e aplicados ao produto individual:

1. **Contexto completo.** Ao abrir o produto, o operador vê **tudo que importa** sobre ele — identidade, conteúdo, comercial, ERP, canais, IA, histórico — sem precisar buscar em outros lugares.
2. **Nenhuma informação isolada.** Cada dado aparece **junto do que dá sentido a ele** (o preço ao lado da margem e do custo; o anúncio ao lado do seu estado e problemas). Nada de campos órfãos.
3. **Todas as ações em um único lugar.** Publicar, executar IA, sincronizar ERP, comparar versões, abrir Missão — tudo acessível de dentro do Workspace, sem troca de contexto.
4. **Foco na operação.** A tela é organizada por **como o produto é operado**, não por como o dado é armazenado. A estrutura do banco ([010](./010-database-compliance.md)) é invisível ao operador.
5. **Foco em produtividade.** O caminho do "ver" ao "resolver" é curto; a IA pré-analisa e recomenda; ações em lote (nas Variantes) quando fizer sentido.
6. **Respeito à Fonte da Verdade ([000](./000-business-domain.md)).** O Workspace **apresenta** dados de que não é dono (estoque/custo do [ERP](./000-business-domain.md); estado do anúncio do Marketplace) como **somente leitura**, e só permite editar o que é da Zion (conteúdo, preço de venda, identidade).
7. **Toda alteração é versionada.** Qualquer mudança relevante gera **[Versão](./001-product-master.md) + evento** ([Event Bus](./004-event-bus.md)); o operador nunca perde o histórico.
8. **Multiempresa por padrão.** O Workspace é escopado por `cliente_id`/`organizacao_id` ([RLS deny-by-default](./010-database-compliance.md)).

---

## 3. Estrutura Geral

O Workspace é organizado em **seções** (navegáveis por âncoras/abas laterais), todas sobre o **mesmo** produto e sempre disponíveis. Cada seção tem responsabilidade única:

| Seção | O que apresenta | Fonte da Verdade |
|-------|-----------------|------------------|
| **Resumo** | Visão de abertura: estado geral, Health Score, pendências, ação recomendada. | Agregação |
| **Identidade** | Chaves e procedência (SKU Origem, EAN, ERP SKU, Origem, Catálogo, Fornecedor, Marca, Linha, Coleção). | Zion + [Origem](./000-business-domain.md) |
| **Conteúdo** | Título, descrição, bullets, características, atributos, SEO, idioma. | Zion |
| **Variantes** | As derivações vendáveis; comparação, estoque e preço por variante. | Zion + [ERP](./000-business-domain.md) (espelho) |
| **Preços** | Preço de venda por canal, piso/margem (apresentação), histórico de preço. | Zion (preço) + Commercial Intelligence *(012)* |
| **Imagens** | Ativos visuais (capa, secundárias, detalhe, medidas, humanizada) e origem (origem/IA/upload). | Zion |
| **SEO** | Keyword principal, secundárias, título otimizado, termos a evitar. | Zion (IA A2/A3) |
| **IA** | O especialista do produto: recomendações e ações de enriquecimento. | AI Workforce (A0–A12) |
| **Marketplaces** | Situação por canal (estado, publicação, sincronização, problemas). | Marketplace (estado) |
| **ERP** | Estoque, custo, fiscal, fornecedor, última sincronização (somente leitura). | [ERP / Magazord](./000-business-domain.md) |
| **Versões** | Histórico versionado (diff, autor, agente, timestamp, undo). | Zion ([001](./001-product-master.md)) |
| **Timeline** | A vida do produto em ordem cronológica. | [Event Bus](./004-event-bus.md) / Auditoria |
| **Eventos** | A lista estruturada de eventos do produto (origem, autor, resultado). | [Event Bus](./004-event-bus.md) |
| **Saúde Comercial** | Lucro, margem, markup, rentabilidade, alertas (apresentação). | Commercial Intelligence *(012)* |
| **Documentos** | Anexos relacionados (ficha do fornecedor, guia de medidas, laudos). | Zion |
| **Relacionamentos** | Produtos ligados (kit/combo, similares, mesma linha, substitutos). | Zion |

> [!note] Uma tela, muitos ângulos
> Todas as seções descrevem **o mesmo produto** sob ângulos diferentes. O operador não "abre outra tela" para ver o ERP ou o comercial — ele **rola/navega** dentro do mesmo Workspace.

---

## 4. Cabeçalho

O **Cabeçalho** é fixo no topo do Workspace e responde, de relance: *"que produto é este e como ele está?"*. Ele acompanha o operador em todas as seções.

| Campo | O que mostra |
|-------|--------------|
| **SKU Origem** | `sku_origem` — a chave 1ª de conciliação ([000](./000-business-domain.md)). |
| **EAN** | Código de barras (complementar ao SKU). |
| **Marca** | Marca do produto. |
| **Fornecedor** | A [Origem do Produto](./000-business-domain.md) (fornecedor/fabricante/importador/…). |
| **Categoria** | Categoria Zion (e, quando publicado, a categoria de canal mapeada). |
| **Modo de Operação** | Como o produto é operado/publicado (ex.: **clássico** × **User Products/SIZE_GRID**; produto **simples** × **kit/combo**). |
| **Status** | Estado do Produto Mestre (ex.: rascunho, enriquecendo, aguardando aprovação, publicado, arquivado — conforme [001](./001-product-master.md)). |
| **Health Score** | O indicador consolidado do produto (ver [§14](#14-health-score)). |
| **Última atualização** | Quando e por quem (humano ou Agente IA) o produto mudou pela última vez. |

Princípios do Cabeçalho:
- **Sempre visível** — o contexto essencial nunca sai da vista.
- **Cada elemento é acionável** onde faz sentido (clicar no Status abre o que falta para avançar; clicar no Health Score abre a dimensão fraca).
- **Sem dado decorativo** — herda a regra de ouro do [015](./015-operation-center.md): informação leva a ação.

---

## 5. Painel de Identidade

Formaliza a **procedência e as chaves** do produto — de onde ele vem e como é conciliado em todos os sistemas.

| Campo | Significado | Dono |
|-------|-------------|------|
| **SKU Origem** | `sku_origem` — chave 1ª de conciliação. | [Origem](./000-business-domain.md) |
| **EAN** | GTIN, complementar ao SKU (desempata, nunca substitui). | Origem |
| **ERP SKU** | `erp_sku` — o código no [Magazord](./000-business-domain.md). | ERP |
| **Origem** | O tipo de origem (fornecedor/fabricante/importador/distribuidor/marca própria). | Origem |
| **Catálogo** | O lote bruto de onde o produto veio ([006](./006-capability-000-zion-intake.md)). | Zion (registro) |
| **Fornecedor** | Identificação da origem que abastece o cliente. | Origem |
| **Marca / Linha / Coleção** | Hierarquia comercial do produto. | Zion |
| **Relacionamentos** | Vínculos com outros produtos (kit/combo, similares, substitutos). | Zion |

Princípios:
- As chaves de conciliação (`sku_origem` → `ean` → `erp_sku` → `marketplace_item_id`) aparecem **juntas**, deixando explícito o "mesmo produto em todos os sistemas".
- Campos de origem são **espelho** — a Zion não inventa procedência; ela vem do [Catálogo](./006-capability-000-zion-intake.md).

---

## 6. Conteúdo

A seção onde o operador trabalha **o que o comprador vê**. Todo campo aqui é da Zion (conteúdo é Fonte da Verdade da Zion).

| Campo | Descrição |
|-------|-----------|
| **Título** | Título do anúncio (otimizado para busca do canal). |
| **Descrição** | Texto completo do produto. |
| **Bullets** | Pontos-chave/benefícios em lista. |
| **Características** | Ficha descritiva (texto estruturado). |
| **Atributos** | Pares nome→valor (marca, material, gênero, tipo…) — os filtros de busca do marketplace. |
| **SEO** | Keyword principal, secundárias, título otimizado, termos a evitar (ver [§ SEO no §3](#3-estrutura-geral)). |
| **Campos IA** | Campos gerados/sugeridos pela IA, sempre marcados como tais e revisáveis. |
| **Idioma** | Idioma do conteúdo (base para futura expansão multilíngue). |
| **Campos obrigatórios** | Os campos exigidos pela categoria/canal, com destaque do que falta. |

Princípios do Conteúdo:
- **Campos obrigatórios em evidência** — o que falta para publicar aparece destacado ("⚠️ informação necessária"), nunca escondido.
- **IA nunca inventa** — campos sem dado real ficam pendentes, não preenchidos com ficção ([006](./006-capability-000-zion-intake.md)).
- **Toda edição é versionada** ([§11](#11-timeline) / [§13](#13-eventos)).

---

## 7. Variantes

As [Variantes](./001-product-master.md) são as derivações vendáveis (cor, tamanho, voltagem). A seção precisa deixar o operador **navegar, comparar e agir em lote**.

- **Como navegar:** lista/grade das variantes com identificação clara (ex.: "38 BR — Azul"), busca e filtro por atributo.
- **Como comparar:** visão lado a lado que evidencia **as diferenças** entre variantes (o que muda de uma para outra: SKU, EAN, preço, estoque, imagem).
- **Como identificar diferenças:** destaque visual das divergências (ex.: variante sem EAN, sem imagem, sem estoque, com preço fora do padrão).
- **Como visualizar estoque e preço:** cada variante mostra o **preço de venda** (Zion) e o **estoque/custo espelhados** do [ERP](./000-business-domain.md) — deixando claro o que é editável (preço) e o que é somente leitura (estoque/custo).

Princípios:
- **Ação em lote** onde fizer sentido (aplicar um atributo a todas, ajustar preço da grade), respeitando as travas de qualidade.
- **Tamanhos normalizados** são pré-requisito para publicação em categorias com SIZE_GRID — a seção sinaliza variantes com tamanho "sujo" a normalizar.

---

## 8. Inteligência Comercial

O Workspace **apresenta** a inteligência comercial do produto — **sem calcular**. Todo cálculo vem do futuro **Commercial Intelligence Engine** *(012, planejado)* e das fontes de custo do [ERP](./000-business-domain.md).

| Sinal | O que mostra |
|-------|--------------|
| **Lucro** | Lucro líquido estimado por venda (preço − custo − taxas). |
| **Margem** | Margem percentual sobre o preço de venda. |
| **Markup** | Multiplicador sobre o custo. |
| **Rentabilidade** | Leitura consolidada (saudável / no piso / prejuízo). |
| **Alertas** | Ruptura de piso, queda de margem, prejuízo, custo subiu. |
| **Oportunidades** | Espaço para aumentar preço, demanda alta, desalinhamento vs. canal. |

> [!important] Fronteira de responsabilidade
> Esta seção é **somente apresentação**. O **custo** é do [ERP](./000-business-domain.md); o **preço de venda** é da Zion; os **cálculos** (lucro/margem/markup/piso) vêm do **Commercial Intelligence Engine** *(012)*. O Workspace **mostra o veredito** e **oferece a ação** (ex.: "Revisar preço" → abre a edição de preço ou uma [Missão](./015-operation-center.md)); nunca recalcula por conta própria.

---

## 9. ERP

Mostra os dados que pertencem ao [ERP (Magazord)](./000-business-domain.md), **sempre somente leitura** — a Zion consome/espelha, nunca inventa nem edita estoque/custo/fiscal.

| Campo | Origem |
|-------|--------|
| **Estoque** | Quantidade disponível (`estoque_erp`, espelho read-only). |
| **Custo** | Custo do produto (`custo_erp`, espelho read-only). |
| **Fiscal** | Dados fiscais que são do ERP (NCM, tributação — referência). |
| **Fornecedor** | Vínculo de fornecimento no ERP. |
| **Última sincronização** | Quando o espelho foi atualizado (evento `erp.estoque.mudou` / `erp.custo.mudou`). |

> [!important] Somente leitura
> Nenhum campo desta seção é editável na Zion. Tentativas de edição de estoque/custo são **bloqueadas por design** ([000](./000-business-domain.md)/[010](./010-database-compliance.md)). A ação disponível é **"Sincronizar ERP"** (ver [§15](#15-ações)), que solicita atualização do espelho — não escreve no ERP.

---

## 10. Marketplaces

Mostra a **situação do produto em cada canal**. O estado real do anúncio é Fonte da Verdade do Marketplace; a Zion apresenta e dispara ações via [Marketplace Engine](./005-marketplace-engine.md).

| Canal | O que mostra |
|-------|--------------|
| **Mercado Livre** | Estado do anúncio, MLB/permalink, publicação, sincronização, problemas. |
| **Shopee** | Idem (quando o canal estiver ativo). |
| **TikTok Shop** | Idem. |
| **Amazon** | Idem (canal futuro). |

Para **cada canal**, o Workspace apresenta:

| Campo | Significado |
|-------|-------------|
| **Status** | Estado real do listing (ativo, pausado, reprovado, não publicado). |
| **Última publicação** | Quando o produto foi publicado/atualizado no canal. |
| **Última sincronização** | Quando o estado foi reconciliado (webhook `marketplace.listing.estado`). |
| **Problemas** | Erros de publicação/atributo/SIZE_GRID, com ação de correção. |

Princípios:
- **Um produto, N canais, estados independentes** — a seção deixa claro o que está no ar e onde.
- **Cada problema leva a uma ação** (corrigir e republicar) ou abre uma [Missão](./015-operation-center.md).

---

## 11. Timeline

Registra **toda a vida do produto** em ordem cronológica, alimentada pelo [Event Bus](./004-event-bus.md) e pela auditoria. Responde: *"o que já aconteceu com este produto?"*.

Marcos típicos:

| Marco | Exemplo |
|-------|---------|
| **Recebimento** | "Produto recebido no Catálogo {id} da origem {X}" |
| **IA** | "Enriquecimento A0–A12 concluído; 2 campos pendentes" |
| **Aprovação** | "Aprovado no Board (trava A10) por {operador}" |
| **Publicação** | "Publicado no Mercado Livre ({MLB})" |
| **Alterações** | "Título/atributos editados (Versão {n})" |
| **Custo** | "Custo atualizado pelo ERP (`erp.custo.mudou`)" |
| **Preço** | "Preço de venda ajustado para {valor}" |
| **Retry** | "Republicação automática após falha" |
| **Arquivamento** | "Produto arquivado por {operador}" |

Princípios: **imutável, filtrável, correlacionada** (de um marco de erro salta-se para a correção) e **sem segredos** ([008](./008-architecture-compliance.md)).

---

## 12. IA

No Workspace, a [IA](./006-capability-000-zion-intake.md) atua como **especialista daquele produto** — não como chat genérico. Ela conhece o contexto do produto e **recomenda e executa ações de enriquecimento**, sempre sob aprovação humana (trava A10, regra-mãe "nunca inventar dado").

Exemplos de atuação:
- **Melhorar descrição** — reescreve a descrição respeitando os dados reais.
- **Criar SEO** — gera keyword principal, secundárias e título otimizado (A2/A3).
- **Corrigir categoria** — sugere a categoria correta do canal e os atributos que ela exige.
- **Gerar atributos** — preenche a ficha técnica a partir do que existe (nunca inventa o que falta).
- **Identificar problemas** — aponta o que impede a publicação (campos obrigatórios, tamanho não normalizado, imagem faltando).
- **Sugerir melhorias** — bullets mais fortes, imagem de capa 1:1, ficha mais completa.

> [!note] Especialista, não chatbot
> A IA do Workspace é **contextual e propositiva**: ela fala sobre **este** produto e sempre oferece **uma ação** ("aplicar", "revisar", "gerar"). Não é uma caixa de perguntas genéricas. Toda saída é **explicável** e **revisável** antes de virar Versão.

---

## 13. Eventos

Enquanto a [Timeline](#11-timeline) é a narrativa cronológica, a seção **Eventos** é a **lista estruturada** de todos os eventos do produto — para auditoria e rastreio precisos.

Cada evento carrega:

| Atributo | Exemplo |
|----------|---------|
| **Evento** | `produto_mestre.atualizado` |
| **Origem** | Qual serviço/ator disparou (Intake, IA, Engine, ERP, operador). |
| **Autor** | Humano ou Agente IA responsável. |
| **Data** | Timestamp. |
| **Resultado** | Sucesso, falha (sanitizada), pendência. |

Princípios: **ordenado cronologicamente**, **correlacionado por `evento_id`**, **auditável** e **sem exposição de segredo** ([008](./008-architecture-compliance.md)/[004](./004-event-bus.md)).

---

## 14. Health Score

O Workspace apresenta o **Health Score do produto** — quão "pronto e saudável" ele está — decomposto em **dimensões** clicáveis, cada uma apontando para a ação corretiva.

| Dimensão | Mede | Exemplo de queda |
|----------|------|------------------|
| **Identidade** | Chaves completas (SKU, EAN, ERP SKU, origem). | Variante sem EAN. |
| **Conteúdo** | Título/descrição/bullets/características completos. | Descrição vazia. |
| **SEO** | Keyword e título otimizados. | Sem keyword principal. |
| **Comercial** | Margem saudável, sem prejuízo. | Produto abaixo da margem. |
| **Marketplaces** | Anúncios ativos e sem erro. | Publicação reprovada. |
| **ERP** | Sincronizado (estoque/custo atuais). | Divergência não reconciliada. |
| **IA** | Enriquecimento concluído sem pendências. | Campos "⚠️ informação necessária". |
| **Publicação** | Pronto para publicar / publicado. | Campos obrigatórios faltando. |

**Exemplo de leitura (um chinelo):**

| Dimensão | Score | Leitura |
|----------|:----:|---------|
| Identidade | 100 | 🟢 Chaves completas |
| Conteúdo | 90 | 🟢 |
| SEO | 70 | 🟡 Sem secundárias |
| Comercial | 48 | 🔴 Abaixo da margem |
| Marketplaces | 60 | 🟠 Erro de SIZE_GRID |
| ERP | 85 | 🟢 |
| **Consolidado** | **72** | 🟡 Atenção: Comercial e Marketplaces |

Princípio: **cada dimensão fraca é clicável** e leva à seção/ação que a resolve (herda a regra do [015](./015-operation-center.md)).

---

## 15. Ações

Todas as ações do produto ficam disponíveis **dentro do Workspace** (barra de ações + ações contextuais por seção):

| Ação | O que faz |
|------|-----------|
| **Editar** | Altera campos da Zion (conteúdo/preço/identidade) — gera [Versão](./001-product-master.md). |
| **Duplicar** | Cria um novo Produto Mestre a partir deste (mantém o que faz sentido; novas chaves). |
| **Arquivar** | Retira o produto da operação ativa (reversível; registrado na Timeline). |
| **Publicar** | Solicita publicação/atualização via [Marketplace Engine](./005-marketplace-engine.md) (assíncrono, idempotente). |
| **Executar IA** | Dispara o especialista do produto ([§12](#12-ia)) para enriquecer/corrigir. |
| **Comparar versões** | Abre o diff entre [Versões](./001-product-master.md) (o que mudou, quem mudou, quando; permite undo). |
| **Reprocessar** | Reenfileira uma operação que falhou (retry seguro, idempotente). |
| **Sincronizar ERP** | Solicita atualização do espelho de estoque/custo (não escreve no ERP). |
| **Abrir Missão** | Cria uma [Missão](./015-operation-center.md) no Centro de Operações a partir do produto. |

Princípios:
- **Ações irreversíveis pedem confirmação** (publicar, arquivar, rejeitar em massa).
- **Toda ação relevante gera evento + Versão** (auditável).
- **Nada de ação sobre dado de que a Zion não é dona** (não se "edita" estoque/custo).

---

## 16. Critérios de Aceite

O Workspace do Produto Mestre está conforme esta visão quando **todos** os critérios abaixo são verdadeiros:

- [ ] **Não é CRUD:** abrir um Produto Mestre abre um ambiente operacional com contexto, inteligência, histórico e ações — não um formulário.
- [ ] **Contexto completo:** identidade, conteúdo, comercial, ERP, marketplaces, IA, versões, timeline e eventos convivem em um único Workspace, sem troca de tela.
- [ ] **Nenhuma informação isolada:** cada dado aparece junto do que lhe dá sentido (preço com margem/custo; anúncio com estado/problemas).
- [ ] **Cabeçalho fixo e acionável:** SKU Origem, EAN, Marca, Fornecedor, Categoria, Modo de Operação, Status, Health Score e última atualização sempre visíveis.
- [ ] **Fronteira de Fonte da Verdade preservada:** ERP (estoque/custo/fiscal) é **somente leitura**; conteúdo/preço são editáveis; estado do anúncio vem do canal.
- [ ] **Inteligência Comercial só apresenta:** lucro/margem/markup/rentabilidade/alertas exibidos sem recálculo local (fonte: Commercial Intelligence *012*).
- [ ] **Variantes comparáveis:** o operador navega, compara e identifica diferenças (estoque/preço) e age em lote quando aplicável.
- [ ] **IA como especialista do produto:** contextual e propositiva (melhorar descrição, criar SEO, corrigir categoria, gerar atributos, identificar problemas), nunca chat genérico, nunca inventando dado, sempre sob aprovação.
- [ ] **Marketplaces por canal:** status, última publicação, última sincronização e problemas, com ação de correção.
- [ ] **Histórico íntegro:** toda alteração gera Versão + evento; Timeline e Eventos refletem a vida real do produto, sem segredos.
- [ ] **Health Score acionável:** as 8 dimensões existem e cada dimensão fraca leva à correção.
- [ ] **Ações completas e seguras:** editar, duplicar, arquivar, publicar, executar IA, comparar versões, reprocessar, sincronizar ERP, abrir Missão — com confirmação para ações irreversíveis.
- [ ] **Multiempresa seguro:** todo o Workspace é escopado por tenant ([RLS deny-by-default](./010-database-compliance.md)); nenhum vazamento entre clientes.
- [ ] **Integração com o Centro de Operações:** uma [Missão](./015-operation-center.md) abre o Workspace no ponto certo, e o Workspace pode abrir novas Missões.

---

> **Status:** `011` — Workspace do Produto Mestre **v1.0 (visão de produto)**. Documento de **produto/UX**, sem implementação. Consome [001 Product Master](./001-product-master.md) e o [015 Operation Center](./015-operation-center.md); a Saúde Comercial depende do **Commercial Intelligence Engine** *(012, planejado)*. Alterações de escopo versionam este documento (v1.1, v2.0…) e nunca contrariam a fronteira de Fonte da Verdade de [000](./000-business-domain.md). **Próximo documento sugerido:** `012 — Commercial Intelligence Engine` (o motor que calcula lucro/margem/markup/piso e emite os sinais que este Workspace e o [015](./015-operation-center.md) apenas apresentam).
