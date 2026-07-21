# Blueprint de Implementação 001 — Publicação Idempotente

> **Natureza.** Primeiro artefato da fase **Construção Guiada pela Arquitetura**. Não
> produz arquitetura: **produz engenharia orientada pela arquitetura**. Não escolhe
> tecnologia, framework, banco, contrato técnico, deploy ou infraestrutura — de
> propósito. Discute exclusivamente **organização arquitetural da implementação**.
>
> **Subordinação.** Não altera nenhum documento normativo, Blueprint, ADR, nem abre
> RFC. A arquitetura é a régua; o software é o objeto medido.
>
> **Função de modelo.** Inaugura a fase e serve de padrão para todos os Blueprints de
> Implementação futuros.

---

## 1. Objetivo

**Por que existe um Blueprint de Implementação.** A arquitetura do Zion OS foi
validada conceitualmente — mas uma arquitetura só prova seu valor quando **orienta a
construção**. Este documento existe para que nenhum engenheiro precise adivinhar onde
uma responsabilidade pertence.

**Blueprint Arquitetural × Blueprint de Implementação.** São opostos em direção:

- No **Blueprint Arquitetural**, o **objeto do teste é a arquitetura**. Um caso real a
  pressiona, e o que se procura são fragilidades da fundação.
- No **Blueprint de Implementação**, a **arquitetura é a régua** e o **objeto é o
  software**. O que se procura são responsabilidades mal posicionadas.

Um **valida**; o outro **guia**.

**Por que a implementação nasce da arquitetura.** A hierarquia do Manifesto é
inviolável: as camadas superiores comandam, as inferiores obedecem. Uma decisão técnica
é sempre **consequência** da arquitetura, jamais sua origem. Quando o inverso acontece —
e a Sprint 0 é a prova disso — a mecânica de um sistema externo acaba no meio do
negócio, e um defeito nasce que não teria como existir.

---

## 2. Escopo

Exclusivamente a **Sprint 0**: publicar um calçado no Mercado Livre pelo modelo de
presença por tamanho, com a idempotência da grade de tamanhos conquistada e validada em
produção.

Nenhum caso novo é introduzido. Nenhuma funcionalidade é proposta. O que existe é
**mapeado**; o que falta é **nomeado**.

---

## 3. Correspondência Arquitetura → Implementação

> Por responsabilidade da Sprint 0. Apenas responsabilidades — sem tecnologia.

