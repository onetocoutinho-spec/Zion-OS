# Blueprint 001 — Publicação Idempotente (Sprint 0)

> **Natureza.** Este é um **documento de validação arquitetural**, não de
> implementação. Ele toma um caso **real** — a publicação de calçado no Mercado Livre
> entregue na Sprint 0, incluindo a idempotência das guias de tamanho — e o faz
> percorrer **toda** a arquitetura do Zion OS, para provar (ou refutar) que
> responsabilidades, fronteiras e ownership se sustentam.
>
> Não há tecnologia, contrato técnico, banco, infraestrutura nem sequência técnica —
> de propósito. A pergunta que este documento responde é uma só: **se a Sprint 0 fosse
> construída hoje seguindo rigorosamente a arquitetura do Zion, como ela percorreria o
> sistema?**
>
> **Primeiro artefato da fase de Engenharia Arquitetural.** Serve de modelo para todos
> os Blueprints futuros.

---

## 1. Objetivo

Um Blueprint existe para **submeter a arquitetura a um caso real**. Documentos de
fundação são coerentes entre si por construção; só um caso concreto revela se são
**suficientes**.

Este Blueprint valida seis coisas: que as **responsabilidades** estão nos lugares
certos; que as **fronteiras** permanecem intactas sob pressão; que o **ownership** é
respeitado; que os módulos **colaboram** apenas por fatos; que **nenhum conceito ficou
sem dono**; e que **nenhuma regra precisou ser violada** para que o caso funcionasse.

Ele **não descreve implementação**. Descreve exclusivamente a **colaboração entre
módulos** — quem faz o quê, sob qual invariante, publicando qual fato, e quem observa
esse fato em seguida.

---

## 2. Cenário de Negócio

Um lojista quer que um de seus calçados esteja **presente no Mercado Livre**.

O canal impõe particularidades reais: exige que a presença seja expressa por tamanho,
exige um identificador comercial do item, e exige uma **grade de tamanhos** — um
artefato do próprio canal, cujo nome deve ser único para aquele vendedor. É possível
que o vendedor **já possua** uma grade equivalente, criada anteriormente pelo Zion ou
fora dele.

Três garantias devem valer, independentemente de qual canal seja:

- **A mesma intenção nunca produz duas presenças.**
- **A mesma conversa nunca é repetida desnecessariamente.**
- **O canal permanece consistente** — o Zion nunca cria artefatos duplicados nem
  sobrescreve o que é do canal.

---

## 3. Fluxo Arquitetural Completo

O caminho: **Cliente → Publication → Operation Center → Publication → Integration →
Mercado Livre → Integration → Publication → Operation Center → Fim.**

### Etapa 1 — A intenção nasce

- **Módulo:** Publication · **Agregado:** Publication
- **Caso de uso:** Criar Publication
- **Policies:** — · **Invariantes:** uma intenção refere-se a exatamente um produto e um
  canal pretendido; o Produto é apenas **referenciado por identidade**
- **Fato publicado:** *intenção de publicação criada*
- **Observa em seguida:** Operation Center
- **Jamais poderia acontecer:** copiar dados do Produto para dentro da intenção;
  conhecer qualquer particularidade do Mercado Livre.

### Etapa 2 — A intenção ganha conteúdo e é versionada

- **Módulo:** Publication · **Agregado:** Publication (entidade Listing)
- **Caso de uso:** Planejar Publicação
- **Policies:** Estratégia de publicação; Versionamento
- **Invariantes:** versões fixadas são **imutáveis**; mudar a intenção cria **nova**
  versão
- **Fato publicado:** *versão da intenção fixada*
- **Observa em seguida:** Operation Center
- **Jamais poderia acontecer:** reescrever uma versão anterior; montar o conteúdo no
  formato exigido por um marketplace.

### Etapa 3 — A intenção é avaliada quanto à elegibilidade

- **Módulo:** Publication · **Agregado:** Publication
- **Caso de uso:** Avaliar Elegibilidade
- **Policies:** Elegibilidade — que consulta as **Capabilities** do canal, publicadas
  pela Integration **em vocabulário do Zion** (por exemplo: *este canal exige
  identificador comercial para esta natureza de item*)
