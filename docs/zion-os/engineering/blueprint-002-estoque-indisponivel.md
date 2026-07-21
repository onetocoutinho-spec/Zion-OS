# Blueprint 002 — Estoque Indisponível e Anúncio Ativo

> **Natureza.** Documento de **validação arquitetural**, da fase de Engenharia
> Arquitetural. Ele coloca a arquitetura **sob pressão** com um caso real e ordinário
> do domínio. Não há tecnologia, contrato técnico ou infraestrutura — de propósito.
>
> **Regra desta fase.** Este Blueprint **não altera a arquitetura**. Onde encontrar
> deficiência, ele **registra como evidência** para futura revisão da fundação — e
> **não resolve**. Nenhum conceito novo é criado aqui.
>
> **Aviso de resultado.** Diferentemente do Blueprint 001, este cenário **encontrou
> fragilidades**, incluindo uma **contradição entre duas regras já aprovadas**. Elas
> estão registradas na §8.

---

## 1. Objetivo

O Blueprint 001 validou o caminho **feliz e deliberado**: uma intenção nasce, é
julgada, é realizada. Este Blueprint testa o oposto: um fato **externo, involuntário e
adverso** que atinge algo **já realizado** — e que ninguém no Zion pediu.

**Partes da arquitetura exercitadas:** a fronteira com um segundo sistema externo (o
ERP, além do marketplace); a diferença entre **verdade externa**, **percepção** e
**intenção**; o ciclo *Signal → Decision → Mission → Action* diante de um fato que pode
**não merecer ação**; e o ciclo de vida da intenção quando ela precisa ser
**interrompida** e, eventualmente, **retomada**.

**Hipóteses sob teste:**

- que uma verdade externa consegue atravessar o Zion **sem que ninguém a possua
  indevidamente**;
- que a arquitetura tolera **decidir não agir**;
- que a intenção de publicação sobrevive a um fato adverso **sem ser sobrescrita**;
- que o ciclo comercial completo — **esgotou → suspende → repõe → volta ao ar** — é
  expressável com os conceitos existentes.

A última hipótese **não se confirmou**.

---

## 2. Cenário de Negócio

Um calçado do lojista está **com anúncio ativo** em um marketplace. O **ERP informa que
o estoque chegou a zero**. O marketplace, por ora, **continua exibindo** o anúncio.

- **Quem produz o fato:** o **ERP** — sistema externo, dono da verdade de estoque na
  origem.
- **Quem observa:** o Zion, através da **Integration**, única fronteira autorizada a
  falar com sistemas externos.
- **Quem continua dono da verdade:** o **ERP** (disponibilidade) e o **marketplace**
  (estado vivo do anúncio). O Zion **não passa a possuir** nenhuma das duas.
- **Verdades externas participantes:** disponibilidade do item (ERP); presença viva no
  canal (marketplace).
- **Verdades internas participantes:** o **Produto** (Catalog); a **intenção de
  publicação** (Publication); **Signal, Decision, Mission, Action, Result** e a **Saúde
  Operacional** (Operation Center); a **Conexão** e a **Observação Externa**
  (Integration).

Importa registrar o que **não** está em jogo: a decisão comercial (encerrar? esperar?
substituir?) é **política de negócio** e não é objeto deste documento. O que se valida
é se a arquitetura **conduz** o caso corretamente, qualquer que seja a política.

---

## 3. Fluxo Arquitetural

### Etapa 1 — A verdade externa muda

- **Módulo:** — (externo) · **Verdade:** disponibilidade do item
- **Dono:** **ERP**. O Zion não participa; apenas virá a saber.
- **Jamais poderia acontecer:** qualquer módulo do Zion "corrigir" o estoque na origem.

### Etapa 2 — A fronteira observa e traduz

