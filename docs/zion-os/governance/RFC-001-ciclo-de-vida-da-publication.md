# RFC-001 — Ciclo de Vida da Publication

- **Tipo:** Request for Comments — registro de contradição arquitetural
- **Origem:** Blueprint 002 — Estoque Indisponível e Anúncio Ativo (Achado 2)
- **Estado:** **ABERTA — aguardando decisão arquitetural**
- **Alterações aprovadas por esta RFC:** **nenhuma**

> **Natureza e limites deste documento.** Esta RFC **registra** uma contradição
> arquitetural. Ela **não corrige**, **não escolhe solução**, **não modifica estados,
> agregados, ownership ou conceitos**, e **não altera nenhum documento aprovado**. Seu
> único produto é **evidência suficiente para uma decisão futura**, preservando a
> governança da arquitetura do Zion OS.

---

## 1. Contexto

A contradição foi encontrada durante a fase de **Validação Arquitetural**, no
**Blueprint 002 — Estoque Indisponível e Anúncio Ativo**, registrada ali como **Achado
2 (severidade alta)**.

O cenário que a revelou é **ordinário**: um produto com anúncio ativo tem o estoque
zerado no ERP; o negócio interrompe a presença; mais tarde o estoque é reposto e se
deseja o produto novamente presente **no mesmo canal**. É o ciclo comercial mais comum
que existe.

**Por que não apareceu durante a construção da arquitetura.** Três razões, todas
instrutivas:

1. **A arquitetura foi construída sobre uma trajetória, não sobre um ciclo.** Cada
   documento modelou o percurso *nascimento → realização → fim*. O comércio real,
   porém, é **cíclico**: itens saem e voltam do ar continuamente. A natureza cíclica só
   se manifesta quando um fato **externo e adverso** atinge algo **já realizado** — que
   é precisamente o que o Blueprint 002 introduziu e o Blueprint 001 não continha.
2. **As duas regras em conflito vivem em documentos diferentes.** A regra de identidade
   está na Arquitetura do Módulo Publication; a regra de terminalidade está na
   Constituição (Máquina de Estados). **Nenhuma das duas está errada isoladamente** — e
   nenhuma revisão documento-a-documento as encontraria. O conflito é **emergente**:
   surge apenas quando um caso obriga ambas a valer ao mesmo tempo.
3. **A validação anterior usou o caso que originou a arquitetura.** O Blueprint 001
   percorreu a Sprint 0, um fluxo *forward-only*. Casos que confirmam a intenção do
   projetista raramente revelam o que ele não pensou.

Este é, portanto, o comportamento esperado do processo: a fase de Blueprints existe
justamente para produzir descobertas desta natureza **antes** de existir código.

---

## 2. Problema

A contradição decorre da coexistência de duas regras aprovadas, ambas corretas em
isolamento.

**A identidade da Publication.** A Arquitetura do Módulo Publication estabelece que o
agregado raiz Publication — a intenção de que um produto esteja presente num canal —
tem sua **identidade dada pela combinação do produto referenciado e do canal
pretendido**. Como toda identidade de agregado, ela é o que permite referenciá-lo
inequivocamente; e como toda a plataforma colabora **por referência de identidade**,
essa unicidade é estrutural, não incidental.

**A terminalidade do estado Encerrada.** A mesma Arquitetura do Módulo define
**Encerrada** como um dos dois estados **terminais** da Publication — o desfecho em que
a presença foi deliberadamente terminada. A Constituição, por sua vez, estabelece que
**de um estado terminal não parte transição** e que **o tempo só anda para frente**.

**O retorno do estoque.** Reposto o item, o negócio deseja que ele esteja novamente
presente **no mesmo canal**. Não se trata de um produto diferente, nem de outro canal:
é exatamente o mesmo par.

**O impasse lógico.** Nessa situação existem apenas dois caminhos concebíveis, e ambos
violam uma regra aprovada:

- **Reaproveitar** a Publication encerrada exigiria uma transição a partir de um estado
  terminal — **violação da terminalidade**;
- **Instanciar outra** Publication para o mesmo produto e o mesmo canal produziria dois
  agregados com a **mesma identidade** — **violação da unicidade de identidade**, com a
  consequência de tornar ambíguas todas as referências que a plataforma faz por
  identidade.

Não existe terceiro caminho dentro das regras vigentes. O impasse é **lógico**, não de
implementação: ele existe no plano dos conceitos, independentemente de qualquer
tecnologia.

