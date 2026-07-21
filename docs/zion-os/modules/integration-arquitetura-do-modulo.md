# Integration — Arquitetura do Módulo (v1)

> **Natureza.** Arquitetura **lógica interna** do módulo Integration. Não há conector,
> API, SDK, protocolo, mensageria, infraestrutura ou implementação — de propósito.
> Responde **como o módulo se organiza**, nunca **como se implementa**.
>
> **Subordinação.** Não altera nem contradiz a Constituição do Zion OS, a Arquitetura
> do Sistema, nem os módulos Operation Center e Publication; segue a **mesma
> anatomia**, mudando apenas **qual verdade** protege.

---

## 1. Objetivo

Integration é o **Anti-Corruption Layer do Zion**: a **única** parte do sistema
autorizada a falar línguas estrangeiras. Todo contato com o mundo externo —
marketplaces, ERP, qualquer sistema de terceiros — passa por aqui, e **nada** atravessa
sem ser **traduzido** para a linguagem oficial do Zion.

Seu papel é **proteger o domínio**. Enquanto os outros módulos cuidam de verdades de
negócio (o produto, a intenção de publicação, a operação), Integration cuida de uma
única coisa: **que o interior do Zion jamais precise conhecer as particularidades de
quem está do lado de fora**.

Duas afirmações delimitam o módulo com precisão:

- **Integration não executa o negócio.** Ele **traduz contextos** e **executa
  conversas**. Publicar é intenção da Publication; decidir é do Operation Center; o
  produto é do Catalog. Integration apenas realiza o diálogo e devolve fatos.
- **Integration é uma fronteira, não uma passagem.** Nada passa "através" dele em
  estado bruto. Tudo que entra é convertido em **fato do Zion**; tudo que sai é
  convertido na exigência de cada canal.

Sua missão permanente: **impedir que qualquer modelo externo atravesse as fronteiras do
Zion.** Se um dia um conceito de marketplace aparecer dentro de outro módulo, foi este
módulo que falhou.

---

## 2. Responsabilidades

**Pertence exclusivamente ao Integration:**

- **Conexões** — a ponte de um cliente com um sistema externo: sua existência, validade
  e saúde.
- **Credenciais** — a custódia do que autoriza o Zion a falar em nome de um cliente
  (apenas a custódia; o mecanismo é deferido).
- **Canais** — o conhecimento de quais contrapartes externas existem e como se
  comportam.
- **Capacidades dos canais** — o que cada canal **suporta** e o que **exige**, expresso
  **na linguagem do Zion** para que os demais módulos raciocinem sem conhecer nenhum
  marketplace.
- **Tradução de modelos** — a correspondência entre a linguagem do Zion e a de cada
  canal, nos dois sentidos.
- **Tradução de respostas e de erros** — converter o que o canal devolve (inclusive
  falhas e recusas) em fatos inteligíveis do Zion.
- **Solicitações externas** — os atos de comunicação em si, com seu ciclo de vida.
- **Percepção do estado externo** — o que o canal **reportou**, registrado como
  observação.
- **Reconciliação de comunicação** — garantir que o diálogo seja íntegro: que nenhum
  pedido fique sem desfecho conhecido.
- **Mapeamentos** — o conhecimento de correspondência que sustenta a tradução.

**NÃO pertence ao módulo:**

- a verdade do **Produto** (Catalog), da **intenção de publicação** (Publication) e da
  **operação** (Operation Center);
- o **estado vivo** do marketplace — esse é do próprio canal; Integration apenas
  **observa e reporta**;
- **decidir o que publicar, quando, ou com que prioridade**;
- **regra de negócio** de qualquer espécie — traduzir não é decidir;
- **identidade do cliente e autorização** (Identity & Access);
- **transformar exigência de canal em política do Zion** (ver §7).

---

## 3. Organização Interna

A mesma anatomia dos demais módulos, acrescida do componente que define este:
**Tradutores**.

- **Agregados.** Guardam a verdade do módulo (conexões, canais, comunicações,
  observações) e suas invariantes.
- **Entidades.** Elementos com identidade e ciclo próprios **dentro** dos agregados —
  capacidades de um canal, mapeamentos, tentativas de comunicação.
- **Objetos de Valor.** Definidos pelo valor e imutáveis — estado, validade, desfecho,
  motivo, referência de canal, marca temporal da observação.
- **Casos de Uso.** Orquestram uma intenção de comunicação de ponta a ponta. **Não
  contêm regra de negócio nem regra de tradução.**
