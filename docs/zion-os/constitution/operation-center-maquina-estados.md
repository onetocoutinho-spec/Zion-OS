# Operation Center — Máquina de Estados (v1)

> **Natureza.** Este documento modela o **comportamento temporal** do domínio do
> Operation Center: os **momentos válidos** (estados) e as **mudanças permitidas**
> (transições) de Decision, Mission e Action. Não há eventos, banco, API, fila,
> serviço, retry técnico ou frontend aqui — de propósito. Toda geração futura de
> eventos deverá ser **consequência** destas transições, nunca defini-las.
>
> **Subordinação.** Não altera nem contradiz os documentos aprovados
> (Especificação Arquitetural, Modelo de Domínio). Toda transição abaixo é
> justificável pela linguagem ubíqua já fixada.
>
> **Reconciliação com a imutabilidade.** O Modelo de Domínio afirma que Decision e
> Signal são imutáveis. Aqui isso significa: o **veredito terminal** de uma Decision
> é imutável. A máquina descreve como o julgamento **se forma até travar**; depois
> de terminal, jamais muda. Um novo julgamento é sempre uma **nova** Decision.

---

## 1. Objetivo

Uma máquina de estados existe para tornar explícito **o que é um momento válido do
negócio** e **quais mudanças entre momentos são permitidas** — de modo que o
sistema nunca represente uma situação impossível nem faça uma transição ilegítima.

- **Estados representam momentos válidos** do domínio (fatos verdadeiros sobre um
  conceito num instante: "esta Missão está pronta", "esta Ação falhou").
- **Transições representam mudanças permitidas** de um momento para outro, sempre
  com causa e sempre auditáveis.
- **Tudo o que não é uma transição declarada é proibido.** A ausência de um caminho
  é uma regra, não um esquecimento.

Este documento é a fundação temporal: qualquer decisão futura sobre eventos,
persistência, IA ou UX deverá **derivar** destas transições.

---

## 2. Princípios

1. **Estados representam fatos.** Um estado é uma verdade de negócio, não um passo
   técnico.
2. **Eventos são consequência de transições.** Primeiro o domínio muda de momento;
   qualquer notificação disso vem depois.
3. **Nenhuma entidade muda arbitrariamente.** Toda mudança é uma transição
   declarada, com causa (Motivo).
4. **Toda transição é auditável.** Quem/o quê/quando/porquê ficam registrados; o
   histórico é **append-only** — o passado nunca é reescrito.
5. **Transições inválidas nunca existem.** O modelo torna o estado impossível
   irrepresentável, não apenas indesejado.
6. **O tempo só anda para frente.** Não há "voltar no tempo"; reabrir é uma
   transição nova, não um apagar do que houve.
7. **Estados terminais são finais.** De um estado terminal não sai nenhuma
   transição (salvo, quando aplicável, a compensação explícita da Action).
8. **Controle desce, informação sobe.** Decision origina Mission; Mission comanda
   Action; o Resultado da Action **informa** a Mission. Nada comanda para cima.

---

## 3. Máquina de Estados da Decision

A Decision modela a **formação de um julgamento** até seu veredito terminal.

### Estados

**Proposta (Proposed)**
- **Significado:** um julgamento foi **formado** a partir de um ou mais Sinais, mas
  ainda **não foi comprometido**. É a deliberação em aberto.
- **Quando entra:** quando Sinais são pesados e um candidato a julgamento existe
  (proposto por um operador ou pela IA).
- **Quando sai:** ao ser confirmado (→ Comprometida) ou recusado (→ Descartada).
- **Transições permitidas:** Proposta → Comprometida; Proposta → Descartada.
- **Transições proibidas:** Proposta → (origina Mission) sem passar por
  Comprometida; retornar a "nada".

**Comprometida (Committed)** — *terminal, imutável*
- **Significado:** o veredito é **agir**. Este é o único estado que **origina
  Mission**.
- **Quando entra:** quando o julgamento de agir é assumido.
- **Quando sai:** nunca. É imutável.
- **Transições permitidas:** nenhuma para fora (origina uma ou mais Missions **no
  ato** de comprometer; a Decision em si não muda mais).
