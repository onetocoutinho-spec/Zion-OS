# Publication — Arquitetura do Módulo (v1)

> **Natureza.** Arquitetura **lógica interna** do módulo Publication. Não há banco,
> API, mensageria, evento físico, framework, infraestrutura ou persistência — de
> propósito. Responde **como o módulo se organiza**, nunca **como se implementa**.
>
> **Subordinação.** Não altera nem contradiz a Constituição do Zion OS, a Arquitetura
> do Sistema nem o molde estabelecido pelo Operation Center; segue a **mesma
> anatomia**, mudando apenas **qual verdade** protege.
>
> **Revisão normativa.** Este documento foi revisado por força do **ADR-007 —
> Deliberação da RFC-001**, que autorizou **exclusivamente** a alteração da regra de
> identidade do agregado e o acréscimo de **uma** invariante (§5). Nenhuma outra
> alteração foi realizada; ver a seção final *Compatibilidade com ADR-007*.

---

## 1. Objetivo

O módulo Publication é o **dono da intenção de publicação**: a verdade sobre **o que o
Zion quer que esteja presente** em um canal, para um determinado produto — e sobre
**como essa intenção evolui** ao longo do tempo.

**Ele nunca é dono do estado vivo do marketplace.** O que está de fato no ar pertence
ao **canal** (fonte externa de verdade). O que o Publication guarda a respeito disso é
uma **percepção reconciliada** — uma crença informada, sempre deferente à fonte. Dessa
separação nasce o conceito mais importante do módulo: quando a **intenção** e a
**percepção** deixam de coincidir, existe **divergência** — e divergência é um fato a
tratar, não uma verdade a sobrescrever.

O módulo também **não executa**: ele **solicita**. Quem conversa com o mundo externo é
Integration; quem decide o que merece atenção é o Operation Center; quem é dono do
produto é o Catalog. Publication cuida da **intenção e do seu ciclo de vida**.

---

## 2. Responsabilidades

**Pertence exclusivamente ao Publication:**

- **Publication** — a intenção permanente de que um produto esteja presente num canal.
- **Listing** — o **conteúdo pretendido** dessa presença (a composição que se quer no
  ar), na linguagem do Zion.
- **Publication State** — em que momento do ciclo a intenção se encontra.
- **Canal pretendido** — a qual canal a intenção se dirige (por identidade).
- **Estratégia de publicação** — como o negócio pretende realizar a intenção (por
  exemplo: publicar de uma vez ou por partes; atualizar ou republicar).
- **Versionamento lógico** — cada mudança relevante da intenção produz uma **versão**,
  para que se saiba exatamente **qual** intenção foi solicitada e a que responder.
- **Histórico da publicação** — registro append-only de tentativas e desfechos.
- **Solicitações** de publicação, atualização e encerramento — a expressão do módulo de
  que algo deve ser realizado.
- **Percepção reconciliada** do que se acredita estar no ar — explicitamente uma
  crença, jamais a verdade do canal.

**NÃO pertence ao módulo:**

- a verdade do **Produto** (é do Catalog) — apenas referenciada por identidade;
- o **estado vivo** no marketplace (é do canal, fonte externa);
- a **conexão** com o canal e qualquer **conversa** com o mundo externo (é da
  Integration);
- as **particularidades de cada marketplace** — o modo como o canal exige que a
  presença seja montada é **traduzido pela Integration**, não conhecido aqui;
- **prioridade, decisão e coordenação** operacional (são do Operation Center);
- **identidade e autorização** (são de Identity & Access);
- **definir políticas de negócio** — o módulo as **aplica**.

---

## 3. Organização Interna

A mesma anatomia do molde, aplicada à verdade deste módulo.

- **Agregados.** Guardam a intenção e suas invariantes; só eles mudam a si mesmos, e
  sempre por transição válida.
- **Entidades.** Os elementos com identidade e ciclo próprio **dentro** do agregado —
  as versões da intenção, as solicitações e os registros de histórico.
- **Objetos de Valor.** O que é definido pelo seu valor e é imutável — estado, canal
  pretendido, versão, estratégia, percepção, motivo, desfecho.
- **Casos de Uso.** Orquestram uma intenção de ponta a ponta. **Não contêm regra de
  negócio.**
- **Policies.** As regras **mutáveis** do negócio: elegibilidade, estratégia de
  atualização, republicação, equivalência para idempotência, reconciliação,
  explicabilidade, governança.
