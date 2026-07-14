# System/003 — Design System (Filosófico)

> **A identidade visual permanente da Zion.** Este documento define **como a Zion deve ser percebida visualmente** — não como ela é construída. **Não define** componentes, React, Tailwind, Figma nem tokens (isso é `system/004-design-tokens.md`). Define **significado, percepção e ritmo**.

> [!important] Registro oficial
> **O Design System da Zion existe para reduzir carga cognitiva e transmitir confiança — não para deixar a plataforma bonita. A beleza é consequência da clareza.**

> [!important] As três camadas visuais e suas fronteiras
> - **[UI Composition (001)](./001-ui-composition-system.md) organiza** — onde as coisas ficam.
> - **Design System (003) comunica** — o que as coisas significam e como são percebidas. **Nunca reorganiza.**
> - **[Component Catalog (004)](../blueprints/004-component-catalog.md) define comportamento** — o que cada componente faz.
> - Toda decisão visual **obedece às [Product Laws (002)](./002-product-laws.md)**.

> **Base (contexto, não copiado):** [000 Vision](../000-product-vision.md) · [001 Design Principles](../001-design-principles.md) · [002 Information Architecture](../002-information-architecture.md) · [system/001 UI Composition](./001-ui-composition-system.md) · [system/002 Product Laws](./002-product-laws.md) · [blueprints/004 Catalog](../blueprints/004-component-catalog.md) · arquitetura 000–019.

---

## 1. Objetivo

Definir o **papel do Design System** da Zion: garantir que a plataforma inteira **comunique a mesma identidade** e **reduza o esforço mental** de quem opera — de forma permanente, independente de tela, framework ou moda visual.

> [!important] Comunica, nunca reorganiza
> O Design System **comunica** (significado, hierarquia percebida, ritmo, emoção). Ele **nunca reorganiza** — a posição das coisas é do [UI Composition (001)](./001-ui-composition-system.md). Se uma decisão visual precisa "mover" algo, ela saiu do escopo do Design System.

Ele responde: **Como a Zion deve ser percebida? Como transmitir confiança? Como reduzir esforço mental? Como manter uma identidade visual única?**

---

## 2. Filosofia

1. **A interface deve desaparecer.** Quanto menos o usuário nota a interface, mais ele opera o negócio.
2. **A informação deve aparecer.** O que importa salta; o resto recua.
3. **O usuário deve pensar menos.** Cada decisão que a interface toma por ele é energia devolvida à operação.
4. **O produto deve explicar mais.** Contexto e narrativa, não adivinhação.
5. **A clareza sempre vence a decoração.** Nenhum elemento existe para "enfeitar"; existe para comunicar.

> **A beleza da Zion é a beleza de um cockpit bem projetado: calmo, legível, sem ruído — bonito porque é claro, não claro porque é bonito.**

---

## 3. Personalidade Visual

A Zion deve ser **percebida** como:

| Traço | O que a interface transmite |
|-------|-----------------------------|
| **Confiável** | tudo tem origem e história; nada parece improvisado. |
| **Inteligente** | antecipa, recomenda, explica — sem exibicionismo. |
| **Calma** | silêncio visual; poucas coisas certas, bem-postas. |
| **Organizada** | lugar para cada coisa; ritmo previsível. |
| **Precisa** | mostra confiança do dado; não finge exatidão. |
| **Elegante** | sobriedade; elegância por subtração, não por adorno. |
| **Didática** | ensina enquanto conduz; explica o porquê. |
| **Proativa** | mostra o próximo passo antes de ser pedida. |

Como a Zion **nunca** deve ser percebida:

| ❌ Nunca | Por quê |
|----------|---------|
| **Barulhenta / alarmista** | ansiedade destrói decisão (viola a calma). |
| **Decorada / "cheia"** | ruído aumenta carga cognitiva. |
| **Genérica / sem alma** | perde identidade; parece "mais um sistema". |
| **Impressionante / show-off** | animação e efeito sem propósito distraem do trabalho. |
| **Fria / burocrática** | afasta; a Zion é um copiloto, não um formulário. |
| **Confusa / densa** | esconde a ação; contradiz o propósito. |

