# 001 — Design Principles

> **A Constituição da Experiência da Zion Platform.** Este documento **não define estética** (cores, fontes, espaçamentos) — define **como a Zion deve ser construída** para que **toda tela pareça pertencer ao mesmo produto**, independentemente do módulo. É a lei da experiência: **todo designer, todo desenvolvedor, todo Product Manager e toda IA** a seguem.

> **Relação com a visão.** Este documento traduz a [Product Vision (product/000)](./000-product-vision.md) em **regras concretas de interface e interação**. A arquitetura funcional (`architecture/` 000–019) é lida como contexto e **não é copiada**.

> [!important] Princípio máximo
> **Toda tela da Zion deve responder uma única pergunta: "O que preciso fazer agora?"** Este é o princípio supremo da experiência. Em qualquer conflito de design, ele prevalece.

---

## 1. Objetivo

Definir oficialmente os **Design Principles da Zion** — o conjunto de regras que garante **consistência, clareza e foco na ação** em toda a plataforma.

> [!important] Prioridade sobre decisões individuais
> Estes princípios têm **prioridade sobre qualquer decisão isolada de interface**. Nenhuma tela, componente ou fluxo pode contrariá-los "porque neste caso específico ficaria melhor". Quando um princípio e uma preferência individual colidem, **o princípio vence** — e a exceção precisa ser justificada e aprovada como evolução deste documento.

---

## 2. Filosofia

A experiência da Zion parte de uma convicção: **o trabalho do usuário é operar o negócio, não operar o software.**

1. **A interface deve reduzir esforço.** Cada clique economizado é tempo devolvido à operação.
2. **A plataforma deve ensinar.** Enquanto conduz, ela explica — o usuário fica mais capaz a cada uso.
3. **A IA deve orientar.** A inteligência aponta o próximo passo; não espera ser perguntada.
4. **A operação deve ser intuitiva.** O caminho certo deve ser o caminho óbvio.
5. **A simplicidade deve esconder a complexidade.** Por baixo há engenharia sofisticada; por cima, fluidez.

Em uma frase: **a Zion carrega a complexidade para que o humano carregue a decisão.**

---

## 3. Princípios Fundamentais

Os princípios oficiais que regem **toda** interface da Zion:

1. **Toda tela responde "o que devo fazer agora?".**
2. **Toda informação possui contexto** (nunca um dado solto).
3. **Toda recomendação gera uma ação** (recomendar sem agir é ruído).
4. **Toda ação possui impacto visível** (o usuário vê o efeito do que faz).
5. **Nenhum dado aparece isolado** — sempre acompanhado do que lhe dá sentido.
6. **A IA nunca interrompe; a IA acompanha** — presente e opcional, jamais um obstáculo.
7. **O usuário permanece no controle** — a plataforma sugere; o humano decide.
8. **A complexidade fica escondida** — o essencial na frente, as engrenagens invisíveis.

---

## 4. Hierarquia da Informação

Toda tela organiza-se numa **ordem de prioridade fixa** — do que o usuário mais precisa ao que menos precisa:

```
1. Objetivo principal   → o que esta tela serve para resolver
2. Ação principal       → o que fazer agora (o botão/decisão central)
3. Contexto             → o que dá sentido à ação (comparação, estado)
4. Indicadores          → os sinais de apoio (Health, Precisão, tendências)
5. Detalhes             → o aprofundamento sob demanda
6. Histórico            → de onde veio (Timeline, versões)
```

