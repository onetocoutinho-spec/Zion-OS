# Zion OS — Arquitetura do Sistema (v1)

> **Natureza.** Este documento traduz a **arquitetura conceitual** (a Constituição do
> Zion OS) em uma **organização lógica de software**. Ainda não há banco, API,
> framework, mensageria, deploy ou implementação — de propósito. Ele responde **como o
> sistema se organiza**, nunca **como se constrói**.
>
> **Subordinação.** Não altera nem contradiz os nove documentos de fundação; os
> **realiza** como estrutura. Toda organização aqui deriva da Constituição.
>
> **Neutralidade física.** Esta é a arquitetura **lógica**. Ela é **indiferente** a
> ser materializada como monólito modular ou como serviços distribuídos — essa é uma
> decisão **física**, deferida (§11). As fronteiras valem em qualquer dos casos.

---

## 1. Objetivo

A **Arquitetura Conceitual** responde *o que o sistema é*: seu domínio, suas verdades,
seus invariantes, sua filosofia. A **Arquitetura do Sistema** responde *como o
software se organiza para honrar isso*: quais módulos existem, quem depende de quem,
quem pode conhecer quem, e onde começam e terminam as fronteiras.

Este documento **traduz a primeira na segunda**. Ele não inventa nada de negócio —
apenas dá forma de software à Constituição. Onde a fundação diz "cada verdade tem um
dono", esta arquitetura diz "então existe um módulo dono de cada verdade, e ninguém
alcança o interior dele". A pergunta que este documento nunca responde é *como
implementar*; a que sempre responde é *como organizar*.

Ao final, deve ser possível iniciar a implementação **sem nunca mais precisar
discutir onde cada responsabilidade pertence**.

---

## 2. Princípios

1. **O software segue o domínio.** A estrutura de módulos espelha o mapa de verdades
   e responsabilidades da fundação, não a conveniência técnica.
2. **Dependências seguem responsabilidades.** Um módulo só depende daquilo pelo qual
   é legitimamente responsável ou que legitimamente observa.
3. **Acoplamento mínimo.** Módulos se ligam pelo **mínimo** possível — fatos e
   referências por identidade — nunca por seus interiores.
4. **Alta coesão.** Cada módulo reúne tudo o que pertence a uma verdade e nada além.
5. **Domínios independentes.** Cada módulo evolui por si; a correção de um não depende
   do interior de outro.
6. **Separação entre decisão e execução.** Quem decide (Operation Center) e quem
   executa (os módulos donos) são partes distintas do software.
7. **Separação entre capacidades transversais e domínios.** O que atravessa tudo (IA,
   autorização, auditoria) não é um domínio e não possui verdade.
8. **As dependências apontam para dentro.** Em cada módulo, o mundo externo depende da
   aplicação, que depende do domínio; o domínio não depende de ninguém.
9. **Módulos comunicam-se por fatos.** Colaboração é troca de fatos e identidades, na
   linguagem publicada — nunca chamada ao modelo interno alheio.
10. **A organização espelha o mapa de propriedade.** Se a fundação diz quem é dono de
    quê, a arquitetura diz onde esse dono vive — e só ele.

---

## 3. Organização Geral do Sistema

Os grandes módulos oficiais do Zion, cada um com responsabilidade, limites e objetivo.
Nunca em termos de código.

### Catalog
- **Responsabilidade:** ser o dono do **Produto** — o que o cliente vende e em que
  condição.
- **Limites:** começa e termina na verdade do Produto; não conhece anúncios, canais
  nem operação.
- **Objetivo:** manter um catálogo íntegro e apto, e comunicar seus fatos.

### Publication
- **Responsabilidade:** ser o dono do **Anúncio pretendido** e da **execução** de
  publicar/atualizar/corrigir.
- **Limites:** termina onde começa a verdade do Produto (que referencia) e a Conexão
  (que usa via Integration); não decide prioridade nem opera.
- **Objetivo:** transformar Produto em presença de venda fiel e comunicar seus fatos.

### Integration
- **Responsabilidade:** ser a **fronteira do Zion com o mundo externo** — dona da
  **Conexão** e da comunicação com marketplaces e ERP. Traduz a linguagem externa em
  fatos do Zion e vice-versa.
- **Limites:** termina na borda; não possui Produto, Anúncio nem operação; não conhece
  o significado operacional do que transporta.
