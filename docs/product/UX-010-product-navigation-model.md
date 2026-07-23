# UX-010 — Product Navigation Model

> A Arquitetura Permanente da Experiência — como um ser humano percorre a Zion.
> Não desenha telas; define como o usuário existe dentro do sistema. Fontes:
> CONST-001 · Ontology (system/000) · Product Laws (system/002) · SHELL-001/002
> · CMP-001 · CAP-000 · DS-Foundation/Values/Semantic (003/004/005).

**Nota de fontes e reconciliação:** a lista obrigatória exclui UX-003 e UI-001,
que já fixaram muito desta navegação. Derivo do Shell + Mission + Capability +
Constitution e permaneço **consistente com** UX-003/UI-001 — este documento é o
modelo de navegação que aqueles pressupõem, não um paralelo. Onde uma decisão
exigiria UX-003/UI-001 diretamente, cito CONST-001 (que os embute) e registro a
dependência (Lacunas).

---

## Parte 1 · Modelo mental

A Zion é um **sistema operacional para operações comerciais** — não um
dashboard (que se contempla), não um ERP (que se navega por substantivos), não
um chat (que espera comando), não um copiloto (que acompanha passivo). Um SO:
suas "processos" são **Capabilities** (trabalham invisíveis — CAP-000 L2/Lei 2),
seus "prompts ao usuário" são **Missões** (CMP-001), sua "área de trabalho" é o
**palco** (SHELL-001). O usuário não *opera ferramentas* — ele **habita uma
operação que roda sozinha e pede decisões**. `[CONST-001 §Identidade · Manifesto]`

## Parte 2 · Unidade fundamental