- **Invariantes:** o veredito vem sempre **com justificativa**
- **Fato publicado:** *intenção elegível* **ou** *intenção inelegível, com motivo*
- **Observa em seguida:** Operation Center
- **Jamais poderia acontecer:** Publication saber que o canal chama isso de "GTIN"; ou
  a exigência do canal virar uma **invariante do Zion**.

> **Nota — o caso do identificador ausente.** Na Sprint 0, o produto de teste não tinha
> identificador comercial e o canal recusou a publicação **no fim** do processo. Nesta
> arquitetura, a recusa vira **inelegibilidade detectada antes**: a exigência do canal
> chega como **Capability traduzida**, a Policy de Elegibilidade a consulta, e o fato
> publicado é *inelegível — falta identificador comercial*. O Operation Center o
> observa como Signal e pode originar uma missão de **completar o produto** — dirigida
> ao Catalog, seu dono.

### Etapa 4 — A operação julga e compromete o trabalho

- **Módulo:** Operation Center · **Agregados:** Signal → Decision → Mission
- **Casos de uso:** Receber Signal · Avaliar Signal · Criar Decision · Comprometer
  Decision · Criar Mission · Planejar Action · Solicitar Action
- **Policies:** Elegibilidade; **Priorização**; Governança
- **Invariantes:** todo trabalho nasce de uma **Decision comprometida**; nenhuma Action
  existe sem Mission; **prioridade sempre com justificativa**; Signal e Decision são
  imutáveis
- **Fatos publicados:** *decisão comprometida* · *missão formada* · **ação solicitada
  (publicar)**
- **Observa em seguida:** Publication
- **Jamais poderia acontecer:** o Operation Center publicar o anúncio; conhecer o
  Mercado Livre; criar Mission sem Decision.

### Etapa 5 — A intenção é solicitada (com idempotência de intenção)

- **Módulo:** Publication · **Agregado:** Publication (entidade Solicitação)
- **Caso de uso:** Solicitar Publicação
- **Policies:** **Idempotência (chave de equivalência)** — esta versão da intenção já
  foi realizada?; Estratégia de atualização (atualizar × republicar)
- **Invariantes:** **a mesma versão de intenção nunca produz duas presenças**; toda
  Solicitação aponta para **uma versão existente**
- **Fato publicado:** *solicitação de publicação emitida*
- **Observa em seguida:** Integration
- **Jamais poderia acontecer:** Publication executar a publicação; falar com o canal;
  emitir solicitação sem versão.

### Etapa 6 — A fronteira traduz e conversa (com idempotência de comunicação)

- **Módulo:** Integration · **Agregados:** Channel (Capabilities, Mapping) · Connection
  · Communication
- **Casos de uso:** Resolver Capacidades · Enviar Solicitação · Traduzir Resposta ·
  Traduzir Erro · Reconciliar Comunicação
- **Policies:** Resolução de Capacidade; **Idempotência de Comunicação**; Retry;
  Timeout; Compatibilidade
- **Invariantes:** **nada sai em língua estrangeira e nada entra sem tradução**;
  nenhuma regra de negócio habita tradutores; a conexão é de **um** cliente e **um**
  canal; **toda comunicação termina com desfecho conhecido**
- **Fatos publicados (já traduzidos):** *presença realizada* · *falha ao realizar, com
  motivo traduzido* · *recusa do canal* · *conexão sem validade*
- **Observa em seguida:** Publication (e Operation Center, para fatos de canal)
- **Jamais poderia acontecer:** vazar um termo, código ou erro do canal num fato
  publicado; deixar uma conversa sem desfecho; decidir o que publicar.