- **Módulo:** Integration · **Agregados:** Communication · External Observation
- **Casos de uso:** Receber Resposta · Traduzir Resposta · Atualizar Percepção
- **Policies:** Reconciliação; Compatibilidade
- **Invariantes:** **nada entra no Zion sem tradução**; a observação externa é
  **imutável e datada**; ela é o que a fonte **reportou**, nunca a verdade do Zion
- **Fato publicado:** *disponibilidade esgotada* (em vocabulário do Zion)
- **Próximo observador:** Operation Center — e, em tese, quem mantiver a percepção de
  disponibilidade *(ver **Achado 1**, §8)*
- **Jamais poderia acontecer:** publicar o fato em linguagem do ERP; tratar a
  observação como verdade do Zion.

### Etapa 3 — O fato entra no domínio da operação

- **Módulo:** Operation Center · **Agregado:** Signal
- **Casos de uso:** Receber Signal · Avaliar Signal
- **Policies:** Elegibilidade
- **Invariantes:** o Signal é **imutável**; **não executa trabalho**; **não nasce de um
  julgamento**
- **Fato publicado:** *fato operacional observado*
- **Próximo observador:** o próprio julgamento do Operation Center
- **Jamais poderia acontecer:** o Signal pausar o anúncio; o Signal alterar a intenção.

### Etapa 4 — A operação julga (inclusive julga não agir)

- **Módulo:** Operation Center · **Agregado:** Decision
- **Casos de uso:** Criar Decision · **Comprometer Decision** *ou* **Descartar
  Decision**
- **Policies:** **Priorização**; Governança
- **Invariantes:** **todo trabalho nasce de uma Decision comprometida**; a Decision é
  **imutável**; **prioridade sempre com justificativa**; **uma Decisão pode não gerar
  Missão**
- **Fato publicado:** *decisão comprometida* **ou** *decisão descartada, com motivo*
- **Próximo observador:** Publication (se comprometida) ou auditoria/supervisão (se
  descartada)
- **Jamais poderia acontecer:** a arquitetura **forçar** uma ação. Se a política
  comercial for "esperar reposição", **descartar é um desfecho legítimo e registrado**.

> **Validação positiva.** Este é um dos pontos mais fortes do teste: a arquitetura
> **tolera a não-ação** e a **registra**. Um sistema que reagisse automaticamente a todo
> estoque zerado estaria decidindo política comercial por conta própria — exatamente o
> que a Constituição proíbe.

### Etapa 5 — O trabalho é comprometido

- **Módulo:** Operation Center · **Agregados:** Mission · Action
- **Casos de uso:** Criar Mission · Planejar Action · Solicitar Action
- **Policies:** Priorização; Escalonamento
- **Invariantes:** nenhuma Action existe sem Mission; a Mission tem Alvo, Prioridade,
  Motivo e Decision de origem
- **Fato publicado:** *ação solicitada* (interromper a presença)
- **Próximo observador:** Publication
- **Jamais poderia acontecer:** o Operation Center alterar a intenção diretamente; ou
  falar com o canal.
- **Tensão observada:** se o mesmo produto estiver presente em **vários canais**, um
  único fato de estoque afeta **várias intenções** *(ver **Achado 3**, §8)*.

### Etapa 6 — A intenção é interrompida

- **Módulo:** Publication · **Agregado:** Publication
- **Casos de uso:** **Solicitar Encerramento** — e é aqui que o modelo aperta
- **Policies:** Estratégia de atualização; Explicabilidade
- **Invariantes:** a intenção **só muda deliberadamente**; um fato externo **nunca a
  sobrescreve**; toda Solicitação aponta para uma versão existente
- **Fato publicado:** *solicitação de encerramento emitida*
- **Próximo observador:** Integration
- **Jamais poderia acontecer:** o ERP ou o canal alterarem a intenção; Publication
  decidir sozinha que deve encerrar.
- **Tensão observada:** o que o negócio quer aqui é **suspender temporariamente**, não
  **encerrar** *(ver **Achado 2**, §8)*.