| Responsabilidade | Módulo | Agregado | Caso de Uso | Policy | Serviço de Domínio | Porta | Adaptador | Infraestrutura |
|---|---|---|---|---|---|---|---|---|
| Declarar a intenção de presença | Publication | Publication | Criar Publication | — | — | Repositório de Publication | — | Realização do repositório |
| Compor e fixar o conteúdo pretendido | Publication | Publication (Listing) | Planejar Publicação | Estratégia | Planejamento, Versionamento | Referência a Produto | Observador de fatos de Produto | — |
| Canonizar a expressão de tamanhos | Publication | Publication (Listing) | Planejar Publicação | — | Planejamento | — | — | — |
| Avaliar se a intenção é realizável | Publication | Publication | Avaliar Elegibilidade | Elegibilidade, Explicabilidade | Validação de elegibilidade | Consulta de Capacidades | Observador de fatos de Capacidade | — |
| Julgar que a publicação deve ocorrer | Operation Center | Signal → Decision → Mission | Receber/Avaliar Signal, Comprometer Decision, Criar Mission, Solicitar Action | Priorização, Governança | — | Repositórios de OC | Observador de fatos | — |
| Solicitar a realização (idempotência de intenção) | Publication | Publication (Solicitação) | Solicitar Publicação | **Idempotência (equivalência)** | Consistência | Publicação de fatos | Publicador | — |
| Determinar o que o canal exige | Integration | Channel (Capability) | Resolver Capacidades | Resolução de Capacidade | Capability Resolution | — | — | — |
| Traduzir a intenção para a exigência do canal | Integration | Channel (Mapping) | Enviar Solicitação | Compatibilidade | **Translation** | Porta de conversa externa | **Tradutor** | Realização da conversa |
| Obter ou reutilizar a grade de tamanhos | Integration | Channel (Mapping) + Communication | Enviar Solicitação | **Idempotência de Comunicação**, Equivalência, Retry | Translation, Communication Planning | Porta de conversa externa | Adaptador de canal | — |
| Realizar cada presença no canal | Integration | Communication | Enviar Solicitação | Retry, Timeout | Communication Planning | Porta de conversa externa | Adaptador de canal | — |
| Traduzir resposta e erro | Integration | Communication, External Observation | Traduzir Resposta, Traduzir Erro | Reconciliação | Translation | Publicação de fatos | Tradutor + Publicador | — |
| Zelar pela ponte com o canal | Integration | Connection | Configurar Conexão, Registrar Perda de Validade | Compatibilidade | — | Custódia de credenciais | Adaptador de conexão | Realização da custódia |
| Reconciliar intenção com o que voltou | Publication | Publication | Receber retorno, Reconciliar, Atualizar Estado | Reconciliação, Republicação | Reconciliação | Publicação de fatos | Observador + Publicador | — |
| Registrar desfecho e concluir o trabalho | Operation Center | Mission (Action), Result | Registrar Result, Conduzir a Mission | Reabertura, Cancelamento | — | Repositórios de OC | Observador | — |
| Aferir quem pode agir | Identity & Access *(verdade)* | — | — | — | — | Porta de autorização | Capacidade transversal | — |
| Observar o comportamento do sistema | *(transversal)* | — | — | — | — | Porta de observabilidade | Capacidade transversal | — |
| Sugerir conteúdo e explicar decisões | AI Services *(transversal)* | — | *(entra por caso de uso)* | — | — | Porta de assistência | Capacidade transversal | — |

---

## 4. Organização do módulo Publication

**Domínio.** O coração, que **não depende de nada**: o agregado **Publication** com sua
identidade própria e a invariante de vigência única; as entidades internas **Listing
versionado**, **Solicitação** e **Registro de Histórico**; os objetos de valor
(estado, canal pretendido, versão, estratégia, percepção, motivo, resultado); as
**Policies** (elegibilidade, estratégia de atualização, republicação, equivalência,
reconciliação, explicabilidade, governança); os **Serviços de Domínio** (planejamento,
reconciliação, versionamento, validação de elegibilidade, consistência); e a **Factory**
que garante nascimento válido — inclusive a vigência única.

**Aplicação.** Os **casos de uso**, que orquestram e **não contêm regra**: Criar
Publication, Planejar Publicação, Avaliar Elegibilidade, Solicitar Publicação /
Atualização / Encerramento, Receber retorno da execução, Atualizar Estado, Reconciliar
intenção com resposta, Registrar Falha, Reprogramar, Cancelar.

**Portas.** O que o domínio **declara precisar**, sem saber como se realiza: obter e
guardar Publications; consultar **capacidades** do canal em vocabulário do Zion;
referenciar o Produto por identidade; publicar fatos; aferir autorização.

**Adaptadores.** As **fronteiras**: observadores que traduzem fatos de Produto, pedidos
do Operation Center e retornos da Integration para a linguagem do módulo; publicadores
que emitem os fatos do anúncio.

**Infraestrutura.** A realização técnica das portas — **fora do escopo deste
documento**, e deliberadamente substituível sem tocar no domínio.

**Direção das dependências.** Adaptadores → Aplicação → Domínio; Portas declaradas de
dentro, realizadas de fora. O Domínio **não conhece** ninguém.

---

## 5. Organização do módulo Integration

**Domínio.** **Channel** (com suas **Capabilities** e **Mappings**), **Connection**,
**Communication** e **External Observation**; as **Policies** (retry, timeout, fallback,
equivalência, **idempotência de comunicação**, reconciliação, compatibilidade, resolução
de capacidade); e os **Serviços de Domínio** (**Translation**, **Capability
Resolution**, Communication Planning, Retry Planning, Reconciliation, Consistency).

