# Operation Center — Contrato de Eventos (v1)

> **Natureza.** Este documento define **quais acontecimentos do domínio são
> publicados como eventos** — fatos consumíveis por outros domínios. Não há broker,
> fila, protocolo, formato, nuvem ou implementação aqui — de propósito. Um evento,
> aqui, é um **contrato de negócio**, não um artefato de mensageria.
>
> **Subordinação.** Não altera nem contradiz os documentos aprovados (Arquitetura,
> Modelo de Domínio, Máquina de Estados, Taxonomia de Sinais, Política de
> Priorização, Arquitetura da IA). Todo evento aqui é justificável pela linguagem
> ubíqua já fixada.
>
> **Princípio central.** Um evento é **consequência de uma transição válida do
> domínio** — **nunca sua causa**. Ele registra que algo **já aconteceu**; jamais
> pede que algo aconteça.

---

## 1. Objetivo

Eventos existem para tornar o domínio **observável** sem torná-lo **controlável de
fora**. O domínio evolui internamente por transições válidas (Máquina de Estados);
os eventos são a forma de **outros domínios ficarem sabendo** que essas mudanças
aconteceram, sem precisar olhar para dentro do Operation Center nem depender de sua
mecânica.

Três verdades definem o papel do evento:

- **Eventos tornam o domínio observável.** São a janela pela qual o resto do sistema
  vê o que ocorreu.
- **Eventos não controlam o domínio.** Nenhum evento provoca uma transição; ele
  apenas **relata** uma que já foi provocada por dentro.
- **Eventos representam fatos permanentes de negócio** — "uma Missão foi concluída",
  "uma Ação falhou" — independentes de qualquer tecnologia de transporte.

---

## 2. Princípios

1. **Evento representa fato consumado.** Sempre no passado; nunca no futuro.
2. **Evento nasce de uma transição válida.** Sem mudança de estado legítima, não há
   evento.
3. **Evento é imutável.** Uma vez publicado, não muda; uma nova realidade é um novo
   evento.
4. **Evento nunca é comando.** Não instrui, não pede, não obriga ninguém.
5. **Evento nunca altera estado.** Ele é resultado de uma mudança, não sua origem.
6. **Evento pertence ao domínio.** É o domínio quem decide o que é um fato digno de
   ser comunicado; o significado é de negócio.
7. **Transporte é responsabilidade da infraestrutura.** Como o evento viaja, é
   entregue, ordenado ou repetido não pertence a este contrato.
8. **Evento nomeia o fato, nunca a reação.** "Missão concluída", não "atualize o
   painel".
9. **O domínio é completo sem consumidores.** A correção do Operation Center não
   depende de ninguém reagir a evento algum.
10. **Estados são a verdade; eventos são o eco.** Se todos os eventos sumissem, os
    estados (a verdade) continuariam corretos.
11. **Evento referencia por identidade.** Aponta para Operação/Missão/Ação por
    identidade; **não carrega** a verdade de outro domínio.

---

## 3. Origem dos eventos

Apenas entidades do domínio, ao atravessarem **transições válidas**, originam
eventos. Nenhuma outra fonte pode "emitir" um fato do domínio.

- **Signal** — ao ser **observado** (sua transição para a existência). O fato: "o
  domínio registrou que a realidade mudou". Estes eventos servem sobretudo à
  **observabilidade e auditoria** — os fatos operacionalmente relevantes para outros
  domínios vêm sobretudo de Decision, Mission, Action e Result.
- **Decision** — ao ser **proposta**, **comprometida** ou **descartada**. O momento
  de maior peso é a **comprometida**, pois é a única que origina Missão.
- **Mission** — a cada transição do seu ciclo de vida (formada, pronta, iniciada, em
  espera, tentativa falhou, reaberta, concluída, cancelada).
- **Action** — a cada transição da sua execução (solicitada, aceita, iniciada,
  concluída, falhou, compensada).
- **Result** — ao ser **registrado** como desfecho de uma Ação.

Regra de origem: **um evento corresponde a exatamente uma transição válida** (ou ao
nascimento/observação de uma entidade). Onde não houve mudança legítima, não há
evento.

---

## 4. Catálogo conceitual de eventos

> Por entidade. Para cada evento: **significado · quando ocorre · qual fato
> representa · quem observa · o que NÃO significa.** Sem payload, sem formato.

### Originados por Signal

**Fato Operacional Observado** — o domínio registrou um fato da realidade.
- *Quando:* ao um Signal ser observado.
- *Fato:* "algo mudou na realidade e o domínio tomou ciência".
- *Observa:* observabilidade, auditoria; internamente, o próprio julgamento.
- *NÃO significa:* um pedido de ação, nem que algo será feito.

### Originados por Decision

**Decisão Proposta** — um julgamento foi formado, ainda não comprometido.
- *Quando:* ao entrar no estado Proposta.
- *Fato:* "existe um julgamento candidato".
- *Observa:* sobretudo o operador e as superfícies assistidas.
- *NÃO significa:* que se agirá — pode ser descartada.

