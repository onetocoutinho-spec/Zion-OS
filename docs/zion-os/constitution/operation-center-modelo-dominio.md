# Operation Center — Modelo de Domínio (v1)

> **Aviso de natureza.** Este é um documento de **domínio de negócio**. Não há
> aqui banco, ORM, linguagem, API, evento, fila, serviço, tela ou componente — de
> propósito. Ele descreve os **conceitos** e a **linguagem ubíqua** do Operation
> Center. Toda decisão técnica futura deverá **derivar** deste modelo, nunca
> contradizê-lo.

---

## 1. Objetivo do modelo

Este documento existe para **fixar a linguagem ubíqua** do Operation Center: o
conjunto de conceitos que operadores, produto, arquitetura e IA usarão com o
**mesmo significado**. Ele responde "de que o Operation Center é feito, como
conceito de negócio" — não "como se constrói".

Decisões de implementação (máquina de estados, persistência, eventos, IA, UX)
serão tomadas em documentos posteriores e **subordinadas** a este. Se um dia a
tecnologia mudar por completo, este modelo deve continuar correto.

Uma regra de leitura orienta tudo: o Operation Center gira em um único laço de
negócio — **um fato é observado, um julgamento é feito, um trabalho é comprometido,
uma ação é executada, um resultado é medido**. Os conceitos abaixo são exatamente
as peças desse laço.

---

## 2. Linguagem Ubíqua

> Somente linguagem de negócio. Cada termo tem definição, significado, exemplos e
> o que **não** significa.

### Operação (Operation)
- **Definição:** a operação de e-commerce de **um cliente em um canal** (e a visão
  consolidada dela).
- **Significado:** é o *sujeito* do módulo — aquilo sobre o que tudo acontece. Tem
  um estado e uma saúde.
- **Exemplos:** "a operação da Chinelaria no Mercado Livre".
- **NÃO é:** o cliente, o produto, o anúncio nem o canal. É a *atividade* de operar,
  não as coisas operadas.

### Sinal (Signal)
- **Definição:** um **fato observado** sobre uma Operação que **pode** merecer
  atenção.
- **Significado:** é matéria-prima. Puro fato, sem opinião e sem ação.
- **Exemplos:** "um anúncio foi pausado", "faltou estoque", "uma publicação
  falhou", "o catálogo está incompleto", "o canal expirou".
- **NÃO é:** uma ordem, uma tarefa nem uma decisão. Um Sinal **não faz nada** — só
  informa que algo é verdade.

### Decisão (Decision)
- **Definição:** o **julgamento** de que (e como) se deve agir diante de um ou mais
  Sinais — ou de que **não** se deve agir.
- **Significado:** é a ponte entre observar e agir. Captura a **triagem/priorização**
  como um ato de negócio explícito e auditável (quem decidiu, quando, com base em
  quê).
- **Exemplos:** "estes 12 produtos prontos valem uma missão de publicação, com
  prioridade alta"; "este sinal de estoque é irrelevante hoje — descartar".
- **NÃO é:** a execução do trabalho, nem a tarefa em si. Uma Decisão **conclui em
  um julgamento**, não em um resultado operacional.

### Missão (Mission)
- **Definição:** uma **unidade de trabalho comprometida**, com propósito, alvo,
  prioridade e prazo.
- **Significado:** é o que o operador (ou a IA) efetivamente "pega para fazer". É a
  materialização de uma Decisão em trabalho.
- **Exemplos:** "publicar os 12 chinelos femininos da Chinelaria"; "reconectar o
  canal do Cliente X".
- **NÃO é:** o fato que a originou (Sinal), o julgamento (Decisão) nem o passo
  técnico (Ação). Uma Missão **não publica** — ela *coordena* o que precisa
  acontecer.

### Ação (Action)
- **Definição:** um **passo concreto** executado como parte de uma Missão.
- **Significado:** é a intenção de fazer algo real ("publicar", "corrigir",
  "pausar", "reconectar"), sempre pertencente a uma Missão e sempre auditável.
- **Exemplos:** "solicitar a publicação do produto Y"; "solicitar a correção de
  estoque do anúncio Z".
- **NÃO é:** a execução técnica em si (isso pertence ao módulo dono) nem um
  julgamento. Uma Ação **não decide**; ela cumpre a Missão.