- **Factories.** Garantem que uma intenção **nasça válida** — por exemplo, que uma
  Publication só exista referida a um produto e a um canal, e que uma solicitação só
  nasça vinculada a uma versão existente.
- **Serviços de Domínio.** Comportamento de negócio estável que atravessa agregados ou
  não pertence a um só: planejamento, reconciliação, versionamento, elegibilidade,
  consistência.
- **Repositórios.** A **necessidade declarada pelo domínio** de obter e guardar seus
  agregados. Como isso se realiza não pertence a este documento.
- **Observadores.** Fronteira de entrada: recebem fatos de outros módulos (produto
  mudou, pedido de publicação do Operation Center, retorno da Integration) e os
  **traduzem** para a linguagem do Publication. Traduzem — nunca importam o modelo
  alheio.
- **Publicadores.** Fronteira de saída: emitem os fatos do módulo **como consequência
  de transições válidas** (publicado, falhou, divergiu, encerrado).

---

## 4. Casos de Uso

- **Criar Publication.** Fazer nascer a intenção de que um produto esteja presente num
  canal. Não publica nada; apenas declara a intenção.
- **Planejar Publicação.** Compor o conteúdo pretendido (o Listing) e fixá-lo como uma
  **versão** da intenção.
- **Avaliar Elegibilidade.** Verificar se a intenção reúne o necessário para ser
  realizada. Resulta em elegível ou não, **com justificativa**.
- **Solicitar Publicação.** Emitir a solicitação de que a versão vigente da intenção
  seja realizada no canal. *O módulo solicita; não executa.*
- **Solicitar Atualização.** Emitir a solicitação de que uma presença já existente passe
  a refletir uma nova versão da intenção.
- **Solicitar Encerramento.** Emitir a solicitação de que a presença deixe de existir.
- **Receber retorno da execução.** Acolher o fato que volta da Integration (aceito,
  concluído, falhou) e atualizar a solicitação correspondente.
- **Atualizar Estado.** Fazer a Publication avançar pelos seus momentos válidos, à luz
  dos retornos recebidos.
- **Reconciliar intenção com resposta.** Comparar o que se pretendia com o que o canal
  reportou; quando não coincidem, registrar **divergência**.
- **Registrar Falha.** Guardar o desfecho negativo de uma tentativa, com motivo,
  mantendo a intenção viva.
- **Reprogramar Publicação.** Decidir, dentro do que a política permite, tentar
  novamente uma intenção que falhou.
- **Cancelar Publicação.** Abandonar deliberadamente a intenção antes de realizada, com
  motivo.

---

## 5. Organização do Domínio

**Agregado raiz: Publication.** É a intenção de presença de um produto num canal — a
unidade de consistência do módulo. **Sua identidade é própria.** O **produto
referenciado** e o **canal pretendido** constituem o **sujeito** da intenção — aquilo de
que ela trata —, e não a sua identidade. Admitem-se, portanto, intenções **sucessivas**
sobre o mesmo sujeito ao longo do tempo.

**Entidades internas (vivem dentro do agregado):**

- **Listing (versionado).** Cada versão é o conteúdo pretendido num dado momento. As
  versões são **imutáveis** depois de fixadas; mudar a intenção cria uma **nova**
  versão, nunca reescreve a anterior.
- **Solicitação.** A expressão de que algo deve ser realizado (publicar, atualizar,
  encerrar), sempre vinculada a **uma versão** da intenção. Uma Solicitação **nunca
  existe fora** de uma Publication.
- **Registro de Histórico.** Anotação append-only de tentativas e desfechos.

**Objetos de Valor:** Publication State; Canal pretendido; Versão; Estratégia de
publicação; **Percepção do estado vivo** (o que se crê estar no ar, e quando foi
observado); Motivo; Resultado; e a referência ao Produto por identidade.

**Estados da Publication:** *Pretendida* (intenção formada, ainda não elegível) →
*Elegível* (reúne o necessário) → *Solicitada* (há solicitação em curso) → *Publicada*
(a percepção confirma presença). A partir daí, dois desvios legítimos: *Divergente*
(intenção e percepção deixaram de coincidir) e *Falha* (uma tentativa não teve êxito —
**não terminal**, aguarda reprogramar ou cancelar). Dois desfechos terminais:
*Encerrada* (a presença foi deliberadamente terminada) e *Cancelada* (a intenção foi
abandonada antes de se realizar).

**Estados da Solicitação:** *Planejada* → *Emitida* → *Aceita* → *Concluída* ou
*Falhou*. É a expressão interna do módulo, distinta (embora harmônica) da coordenação
do Operation Center.