- **Transições proibidas:** virar Descartada; ser "editada".

**Descartada (Dismissed)** — *terminal, imutável*
- **Significado:** o veredito é **não agir** (o Sinal não merece trabalho, é
  irrelevante, ou foi superado). Registra explicitamente a não-ação.
- **Quando entra:** quando se julga que nada deve ser feito.
- **Quando sai:** nunca.
- **Transições proibidas:** originar Mission (ver Estados Proibidos, §8).

### Respostas exigidas
- **Quando nasce?** Quando um julgamento é formado sobre Sinais (estado Proposta).
- **Quando termina?** Ao alcançar Comprometida ou Descartada — ambos terminais e
  imutáveis.
- **Quando pode ser descartada?** A partir de Proposta, quando se julga não agir
  (inclui julgamento de que ficou obsoleta/superada).
- **Quando gera Mission?** Somente ao ser **Comprometida** — nunca antes, nunca a
  partir de Descartada.

---

## 4. Máquina de Estados da Mission

A Mission modela o **ciclo de vida do trabalho comprometido**. Modelo completo, sem
simplificação.

### Estados

**Planejada (Planned)**
- **Significado:** a Missão **existe** como trabalho comprometido, mas ainda **não
  está pronta** para ser conduzida (falta contexto/pré-condições).
- **Entra:** ao nascer de uma Decision Comprometida.
- **Sai:** quando as pré-condições são satisfeitas (→ Pronta) ou se for abandonada
  (→ Cancelada).

**Pronta (Ready)**
- **Significado:** todas as pré-condições estão satisfeitas; a Missão **pode ser
  conduzida**.
- **Entra:** de Planejada (pré-condições cumpridas), de Aguardando (bloqueio
  resolvido) ou de Falha (reaberta para nova tentativa).
- **Sai:** ao iniciar a condução (→ Em Execução), ao surgir um bloqueio
  (→ Aguardando) ou ao ser abandonada (→ Cancelada).

**Em Execução (Active)**
- **Significado:** o trabalho está **em curso** — existe ao menos uma Action a
  caminho.
- **Entra:** de Pronta.
- **Sai:** ao alcançar o propósito (→ Concluída), ao falhar uma tentativa
  (→ Falha), ao bloquear em dependência externa (→ Aguardando) ou ao ser abortada
  (→ Cancelada).

**Aguardando (Waiting)**
- **Significado:** a Missão está **suspensa esperando algo externo** (uma
  dependência, uma pré-condição que regrediu, uma entrada necessária). Distinto de
  Pronta: Pronta *pode* andar; Aguardando *não pode ainda*.
- **Entra:** de Em Execução (bloqueio) ou de Pronta (pré-condição regrediu).
- **Sai:** quando o bloqueio some (→ Pronta ou → Em Execução) ou por abandono
  (→ Cancelada).

**Falha (Failed attempt)** — *não terminal*
- **Significado:** uma **tentativa não teve sucesso**. A Missão **não está feita**;
  aguarda um julgamento: tentar de novo ou desistir.
- **Entra:** de Em Execução, quando uma Action essencial falha.
- **Sai:** ao ser **reaberta** (→ Pronta) ou ao se **desistir** (→ Cancelada).
- **Importante:** Falha **não** é terminal. Nada fica "permanentemente falho" sem
  uma decisão explícita de desistência (Cancelada), preservando governança.

**Concluída (Completed)** — *terminal*
- **Significado:** o **propósito foi alcançado**. Final.
- **Entra:** de Em Execução, quando as Actions essenciais concluíram.
- **Sai:** nunca. Uma Missão Concluída **jamais retorna** a planejamento; uma nova
  necessidade sobre o mesmo alvo é uma **nova** Missão (nova Decision).

**Cancelada (Cancelled)** — *terminal*
- **Significado:** a Missão foi **deliberadamente abandonada** antes de concluir
  (inclui "irrecuperável": a desistência formal após falhas).
