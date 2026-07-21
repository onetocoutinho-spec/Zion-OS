# Zion OS — Glossário Arquitetural (Linguagem Ubíqua) (v1)

> **Natureza normativa.** Este documento define **oficialmente** o significado de cada
> conceito arquitetural do Zion OS. **Nenhum documento futuro poderá usar um termo
> arquitetural com significado diferente do definido aqui.** Não é um glossário
> técnico — é a definição oficial da **Linguagem Ubíqua** do Zion.
>
> **Não cria nem altera conceitos.** Apenas consolida e formaliza o que os documentos
> aprovados já estabeleceram, para preservar a linguagem ao longo do tempo e evitar
> deriva semântica entre negócio, arquitetura, engenharia e implementação.
>
> **Como usar.** A seção **"Não é"** é tão normativa quanto a definição: ela existe
> onde há risco real de confusão, e é lá que a maior parte da deriva costuma começar.

---

# Fundamentos

### Verdade (Truth)

**Definição.** Uma afirmação de negócio que possui **exatamente um dono**, e que
responde inequivocamente o que é verdadeiro sobre um conceito.

**Não é.** Não é dado, não é cópia, não é percepção, não é opinião. Não é algo que dois
lugares possam afirmar simultaneamente.

**Relaciona-se com.** Ownership · Estado · Consistência · Domínio.

**Observações.** Toda verdade tem dono; onde não há dono único, não há verdade — há
ambiguidade.

### Fato (Fact)

**Definição.** Algo que **aconteceu**. Consumado, imutável e datável.

**Não é.** Não é comando, não é intenção, não é decisão, não é previsão.

**Relaciona-se com.** Signal · Evento · Observação · Transição.

**Observações.** Um fato nunca é imperativo. Ele informa; jamais instrui.

### Evento

**Definição.** A comunicação, para fora do domínio, de que uma **transição válida**
aconteceu. É o **eco** de uma mudança.

**Não é.** Não é comando, não é a causa da transição, não é a verdade, não é intenção
futura, não é pedido.

**Relaciona-se com.** Transição · Fato · Estado · Publicador.

**Observações.** Se toda a camada de eventos fosse apagada, os estados continuariam
corretos — eventos são observabilidade, não sistema de registro.

### Estado

**Definição.** A **verdade** de um conceito num instante — um momento válido do
domínio.

**Não é.** Não é evento, não é resultado, não é saúde, não é histórico.

**Relaciona-se com.** Transição · Verdade · Agregado · Máquina de Estados.

**Observações.** Estados são a verdade; eventos são o eco dela.

### Transição

**Definição.** Uma mudança **permitida** de um estado válido para outro, com causa e
auditabilidade.

**Não é.** Não é qualquer alteração; não é o evento que dela decorre.

**Relaciona-se com.** Estado · Evento · Invariante · Agregado.

**Observações.** O que não é transição declarada é proibido. A ausência de um caminho é
uma regra, não um esquecimento.

### Identidade

**Definição.** Aquilo que distingue uma coisa ao longo de toda a sua existência — e o
meio pelo qual um módulo **referencia** a verdade de outro sem possuí-la.

**Não é.** Não é a coisa em si, não é uma cópia dela, não é um atributo descritivo.

**Relaciona-se com.** Entidade · Ownership · Referência · Alvo.

**Observações.** Referenciar por identidade é o que permite colaborar sem duplicar
verdade.

### Contexto

**Definição.** O conjunto de **informações situacionais** que acompanha um trabalho para
que ele possa ser conduzido com clareza.

**Não é.** Não é a verdade de outro domínio copiada para dentro; não é histórico
completo.

**Relaciona-se com.** Mission · Caso de Uso · Percepção.

**Observações.** O termo tem também um uso arquitetural consagrado — **contexto
delimitado**, a fronteira de linguagem e modelo de um módulo. Quando esse sentido for
pretendido, deve ser dito explicitamente.

### Ownership

**Definição.** O direito **exclusivo** de afirmar e alterar uma verdade.

**Não é.** Não é leitura, não é acesso, não é custódia, não é responsabilidade
compartilhada.

**Relaciona-se com.** Verdade · Domínio · Módulo · Fronteira.