**Invariantes que o módulo protege:**

- Uma Publication refere-se a **exatamente um** produto e **um** canal pretendido.
- Existe **no máximo uma Publication não-terminal (vigente)** para cada combinação
  **produto + canal pretendido**.
- Uma Solicitação **nunca** existe sem Publication, e sempre aponta para **uma versão**
  existente da intenção.
- Versões fixadas são **imutáveis**; a intenção evolui por nova versão.
- **A mesma versão de intenção nunca produz duas presenças** — a intenção realizada é
  única.
- A **percepção** do estado vivo **nunca** é tratada como verdade do canal; e um retorno
  do canal **nunca sobrescreve a intenção** — pode, no máximo, revelar divergência.
- Todo Resultado pertence a uma Solicitação; estados terminais não emitem transição.
- **Intenção e execução nunca se misturam**: o módulo expressa; outro realiza.

**Relacionamentos:** a Publication referencia Produto e Canal **por identidade**;
contém suas versões, solicitações e histórico; e é referenciada de fora apenas por
identidade — jamais aberta.

---

## 6. Serviços de Domínio

Comportamentos de negócio estáveis que não pertencem a um único agregado:

- **Planejamento.** Compor o conteúdo pretendido a partir da referência ao produto e da
  estratégia vigente, produzindo uma versão coerente da intenção.
- **Reconciliação.** Comparar a **intenção vigente** com a **percepção** do que o canal
  reportou, determinando se há coincidência ou **divergência**, e em quê.
- **Versionamento.** Determinar se uma mudança é relevante a ponto de constituir uma
  **nova versão** da intenção — ou se é irrelevante para o que se pretende publicar.
- **Validação de elegibilidade.** Reunir o que é necessário para que a intenção possa
  ser realizada, produzindo um veredito **com justificativa**.
- **Consistência.** Assegurar que versões, solicitações e histórico contem a mesma
  história — que nenhuma solicitação aponte para o vazio e nenhum desfecho fique órfão.

---

## 7. Policies

Policies são as **regras mutáveis** do negócio; isoladas para evoluir sem tocar o
núcleo. **Não confundir com invariantes**: a invariante é o que **nunca** pode ser
violado, independentemente da estratégia comercial; a policy é o que o negócio **pode
decidir diferente amanhã**.

- **Elegibilidade para publicar.** O que uma intenção precisa reunir para ser
  considerada realizável.
- **Estratégia de atualização.** Quando uma mudança se resolve **atualizando** a
  presença existente e quando exige **republicar**.
- **Republicação.** Sob que condições uma intenção que falhou pode ser tentada de novo,
  e quantas vezes.
- **Idempotência (chave de equivalência).** **Como se determina que duas intenções são
  a mesma.** A distinção é essencial: *que a mesma versão de intenção não produza duas
  presenças* é **invariante**; *qual critério estabelece que duas intenções são
  equivalentes* é **policy** — e, portanto, pode mudar sem que o domínio mude.
- **Reconciliação.** Quando e com que frequência realinhar a percepção com o canal, e o
  que constitui divergência relevante.
- **Explicabilidade.** O que uma justificativa precisa conter — por que uma intenção foi
  considerada inelegível, por que se republicou, por que se encerrou.
- **Governança.** O que pode ocorrer automaticamente e o que exige confirmação humana,
  inclusive os limites de atuação automática da IA.

Nenhuma Policy conhece infraestrutura; nenhuma altera agregados por conta própria —
elas **respondem perguntas de negócio**, e quem age com a resposta é o domínio.

---

## 8. Colaboração Interna

O padrão é sempre o mesmo:

- Um **Observador** recebe um fato de fora (o produto mudou; o Operation Center pediu
  uma publicação; a Integration retornou um desfecho) e o **traduz** para a linguagem
  do módulo.
- Um **Caso de Uso** acolhe a intenção e **orquestra**: obtém o agregado, consulta as
  **Policies** pertinentes, aciona **Serviços de Domínio** quando o comportamento
  atravessa agregados.
- A **Policy** responde uma pergunta de negócio — é elegível? atualiza ou republica?
  esta intenção é equivalente àquela? — **com justificativa**.
- O **Agregado** recebe o veredito e executa a **transição**, protegendo suas
  invariantes. Só ele muda a si mesmo.
- A transição produz um novo **Estado** e um **fato** consumado.
- O **Publicador** emite esse fato — **porque houve transição**, nunca antes dela.