---

## 4. Percepção

Cada decisão visual **molda como o usuário se sente e decide**. Relações oficiais:

| Decisão visual | Percepção que gera |
|----------------|--------------------|
| **Organização** | → **confiança** ("alguém pensou nisto; posso confiar"). |
| **Consistência** | → **redução de ansiedade** ("já sei como isto funciona"). |
| **Espaço (respiração)** | → **menos carga cognitiva** ("consigo ler sem esforço"). |
| **Contexto junto do dado** | → **menos erros** ("entendo o que significa antes de agir"). |
| **Hierarquia clara** | → **decisão rápida** ("sei o que fazer primeiro"). |
| **Estados honestos (vazio/erro/precisão)** | → **confiança** ("o sistema não me engana"). |

> [!important] Percepção é função, não estética
> A Zion trata a percepção como uma **ferramenta de operação**: um layout calmo não é "gosto" — é o que permite decidir sob pressão. Toda escolha visual se justifica pelo efeito cognitivo que produz.

---

## 5. Hierarquia Visual

Toda tela deve **comunicar nesta ordem** (o olho encontra nesta sequência):

```
1. O QUE FAZER        → a ação/Missão principal (o mais proeminente)
2. POR QUE FAZER      → o contexto e a justificativa (logo ao lado/abaixo)
3. COMO FAZER         → o caminho da ação (botões, próximos passos)
4. RESULTADO ESPERADO → o impacto/ganho (o que muda ao agir)
```

Isso materializa visualmente a [Hierarquia de Informação do 001](../001-design-principles.md) e a Lei [L01](./002-product-laws.md): o "o quê" **domina** a composição; o "porquê/como/resultado" o **apoiam**, nunca competem. Proeminência visual = prioridade de decisão.

---

## 6. Ritmo da Interface

O **ritmo** é como o olho se move pela tela — controlado por espaço e agrupamento, não por cor.

