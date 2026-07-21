# Operation Center — Política de Priorização (v1)

> **Natureza.** Este é um documento de **política de negócio** — a constituição da
> tomada de decisão do Operation Center. Não há IA, algoritmo, machine learning,
> scoring, peso, fórmula, banco, evento, fila, UX ou implementação aqui — de
> propósito. Ele define **o que** deve merecer atenção primeiro e **por quê**, não
> **como** calcular isso.
>
> **Subordinação.** Não altera nem contradiz os documentos aprovados (Arquitetura,
> Modelo de Domínio, Máquina de Estados, Taxonomia de Sinais). Toda priorização
> aqui é justificável pela linguagem ubíqua já fixada.
>
> **Princípio central.** O Operation Center **não prioriza tarefas**. Ele prioriza
> **decisões operacionais que maximizam valor para a operação**. As Missões são
> **consequência** dessas decisões — nunca o ponto de partida.

---

## 1. Objetivo

Existe uma política de priorização porque a **atenção é finita** e os **fatos são
muitos**. A qualquer momento, dezenas de Sinais competem pela atenção de um
operador. Sem uma política, a ordem do trabalho seria acidental — e o acidente é o
inimigo da operação em escala. A política existe para **dirigir a atenção ao que
gera mais valor para a operação**, de forma consistente e explicável.

**Ela pertence ao negócio, não à IA.** Priorizar encarna o que a Zion **valoriza**:
manter operações saudáveis, desbloquear o que está travado, honrar compromissos,
ampliar catálogo publicado, cuidar de clientes estratégicos. Isso é **julgamento de
negócio**, não uma escolha técnica. A IA futura será uma **executora** desta
política — ela **aplica** os critérios daqui; **nunca os inventa**.

**Ela deve sobreviver à tecnologia.** Se a stack, o marketplace ou a IA mudarem por
completo, o que a operação considera "mais importante primeiro" permanece. Esta
política é escrita para durar anos.

---

## 2. Princípios

1. **Prioridade nunca é arbitrária.** Toda ordenação decorre de critérios legítimos
   e nomeáveis.
2. **Prioridade é explicável.** Sempre há um porquê legível por humanos.
3. **Toda prioridade pode ser justificada.** Se não se consegue justificar, não é
   prioridade — é palpite, e palpite não governa a operação.
4. **Prioridade pode mudar ao longo do tempo.** A realidade muda; a prioridade
   acompanha. Uma prioridade correta ontem pode estar errada hoje.
5. **Nenhum operador precisa adivinhar** por que uma Missão apareceu primeiro.
6. **A IA nunca inventa critérios.** Ela aplica esta política; não a redefine, não a
   estende por conta própria.
7. **Prioriza-se valor e decisão, não tarefa.** A pergunta não é "o que é mais fácil
   fazer", e sim "onde a atenção rende mais para a operação".
8. **Não se inventa urgência.** A ausência de trabalho urgente é um estado válido;
   forçar urgência inexistente corrompe a política.
9. **Prioridade é comparativa, não um selo absoluto.** Existe sempre em relação às
   outras Missões daquele momento.
10. **Desbloquear precede otimizar.** Restaurar a capacidade de operar tem
    precedência natural sobre melhorar uma operação que já funciona.
11. **Compromisso assumido pesa.** Um prazo (SLA) que a operação prometeu cumprir
    não pode ser silenciosamente ignorado.

---

## 3. Conceitos fundamentais

**Prioridade.** A **importância relativa** de uma Missão frente às outras, num dado
momento. É uma propriedade da **Missão**, resultado de uma **Decisão**. *NÃO é* a
ordem de chegada, *NÃO é* um número isolado, *NÃO é* permanente.

**Urgência.** A **pressão do tempo** sobre uma Missão — quão cedo ela precisa
acontecer. Deriva de prazos e de janelas que se fecham. *NÃO é* importância: algo
pode ser urgente e pouco importante, ou importante e sem pressa.

**Impacto.** A **abrangência** de um fato ou de uma Missão — o que/quem é afetado
(produto, anúncio, cliente, canal, operação, global). *NÃO é* gravidade nem
importância; é **alcance**.

**Severidade.** A **gravidade do fato em si** (do Signal). *NÃO é* prioridade: um
fato grave pode, após julgamento, não gerar Missão alguma; um fato leve pode gerar
Missão urgente. Severidade **informa**, não **decide**.

**Valor operacional.** O **benefício para a operação** de realizar um trabalho —
quanto ele aproxima a operação de estar saudável, coberta e honrando compromissos. É
o **norte** da política: prioriza-se onde o valor operacional é maior. *NÃO é* valor
financeiro isolado, embora possa incluí-lo.

**Esforço.** O **tamanho/custo** do trabalho. É um fator legítimo (um ganho rápido
pode desempatar), mas *NÃO é* um critério de importância: fazer o fácil primeiro,
por ser fácil, é proibido.