> **Nota — a grade de tamanhos vive aqui, e apenas aqui.** A grade é um **artefato do
> canal**, necessário para **expressar** a presença. Toda a mecânica que a Sprint 0
> descobriu — procurar uma grade equivalente antes de criar, percorrer os resultados,
> comparar de forma normalizada, ignorar grades de padrão alheio e, diante da recusa
> por nome já em uso, **reconsultar e reutilizar** — é **tradução**, e portanto
> pertence integralmente à Integration. Ela se apoia no **Mapping** (a correspondência
> entre o conjunto de tamanhos do Zion e a grade daquele vendedor no canal) e na
> **Capability** (o canal exige grade; o canal exige nome único). **Publication não
> sabe que grades existem.** Se um dia o canal deixar de exigi-las, **nada** muda fora
> desta fronteira.

### Etapa 7 — O canal responde e a resposta vira fato do Zion

- **Módulo:** Integration · **Agregados:** Communication · External Observation
- **Casos de uso:** Receber Resposta · Traduzir Resposta/Erro · Atualizar Percepção ·
  Reconhecer Divergência
- **Policies:** Reconciliação; Retry
- **Invariantes:** a observação externa é **imutável e datada**; ela é o que o canal
  **reportou** — nunca a verdade do Zion
- **Fatos publicados:** *presença realizada* · *falha, com motivo em linguagem do Zion*
  · *divergência reconhecida*
- **Observa em seguida:** Publication
- **Jamais poderia acontecer:** tratar a observação como verdade; sobrescrever a
  intenção com o que o canal disse.

### Etapa 8 — A intenção reconcilia e muda de estado

- **Módulo:** Publication · **Agregado:** Publication
- **Casos de uso:** Receber retorno da execução · Reconciliar intenção com resposta ·
  Atualizar Estado · Registrar Falha
- **Policies:** Reconciliação; Republicação; Explicabilidade
- **Invariantes:** a **percepção nunca vira verdade**; um retorno do canal **nunca
  sobrescreve a intenção** — no máximo revela **divergência**; estados terminais não
  emitem transição
- **Fatos publicados:** *anúncio publicado* · *falhou ao publicar* · *divergiu*
- **Observa em seguida:** Operation Center
- **Jamais poderia acontecer:** mudar a intenção porque o canal respondeu diferente;
  publicar fato sem transição.

### Etapa 9 — A operação registra o desfecho e conclui

- **Módulo:** Operation Center · **Agregados:** Mission (entidade Action) · Result
- **Casos de uso:** Acompanhar Action · Registrar Result · Conduzir a Mission ·
  Reabrir Missão *(se falhou)* · Cancelar Missão *(se irrecuperável)*
- **Policies:** Reabertura; Escalonamento; Cancelamento; Priorização
- **Invariantes:** todo Result pertence a uma Action; **Falha não é terminal**;
  Concluída **nunca** retorna ao planejamento; reabrir só a partir de Falha
- **Fatos publicados:** *resultado registrado* · *missão concluída* (ou *tentativa
  falhou*)
- **Observa em seguida:** Indicadores e Saúde Operacional
- **Jamais poderia acontecer:** concluir a Missão com passo essencial ainda em
  execução; tratar a falha como terminal sem decisão explícita.

### Etapa 10 — A operação se mede

- **Módulo:** Operation Center · **Agregado:** Operation
- **Casos de uso:** Atualizar Indicadores · Reavaliar Saúde Operacional
- **Invariantes:** a **Saúde é sempre derivada**, nunca atribuída
- **Fato publicado:** *operação atualizada*
- **Jamais poderia acontecer:** alguém "setar" a saúde de uma operação.

### Etapa 11 — A segunda publicação do mesmo produto (o caso do bug)

Aqui o Blueprint prova a correção arquitetural do problema original, com **duas
proteções em níveis distintos**:

- **Publication** (Etapa 5) reconhece, pela sua Policy de equivalência, que **esta
  versão da intenção já foi realizada** — e **não emite** nova solicitação de criação
  (no máximo, uma atualização, conforme a Estratégia). *Protege a presença.*
- **Integration** (Etapa 6), caso uma conversa ocorra, reutiliza a grade existente pelo
  **Mapping** em vez de criar outra — e, se o canal recusar por nome já em uso,
  **reconsulta e reutiliza**. *Protege o diálogo e o canal.*