**Observação complementar, sem valor de solução.** O que o negócio tipicamente deseja ao
esgotar o estoque não é *encerrar*, mas **interromper com intenção de retomar**. O
vocabulário atual da Publication oferece apenas *Encerrada* (fim deliberado) e
*Cancelada* (abandono **antes** de realizar). A ausência de um conceito para
interrupção reversível **não é a contradição** — é uma lacuna adjacente que a
contradição expõe, e que é registrada aqui apenas como contexto.

---

## 3. Documentos afetados

**Publication — Arquitetura do Módulo.**
*Regras participantes:* a identidade do agregado (produto + canal pretendido) e a
classificação de **Encerrada** como estado terminal.
*Permanecem corretas isoladamente?* **Sim.** A identidade por produto+canal expressa
fielmente o que a intenção é; a terminalidade expressa fielmente que encerrar é um
desfecho, não uma pausa.
*Como contribui:* fornece **as duas metades** do conflito, em um mesmo documento — o
que torna a colisão detectável apenas quando as duas são exercidas na mesma trajetória.

**Máquina de Estados (Constituição).**
*Regras participantes:* "estados terminais são finais — de um estado terminal não parte
transição"; "o tempo só anda para frente".
*Permanece correta isoladamente?* **Sim.** É a regra que impede estados-zumbi,
reescrita do passado e ciclos silenciosos.
*Como contribui:* é a fonte constitucional da terminalidade que a Publication herda;
fecha o caminho do reaproveitamento.

**Modelo de Domínio (Constituição).**
*Regras participantes:* o agregado como fronteira de consistência com **identidade
própria**; a colaboração entre módulos por **referência de identidade**.
*Permanece correto isoladamente?* **Sim.**
*Como contribui:* é o que torna a unicidade de identidade estrutural — e, portanto,
fecha o caminho da segunda instância.

**Modelo de Consistência e Fronteiras (Constituição).**
*Regras participantes:* o estado vivo no canal pertence ao **marketplace**; o Zion
mantém apenas percepção e **expressa a sua própria intenção**.
*Permanece correto isoladamente?* **Sim.**
*Como contribui:* fecha a saída de "deixar o canal resolver": o Zion não pode delegar ao
marketplace a expressão da sua intenção.

**Glossário Arquitetural.**
*Regras participantes:* as definições normativas de **Identidade**, **Estado**,
**Transição**, **Divergência**, **Presença** e **Publication**; e a regra de que
definições **não podem ser silenciosamente alteradas**.
*Permanece correto isoladamente?* **Sim.**
*Como contribui:* fecha as reinterpretações — impede, em particular, que *divergência*
seja esticada para cobrir uma interrupção **deliberada**, e impede que se resolva o
impasse redefinindo um termo existente.

**Arquitetura dos Módulos.**
*Regra participante:* a anatomia que exige que todo módulo de domínio possua agregados
com identidade e invariantes.
*Permanece correta isoladamente?* **Sim.**
*Como contribui:* participação menor — reforça que a identidade não é opcional.

**Blueprint 002.**
*Papel:* **fonte da evidência**, não parte da contradição.

---

## 4. Evidências

### 4.1. O fluxo completo que leva ao impasse

1. Existe uma Publication para o par (produto P, canal C), no estado **Publicada**.
2. O ERP reporta disponibilidade esgotada; a Integration traduz; o Operation Center
   acolhe como Signal, julga e compromete trabalho.
3. Uma Action solicita a interrupção da presença; a Publication emite **Solicitar
   Encerramento**.
4. A Integration conduz a conversa; o canal confirma; a Publication reconcilia e alcança
   **Encerrada** — estado **terminal**.
5. O ERP reporta disponibilidade reposta; a Integration traduz; o Operation Center
   julga e compromete o trabalho de **retomar a presença**.
6. A Action é solicitada à Publication — e **não há caminho válido**.

O fluxo é conduzido corretamente por todos os módulos até o passo 6. **Nenhum módulo
errou.** O impasse não decorre de um erro de condução, mas das regras vigentes.

### 4.2. Não existe transição válida

Do estado **Encerrada** não parte transição, por regra constitucional explícita. Não há
estado intermediário, exceção documentada ou mecanismo de reabertura previsto para a
Publication. A única exceção de terminalidade admitida em toda a Constituição é a
**compensação da Action** — que se aplica a outro agregado, em outro módulo, e cuja
finalidade é reverter um **efeito**, não retomar uma **intenção**.

### 4.3. Não existe interpretação alternativa

Quatro leituras alternativas foram examinadas. Nenhuma dissolve a contradição:

**Leitura A — "Identidade é apenas endereçamento, não unicidade."**
*Falha.* Se dois agregados compartilhassem identidade, tornar-se-iam indistinguíveis — e
toda a plataforma colabora **referenciando Publication por identidade**. A ambiguidade
se propagaria a Operation Center, Integration e auditoria. A unicidade é consequência
necessária da definição de identidade no Glossário e no Modelo de Domínio.

**Leitura B — "Nunca alcançar Encerrada: manter Publicada e tratar como divergência."**
*Falha.* A interrupção foi **deliberada**; a intenção mudou. Registrar isso como
divergência contradiz a definição normativa de **Divergência** (descompasso entre
intenção/expectativa e **percepção**) e obriga o módulo a manter uma intenção que não é
mais verdadeira — violando a invariante de que a intenção só muda deliberadamente e de
que a percepção nunca a substitui.

**Leitura C — "Usar Cancelada em vez de Encerrada."**
*Falha.* **Cancelada** é definida como abandono da intenção **antes de se realizar**.
Após publicada, a intenção foi realizada. Além disso, **Cancelada também é terminal** —
a leitura não muda nada no impasse.

**Leitura D — "Uma nova versão do conteúdo revive a intenção."**
*Falha.* Versão é um recorte **do conteúdo pretendido**, não do **estado do agregado**.
Uma nova versão não produz transição a partir de um estado terminal; e a invariante de
que versões fixadas são imutáveis não oferece qualquer mecanismo de reabertura.

### 4.4. A contradição decorre apenas das regras atuais

Nenhuma premissa externa foi introduzida. O impasse é obtido combinando exclusivamente:
a identidade da Publication (Arquitetura do Módulo Publication), a terminalidade dos
estados finais (Máquina de Estados), a unicidade estrutural da identidade (Modelo de
Domínio) e as definições normativas em vigor (Glossário). **A contradição é real,
reproduzível e independente de tecnologia.**

---

## 5. Impacto

**A implementação pode continuar?** **Parcialmente.** Os módulos cuja verdade não
depende do ciclo de vida da Publication permanecem implementáveis: **Integration**,
**Operation Center**, **Catalog** e **Identity & Access**. O que fica bloqueado é a
**implementação do ciclo de vida da Publication** — não é possível construir uma máquina
de estados que **não possui caminho válido** para um ciclo comercial rotineiro.

**Quais módulos ficam bloqueados.** Diretamente, **Publication** (seu agregado raiz e
sua máquina de estados). Indiretamente, qualquer consumidor que precise reagir aos
estados terminais da Publication ou ao retorno de uma presença.

**Quais Blueprints futuros seriam afetados.** Todos os que envolvam retomada de
presença: reativação após reposição; sazonalidade; suspensão temporária deliberada;
republicação após encerramento; retorno de item descontinuado; e — potencialmente —
migração ou troca de canal, caso a identidade seja revisitada.

**Quais invariantes ficam impossíveis de manter simultaneamente.** Três exigências não
podem coexistir hoje: **(a)** unicidade de identidade por produto+canal; **(b)**
terminalidade de Encerrada; **(c)** a necessidade comercial de que um produto volte a
estar presente no mesmo canal. Qualquer implementação seria forçada a violar uma das
três.

**O impacto de governança é maior que o técnico.** Sem decisão, cada equipe que
encontrar o caso escolherá **silenciosamente** qual regra violar — e escolhas silenciosas
divergentes produzem exatamente a deriva que toda esta arquitetura foi construída para
impedir. A Constituição determina que **estados impossíveis sejam irrepresentáveis** e
que **transições inválidas nunca existam**; hoje, o caso obriga a representar um
impossível.

---

## 6. Alternativas arquiteturais

> Enumeração **neutra** de famílias de solução. Nenhuma é recomendada, detalhada ou
> preferida. Cada uma é acompanhada da tensão arquitetural que produziria — informação
> destinada exclusivamente à decisão futura.

**Família A — Alterar a identidade da Publication.**
*Princípio:* a identidade deixaria de ser determinada somente por produto+canal,
admitindo mais de uma intenção sobre o mesmo par ao longo do tempo.
*Tensão:* toca a Arquitetura do Módulo Publication e a forma como toda a plataforma
referencia a intenção; exigiria reexaminar o que "a intenção daquele produto naquele
canal" significa quando há mais de uma.

**Família B — Alterar o ciclo de vida da Publication.**
*Princípio:* o ciclo deixaria de ser estritamente linear, admitindo interrupção
reversível ou retomada.
*Tensão:* toca diretamente a terminalidade herdada da Constituição; exigiria definir
que tipo de interrupção é reversível sem reabrir o que é definitivo.