**Aplicação.** Registrar Canal, Resolver Capacidades, Configurar Conexão, Enviar
Solicitação, Receber Resposta, Traduzir Resposta, Traduzir Erro, Reconhecer Divergência,
Atualizar Percepção, Notificar Domínio, Reconciliar Comunicação.

**Portas.** Conversa com o exterior; custódia de credenciais; obter e guardar canais,
conexões, comunicações e observações; publicar fatos.

**Adaptadores.** O **adaptador de canal** — onde vive **toda** a mecânica real de um
marketplace — e os **Tradutores**, que convertem nos dois sentidos.

**Onde vive cada peça citada.**
- **Translator** — Serviço de Domínio (o ato) + Adaptador (a expressão concreta);
- **Capability Resolver** — Serviço de Domínio, apoiado nas Capabilities do Channel;
- **Mapping** — **conhecimento**, dentro do agregado Channel;
- **Communication** — agregado próprio, com ciclo de vida;
- **Retry** — Policy, aplicada por Retry Planning;
- **Idempotência de comunicação** — Policy, que protege o **diálogo**.

**Por que nenhuma dessas responsabilidades invade Publication.** Porque Publication
**nunca as vê**. Ela emite uma solicitação em vocabulário do Zion e observa fatos
traduzidos. Não conhece grades de tamanho, categorias de canal, identificadores exigidos
nem formatos. A prova operacional é direta: **se o canal deixar de exigir grades, nada
muda fora da Integration**.

---

## 6. Fluxo da implementação (Sprint 0)

**1 — A intenção nasce.** *Use Case:* Criar Publication. *Aggregate:* Publication.
*Policy:* — . *Fato:* intenção criada. *Porta:* repositório. *Adaptador:* — . *Próximo:*
Operation Center.

**2 — O conteúdo é composto e versionado.** *Use Case:* Planejar Publicação.
*Aggregate:* Publication (Listing). *Policies:* Estratégia, Versionamento. *Fato:*
versão fixada. *Porta:* referência a Produto. *Adaptador:* observador de fatos de
Produto. *Próximo:* Operation Center.

**3 — A elegibilidade é avaliada.** *Use Case:* Avaliar Elegibilidade. *Aggregate:*
Publication. *Policies:* Elegibilidade, Explicabilidade. *Fato:* elegível **ou**
inelegível com motivo. *Porta:* consulta de capacidades. *Adaptador:* observador de
fatos de Capacidade. *Próximo:* Operation Center. — *É aqui que o identificador
comercial ausente é detectado **antes** da conversa com o canal.*

**4 — A operação julga e compromete.** *Use Cases:* Receber/Avaliar Signal, Comprometer
Decision, Criar Mission, Solicitar Action. *Aggregates:* Signal → Decision → Mission.
*Policies:* Priorização, Governança. *Fatos:* decisão comprometida, missão formada, ação
solicitada. *Próximo:* Publication.

**5 — A realização é solicitada.** *Use Case:* Solicitar Publicação. *Aggregate:*
Publication (Solicitação). *Policy:* **Idempotência (equivalência)** — esta versão já
foi realizada? *Fato:* solicitação emitida. *Porta:* publicação de fatos. *Adaptador:*
publicador. *Próximo:* Integration.

**6 — As capacidades são resolvidas.** *Use Case:* Resolver Capacidades. *Aggregate:*
Channel (Capability). *Policy:* Resolução de Capacidade. *Serviço:* Capability
Resolution. *Próximo:* a própria tradução.

**7 — A intenção é traduzida e a grade é obtida ou reutilizada.** *Use Case:* Enviar
Solicitação. *Aggregates:* Channel (Mapping) + Communication. *Policies:* **Idempotência
de Comunicação**, Equivalência, Retry. *Serviços:* Translation, Communication Planning.
*Porta:* conversa externa. *Adaptador:* adaptador de canal. — *Toda a mecânica da Sprint
0 — buscar antes de criar, paginar, comparar de forma normalizada, ignorar grades de
padrão alheio, reconsultar após recusa por nome — acontece **aqui dentro**.*