- **Entra:** de qualquer estado não-terminal (Planejada, Pronta, Em Execução,
  Aguardando, Falha).
- **Sai:** nunca.

### Respostas exigidas
- **Nasce** ao ser originada por uma Decision Comprometida (Planejada).
- **Está pronta** quando as pré-condições são satisfeitas (Pronta).
- **Entra em execução** ao ser conduzida com Actions a caminho (Em Execução).
- **Aguarda** quando bloqueada por algo externo (Aguardando).
- **Falha** quando uma tentativa não tem sucesso (Falha — não terminal).
- **É cancelada** por abandono deliberado (Cancelada — de qualquer não-terminal).
- **Termina** ao Concluir ou Cancelar.
- **Pode ser reaberta** apenas de **Falha** (→ Pronta); **nunca** de Concluída.
- **Nunca mais muda** ao alcançar Concluída ou Cancelada.

---

## 5. Máquina de Estados da Action

A Action modela **apenas o comportamento da execução** de um passo da Missão.

### Estados

**Planejada (Planned)**
- O passo está **definido** dentro da Missão, mas ainda não foi pedido. Existe como
  intenção, não como pedido.

**Solicitada (Requested)**
- A Missão **pediu formalmente** o passo ao domínio dono (Publicação, Integrações…).
  O pedido saiu, mas ainda não foi assumido.

**Aceita (Accepted)**
- O domínio dono **assumiu a responsabilidade**: o pedido é válido e será tentado.
  Ainda não começou.

**Executando (Executing)**
- O passo está **em curso** no domínio dono. Nenhum Resultado ainda.

**Concluída (Completed)** — *terminal (salvo compensação)*
- O passo **alcançou seu resultado**. Produz obrigatoriamente um **Resultado**.

**Falhou (Failed)** — *terminal (salvo compensação de efeito parcial)*
- O passo **não alcançou** o resultado (rejeitado antes de aceitar, ou falho em
  execução). Produz um **Resultado** que descreve a falha.

**Compensada (Compensated)** — *terminal, quando aplicável*
- Um efeito já produzido (uma conclusão, ou uma falha com efeito parcial) foi
  **deliberadamente revertido** para restaurar consistência. Só existe quando havia
  efeito a desfazer.

### Transições
- Planejada → Solicitada → Aceita → Executando → (Concluída | Falhou).
- Solicitada → Falhou (o dono **recusa** antes de aceitar).
- Concluída → Compensada (quando o efeito precisa ser desfeito).
- Falhou → Compensada (quando houve **efeito parcial** a reverter).
- **Proibidas:** Aceita sem ter sido Solicitada; Executando sem Aceita; Concluída
  sem Resultado; Compensada sem efeito prévio.

> Observação de fronteira: a Action expressa *intenção e desfecho* no domínio; **como**
> o domínio dono executa é responsabilidade dele, fora desta máquina.

---

## 6. Relação entre as máquinas

Como Decision → Mission → Action evoluem em conjunto, e **quem provoca mudança em
quem**:

- **Decision → Mission (criação).** Uma Decision, ao alcançar **Comprometida**,
  **origina** a Mission (nasce Planejada). Depois disso a Decision está terminal e
  **não controla mais** a Mission — ela apenas a **autorizou** e permanece como sua
  justificativa rastreável.
- **Mission → Action (comando).** A Mission, em condução, **origina e comanda** suas
  Actions. O estado da Mission **reflete o agregado** das Actions: entra em *Em
  Execução* quando há Action a caminho; caminha para *Concluída* quando as Actions
  essenciais concluem; vai para *Falha* quando uma Action essencial falha.
- **Action → Mission (informação).** A Action **informa** a Mission pelo seu
  Resultado. O Resultado **sobe**; nunca comanda para baixo.
- **Direção do controle:** para **baixo** (Decision cria Mission; Mission comanda
  Action) é **controle**; para **cima** (Resultado da Action → estado da Mission) é
  **informação**. Nada sobe como comando.