### Resultado (Outcome)
- **Definição:** o **desfecho** de uma Ação/Missão.
- **Significado:** fecha o laço — sucesso, falha, parcial — e alimenta indicadores
  e, eventualmente, novos Sinais.
- **Exemplos:** "publicado com sucesso"; "falhou por dado faltante"; "parcial:
  8 de 12".
- **NÃO é:** a Ação em si nem uma métrica agregada. É o *que aconteceu* com aquele
  trabalho específico.

### Alvo (Target)
- **Definição:** **aquilo sobre o que** uma Missão/Ação atua, referenciado por
  identidade.
- **Significado:** liga a Missão ao mundo externo (um produto, um anúncio, um
  canal) sem trazer esse mundo para dentro.
- **Exemplos:** "o produto SKU-123"; "o anúncio MLBxxxx"; "o canal ML da Chinelaria".
- **NÃO é:** o próprio produto/anúncio/canal (esses vivem em outros domínios). É
  uma *referência*, nunca a verdade.

### Saúde Operacional (Operational Health)
- **Definição:** a **condição geral** de uma Operação num dado momento.
- **Significado:** um resumo qualitativo (ex.: saudável / em atenção / crítica)
  **derivado** de sinais e resultados.
- **Exemplos:** "operação da Chinelaria em atenção: 3 anúncios pausados".
- **NÃO é:** um número arbitrário nem algo que se "seta". É **derivada**, nunca
  atribuída à mão.

### Prioridade (Priority)
- **Definição:** a **importância relativa** de uma Missão frente às outras.
- **Significado:** ordena a fila; combina impacto e urgência.
- **NÃO é:** a ordem de chegada nem o prazo (SLA). É *quão importante*, não *quando
  vence*.

### SLA
- **Definição:** o **compromisso de prazo** associado a uma Missão.
- **Significado:** define quando o trabalho deveria estar feito e quando está
  "estourado".
- **NÃO é:** a prioridade. Uma Missão pode ser urgente sem ser a mais importante, e
  vice-versa.

### Estado (State)
- **Definição:** o **momento do ciclo de vida** de um conceito (ex.: uma Missão
  pendente, em execução, concluída).
- **NÃO é:** a saúde da Operação nem o resultado. É *onde no ciclo* algo está.

### Motivo (Reason)
- **Definição:** o **porquê** de uma Decisão ou Missão existir.
- **Significado:** dá rastreabilidade e explicabilidade (essencial para IA e
  auditoria).
- **NÃO é:** o Sinal em si. O Sinal é o *fato*; o Motivo é a *justificativa* de agir
  sobre ele.

### Contexto (Context)
- **Definição:** o **conjunto de informações situacionais** que uma Missão carrega
  para ser executada com clareza.
- **Exemplos:** o alvo, os sinais considerados, o que já se sabe, o que falta.
- **NÃO é:** os dados de outro domínio copiados para dentro; é a *situação*, não a
  verdade duplicada.

### Indicador (Indicator)
- **Definição:** uma **medida derivada** da operação ao longo do tempo.
- **Significado:** informa desempenho e saúde no agregado (ex.: time-to-publish,
  cobertura de catálogo).
- **NÃO é:** um comando nem uma entidade que "faz" algo. Indicadores **observam**;
  no máximo alimentam novos Sinais.

### Papéis (Operador, Supervisor, Assistente)
- **Operador:** quem conduz missões. **Supervisor:** quem observa a saúde e
  redistribui. **Assistente (IA):** quem propõe decisões, guia e executa passos.
- **NÃO são** parte do domínio de dados — são **atores** que agem sobre ele.

---

## 3. Entidades

> Conceitos com **identidade** e **ciclo de vida**. Descrição conceitual, não de
> atributos de banco.

### Operação
- **Responsabilidade:** representar e resguardar o estado e a saúde de operar um
  cliente num canal.
- **Identidade:** por cliente + canal (e a visão consolidada).
- **Ciclo de vida:** nasce quando um cliente passa a ser operado num canal; vive
  enquanto essa relação existir; pode ser suspensa.
- **Propriedades conceituais:** sua Saúde Operacional, seu estado atual, as
  referências às Missões que a afetam.