Há duas, ortogonais — e confundi-las é o erro clássico:
- **Unidade de navegação = o Contexto** (uma Operação enquadrada pela Lente — "de
  qual loja falamos"). É o "onde estou". `[SHELL-001 §6 · CAP-000]`
- **Unidade de trabalho = a Missão.** É o "o que decido agora". `[CMP-001]`

Nem Workspace, nem Conversation, nem Produto isolado: o usuário existe **numa
Operação, decidindo por Missões.** Produto/Marketplace/Catálogo são objetos
*dentro* do Contexto, nunca a unidade que o organiza.

## Parte 3 · Contextos permanentes

Os cinco, herdados do Shell/Constituição — mapeados aos exemplos da missão:

| Contexto (área) | Responde | Absorve os exemplos |
|---|---|---|
| **Hoje** | "o que importa agora?" | Home |
| **Catálogo** | "o que sabemos dos produtos?" | Catalog |
| **Anúncios** | "como dizemos e prometemos?" | Marketplace/Operations |
| **Pulso** | "como está a loja?" | (a leitura calma) |
| **Zion** | "o que você fez / combinamos / percebeu?" | Conversation · **Memory** · **Agreements** · (Settings) |

**Não há "Settings" como contexto** — a única "configuração" são os Combinados
(Agreements), que vivem em Zion e nascem de conversa, nunca de painel `[PX-004
P8, via CONST]`. **Memory e Agreements não são contextos próprios** — são vistas
dentro de Zion (a área da relação). Nenhum contexto depende de implementação.

## Parte 4 · Estrutura de navegação

```
Root (a Operação enquadrada pela Lente)
 └─ Contexto (uma das 5 áreas)
     └─ Conteúdo (os objetos daquela área: Produto, Anúncio, Combinado…)
         └─ Mission (sobrepõe qualquer nível; devolve ao ponto exato)
```

O eixo horizontal (trocar de área) e o vertical (a Missão desce/sobe) são
ortogonais — exatamente o Shell. A Missão pode nascer sobre **qualquer** nível e
devolver a ele. `[SHELL-001 §5/§4]`

## Parte 5 · Responsabilidades do Shell

**Navigation:** a moldura imóvel — as 5 áreas + a Lente; troca conteúdo do
palco, nunca recarrega o frame. **Stage:** hospeda exatamente um Contexto por
vez; preserva a rolagem (para a Missão devolver ao ponto). **Mission Layer:** a
única sobreposição; uma Missão viva por vez. **Notifications:** **não existem
como objeto de UI** — a Zion fala pela Conversa (Resumo + 4 Motivos), nunca por
sino `[PX-003 · SYS-001 P11]`. **Feedback:** estados comunicados por palavra e
posição (Parte 12), nunca por cor-pânico. `[SHELL-001 §2]`

## Parte 6 · Missões na navegação

**Quando:** quando uma Capability precisa de uma Decisão (CAP-000 Parte 11) ou
os 4 Motivos disparam. **Onde:** sobrepõem o palco atual (Mission Layer),
qualquer que seja o contexto. **Como interrompem:** *convidam*, não sequestram
(Lei 3) — o palco permanece atrás, intacto; "agora não" devolve tudo igual.
**Como desaparecem:** no desfecho (devolve ao ponto) ou encadeiam a próxima.
**Retomam trabalho:** a Missão dispensada volta à Fila; nada se perde (Lei 4).
**Convivem com navegação:** o usuário pode trocar de área com uma Missão aberta?
**Não** — uma decisão por vez; abrir área não fecha a Missão à força, mas a
Missão é a camada superior. *(Reconciliação: consistente com CMP-001 "uma por
vez".)*

## Parte 7 · Capabilities (invisíveis)

O usuário **nunca vê uma Capability** (Lei 2 · CAP-000). Ele vê só os quatro
efeitos: **Resultados** (o palco atualizado — "93 no ar"), **Sugestões** (no
contexto da decisão, com "por quê? →"), **Missões** (o pedido de decisão),
**Progresso** (a narrativa honesta — "47 de 93"). Uma Capability rodando é
silêncio; uma Capability concluída é um Resultado + um Registro no Diário. Que
uma competência "existe" jamais aparece — só o que ela produz. `[CAP-000 Lei 2 ·
PX-003 §5]`

## Parte 8 · Memory

**Como aparece:** como *percepção* ("percebi que…") na Conversa, e como *fatos
com origem* dentro dos objetos (o "quem disse isso?" de cada alegação).
**Quando:** sob demanda (o usuário abre um Produto e vê a verdade + origem) ou
quando a Zion colhe (a frase de percepção). **Consulta:** navegando o objeto
(Produto→verdade) ou a área Zion (o Diário). **Edita:** o usuário nunca "edita
memória" — ele **retifica a verdade** (uma nova alegação supera a anterior, com
história — CONST L4). **Entende:** porque toda memória tem origem e história
legíveis (L2/L12). *A palavra "Memory" nunca aparece — aparece "o que sabemos".*

## Parte 9 · Agreements

**Como aparecem:** como **proposta merecida** na Conversa ("posso cuidar disso?
47 aprovações, você desfaz quando quiser"). **Aceitos:** com um toque, sob a
fórmula evidência+consentimento+volta (CONST L12). **Revisados/alterados:** na
vista Combinados (área Zion) — escopo ajustável. **Alterados:** ajuste = novo
fato (append-only). **Históricos:** nunca somem; a cadeia de concessão/revogação
permanece (CAP-000 Parte 13). **Prevalecem** sempre (Lei 8): onde há Agreement
vigente, a Zion executa sem perguntar; onde não há, cria Missão. *A palavra
"Agreement" nunca aparece — aparece "Combinado".*

## Parte 10 · Taxonomia de navegação

| Tipo | O quê | Regra |
|---|---|---|
| **Global** | as 5 áreas + a Lente | sempre presente; troca de Contexto |
| **Context** | dentro de uma área (lista→detalhe) | escava no próprio palco, não sai da área |
| **Local** | dentro de um objeto/Missão | ações do próprio card |
| **Temporary** | a Missão (Mission Layer) | sobe, decide, devolve ao ponto exato |
| **Back** | volta ao Hoje, ou ao ponto de origem exato | nunca reinicia trabalho (Lei 4) |
| **Forward** | **não existe como "avançar de browser"** | o "para frente" é o encadeamento de Missões |
| **Deep Links** | resolvem a um **Contexto + objeto**, restaurando a Lente | nunca a um "estado de página"; preservam contexto (Lei 4) |

## Parte 11 · Estado (como o usuário entende o mundo)

**Onde está:** a moldura sempre mostra a área ativa + a Lente (Lei 10 — nunca
precisa descobrir). **O que acontece:** a frase de Estado no Hoje ("saudável,
291 no ar"). **Quem trabalha:** ninguém *aparece* trabalhando (Capabilities
invisíveis) — o trabalho aparece como Resultado. **O que falta:** a Fila (as
Missões) + as Lacunas (âmbar) nos objetos. **O que terminou:** o desfecho da
Missão + o Diário. Tudo isto sem um único indicador numérico solto (L5: nada
"solto"; SYS-001 P11: zero badges).

## Parte 12 · Feedback (mapeado ao ciclo da Capability → língua do usuário)

| Estado técnico (CAP-000/CMP) | O usuário vê |
|---|---|
| **Loading** | "preparando — eu chamo" (frase honesta, sem spinner) `[PX-002]` |
| **Waiting** (por decisão) | a Missão na Fila / "aguardando você" |
| **Waiting** (por terceiro) | "aguardando o fornecedor" — sem cobrar o usuário |
| **Running** | **silêncio** — a Capability trabalha invisível (Lei 2) |
| **Paused** (Agreement revogado / Missão dispensada) | some sem culpa; volta à Fila |
| **Completed** | o desfecho + o Registro no Diário |
| **Failed** | a prestação de contas em 4 frases (1ª pessoa, dano, correção, mudança) `[PX-003 §8]` |
| **Blocked** | um **Gap** vira Missão: "faltou X — sem isto o ML não aceita" `[L3]` |

## Parte 13 · Interrupções sem quebrar o fluxo

**Missões:** sobrepõem, devolvem (Lei 3). **Erros:** viram prestação de contas
(Failed), nunca modal de pânico. **Conflitos** (duas fontes divergem): viram
Missão de arbitragem (a decisão humana de L-arbitragem), no topo se travam.
**Novos eventos:** entram na Fila por importância (Parte E8 do priorizador),
nunca furam a atenção salvo os 4 Motivos. **Atualizações:** a frase de Estado se
atualiza sozinha; o palco não "pisca". `[SHELL-001 §8 S9]`

## Parte 14 · Multi-contexto

Alternar entre empresas/marketplaces/catálogos/operações é **a Lente
re-enquadrando o Contexto inteiro** — não abrir uma segunda visão (Lei 4:
preserva contexto; SHELL-001 §6: nunca 2ª coluna). Trocar a Lente troca *tudo*
(a Operação enquadrada), com a fila e o estado daquela Operação; voltar traz o
contexto anterior intacto. Marketplaces e catálogos **não são Lentes** — são
objetos/filtros *dentro* de uma Operação; só a Operação (empresa) é enquadrada
pela Lente. `[SHELL-001 §6, via reconciliação]`

## Parte 15 · Descoberta

Novos recursos aparecem **como Missões e Percepções, no contexto do trabalho** —
nunca por tour, onboarding obrigatório ou documentação (Lei 15 do PX / anti-
padrões). Uma capacidade nova estreia dizendo o que percebeu/pode fazer, no
momento em que é útil ("aprendi a tabela da Modare — apliquei nos 40 novos").
Descoberta = a Zion demonstrando, jamais a interface ensinando. `[PX-003 §10 ·
PX-004 P8]`

## Parte 16 · Anti-padrões

Menu infinito · dashboard com dezenas de cards · chat como navegação ·
Capabilities visíveis · fluxos obrigatórios · wizard para tudo · tela vazia
(morta) · popup para qualquer ação · contexto perdido · Memory escondida ·
Agreement invisível. **Cada um viola:** navegação-por-funcionalidade (Lei 1) ·
Capabilities-invisíveis (Lei 2) · Missões-não-sequestram (Lei 3) · preservação
de contexto (Lei 4) · nada-solto (Lei 5) · modais fora dos 4 Motivos (SYS-001
P11) · o vazio-saudável desenhado, não morto (SHELL-001 §8). Sutil: **chat como
navegação** — a Conversa é a *voz* da Zion, jamais o *mapa* do produto (navegar
por chat devolveria ao usuário o trabalho de dirigir — anti L1).

## Parte 17 · Critério de aceite (validação)

| Regra | Como validar |
|---|---|
| sempre sabe onde está | a moldura exibe área+Lente em todo estado (Lei 10) |
| sempre sabe o que acontece | frase de Estado + Fila presentes no Hoje |
| nunca vê Capabilities | zero referência a competência na UI; só Resultados/Missões |
| nunca entende arquitetura | zero termo interno (Capability/Pattern/Token) na tela |
| Missões aparecem naturalmente | toda Missão nasce de Capability/4-Motivos, na Fila ou sobreposta |
| Memory acessível | "o que sabemos" + "quem disse" alcançáveis de qualquer objeto |
| Agreements compreensíveis | Combinado mostra evidência+escopo+desligar |
| Shell implementa toda navegação | cada tipo (Parte 10) mapeia a uma camada do SHELL-001 |
| nenhuma decisão depende de UI específica | tudo expresso em contextos/objetos/leis, não em componentes |

## Lacunas declaradas

1. **UX-003 e UI-001 fora da lista de fontes** — são o lar natural deste modelo.
   Reconciliei via SHELL/CONST; onde a granularidade exigiria a redação literal
   deles (ex.: a lista canônica de objetos por área), apontei a fonte em vez de
   recriá-la.
2. **A "vista Memory" e a "vista Combinados" dentro de Zion** derivam de UI-001
   (as 3 vistas da área Zion); aqui uso CAP-000 (Memory/Agreement como conceitos)
   + CONST como ponte — a materialização exata dessas vistas pertence ao UX das
   telas, não a este modelo.

## Veredito

> **A arquitetura da experiência está completamente especificada.**

O modelo mental (SO de operações), a unidade dupla (Contexto de navegação ×
Missão de trabalho), os 5 Contextos permanentes, a árvore Root→Contexto→
Conteúdo→Mission, a taxonomia de navegação (Global/Context/Local/Temporary/
Back/Deep-Link, com Forward corretamente inexistente), o feedback mapeado ao
ciclo da Capability, as interrupções que convidam sem sequestrar, o
multi-contexto pela Lente, a descoberta-por-demonstração e os anti-padrões com
violação citada — todos derivam de Shell + Mission + Capability + Constitution.
**As duas lacunas são de *proveniência de fonte* (UX-003/UI-001 excluídos da
lista), não de conteúdo** — o modelo é completo e consistente com eles.
Nenhuma tela futura precisará inventar navegação; nenhuma Capability a definirá.