**Observações.** Leitura nunca é propriedade. Integração nunca transfere ownership.

### Consistência

**Definição.** A propriedade de o sistema ter, para cada verdade, **uma única resposta
inequívoca**, com os domínios convergindo ao longo do tempo pela propagação e
reconciliação de fatos.

**Não é.** Não é estado compartilhado, não é simultaneidade, não é acordo instantâneo
entre módulos.

**Relaciona-se com.** Verdade · Reconciliação · Percepção · Ownership.

**Observações.** Consistência não é estado compartilhado; é fatos que fluem e visões que
convergem.

### Percepção

**Definição.** A **crença** que um módulo mantém sobre uma verdade cujo dono é outro —
tipicamente uma fonte externa.

**Não é.** Não é a verdade, não é estado autoritativo, não é substituta da fonte de
registro.

**Relaciona-se com.** Observação · Divergência · Reconciliação · Verdade.

**Observações.** A fonte de registro sempre vence a percepção. Tratar percepção como
verdade é um anti-modelo.

### Observação

**Definição.** O registro **datado e imutável** do que uma fonte reportou.

**Não é.** Não é verdade, não é interpretação, não é decisão, não é comando.

**Relaciona-se com.** Percepção · Fato · Signal · External Observation.

**Observações.** Nova informação é **nova** observação — observações não se editam.

### Divergência

**Definição.** A condição em que a **intenção ou expectativa** e a **percepção** deixam
de coincidir.

**Não é.** Não é erro, não é falha, não é autorização para sobrescrever a verdade alheia.

**Relaciona-se com.** Percepção · Reconciliação · Publication · Signal.

**Observações.** Divergência é um **fato a tratar**, não uma verdade a corrigir
unilateralmente.

---

# Operation Center

### Operation

**Definição.** A operação de e-commerce de **um cliente em um canal** (e sua visão
consolidada). É o **sujeito** do Operation Center.

**Não é.** Não é o cliente, o produto, o anúncio nem o canal. É a *atividade* de operar.

**Relaciona-se com.** Signal · Mission · Saúde Operacional · Indicador.

### Signal

**Definição.** Um **fato observado** sobre uma Operação que **pode** merecer atenção.

**Não é.** Não é ordem, tarefa, decisão nem comando. Um Signal **não faz nada**.

**Relaciona-se com.** Fato · Decision · Severidade · Impacto.

**Observações.** Um Signal pode não gerar Decision alguma; e nunca nasce de um
julgamento.

### Decision

**Definição.** O **julgamento** de agir — ou de não agir — diante de um ou mais Signals,
com o seu Motivo.

**Não é.** Não é a execução, não é a tarefa, não é o fato que a originou.

**Relaciona-se com.** Signal · Mission · Motivo · Prioridade.

**Observações.** Todo trabalho nasce de uma Decision. Seu veredito terminal é imutável.

### Mission

**Definição.** Uma **unidade de trabalho comprometida**, com propósito, alvo, prioridade
e prazo.

**Não é.** Não é o fato, não é o julgamento, não é o passo técnico. Uma Mission **não
executa**; coordena.

**Relaciona-se com.** Decision · Action · Operation · Prioridade · SLA.

### Action

**Definição.** Um **passo concreto** executado como parte de uma Mission, sempre
auditável.

**Não é.** Não é a execução técnica em si (que pertence ao módulo dono), não é
julgamento.

**Relaciona-se com.** Mission · Result · Solicitação · Communication.

**Observações.** Nenhuma Action existe sem Mission.

### Result

**Definição.** O **desfecho** de uma Action.

**Não é.** Não é a Action, não é métrica agregada, não é evento.

**Relaciona-se com.** Action · Indicador · Signal.

**Observações.** Nenhum Result existe antes da Action que o produz, nem órfão dela.

### Indicador

**Definição.** Uma **medida derivada** da operação ao longo do tempo.

**Não é.** Não é comando, não é verdade primária, não é entidade que age.

**Relaciona-se com.** Result · Operation · Saúde Operacional.

**Observações.** Indicadores observam; no máximo alimentam novos Signals.

### Saúde Operacional

**Definição.** A **condição resumida** de uma Operação num dado momento, sempre
**derivada** de fatos e desfechos.