- **Conhece:** que existem Sinais sobre ela e Missões dirigidas a ela.
- **Nunca deve conhecer:** o Mercado Livre, detalhes técnicos de canal, o conteúdo
  interno de produtos/anúncios, nem *como* uma Ação é executada.

### Sinal
- **Responsabilidade:** afirmar um fato observado, de forma imutável.
- **Identidade:** o fato específico observado num instante (esta pausa, agora).
- **Ciclo de vida:** é **criado uma vez** e não muda; sua "resolução" é um **novo**
  fato, não uma mutação.
- **Propriedades conceituais:** o que foi observado, sobre qual Operação, quando,
  com que severidade.
- **Conhece:** a Operação a que se refere.
- **Nunca deve conhecer:** Missões, Ações, decisões ou execução. Um Sinal é inerte.

### Decisão
- **Responsabilidade:** registrar um julgamento sobre agir (ou não) diante de
  Sinais.
- **Identidade:** o ato de decidir específico (quem, quando, sobre quais sinais).
- **Ciclo de vida:** é **feita uma vez** e torna-se imutável; um novo julgamento é
  uma **nova** Decisão.
- **Propriedades conceituais:** os Sinais considerados, o Motivo, e o desfecho do
  julgamento (originar uma Missão ou descartar).
- **Conhece:** os Sinais que pesou e a Operação em questão.
- **Nunca deve conhecer:** *como* a Missão será executada, nem detalhes de canal.

### Missão
- **Responsabilidade:** comprometer e coordenar uma unidade de trabalho até seu
  desfecho.
- **Identidade:** a missão específica (este trabalho, para esta Operação).
- **Ciclo de vida:** proposta/comprometida → em condução → concluída / falha /
  descartada. (Os estados exatos são questão em aberto — §10.)
- **Propriedades conceituais:** propósito, Alvo, Prioridade, SLA, Motivo, Contexto,
  a Operação a que pertence e a Decisão que a autorizou.
- **Conhece:** sua Operação, seu Alvo, sua Decisão de origem e suas Ações.
- **Nunca deve conhecer:** *como* publicar/corrigir tecnicamente, nem o Mercado
  Livre. A Missão coordena; não executa.

### Ação
- **Responsabilidade:** representar um passo concreto de uma Missão e seu Resultado,
  de forma auditável.
- **Identidade:** o passo específico dentro de uma Missão.
- **Ciclo de vida:** solicitada → cumprida (com Resultado) ou falha.
- **Propriedades conceituais:** o que se pediu, sobre qual Alvo, quem/quando, e o
  Resultado.
- **Conhece:** a Missão a que pertence e o Alvo.
- **Nunca deve conhecer:** a Decisão que originou a Missão (execução não julga) nem
  a implementação técnica do módulo dono.

### (Derivado) Indicador
- **Responsabilidade:** expressar medidas agregadas da operação.
- **Natureza:** é **derivado** de Sinais, Missões e Resultados; não guarda regra de
  negócio própria e não comanda nada. Incluído aqui por completude conceitual; sua
  materialização é questão futura.

---

## 4. Agregados

> Raízes de consistência. Mantidas **pequenas**; conceitos externos são
> referenciados por **identidade**, nunca contidos.

### Operação — *Aggregate Root*
- **Por quê:** é o guardião do estado e da Saúde Operacional; a saúde só é
  consistente se derivada dentro dessa fronteira.
- **Contém:** seu próprio estado e sua Saúde.
- **Referencia (não contém):** Sinais, Decisões e Missões (por identidade).
- **Invariantes que protege:** a Saúde é sempre **derivada** e nunca atribuída; a
  Operação não conhece execução.

### Missão — *Aggregate Root*
- **Por quê:** o compromisso de trabalho tem regras próprias (todo trabalho tem
  alvo, prioridade, motivo e desfecho) que precisam de uma fronteira de
  consistência independente da Operação.
- **Contém:** suas **Ações** (uma Ação não existe fora de uma Missão).
- **Referencia:** a Operação, o Alvo e a Decisão de origem (por identidade).
- **Invariantes que protege:** toda Missão tem exatamente uma Operação, um Alvo,
  uma Prioridade, um Motivo e uma Decisão de origem; suas Ações são sempre
  auditáveis.

### Sinal — *Aggregate Root (imutável)*
- **Por quê:** um fato é uma unidade atômica e imutável; não pertence à Missão nem
  à Operação como parte mutável.
