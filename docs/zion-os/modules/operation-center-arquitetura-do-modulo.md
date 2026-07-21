# Operation Center — Arquitetura do Módulo (v1)

> **Natureza.** Este documento define a **arquitetura lógica interna** do módulo
> Operation Center. Não há banco, API, mensageria, evento físico, framework,
> infraestrutura, persistência ou deploy — de propósito. Ele responde **como o módulo
> se organiza por dentro**, nunca **como se implementa**.
>
> **Subordinação.** Não altera nem contradiz a Constituição do Zion OS nem a
> Arquitetura do Sistema; os **realiza** dentro das fronteiras do módulo.
>
> **Função de molde.** Esta é a primeira Arquitetura de Módulo e serve de **modelo
> estrutural** para os demais (Catalog, Publication, Integration, Identity & Access,
> AI Services) — garantindo consistência arquitetural em toda a plataforma.

---

## 1. Objetivo

O Operation Center é o módulo que **governa a atenção da operação**. Dentro do Zion,
ele não produz catálogo, não publica anúncio e não fala com o mundo externo — ele
**percebe fatos, julga o que importa, compromete trabalho e coordena sua execução**.

**Por que é um módulo de coordenação operacional.** Sua matéria-prima são fatos que
outros módulos produzem, e seu produto é **trabalho comprometido e explicado**. Ele
concentra o que a plataforma tem de mais escasso — **decisão e atenção** — e deixa a
**execução** com quem é dono dela.

**Relação com os demais módulos.** Observa fatos de Catalog, Publication e Integration;
referencia suas verdades **por identidade**; solicita ações que **eles** cumprem;
consulta Identity & Access para saber quem pode agir; e usa AI Services para
interpretar e recomendar. Não alcança o interior de nenhum deles.

Este documento define **onde cada responsabilidade do Operation Center vive** — de modo
que nenhum engenheiro precise redescobrir isso ao escrever a primeira linha de código.

---

## 2. Responsabilidades

**Pertence exclusivamente ao Operation Center:**

- **Operação** — o estado e a condição de operar um cliente num canal.
- **Signal** — o registro dos fatos observados que podem merecer atenção.
- **Decision** — o julgamento de agir ou não, com sua justificativa.
- **Mission** — o trabalho comprometido, com propósito, alvo, prioridade e prazo.
- **Action** — a expressão dos passos de uma Mission e seu acompanhamento.
- **Result** — o desfecho registrado de cada passo.
- **Indicadores** — as medidas derivadas da operação.
- **Saúde Operacional** — a condição resumida de cada Operação (sempre derivada).
- **Coordenação** — conduzir o trabalho do início ao desfecho.
- **Priorização** — ordenar a atenção segundo a política de negócio.

**NÃO pertence ao módulo:**

- a verdade do **Produto** (é do Catalog) nem do **Anúncio** (é da Publication);
- a **Conexão** com canais e qualquer conversa com o mundo externo (é da Integration);
- a **identidade** do cliente e a **autorização** (são de Identity & Access);
- a **execução técnica** de qualquer passo — o módulo **solicita**, nunca executa;
- **definir políticas de negócio** — ele as **aplica**; quem as define é o negócio;
- qualquer **verdade de outro módulo** — apenas referências por identidade.

---

## 3. Organização Interna

Os grandes componentes internos do módulo e sua responsabilidade — sem tecnologia.

- **Agregados.** Os guardiões da verdade e das invariantes. Cada um é uma fronteira de
  consistência: só ele muda a si mesmo, e sempre por transição válida.
- **Casos de Uso.** Orquestram uma **intenção operacional** de ponta a ponta. Coordenam
  agregados, políticas e fronteiras. **Não contêm regra de negócio** — decidem *o que
  chamar*, nunca *o que é certo*.
- **Policies.** As **regras mutáveis do negócio** (priorização, elegibilidade,
  reabertura, escalonamento, cancelamento, explicabilidade, governança). Vivem
  separadas porque mudam com mais frequência que o núcleo do domínio.
- **Serviços de Domínio.** Comportamento **de negócio** que não pertence naturalmente a
  um único agregado — tipicamente porque atravessa vários. São puros, estáveis e sem
  estado próprio.