- **Policies.** As regras **mutáveis do Zion sobre como conversar**: repetição,
  desistência, alternativa, equivalência, reconciliação, compatibilidade.
- **Factories.** Garantem nascimento válido — uma Conexão só existe referida a um
  cliente e a um canal; uma Comunicação só nasce vinculada a uma solicitação e a uma
  conexão válida.
- **Serviços de Domínio.** Comportamento estável que atravessa agregados: tradução,
  resolução de capacidades, planejamento e reconciliação da comunicação.
- **Tradutores.** O componente assinatura do módulo: convertem **Zion → canal** e
  **canal → Zion**, nos dois sentidos, incluindo respostas e erros. São
  **determinísticos e sem regra de negócio**: sabem *como dizer*, nunca *o que é
  certo*.
- **Observadores.** Fronteira de entrada: acolhem solicitações dos módulos internos
  (como fatos) e o que chega do mundo externo.
- **Publicadores.** Fronteira de saída: emitem os fatos do módulo — **já traduzidos** —
  como consequência de transições válidas.

---

## 4. Casos de Uso

- **Registrar Canal.** Reconhecer a existência de uma contraparte externa e o que se
  sabe sobre suas capacidades.
- **Resolver Capacidades.** Determinar o que um canal suporta e exige para um dado tipo
  de intenção, expressando isso **na linguagem do Zion**.
- **Configurar Conexão.** Estabelecer a ponte de um cliente com um canal e passar a
  zelar por sua validade.
- **Registrar Perda de Validade da Conexão.** Reconhecer que a ponte deixou de ser
  utilizável, tornando esse um fato conhecido do Zion.
- **Enviar Solicitação.** Realizar o ato de comunicação: tomar uma solicitação expressa
  em linguagem do Zion, traduzi-la para a exigência do canal e conduzi-la.
- **Receber Resposta.** Acolher o que o canal devolveu, ainda em linguagem estrangeira.
- **Traduzir Resposta.** Converter o retorno em um **fato do Zion**, inteligível sem
  qualquer conhecimento do canal.
- **Traduzir Erro.** Converter recusas e falhas — incluindo as idiossincráticas de cada
  canal — em motivos compreensíveis na linguagem do Zion.
- **Reconhecer Divergência.** Perceber que o que o canal reporta não corresponde ao que
  foi solicitado, e registrar isso como fato.
- **Atualizar Percepção.** Registrar, como observação datada, o que o canal informou
  sobre o estado externo.
- **Notificar Domínio.** Publicar os fatos traduzidos para que os módulos donos reajam
  dentro das suas fronteiras.
- **Reconciliar Comunicação.** Assegurar que todo pedido tenha desfecho conhecido — e
  tratar os que ficaram sem resposta como fato próprio.

---

## 5. Organização do Domínio

**Agregados:**

- **Channel** *(raiz)* — a contraparte externa conhecida e o seu comportamento. Contém
  suas **Capabilities** (o que suporta e o que exige) e os **Mapeamentos** que
  sustentam a tradução. É conhecimento relativamente estável sobre *como aquele mundo
  funciona*.
- **Connection** *(raiz)* — a ponte de um cliente específico com um canal. Identidade:
  cliente + canal. Guarda a custódia das credenciais, a **validade** e a **saúde** da
  ponte, com seu ciclo de vida.
- **Communication** *(raiz)* — um **ato de conversa**: a solicitação expressa, a
  tradução aplicada, o envio, o retorno e o desfecho. Contém suas tentativas.
- **External Observation** *(raiz, imutável)* — o que o canal reportou, **já traduzido**,
  num instante. Como todo fato, não muda; nova informação é nova observação.

**Entidades internas:** Capability e Mapping (dentro de Channel); Tentativa (dentro de
Communication).

**Objetos de Valor:** estado da conexão; estado da comunicação; validade; desfecho;
motivo traduzido; referência de canal e de cliente por identidade; marca temporal da
observação.

**Estados da Connection:** *Configurada* → *Válida* → *Inválida* (perdeu validade) →
*Revalidada*; e *Encerrada* como terminal.
**Estados da Communication:** *Planejada* → *Emitida* → *Respondida* ou *Sem Resposta*
→ *Traduzida* (com desfecho conhecido) ou *Falhou*.

**Invariantes que o módulo protege:**

- Uma Connection refere-se a **exatamente um** cliente e **um** canal.
- Uma Communication **nunca** existe sem solicitação de origem e sem uma Connection.
- **Nada sai** do módulo em linguagem estrangeira; **nada entra** no Zion sem tradução.
- **Nenhuma regra de negócio** habita tradutores ou mapeamentos.
- Observações externas são **imutáveis** e explicitamente datadas.
- Toda Communication termina com **desfecho conhecido** — inclusive "sem resposta" é um
  desfecho.