Duas fronteiras internas jamais se cruzam: **o Caso de Uso não decide o que é certo**, e
**o Agregado não conhece o mundo de fora**.

---

## 9. Relação com outros módulos

- **Catalog.** Publication **observa** fatos de Produto e o **referencia por
  identidade**. **Nunca** altera Produto nem lê o interior do Catalog. Uma mudança de
  produto pode motivar uma nova versão da intenção — decisão que é do Publication.
- **Integration.** Publication **emite solicitações** (como fatos) e **observa** os
  retornos. **Nunca** fala com o marketplace, **nunca** possui a conexão e **nunca**
  conhece as particularidades do canal — a tradução é da Integration.
- **Operation Center.** Publication **observa** os pedidos de ação do Operation Center e
  **publica** os fatos do anúncio (publicado, falhou, divergiu, encerrado). **Nunca**
  decide prioridade, nunca coordena a operação.
- **Identity & Access.** Publication **consulta** quem pode agir; a autorização
  condiciona os casos de uso. **Nunca** possui identidade nem define permissão.
- **AI Services.** Publication **usa** a capacidade para interpretar, sugerir conteúdo
  pretendido e explicar decisões. A IA entra pelo **mesmo portão** que um humano — um
  caso de uso — e **nunca** muta agregados diretamente.

Em todos os casos: **fatos e identidades atravessam; propriedade e responsabilidade,
não.**

---

## 10. Capacidades Transversais

Participam **nas bordas** e **nunca alteram o domínio**:

- **IA.** Entra como **proposta** (conteúdo pretendido sugerido, explicação de
  divergência, recomendação de estratégia). Não muda estado por conta própria.
- **Autorização.** Aferida **antes** de qualquer caso de uso que mude a intenção; é
  portão, não verdade do módulo.
- **Auditoria.** Registra fatos e transições de forma **append-only**; observa e nunca
  altera o registrado.
- **Observabilidade.** Assiste ao módulo sem participar das suas decisões.
- **Configuração.** Fornece parâmetros às Policies **sem carregar verdade de negócio**.

Nenhuma entra **dentro** dos agregados nem se torna dona de qualquer verdade do módulo.

---

## 11. Anti-modelos

- **Publication alterando Produto** — invadir a verdade do Catalog.
- **Publication falando diretamente com o Marketplace** — atravessar a Integration.
- **Publication executando integração** — misturar intenção com execução.
- **Publication decidindo prioridades** — invadir o Operation Center.
- **Listing representando o estado do Marketplace** — o Listing é **intenção**; o vivo é
  do canal.
- **Tratar a percepção como verdade** — ou deixar um retorno do canal **sobrescrever a
  intenção**.
- **Regras mutáveis como invariantes** — cravar no agregado o que é policy (o critério
  de equivalência, a estratégia de atualização).
- **Duplicação de verdade** — guardar dados do produto em vez de referenciá-lo.
- **Misturar intenção com execução** — a violação-mãe do módulo.
- **Versão mutável** — reescrever uma versão fixada em vez de criar outra.
- **Solicitação sem versão** — pedir a realização de uma intenção que não existe.
- **Conhecer particularidades do canal** — deixar a mecânica de um marketplace vazar
  para dentro do domínio da intenção.
- **Publicar fato sem transição** que o justifique.
- **Agregado anêmico** — a intenção sem comportamento, com as regras vazando para os
  casos de uso.
- **IA mutando agregados** sem passar por um caso de uso.

---

## 12. Questões deferidas

- **Persistência** dos agregados.
- **APIs** e contratos técnicos do módulo.
- **Mensageria** e **eventos físicos**.
- **Banco** de dados.
- **Frameworks** e linguagem.
- **Testes** e estratégia de verificação.
- **Performance** e **escalabilidade**.

---

## Critério de longevidade e base para reorganizar a Sprint 0

Este documento deve permanecer correto ainda que novos marketplaces e canais sejam
adicionados, a tecnologia seja substituída por completo ou a arquitetura física mude —
porque descreve **a intenção de publicação**, que independe de qualquer canal.

**Como ele reorganiza a Sprint 0 (sem alterar princípio algum).** A implementação atual
mistura três responsabilidades que este documento separa definitivamente:

- **a intenção e seu versionamento** — que produto deve estar presente, em que canal,
  com que conteúdo, e a garantia de que a mesma intenção não vire duas presenças —
  pertence ao **Publication**;