**Risco.** O **que se perde ao não agir** (ou ao agir errado). Um risco alto de dano
eleva a atenção. *NÃO é* severidade: severidade é o que já é verdade; risco é o que
pode vir a ser.

**SLA.** O **compromisso de prazo** associado a uma Missão. Um SLA vencido é um fato
duro que a operação prometeu evitar. *NÃO é* prioridade por si — é um critério forte
dela.

**Dependência.** A relação em que **uma Missão precisa de outra antes** de poder
acontecer. *NÃO é* prioridade; é uma **ordem obrigatória** que a prioridade deve
respeitar.

**Bloqueio.** O estado em que **a operação (ou um conjunto de trabalho) está travado**
até que algo seja resolvido. *NÃO é* apenas "importante": um bloqueio **impede**
valor de fluir, e por isso tem precedência natural.

---

## 4. Critérios de priorização (fatores legítimos)

Todos os fatores abaixo **podem** influenciar a prioridade. Nenhum recebe peso aqui
— a política nomeia os critérios; como ponderá-los num caso concreto é **julgamento**
guiado por esta constituição.

- **SLA vencido (ou prestes a vencer).** A operação prometeu um prazo; descumpri-lo
  gera dano concreto e perda de confiança. Existe porque **compromisso assumido
  pesa**.
- **Canal indisponível.** Sem canal, **nenhum** valor daquele cliente flui. Existe
  porque restaura a capacidade de operar.
- **Operação bloqueada.** Trabalho represado atrás de um travamento destrói valor de
  forma ampla. Existe porque **desbloquear precede otimizar**.
- **Grande volume de produtos.** Um lote grande pronto para publicar carrega muito
  valor operacional agregado. Existe porque concentra benefício.
- **Cliente estratégico.** A operação de certos clientes vale mais para o negócio.
  Existe porque **valor não é uniforme** entre clientes.
- **Dependências.** Uma Missão que **desbloqueia outras** herda a importância do que
  destrava. Existe porque a ordem obrigatória molda o valor.
- **Risco operacional.** Alto risco de dano (perda de anúncio, de reputação, de
  venda) eleva a atenção. Existe porque **prevenir dano é valor**.
- **Oportunidade.** Uma janela de ganho (catálogo a ampliar, desempenho a recuperar)
  que se fecha com o tempo. Existe porque **valor também é o que se deixa de ganhar**.
- **Impacto financeiro.** O peso econômico do que está em jogo. Existe porque a
  operação serve a um resultado comercial.
- **Impacto na operação.** A abrangência do efeito sobre a saúde operacional.
  Existe porque **quanto mais amplo o efeito, mais atenção merece**.

Nenhum destes é soberano sozinho. A política reconhece que o valor operacional
**emerge da combinação** desses fatores, sopesados por julgamento explicável.

---

## 5. Critérios proibidos

O que **nunca** poderá influenciar prioridade:

- **Ordem de chegada.** Ser observado antes não torna um fato mais importante.
- **Humor, cansaço ou conforto do operador.** A operação não se pauta por
  disposição pessoal.
- **Preferência da IA.** A IA não tem gosto próprio; aplica a política.
- **Facilidade pela facilidade.** Baixo esforço não é, sozinho, motivo de
  prioridade (fazer o fácil primeiro é proibido como *critério*; pode desempatar,
  não liderar).
- **Familiaridade** do operador com a tarefa.
- **Marketplace.** Qual canal é irrelevante para a importância do trabalho.
- **Tecnologia** envolvida.
- **Complexidade do código** ou do fluxo técnico.
- **Idade do Sinal por si só.** Um fato antigo não é mais importante por ser antigo.
- **Recência pela recência.** Nem o mais novo vence só por ser novo.
- **Quem reclamou mais alto.** Pressão de voz não é critério de valor.

Qualquer priorização que só se explique por um destes fatores é **inválida** por
construção.

---

## 6. Repriorização

**Quando** uma Missão pode mudar de prioridade: sempre que a **realidade muda** de
modo que o valor relativo daquela Missão mude — um novo Signal surge, um SLA vence,
um bloqueio aparece ou desaparece, um cliente muda de status, uma dependência se
resolve.

**Quem** pode alterar:
- A **própria realidade**, via novos Sinais que reabrem o julgamento.
- Um **operador ou supervisor**, com **justificativa explícita**.
- A **IA**, **apenas** reaplicando esta política a novos fatos — nunca por critério
  próprio.

**Por quê:** para que a prioridade reflita o **valor atual**, não o de quando a
Missão nasceu. Prioridade que não acompanha a realidade envelhece e engana.

**O que nunca pode acontecer:**
- Repriorizar **sem justificativa**.
- **Rebaixar** arbitrariamente um bloqueio crítico ou um SLA vencido.
- A IA **inventar** um novo critério ao repriorizar.
- **Reescrever o passado**: repriorizar é um **novo momento auditável**, não um
  apagar do histórico anterior.

---

## 7. Conflitos

