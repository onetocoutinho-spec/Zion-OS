# Relatório de Revalidação Arquitetural — ADR-007

- **Órgão executor:** Conselho de Validação Arquitetural do Zion OS, atuando como
  **auditor independente**
- **Objeto:** incorporação do **ADR-007 — Deliberação da RFC-001**
- **Natureza:** teste arquitetural de regressão, obrigatório pela Governança
  Arquitetural após alteração normativa
- **Resultado:** **nenhuma regressão identificada**; duas observações registradas, sem
  efeito normativo

---

## 1. Objetivo

A Governança Arquitetural determina que **toda alteração normativa seja seguida de
revalidação por Blueprint**. Este relatório executa essa obrigação para o ADR-007.

**Qual decisão está sendo validada.** O ADR-007 alterou uma única regra e acrescentou
uma única invariante: a identidade da Publication passou a ser **própria**; produto e
canal passaram a ser o **sujeito** da intenção; e existe **no máximo uma Publication
não-terminal (vigente)** por par produto+canal.

**Por que Blueprints funcionam como testes de regressão arquitetural.** Um Blueprint
fixa o comportamento esperado da arquitetura diante de um caso real. Um Blueprint
validado sob regras antigas **não vale** sob regras novas: reexecutá-lo é a única forma
de saber se a alteração resolveu o que devia **sem quebrar o que já funcionava**. Estão,
para a arquitetura, como testes estão para o código — e, como testes, só têm valor se
forem executados **com a intenção de falhar**.

Este Conselho executou a revalidação com essa intenção.

---

## 2. Escopo

Serão reexecutados **exatamente dois** cenários:

- **Blueprint 002 — Estoque Indisponível e Anúncio Ativo**, que originou a RFC-001 e
  deve deixar de travar;
- **Blueprint 001 — Publicação Idempotente**, que depende do documento alterado e deve
  permanecer íntegro.

**Nenhum outro cenário é considerado.** Casos não cobertos por Blueprints existentes
estão fora do escopo desta revalidação e não sustentam conclusão alguma aqui.

---

## 3. Reexecução do Blueprint 002

### Etapas 1 a 4 — do fato externo ao julgamento

**Etapa 1 (a verdade externa muda).** Continua válida; não sofreu alteração; **não
depende da identidade**; coerente; ownership do ERP intacto; contextos intactos;
Constituição respeitada.

**Etapa 2 (a fronteira observa e traduz).** Continua válida; sem alteração; não depende
da identidade da Publication — a Integration jamais a conheceu; ownership e fronteiras
intactos.

**Etapa 3 (o fato entra no domínio da operação).** Continua válida; sem alteração; o
Signal não referencia a intenção; coerente e constitucional.

**Etapa 4 (a operação julga, inclusive julga não agir).** Continua válida; sem
alteração; a Decision não depende da composição da identidade; a tolerância à não-ação
permanece.

### Etapa 5 — o trabalho é comprometido *(ponto sondado)*

Continua válida e **não sofreu alteração**, mas foi objeto de sondagem específica, por
ser o único ponto do Blueprint em que outro módulo aponta para a intenção.