- **Traduzir nunca é decidir**: o módulo não escolhe o que deve ser feito.

**Relacionamentos:** Connection referencia Channel e cliente por identidade;
Communication referencia a Connection e a solicitação de origem; Observation referencia
o Channel e o alvo externo por identidade. Nada é aberto para fora.

---

## 6. Serviços de Domínio

- **Translation.** O **ato** de traduzir, nos dois sentidos, apoiado no conhecimento de
  mapeamento que vive no Channel. *(O mapeamento é conhecimento; a tradução é
  comportamento — por isso um é agregado e o outro, serviço.)*
- **Capability Resolution.** Determinar, para uma intenção expressa em linguagem do
  Zion, o que aquele canal suporta e exige — e expressar isso genericamente.
- **Communication Planning.** Determinar como um ato de conversa deve ser conduzido:
  em quantas partes, em que ordem, com que dependências entre etapas.
- **Retry Planning.** Determinar se e como uma tentativa deve ser repetida, conforme a
  política vigente.
- **Reconciliation.** Confrontar solicitações e desfechos para que nenhum diálogo fique
  em aberto.
- **Consistency.** Assegurar que conexões, comunicações e observações contem a mesma
  história — sem comunicações órfãs nem observações sem origem.

---

## 7. Policies

As Policies deste módulo são as **regras mutáveis do Zion sobre como conversar** —
nunca sobre o que fazer.

- **Retry.** Quando e quantas vezes repetir uma tentativa.
- **Timeout.** Quanto tempo esperar antes de considerar um diálogo sem resposta.
- **Fallback.** O que fazer quando o caminho principal não está disponível.
- **Equivalência.** Quando duas comunicações são consideradas a mesma.
- **Idempotência de Comunicação.** Como evitar que o **mesmo ato de conversa** seja
  realizado duas vezes. *(Distinta da idempotência de intenção, que é da Publication:
  aquela protege a presença; esta protege o diálogo.)*
- **Reconciliação.** Com que critério e frequência confrontar pedidos e desfechos.
- **Compatibilidade.** Como lidar com canais cujo comportamento mudou.
- **Resolução de Capacidade.** Como o Zion procede quando as capacidades de um canal são
  desconhecidas ou ambíguas — por exemplo, assumindo a postura mais conservadora.

### Regra do canal × Regra do Zion

Esta é a distinção mais importante do módulo.

- Uma **regra do canal** é um **fato sobre o mundo externo**: o canal exige tal
  informação, recusa tal formato, limita tal quantidade. Ela **não é** uma regra do
  Zion. É modelada como **Capability** — conhecimento sobre a contraparte — e honrada
  **na tradução**.
- Uma **regra do Zion** é uma decisão nossa: quantas vezes repetir, quanto esperar, o
  que consideramos equivalente, como reconciliar. Essas são **Policies**, e pertencem a
  nós.

A confusão entre as duas é o modo mais comum de corrupção arquitetural: uma exigência
de marketplace vira, por descuido, uma invariante do Zion. O procedimento correto é
outro — a exigência do canal é **traduzida em capacidade**, publicada como **fato**, e
então **outro módulo**, no seu próprio domínio e vocabulário, decide o que fazer com
essa informação. Assim, o Zion continua raciocinando em Zion, e o canal continua sendo
apenas o canal.

---

## 8. Colaboração Interna

O padrão do módulo, sem tecnologia e sem protocolo:

- Um **Observador** acolhe uma **Solicitação** expressa na linguagem do Zion.
- Um **Caso de Uso** orquestra: obtém a **Connection**, consulta **Policies** e aciona
  o **Serviço de Domínio** apropriado.
- Um **Tradutor** converte a solicitação para a **exigência do canal**, apoiado nas
  **Capabilities** e nos **Mapeamentos** daquele Channel.
- A **Communication** conduz o ato de conversa e registra sua tentativa.
- O **canal responde** — em linguagem estrangeira.
- Um **Tradutor** converte a resposta (ou o erro) em **fato do Zion**.
- A transição da Communication produz o **desfecho** e, quando cabe, uma **Observação
  Externa** imutável.
- O **Publicador** emite o fato — **já traduzido** — para que os módulos donos reajam.