- **Factories.** Garantem que um agregado **nasça válido**. Concentram as condições de
  nascimento (por exemplo, que uma Mission só possa existir a partir de uma Decision
  comprometida), impedindo que um objeto inválido chegue a existir.
- **Repositórios.** A **necessidade declarada pelo domínio** de obter e guardar seus
  agregados. São uma abstração do domínio: ele diz *o que precisa*; **como** isso é
  realizado não pertence a este documento.
- **Observadores.** A **fronteira de entrada**: recebem fatos vindos de outros módulos
  e os **traduzem** para a linguagem do Operation Center (tipicamente, em Signals).
  Traduzem — nunca importam o modelo alheio.
- **Publicadores.** A **fronteira de saída**: emitem os fatos do módulo como
  **consequência de transições válidas**. Nunca emitem o que não aconteceu.

---

## 4. Casos de Uso

Cada caso de uso expressa **uma intenção operacional**. Todos coordenam; nenhum decide
o que é certo — isso é dos agregados e das políticas.

- **Receber Signal.** Acolher um fato observado, traduzido pela fronteira de entrada, e
  registrá-lo de forma imutável. *Não julga nada.*
- **Avaliar Signal.** Submeter um ou mais fatos à elegibilidade: merecem julgamento?
  Prepara o terreno para uma Decision.
- **Criar Decision.** Formar um julgamento candidato (proposto por um humano ou pela
  IA), com os sinais considerados e o motivo.
- **Comprometer Decision.** Assumir o veredito de agir. É o único caminho que autoriza
  o nascimento de trabalho.
- **Descartar Decision.** Assumir o veredito de **não** agir, registrando o motivo — a
  não-ação também é decisão.
- **Criar Mission.** Fazer nascer o trabalho comprometido a partir de uma Decision
  comprometida, com alvo, prioridade, motivo e prazo.
- **Planejar Action.** Definir os passos que a Mission exige, dentro dela.
- **Solicitar Action.** Levar um passo ao estado de pedido, para que o módulo dono o
  cumpra. *O módulo não executa — solicita.*
- **Acompanhar Action.** Registrar que um passo foi aceito, iniciou, concluiu, falhou
  ou foi compensado, conforme os fatos retornam.
- **Registrar Result.** Guardar o desfecho de um passo, fechando o laço daquele
  trabalho.
- **Conduzir a Mission.** Fazer a Mission avançar por seus momentos válidos —
  tornar-se pronta, iniciar, aguardar quando bloqueada, concluir.
- **Reabrir Missão.** Após uma tentativa falha, decidir tentar de novo, dentro do que a
  política permite.
- **Cancelar Missão.** Abandonar deliberadamente um trabalho, com motivo — inclusive
  quando é irrecuperável.
- **Recalcular Prioridades.** Reordenar a atenção quando a realidade muda, sempre com
  justificativa.
- **Atualizar Indicadores.** Derivar as medidas da operação a partir dos fatos e
  desfechos.
- **Reavaliar Saúde Operacional.** Derivar a condição resumida de uma Operação.

---

## 5. Organização do Domínio

O domínio já está definido; aqui apenas se **organiza** o que a Constituição fixou.

**Agregados e o que cada um contém:**

- **Operation** *(raiz)* — guarda o estado da operação e a **Saúde Operacional**
  (derivada). Referencia Missions e Signals **por identidade**; não os contém.
- **Mission** *(raiz)* — **contém as Actions** (uma Action não existe fora de uma
  Mission) e, com elas, os **Results** de cada passo. Referencia Operation, Alvo e a
  Decision de origem por identidade.
- **Signal** *(raiz, imutável)* — contém o fato observado.
- **Decision** *(raiz, imutável)* — contém o julgamento: sinais considerados, motivo e
  veredito.

**Invariantes que precisam ser preservadas dentro do módulo** (nenhuma nova; todas já
constitucionais): toda Mission pertence a exatamente uma Operation e tem Alvo,
Prioridade, Motivo e Decision de origem; nenhuma Action existe sem Mission; Signal e
Decision jamais mudam depois de formados; todo Result pertence a uma Action; a Saúde é
sempre derivada; estados terminais não emitem transição; e **decidir nunca se mistura
com executar**.