### Etapa 7 — A fronteira conversa com o canal

- **Módulo:** Integration · **Agregados:** Connection · Communication
- **Casos de uso:** Resolver Capacidades · Enviar Solicitação · Traduzir Resposta
- **Policies:** Idempotência de Comunicação; Retry; Timeout
- **Invariantes:** nada sai em língua estrangeira; **toda comunicação termina com
  desfecho conhecido**; a conexão é de um cliente e um canal
- **Fato publicado (traduzido):** *presença interrompida* ou *falha, com motivo*
- **Próximo observador:** Publication
- **Jamais poderia acontecer:** vazar o vocabulário do canal; decidir se deveria
  interromper.

### Etapa 8 — A intenção reconcilia

- **Módulo:** Publication · **Agregado:** Publication
- **Casos de uso:** Receber retorno · Reconciliar intenção com resposta · Atualizar
  Estado
- **Policies:** Reconciliação
- **Invariantes:** a **percepção nunca vira verdade**; estados terminais não emitem
  transição
- **Fato publicado:** *presença encerrada*
- **Próximo observador:** Operation Center
- **Tensão observada:** o estado alcançado é **terminal** *(ver **Achado 2**, §8)*.

### Etapa 9 — A operação fecha o laço

- **Módulo:** Operation Center · **Agregados:** Mission · Result · Operation
- **Casos de uso:** Registrar Result · Conduzir a Mission · Atualizar Indicadores ·
  Reavaliar Saúde Operacional
- **Invariantes:** todo Result pertence a uma Action; a **Saúde é derivada**
- **Fatos publicados:** *resultado registrado* · *missão concluída* · *operação
  atualizada*

### Etapa 10 — Caminho paralelo: o canal pausa sozinho

Frequente na prática: o marketplace pausa o anúncio por conta própria ao detectar
indisponibilidade.

- **Módulo:** Integration → Publication
- **Casos de uso:** Atualizar Percepção · Reconhecer Divergência · Reconciliar
- **Invariantes:** a intenção **não muda** porque o canal mudou
- **Fato publicado:** *divergência reconhecida* (a intenção diz "presente"; a percepção
  diz "pausado")
- **Próximo observador:** Operation Center, que decide se a divergência merece ação
- **Validação positiva:** o caso se encaixa **perfeitamente** no conceito de
  **divergência** já modelado. A intenção sobrevive intacta; o fato externo vira
  matéria de julgamento, não de sobrescrita.

### Etapa 11 — O estoque é reposto

- **Módulo:** Integration → Operation Center → Publication
- **Fato publicado:** *disponibilidade reposta* → Signal → Decision → Mission → *ação
  solicitada (retomar a presença)*
- **Onde o fluxo trava:** ao chegar em Publication, **não há caminho válido de volta**
  *(ver **Achado 2**, §8)*.

---

## 4. Participação dos módulos

**ERP** *(externo)*. **Faz:** é o dono da disponibilidade na origem e a informa.
**Nunca faz:** conhecer o Zion, decidir sobre anúncios, alterar intenção.

**Marketplace** *(externo)*. **Faz:** é o dono do estado vivo do anúncio; pode pausar
por conta própria. **Nunca faz:** definir a intenção do Zion nem suas políticas.

**Integration.** **Faz:** observa os dois sistemas externos, traduz seus fatos para o
vocabulário do Zion, conduz as conversas e registra observações imutáveis. **Nunca
faz:** decidir se o anúncio deve sair do ar; possuir estoque; alterar Produto ou
intenção.

**Catalog.** **Faz:** permanece dono do **Produto**, referenciado pela intenção e pelas
missões. **Nunca faz:** publicar, conhecer canais, decidir sobre presença.
*(Sua relação com a percepção de disponibilidade é o **Achado 1**.)*