**Por que essa ordem reduz carga cognitiva:** o cérebro do usuário encontra **primeiro** o que decidir e **depois** o porquê — sem varrer a tela procurando o que importa. A ação nunca fica soterrada por detalhes; o histórico nunca compete com a decisão. Cada nível é **revelado quando necessário** (ver [§12](#12-densidade-de-informação)), não empilhado de uma vez.

---

## 5. Contexto

> [!important] Nenhuma métrica pode aparecer sem contexto.

Um número sozinho não informa — ele **decora**. Todo indicador vem com **referencial** (comparação, tendência, meta).

**Antes:**
```
Margem  18%
```

**Depois:**
```
Margem
18%  ↑ +2%
Últimos 30 dias · Acima da meta
```

O "depois" responde três perguntas que o "antes" ignora: **está subindo ou caindo?**, **em relação a quando?**, **é bom ou ruim?**. Sem essas respostas, o usuário não sabe se deve agir — e uma tela que não ajuda a decidir falhou no princípio máximo.

---

## 6. Narrativas

> [!important] A Zion nunca mostra apenas números. Ela conta histórias.

Onde um sistema comum mostra um gráfico, a Zion **explica a causa**:

> *"A margem aumentou porque o custo logístico caiu após a renegociação de frete."*

A narrativa transforma **dado** em **entendimento**. O usuário não precisa interpretar a planilha — a Zion já interpretou e conta o que aconteceu, por quê e o que fazer a seguir. **Contexto ([§5](#5-contexto)) responde "o quê"; narrativa responde "por quê".** Toda visualização importante deve poder ser lida em uma frase.

---

## 7. IA na Interface

A IA da Zion aparece como **copiloto contextual**, nunca como um chatbot que toma a tela.

Regras de como a IA se apresenta:
- **Nunca como chatbot** — não é uma caixa de perguntas genéricas.
- **Nunca ocupando toda a tela** — vive ao lado do trabalho, não no lugar dele.
- **Sempre contextual** — fala sobre *o que está na tela agora*.
- **Sempre explicável** — toda fala tem um "por quê" acessível.
- **Sempre opcional** — o usuário pode seguir sem ela; ela não bloqueia.
- **Sempre próxima da ação** — a recomendação vem com o botão de agir ao lado.

**Exemplos:**
- No produto: um selo discreto *"IA: título pode melhorar para busca — **aplicar sugestão**"*.
- No preço: *"IA: 4% abaixo do piso após o custo subir — **revisar preço**"*.
- No cockpit: *"IA: 42 produtos prontos sem pendência — **aprovar em massa**"*.

Em todos, a IA **sugere e explica ao lado da ação** — nunca interrompe, nunca obriga.

---

## 8. Estados

Toda tela/componente reconhece **estados oficiais** com comportamento previsível:

| Estado | Comportamento esperado |
|--------|------------------------|
| **Sem dados** | Explica o vazio e oferece o primeiro passo ("Nenhum produto ainda — **importar catálogo**"). Vazio nunca é uma tela morta. |
| **Carregando** | Indica progresso sem travar; nunca deixa o usuário no escuro. |
| **Processando** | Mostra que algo está acontecendo (ex.: publicação na fila) e permite acompanhar. |
| **Erro** | Explica o que houve, sem culpar, e oferece solução ([§16](#16-erros)). |
| **Concluído** | Confirma o resultado e aponta o próximo passo. |
| **Recomendação** | A IA sugere uma ação, com justificativa e botão de agir. |
| **Missão** | Um trabalho priorizado, com impacto e ganho, pronto para conduzir. |

Princípio: **nenhum estado é um beco sem saída** — todos apontam para frente.

---

## 9. Feedback

A interface **sempre responde**:
- **Toda ação gera resposta** — clicou, algo visível acontece (confirmação, progresso, resultado).
- **Toda automação é visível** — o que roda sozinho aparece (o usuário nunca é surpreendido por algo que "aconteceu no escuro").
- **Toda IA explica o que fez** — não só o que sugere, mas o que executou (com o "por quê").
- **Toda execução pode ser acompanhada** — filas, Workflows e publicações têm estado observável.

Princípio: silêncio é falha. Se o usuário não sabe se algo funcionou, a interface não terminou o trabalho.

---

## 10. Consistência

Os mesmos conceitos se apresentam **do mesmo jeito em toda a plataforma**:

| Conceito | Regra de consistência |
|----------|-----------------------|
| **Health** | Mesma escala, mesmas cores (🟢🟡🔴), mesma leitura de "dimensão fraca → ação", em todo lugar. |
| **Precisão** | Sempre representada igual (alta/média/baixa), sempre ligada à confiança do número. |
| **Missões** | Sempre com impacto, ganho, tempo e próximo passo — no mesmo formato. |
| **Timeline** | Sempre cronológica, filtrável, com o mesmo padrão de evento. |
| **Analytics** | Sempre com comparação/contexto; nunca número absoluto solto. |

**Por que consistência reduz a curva de aprendizado:** aprendido uma vez, reconhecido em todo lugar. O usuário não "reaprende" o Health a cada módulo — ele lê a Zion como um **idioma único**. Inconsistência força reaprendizado e quebra a sensação de "uma única plataforma" ([000](./000-product-vision.md)).

---

## 11. Navegação

1. **Nunca mais de um caminho principal.** Cada objetivo tem **uma** rota óbvia; alternativas são atalhos, não concorrentes.
2. **Nunca criar becos sem saída.** Toda tela oferece o próximo passo ou o retorno.
3. **Toda tela tem retorno natural.** O usuário sempre sabe como voltar de onde veio.
4. **Toda ação importante fica a poucos cliques.** Do cockpit à execução, o caminho é curto.

Princípio: navegar na Zion deve ser como andar por um corredor bem sinalizado — nunca um labirinto.

---

## 12. Densidade de Informação

O equilíbrio entre "vazio demais" e "cheio demais" é resolvido por **revelação progressiva**:
- **Evitar telas vazias** — o espaço em branco deve orientar ("comece por aqui"), não abandonar.
- **Evitar excesso** — nem tudo aparece de uma vez; o secundário fica a um clique.
- **Revelação progressiva** — mostra o essencial; aprofunda sob demanda (expandir, "ver detalhes").
- **Mostrar apenas o necessário** — para *esta* decisão, *neste* momento.

Princípio: a tela carrega **o que a decisão exige** — nem menos (o usuário fica cego), nem mais (o usuário se perde).

---

## 13. Linguagem

O tom oficial da Zion: **didático, direto, calmo e profissional.** Nunca **agressivo**, nunca **alarmista**, nunca **técnico sem necessidade**.

**Exemplos de microcopy:**

| Situação | ❌ Evitar | ✅ Zion |
|----------|-----------|---------|
| Sem produtos | "Nenhum registro encontrado." | "Você ainda não tem produtos. Vamos importar seu primeiro catálogo?" |
| Custo faltando | "NULL cost value." | "Falta o custo deste produto para calcular sua margem. **Informar custo**" |
| Erro de publicação | "Error 400: invalid SIZE_GRID." | "A publicação falhou porque os tamanhos precisam ser normalizados. **Corrigir e republicar**" |
| Margem baixa | "ALERTA! PREJUÍZO!" | "Este produto está vendendo abaixo da margem mínima. **Revisar preço**" |
| Sucesso | "OK." | "Pronto — 42 produtos publicados no Mercado Livre." |

Princípio: a Zion fala como um **colega sênior que quer te ajudar**, não como um sistema que reporta erros.

---

## 14. Acessibilidade

Regras não-negociáveis:
- **Contraste** suficiente para leitura confortável (texto e estados de cor).
- **Navegação por teclado** completa — nada depende exclusivamente do mouse.
- **Leitura clara** — tipografia legível, hierarquia evidente.
- **Estados compreensíveis** — cada estado é percebível por quem usa leitor de tela.
- **Ícones nunca substituem texto** — um ícone acompanha rótulo; cor nunca é o único portador de significado (🟢🟡🔴 sempre com texto).

Princípio: acessível não é um extra — é parte de "toda informação possui contexto".

---

## 15. Princípios da IA

Toda **recomendação** da IA responde, de forma acessível, cinco perguntas:

| Pergunta | O que a IA mostra |
|----------|-------------------|
| **Por quê?** | O motivo/raciocínio da recomendação. |
| **Qual benefício?** | O ganho esperado (ex.: "+2% de margem"). |
| **Qual impacto?** | O que muda ao seguir. |
| **Qual confiança?** | A precisão do dado que a sustenta (alta/média/baixa). |
| **Como desfazer?** | A reversibilidade — o usuário sabe que pode voltar atrás. |

Princípio: uma recomendação sem essas cinco respostas **não é uma recomendação** — é um palpite, e a Zion não dá palpites.

---

## 16. Erros

Quando algo falha, a Zion:
1. **Nunca culpa o usuário.** O tom é "vamos resolver", não "você errou".
2. **Sempre explica.** Diz o que aconteceu, em linguagem humana.
3. **Sempre oferece solução.** Um caminho concreto para sair do erro.
4. **Sempre mostra o próximo passo.** O erro não é um beco — é um desvio com saída.

**Exemplo:**
> ❌ *"Falha ao sincronizar. Código 503."*
> ✅ *"Não conseguimos falar com o Mercado Livre agora (instabilidade do canal). Já vamos tentar de novo automaticamente — você não precisa fazer nada. **Ver detalhes**"*

---

## 17. Emoção

Como a Zion deve fazer o usuário **se sentir**:

- **No controle** — ele comanda; a plataforma obedece e sugere.
- **Seguro** — nada destrutivo acontece por acidente; tudo é reversível ou avisado.
- **Produtivo** — ele termina o dia sentindo que **avançou**, não que lutou com o sistema.
- **Inteligente** — a Zion o faz parecer (e ser) mais capaz do que sozinho.
- **Confiante** — ele confia nos números porque sabe de onde vêm.

Princípio: a melhor emoção que a Zion entrega é **calma** — a sensação de que a operação está sob controle.

---

## 18. Critérios de Aceite

Uma tela da Zion está conforme estes princípios quando **todos** os critérios abaixo são verdadeiros:

- [ ] **Responde "o que fazer agora?":** há uma ação principal clara.
- [ ] **Contexto em toda métrica:** nenhum número aparece sem comparação/tendência/significado.
- [ ] **Narrativa presente:** os dados importantes são explicados em linguagem humana.
- [ ] **Recomendação → ação:** toda sugestão da IA vem com o botão de agir e o "por quê".
- [ ] **IA contextual e opcional:** presente ao lado da ação, nunca como chatbot nem bloqueando.
- [ ] **Estados tratados:** sem-dados/carregando/processando/erro/concluído/recomendação/missão têm comportamento previsível e sem beco sem saída.
- [ ] **Feedback sempre:** toda ação/automação/execução é visível e acompanhável.
- [ ] **Consistência:** Health/Precisão/Missões/Timeline/Analytics aparecem no padrão único.
- [ ] **Hierarquia respeitada:** objetivo → ação → contexto → indicadores → detalhes → histórico.
- [ ] **Navegação clara:** um caminho principal, retorno natural, sem becos.
- [ ] **Densidade equilibrada:** revelação progressiva; nem vazio nem sobrecarregado.
- [ ] **Linguagem no tom:** didática, calma, sem alarmismo nem tecnês.
- [ ] **Acessível:** contraste, teclado, texto+ícone, cor nunca sozinha.
- [ ] **Erros humanos:** explicam, não culpam, oferecem solução e próximo passo.
- [ ] **Recomendação da IA completa:** por quê / benefício / impacto / confiança / como desfazer.

---

## Seção especial — Antes e Depois

Exemplos que traduzem os princípios em prática.

**1. Número isolado → Número com contexto, tendência e ação**
```
❌ Antes:  Margem 18%

✅ Depois: Margem  18%  ↑ +2% (30 dias) · Acima da meta
          "Subiu após reduzir o custo logístico."  [ Revisar preços ]
```

**2. Erro técnico → Erro explicado com solução**
```
❌ Antes:  Error 400: invalid SIZE_GRID.

✅ Depois: "A publicação falhou porque os tamanhos deste calçado
          precisam ser normalizados antes de ir ao ar."
          [ Normalizar e republicar ]   [ Ver detalhes ]
```

**3. Gráfico → Narrativa + gráfico**
```
❌ Antes:  [gráfico de linha da margem, sem legenda de causa]

✅ Depois: "Nos últimos 30 dias sua margem subiu de 16% para 18%,
          principalmente porque 12 produtos abaixo do piso foram
          reprecificados."
          [gráfico de linha]   [ Ver produtos reprecificados ]
```

**4. Dado bruto → Recomendação acionável**
```
❌ Antes:  Estoque ERP: 3 divergências

✅ Depois: "3 produtos têm estoque diferente entre ERP e Zion há 2 dias —
          risco de vender o que não tem."  (confiança: alta)
          [ Reconciliar agora ]   [ Por quê? ]
```

---

## Seção especial — Checklist de UX

Checklist **oficial** que toda nova tela da Zion deve passar antes de ir ao ar:

```
□ Existe uma ação principal clara?
□ Existe contexto em cada métrica (comparação/tendência/meta)?
□ Existe recomendação da IA quando há trabalho?
□ Existe narrativa (o dado é explicado em uma frase)?
□ Existe histórico acessível (de onde veio)?
□ Existe feedback para toda ação/automação?
□ Existe um próximo passo (nenhum beco sem saída)?
□ Existe consistência com as outras telas (Health/Precisão/Missões/Timeline/Analytics)?
□ Os estados (vazio/carregando/erro/concluído) estão tratados?
□ A linguagem está no tom (calma, didática, sem alarmismo)?
□ É acessível (contraste, teclado, texto+ícone)?
□ A tela responde "O que preciso fazer agora?"
```

> [!important] Regra de ouro do checklist
> Se a última caixa não puder ser marcada — **a tela responde "o que preciso fazer agora?"** — a tela **não está pronta**, por mais bonita ou completa que pareça.

---

> **Registro oficial:** **Toda tela da Zion deve responder uma única pergunta — "O que preciso fazer agora?". Esse é o princípio máximo da experiência da plataforma.**

> **Status:** `product/001` — Design Principles **v1.0**. Constituição da experiência: tem **prioridade sobre decisões individuais** de interface. Traduz a [Product Vision (product/000)](./000-product-vision.md) em regras; a arquitetura funcional (`architecture/` 000–019) permanece o *como funciona*. **Próximo documento sugerido:** `product/002-information-architecture.md` (a arquitetura de informação da Zion: como os pilares viram navegação e telas — a estrutura de áreas/seções, o mapa de navegação, onde cada conceito vive, como o usuário circula entre Centro de Operações, Workspace, Analytics e Maturidade — a ponte entre estes princípios e o desenho concreto das telas).