O `chart_name_unavailable` da Sprint 0 **nunca chega a existir como problema de
negócio**: é uma **regra do canal**, tratada dentro da fronteira que existe justamente
para absorvê-la.

### Etapa 12 — Quando a ponte cai

- **Módulo:** Integration · **Agregado:** Connection
- **Caso de uso:** Registrar Perda de Validade da Conexão
- **Fato publicado:** *conexão sem validade*
- **Observa em seguida:** Operation Center — que o acolhe como **Signal de severidade
  crítica e impacto sobre toda a Operação**, e pode originar uma missão de reconexão
  com precedência natural (desbloquear precede otimizar)
- **Jamais poderia acontecer:** Publication ou Operation Center tentarem restabelecer a
  conexão por conta própria.

---

## 4. Participação de cada módulo

**Publication.** É dona da **intenção** e do seu ciclo de vida: cria, versiona, avalia
elegibilidade, solicita, reconcilia e muda de estado. **Não** publica no canal, **não**
conversa com o Mercado Livre, **não** conhece grades de tamanho nem qualquer
particularidade de marketplace, **não** decide prioridade, **não** altera o Produto.

**Integration.** É dona da **fronteira**: conexão, capacidades, tradução, conversa e
observação externa. É onde vive **toda** a mecânica do canal — incluindo a grade de
tamanhos e a unicidade do seu nome. **Não** decide o que publicar, **não** conhece a
intenção por dentro, **não** possui Produto nem Anúncio, **não** transforma exigência
de canal em regra do Zion.

**Operation Center.** É dono da **coordenação**: observa fatos como Signals, julga
(Decision), compromete trabalho (Mission), solicita passos (Action), registra
resultados e mede a operação. **Não** publica, **não** traduz, **não** fala com o
canal, **não** altera Produto nem Anúncio.

**Catalog.** Participa **apenas como referenciado**: a intenção aponta para o Produto
por identidade, e fatos de Produto (mudou, tornou-se apto, dados incompletos) alimentam
o fluxo. **Não** publica, **não** conhece canais, **não** sabe da intenção.

**Identity & Access.** Participa **apenas autorizando**: nenhuma etapa que mude estado
ocorre sem que se afira quem pode agir sobre aquele cliente. **Não** possui nenhuma
verdade operacional, **não** decide, **não** executa.

**AI Services.** Participa **apenas recomendando e explicando** (ver §8). **Não** muta
agregados, **não** cria decisões, **não** governa o fluxo.

---

## 5. Responsabilidades protegidas

O caso pressiona a arquitetura exatamente nos pontos onde ela poderia ceder — e cada
responsabilidade permanece isolada:

- **Publication protege a intenção.** Nem o canal, nem a operação, nem a IA a alteram.
  Um retorno adverso produz **divergência**, não reescrita.
- **Integration protege a tradução.** Toda idiossincrasia do Mercado Livre — grades,
  unicidade de nome, exigência de identificador, formato por tamanho — morre nesta
  fronteira.
- **O Marketplace protege o estado vivo.** O Zion nunca afirma o que está no ar; apenas
  **percebe**, de forma datada.
- **Operation Center protege a coordenação.** Decide o que merece acontecer e acompanha
  — sem executar nada.
- **Catalog protege o Produto.** Nenhum módulo do fluxo o altera; se falta dado, nasce
  trabalho **dirigido ao seu dono**.
- **Identity & Access protege quem pode agir.**

Nenhum invade o outro em nenhuma das doze etapas.

---

## 6. Ownership da verdade

- **Produto** — dono: **Catalog**. Observam: Publication, Operation Center.
  Referenciam por identidade: Publication (na intenção), Operation Center (como Alvo).
- **Publication (intenção)** — dono: **Publication**. Observa: Operation Center.
  Referencia: ninguém possui; apenas se referencia por identidade.
- **Presença (estado vivo no canal)** — dono: **o Mercado Livre (fonte externa)**.
  Observa e reporta: Integration. Mantém **percepção**: Publication. **Ninguém no Zion
  a possui.**