**Publication.** **Faz:** é dona da **intenção**; só ela a altera, e só
deliberadamente; reconhece divergência quando percepção e intenção deixam de coincidir.
**Nunca faz:** reagir sozinha ao estoque, falar com o canal, decidir prioridade.

**Operation Center.** **Faz:** acolhe o fato como Signal, julga (inclusive julga **não
agir**), compromete trabalho, acompanha e mede. **Nunca faz:** alterar Produto ou
intenção, falar com ERP ou canal.

**Identity & Access.** **Faz:** condiciona toda etapa que muda estado à autorização.
**Nunca faz:** decidir, executar, possuir verdade operacional.

**AI Services.** **Faz:** explica e recomenda (§7). **Nunca faz:** alterar agregados,
decidir, governar.

---

## 5. Ownership

- **Disponibilidade (estoque)** — **Dono: ERP** (externo). **Observa:** Integration
  (traduz e reporta) e Operation Center (como Signal). **Referencia:** as missões, por
  identidade do produto. **Nunca pode modificar:** nenhum módulo do Zion.
- **Estado vivo do anúncio** — **Dono: Marketplace** (externo). **Observa:**
  Integration. **Mantém percepção:** Publication. **Nunca pode modificar
  unilateralmente:** nenhum módulo do Zion — só **solicita** mudanças.
- **Produto** — **Dono: Catalog.** **Observam:** Publication, Operation Center.
  **Referenciam por identidade:** intenção e missões. **Nunca podem modificar:**
  Publication, Integration, Operation Center.
- **Intenção de publicação** — **Dona: Publication.** **Observa:** Operation Center.
  **Nunca podem modificar:** ERP, marketplace, Integration, Operation Center, IA.
- **Conexão e Observação Externa** — **Dona: Integration.** **Observa:** Operation
  Center (como sinais). **Nunca podem modificar:** os demais.
- **Signal, Decision, Mission, Action, Result** — **Dono: Operation Center.**
- **Saúde Operacional e Indicadores** — **Dono: Operation Center** (derivados; ninguém
  os atribui).
- **Identidade e Autorização** — **Dono: Identity & Access.**

**Nenhuma verdade apareceu com dois donos.** Uma apareceu **sem observador designado**
— registrada como Achado 1.

---

## 6. Fronteiras

**Onde ocorre cada tradução.** Exclusivamente na **Integration**, e duas vezes: quando
o ERP fala (disponibilidade → fato do Zion) e quando o marketplace fala (estado vivo →
fato do Zion). Em nenhum outro ponto do fluxo qualquer módulo precisou conhecer o
vocabulário de um sistema externo.

**Onde ocorre cada decisão.** Exclusivamente no **Operation Center** — inclusive a
decisão de **não fazer nada**. Nem o ERP, nem o canal, nem a Publication, nem a IA
decidem. A política comercial entra como **Policy**, aplicada por quem tem o direito de
julgar.

**Onde ocorre cada execução.** A mudança da intenção ocorre na **Publication** (e só por
ato deliberado); a conversa com o canal ocorre na **Integration**; a mudança real no
anúncio ocorre no **marketplace**, que é seu dono.

**Como permanecem desacoplados.** O ERP não sabe que o Zion existe. O marketplace
também não. A Integration não sabe o que "estoque zerado" significa para o negócio — só
sabe traduzi-lo. A Publication não sabe que existe um ERP. O Catalog não sabe que
existe um canal. O Operation Center não sabe falar com ninguém de fora. **Cada um sabe
exatamente o suficiente para cumprir sua parte, e nada além.**

---

## 7. Participação da IA

A IA poderia participar em quatro momentos, sempre **pelas bordas** e entrando pelo
**mesmo portão que um humano** — um caso de uso:

- **Explicar o estoque zerado** — traduzir o fato em consequência operacional
  compreensível ("este item sai do ar em breve; representa X da sua exposição").
- **Explicar a divergência** — por que a intenção diz "presente" e a percepção diz
  "pausado".