- **Objetivo:** manter as pontes externas e proteger o interior do Zion das
  particularidades de cada sistema externo.

### Operation Center
- **Responsabilidade:** dono de **Operation, Signal, Decision, Mission, Action,
  Result, Saúde Operacional e Indicadores**; **orquestra** a operação.
- **Limites:** decide e coordena; nunca executa integração, nunca altera Produto ou
  Anúncio, nunca controla o marketplace.
- **Objetivo:** governar a atenção da operação a partir dos fatos dos demais módulos.

### Identity & Access
- **Responsabilidade:** dono da **Identidade do Cliente/Conta** e da **Autorização**
  (quem existe, quem pode operar o quê).
- **Limites:** não possui nenhuma verdade operacional; é fonte, não operador.
- **Objetivo:** ser a referência única de quem é quem e de quem pode agir.

### AI Services *(capacidade transversal — não é módulo de domínio)*
- **Responsabilidade:** oferecer **interpretação, recomendação e explicação** sobre os
  fatos dos módulos, subordinada ao domínio.
- **Limites:** não possui verdade, não altera estado, não governa; atravessa os
  módulos sem romper suas fronteiras.
- **Objetivo:** ampliar a capacidade operacional (ver §9).

### Shared Kernel *(mínimo e justificável)*
- **Responsabilidade:** abrigar **apenas** os conceitos verdadeiramente universais e
  estáveis que a Constituição já fixou: a noção de **identidade/referência**, a noção
  de **fato/evento**, e o vocabulário comum que todos os módulos compartilham sem
  ambiguidade.
- **Justificativa:** sem um núcleo comum mínimo, cada módulo reinventaria os mesmos
  primitivos e a linguagem se fragmentaria. Ele existe para **garantir uma língua
  franca**, não para carregar regra de negócio.
- **Limites (críticos):** deve permanecer **pequeno e imutável**. Regra de negócio,
  modelo de domínio ou verdade de qualquer módulo **nunca** entram aqui (ver §10).

---

## 4. Dependências Entre Módulos

A regra-mãe: **nenhum módulo depende do interior de outro.** A colaboração acontece
por **fatos publicados** e **referências por identidade** — a linguagem que a
Constituição já definiu.

- **Todos** podem depender do **Shared Kernel** (mínimo, estável) — e de nada mais que
  seja de outro módulo.
- **Catalog** observa fatos externos (ERP) e **publica** fatos de Produto. Não depende
  de nenhum outro módulo de domínio.
- **Publication** **observa** fatos de Produto (Catalog) e as respostas de canal
  (Integration); **publica** fatos de Anúncio. Nunca alcança o interior do Catalog.
- **Integration** **observa** os pedidos de ação (como fatos) e o mundo externo;
  **publica** fatos de Canal e as respostas externas. Não conhece o significado
  operacional do que carrega.
- **Operation Center** **consome** fatos de todos os domínios e **referências** por
  identidade; **publica** os fatos do seu laço; **solicita** ações (como fatos) que os
  módulos donos cumprem. Nunca depende do interior de ninguém.
- **Identity & Access** **publica** fatos de identidade/autorização; é **fonte** —
  depende de ninguém para sua verdade.
- **AI Services** **observa** fatos de todos, **produz** recomendações e observações;
  é **dependido por ninguém** para correção — se sumir, os módulos continuam corretos.

**Quem nunca pode depender de quem:** nenhum módulo pode depender do modelo interno de
outro; nenhum pode chamar outro para "fazer por dentro" o que é responsabilidade
alheia; **não existem dependências circulares**. **Integration** é a única porta para
o externo — nenhum outro módulo fala com marketplace/ERP diretamente.

**Por quê:** toda dependência que não seja "fato + identidade" acopla os interiores e
mata a autonomia que a fundação garante. As dependências **seguem o mapa de
propriedade**: você só pode depender do que o outro **publica**, nunca do que ele **é**
por dentro.

---

## 5. Bounded Contexts

Cada módulo de domínio **é** um bounded context: tem o seu próprio modelo e a sua
própria linguagem, coerentes **dentro** de si.

- **Contextos internos do Zion:** Catalog, Publication, Integration, Operation,
  Identity & Access. Cada um dá aos termos o significado que faz sentido para a sua
  verdade — a mesma palavra pode significar coisas diferentes em contextos diferentes
  (o "Anúncio" pretendido em Publication não é o "anúncio vivo" do marketplace).
