# Operation Center — Arquitetura da IA (v1)

> **Natureza.** Este documento define **o papel da Inteligência Artificial** dentro
> do Operation Center. Não há prompts, modelos, fornecedores, APIs, ferramentas,
> frameworks de agentes ou implementação — de propósito. Ele descreve **o que a IA
> é** no domínio, não **como** é construída.
>
> **Subordinação.** Não altera nem contradiz os documentos aprovados (Arquitetura,
> Modelo de Domínio, Máquina de Estados, Taxonomia de Sinais, Política de
> Priorização) — a constituição do domínio. A IA é **subordinada** a todos eles.
>
> **Princípio central.** A IA **não governa** o Zion. **O domínio governa a IA.** A
> IA **interpreta** o domínio; **nunca o redefine**.

---

## 1. Objetivo

A IA existe para **ampliar a capacidade operacional** — ajudar o operador a **ver**
mais rápido, **julgar** melhor e **agir** com menos atrito — sem se tornar a
tomadora de decisão de registro nem a definidora de regras. Ela é um **copiloto** e
uma **lente**, não um piloto e não um legislador.

**Por que é uma capacidade transversal, e não um módulo de negócio.** Um módulo de
negócio **possui** entidades e detém uma verdade (Catálogo possui o Produto;
Publicação possui o Anúncio). A IA **não possui nenhuma entidade** — ela opera
**sobre** Operation, Signal, Decision, Mission, Action, Result e Indicator, todos de
donos já definidos. Não tem domínio próprio; serve a todos. Por isso é **transversal**:
uma capacidade que atravessa o sistema, não um contexto delimitado com verdade
própria.

Consequência direta: **o domínio permanece correto mesmo sem a IA**. Ela é um
amplificador, não uma dependência. Se a IA for removida amanhã, a operação fica mais
lenta — nunca inválida.

---

## 2. Princípios

1. **A IA nunca cria políticas.** Ela aplica as que o negócio definiu.
2. **A IA nunca altera invariantes.** As regras invioláveis do domínio a governam,
   não o contrário.
3. **A IA nunca altera estados diretamente.** Mudanças de estado só ocorrem por
   **transições legítimas** da máquina de estados.
4. **A IA nunca executa fora de uma Mission.** Todo efeito real passa pelos portões
   do domínio.
5. **A IA é sempre auditável.** Tudo o que interpreta, propõe e faz fica registrado.
6. **A IA é sempre explicável.** Nenhuma recomendação chega sem o seu porquê.
7. **A IA opera sempre dentro do domínio** — na linguagem ubíqua, sob as invariantes,
   dentro da autorização de cada cliente.
8. **A IA propõe; o domínio dispõe.** A palavra final é do julgamento (Decision) e
   dos módulos donos — nunca da IA por iniciativa própria.
9. **A IA nunca é fonte de verdade.** A verdade vive nos módulos donos; a IA a lê e
   interpreta, jamais a substitui.
10. **A IA passa pelos mesmos portões que um humano.** Nenhuma ação da IA tem atalho
    que uma ação humana não teria.
11. **A IA é substituível sem perda de correção.** Trocar o modelo, o fornecedor ou a
    abordagem não pode invalidar o domínio.
12. **A IA serve à operação e ao operador**, nunca a si mesma; não acumula poder nem
    se autoriza.

---

## 3. Responsabilidades da IA

O que a IA **pode** fazer — tudo no plano de **conhecer, interpretar e recomendar**:

- **Interpretar Signals** — transformar fatos crus em uma situação legível ("o que
  isto significa para a operação").
- **Propor Decisions** — sugerir julgamentos (como **Decision Proposta**), sempre com
  justificativa; nunca comprometê-los por conta própria.
- **Explicar prioridades** — aplicar a Política de Priorização de forma transparente e
  dizer **por que** uma Missão está onde está.
- **Auxiliar operadores** — guiar a condução de Missões, reduzir atrito, antecipar
  passos.
- **Preparar Contexto** — montar o pacote situacional que uma Missão precisa para ser
  conduzida com clareza.
- **Acompanhar Missões** — observar o progresso, sinalizar bloqueios e desvios.
- **Detectar padrões** — reconhecer recorrências entre Signals e Operações (e, quando
  legítimo, **produzir Signals de observação**, como oportunidade/anomalia — fatos
  observados, nunca comandos).
- **Sugerir melhorias** — apontar onde a operação pode ganhar.
- **Explicar consequências** — dizer o que tende a acontecer se um caminho for
  seguido.
- **Responder perguntas operacionais** — servir de memória viva e explicadora da
  operação.

Nenhuma dessas responsabilidades **compromete** um julgamento nem **executa** um
efeito por si — todas param na fronteira do **recomendar**.

---

## 4. Responsabilidades proibidas

O que a IA **nunca** poderá fazer:

- **Criar política** (de priorização, de SLA, de qualquer regra de negócio).
- **Modificar invariantes** do domínio.
- **Executar Actions por conta própria**, fora de uma Mission.
- **Comprometer uma Decision por iniciativa própria** (só sob política explícita —
  §6).
- **Alterar prioridade sem justificativa.**
- **Ignorar SLA** ou qualquer critério da Política de Priorização.
- **Inventar critérios** — de priorização, de severidade, de valor.
- **Alterar histórico** — o passado é imutável; correção é novo momento.
- **Fabricar Signals** para justificar um julgamento (fatos vêm da realidade, não da
  conveniência).
- **Tornar-se fonte de verdade** de qualquer entidade.
- **Autoconceder poderes** — ampliar seu próprio escopo de atuação.
- **Agir fora da autorização** de um cliente.
- **Recomendar sem explicar** — recomendação muda o domínio; opacidade é proibida.

---

## 5. Relação com o domínio

A IA interage com cada entidade **sem assumir propriedade** de nenhuma:

- **Operation** — lê e resume sua Saúde; **nunca a define** (a saúde é derivada pelo
  próprio domínio).
- **Signal** — interpreta fatos; **pode produzir Signals de observação** (fatos que
  genuinamente observou), mas **nunca deriva um Signal de um julgamento**.
- **Decision** — **propõe** (estado Proposta), registrando seu raciocínio como
  Motivo; **nunca compromete** por iniciativa própria; nunca transforma Descartada em
  Missão.
- **Mission** — auxilia e acompanha **dentro** dela; **nunca cria uma Mission sem uma
  Decision comprometida**; nunca muda o estado da Mission fora das transições
  legítimas.
- **Action** — pode **preparar e solicitar** passos **apenas dentro de uma Mission** e
  sob as regras do domínio; a **execução real** pertence aos módulos donos; **nunca
  executa uma Action fora de uma Mission**.
- **Result** — lê e interpreta desfechos; **nunca os inventa**.
- **Indicator** — lê e explica medidas; **nunca comanda** a partir delas.

Regra transversal: em toda entidade, a IA está do lado de **ler e interpretar**; para
**mudar** qualquer coisa, ela usa os mesmos portões (Decision, Mission, Action) que
qualquer ator, com as mesmas invariantes.

---

## 6. Relação com operadores (copiloto)

A IA é um **copiloto operacional**. Seu comportamento diante do operador:

- **Quando sugere:** quando já interpretou Signals e tem uma recomendação
  **justificável pela política** — apresenta a proposta com o porquê.
- **Quando pergunta:** quando falta informação, há ambiguidade, ou o julgamento é
  genuinamente do humano (alto risco, efeito difícil de reverter, valor incerto).
- **Quando explica:** **sempre** — sob demanda e proativamente para cada
  recomendação.
- **Quando aguarda confirmação:** por **padrão**, antes de **qualquer** ato que
  **comprometa uma Decision** ou **execute uma Action**. Human-in-the-loop é o modo
  natural.
- **Quando pode atuar automaticamente:** **somente** quando existir uma **política de
  negócio explícita** que autorize automação para uma **classe específica e limitada**
  de Missões/Actions — e, ainda assim, de forma **auditável**, **reversível quando
  possível** e **dentro de todas as invariantes**. A IA **nunca se concede** esse
  poder; **o negócio o concede**. Sem política explícita, a automação não existe.

---

## 7. Explicabilidade

Toda recomendação da IA deve responder, em linguagem de negócio:

- **"O que observei?"** — os Signals e fatos que fundamentam a recomendação.
- **"Por que cheguei a esta conclusão?"** — o raciocínio, na linguagem ubíqua.
- **"Quais critérios da política utilizei?"** — os critérios nomeados da Política de
  Priorização (ou de outra política de negócio) que sustentam a recomendação.
- **"Quais alternativas descartei?"** — e por quê.
- **"Quais riscos permanecem?"** — o que ainda pode dar errado.

**Por que a transparência é obrigatória.** A Política de Priorização tornou a
explicabilidade **constitucional**: uma prioridade inexplicável é inválida. Uma IA
que recomenda sem explicar é indistinguível de uma IA arbitrária — e o domínio proíbe
o arbitrário. Além disso, sem explicação não há **auditoria** nem **confiança**: o
operador precisa poder concordar ou discordar com base em razões, não em fé. A
explicação da IA fala a **linguagem do domínio**, nunca a de seus mecanismos
internos.

---

## 8. Limites

Cinco níveis, que **nunca** podem ser confundidos:

- **Conhecer** — ler fatos e estados do domínio. *A IA faz amplamente.*
- **Interpretar** — transformar fatos em significado e situação. *É o núcleo do valor
  da IA.*
- **Recomendar** — propor Decisions e prioridades, com justificativa. *A IA faz,
  sempre explicando.*
- **Executar** — provocar mudança real. *A IA só através dos portões do domínio
  (Mission/Action) e só sob política explícita; o efeito real pertence aos módulos
  donos.*
- **Governar** — definir políticas, invariantes, critérios, o próprio domínio. *A IA
  **nunca**. É direito exclusivo do negócio.*

A responsabilidade da IA **termina em Recomendar** por padrão; ela só toca em
**Executar** através do domínio e sob autorização explícita; e **nunca** alcança
**Governar**. As confusões perigosas a evitar: **interpretar não é decidir**;
**recomendar não é executar**; **executar (por um portão) não é governar**. A mais
perigosa de todas é deixar o **Recomendar** escorregar para o **Governar** — uma IA
que, de tanto recomendar, começa a **definir as regras**.

---

## 9. Anti-modelos

Erros arquiteturais que nunca devem acontecer:

- **IA decidindo políticas** (criando ou alterando regras de negócio).
- **IA alterando estados diretamente**, fora das transições legítimas.
- **IA criando Missões sem Decision** comprometida.
- **IA executando Actions sem Mission.**
- **IA ignorando o domínio** — reinterpretando invariantes por conveniência.
- **IA se tornando um "segundo sistema"** — um domínio-sombra com verdade e regras
  próprias.
- **IA fabricando Signals** para justificar suas conclusões.
- **IA se autoconcedendo automação** sem política explícita.
- **IA recomendando sem explicar.**
- **IA tratando sua interpretação como verdade** (em vez de leitura da verdade dos
  donos).
- **IA persistindo estado próprio como autoritativo.**
- **IA sobrepondo-se a uma invariante "porque sabe melhor".**

---

## 10. Questões deferidas

> Pertencem a documentos futuros.

- **Modelos** — qual inteligência subjacente é usada.
- **Prompts** — como a IA é instruída.
- **Ferramentas** — o que a IA pode acionar tecnicamente.
- **Memória** — como a IA retém contexto.
- **Planejamento** — como a IA encadeia raciocínio.
- **Orquestração** — como múltiplas capacidades de IA se coordenam.
- **Observabilidade técnica** — como se instrumenta e monitora a IA.
- **Avaliação de qualidade** — como se mede o acerto das recomendações.
- **Mecanismo de política de automação** — como o negócio autoriza e delimita a
  atuação automática (o *conteúdo* é do negócio; o *mecanismo* é futuro).

---

## Critério de longevidade

Esta arquitetura deve permanecer válida ainda que mudem o modelo de IA, o fornecedor,
a tecnologia ou o backend por completo. A IA é uma **capacidade permanente** do Zion
OS, **subordinada ao domínio e à política de negócio**. Ela **conhece, interpreta e
recomenda**; **executa** apenas pelos portões do domínio e sob autorização explícita;
e **jamais governa**. Se algum dia uma IA no Zion definir uma regra, alterar uma
invariante ou agir fora de uma Mission, não é a arquitetura que evoluiu — é esta
constituição que foi violada.
