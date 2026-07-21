# Zion OS — Arquitetura dos Módulos (v1)

> **Natureza.** Este documento formaliza a **anatomia oficial** de um módulo do Zion
> OS. Não cria conceitos novos: apenas **nomeia o padrão** que emergiu consistentemente
> na construção dos módulos Operation Center, Publication e Integration. Não há
> tecnologia, API, infraestrutura ou implementação — de propósito.
>
> **Força normativa.** A partir daqui, **nenhum módulo poderá ser criado sem respeitar
> esta anatomia**. Ela é o molde de qualquer módulo presente ou futuro.

---

## 1. Objetivo

Todos os módulos do Zion seguem uma arquitetura comum porque **todos estão sujeitos às
mesmas leis**. A Constituição não vale "mais" em um módulo e "menos" em outro: cada
verdade tem um único dono; decidir não é executar; módulos comunicam fatos, não
interiores. Uma anatomia comum é a **expressão estrutural de leis comuns** — se as
regras são as mesmas, a forma de organizá-las também deve ser.

A consequência prática é decisiva: qualquer engenheiro que já entendeu **um** módulo do
Zion entende a **estrutura** de todos. O que muda de um para outro não é a anatomia — é
**qual verdade** cada um protege.

**Arquitetura do Sistema × Arquitetura de Módulo.**
A **Arquitetura do Sistema** descreve o **entre**: quais módulos existem, quem depende
de quem, quem pode conhecer quem, onde termina um e começa outro.
A **Arquitetura de Módulo** descreve o **dentro**: como um módulo se organiza para
proteger a sua verdade e cumprir a sua responsabilidade.
Uma olha o mapa; a outra olha o organismo. Este documento é a **gramática** da segunda.

---

## 2. Anatomia de um Módulo

A estrutura canônica tem duas partes: o que o módulo **declara** (sua identidade) e o
que o módulo **tem** (seus componentes).

### O que o módulo declara

- **Objetivo.** Qual verdade o módulo possui e por que existe. Uma frase que, se
  apagada, deixaria o módulo sem razão de ser.
- **Responsabilidades.** O que pertence ao módulo — e, com igual importância, **o que
  não pertence**. A fronteira se define tanto pelo que se afirma quanto pelo que se
  recusa.
- **Modelo.** A organização do domínio interno: agregados, entidades, objetos de valor,
  invariantes, estados e relacionamentos.

### O que o módulo tem

- **Casos de Uso.** Expressam as intenções que o módulo atende. **Orquestram**: obtêm
  agregados, consultam políticas, acionam serviços. **Nunca contêm regra de negócio.**
- **Agregados.** As fronteiras de consistência. Guardam a verdade e as invariantes; **só
  eles mudam a si mesmos**, e sempre por transição válida.
- **Entidades.** Elementos com identidade e ciclo de vida próprios **dentro** de um
  agregado.
- **Objetos de Valor.** Definidos pelo seu valor, imutáveis, sem identidade própria.
- **Policies.** As **regras mutáveis** do negócio, isoladas para poderem mudar sem tocar
  o núcleo. Respondem perguntas de negócio — **com justificativa** — e nunca agem por
  conta própria.
- **Serviços de Domínio.** Comportamento de negócio **estável** que **atravessa
  agregados** ou não pertence naturalmente a nenhum.
- **Factories.** Garantem que um agregado **nasça válido**, concentrando as condições de
  nascimento — de modo que um objeto inválido jamais chegue a existir.
- **Repositórios.** A **necessidade declarada pelo domínio** de obter e guardar seus
  agregados. O domínio diz *o que precisa*; **como** se realiza não pertence a esta
  camada.
- **Observadores.** A fronteira de **entrada**: acolhem fatos vindos de fora e os
  **traduzem** para a linguagem do módulo. Traduzem — nunca importam o modelo alheio.
- **Publicadores.** A fronteira de **saída**: emitem os fatos do módulo **como
  consequência de transições válidas**. Nunca emitem o que não aconteceu.
- **Capacidades Transversais.** Como IA, autorização, auditoria, observabilidade e
  configuração participam do módulo — sempre **nas bordas**, nunca alterando sua
  verdade.
- **Anti-modelos.** Os erros estruturais próprios daquele módulo. Um módulo sem
  anti-modelos declarados é um módulo cuja fronteira ainda não foi pensada.

---

## 3. Componentes Obrigatórios

Sempre existem, em todo módulo de domínio — porque cada um é a expressão estrutural de
uma lei constitucional:

- **Objetivo e Responsabilidades (inclusive as negativas).** Sem elas não há fronteira,
  e sem fronteira não há dono único da verdade.