**Família C — Alterar o conceito de terminalidade.**
*Princípio:* revisitar, no plano constitucional, o que "final" significa para agregados
cujo **sujeito persiste** (o produto e o canal continuam existindo depois do
encerramento).
*Tensão:* é a família de maior alcance — mexeria na Máquina de Estados e, portanto, em
todos os módulos, inclusive naqueles onde a terminalidade hoje funciona bem.

**Família D — Separar intenção de presença de outra forma.**
*Princípio:* distinguir o **desejo duradouro** de o produto estar presente num canal de
cada **episódio** de realização desse desejo.
*Tensão:* introduziria uma distinção conceitual adicional; exigiria verificar se ela
cabe na Linguagem Ubíqua sem redefinir termos existentes.

**Família E — Reposicionar onde o ciclo vive.**
*Princípio:* a natureza cíclica passaria a ser expressa por um conceito já existente em
outro módulo, em vez de pelo estado da Publication.
*Tensão:* toca o ownership — exigiria demonstrar que a verdade continua com um único
dono e que nenhum módulo passa a conhecer o que não deve.

**Família F — Aceitar explicitamente a limitação.**
*Princípio:* declarar que uma intenção encerrada é definitiva e que a retomada é, por
definição, um caso distinto, com tratamento deliberadamente modelado.
*Tensão:* restringe o negócio à arquitetura, e não o inverso; exigiria avaliar se o
custo operacional é aceitável dado que o ciclo é rotina, não exceção.

**Observação de neutralidade.** As seis famílias não são mutuamente exclusivas nem
igualmente custosas, e esta RFC **não avalia** custo, mérito ou preferência entre elas.

---

## 7. Critérios para decisão

A escolha futura deverá ser avaliada contra os seguintes critérios, sem ordem de
precedência estabelecida aqui:

- **Preservação do ownership.** Nenhuma verdade pode passar a ter dois donos, e nenhuma
  pode ficar sem dono.
- **Compatibilidade com a Constituição.** Especialmente com a terminalidade, com "o
  tempo só anda para frente" e com a exigência de que estados impossíveis sejam
  irrepresentáveis.
- **Coerência com a Linguagem Ubíqua.** O Glossário proíbe redefinição silenciosa: se a
  solução exigir um significado novo, deverá exigir também um **termo novo**.
- **Explicabilidade.** Um operador — ou, no modelo self-service, o próprio cliente —
  precisa entender por que um item saiu e por que voltou.
- **Simplicidade.** Menor número de conceitos novos e menor superfície de mudança.
- **Compatibilidade com os Blueprints existentes.** A solução não pode invalidar o
  Blueprint 001.
- **Custo de reabertura.** Quantos documentos aprovados a solução obriga a revisar — e
  se algum deles é constitucional.
- **Aderência à realidade comercial.** O ciclo esgotar↔repor é rotina; a arquitetura
  serve ao domínio, e não o contrário.
- **Auditabilidade histórica.** Preservar o registro de que houve presença anterior e do
  motivo de sua interrupção.

---

## 8. Estado da RFC

- **Classificação:** contradição arquitetural confirmada, entre documentos aprovados.
- **Estado:** **ABERTA.**
- **Situação:** **aguardando decisão arquitetural.**
- **Alterações aprovadas:** **nenhuma.**
- **Documentos alterados por esta RFC:** **nenhum.** Toda a arquitetura permanece
  vigente exatamente como está.
- **Condição de encerramento:** esta RFC só poderá ser encerrada por uma **decisão
  arquitetural registrada**, que escolha explicitamente uma família de solução, indique
  os documentos a revisar e passe por aprovação — nunca por alteração tácita de um
  documento existente.

**Achados relacionados, registrados separadamente.** O Blueprint 002 produziu outras
duas evidências — a ausência de observador designado para a percepção de
disponibilidade, e a cardinalidade Decision→Mission diante de um fato que atinge vários
canais. Elas **não fazem parte desta RFC**, mas guardam relação temática com ela (ciclo
de vida e ownership de fatos recorrentes) e podem, a critério da governança, ser
consideradas em conjunto na decisão futura.

---

## Encerramento

Está demonstrado, de forma inequívoca, que **existe uma contradição arquitetural real**
no ciclo de vida da Publication; **quais documentos participam dela** e por que cada um
permanece correto isoladamente; **que nenhuma interpretação alternativa a dissolve**;
**quais famílias de solução são concebíveis**; e **quais critérios deverão orientar a
decisão**.

Nenhuma correção foi aplicada. A arquitetura do Zion OS permanece congelada e vigente,
e esta RFC fica registrada como evidência formal para deliberação futura.