A política não resolve conflitos por cálculo — ela define **como o domínio os
enxerga**:

- **Alta severidade × baixo impacto.** Um fato grave que afeta quase nada **não**
  vence automaticamente. A severidade sozinha não governa; a abrangência e o valor
  entram. Um fato moderado sobre um alvo estratégico pode legitimamente superar um
  fato grave sobre um alvo trivial.
- **Baixa severidade × operação bloqueada.** O **bloqueio vence**. Um fato de pouca
  gravidade que **trava** a operação supera fatos mais graves porém isolados, porque
  travamento impede valor de fluir de forma ampla.
- **Grande cliente × SLA menor.** Ambos são legítimos e **nenhum vence por decreto**.
  Um cliente estratégico pesa; um prazo mais próximo (ou vencido) pesa. O domínio
  mantém a tensão viva e a resolve por **julgamento explicável**, caso a caso — com a
  ressalva de que um **SLA já vencido** é um fato duro, difícil de adiar.
- **Muitas missões equivalentes.** O domínio as trata como um **conjunto/lote**. O
  **volume** vira valor (limpar um grande lote rende muito), e o **esforço** pode
  **desempatar** entre iguais — transparentemente, nunca como critério-líder.
- **Missões dependentes.** Uma Missão **não pode** superar aquela de que **depende**.
  O pré-requisito **herda ao menos a importância** do que destrava; a ordem
  obrigatória prevalece sobre a preferência.

Regra transversal dos conflitos: **desbloquear e honrar compromissos têm precedência
natural**; **valor e abrangência dominam a severidade isolada**; e todo empate se
resolve por um julgamento que se possa **explicar em palavras**.

---

## 8. Transparência

Toda prioridade **deve ser explicável**. Cada Missão carrega uma **justificativa
legível por humanos** — o **Motivo** (conceito já do Modelo de Domínio) — que diz
**por que** ela está onde está.

- O operador **nunca** recebe apenas um número, um selo ou uma ordem sem porquê.
- O sistema deve sempre conseguir responder, em linguagem de negócio: **"Por que
  esta Missão está aqui?"** — nomeando os critérios que a colocaram nessa posição
  (ex.: "SLA vence hoje e o cliente é estratégico").
- Uma prioridade que **não se consegue explicar** é, por definição desta política,
  **inválida** — deve ser tratada como erro, não como resultado.

A explicabilidade não é um recurso de conveniência: é uma **regra constitucional**.
É ela que permite a um operador confiar na fila e a um supervisor auditar a
operação.

---

## 9. Anti-modelos

Erros que nunca devem acontecer:

- **Prioridade calculada sem explicação** — um número que ninguém consegue
  justificar.
- **IA criando critérios próprios** — estendendo ou substituindo esta política.
- **Prioridade fixa/estática** — imune à mudança da realidade.
- **Misturar severidade com prioridade** — tratar o fato grave como
  automaticamente prioritário.
- **Usar impacto sozinho** — abrangência sem gravidade, valor ou compromisso.
- **Ignorar SLA** — descumprir prazos assumidos sem que isso pese.
- **Priorizar por esforço** — fazer o fácil primeiro por ser fácil.
- **Priorizar por idade/recência do Sinal** — antiguidade ou novidade como critério.
- **Deixar a voz mais alta vencer** — pressão social como priorizador.
- **Missão sem Motivo** — prioridade sem justificativa anexa.
- **Repriorizar sem novo fato** — mudar a ordem sem que a realidade tenha mudado.
- **Tratar prioridade como rótulo permanente** — negar que ela evolui.

---

## 10. Questões deferidas

> Pertencem a documentos futuros. Aqui apenas se registram.

- **Arquitetura da IA** — como o Assistente aplica esta política.
- **Método de ordenação (ranking)** — a forma concreta de comparar Missões sob estes
  critérios.
- **Machine learning / scoring** — se e como aprendizado apoia (sempre subordinado a
  esta política, nunca a redefinindo).
- **Eventos** — como mudanças de prioridade se propagam.
- **Persistência** — como prioridade e justificativa são guardadas.
- **UX** — como a fila e o porquê aparecem ao operador.
- **Designação de "cliente estratégico"** — quem e como marca um cliente como
  estratégico (entrada de negócio).
- **Política de SLA** — como prazos são definidos por tipo de Missão.
- **Limiares e janelas** — quando "prestes a vencer" ou "oportunidade se fechando"
  se tornam ativos.

---

## Critério de longevidade

Esta política é a **constituição da tomada de decisão** do Operation Center. Deve
permanecer correta ainda que mudem a IA, o banco, o marketplace, a tecnologia ou o
frontend. A IA futura será **apenas uma executora** dela: aplica seus critérios,
respeita seus proibidos, honra sua exigência de explicabilidade — e **jamais** cria
critério próprio. Se um dia uma priorização não puder ser justificada pela linguagem
e pelos critérios deste documento, não é a operação que está errada: é a priorização.