- **a mecânica do canal** — o modo como o Mercado Livre exige que a presença seja
  montada, incluindo guias de tamanho e suas particularidades — pertence à
  **Integration**, que traduz e protege o interior do Zion;
- **a coordenação** — decidir que essa publicação merece acontecer agora e acompanhá-la
  até o desfecho — pertence ao **Operation Center**.

A idempotência conquistada na Sprint 0 encontra aqui o seu lugar conceitual: a
**invariante** ("a mesma intenção não produz duas presenças") é do Publication; o
**critério de equivalência** é uma **policy**; e a mecânica de realizar isso num canal
específico é da Integration. Reorganizar a implementação passa a ser mover cada peça
para o seu dono — sem rediscutir nenhum princípio.

---

# Compatibilidade com ADR-007

**Quais regras mudaram.** Exatamente duas alterações foram aplicadas, ambas em §5:

1. **A regra de identidade do agregado.** A identidade da Publication deixou de ser a
   combinação produto+canal e passou a ser **própria**; produto e canal passaram a ser
   reconhecidos como o **sujeito** da intenção. Admitem-se intenções sucessivas sobre o
   mesmo sujeito.
2. **O acréscimo de uma invariante** — e apenas uma: *existe no máximo uma Publication
   não-terminal (vigente) para cada combinação produto + canal pretendido*. Ela preserva,
   **no plano da vigência**, a unicidade que a regra anterior pretendia garantir no plano
   da existência.

**Quais regras permaneceram iguais.** Todo o restante do documento. Em particular, e por
verificação explícita:

- **Objetivo (§1)** — não continha, nem passou a conter, associação entre identidade e o
  par produto+canal; permanece **inalterado**.
- **Estados (§5)** — **nenhum estado foi criado, removido ou alterado**, e a
  **terminalidade permanece exatamente como estava**: *Encerrada* e *Cancelada* seguem
  terminais; *Falha* segue não-terminal.
- **Versionamento (§2, §5, §6)** — a Versão continua representando a **evolução do
  conteúdo** pretendido; **nunca representou e não passa a representar identidade**.
- **Policies (§7)** — **nenhuma Policy foi criada, alterada ou removida**.
- **Eventos** — **nenhum fato publicado pelo módulo foi criado, alterado ou removido**;
  os Publicadores emitem exatamente os mesmos fatos.
- **Factories (§3)** — permanecem corretas sem alteração: garantir que uma intenção nasça
  válida já compreende o conjunto vigente de invariantes.
- **Relacionamentos (§5)** — permanecem corretos: a Publication continua referenciando
  Produto e Canal por identidade, e continua sendo referenciada de fora apenas por
  identidade.
- **Anti-modelos (§11)** — verificados um a um; **nenhum dependia da regra de identidade
  anterior**, e nenhum foi acrescentado ou modificado.
- **Casos de Uso (§4)**, **Serviços de Domínio (§6)**, **Colaboração Interna (§8)**,
  **Capacidades Transversais (§10)** e **Questões deferidas (§12)** — **inalterados**.

**Quais invariantes foram preservadas.** Todas as anteriores, sem exceção: um produto e
um canal por intenção; Solicitação nunca sem Publication e sempre vinculada a uma versão
existente; versões fixadas imutáveis; **a mesma versão de intenção nunca produz duas
presenças**; a percepção nunca tratada como verdade e o retorno do canal nunca
sobrescrevendo a intenção; todo Resultado pertencente a uma Solicitação; estados
terminais não emitindo transição; e intenção e execução jamais se misturando.

**Quais documentos não precisaram ser alterados.** Nenhum além deste. Permanecem
**intactos**: toda a **Constituição** (inclusive **Máquina de Estados** e **Modelo de
Consistência e Fronteiras**), o **Contrato de Eventos**, a **Arquitetura do Sistema**, a
**Arquitetura dos Módulos**, o **Glossário Arquitetural** (nenhuma definição alterada,
criada ou aposentada), e os módulos **Operation Center** e **Integration** — que sempre
referenciaram a intenção por identidade, sem conhecer sua composição.

**Relação com os módulos vizinhos.** **Operation Center** permanece inalterado;
**Integration** permanece inalterada; **Catalog** permanece **apenas referenciado**, por
identidade, exatamente como antes.

**Conceitos.** **Nenhum conceito, estado, agregado, entidade, objeto de valor, policy,
evento, fronteira, bounded context ou ownership foi criado, alterado ou removido** por
esta revisão.