**Não é.** Não é um valor atribuível à mão, não é prioridade, não é indicador isolado.

**Relaciona-se com.** Operation · Signal · Indicador.

### Prioridade

**Definição.** A **importância relativa** de uma Mission frente às outras, num dado
momento, resultante de uma Decision.

**Não é.** Não é urgência, não é severidade, não é ordem de chegada, não é rótulo
permanente, não é um número sem porquê.

**Relaciona-se com.** Mission · Decision · Política de Priorização · Explicabilidade.

**Observações.** Prioridade sem justificativa é, por definição, inválida.

---

# Publication

### Publication

**Definição.** A **intenção** de que um produto esteja presente em um canal, e o ciclo
de vida dessa intenção.

**Não é.** Não é o produto, não é o estado vivo no marketplace, não é a execução.

**Relaciona-se com.** Listing · Versão · Solicitação · Canal Pretendido · Presença.

**Observações.** É a verdade da **intenção** — nunca a do que está no ar.

### Listing

**Definição.** O **conteúdo pretendido** de uma presença, expresso na linguagem do Zion.

**Não é.** Não é o anúncio vivo no canal, não é a verdade do produto, não é o formato
exigido por qualquer marketplace.

**Relaciona-se com.** Publication · Versão · Estratégia.

### Versão

**Definição.** Um recorte **imutável** da intenção, fixado num momento.

**Não é.** Não é rascunho editável, não é histórico livre, não é o estado da presença.

**Relaciona-se com.** Listing · Solicitação · Idempotência.

**Observações.** Mudar a intenção cria **nova** versão; versões fixadas não se
reescrevem.

### Estratégia

**Definição.** Como o negócio **pretende realizar** a intenção (por exemplo, atualizar
uma presença existente ou republicá-la).

**Não é.** Não é a mecânica de nenhum canal, não é invariante, não é decisão
operacional de prioridade.

**Relaciona-se com.** Publication · Policy · Capability.

### Solicitação

**Definição.** A expressão de um módulo de que **algo deve ser realizado**, sempre
vinculada a uma Versão.

**Não é.** Não é a execução, não é comando sobre outro módulo, não é garantia de
desfecho.

**Relaciona-se com.** Publication · Action · Communication.

**Observações.** Solicitar não é executar: quem realiza é o módulo dono.

### Presença

**Definição.** A **existência realizada** da intenção num canal.

**Não é.** Não é a intenção; e sua verdade viva **não pertence ao Zion** — pertence ao
canal.

**Relaciona-se com.** Publication · Percepção · Divergência.

### Publicação

**Definição.** O **ato** de tornar uma intenção realizada num canal.

**Não é.** Não é o módulo Publication (que é o dono da intenção), não é a presença
resultante, não é a conversa com o canal (que é Communication).

**Relaciona-se com.** Publication · Solicitação · Communication.

**Observações.** Termo de maior risco de deriva: distinga sempre **intenção**
(Publication), **ato** (Publicação) e **presença** (resultado).

### Canal Pretendido

**Definição.** O canal ao qual uma intenção se dirige, referenciado **por identidade**.

**Não é.** Não é a conexão com o canal, não é o canal em si (que é do Integration).

**Relaciona-se com.** Publication · Channel · Connection.

---

# Integration

### Channel

**Definição.** Uma **contraparte externa conhecida** e o seu comportamento — o que ela
suporta e exige.

**Não é.** Não é a conexão de um cliente, não é a conta no marketplace, não é o dono do
que o Zion pretende.

**Relaciona-se com.** Capability · Mapping · Connection.

### Connection

**Definição.** A **ponte** de um cliente específico com um canal: sua existência,
validade e saúde.

**Não é.** Não é a identidade do cliente, não é o canal, não é permissão de negócio.

**Relaciona-se com.** Channel · Identity & Access · Communication.

**Observações.** Uma conexão é sempre de **um** cliente com **um** canal.

### Capability

**Definição.** O que um canal **suporta e exige**, expresso **na linguagem do Zion**.

**Não é.** Não é regra do Zion, não é invariante interna, não é política de negócio.

**Relaciona-se com.** Channel · Translation · Policy.