- **Explicar a recomendação** — propor, com justificativa, encerrar, aguardar ou
  priorizar reposição, apontando os critérios da política que sustentam a proposta.
- **Explicar o impacto** — o efeito sobre a saúde da operação e sobre os indicadores.

E, em todos: **não altera agregados**, **não decide** (propõe Decisions; comprometer é
de quem tem esse direito), **não governa** o fluxo. Sem a IA, as onze etapas continuam
corretas.

---

## 8. Validação Arquitetural

**A arquitetura foi suficiente?** **Parcialmente.** Ela conduziu corretamente o fato
externo, preservou todo o ownership, tolerou a não-ação e manteve a intenção intacta
diante de um evento adverso. Mas **não expressou o ciclo comercial completo** —
esgotou → suspende → repõe → volta ao ar.

**Alguma responsabilidade ficou ambígua?** **Sim — uma** (Achado 1).
**Alguma verdade ficou sem dono?** **Não** — mas uma ficou **sem observador designado**
(Achado 1).
**Alguma fronteira ficou frágil?** **Não.** Todas as fronteiras resistiram; a
Integration absorveu dois mundos externos sem vazamento.
**Algum módulo acumulou responsabilidades?** **Não.**
**Foi necessário violar algum documento?** **Não** — mas o Achado 2 mostra um ponto em
que dois documentos **se contradizem entre si**.
**Foi necessário criar um conceito novo?** **Não neste documento** — mas o Achado 2
indica que a fundação **precisará** de um, em revisão futura.

### Achado 1 — A percepção de disponibilidade não tem observador designado

O Modelo de Consistência estabelece que estoque e preço têm dono **externo** (o ERP) e
que "o Zion observa". Este cenário torna concreta uma pergunta que a fundação não
responde: **quem, dentro do Zion, mantém a percepção de disponibilidade?**

Candidatos plausíveis existem — o Catalog seria o mais natural, por ser o dono do
Produto — mas **nenhum documento aprovado atribui essa responsabilidade**, e a
Arquitetura de Módulo do Catalog ainda não foi escrita. Na prática, o fluxo funciona
sem resolver isso (o fato vira Signal e a operação age), mas **um fato recorrente sem
observador designado tende a ser mantido em vários lugares** — o caminho conhecido para
a duplicação de verdade.

**Severidade:** média. **Natureza:** conceito ainda não modelado.
**Registrado — não resolvido.**

### Achado 2 — Contradição: identidade da intenção × terminalidade do encerramento

Este é o achado mais grave, e emerge de um ciclo **absolutamente banal** do comércio.

Duas regras já aprovadas colidem:

- a **identidade** de uma intenção de publicação é dada pela combinação **produto +
  canal pretendido**;
- o estado **Encerrada** é **terminal** — dele não parte transição.

Quando o estoque volta e o negócio quer o produto novamente presente **no mesmo
canal**, não existe caminho válido:

- **reaproveitar** a intenção encerrada violaria a terminalidade;
- **criar outra** intenção para o mesmo par produto+canal colidiria com a regra de
  identidade.

Há ainda um agravante: o que o negócio deseja ao esgotar o estoque geralmente **não é
encerrar** — é **suspender temporariamente**, preservando a intenção de voltar. O
vocabulário atual da Publication oferece apenas *Encerrada* (fim deliberado) ou
*Cancelada* (abandono antes de realizar); **não há como expressar uma intenção
suspensa**. Manter o estado como *Publicada* e conviver com a divergência é possível,
mas registra como divergência algo que foi **deliberado** — o que descaracteriza o
conceito.

**Comparação instrutiva:** a mesma questão não afeta a Mission, cuja conclusão também é
terminal — porque uma Mission **não tem identidade única por alvo**, e uma nova missão
sobre o mesmo alvo é perfeitamente legítima. É a **combinação** de identidade única com
estado terminal que produz o impasse, e essa combinação só existe na Publication.