- **Contém:** o fato em si.
- **Invariantes:** é imutável; não referencia trabalho.

### Decisão — *Aggregate Root (imutável)*
- **Por quê:** o julgamento precisa existir como registro próprio, separado da
  execução, para garantir a separação decisão/ação e a auditoria.
- **Contém:** o julgamento (Sinais considerados, Motivo, desfecho).
- **Invariantes:** é imutável; precede toda Missão que dela nasce; pode não gerar
  Missão (descarte).

---

## 5. Objetos de Valor

> Sem identidade própria; definidos **pelo seu valor**; imutáveis.

- **Prioridade** — importância relativa (composição de impacto e urgência). É valor:
  duas missões com a "mesma prioridade" são intercambiáveis nesse aspecto.
- **SLA** — compromisso de prazo (janela + condição de estouro). Valor, não entidade.
- **Saúde Operacional** — condição resumida (ex.: saudável/atenção/crítica). Valor
  derivado; não tem ciclo de vida próprio.
- **Contexto** — o pacote situacional que uma Missão carrega. Valor: descreve uma
  situação, não uma coisa com identidade.
- **Resultado** — o desfecho de uma Ação (sucesso/falha/parcial + motivo). Valor.
- **Estado** — o rótulo de momento no ciclo de vida. Valor.
- **Motivo** — a justificativa de uma Decisão/Missão. Valor.
- **Alvo** — referência tipada a algo de outro domínio (produto/anúncio/canal), por
  identidade. Valor: é a referência, não a coisa.
- **Severidade** (de um Sinal) e **Impacto/Urgência** (componentes de Prioridade) —
  valores qualitativos que qualificam Sinais e Missões.

Justificativa geral: nenhum destes precisa ser rastreado por identidade ao longo do
tempo; o que importa é **o valor que carregam** num dado conceito. Modelá-los como
valores impede que "saúde", "prioridade" ou "resultado" virem entidades vivas com
estado próprio — o que corromperia o modelo.

---

## 6. Relações

Em linguagem de domínio:

- **Uma Operação é observada por Sinais.** Sinais são *sobre* uma Operação; a
  Operação não os produz nem os controla.
- **Sinais informam Decisões.** Uma Decisão pesa um ou mais Sinais.
- **Decisões criam Missões — ou descartam Sinais.** Toda Missão nasce de uma
  Decisão; nem toda Decisão gera Missão.
- **Uma Missão pertence a exatamente uma Operação** e aponta para um Alvo.
- **Uma Missão produz Ações.** As Ações existem *dentro* da Missão.
- **Uma Ação produz um Resultado.** O Resultado fecha o laço.
- **Resultados alimentam Indicadores e podem originar novos Sinais** (ex.: uma
  falha vira fato observado).
- **Quem depende de quem:** Decisão depende de Sinais; Missão depende de Decisão e
  de Operação; Ação depende de Missão.
- **Quem observa quem:** Supervisores e Indicadores observam Operações e Missões.
- **Quem nunca conhece quem:**
  - a **Operação** nunca conhece o Mercado Livre nem a execução;
  - o **Sinal** nunca conhece Missão, Ação ou Decisão;
  - a **Decisão** nunca conhece *como* se executa;
  - a **Ação** nunca conhece a Decisão que a originou;
  - **nenhum** conceito conhece a implementação técnica dos módulos donos.

O fio condutor: **Operação ← Sinal → Decisão → Missão → Ação → Resultado → (Indicador / novo Sinal)**.

---

## 7. Invariantes

Regras que **nunca** podem ser violadas:

1. Uma **Missão pertence a exatamente uma Operação**.
2. Uma **Ação nunca existe sem uma Missão**.
3. Um **Sinal nunca executa trabalho nem altera estado** — é fato imutável.
4. Uma **Decisão sempre precede uma Missão** (inclusive missões iniciadas por
   humano encarnam uma Decisão explícita).
5. Uma **Decisão pode não gerar Missão** (descarte é um desfecho válido).
6. **Toda Ação é auditável** (quem, o quê, quando, resultado).
7. Toda **Missão possui Alvo, Prioridade, Motivo, Operação e Decisão de origem**.
8. **Decisão e Sinal são imutáveis**; um novo julgamento ou fato é um novo registro,
   nunca uma mutação do anterior.