- **Fechamento do laço (novo ciclo):** um Resultado pode originar um novo **Sinal**,
  que alimenta uma **nova Decision**. Isso é um **novo ciclo**, não controle
  retroativo sobre a Decision/Mission originais.

**Quem nunca provoca quem:** uma Action nunca altera a Decision; uma Mission nunca
altera sua Decision de origem; uma Decision terminal nunca altera nada depois de
comprometida (só autorizou o nascimento da Mission).

---

## 7. Invariantes temporais

1. **Mission nunca executa antes de existir** (não há Em Execução sem a Missão ter
   nascido de uma Decision Comprometida).
2. **Action nunca executa sem Mission** (toda Action pertence a uma Mission viva).
3. **Decision terminal nunca muda** (Comprometida/Descartada são imutáveis).
4. **Resultado nunca existe antes da Action** que o produz.
5. **Mission Concluída nunca retorna para planejamento** (Concluída é terminal).
6. **Mission só entra em Em Execução com ao menos uma Action a caminho.**
7. **Action só chega a Executando após Aceita**, e só a Aceita após Solicitada.
8. **Compensada só existe após um efeito** (Concluída ou falha com efeito parcial).
9. **Toda transição é ordenada no tempo e auditável** (histórico append-only).
10. **Decision precede, no tempo, a Mission** que dela nasce.
11. **Reabrir só de Falha** (Falha → Pronta); nunca de um estado terminal.
12. **De um estado terminal não parte transição** (exceto compensação da Action).
13. **Uma Mission só Conclui quando suas Actions essenciais concluíram.**
14. **Cada conceito tem, no máximo, um estado por vez** — não há sobreposição de
    estados.
15. **O tempo não retrocede:** nenhuma transição reescreve estados passados; correção
    é sempre um novo momento.

---

## 8. Estados proibidos (combinações impossíveis)

- **Mission Em Execução sem nenhuma Action** a caminho.
- **Action Concluída sem Resultado.**
- **Action Executando sem ter sido Aceita** (ou Aceita sem ter sido Solicitada).
- **Decision Descartada originando Mission.**
- **Decision Proposta originando Mission** (só Comprometida origina).
- **Mission Concluída sem auditoria** da sua conclusão.
- **Mission Concluída com Action essencial ainda Executando.**
- **Mission reaberta a partir de Concluída** (só de Falha se reabre).
- **Action Compensada sem efeito prévio** (sem Concluída/parcial).
- **Resultado sem Action** que o tenha produzido.
- **Action Executando cuja Mission já está Cancelada ou Concluída.**
- **Mission Pronta/Em Execução sem Decision de origem.**
- **Dois estados terminais ao mesmo tempo** (ex.: Concluída e Cancelada).
- **Decision terminal voltando a Proposta.**
- **Mission Falha tratada como terminal** sem uma decisão explícita (reabrir ou
  Cancelar).

---

## 9. Questões deferidas

> Registradas, não resolvidas. Dependem de documentos futuros.

- **Eventos** — quais notificações cada transição gera e para quem.
- **Persistência** — como estados e histórico são armazenados.
- **IA** — como o Assistente propõe transições (Decisões, condução de Missões).
- **UX** — como estados e transições viram experiência.
- **Política de retry** — quantas reaberturas, com que critério, em Falha.
- **Compensações** — quando e como um efeito é elegível a Compensada.
- **Escalonamento** — como SLA estourado promove atenção/urgência.
- **Pré-condições de "Pronta"** — o que exatamente qualifica uma Missão como pronta.
- **Concorrência de Actions** — como múltiplas Actions de uma Missão coexistem.
- **Cardinalidade Decision→Mission** — quantas Missões uma Decisão pode originar.
- **Temporização** — prazos, expiração de Proposta, janelas de espera.

---

## Critério de longevidade

Esta máquina modela **comportamento de negócio**, não de implementação. Deve
permanecer válida ainda que mude a tecnologia, o banco, o marketplace, a IA ou o
frontend por completo. Cada estado é um momento que faz sentido para um operador; se
uma transição não puder ser explicada na linguagem ubíqua do Modelo de Domínio, ela
não pertence a este modelo.