**Objetos de valor que fazem sentido no interior:** Prioridade, SLA, Saúde Operacional,
Contexto, Resultado, Estado, Motivo, Alvo, Severidade e Impacto. Todos imutáveis e
definidos pelo seu valor — nunca promovidos a entidades vivas.

---

## 6. Serviços de Domínio

A pergunta certa é **de quem é o comportamento**:

- **Mantenha na entidade/agregado** quando o comportamento diz respeito **apenas à sua
  própria verdade e às suas invariantes** — por exemplo, uma Mission avançando entre
  seus momentos válidos, ou uma Action registrando seu desfecho. O agregado é quem
  protege a si mesmo.
- **Use um Serviço de Domínio** quando o comportamento é **de negócio**, **estável** e
  **atravessa mais de um agregado** — ou não pertence naturalmente a nenhum. Exemplos
  conceituais: derivar a Saúde Operacional a partir de muitos fatos e desfechos;
  comparar Missions entre si para ordená-las; consolidar Indicadores.
- **Use uma Policy** quando a regra é **mutável por decisão do negócio** — critérios de
  priorização, elegibilidade, prazos, quando reabrir ou cancelar. Se a regra pode mudar
  sem que o negócio mude de natureza, ela é política, não domínio.

Regra prática: **entidade = a própria verdade; serviço = comportamento estável entre
verdades; política = regra que o negócio pode mudar amanhã.**

---

## 7. Policies

Policies representam as **regras mutáveis do negócio**. Estão isoladas justamente para
que possam evoluir **sem tocar** o núcleo do domínio — e todas permanecem sujeitas às
leis da Constituição (explicabilidade obrigatória, nunca inventar critérios).

- **Priorização.** Como a atenção é ordenada, segundo os critérios legítimos e os
  proibidos já definidos pelo negócio.
- **Elegibilidade.** Quando um fato merece julgamento; quando uma Mission pode ser
  considerada pronta.
- **Reabertura.** Sob que condições um trabalho que falhou pode ser tentado de novo.
- **Escalonamento.** Como um prazo em risco ou vencido eleva a atenção.
- **Cancelamento.** Quando é legítimo desistir de um trabalho, e com que justificativa.
- **Explicabilidade.** O que uma justificativa precisa conter para ser aceitável — a
  política que torna concreta a exigência constitucional de que nada seja arbitrário.
- **Governança.** O que pode acontecer automaticamente e o que exige confirmação
  humana — inclusive os limites da atuação automática da IA.

Nenhuma Policy conhece infraestrutura, nenhuma altera agregados por conta própria: elas
**respondem perguntas de negócio**; quem age com a resposta é o domínio.

---

## 8. Colaboração Interna

O padrão de colaboração é sempre o mesmo:

- Um **Observador** recebe um fato de fora e o **traduz** para a linguagem do módulo.
- Um **Caso de Uso** acolhe a intenção e **orquestra**: obtém os agregados de que
  precisa, consulta as **Policies** pertinentes e conduz a operação.
- A **Policy** responde uma pergunta de negócio (é elegível? qual prioridade? pode
  reabrir?) — **com justificativa**.
- O **Agregado** recebe o veredito e executa a **transição**, protegendo suas
  invariantes. Só ele muda a si mesmo.
- A transição produz um **Result** (quando há desfecho) e, sempre, um **fato**.
- O **Publicador** emite esse fato — **porque houve transição**, nunca antes dela.

Duas fronteiras internas nunca se cruzam: **o Caso de Uso não decide o que é certo** (a
regra é da Policy e a invariante é do Agregado), e **o Agregado não conhece o mundo de
fora** (quem fala com fora são Observadores e Publicadores).

Quando o comportamento atravessa agregados (derivar Saúde, ordenar Missions), quem o
executa é um **Serviço de Domínio** — consultado pelo Caso de Uso, nunca pelo agregado
de outro.

---

## 9. Relação com outros módulos

Sempre pelas fronteiras já estabelecidas, sem violar propriedade:

- **Catalog.** O Operation Center **observa** fatos de Produto e o **referencia por
  identidade** como Alvo. **Nunca** altera Produto nem lê o interior do Catalog.
