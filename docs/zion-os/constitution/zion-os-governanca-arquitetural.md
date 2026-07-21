# Governança Arquitetural do Zion OS

> **Natureza.** Este é um documento **constitucional**. Ele **não define arquitetura** —
> define **como a arquitetura evolui**. Passa a integrar permanentemente a Constituição
> Arquitetural do Zion OS e governa toda evolução futura.
>
> **Autoaplicação.** Este documento está sujeito ao processo que institui: ele próprio
> só pode ser alterado pelas regras que estabelece.
>
> **Alcance.** Não trata de tecnologia, de pessoas nem de processos organizacionais.
> Trata exclusivamente das **regras permanentes de evolução da arquitetura**.

---

## 1. Objetivo

Uma arquitetura é um **ativo vivo**. Ela nasce para durar mais que qualquer decisão
técnica, mas não sobrevive imóvel: o domínio muda, o mundo externo muda, e uma
arquitetura que não pode acompanhar essas mudanças é abandonada na prática, ainda que
permaneça escrita.

**Estabilidade não é imobilidade.** Uma arquitetura estável é aquela que muda **de forma
previsível**, preservando o que a torna coerente. O inimigo nunca foi a mudança — é a
**mudança não registrada**. Uma alteração feita em silêncio parece barata no momento em
que é feita e cobra seu preço anos depois, quando ninguém consegue mais explicar por que
o sistema é como é.

**Toda evolução deve preservar a coerência global.** Uma mudança localmente correta pode
ser globalmente destrutiva: o Blueprint 002 demonstrou que duas regras impecáveis, em
documentos diferentes, podem colidir. Governança existe para que a coerência do todo
seja verificada sempre que uma parte se move.

Esta governança existe para impedir, especificamente: **deriva arquitetural** (o sistema
afastando-se do que está documentado), **deriva semântica** (as mesmas palavras
significando coisas diferentes), **decisões silenciosas** (mudanças sem rastro),
**mudanças locais sem avaliação global**, e **interpretações divergentes** entre quem
constrói.

---

## 2. Princípios

1. **Nenhuma mudança silenciosa.** Toda alteração normativa é registrada, justificada e
   rastreável até sua origem.
2. **Decisões são rastreáveis.** É sempre possível responder *por que* algo é como é, e
   *quando* passou a ser.
3. **Toda alteração nasce de evidências.** Opinião não move a arquitetura; evidência
   move.
4. **Evidência precede solução.** Primeiro se prova que o problema existe; só depois se
   discute o que fazer.
5. **Documentos normativos têm precedência.** Onde houver conflito, prevalece o de
   maior precedência — e o conflito é registrado, não contornado.
6. **A arquitetura evolui deliberadamente.** Nunca por acidente, conveniência ou
   urgência.
7. **A linguagem evolui sem redefinições silenciosas.** Significado novo exige termo
   novo.
8. **Ownership nunca é alterado informalmente.** Mudar quem é dono de uma verdade é
   sempre uma decisão registrada.
9. **A ausência de decisão é uma decisão.** Deixar um problema em aberto é legítimo —
   desde que registrado como tal.
10. **Coerência global precede conveniência local.**
11. **Nenhuma mudança é pequena demais para o processo.** A exceção é a porta pela qual
    a deriva entra.
12. **A arquitetura tem uma única versão oficial.** Não há variantes, ramificações
    paralelas nem interpretações locais.
13. **A governança governa a si mesma.**

---

## 3. Artefatos de Governança

### Constituição

**O que é.** O conjunto normativo de **mais alta precedência**: filosofia, domínio,
comportamento, linguagem, fronteiras e as leis que valem para toda a plataforma. Tudo o
mais deriva dela e nada pode contradizê-la.

**Quando muda.** Apenas por **ADR aprovado**, e sob o maior grau de escrutínio — uma
mudança constitucional atinge, por definição, todos os módulos e todos os Blueprints.

**Quem referencia.** Todos os demais artefatos. Organização, Módulos, Blueprints, RFCs e
ADRs existem **dentro** dela.

### Blueprint

**Objetivo.** **Testar a arquitetura** contra um caso real do domínio, sob pressão.

**Quando deve existir.** Antes de implementar uma fatia significativa; **sempre após uma
mudança arquitetural** (revalidação); quando houver dúvida sobre a suficiência da
arquitetura; e quando um caso novo exercitar fronteiras ainda não testadas.

**O que valida.** Se as responsabilidades estão nos lugares certos, se as fronteiras
resistem, se o ownership é respeitado, se os módulos colaboram apenas por fatos, se
nenhum conceito ficou sem dono e se nenhuma regra precisou ser violada.