9. **Todo Resultado pertence a uma Ação** (não há resultado órfão).
10. A **Saúde Operacional é sempre derivada** de Sinais/Resultados; nunca atribuída
    arbitrariamente.
11. Uma **Missão nunca executa diretamente no canal**; ela expressa Ações que os
    **módulos donos** cumprem.
12. **Decisão e Execução nunca se misturam**: uma Decisão não produz Resultado
    operacional; uma Ação não emite julgamento.
13. Toda Missão preserva **rastreabilidade** até a Decisão e os Sinais que a
    originaram.
14. **Prioridade e SLA são independentes** — importância não é prazo.
15. O Operation Center **nunca detém a verdade** de outro domínio; sempre a
    **referencia** por Alvo.

---

## 8. Limites do domínio

Fronteiras sem sobreposição:

- **Catálogo** — dono da **verdade do Produto** (o que existe para vender, seus
  dados). O OC apenas o referencia via Alvo.
- **Publicação** — dono da **verdade do Anúncio** e da **execução** de publicar /
  republicar / corrigir num canal (inclui a idempotência de Size Charts da Sprint
  0). O OC solicita; Publicação executa.
- **Integrações** — dono da **Conexão de Canal** (autenticação, saúde, e as
  chamadas reais ao Mercado Livre). O OC observa a saúde; nunca fala com o canal.
- **IA** — dona do **raciocínio e da assistência**: propõe Decisões, guia e executa
  passos, explica. O *registro* da Decisão, porém, é do OC (para separação e
  auditoria).
- **Operation Center** — dono de **Operação, Sinal, Decisão, Missão, Ação
  (intenção), Resultado (observado)** e da leitura consolidada (Indicadores/Saúde).

Regra de não-sobreposição: o OC **decide e coordena**; os demais **detêm verdade e
executam**. Nenhum conceito do OC duplica dado ou lógica de outro domínio.

---

## 9. Anti-modelos

Erros que **nunca** devem acontecer:

- **Operação chamando o Mercado Livre diretamente.**
- **Missão publicando/executando anúncios** por conta própria.
- **Sinal alterando estado** ou disparando execução (o Sinal é inerte).
- **Decisão executando trabalho** ou produzindo Resultado operacional.
- **Ação emitindo julgamento** (execução decidindo o que fazer).
- **Missão sem Decisão** ou **Ação sem Missão**.
- **Duplicar a lógica dos módulos especializados** (ex.: reimplementar publicação /
  idempotência dentro do OC).
- **Operação/Missão guardando a verdade** de Produto/Anúncio/Canal (duplicação de
  domínio) em vez de referenciar por Alvo.
- **Indicador comandando comportamento** (Indicadores observam; no máximo geram
  Sinais).
- **IA executando fora das Missões/Ações** (toda ação da IA deve fluir pelos
  conceitos do domínio e ser auditável).
- **Operador agindo fora de uma Missão** (perde rastreabilidade e auditoria).
- **Misturar decisão com execução** em qualquer forma — a violação-mãe da qual
  quase todas as outras derivam.

---

## 10. Questões em aberto

> Não inventar respostas. Apenas o que dependerá de documentos futuros.

- **Máquina de estados** — os estados exatos e transições de Missão e Decisão.
- **Eventos** — como os fatos propagam entre domínios.
- **Persistência** — como os conceitos são armazenados.
- **IA** — como o Assistente propõe Decisões, guia e executa Missões.
- **UX** — como o laço vira experiência.
- **Priorização** — como a Prioridade é composta a partir de impacto e urgência.
- **Política de SLA** — como prazos são definidos por tipo de Missão.
- **Taxonomia de Sinais e Severidade** — o catálogo de fatos observáveis.
- **Consolidação** — como Operações por canal compõem visões por cliente e por
  operador.
- **Janelas de Indicadores** — períodos e formas de agregação.

---

## Critério de longevidade

Este modelo é deliberadamente independente de tecnologia, linguagem, banco,
framework e integração. Se, daqui a cinco anos, o Zion OS trocar toda a sua stack,
os conceitos aqui — **Operação, Sinal, Decisão, Missão, Ação, Resultado**, e a
separação inviolável entre **decidir** e **executar** — devem permanecer verdadeiros.