- **Modelo com pelo menos um Agregado.** Um módulo existe para **possuir uma verdade**;
  uma verdade sem agregado que a guarde é uma verdade desprotegida.
- **Invariantes.** Uma verdade sem regras invioláveis não é uma verdade que valha a pena
  possuir — é apenas um depósito de dados.
- **Casos de Uso.** Um módulo que não atende a nenhuma intenção não é um módulo; é uma
  estrutura inerte.
- **Capacidades Transversais.** Toda ação precisa ser autorizada e auditável; nenhum
  módulo está isento disso.
- **Anti-modelos.** A fronteira se define também pelo que é proibido; declará-los é
  parte de existir.

---

## 4. Componentes Opcionais

Um componente existe **quando há uma responsabilidade para ele**. Criar componentes por
simetria — porque "outro módulo tem" — é cerimônia, não arquitetura.

- **Factories.** Dispensáveis quando o nascimento de um agregado não tem condições além
  das suas próprias invariantes. Necessárias quando o nascimento **depende de contexto**
  — como um trabalho que só pode nascer de um julgamento já assumido.
- **Policies.** Dispensáveis quando o módulo **não tem regras mutáveis** — tudo o que
  ele afirma é invariante. Raro, mas legítimo em módulos essencialmente custodiais.
- **Serviços de Domínio.** Dispensáveis quando **nenhum comportamento atravessa
  agregados**; nesse caso, tudo pertence às próprias entidades.
- **Observadores.** Dispensáveis quando o módulo **não reage a fatos de fora** — o caso
  de módulos que são **fonte**, não observadores.
- **Publicadores.** Dispensáveis quando o módulo **não produz fatos relevantes para
  outros**. Muito raro: quase todo dono de verdade tem algo a comunicar.
- **Repositórios.** Dispensáveis apenas onde **não há agregados a guardar** — ou seja,
  em capacidades transversais. Em módulos de domínio, são efetivamente obrigatórios.
- **Tradutores.** O caso inverso: existem **apenas** em módulos de fronteira, cuja
  responsabilidade é converter linguagens. Um módulo de domínio **não deve** ter
  tradutores — se tem, é sinal de que está falando uma língua estrangeira que não
  deveria conhecer.

Critério geral: **componente sem responsabilidade é ruído**; **responsabilidade sem
componente é regra escondida**. Ambos são defeitos.

---

## 5. Colaboração Interna

Todo módulo colabora internamente do mesmo modo:

- Um **Observador** acolhe um fato de fora e o **traduz** para a linguagem do módulo.
- Um **Caso de Uso** recebe a intenção e **orquestra**: obtém os agregados necessários,
  consulta as **Policies** pertinentes e aciona um **Serviço de Domínio** quando o
  comportamento atravessa agregados.
- A **Policy** responde uma pergunta de negócio, **com justificativa**.
- O **Agregado** recebe o veredito e executa a **transição**, protegendo suas
  invariantes.
- A transição produz um novo **estado** e um **fato** consumado.
- O **Publicador** emite esse fato — **porque houve transição**, nunca antes dela.

Duas fronteiras internas **nunca** se cruzam, em módulo algum:

1. **O Caso de Uso não decide o que é certo.** A regra é da Policy; a invariante é do
   Agregado.
2. **O Agregado não conhece o mundo de fora.** Quem fala com fora são Observadores e
   Publicadores.

Essas duas regras são o que impede, respectivamente, a **lógica difusa** (regra
espalhada pelos casos de uso) e o **domínio contaminado** (agregado sabendo de coisas
que não lhe dizem respeito).

---

## 6. Colaboração Externa

Módulos colaboram **exclusivamente por fatos publicados e referências por identidade**.

- Um módulo depende **do que outro publica**, **nunca do que ele é** por dentro.
- Quando um módulo precisa que outro faça algo, ele **expressa uma solicitação como
  fato**; o módulo dono a acolhe e a cumpre **dentro da sua própria fronteira**, sob
  suas próprias regras.
- Nenhum módulo alcança o interior de outro; nenhum guarda a verdade alheia — apenas a
  **referencia**.
- Nenhum módulo depende da **reação** de outro para estar correto.

O efeito é que a colaboração nunca transfere responsabilidade: **atravessa
conhecimento, não autoridade**.

---

## 7. Módulos de Domínio × Capacidades Transversais

A distinção é de **posse**.

Um **módulo de domínio** **possui uma verdade**. Por isso tem agregados que a guardam,
invariantes que a protegem, repositórios que a mantêm e publicadores que comunicam seus
fatos. Ele é **dono**.