**Severidade:** alta. **Natureza:** contradição entre documentos aprovados + conceito
ausente (suspensão temporária da intenção).
**Registrado — não resolvido.** Deve ser levado a uma revisão futura da fundação.

### Achado 3 — Cardinalidade Decision → Mission, agora com caso concreto

Um único fato de estoque atinge **todas as intenções** daquele produto — potencialmente
em vários canais. A Máquina de Estados deixou explicitamente **deferida** a pergunta de
quantas Missions uma Decision pode originar. Este cenário mostra que a resposta
**deixou de ser acadêmica**: ou uma Decision origina várias Missions (uma por canal), ou
são necessárias várias Decisions para o mesmo fato — e as duas leituras têm
consequências distintas para prioridade, rastreabilidade e explicabilidade.

**Severidade:** média. **Natureza:** questão deferida que passou a ter caso concreto
exigindo-a.
**Registrado — não resolvido.**

> **Declaração.** A arquitetura **suportou o cenário no que diz respeito a ownership,
> isolamento, separação entre decisão e execução e independência dos sistemas
> externos** — todas as quatro garantias exigidas foram preservadas. **Não suportou
> integralmente o ciclo de vida do caso**, por força do Achado 2. As três evidências
> ficam registradas para revisão futura da fundação, e **nenhuma foi corrigida aqui**.

---

## 9. Lições Arquiteturais

**Documentos que apareceram naturalmente.** O **Modelo de Consistência** dominou o
cenário: foi ele que impediu o Zion de "assumir" o estoque ou o estado vivo. A
**Taxonomia de Sinais** ofereceu o vocabulário exato do fato. A **Política de
Priorização** apareceu ao permitir que o julgamento fosse **não agir**. A **Máquina de
Estados** apareceu duas vezes — uma para sustentar o fluxo, outra para **revelar o
impasse**. O **Glossário** foi decisivo: só porque *divergência* tinha definição
precisa foi possível afirmar que o caso da Etapa 10 **é** divergência e que o da Etapa
6 **não é**.

**Decisões arquiteturais que provaram seu valor.**

- **Separar intenção de percepção** foi o que salvou o cenário. Um fato adverso do
  mundo não tocou a intenção — virou matéria de julgamento. Sem essa separação, o
  estoque zerado teria "apagado" a intenção, e a informação de que se queria vender
  aquele item estaria perdida.
- **Tolerar a não-ação.** A arquitetura não força reação. Isso mantém a política
  comercial onde ela pertence — no negócio — e impede que o sistema decida sozinho.
- **A Integration como fronteira única** absorveu **dois** mundos externos (ERP e
  marketplace) sem que nenhum módulo interno precisasse conhecer qualquer um deles.

**Conceitos que saíram mais fortes.** **Divergência** ganhou contorno nítido ao ser
testada contra um caso que **não** é divergência. **Percepção** provou que sua distinção
de verdade não era preciosismo. E **Decisão** mostrou seu valor mais profundo: registrar
que se **escolheu não agir** é tão importante quanto registrar uma ação.

**Conceito que saiu enfraquecido.** O **ciclo de vida da intenção**. Ele foi desenhado
para uma trajetória que **termina**, e o comércio real é **cíclico**: produtos saem e
voltam do ar o tempo todo. Este Blueprint mostra que a Publication modela bem o
**nascimento** e o **fim** de uma intenção, mas ainda não modela sua **interrupção
reversível**.

**A lição central:** o Blueprint 001 confirmou que a arquitetura **suporta o que foi
projetado para suportar**. Este confirmou algo mais valioso — que ela **revela o que
ainda não foi pensado**, e o revela **antes** de existir código para consertar. Um caso
comum de comércio encontrou, em três horas de análise conceitual, uma contradição que
levaria meses para aparecer como defeito em produção.