Duas fronteiras internas jamais se cruzam: **o Tradutor não decide** (não conhece regra
de negócio) e **o Caso de Uso não traduz** (não conhece a língua do canal).

---

## 9. Relação com outros módulos

Sempre por **fatos**, nunca por modelos internos:

- **Publication.** Integration **observa** suas solicitações (publicar, atualizar,
  encerrar), realiza o diálogo e **devolve fatos traduzidos**. **Nunca** conhece a
  intenção por dentro, nunca decide o que publicar.
- **Catalog.** Integration **traduz** o que sistemas externos informam sobre itens
  (por exemplo, disponibilidade e preço vindos de um ERP) e **publica como fatos**. O
  Catalog decide o que fazer com eles. Integration **nunca** altera Produto.
- **Operation Center.** Integration **publica** fatos de canal (ponte estabelecida,
  perdida, recusa do canal, indisponibilidade) que o Operation Center observa como
  sinais. **Nunca** recebe ordens de prioridade nem coordena nada.
- **Identity & Access.** Integration **consulta** quem pode agir e **referencia** o
  cliente por identidade. A conexão é sua; a identidade **não é**.
- **AI Services.** Pode **ajudar a explicar** um erro externo ou a interpretar um
  comportamento de canal. **Nunca define a tradução** — tradução é conhecimento
  determinístico do módulo, não recomendação.

---

## 10. Capacidades Transversais

Participam **nas bordas** e **nunca alteram a verdade do módulo**:

- **IA.** Interpreta e explica; não traduz, não decide, não muta agregados.
- **Autorização.** Aferida antes de qualquer ato que use uma conexão em nome de um
  cliente; é portão, não verdade do módulo.
- **Auditoria.** Registra comunicações e traduções de forma **append-only** —
  especialmente valiosa aqui, por ser a fronteira onde o Zion encontra o mundo.
- **Observabilidade.** Assiste ao diálogo sem participar dele.
- **Configuração.** Fornece parâmetros às Policies **sem carregar verdade de negócio** —
  parâmetro é ajuste; regra continua sendo política.

---

## 11. Anti-modelos

- **Marketplace invadindo o domínio** — qualquer conceito externo aparecendo dentro do
  Zion sem tradução.
- **Publication conhecendo Mercado Livre**; **Catalog conhecendo Shopee**; **Operation
  Center conhecendo APIs** — sinais inequívocos de que a fronteira foi rompida.
- **Tradutor contendo regra de negócio** — traduzir é dizer, não julgar.
- **Canal definindo política do Zion** — transformar exigência externa em invariante
  interna.
- **Duplicação de tradução** — a mesma correspondência mantida em dois lugares (ou fora
  deste módulo).
- **Misturar protocolo com domínio** — deixar detalhes de comunicação moldarem
  conceitos.
- **Integration decidindo o que publicar** ou com que prioridade.
- **Vazar linguagem estrangeira em um fato publicado** — publicar erro, código ou termo
  do canal sem tradução.
- **Tratar a observação externa como verdade do Zion** — ela é o que o canal
  **reportou**, datado.
- **Comunicação sem desfecho conhecido** — deixar diálogos em aberto silenciosamente.
- **Conexão compartilhada entre clientes** — a ponte é sempre de um cliente e um canal.
- **Capacidade tratada como regra nossa** em vez de fato sobre a contraparte.
- **Repetir o mesmo ato de conversa** por ausência de idempotência de comunicação.

---

## 12. Questões deferidas

- **REST**, **GraphQL**, **SDKs** e qualquer forma de contrato técnico.
- **OAuth** e o mecanismo concreto de credenciais.
- **Mensageria** e eventos físicos.
- **Persistência** e banco.
- **Frameworks** e linguagem.
- **Deploy**, **performance** e **escalabilidade**.

---

## Critério de longevidade

Este documento deve permanecer correto ainda que o Mercado Livre desapareça, que Amazon
e Shopee sejam adicionadas, que o ERP seja substituído, que toda a infraestrutura seja
refeita ou que a arquitetura física mude. Ele não descreve **com quem** o Zion conversa
— descreve **como** o Zion conversa com qualquer um, preservando integralmente sua
linguagem, seu domínio e sua arquitetura.

Adicionar um canal novo passa a ser um exercício conhecido: descrever suas
**capacidades**, estabelecer seus **mapeamentos**, escrever seus **tradutores** — e
**nada mais no Zion precisa mudar**. Se algum dia adicionar um marketplace exigir tocar
Catalog, Publication ou Operation Center, não foi o canal que era diferente: foi esta
fronteira que não foi respeitada.