**Observações.** É o mecanismo que permite aos demais módulos raciocinar sem conhecer
marketplace algum. Exigência de canal **nunca** vira regra do Zion.

### Communication

**Definição.** Um **ato de conversa** com um sistema externo: solicitação traduzida,
envio, retorno e desfecho.

**Não é.** Não é a intenção de negócio, não é a Action do Operation Center, não é
protocolo.

**Relaciona-se com.** Connection · Translation · External Observation · Retry.

**Observações.** Toda Communication termina com **desfecho conhecido** — inclusive "sem
resposta" é desfecho.

### Translation

**Definição.** O **ato** de converter entre a linguagem do Zion e a de um canal, nos dois
sentidos — inclusive respostas e erros.

**Não é.** Não é decisão, não é regra de negócio, não é interpretação opinativa.

**Relaciona-se com.** Mapping · Capability · Tradutor.

**Observações.** Traduzir é saber **como dizer**, nunca **o que é certo**.

### Mapping

**Definição.** O **conhecimento de correspondência** entre conceitos do Zion e de um
canal, que sustenta a tradução.

**Não é.** Não é o ato de traduzir, não é regra de negócio, não é configuração técnica.

**Relaciona-se com.** Channel · Translation.

### External Observation

**Definição.** O que um canal **reportou**, já traduzido, registrado de forma **imutável
e datada**.

**Não é.** Não é a verdade do Zion, não é a percepção de outro módulo, não é decisão.

**Relaciona-se com.** Observação · Percepção · Divergência.

### Retry

**Definição.** A regra **do Zion** sobre se e como repetir uma tentativa de
comunicação.

**Não é.** Não é regra do canal, não é invariante, não é reabertura de Mission.

**Relaciona-se com.** Policy · Communication · Idempotência de Comunicação.

### Compatibilidade

**Definição.** A regra do Zion sobre **como proceder quando o comportamento de um canal
muda**.

**Não é.** Não é adaptação automática do domínio, não é permissão para o canal redefinir
o Zion.

**Relaciona-se com.** Capability · Policy · Translation.

---

# Arquitetura

### Agregado

**Definição.** Uma **fronteira de consistência** que guarda uma parte da verdade e suas
invariantes; **só ele muda a si mesmo**, e sempre por transição válida.

**Não é.** Não é um depósito de dados, não é um grupo arbitrário de objetos, não conhece
o mundo de fora.

**Relaciona-se com.** Entidade · Objeto de Valor · Invariante · Repositório.

### Entidade

**Definição.** Um elemento com **identidade e ciclo de vida próprios** dentro de um
agregado.

**Não é.** Não é um objeto de valor, não é necessariamente uma raiz de agregado.

**Relaciona-se com.** Agregado · Identidade.

### Objeto de Valor

**Definição.** Um conceito **definido pelo seu valor**, imutável e sem identidade
própria.

**Não é.** Não é entidade, não tem ciclo de vida, não é rastreado ao longo do tempo.

**Relaciona-se com.** Agregado · Entidade.

**Observações.** Promover um objeto de valor a entidade viva (como "saúde" ou
"prioridade") corrompe o modelo.

### Policy

**Definição.** Uma **regra mutável do negócio**, isolada para poder mudar sem tocar o
núcleo do domínio; responde perguntas de negócio **com justificativa**.

**Não é.** Não é invariante, não é infraestrutura, não age por conta própria, não é
configuração.

**Relaciona-se com.** Invariante · Caso de Uso · Serviço de Domínio · Explicabilidade.

**Observações.** Se a regra pode mudar amanhã sem que o negócio mude de natureza, é
Policy — não invariante.

### Serviço de Domínio

**Definição.** Comportamento de negócio **estável** que **atravessa agregados** ou não
pertence naturalmente a nenhum.

**Não é.** Não é um repositório de lógica solta, não é caso de uso, não é policy.

**Relaciona-se com.** Agregado · Policy · Caso de Uso.

**Observações.** Serviços gigantes costumam indicar agregados anêmicos.

### Factory

**Definição.** O componente que garante que um agregado **nasça válido**, concentrando
as condições do seu nascimento.

**Não é.** Não é construtor técnico, não contém regra de negócio contínua.

**Relaciona-se com.** Agregado · Invariante.