**8 — Cada presença é realizada.** *Use Case:* Enviar Solicitação. *Aggregate:*
Communication. *Policies:* Retry, Timeout. *Adaptador:* adaptador de canal. *Próximo:*
tradução do retorno.

**9 — A resposta vira fato do Zion.** *Use Cases:* Receber Resposta, Traduzir
Resposta/Erro, Atualizar Percepção. *Aggregates:* Communication, External Observation.
*Fatos (traduzidos):* presença realizada, falha com motivo, recusa. *Porta:* publicação
de fatos. *Próximo:* Publication.

**10 — A intenção reconcilia.** *Use Cases:* Receber retorno, Reconciliar, Atualizar
Estado. *Aggregate:* Publication. *Policy:* Reconciliação. *Fatos:* publicado, falhou,
divergiu. *Próximo:* Operation Center.

**11 — O trabalho se encerra e é medido.** *Use Cases:* Registrar Result, Conduzir a
Mission, Atualizar Indicadores. *Aggregates:* Mission (Action), Result, Operation.
*Fatos:* resultado registrado, missão concluída, operação atualizada.

---

## 7. Fronteiras

- **Publication nunca conhece o Mercado Livre.** Não sabe o que é grade de tamanho,
  categoria de canal ou identificador exigido. Emite solicitação; observa fatos.
- **Integration nunca conhece regras de negócio.** Sabe **como dizer**, nunca **o que é
  certo**. Não decide se deve publicar, quando, nem com que prioridade.
- **Operation Center nunca executa integração.** Julga, compromete e acompanha; a
  conversa é sempre de outro.
- **Catalog nunca publica.** É dono do Produto, referenciado por identidade; não conhece
  canais nem intenções.
- **Identity nunca governa o domínio.** Detém a verdade sobre quem pode agir; a aferição
  é portão, não decisão de negócio.
- **AI nunca altera agregados.** Sugere conteúdo, explica elegibilidade e divergência,
  recomenda estratégia — sempre entrando pelo **mesmo portão que um humano**: um caso de
  uso.

---

## 8. Mapeamento do código existente

> Classificação arquitetural de cada componente da Sprint 0. Não há crítica ao código —
> apenas **posicionamento**.