**O que nunca faz.** Não altera documento algum. Não propõe solução. Não descreve
implementação. Não escolhe tecnologia. **Não conserta o que encontra** — apenas registra.

### RFC

**Objetivo.** **Registrar formalmente um problema arquitetural**, com evidências
suficientes para uma decisão futura.

**Quando deve ser aberta.** Quando um Blueprint — ou o uso real da plataforma — revela
contradição entre documentos, responsabilidade ambígua, verdade sem dono, fronteira
frágil, acoplamento oculto ou conceito ainda não modelado.

**O que documenta.** O problema com rigor; os documentos que participam dele e por que
cada um permanece correto isoladamente; as evidências que provam que o problema é real
e que nenhuma interpretação alternativa o dissolve; o impacto; as **famílias** de
solução concebíveis; e os critérios que deverão orientar a decisão.

**O que nunca decide.** Não escolhe solução. Não expressa preferência. Não altera
documento algum. **Uma RFC que resolve deixa de ser uma RFC.**

### ADR

**Objetivo.** **Registrar uma decisão arquitetural tomada** — e autorizar a mudança que
dela decorre.

**Quando deve existir.** **Sempre** que a arquitetura oficial mudar — e **apenas** então.

**O que registra.** A decisão; seu contexto e sua origem; as alternativas consideradas e
por que foram preteridas; as consequências; **o que muda e, com igual importância, o que
permanece inalterado**.

**O que altera.** É o **único artefato que autoriza alteração de documento normativo** —
e altera **apenas o que nomeia explicitamente**.

### Glossário

**Papel.** É a **única fonte oficial da linguagem** do Zion OS. Onde houver dúvida sobre
o significado de um termo arquitetural, ele decide.

**Estabilidade.** É o artefato **mais estável de todos**. A linguagem é o que permite
que documentos escritos em épocas diferentes continuem se entendendo.

**Como novos termos surgem.** Por **ADR** que os oficialize, com definição completa.

**Como termos existentes evoluem.** **Não evoluem em significado.** Um significado novo
exige um **termo novo**. Termos que deixam de ser usados **permanecem registrados**,
para que documentos antigos continuem legíveis.

---

## 4. Fluxo Oficial de Evolução

**Problema → Blueprint → RFC → Deliberação → ADR → Atualização dos documentos →
Revalidação por Blueprint.**

**Problema.** Uma suspeita, uma dificuldade, uma pergunta legítima. Sozinho, **não move
nada** — problemas não alteram arquitetura; evidências alteram.

**Blueprint.** Converte a suspeita em **evidência**, submetendo a arquitetura a um caso
real. *Por que não pode ser ignorado:* sem ele, delibera-se sobre hipótese, e a
arquitetura passa a mudar por impressão.

**RFC.** Isola e **prova** o problema, mapeia quem participa dele, demonstra que não há
interpretação alternativa e enumera as famílias de solução. *Por que não pode ser
ignorado:* sem ela, a solução chega antes do entendimento — e o registro de **por que**
a mudança foi necessária se perde para sempre.

**Deliberação.** Confronta as alternativas com os **critérios** (§7) e produz uma
escolha fundamentada. *Por que não pode ser ignorada:* sem ela, escolhe-se por
preferência, e preferências não são auditáveis.

**ADR.** Registra a decisão e **autoriza** a mudança. *Por que não pode ser ignorado:*
sem ele, a mudança é silenciosa — a falha-mãe que toda esta governança existe para
impedir.

**Atualização dos documentos.** Aplica **exatamente** o que o ADR autorizou, e nada
além. *Por que não pode ser ignorada:* sem ela, a decisão fica órfã e a arquitetura
oficial passa a divergir do que foi decidido.

**Revalidação por Blueprint.** Prova que a mudança **resolveu o problema sem quebrar o
que funcionava**. *Por que não pode ser ignorada:* sem ela, conserta-se um caso e
quebra-se outro em silêncio — e a próxima descoberta virá tarde demais.

**Sobre o encerramento antecipado.** O fluxo pode terminar cedo, e isso é legítimo: um
Blueprint pode nada encontrar (e nenhuma RFC nascer); uma RFC pode ser rejeitada (com o
ADR registrando a rejeição e seu motivo). **Encerrar é legítimo; pular não é.**

---

## 5. Regras de Alteração

- **Nenhuma alteração normativa ocorre sem ADR aprovado.** Sem exceção, sem urgência que
  a justifique.