- **Contextos externos:** o Marketplace e o ERP são contextos **fora** do Zion, com
  linguagem própria. **Integration** é a **fronteira de tradução** entre eles e o
  Zion: traduz a linguagem externa em fatos internos e protege os demais módulos das
  particularidades externas.
- **AI Services** **não é** um bounded context — não tem modelo nem verdade próprios;
  ele opera **através** dos contextos, sempre na linguagem de cada um.

**Como se isolam:** cada contexto guarda o seu modelo e não adota o modelo alheio;
quando um fato entra, o contexto o **traduz** para os seus próprios termos em vez de
importar o modelo de fora.

**Como colaboram:** por uma **linguagem publicada** — os fatos e as identidades que
cada contexto expõe. Essa linguagem é o único terreno comum; o resto é privado.

**Onde um termina e outro começa:** na **fronteira da verdade**. Um contexto termina
exatamente onde termina a sua propriedade; do outro lado da fronteira começa outro
dono, com outra linguagem. A tradução acontece **na fronteira**, nunca por dentro.

---

## 6. Serviços Compartilhados

A regra é uma só: **compartilha-se mecanismo/capacidade; nunca significado/verdade.**

- **Pode ser compartilhado:**
  - o **Shared Kernel mínimo** — identidade, a noção de fato/evento, o vocabulário
    universal e estável;
  - **capacidades transversais** oferecidas como serviço — IA, verificação de
    autorização, auditoria, observabilidade, configuração — porque são **mecanismo**,
    não verdade de negócio.
- **Nunca deve ser compartilhado:**
  - a **verdade** de qualquer domínio;
  - o **modelo interno** ou as **entidades** de um módulo;
  - **regra de negócio** de um domínio.

**Quando criar um serviço transversal:** quando uma preocupação é genuinamente
**transversal** (atravessa vários módulos) **e** não possui verdade de negócio própria
— como auditoria, observabilidade, configuração e IA.

**Quando manter dentro do domínio:** sempre que for **regra** ou **verdade** daquele
domínio. Se tem significado de negócio, é do domínio; se é só um meio comum, pode ser
transversal.

**Aviso permanente:** o Shared Kernel deve ficar **minúsculo**. Um núcleo compartilhado
que cresce vira um ímã de acoplamento e recria, pela porta dos fundos, a dependência
entre interiores que toda esta arquitetura evita (ver §10).

---

## 7. Camadas Arquiteturais

Dentro de **cada** módulo, quatro camadas, com as dependências apontando **para
dentro** (em direção ao Domínio):

- **Interface** — onde o mundo externo (humano ou outro sistema) toca o módulo. Traduz
  interações externas em pedidos para a Aplicação. Conhece a Aplicação; **não** conhece
  o interior do Domínio.
- **Application** — orquestra os **casos de uso**. Coordena operações do Domínio e o
  uso das capacidades transversais; **não possui verdade de negócio própria**; expressa
  **intenção** ao Domínio.
- **Domain** — o **coração**: entidades, invariantes, máquina de estados, a verdade.
  **Não depende de nada** para fora (nem de Application, nem de Interface, nem de
  Infrastructure). É negócio puro.
- **Infrastructure** — a **borda** que realiza os meios técnicos e fala com o mundo.
  Ela **depende do Domínio** (realiza o que o Domínio precisa, declarado como
  abstração), **nunca o governa**.

**Direção das dependências:** Interface → Application → Domain; e Infrastructure →
Domain (a infraestrutura implementa as necessidades que o Domínio declara). O **Domínio
depende de ninguém**. É a materialização da lei da Constituição — *a tecnologia serve
ao domínio; nunca o inverso*. A infraestrutura é **substituível** sem tocar no
Domínio; é corpo, não alma.

---

## 8. Fluxo de um Caso de Uso

Conceitualmente, sem tecnologia, um caso de uso atravessa o sistema assim:

- Um **fato** chega — a realidade mudou. Na fronteira do Operation Center, ele é
  reconhecido como **Signal**.
- A **Application** do Operation Center recebe o Signal e o conduz ao **Domain**.
- O **Domain** julga: forma uma **Decision**. Se a decisão é de agir, nasce uma
  **Mission**.
- A **Application** coordena a condução da Mission. Para que algo real aconteça, o
  Domain expressa uma **Action** — a **intenção** de um passo.