- **Communication (o diálogo)** — dono: **Integration**. Ninguém mais a observa por
  dentro; o que sai são fatos traduzidos.
- **Capability (o que o canal exige/suporta)** — dono: **Integration**. Observa e
  consulta em vocabulário do Zion: Publication (elegibilidade).
- **Mapping (correspondência com a grade do canal)** — dono: **Integration**. Nenhum
  outro módulo sabe que existe.
- **Connection** — dono: **Integration**. Observa: Operation Center (como sinal).
- **Signal, Decision, Mission, Action, Result** — dono: **Operation Center**. Observam:
  supervisão e indicadores.
- **Saúde Operacional e Indicadores** — dono: **Operation Center** (derivados).
- **Identidade do cliente e Autorização** — dono: **Identity & Access**. Consultam
  todos, possuem nenhum.

Nenhuma verdade aparece com dois donos. Nenhuma aparece sem dono.

---

## 7. Colaboração entre módulos

Todas as doze etapas colaboram **exclusivamente por fatos publicados e referências por
identidade**:

- O Operation Center **não chama** Publication: publica *ação solicitada*, que
  Publication **observa** e cumpre dentro da sua fronteira, sob suas próprias regras.
- Publication **não chama** Integration: publica *solicitação emitida*, que Integration
  **observa**.
- Integration **não devolve** o modelo do canal: publica **fatos traduzidos**.
- Ninguém guarda a verdade alheia — Publication referencia o Produto, o Operation
  Center referencia Alvos, Integration referencia cliente e canal.
- **Nenhum módulo depende da reação de outro para estar correto.** Se ninguém observar
  um fato, cada módulo permanece íntegro; o que se perde é progresso, nunca
  consistência.

Em nenhum momento houve dependência de modelo interno ou chamada de domínio
atravessando fronteira.

---

## 8. Participação da IA

A IA poderia participar em quatro momentos, sempre **pelas bordas** e sempre entrando
**pelo mesmo portão que um humano** — um caso de uso:

- **Explicar elegibilidade** (Etapa 3) — traduzir "falta identificador comercial" em
  uma explicação acionável para quem opera.
- **Sugerir republicação ou atualização** (Etapa 8) — propor, com justificativa, a
  estratégia diante de uma falha ou divergência.
- **Explicar divergência** (Etapas 7–8) — interpretar por que o percebido difere do
  pretendido.
- **Interpretar erro externo** (Etapa 6) — ajudar a compreender uma recusa do canal.
  **Nunca definir a tradução**: tradução é conhecimento determinístico da Integration.

E, em todos eles: a IA **nunca altera agregados**, **nunca cria decisões** (propõe
Decisions, que se tornam comprometidas por quem tem esse direito), e **nunca governa o
fluxo**. Sem a IA, todas as doze etapas continuam corretas — ela acelera, não sustenta.

---

## 9. Validação arquitetural

**A arquitetura foi suficiente?** **Sim.** As doze etapas foram percorridas sem que
nenhuma regra precisasse ser violada, nenhuma fronteira contornada e nenhum conceito
ficasse órfão.

**Houve responsabilidade ambígua?** **Uma, agora resolvida.** *Quem faz nascer a
intenção* poderia ser lido de dois modos: um pedido do Operation Center ou um ato
próprio da Publication. O Blueprint esclarece que **os dois coexistem sem conflito**:
**declarar a intenção** é da Publication (ela pode preexistir, aguardando condições);
**decidir que ela deve ser realizada agora** é do Operation Center. São atos distintos
sobre verdades distintas.

**Algum conceito ficou sem dono?** **Não** — mas um exigiu esclarecimento. A **grade de
tamanhos** não é um conceito do Zion: é um **artefato do canal**. Sua correspondência
com o conjunto de tamanhos da intenção é um **Mapping**, e portanto da Integration.
Isso **amplia a leitura** de Mapping — que cobre não só correspondências conceituais
estáticas, mas também **artefatos criados no canal cuja identidade a fronteira precisa
lembrar**. Não é uma violação; é uma nuance que este Blueprint torna explícita.