- **RFC nunca altera documentos.** Ela prova e enumera; não decide.
- **Blueprint nunca altera documentos.** Ele testa e registra; não conserta.
- **Discussões nunca alteram documentos.** Consenso não é decisão registrada.
- **Somente ADR aprovado altera a arquitetura oficial** — e apenas os documentos e
  trechos que ele nomeia explicitamente.
- **Todo documento normativo alterado registra o ADR que o autorizou**, para que a
  cadeia decisão → alteração permaneça reconstituível.
- **Alteração em documento de maior precedência obriga a reexaminar os de menor
  precedência** que dela dependem. A cascata é parte da alteração, não um trabalho
  posterior.
- **Nenhum artefato de governança é apagado.** RFCs rejeitadas e ADRs substituídos
  permanecem: são o registro de por que a plataforma **não** seguiu outros caminhos.

---

## 6. Regras para Linguagem

- **Termos nunca mudam de significado silenciosamente.** Alterar uma definição é uma
  mudança normativa e exige ADR.
- **Novo significado exige novo termo.** Se um conceito precisa ser dito de outro modo,
  cria-se um termo — não se redefine o existente.
- **Termos obsoletos permanecem registrados**, marcados como tais. Documentos antigos
  continuam legíveis; a história da linguagem não se apaga.
- **Documentos futuros reutilizam definições existentes.** Criar sinônimos para
  conceitos já nomeados é deriva semântica, ainda que involuntária.
- **Um termo só se torna oficial pelo Glossário.** Se um documento precisa de um termo
  que ainda não existe, ou usa um existente, ou abre o processo para oficializar o novo.

---

## 7. Critérios para Deliberação

Toda decisão arquitetural é avaliada contra os critérios abaixo. **Nenhum peso ou ordem
de precedência é estabelecido aqui** — deliberar é ponderá-los no contexto concreto e
**registrar o raciocínio** que levou à escolha.

- **Coerência arquitetural** — a solução se sustenta dentro da Constituição?
- **Ownership** — nenhuma verdade ganha dois donos, nenhuma fica sem dono?
- **Consistência** — a solução preserva as invariantes existentes?
- **Simplicidade** — quantos conceitos novos são realmente necessários?
- **Explicabilidade** — a mudança pode ser explicada a quem opera o sistema?
- **Compatibilidade retroativa** — o que já foi decidido continua válido?
- **Impacto sobre Blueprints** — quais precisam ser reexecutados?
- **Impacto sobre módulos** — quais precisam ser revisados?
- **Impacto sobre a linguagem** — exige termo novo? redefine algum?
- **Custo de reabertura** — quantos documentos normativos precisam ser revisitados?
- **Aderência ao domínio** — a arquitetura serve ao negócio, e não o contrário?
- **Auditabilidade** — a decisão poderá ser compreendida daqui a muitos anos?

---

## 8. Gestão de Impacto

Toda decisão arquitetural deve responder, explicitamente, cinco perguntas:

1. **Quais documentos são afetados?**
2. **Quais Blueprints precisam ser reexecutados?**
3. **Quais módulos precisam ser revisados?**
4. **Quais conceitos mudam?**
5. **Quais permanecem inalterados?**

A quinta pergunta é tão obrigatória quanto as demais. Declarar o que **não** muda
delimita o alcance da decisão, impede que a mudança se espalhe além do autorizado e
permite que quem não foi afetado siga trabalhando com segurança.

Uma decisão que não consegue responder às cinco perguntas **não está pronta para ser
deliberada**.

---

## 9. Estados de uma RFC

**Aberta → Em análise → Em deliberação → Aceita | Rejeitada → Arquivada.**

- **Aberta.** O problema foi registrado com evidências. Existe e é reconhecido; ainda
  não está sendo trabalhado.
- **Em análise.** As evidências estão sendo aprofundadas, as alternativas mapeadas e o
  impacto avaliado.
- **Em deliberação.** As alternativas estão sendo confrontadas com os critérios. É o
  único estado em que uma escolha está em formação.
- **Aceita.** A deliberação concluiu que uma mudança deve ocorrer. **A RFC não realiza a
  mudança** — ela dá origem a um ADR.
- **Rejeitada.** A deliberação concluiu que nenhuma mudança será feita — por ora ou
  definitivamente. **A rejeição é registrada com sua justificativa**: saber que um
  problema foi considerado e deliberadamente não tratado é tão valioso quanto saber que
  foi resolvido.
- **Arquivada.** Encerrada, preservada e consultável. **Nenhuma RFC desaparece.**

---

## 10. Estados de um ADR

**Proposto → Aprovado → Implementado → Substituído → Histórico.**