| Componente existente | Classificação | Justificativa arquitetural |
|---|---|---|
| `normalizarTamanho` | **Muda de módulo** | Canoniza a expressão de tamanhos na linguagem do Zion — compõe o conteúdo pretendido. Pertence ao **domínio de Publication** (Planejamento). Função pura, sem dependências: movimento trivial. |
| `medidasDaMarca` / tabelas de medidas | **Muda de módulo** | Medida real do produto é **verdade de Produto** → **Catalog**, consumida por Publication na composição. |
| `precisaUserProducts`, `dominioDaCategoria` | **Muda de módulo** | Exprimem **o que o canal exige** → **Integration / Capability**. |
| `preverCategoria` | **Muda de módulo** | Categoria é conceito **do canal** → **Integration / Capability Resolution**. |
| `montarItensUserProducts` | **Muda de módulo** | Dá forma ao que o canal exige → **Integration / Tradutor**. |
| `montarBundleUserProducts` | **Deve ser dividido** | Compõe conteúdo pretendido (marca, gênero, tamanhos, fotos, descrição) → **Publication / Planejamento**; dá forma à exigência do canal → **Integration / Tradutor**. |
| `criarGuiaTamanhos` (busca paginada, filtro anti-legado, normalização de nome, rebusca pós-colisão, leitura de linhas oficiais) | **Permanece onde está, muda de camada** | É **integralmente Integration**. Internamente distribui-se em **Mapping** (correspondência com a grade), **Capability** (o canal exige grade e nome único), **Communication** (o diálogo) e **Policies** (equivalência, idempotência de comunicação, retry). |
| `normalizarNomeGuia` | **Permanece** (na Integration) | Suporte ao critério de equivalência — **policy** da fronteira, não do negócio. |
| `criarItem` | **Muda de camada** | Execução da conversa → **adaptador de canal**. |
| `extrairErro`, `mensagemErroTexto` | **Permanece** (na Integration) | **Tradução de erro** — converter recusa do canal em motivo do Zion. |
| `trocarCodigoPorToken`, `renovarToken`, leitura/atualização do canal | **Muda de camada** | Custódia e validade da ponte → **Integration / Connection**, atrás de porta. |
| Ponto de entrada de publicação | **Deve ser dividido** | Hoje acumula autorização (transversal), conexão (Integration), previsão de categoria (Integration), bifurcação (Integration), obtenção de grade (Integration), laço de itens (Integration) e coordenação (Operation Center). Deve tornar-se **fino**, acionando casos de uso. |
| Montagem do payload no lado do cliente | **Muda de camada** | A intenção **não se compõe fora do domínio**; vira **caso de uso de Publication**. |
| Autorização de acesso ao cliente | **Permanece** | **Capacidade transversal**, apoiada na verdade de **Identity & Access**. |
| Ponto de entrada de autorização do canal | **Permanece** (na Integration) | Interface da **Connection**. |
| Rota temporária de diagnóstico | **Deve desaparecer** | Artefato temporário; sua remoção já é item de governança. |
| Registros estruturados de publicação e de grade | **Permanece, com desdobramento** | Observabilidade é **transversal**; parte do que hoje é registro (origem, motivo) passa a ser **fato publicado**. |
| Esteira de geração assistida | **Muda de posição** | **AI Services** (transversal), entrando por **caso de uso** — nunca mutando agregados. |
| **Agregado Publication** (identidade própria, estados, versões, vigência única) | **Deve nascer** | Não existe hoje; é a verdade central do módulo. |
| **Casos de uso e Policies explícitas de Publication** | **Deve nascer** | Hoje implícitos no fluxo; devem ser nomeados e isolados. |
| **Módulo Operation Center** (Signal, Decision, Mission, Action, Result) | **Deve nascer** | Não existe; hoje a coordenação está diluída no ponto de entrada. |
| **Agregados Channel, Connection, Communication, External Observation** | **Deve nascer** | Existem como funções; devem existir como verdades com ciclo de vida. |
| **Observadores e Publicadores de fatos** | **Deve nascer** | A colaboração ainda é direta; deve passar a ser por fatos. |

---

## 9. Débitos arquiteturais

**Aceitáveis (por ora).** Observabilidade por registros estruturados, sem que todos
sejam fatos formais. Colaboração ainda direta entre partes, sem publicação explícita de
fatos. Geração assistida operando fora do laço formal. *Nenhum impede evolução; todos
são endereçados no plano da §10.*

**Precisam migrar.** A composição da intenção fora do domínio. A ausência do agregado
Publication com identidade e ciclo de vida. As Policies implícitas no fluxo. A ausência
do Operation Center. Conhecimento de canal utilizado fora da Integration.

**Bloqueadores.**