| Conceito | Significado |
|----------|-------------|
| **Respiração visual** | espaço em volta do que importa; o essencial nunca é sufocado. |
| **Agrupamentos** | coisas relacionadas ficam juntas; o olho entende blocos, não itens soltos. |
| **Pausas** | separação entre blocos dá tempo ao olho; evita "muralha de conteúdo". |
| **Separação** | fronteiras claras entre regiões ([001](./001-ui-composition-system.md)) — o Coach é o Coach, a Timeline é a Timeline. |
| **Sequência** | a ordem de leitura é intencional (hierarquia §5), não acidental. |
| **Densidade máxima** | há um teto de quanto cabe antes de virar ruído; ultrapassá-lo é um defeito (ver [§7](#7-carga-cognitiva)). |

> [!note] Ritmo é o que faz a Zion "respirar"
> Uma tela sem ritmo é uma parede de dados. O ritmo — espaço, blocos, pausas — é o que transforma informação em **leitura fluida**. É a diferença entre um cockpit e uma planilha.

---

## 7. Carga Cognitiva

Cria-se oficialmente o conceito de **Carga Cognitiva** como métrica de design: **quanto esforço mental a tela exige**.

Regras oficiais:
- **Uma decisão por vez.** A tela guia para a próxima escolha, não empilha dez.
- **Uma prioridade máxima.** No máximo um "faça isto primeiro" (Lei de Interface).
- **Até três alertas críticos.** Acima disso, **agrupar** ("8 problemas — ver todos").
- **Informações secundárias recolhidas.** Revelação progressiva; o detalhe vem sob demanda.
- **A interface reduz decisões — nunca as aumenta.** Se uma tela adiciona escolhas em vez de resolvê-las, falhou.

> [!important] Carga cognitiva é um orçamento
> Cada tela tem um **orçamento de atenção** limitado. Gastá-lo com decoração, ruído ou decisões desnecessárias significa não ter atenção para o que importa: a ação. O Design System **protege** esse orçamento.

---

## 8. Linguagem Visual

O Design System **não define cores** (isso é `system/004`). Define **significados** — o que cada elemento **representa** para o usuário, de forma estável em toda a plataforma:

| Elemento | Representa |
|----------|-----------|
| **Health** | **segurança** — "minha operação/produto está bem?" |
| **Precisão** | **confiança** — "posso confiar neste número?" |
| **Timeline** | **memória** — "o que aconteceu / de onde viemos". |
| **Coach** | **orientação** — "a Zion me aponta o caminho". |
| **Missão** | **ação** — "o que eu faço agora". |
| **Analytics** | **entendimento** — "como estou evoluindo". |
| **Origem (badge)** | **procedência** — "de onde vem este dado". |
| **Status** | **situação** — "em que ponto isto está". |
| **Prioridade** | **urgência relativa** — "o que vem primeiro". |

> [!important] Significado antes de cor
> Quando o `system/004` atribuir cores, ele o fará **para reforçar estes significados** — nunca o contrário. A cor de Health serve à ideia de "segurança"; a cor não inventa o significado. E o significado **nunca depende só de cor** (Lei L02/L17): sempre cor **+ texto + ícone**.

---

## 9. Consistência

> [!important] O usuário nunca deve perceber que duas equipes diferentes construíram telas diferentes.

- **Toda tela parece Zion** — mesmas regiões, mesmo ritmo, mesma linguagem visual.
- **Toda interação parece Zion** — o mesmo componente se comporta e se comunica igual em todo lugar.

A consistência é o que transforma dezenas de telas em **um produto**. Ela materializa a Lei [L12](./002-product-laws.md) ("nenhuma tela contradiz outra") e a [L20](./002-product-laws.md) ("nenhuma feature cria nova linguagem"). Inconsistência visual não é "variedade" — é **débito de identidade**.

---

## 10. Emoção

Como o usuário deve **se sentir** em cada momento — a emoção-alvo é sempre **controle e calma**:

| Momento | Emoção-alvo | A interface deve… |
|---------|-------------|-------------------|
| **Operação** (dia a dia) | no controle, produtivo | mostrar poucas coisas certas, priorizadas. |
| **Publicação** | confiante | mostrar progresso e confirmar o resultado. |
| **Erro** | acolhido, não culpado | explicar com calma e oferecer a saída ([L14](./002-product-laws.md)). |
| **Sucesso** | satisfação sóbria | confirmar o impacto sem euforia exagerada. |
| **Aprovação** | seguro | dar contexto suficiente para decidir com tranquilidade. |
| **Implantação** | acompanhado, evoluindo | comemorar marcos; mostrar o próximo passo. |
| **Automação** | tranquilo, informado | tornar visível o que roda sozinho (nunca surpresa). |

> [!important] Nunca gerar ansiedade desnecessária
> Um cockpit que grita perde o piloto. A Zion **reduz a ansiedade**: estados críticos comunicam "já cuidando / aja aqui", nunca pânico. A calma é uma decisão de design, não um acaso.

---

## 11. Evolução

O Design System **cresce por padrões, nunca por exceções**:
- Uma necessidade nova vira um **padrão reutilizável**, não um caso especial numa tela.
- Nenhuma tela "resolve por fora" o que o sistema não cobre — a lacuna é levada ao sistema.
- Cada padrão novo passa pelo teste: *reduz carga cognitiva? reforça a identidade? vale para toda a plataforma?* (espelha os [critérios de nova Lei](./002-product-laws.md)).

> [!note] Exceção é dívida
> Toda exceção visual local é um pequeno rombo na identidade. Repetidas, elas transformam "uma Zion" em "várias telas". O sistema evolui **absorvendo** a necessidade como padrão — não tolerando exceções.

---

## 12. Relação com UI Composition (001)

- **[UI Composition (001)](./001-ui-composition-system.md) organiza** — decide **onde** cada componente fica (regiões, layouts, posições).
- **Design System (003) comunica** — decide **como** cada coisa é percebida (hierarquia visual, ritmo, significado, emoção).

Fronteira: se a pergunta é "onde isto fica?", é do 001. Se é "o que isto comunica / como é lido?", é do 003. O 003 **nunca** move o que o 001 posicionou.

---

## 13. Relação com Component Catalog (004)

- **[Component Catalog (004)](../blueprints/004-component-catalog.md) define comportamento** — o que cada componente faz, seus estados, eventos, variações.
- **Design System (003) define aparência** — como esse comportamento é **percebido**.

Fronteira: o 004 diz "`HealthCard` tem estado `CRITICAL`"; o 003 diz "o estado crítico **comunica** urgência com calma (cor+ícone+texto)". Um define a máquina; o outro, a percepção.

---

## 14. Relação com Product Laws (002)

**Nenhuma decisão visual pode violar uma [Product Law (002)](./002-product-laws.md).** As Leis são a autoridade máxima; o Design System **obedece**. Exemplos:
- Cor sozinha nunca carrega significado → **L02** (contexto) e **acessibilidade**.
- Precisão sempre visível → **L17**.
- Estados honestos (vazio/erro) → **L05/L14**.
- Nada que sugira vigilância → **L15**.

Em conflito entre uma escolha visual e uma Lei, **a Lei vence** — sempre.

---

## 15. Checklist (toda decisão visual)

```
□ Reduz carga cognitiva (ou pelo menos não aumenta)?
□ Comunica um significado claro (ou é decoração a ser removida)?
□ Respeita a hierarquia visual (o quê → por quê → como → resultado)?
□ Tem respiração/ritmo (não é muralha de conteúdo)?
□ Uma prioridade máxima; ≤3 alertas críticos?
□ Significado nunca depende só de cor (cor+texto+ícone)?
□ Precisão e origem visíveis onde há número/dado derivado?
□ Parece Zion (mesma linguagem/ritmo das outras telas)?
□ A emoção-alvo é calma/controle (nunca ansiedade desnecessária)?
□ Não reorganiza (respeita o UI Composition 001)?
□ Não viola nenhuma Product Law (002)?
□ A beleza vem da clareza (não de adorno)?
```

---

## 16. Critérios de Aceite

- [ ] **Reduz carga cognitiva** — a tela exige o mínimo de esforço para decidir.
- [ ] **Comunica, não decora** — nenhum elemento puramente decorativo.
- [ ] **Hierarquia visual** (o quê→por quê→como→resultado) evidente.
- [ ] **Ritmo/respiração** presentes; densidade sob controle.
- [ ] **Significado estável** — Health/Precisão/Timeline/Coach/Missão/Analytics comunicam o mesmo em toda a plataforma.
- [ ] **Nunca só cor** — significado sempre reforçado por texto+ícone.
- [ ] **Consistência total** — impossível notar "equipes diferentes".
- [ ] **Emoção-alvo calma/controle** em todos os momentos (§10).
- [ ] **Fronteiras respeitadas** — não reorganiza (001), não redefine comportamento (004), não viola Lei (002).
- [ ] **Sem tokens/cor/px/código** definidos aqui (é do `system/004`).
- [ ] **Checklist (§15)** 100% satisfeito.

---

## Seção especial — Carga Cognitiva (por contexto)

Orçamento de atenção por tela — quando está saudável e quando virou defeito:

| Contexto | Carga aceitável | Carga crítica (defeito) | Ação recomendada |
|----------|-----------------|-------------------------|------------------|
| **Dashboard/Cockpit** | 3 Missões no topo + Health + Coach + filas resumidas | >5 prioridades disputando; múltiplos alertas gritando | mostrar top-3 + "ver todas"; agrupar alertas; recolher o secundário |
| **Workspace** | seções do produto reveladas progressivamente; Coach ao lado | todas as seções abertas e densas ao mesmo tempo | revelação progressiva; destacar só a seção da Missão atual |
| **Portal** | Minha Empresa + pendências + resultados em narrativa | tabelas/BIs crus; jargão técnico | narrativa de negócio; recolher detalhe; linguagem simples |
| **Analytics** | 1 pergunta por vez, com comparação | painel-mural de dezenas de gráficos | master–detail; uma visão explicada por vez |
| **Configurações** | formulário curto, uma seção por vez | dezenas de campos numa tela só | agrupar, passo a passo (wizard), padrões sensatos |

> [!important] Regra do orçamento
> Se um contexto ultrapassa a "carga crítica", a solução **nunca** é "fazer caber com fontes menores" — é **reduzir decisões**: agrupar, recolher, priorizar, revelar sob demanda.

---

## Seção especial — Os Sentimentos da Zion

Como o usuário deve **se sentir** em cada momento marcante:

| Momento | Sentimento-alvo |
|---------|-----------------|
| **Receber uma Missão** | *"sei exatamente o que fazer agora"* — clareza, não sobrecarga. |
| **Resolver uma Missão** | *"avancei; valeu a pena"* — progresso tangível, impacto visível. |
| **Publicar um produto** | *"está no ar, e deu certo"* — confiança confirmada. |
| **Receber uma recomendação** | *"a Zion pensou comigo"* — apoio, não imposição. |
| **Concluir uma implantação** | *"minha empresa evoluiu de patamar"* — orgulho sóbrio, próximo passo à vista. |
| **Ver o Health melhorar** | *"estou no caminho certo"* — recompensa calma, motivação. |
| **Encontrar um erro** | *"tem solução, e não é culpa minha"* — acolhimento, saída clara. |

> [!important] O sentimento fundamental é **calma**
> Acima de tudo, a Zion entrega a sensação de que **a operação está sob controle**. Não é ausência de trabalho — é trabalho **sem angústia**. Esse é o sentimento que fideliza: quem usa a Zion se sente mais capaz e menos ansioso do que sozinho.

---

## Seção especial — Notas para Design

Recomendações **inegociáveis**:

1. **Nunca criar elementos apenas decorativos.** Todo pixel comunica algo ou é removido.
2. **Nunca usar animação para chamar atenção sem propósito.** Movimento só para comunicar mudança de estado, nunca para "impressionar".
3. **Nunca competir visualmente com a Missão principal.** Nada ofusca o "o que fazer agora".
4. **Sempre priorizar a leitura.** Legibilidade acima de estilo; o texto é a ação.
5. **Sempre reduzir esforço mental.** Diante de duas soluções, escolher a que faz o usuário pensar menos.
6. **Significado nunca depende só de cor.** Sempre cor + texto + ícone (acessibilidade + [Product Laws](./002-product-laws.md)).
7. **Espaço é uma ferramenta, não desperdício.** Respiração reduz carga; horror ao vazio é um antipadrão.
8. **A calma é o padrão.** Estados críticos comunicam ação, nunca pânico.

---

> **Registro oficial:** **O Design System da Zion existe para reduzir carga cognitiva e transmitir confiança — não para deixar a plataforma bonita. A beleza é consequência da clareza. O UI Composition organiza; o Design System comunica; nunca reorganiza.**

> **Status:** `system/003` — Design System (Filosófico) **v1.0**. Define **percepção, significado, ritmo e emoção** — a identidade visual permanente da Zion. Obedece às [Product Laws (002)](./002-product-laws.md); comunica o que o [UI Composition (001)](./001-ui-composition-system.md) organiza e o [Catalog (004)](../blueprints/004-component-catalog.md) faz. **Próximo documento sugerido:** `docs/product/system/004-design-tokens.md` (os **tokens** — a materialização mensurável desta filosofia: a paleta que reforça os significados (Health=segurança, Precisão=confiança…), a escala tipográfica e de espaçamento que cria o ritmo, os níveis de elevação, os estados visuais canônicos e a expressão acessível de Health/Precisão/Prioridade em cor+texto+ícone; onde este documento diz *o que comunicar*, o `004` dirá *com quais valores* — sempre a serviço da clareza, nunca da decoração).