- **Proposto.** A decisão está formulada, com contexto, alternativas e consequências —
  mas ainda **não autoriza nada**.
- **Aprovado.** A decisão é oficial. A partir deste momento — e somente a partir dele —
  os documentos que ele nomeia podem ser alterados.
- **Implementado.** As alterações autorizadas foram aplicadas e a revalidação por
  Blueprint foi concluída. O ciclo se fecha aqui.
- **Substituído.** Uma decisão posterior o superou. O ADR **permanece**, apontando para
  aquele que o substituiu.
- **Histórico.** Não rege mais o presente, mas explica o passado. **Nenhum ADR é
  apagado:** eles são a memória de por que a plataforma tomou os caminhos que tomou.

---

## 11. Auditoria Arquitetural

**Blueprints são os testes da arquitetura.** Estão para a arquitetura como os testes
estão para o código: não provam que tudo está certo, mas provam que casos concretos
funcionam — e, quando falham, falham **cedo e explicitamente**.

**Quando novos Blueprints devem ser criados.** Quando um caso relevante do domínio ainda
não foi exercitado; quando um novo módulo, sistema externo ou capacidade entra na
plataforma; quando uma fronteira nunca testada passa a ser usada; e **sempre após uma
mudança arquitetural**.

**Quando Blueprints antigos devem ser reexecutados.** Sempre que um documento do qual
dependem for alterado. Um Blueprint validado sob regras antigas **não vale** sob regras
novas — reexecutá-lo é a única forma de saber se a mudança preservou o que já
funcionava. Isso é regressão arquitetural, e é obrigatória.

**Auditoria periódica.** Mesmo sem mudanças internas, a arquitetura deve ser revalidada
de tempos em tempos: o mundo externo muda, o domínio amadurece, e casos que antes eram
raros tornam-se rotina. Uma arquitetura que nunca é testada de novo não está estável —
está apenas não observada.

---

## 12. Evolução da Plataforma

**Todo crescimento segue este mesmo processo.** Novos módulos, novos marketplaces, novas
integrações, novas capacidades, novos domínios e novas interfaces estão sujeitos às
mesmas regras. Não existe crescimento que dispense governança por ser "apenas mais um
canal" ou "apenas uma integração" — é exatamente nessas adições, presumidas inofensivas,
que a deriva costuma entrar.

**O processo escala com o impacto, mas nunca é dispensado.** Um acréscimo que **não
altera nenhum documento normativo** não precisa de RFC nem de ADR — mas **precisa de um
Blueprint que prove que nada normativo mudou**. A ausência de impacto é uma afirmação
arquitetural e, como toda afirmação, exige evidência.

**Adições que exigem mudança normativa seguem o fluxo completo**, qualquer que seja seu
tamanho aparente.

---

## 13. Invariantes da Governança

- A arquitetura possui **uma única versão oficial**.
- Toda decisão possui **justificativa registrada**.
- **Nenhuma mudança normativa ocorre sem ADR aprovado.**
- **Toda RFC nasce de evidências.**
- **Todo Blueprint valida arquitetura, nunca implementação.**
- **O Glossário é a única fonte oficial da linguagem.**
- **Um significado novo exige um termo novo.**
- **Ownership nunca muda implicitamente.**
- **Nenhum artefato de governança é apagado.**
- **A ausência de decisão é registrada como decisão.**
- **Documento de maior precedência prevalece**, e o conflito é registrado.
- **Nenhuma mudança é pequena demais para o processo.**
- **A IA nunca governa a arquitetura.**
- **A governança governa a si mesma.**
- **A arquitetura evolui continuamente — mas sempre de forma deliberada.**

---

## Encerramento

A partir deste documento, qualquer arquiteto do Zion OS sabe exatamente **como uma ideia
se transforma em mudança arquitetural**: um problema vira evidência num Blueprint, a
evidência vira uma RFC, a RFC vira deliberação, a deliberação vira um ADR, o ADR
autoriza a alteração, e um novo Blueprint prova que a plataforma continua coerente.

Nenhuma etapa é decorativa. Cada uma existe porque a sua ausência produz um dano
específico e conhecido: decidir sem evidência, resolver sem entender, escolher sem
critério, mudar sem registro, decidir sem aplicar, ou consertar sem verificar.

Este processo já provou seu valor antes de ser escrito: foi ele que, percorrido
naturalmente, encontrou uma contradição real na arquitetura **antes** que existisse
código para sofrê-la. Ao torná-lo oficial, o Zion OS deixa de depender de que isso
aconteça por acaso.

**A arquitetura do Zion OS é estável porque pode mudar — e permanece coerente porque
nunca muda em silêncio.**