1. **O ponto de entrada de publicação acumula decisão, tradução e execução.** Enquanto
   permanecer assim, **adicionar um segundo canal exigirá tocá-lo** — o que viola
   diretamente o critério de longevidade da Integration ("adicionar um canal = capacidades,
   mapeamentos e tradutores; **nada mais no Zion muda**"). É bloqueador da evolução
   multi-marketplace.
2. **A rota temporária de diagnóstico permanece em produção.** Bloqueador de
   **governança**, já registrado; artefatos temporários não podem sobreviver ao seu
   propósito.

---

## 10. Plano de Evolução

Sequência incremental. **Cada passo preserva o funcionamento; nenhum exige reescrita.**

**Passo 1 — Organizar por módulo.** Mover, sem alterar comportamento, cada peça para o
seu dono: canonização de tamanhos → Publication; medidas → Catalog; mecânica de canal →
Integration. *Ganho: a fronteira torna-se visível.*

**Passo 2 — Extrair Policies.** Tornar explícito o que hoje está implícito:
elegibilidade, equivalência de intenção, equivalência de comunicação, retry. *Ganho: o
mutável separa-se do invariante.*

**Passo 3 — Introduzir portas.** O domínio passa a **declarar o que precisa**; a
execução deixa de ser chamada diretamente. *Ganho: o domínio deixa de depender de
qualquer coisa externa.*

**Passo 4 — Separar adaptadores.** Isolar o adaptador de canal e os tradutores. *Ganho:
resolve o **bloqueador 1** — um segundo canal passa a ser um adaptador novo.*

**Passo 5 — Publicar fatos.** Converter as colaborações diretas em fatos observados.
*Ganho: os módulos passam a colaborar como a arquitetura determina.*

**Passo 6 — Introduzir o Operation Center.** Envolver a publicação existente no laço
Signal → Decision → Mission → Action → Result. *Ganho: a coordenação ganha dono, e a
decisão separa-se da execução.*

**Passo 7 — Completar Publication.** Materializar o agregado com identidade própria,
estados, versões e a invariante de vigência única. *Ganho: a intenção passa a ter
verdade e ciclo de vida — e o ciclo esgotar↔repor torna-se expressável.*

**Higiene, a qualquer momento:** remover a rota temporária de diagnóstico (**bloqueador
2**), independente da sequência acima.

---

## 11. Critérios de Aceitação

A implementação estará aderente quando **todas** forem verificáveis:

- **Cada responsabilidade possui um único dono** — para qualquer comportamento, existe
  exatamente um módulo que responde por ele.
- **Nenhuma regra de negócio atravessa módulos** — nenhuma decisão de negócio vive na
  fronteira nem na coordenação.
- **Nenhuma integração conhece domínio** — os tradutores sabem dizer, não julgar.
- **Nenhum módulo conhece detalhes externos** — nenhum termo, código ou formato de canal
  aparece fora da Integration.
- **Toda colaboração ocorre por fatos** — nenhum módulo alcança o interior de outro.
- **Toda identidade pertence a um agregado** — nada é referenciado por composição de
  atributos de negócio.

**Teste de longevidade, verificável na prática:** adicionar um segundo marketplace deve
exigir **capacidades, mapeamentos e tradutores** — e **nenhuma alteração** em Catalog,
Publication ou Operation Center.

---

## 12. Conclusão

A Sprint 0 nasceu como uma solução para um problema concreto: publicar calçado no
Mercado Livre sem que a grade de tamanhos colidisse consigo mesma. Vista sob a
arquitetura, ela passa a ser outra coisa — **a primeira evidência concreta de que a
arquitetura do Zion OS pode ser implementada sem adaptações estruturais**.

A prova está no mapeamento da §8: **nenhuma peça da Sprint 0 ficou sem lugar**. Cada
função, cada regra, cada decisão encontrou **um único dono possível**. Não foi preciso
flexibilizar princípio algum, criar exceção, nem inventar um conceito para acomodar o
código existente. O que o mapeamento revelou não foi incompatibilidade — foi
**posicionamento**: peças certas em lugares provisórios.

Mais revelador ainda é **onde a idempotência foi parar**. Ela foi descoberta
empiricamente, sob pressão de produção, meses antes de a arquitetura existir. E, ao ser
mapeada, assentou exatamente onde a arquitetura previa: a **invariante** na Publication,
o **critério de equivalência** como policy, e a **mecânica de realizá-la** na Integration.
A arquitetura não foi construída para caber no código — **o código, reorganizado, cabe
na arquitetura**. Quando teoria e prática chegam ao mesmo lugar por caminhos
independentes, é sinal de que ambas estão certas.

Com este documento, a arquitetura do Zion OS **deixa de ser um conjunto de documentos e
passa a orientar diretamente a construção do software**. A partir daqui, a pergunta que
um engenheiro faz diante de qualquer código não é mais *"onde isso deveria ficar?"* — é
*"o que a arquitetura já decidiu sobre isso?"*.