**Decisão Comprometida** — o veredito de agir foi assumido.
- *Quando:* ao a Decisão se tornar terminal-comprometida.
- *Fato:* "decidiu-se agir; uma ou mais Missões nascem disto".
- *Observa:* Operação, supervisão, auditoria.
- *NÃO significa:* que o trabalho começou — apenas que foi autorizado.

**Decisão Descartada** — o veredito de **não** agir foi assumido.
- *Quando:* ao a Decisão se tornar terminal-descartada.
- *Fato:* "julgou-se que nada deve ser feito".
- *Observa:* auditoria, supervisão.
- *NÃO significa:* que o fato original deixou de existir — só que não gerou trabalho.

### Originados por Mission

**Missão Formada** — nasceu uma unidade de trabalho comprometida.
- *Fato:* "há trabalho comprometido para uma Operação". *NÃO significa:* que está
  pronto para ser conduzido.

**Missão Pronta** — as pré-condições foram satisfeitas.
- *Fato:* "o trabalho pode ser conduzido". *NÃO significa:* que começou.

**Missão Iniciada** — o trabalho entrou em condução.
- *Fato:* "há execução em curso". *NÃO significa:* que terá sucesso.

**Missão Em Espera** — o trabalho ficou bloqueado por algo externo.
- *Fato:* "há um bloqueio". *NÃO significa:* falha — apenas suspensão.

**Missão — Tentativa Falhou** — uma tentativa não teve sucesso.
- *Fato:* "uma tentativa falhou; a Missão não está feita". *NÃO significa:* que a
  Missão terminou (Falha não é terminal).

**Missão Reaberta** — voltou à condução após uma falha.
- *Fato:* "decidiu-se tentar de novo". *NÃO significa:* garantia de sucesso.

**Missão Concluída** — o propósito foi alcançado. *(terminal)*
- *Fato:* "o trabalho foi cumprido". *Observa:* Operação, indicadores, supervisão,
  e frequentemente o cliente. *NÃO significa:* venda garantida nem ausência de novos
  fatos futuros.

**Missão Cancelada** — o trabalho foi deliberadamente abandonado. *(terminal)*
- *Fato:* "desistiu-se, com Motivo". *NÃO significa:* falha técnica — é decisão.

### Originados por Action

**Ação Solicitada** — um passo entrou no estado de pedido.
- *Quando:* ao a Action transicionar para Solicitada, dentro de uma Missão.
- *Fato:* "o domínio requisitou um passo a um módulo dono".
- *Observa:* o módulo dono (Publicação, Integrações…).
- *NÃO significa:* um **comando** nem uma **intenção futura** — é o fato de que a
  Action está em Solicitada. *(Como esse pedido efetivamente chega ao dono é
  transporte — deferido; ver §9.)*

**Ação Aceita** — o módulo dono assumiu a responsabilidade pelo passo.
- *Fato:* "o pedido é válido e será tentado". *NÃO significa:* que já executou.

**Ação Iniciada** — o passo entrou em execução no dono.
- *Fato:* "há execução em curso". *NÃO significa:* desfecho.

**Ação Concluída** — o passo alcançou seu resultado.
- *Fato:* "o passo terminou com Resultado". *NÃO significa:* que a Missão inteira
  concluiu.

**Ação Falhou** — o passo não alcançou seu resultado.
- *Fato:* "o passo falhou, com Resultado que o descreve". *NÃO significa:* que a
  Missão está perdida (pode reabrir).

**Ação Compensada** — um efeito já produzido foi deliberadamente revertido.
- *Fato:* "desfez-se um efeito para restaurar consistência". *NÃO significa:* que a
  Ação nunca ocorreu — ocorreu e foi compensada.

### Originados por Result

**Resultado Registrado** — um desfecho foi registrado.
- *Quando:* ao um Resultado de Ação ser gravado.
- *Fato:* "aconteceu isto com aquele passo".
- *Observa:* indicadores, e potencialmente a realidade que gera **novos Signals**.
- *NÃO significa:* uma métrica agregada — é o desfecho de um passo específico.

---

## 5. Relação entre Eventos e Signals

Signal e Evento **não são a mesma coisa**, e confundi-los é um erro estrutural.

- **Signal pertence ao domínio interno.** É o fato **de entrada** — algo aconteceu
  na realidade e o domínio tomou ciência. Flui **para dentro** (realidade →
  domínio).
- **Evento comunica que algo relevante ocorreu.** É o fato **de saída** — uma
  transição válida aconteceu dentro do domínio e outros podem ficar sabendo. Flui
  **para fora** (domínio → observadores).

A relação entre eles é **muitos-para-muitos e não trivial** — nunca um espelho:

- **Um Signal pode gerar vários eventos.** Um único fato observado pode desencadear
  uma cascata de transições (uma Decisão comprometida, uma Missão formada, uma Ação
  solicitada…), cada uma originando o seu evento.
- **Vários Signals podem culminar em um único evento.** Muitos fatos, pesados em
  conjunto, podem levar a **uma** transição — e portanto a **um** evento (ex.: vários
  sinais de estoque/pausa culminando numa única "Saúde Degradou", ou vários Signals
  pesados por **uma** Decisão que se compromete).

Erro a evitar: tratar o Signal como se fosse o Evento — **republicar cada Signal como
evento** confunde a **entrada** do domínio com a sua **saída**. O Signal alimenta o
julgamento; o Evento relata o que o domínio decidiu/fez. São planos distintos.

---

## 6. Relação entre Eventos e Estados

Eventos existem **porque houve uma transição** — e só por isso.

- **Nenhum evento existe sem mudança válida.** Se não houve transição legítima na
  Máquina de Estados, não há fato a comunicar; um evento sem transição é uma ficção.
- **Estados continuam sendo a verdade.** O estado atual de cada entidade é o sistema
  de registro; é ele que diz o que é verdadeiro **agora**.
- **Eventos apenas registram que a mudança aconteceu.** São **derivados** da
  transição, nunca a transição em si. Um evento é o **eco** de uma mudança de estado,
  não a mudança.
- **Um evento ↔ uma transição.** Cada evento corresponde a exatamente uma transição
  válida (ou ao nascimento/observação de uma entidade). Transições inválidas não
  ocorrem e, portanto, nada emitem.

Consequência de longevidade: se toda a camada de eventos fosse apagada, os **estados
permaneceriam corretos**. Eventos são uma camada de **observabilidade** sobre a
verdade, nunca a verdade.

---

## 7. Consumo

Consumidores **observam** eventos — e apenas isso, no que toca ao Operation Center.

- **Consumidores nunca controlam o domínio.** Reagir a um evento é assunto **do
  consumidor, dentro do domínio dele**; não é um laço de controle de volta ao
  Operation Center.
- **Consumidores nunca reinterpretam a política.** A Política de Priorização (e
  qualquer política de negócio) é do domínio; um consumidor não a redefine ao
  consumir.
- **Consumidores nunca alteram invariantes.** Nada que um consumidor faça pode violar
  as regras invioláveis do Operation Center.
- **O domínio não depende da reação de ninguém.** A correção do Operation Center não
  pressupõe que um consumidor tenha observado ou reagido a um evento.

Quando a reação de um consumidor gera um novo fato relevante para o Operation Center,
esse fato **entra como um novo Signal** (a realidade mudou de novo) — o que é o
**laço do domínio**, não controle retroativo.

---

## 8. Anti-modelos

Erros arquiteturais que nunca devem acontecer:

- **Evento usado como comando** ("faça X") — evento nunca instrui.
- **Evento disparando lógica obrigatória** dentro do domínio — o domínio não depende
  de alguém reagir a um evento para estar correto.
- **Evento alterando estado** — ele é consequência, nunca causa de transição.
- **Evento substituindo entidades** — o evento não é fonte de verdade; os estados
  são.
- **Evento contendo regras de negócio** — política e invariantes vivem no domínio,
  não no fato comunicado.
- **Evento representando intenção futura** ("vai acontecer") — evento é sempre fato
  consumado.
- **Evento como chamada/pedido** (RPC disfarçado) — comunicar um fato não é solicitar
  uma resposta.
- **Consumidor controlando o domínio** via evento.
- **Evento carregando a verdade de outro domínio** — deve referenciar por identidade.
- **Acoplar a correção do domínio à entrega do evento** — a verdade não pode depender
  do transporte.
- **Republicar cada Signal como evento** — confundir entrada com saída do domínio.
- **Evento fabricado sem transição** que o justifique.

---

## 9. Questões deferidas

> Pertencem a documentos futuros e à infraestrutura.

- **Formato físico** dos eventos.
- **Versionamento** e evolução dos contratos.
- **Transporte** (broker, protocolo, nuvem).
- **Entrega** (garantias, semântica).
- **Retries** e reprocessamento.
- **Ordenação** entre eventos.
- **Idempotência técnica** no consumo.
- **Observabilidade** técnica da camada de eventos.
- **Correlação/causalidade** técnica entre eventos.
- **Como um pedido de Ação chega ao módulo dono** (o mecanismo, não o fato).

---

## Critério de longevidade

Este contrato deve permanecer válido independentemente da tecnologia de mensageria,
do protocolo, do broker, do formato ou da nuvem. Os eventos representam **fatos
permanentes do negócio** — "uma Decisão foi comprometida", "uma Missão foi
concluída", "uma Ação falhou". Se um dia um "evento" no Zion instruir, obrigar,
alterar estado ou representar intenção futura, ele deixou de ser um evento de domínio
e passou a ser outra coisa — e este contrato terá sido violado.