O Operation Center referencia a intenção **por identidade**, sem jamais conhecer sua
composição — conforme a Arquitetura do Módulo Publication ("é referenciada de fora
apenas por identidade — jamais aberta") e conforme o ADR-007 §9. Antes da alteração,
apontar para o par produto+canal era apontar para a identidade; depois, o par identifica
o **sujeito**, e a intenção **vigente** sobre ele é determinada **sem ambiguidade** —
precisamente porque a nova invariante garante que existe **no máximo uma**.

**Conclusão da sondagem:** não há regressão. Mais do que isso, verifica-se que a
invariante acrescentada **é o que preserva a determinação** que a regra anterior
oferecia — ela não é acessória à decisão, é o que a torna suficiente. Ownership,
contextos e Constituição intactos.

### Etapas 6 a 10 — interrupção, conversa, reconciliação e encerramento

**Etapa 6 (a intenção é interrompida).** Continua válida; sem alteração; não depende da
identidade. A tensão registrada originalmente (o negócio querer suspender, não encerrar)
**permanece exatamente como estava** — o ADR-007 não a tratou, e não deveria.

**Etapa 7 (a fronteira conversa com o canal).** Continua válida; sem alteração.

**Etapa 8 (a intenção reconcilia).** Continua válida; sem alteração. A Publication
alcança **Encerrada**, e **Encerrada permanece terminal**.

**Etapa 9 (a operação fecha o laço).** Continua válida; sem alteração.

**Etapa 10 (o canal pausa sozinho → divergência).** Continua válida; sem alteração;
segue encaixando-se perfeitamente no conceito de divergência.

### Etapa 11 — o estoque é reposto *(a etapa que travava)*

**Existe agora uma transição válida?** A pergunta correta, sob a arquitetura vigente, é
outra — e é aí que o impasse se dissolve: **nenhuma transição é necessária**. A
Publication anterior **não é reaberta**; permanece encerrada e intocada. O retorno do
produto ao mesmo canal se dá pelo nascimento de uma **nova intenção** sobre o **mesmo
sujeito**, por meio do caso de uso **Criar Publication**, que já existia no módulo e não
foi alterado. O caminho é válido porque **não parte de um estado terminal** — parte do
nada, como todo nascimento.

**A nova Publication nasce corretamente?** Sim. Nasce por **Criar Publication**, sob a
guarda da **Factory**, que garante nascimento válido; nasce no estado **Pretendida**; e
referencia produto e canal por identidade, como sujeito.

**A Publication anterior permanece terminal?** Sim, integralmente. Nada a toca. A
terminalidade constitucional é preservada, e o princípio de que **o tempo só anda para
frente** é honrado: nada do passado é reescrito; o que há é um novo objeto avançando.

**A nova invariante de vigência única é preservada?** Sim. No instante da criação, a
Publication anterior encontra-se em **Encerrada** — estado terminal e, portanto,
**não vigente**. A nova é a única vigente sobre aquele sujeito. A invariante é satisfeita
e verificável.

**Existe qualquer ambiguidade restante?** **Não.** Este Conselho sondou explicitamente
três hipóteses de ambiguidade residual:

- *Se a intenção anterior estivesse em **Falha*** (não-terminal) e se tentasse criar
  outra: a invariante **bloqueia** — corretamente. O módulo já oferece **Reprogramar
  Publicação** e **Cancelar Publicação** para resolver a existente antes. Sem
  ambiguidade.
- *Se estivesse em **Divergente*** (não-terminal): idem — a invariante obriga a
  reconciliar antes. Sem ambiguidade.
- *Sobre a rastreabilidade da sucessão*: todas as intenções sobre um mesmo sujeito são
  localizáveis pelo sujeito que referenciam, permitindo reconstituir a sucessão. O
  ADR-007 §12 já registrou a proliferação histórica como **risco assumido e
  monitorado** — não é ambiguidade nem achado novo.

---

## 4. Resultado do Blueprint 002

**A contradição desapareceu?** **Sim.** Os dois caminhos que antes eram obrigatórios e
impossíveis — reaproveitar um estado terminal ou colidir identidades — deixaram de ser
necessários. O caso resolve-se por um caminho que **já existia** no módulo.

**O cenário tornou-se completamente executável?** **Sim.** As onze etapas percorrem do
início ao fim, incluindo a Etapa 11, que anteriormente travava.

**Restou alguma inconsistência?** **Não.**

**Alguma nova ambiguidade apareceu?** **Não** — as três hipóteses sondadas foram
resolvidas pelas regras vigentes.

**Existe algum novo conflito arquitetural?** **Não.**

> **Declaração formal.** *A arquitetura suporta integralmente o cenário que anteriormente
> originou a RFC-001.*

**Registro de escopo.** As duas outras evidências do Blueprint 002 — a ausência de
observador designado para a percepção de disponibilidade (Achado 1) e a cardinalidade
Decision→Mission (Achado 3) — **permanecem abertas**, exatamente como estavam. O ADR-007
não as tratou e esta revalidação não as altera.

---

## 5. Reexecução do Blueprint 001

**Verificação preliminar de dependência.** Antes de reexecutar, este Conselho verificou
se alguma etapa do Blueprint 001 dependia da regra alterada. **Nenhuma depende.** A
Etapa 1 invoca a invariante "uma intenção refere-se a exatamente um produto e um canal
pretendido" — que é a invariante **de sujeito**, preservada literalmente pelo ADR-007 —
e em nenhum ponto o Blueprint afirmou que essa referência constituía a **identidade** do
agregado. O documento foi originalmente escrito sem depender da composição da
identidade.

**Etapas 1 a 12.** Reexecutadas integralmente. Para todas, o resultado é o mesmo:

- **Permanece válida?** Sim, em todas as doze.
- **Mudou comportamento?** Não.
- **Mudou responsabilidade?** Não.
- **Mudou ownership?** Não.
- **Mudou identidade?** Apenas a da Publication, e **sem efeito sobre o fluxo**: nenhuma
  etapa referencia a intenção pela sua composição.
- **Mudou algum evento?** Não — os fatos publicados são os mesmos.
- **Mudou alguma Policy?** Não.
- **Mudou alguma fronteira?** Não.
- **Mudou algum agregado?** Não, quanto à sua estrutura, entidades e estados.

**Verificação específica da Etapa 1.** Sob a nova invariante, a criação da intenção
exige que não haja outra vigente sobre o mesmo sujeito. No cenário do Blueprint 001 —
um produto sendo publicado pela primeira vez — **não existe intenção anterior**, e a
invariante é satisfeita trivialmente. Nenhum comportamento muda.

**Verificação específica da Etapa 11 (a segunda publicação do mesmo produto).** Este é o
ponto mais sensível do Blueprint 001, pois é onde a idempotência atua. A verificação
confirma que **nada mudou**: a intenção **não foi encerrada**, permanece **vigente**, e a
idempotência opera **dentro do mesmo agregado**, reconhecendo que aquela versão já foi
realizada. A proteção em dois níveis — intenção na Publication, comunicação na
Integration — permanece exatamente como validada originalmente.

---

## 6. Resultado do Blueprint 001

**O Blueprint continua válido?** **Sim**, integralmente, nas doze etapas.

**A decisão do ADR provocou regressão?** **Não.**

**Alguma etapa precisou ser reinterpretada?** **Não.** Nenhuma etapa exigiu leitura nova
para continuar válida — o que constitui, por si, evidência do raio mínimo da alteração.

**Existe qualquer incompatibilidade com a Sprint 0?** **Não.** A idempotência conquistada
na Sprint 0 e seu lugar conceitual — invariante na Publication, critério de equivalência
como policy, mecânica de canal na Integration — permanecem inalterados.

> **Declaração formal.** *O ADR-007 preservou integralmente o comportamento anteriormente
> validado.*

---

## 7. Matriz de Impacto

| Item | Antes do ADR | Depois do ADR | Veredito | Justificativa |
|---|---|---|---|---|
| **Identidade da Publication** | Produto + Canal | Própria; par = sujeito | **Mudou** | Única regra alterada; autorizada pelo ADR-007 §6 |
| **Invariantes** | 7 invariantes | 8 invariantes | **Mudou** (acréscimo) | Exatamente uma acrescentada; as 7 anteriores preservadas literalmente |
| **Estados** | 8 estados; 2 terminais | 8 estados; 2 terminais | Permaneceu igual | Nenhum estado criado, removido ou reclassificado |
| **Versionamento** | Evolução de conteúdo | Evolução de conteúdo | Permaneceu igual | Versão nunca representou identidade |
| **Policies** | 7 policies | 7 policies | Permaneceu igual | Nenhuma criada, alterada ou removida |
| **Eventos** | Fatos do módulo | Os mesmos fatos | Permaneceu igual | Nenhum fato criado, alterado ou removido |
| **Operation Center** | Referencia por identidade | Referencia por identidade | Permaneceu igual | Nunca conheceu a composição da identidade |
| **Integration** | Nunca conheceu a intenção | Idem | Permaneceu igual | Jamais teve acesso à identidade da intenção |
| **Glossário** | 53 termos | 53 termos | Permaneceu igual | Nenhuma definição alterada, criada ou aposentada |
| **Máquina de Estados** | Terminalidade inviolada | Terminalidade inviolada | Permaneceu igual | Documento constitucional não tocado |
| **Contrato de Eventos** | Vigente | Vigente | Permaneceu igual | Não tocado |
| **Modelo de Consistência** | Vigente | Vigente | Permaneceu igual | Nenhum ownership movido |
| **Blueprint 001** | Válido (12 etapas) | Válido (12 etapas) | Permaneceu igual | Nenhuma etapa dependia da regra alterada |
| **Blueprint 002** | **Travado na Etapa 11** | **Executável até o fim** | **Mudou** (destravado) | Efeito pretendido da decisão |

---

## 8. Verificação da Governança — Princípio da Menor Onda de Choque

| Pergunta | Resposta |
|---|---|
| Quantos documentos normativos mudaram? | **1** (Publication — Arquitetura do Módulo) |
| Quantos conceitos foram criados ou removidos? | **0** |
| Quantas definições do Glossário mudaram? | **0** |
| Quantas Policies mudaram? | **0** |
| Quantos módulos mudaram? | **1** |
| Quantos estados mudaram? | **0** |
| Quantos eventos mudaram? | **0** |
| Quantos bounded contexts mudaram? | **0** |
| Quantos ownerships mudaram? | **0** |
| Quantas regras foram alteradas? | **1** |
| Quantas invariantes foram acrescentadas? | **1** |
| **A alteração permaneceu dentro do limite aprovado?** | **Sim** |

O ADR-007 autorizou exatamente uma alteração de regra e uma invariante. A auditoria do
documento revisado confirma que **nada além disso foi alterado**, e que o texto registra
explicitamente as verificações do que **não** mudou. O Princípio da Menor Onda de Choque
foi **integralmente respeitado**.

---

## 9. Verificação Constitucional

| Documento | Preservado? | Verificação |
|---|---|---|
| Manifesto Arquitetural | **Sim** | Nenhuma lei tocada; "a tecnologia serve ao domínio" reforçada |
| Modelo de Domínio | **Sim** | Exige identidade a agregados; não determina sua composição |
| Máquina de Estados | **Sim** | Terminalidade e sentido do tempo intactos |
| Modelo de Consistência e Fronteiras | **Sim** | Nenhuma verdade mudou de dono |
| Glossário Arquitetural | **Sim** | Nenhuma definição alterada; *Identidade* aplicada com mais fidelidade |
| Arquitetura do Sistema | **Sim** | Dependências e colaborações inalteradas |
| Arquitetura dos Módulos | **Sim** | Anatomia preservada |
| Operation Center | **Sim** | Não tocado; comportamento idêntico |
| Integration | **Sim** | Não tocada; jamais conheceu a identidade da intenção |
| Governança Arquitetural | **Sim** | Fluxo completo observado: Blueprint → RFC → Deliberação → ADR → Atualização → Revalidação |

**Nenhuma resposta negativa foi registrada.**

---

## 10. Observações registradas (sem efeito normativo)

Em cumprimento ao dever de auditoria, este Conselho registra duas observações
encontradas durante a sondagem. **Nenhuma constitui regressão, inconsistência ou
evidência para nova RFC.** São registradas para o benefício de leitores futuros.

**Observação 1 — A invariante acrescentada é transversal a instâncias.** "No máximo uma
Publication vigente por sujeito" é a primeira invariante do módulo que não se resolve
dentro de uma única instância do agregado. Este Conselho verificou onde ela é guardada e
concluiu que **o módulo já possui o guardião adequado**: a **Factory**, cuja
responsabilidade documentada é "garantir que uma intenção nasça válida". Como estados
terminais não emitem transição, o **único** modo de violar a invariante seria fazer
nascer uma intenção enquanto outra está vigente — exatamente o que a Factory previne.
**Nenhuma lacuna.**

**Observação 2 — A expressão "duas intenções" na policy de equivalência admite segunda
leitura.** Com a possibilidade de intenções sucessivas sobre o mesmo sujeito, a formulação
da policy de idempotência ("como se determina que duas intenções são a mesma") passou a
comportar, em tese, uma leitura entre agregados distintos. Este Conselho verificou que
**não há ambiguidade real**: a invariante correspondente é enunciada sobre "a mesma
**versão** de intenção", e Versão é entidade **interna** ao agregado; além disso, uma
Policy jamais pode contradizer uma invariante. O escopo da policy é, portanto,
necessariamente interno à intenção vigente. **Nenhuma inconsistência; nenhuma RFC
necessária.**

---

## 11. Parecer Final

**O ADR-007 resolveu completamente a RFC-001?** **Sim.** A contradição foi eliminada na
raiz, e não compensada.

**O Blueprint 002 foi destravado?** **Sim.** Executa integralmente, incluindo a Etapa 11.

**O Blueprint 001 permaneceu íntegro?** **Sim.** Doze etapas, sem uma única
reinterpretação.

**A arquitetura continua consistente?** **Sim.**

**Há regressões?** **Não.**

**Há novos riscos?** Nenhum além do já registrado e aceito pelo ADR-007 §12 (proliferação
de intenções históricas sobre um mesmo sujeito), que permanece monitorado.

**Há novas RFCs necessárias?** **Não.** As duas observações da §10 não constituem
inconsistência. Os achados 1 e 3 do Blueprint 002 permanecem abertos, **inalterados** e
fora do escopo desta revalidação.

### Declaração oficial do Conselho

- **ADR-007 — validado.**
- **RFC-001 — encerrada definitivamente.**
- **Publication — revalidada.**
- **Blueprint 001 — aprovado.**
- **Blueprint 002 — aprovado.**
- **Arquitetura — consistente.**
- **Nenhuma regressão identificada.**

---

**Registro de encerramento.** O ciclo completo de governança foi percorrido e verificado
de forma independente: um teste encontrou uma contradição, uma RFC a provou, um Conselho
deliberou, um Editor aplicou o mínimo autorizado, e esta revalidação confirmou — com
intenção de falhar — que a plataforma voltou a possuir uma fundação consistente. A
arquitetura do Zion OS evoluiu **sem derivar**.