**Observações.** Existe para que um objeto inválido **jamais chegue a existir**.

### Repositório

**Definição.** A **necessidade declarada pelo domínio** de obter e guardar seus
agregados.

**Não é.** Não é banco de dados, não é camada técnica, não contém lógica de negócio.

**Relaciona-se com.** Agregado · Domínio · Infraestrutura.

**Observações.** O domínio declara *o que precisa*; **como** se realiza é implementação.

### Caso de Uso

**Definição.** A orquestração de **uma intenção** de ponta a ponta dentro de um módulo.

**Não é.** Não é regra de negócio, não é o domínio, não é interface, não decide o que é
certo.

**Relaciona-se com.** Policy · Agregado · Serviço de Domínio · Observador.

### Observador

**Definição.** A **fronteira de entrada** de um módulo: acolhe fatos de fora e os
**traduz** para a sua linguagem.

**Não é.** Não é o modelo alheio importado, não é executor de regra, não é integração
técnica.

**Relaciona-se com.** Fato · Caso de Uso · Publicador.

### Publicador

**Definição.** A **fronteira de saída** de um módulo: emite seus fatos **como
consequência de transições válidas**.

**Não é.** Não é emissor de comandos, não publica intenção futura, não publica sem
transição.

**Relaciona-se com.** Evento · Transição · Fato.

### Capacidade Transversal

**Definição.** Uma capacidade que **atravessa módulos sem possuir verdade alguma** — é
**usada**, nunca dona.

**Não é.** Não é módulo de domínio, não tem agregados, não publica fatos de domínio, não
altera estado.

**Relaciona-se com.** IA · Autorização · Auditoria · Observabilidade · Configuração.

**Observações.** A *verdade* sobre quem pode agir pertence a um módulo de domínio; o
*ato de aferi-la* é capacidade transversal — verdade e verificação não são a mesma
coisa.

---

# IA

### Recomendação

**Definição.** Uma **proposta** da IA, sempre acompanhada da sua justificativa.

**Não é.** Não é decisão de registro, não é comando, não é execução, não é verdade.

**Relaciona-se com.** Decision · Explicabilidade · Caso de Uso.

**Observações.** A IA **propõe**; o domínio dispõe. Recomendar não é governar.

### Explicabilidade

**Definição.** A obrigação de que toda prioridade e toda recomendação carreguem um
**porquê legível por humanos**, na linguagem do domínio.

**Não é.** Não é registro técnico, não é log, não é opcional, não é justificativa
posterior.

**Relaciona-se com.** Motivo · Prioridade · Recomendação · Auditoria.

**Observações.** É regra constitucional: o que não se explica é inválido, não apenas
indesejável.

### Automação

**Definição.** Atuar **sem confirmação humana**, exclusivamente quando existe uma
**política de negócio explícita** que a autorize, para uma classe limitada, de forma
auditável.

**Não é.** Não é autonomia da IA, não é decisão da engenharia, não é padrão — o padrão é
o humano no laço.

**Relaciona-se com.** Governança · Policy · Recomendação.

**Observações.** A IA **nunca se concede** automação; o negócio a concede.

### Governança

**Definição.** O direito de **definir políticas, invariantes e critérios** — exclusivo
do negócio.

**Não é.** Não é operação, não é execução, não é recomendação, e **nunca** é exercida
pela IA.

**Relaciona-se com.** Policy · Automação · Explicabilidade.

**Observações.** O termo nomeia também a **Policy** que concretiza seus limites dentro
de um módulo — o que pode ocorrer automaticamente e o que exige confirmação humana.

---

## Critério de permanência

Este glossário é **normativo e permanente**. Definições podem ser **acrescentadas**
quando novos conceitos forem oficializados por documentos aprovados — nunca
**silenciosamente alteradas**. Se um documento futuro precisar de um termo com
significado diferente, ele deve **escolher outro termo**, e não redefinir este.

A partir daqui, negócio, arquitetura, engenharia e implementação falam a **mesma
língua**. Quando alguém do Zion disser "Missão", "Fato", "Verdade" ou "Percepção",
estará dizendo exatamente o que está escrito aqui — e é assim que a plataforma preserva
sua coerência enquanto cresce.