Uma **capacidade transversal** **não possui verdade alguma**. Por isso **não tem
agregados**, não tem invariantes de negócio próprias, não guarda estado autoritativo e
não publica fatos de domínio. Ela é **usada**.

**Por que a IA não segue exatamente o mesmo padrão.** A IA não tem uma verdade para
proteger — não existe "a verdade da IA". Ela **lê fatos** e oferece **interpretação,
recomendação e explicação**. Não tendo verdade, não faz sentido dotá-la de agregados,
invariantes ou repositórios de domínio: seria dar-lhe a forma de um dono sem a
substância de um. Sua arquitetura é moldada pela **capacidade** que oferece, não pela
propriedade que exerce — e ela participa dos outros módulos **pelas bordas**, entrando
**pelo mesmo portão que um humano**: um caso de uso.

O mesmo raciocínio vale para auditoria, observabilidade e configuração. **Autorização
merece uma nota:** a *verdade* sobre quem pode agir pertence a um **módulo de domínio**
(Identity & Access); o *ato de aferir* essa verdade nas bordas dos demais módulos é uma
**capacidade transversal**. Verdade e verificação não são a mesma coisa.

---

## 8. Critérios para criar um novo módulo

**Um novo módulo é justificável quando:**

- existe uma **verdade de negócio sem dono** — que nenhum módulo atual pode possuir
  legitimamente;
- essa verdade tem **linguagem própria** e **invariantes próprias** (um contexto
  emerge);
- seu **ciclo de vida é independente** dos módulos existentes;
- mantê-la em outro lugar obrigaria um módulo a possuir **duas verdades sem relação** ou
  a **conhecer o que não deveria**.

**A responsabilidade deve permanecer no módulo existente quando:**

- é um **comportamento** sobre uma verdade já possuída — então é caso de uso, serviço ou
  política **ali**;
- é uma **regra mutável** — então é uma **Policy**;
- é apenas uma **visão diferente** da mesma verdade — então é uma questão de leitura,
  não um módulo;
- é uma preocupação **técnica** — então não é módulo algum: é infraestrutura ou
  capacidade transversal.

**Teste decisivo:** *qual verdade este módulo possui?* Se a resposta for "nenhuma", não
é um módulo de domínio. Se a resposta for "a mesma de outro", a arquitetura já foi
violada antes de começar.

---

## 9. Anti-modelos

Erros **estruturais** — os que dizem respeito à anatomia, não a um domínio específico:

- **Módulo sem verdade claramente possuída.**
- **Dois módulos possuindo a mesma verdade.**
- **Módulo anêmico** — sem invariantes, servindo de depósito.
- **Caso de Uso contendo regra de negócio.**
- **Agregado conhecendo o mundo de fora** ou consultando outro módulo.
- **Policy cravada como invariante** — e o inverso: invariante tratada como regra
  ajustável.
- **Repositório contendo lógica** de negócio.
- **Componentes criados por simetria**, sem responsabilidade que os justifique.
- **Tradutores fora de um módulo de fronteira** — um módulo de domínio falando língua
  estrangeira.
- **Capacidade transversal possuindo verdade** ou ganhando agregados.
- **Módulo dependendo do modelo interno de outro** em vez da sua linguagem publicada.
- **Publicar fato sem transição** que o justifique.
- **Módulo dividido por camada técnica** em vez de por verdade.
- **Dependências circulares** entre módulos.
- **Módulo que cresce e passa a possuir verdades sem relação** — coesão perdida.

---

## 10. Questões deferidas

Continuam pertencendo à implementação e a documentos futuros:

- **Persistência** e banco.
- **APIs** e contratos técnicos.
- **Mensageria** e eventos físicos.
- **Frameworks**, linguagem e organização de código.
- **Testes** e estratégia de verificação.
- **Performance** e **escalabilidade**.
- **Fronteira física** dos módulos (monólito modular × distribuído).

---

## Critério de permanência

Esta anatomia é o **padrão arquitetural permanente** do Zion OS. Ela deve continuar
válida por quantos domínios a plataforma venha a ter, e independentemente de linguagem,
banco, framework ou arquitetura física.

Projetar um módulo novo passa a ser um exercício conhecido: **declarar qual verdade ele
possui**, delimitar o que **não** lhe pertence, modelar seus agregados e invariantes,
nomear seus casos de uso, isolar o que é mutável em políticas, e definir suas fronteiras
de entrada e saída. Tudo o mais é consequência.

Se um dia um módulo do Zion não puder ser descrito por esta anatomia, há duas
possibilidades — e apenas duas: ou ele não é um módulo, ou a arquitetura foi rompida.