**Algum módulo acumulou responsabilidades?** **Nenhum acumulou indevidamente** — mas
registro um **ponto de atenção**: a Integration concentra conexão, capacidades,
tradução, conversa **e** o ciclo de vida de artefatos criados no canal. Hoje isso é
coeso (tudo é "conversar com o mundo externo"). Se, no futuro, artefatos de canal se
multiplicarem a ponto de terem ciclo de vida próprio e independente, valerá reavaliar
se merecem um agregado dedicado **dentro** da Integration. Nada a fazer agora; apenas a
observar.

**Alguma fronteira ficou frágil?** **Não.** A mais pressionada foi Publication ×
Integration — exatamente onde a Sprint 0 falhou na prática. O mecanismo de
**Capability** se mostrou a peça decisiva: ele permite que Publication raciocine sobre
exigências do canal **sem conhecer canal algum**, o que resolve arquiteturalmente o
caso do identificador comercial ausente.

**Alguma regra precisou ser violada?** **Nenhuma.**

> **Declaração.** A arquitetura do Zion OS **suportou integralmente** o caso da Sprint
> 0. Mais do que isso: ela **teria evitado** o defeito original. O
> `chart_name_unavailable` só existiu porque a mecânica de um canal vivia no fluxo de
> publicação. Nesta arquitetura, essa mecânica nunca sai da fronteira — e o problema
> não teria como nascer.

---

## 10. Lições arquiteturais

O que mais impressiona ao percorrer o caso é que **nenhum documento precisou ser
consultado para ser obedecido** — eles aparecem naturalmente:

- O **Manifesto** aparece na lei que decide tudo: *decidir não é executar*. É ela que
  separa Operation Center de Publication e Publication de Integration.
- O **Modelo de Consistência e Fronteiras** aparece no momento mais delicado: a
  presença no canal **não tem dono no Zion**. Sem essa lei, a tentação seria declarar
  Publication dona do que está no ar — e toda a reconciliação ruiria.
- A **Arquitetura do Sistema** aparece na direção das colaborações: fatos e
  identidades atravessam; interiores, nunca.
- A **Arquitetura dos Módulos** aparece em cada etapa: sempre *Observador → Caso de
  Uso → Policy → Agregado → fato → Publicador*. Doze etapas, uma única gramática.
- **Publication** aparece na distinção que salva o caso: **invariante** (a mesma
  intenção não vira duas presenças) × **policy** (o critério de equivalência).
- **Integration** aparece como o herói silencioso: **Capability** e **Mapping** são o
  que mantêm o Mercado Livre fora do Zion.
- **Operation Center** aparece garantindo que nada aconteça por acidente: todo trabalho
  nasce de uma Decision, com prioridade justificada.
- O **Glossário** aparece o tempo todo — *presença*, *percepção*, *divergência*,
  *capacidade* — cada palavra significando exatamente uma coisa em todas as doze
  etapas.

**A lição central:** a implementação **nasce da arquitetura**, e não o contrário. A
Sprint 0 foi construída de dentro para fora — do que o canal exigia até o que o sistema
faria — e por isso a mecânica do canal acabou no meio do fluxo de negócio. Percorrida
de fora para dentro, cada peça encontra **um único lugar possível**. Não foi preciso
escolher: a arquitetura escolheu.

---

## Critério de longevidade

Este Blueprint permanece correto se o canal for Shopee, Amazon, Magalu ou TikTok Shop;
se o ERP mudar; se a linguagem, o framework ou a infraestrutura forem substituídos. Em
nenhum ponto ele descreve **com quem** o Zion conversa ou **como** — apenas a
**jornada arquitetural** de uma intenção até virar presença, e de volta como fato.

Trocar de marketplace altera **capacidades, mapeamentos e tradutores** — e nada mais.
Se um dia trocar de canal exigir tocar Publication ou Operation Center, este Blueprint
terá sido violado antes mesmo de a arquitetura falhar.