- Essa Action vira um **fato/pedido** que o **módulo dono** (ex.: Publication ou
  Integration) **observa** na sua própria fronteira.
- Dentro **daquele** módulo, o pedido atravessa suas camadas (Interface → Application →
  Domain) e a **execução** acontece **na sua fronteira** (Integration, se toca o
  externo).
- O desfecho produz um **Result**, que se torna um **Event** — um fato consumado.
- O Operation Center **observa** esse Event: a Mission avança, os **Indicadores**
  atualizam, e a realidade pode gerar um **novo Signal**.

Duas travessias, duas regras:
- **Entre módulos**, só se cruza por **fatos e pedidos** — nunca alcançando interiores.
- **Dentro de um módulo**, só se cruza **para dentro** (Interface → Application →
  Domain), com a Infrastructure servindo o Domain na borda.

O laço fecha sem que nenhuma responsabilidade tenha mudado de dono.

---

## 9. Capacidades Transversais

Capacidades como **IA, Autorização, Auditoria, Observabilidade e Configuração**
atravessam todos os módulos **sem** romper fronteiras, porque **não possuem verdade de
negócio** e **não alteram** estado de domínio. Elas são **usadas**, não **donas**.

- **IA** — interpreta, recomenda e explica sobre os fatos, na linguagem de cada
  contexto; possui nada, governa nada.
- **Autorização** — toda ação é aferida contra os fatos de **Identity & Access**; a
  capacidade **guarda o portão**, não detém a verdade operacional.
- **Auditoria** — registra fatos e transições de forma **append-only** através dos
  módulos; observa, nunca altera.
- **Observabilidade** — assiste ao sistema sem participar dele.
- **Configuração** — fornece parâmetros sem carregar verdade de negócio.

**Como atravessam sem romper fronteiras:** são invocadas nas **bordas** (na camada de
Application de cada módulo), leem **fatos** e oferecem **mecanismo** — e respeitam as
mesmas fronteiras e propriedades que qualquer ator. Elas se ligam a **muitos** módulos,
mas **pertencem a nenhum** e **mudam a verdade de nenhum**.

---

## 10. Anti-modelos

Erros arquiteturais que nunca devem acontecer:

- **Módulos acessando entidades internas de outros** (em vez de observar fatos).
- **Dependências circulares** entre módulos.
- **Shared Kernel gigante** — carregando regra ou verdade de negócio.
- **Lógica de domínio na infraestrutura** — a alma vazando para o corpo.
- **Domínio chamando a interface** — dependência apontando para fora.
- **Infraestrutura governando o domínio** — o corpo mandando na alma.
- **Módulos assumindo responsabilidades alheias** — Catalog publicando, Operation
  Center falando com o marketplace, Integration decidindo prioridade.
- **Depender do modelo interno de outro módulo** em vez da sua linguagem publicada.
- **Capacidade transversal virando dona de verdade** (uma IA/auditoria com verdade
  própria).
- **Pular a Application** para tocar o Domínio a partir de fora.
- **Dois módulos co-possuindo uma verdade.**
- **Usar fatos como comando** — um módulo "mandando" em outro via evento.

---

## 11. Questões deferidas

> Pertencem a documentos e decisões futuras.

- **Persistência** de cada verdade local.
- **APIs** e contratos técnicos.
- **Mensageria** e **eventos físicos**.
- **Banco** de dados.
- **Infraestrutura** e **deploy**.
- **Frameworks** e linguagem.
- **Fronteira física** dos módulos (monólito modular × serviços distribuídos).
- **Observabilidade técnica** e **segurança técnica**.
- **Performance**, **escalabilidade** e **versionamento**.

---

## Critério de longevidade e ponte para a implementação

Esta arquitetura deve permanecer correta ainda que o Zion troque por completo de
linguagem, framework, banco, infraestrutura, arquitetura física ou estratégia de
deploy. Ela representa **apenas a arquitetura lógica** — a organização de
responsabilidades que a Constituição exige.

Com ela, a ponte entre a Constituição e a implementação está posta: **onde cada
responsabilidade vive já está decidido**. A partir daqui, começar a construir é uma
questão de **escolher meios** para servir esta organização — nunca de rediscutir quem é
dono de quê. Se, um dia, um módulo alcançar o interior de outro, a infraestrutura
governar o domínio, ou uma verdade ganhar dois donos, não é a arquitetura que
amadureceu — é esta ponte que foi rompida.