- **Publication.** **Observa** fatos de Anúncio e **solicita** ações de publicação/
  correção que a Publication cumpre dentro da sua fronteira. **Nunca** publica nem
  altera Anúncio.
- **Integration.** **Observa** fatos de canal (conectado, expirado, recusado) e reage a
  eles como Signals. **Nunca** fala com o marketplace nem possui conexões.
- **Identity & Access.** **Consulta** quem pode agir; a autorização condiciona a
  execução dos casos de uso. **Nunca** possui identidade nem define permissão.
- **AI Services.** **Usa** a capacidade para interpretar fatos, propor Decisions e
  explicar prioridades. A IA entra pelo **mesmo portão** que um humano (um caso de
  uso), **nunca** mutando agregados diretamente.

Em todos os casos: **fatos e identidades atravessam; propriedade e responsabilidade,
não.**

---

## 10. Capacidades Transversais no módulo

Participam **nas bordas** — tipicamente na camada que orquestra os casos de uso — e
**nunca alteram o domínio**:

- **IA.** Entra como **proposta** (uma Decision proposta, uma explicação, uma
  interpretação). Não muda estado; não cria Mission sem Decision; não executa fora de
  Mission.
- **Autorização.** Aferida **antes** de qualquer caso de uso que mude estado; é portão,
  não verdade do módulo.
- **Auditoria.** Registra fatos e transições de forma **append-only**; observa e nunca
  altera o que registrou.
- **Observabilidade.** Assiste ao módulo sem participar das suas decisões.
- **Configuração.** Fornece parâmetros às Policies **sem carregar verdade de negócio** —
  o parâmetro é ajuste; a regra continua sendo política.

Nenhuma dessas capacidades entra **dentro** dos agregados nem se torna dona de qualquer
verdade do módulo.

---

## 11. Anti-modelos

Erros de arquitetura que nunca devem acontecer neste módulo:

- **Caso de Uso contendo regra de negócio** (a regra é da Policy ou do Agregado).
- **Policy acessando infraestrutura** — políticas são puras.
- **Agregado consultando outro módulo** — o agregado só conhece a si mesmo.
- **Repositório contendo lógica** de negócio.
- **Serviços gigantes** que concentram o que deveria estar nos agregados.
- **Agregados anêmicos** — sem comportamento, com as regras vazando para fora.
- **Dependências circulares** entre componentes internos.
- **Action modificando Product** — invadir a verdade do Catalog.
- **Decision executando integração** — misturar julgamento com execução.
- **Mission criada sem Decision** comprometida.
- **Signal ou Decision mutados** após formados.
- **Publicar fato sem transição** que o justifique.
- **IA mutando agregados diretamente**, sem passar por um caso de uso.
- **Regra mutável cravada dentro do agregado** — transformando política em invariante.
- **Observador importando o modelo alheio** em vez de traduzi-lo.
- **Agregado grande demais** — por exemplo, uma Operation contendo todas as suas
  Missions em vez de referenciá-las.
- **Prioridade atribuída sem justificativa** — viola a exigência de explicabilidade.

---

## 12. Questões deferidas

> Pertencem a documentos e decisões futuras.

- **Persistência** dos agregados.
- **APIs** e contratos técnicos do módulo.
- **Eventos físicos** e **mensageria**.
- **Banco** de dados.
- **Frameworks** e linguagem.
- **Testes** e estratégia de verificação.
- **Performance** e **escalabilidade**.

---

## Critério de longevidade e função de molde

Esta arquitetura deve permanecer correta ainda que o Zion troque de linguagem, banco,
framework ou infraestrutura, deixe de ser um monólito ou se torne distribuído — porque
representa **apenas a organização lógica interna** do módulo.

Ela é também o **molde** dos demais módulos. Catalog, Publication, Integration,
Identity & Access e AI Services deverão seguir a **mesma anatomia** — agregados que
guardam a verdade, casos de uso que orquestram, políticas que carregam o que é mutável,
serviços para o que atravessa agregados, fábricas que garantem nascimento válido,
repositórios como necessidade declarada, e observadores/publicadores nas fronteiras —
ajustando apenas **qual verdade** cada um protege.

Ao final deste documento, onde cada responsabilidade do Operation Center pertence está
decidido. Escrever código passa a ser escolher meios para servir esta organização.
