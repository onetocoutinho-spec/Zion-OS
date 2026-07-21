# ADR-009 — Estratégia Arquitetural para Ports e Escopo da Responsabilidade R2

- **Órgão deliberante:** Conselho de Arquitetura do Zion OS
- **Origem:** Pré-Abertura da Release 012 — parecer **NÃO ELEGÍVEL**, bloqueadores
  arquitetural e de governança
- **Estado:** **APROVADO**
- **Efeito:** fixa o significado normativo da estratégia *"Mover atrás de porta"*, define o
  status arquitetural de **Ports** no Zion OS e autoriza o escopo da migração de **R2**

---

## 1. Contexto

### 1.1 Origem da R2

O Mapeamento Arquitetural registra **R2 — Persistência do vínculo do canal**:

- *"Finalidade: ler e atualizar o registro do canal do cliente."*
- *"Arquivo: `canalServidor.ts` (81 linhas)"*
- *"Dependências utilizadas: cliente de persistência (tipo externo)"*
- *"Módulo destino: **Integration — Connection (infraestrutura)**"*
- *"Acoplamento: **alto** (6 consumidores; **é a única porta de leitura do canal**)"*
- *"Prioridade de extração: **baixa** — coeso e estável; mover cedo traria risco sem ganho
  proporcional"*

### 1.2 Origem da estratégia

A expressão aparece **uma única vez** como estratégia, na Matriz de Migração, l. 324:

> `R2 Vínculo do canal | canalServidor.ts | Integration / Connection (infra) | **Mover atrás de porta** | Médio | 6 consumidores`

### 1.3 Onde a expressão aparece — e em que sentido

O termo *porta* ocorre **três vezes** no Mapeamento, sempre em torno de R2:

| Local | Texto | Sentido |
|---|---|---|
| l. 56 — entrada de R2, campo *Acoplamento* | *"é a única **porta** de leitura do canal"* | **coloquial** — ponto único de acesso |
| l. 276 — Achado **A2** | *"**`canalServidor.ts` como porta única de leitura do canal.** Seis consumidores."* | **coloquial** — ponto único de acesso |
| l. 324 — Matriz, *Estratégia* | *"Mover **atrás de porta**"* | **em disputa** |

**O Mapeamento nunca grafa *Porta* com inicial maiúscula, nunca a define, e nunca a
emprega como construto.** Nos dois usos inequívocos, *porta* designa a **propriedade** de
`canalServidor.ts` ser o **acesso único** ao canal.

### 1.4 Onde a expressão **não** aparece

| Documento | Ocorrências de *Porta* / *Ports* |
|---|---|
| Constituição — 10 documentos | **ZERO** |
| Organização — 3 documentos | **ZERO** |
| Módulos — 3 documentos | **ZERO** |
| ADR-007 · ADR-008 · RFC-001 | **ZERO** |
| Plano Executivo — campo *Estratégia* de R2 | **campo ausente** |

### 1.5 Objetivo arquitetural declarado

A arquitetura **possui** uma abstração para a necessidade que uma Port atenderia, e ela tem
outro nome:

> **Repositórios.** *"A **necessidade declarada pelo domínio** de obter e guardar seus
> agregados."* — Arquitetura dos Módulos, l. 65; repetido nas arquiteturas de Publication
> e Operation Center; definido no Glossário Arquitetural, §Repositório.

**Repositório** é o vocabulário adotado. **Porta** e **Adaptador** não são — *Adaptador*
também tem **zero ocorrências** em toda a arquitetura, assim como *inversão*.

### 1.6 A origem dos diretórios `ports/` e `adapters/`

O registro da Release 002 declara a criação de *"cinco camadas (`domain`, `application`,
`ports`, `adapters`, `infrastructure`)"* por módulo.

**Duas dessas cinco camadas — `ports/` e `adapters/` — não possuem contraparte conceitual
em nenhum documento arquitetural.** Foram criadas como estrutura física, com vocabulário
importado de estilos arquiteturais externos, sem que a arquitetura do Zion OS os tivesse
adotado.

Desde então: **zero arquivos** em `ports/` e `adapters/` nos **quatro** módulos — apenas
`.gitkeep`.

---

## 2. Problema

### 2.1 A decisão que impede a Release 012

A Pré-Abertura da Release 012 apurou que a estratégia registrada admite **dois escopos
arquiteturalmente distintos e incompatíveis**:

| Escopo | Significado |
|---|---|
| **Mover preservando o acesso único** | `git mv` para `integration/infrastructure/`; os 5 consumidores passam a importar do módulo. Nenhum artefato novo |
| **Mover introduzindo uma Port** | O acima **mais** criar a primeira Port do Zion OS: definir o conceito, sua interface, e repontar os consumidores para a abstração |

**A ambiguidade não é de redação — é de consequência.** O segundo escopo adotaria
oficialmente um construto que a arquitetura nunca definiu, estabelecendo precedente para os
**quatro** módulos e para todas as migrações futuras.

### 2.2 Por que isso não pode ser resolvido durante uma migração

**Três razões, cada uma suficiente.**

**Primeira — o Protocolo veda.** Uma Release de Refatoração não altera contratos.
Introduzir uma Port e repontar 5 consumidores para ela **altera a forma do contrato** entre
o módulo e seus consumidores. O Padrão de Release Engineering é explícito: *"se for
necessário alterar comportamento para concluir, deixa de ser refatoração — a entrega é
interrompida e reclassificada."*

**Segunda — a Governança veda.** Adotar Ports é **alteração normativa**: cria vocabulário
arquitetural, define uma camada até hoje vazia e vincula os quatro módulos. A Governança
determina: *"Nenhuma alteração normativa ocorre sem ADR aprovado. Sem exceção, sem urgência
que a justifique."*

**Terceira — a Fase 1 do Protocolo exige leitura, não interpretação.** *"A elegibilidade
foi concluída por leitura da redação, não por interpretação."* Uma expressão que admite
dois escopos não pode ser resolvida por quem executa a migração — resolvê-la **é** decidir
arquitetura.

---

## 3. Evidências

Todas produzidas sobre o commit `2e84bcb` e verificáveis a partir do repositório.

| # | Evidência | Resultado |
|---|---|---|
| **E1** | *Porta* / *Ports* em `constitution/`, `organization/`, `modules/` | **ZERO** |
| **E2** | *Adaptador* / *Adaptadores* nos mesmos documentos | **ZERO** |
| **E3** | *inversão* nos mesmos documentos | **ZERO** |
| **E4** | *Repositório* nos mesmos documentos | **presente em 4** — conceito adotado e definido |
| **E5** | ADRs e RFC definindo Port | **NENHUM** |
| **E6** | Arquivos em `src/modules/*/ports/` | **ZERO** nos 4 módulos — apenas `.gitkeep` |
| **E7** | Arquivos em `src/modules/*/adapters/` | **ZERO** nos 4 módulos |
| **E8** | Usos de *porta* no Mapeamento | **3**, todos em torno de R2; **2 inequivocamente coloquiais** (l. 56, l. 276) |
| **E9** | Campo *Estratégia* de R2 no Plano Executivo | **ausente** — presente em R10, R13 e R12 |
| **E10** | Origem das camadas `ports/` e `adapters/` | Release 002, sem contraparte conceitual em documento arquitetural |
| **E11** | `Connection` como implementação | **não existe** — `src/modules/integration/` contém apenas `domain/` |
| **E12** | Linha de base de R2 | **12 testes**, institucionalizados na Release 016, verdes |
| **E13** | Imports de `canalServidor.ts` | **um único**, de **pacote** (`@supabase/supabase-js`) — nenhum caminho relativo |

---

## 4. Alternativas

### Alternativa A — Movimento simples para `infrastructure/`

`git mv` dos dois arquivos para `src/modules/integration/infrastructure/`; os 5 consumidores
atualizam apenas o caminho de import. Nenhum artefato novo; `ports/` permanece vazio.

*Vantagens:* executável de imediato; **E13** garante que nenhum caminho relativo muda dentro
dos arquivos movidos, produzindo **R100 em ambos** — a migração mais limpa do backlog;
preserva a propriedade que o Mapeamento nomeia em **E8** (acesso único), pois os consumidores
continuam importando de um ponto só; não introduz vocabulário que a arquitetura não adotou.

*Riscos:* deixa `ports/` e `adapters/` vazios, perpetuando a divergência entre estrutura
física e arquitetura conceitual — **risco de documentação, não de comportamento**.

*Aderência arquitetural:* **alta.** O destino registrado é a camada `infrastructure` do
módulo Integration, que **existe**. A abstração que a arquitetura adota — Repositório
(**E4**) — não é exigida aqui: R2 não guarda agregado; guarda um registro de vínculo.

*Impacto na governança:* mínimo. Requer este ADR e a atualização de dois documentos de
engenharia.

*Impacto em Releases futuras:* nenhum vínculo criado. As migrações do Grupo C permanecem
livres para definir seus próprios destinos.

*Compatibilidade com ADRs existentes:* **total.** ADR-007 trata do ciclo de vida da
Publication; ADR-008, do Checklist. Nenhum menciona camadas físicas.

### Alternativa B — Criar a primeira Port do Zion OS

Definir o conceito de Port, sua interface para o vínculo do canal, e fazer os 5 consumidores
dependerem da abstração.

*Vantagens:* preencheria a camada `ports/`, alinhando estrutura física e uso; introduziria
inversão de dependência onde hoje há import direto.

*Riscos:* **altos e duradouros.** Exige inventar vocabulário arquitetural durante uma
release de engenharia; estabelece precedente para **quatro** módulos; altera a forma do
contrato de R2 com 5 consumidores — o que **descaracteriza a refatoração**; e a arquitetura
já possui abstração equivalente com outro nome (**E4**), criando **dois vocabulários
concorrentes** para a mesma ideia.

*Aderência arquitetural:* **baixa.** Adotaria um construto com **zero** presença em toda a
arquitetura oficial (**E1**), enquanto o construto adotado (**E4**) ficaria sem uso.

*Impacto na governança:* **máximo.** Exigiria ADR próprio definindo Port, revisão das
arquiteturas dos quatro módulos e provável atualização do Glossário — *"um significado novo
exige um termo novo"*.

*Impacto em Releases futuras:* vincularia todas as migrações restantes ao novo padrão.

*Compatibilidade com ADRs existentes:* compatível, mas exigiria cascata sobre a Organização
e os Módulos — *"alteração em documento de maior precedência obriga a reexaminar os de menor
precedência"*.

**Rejeitada.** Não por ser inviável, mas por ser **desproporcional ao problema** e por
introduzir vocabulário concorrente ao que a arquitetura já adotou. R2 é infraestrutura de
81 linhas com um único ponto de acesso; não é o caso que justifica fundar um padrão para
quatro módulos.

### Alternativa C — Aguardar a implementação do agregado Connection

Manter R2 em `lib/` até que Connection exista como código.

*Vantagens:* alinharia R2 ao tratamento de **R14** (*"exige que o Operation Center exista
como implementação"*) e **R16** (*"o módulo `identity-access` não existe"*).

*Riscos:* Connection **não está previsto em nenhum roadmap**; a espera seria indefinida.
E a analogia é **falsa** — ver §5.2.

*Aderência arquitetural:* média. Conservadora, mas apoiada em analogia incorreta.

*Impacto na governança:* exigiria reclassificar R2 para o Grupo D.

*Impacto em Releases futuras:* zeraria o backlog executável por tempo indeterminado.

*Compatibilidade com ADRs existentes:* total.

**Rejeitada.** A analogia com R14 e R16 não se sustenta: R14 exige um **colaborador** que
não existe; R16 exige um **módulo** que não existe; R2 exige uma **camada** que **existe**.

### Alternativa D — Alterar o Plano Executivo removendo a estratégia

Suprimir a expressão *"Mover atrás de porta"*.

*Vantagens:* eliminaria a ambiguidade por remoção.

*Riscos:* a expressão está no **Mapeamento**, não no Plano — o Plano **não a contém**
(**E9**). Removê-la exigiria **reescrever o Mapeamento**, cuja natureza é **registro
factual** derivado de leitura do código. Apagar um registro para eliminar uma dúvida
**destrói evidência**.

*Aderência arquitetural:* baixa.

*Impacto na governança:* violaria o princípio de que nenhum artefato é apagado e de que o
conflito é **registrado**, não suprimido.

*Impacto em Releases futuras:* criaria precedente de resolver ambiguidade por deleção.

*Compatibilidade com ADRs existentes:* incompatível com a Governança, §13.

**Rejeitada.** A ambiguidade deve ser **decidida**, não apagada.

---

## 5. Decisão

**Aprovada a Alternativa A.**

Esta decisão é **normativa** e produz **três determinações**.

### 5.1 Significado de *"Mover atrás de porta"*

> **A expressão significa: mover a responsabilidade preservando sua propriedade de ser o
> ponto único de acesso ao vínculo do canal. Não significa construir um artefato.**

*Fundamento:* o Mapeamento emprega *porta* três vezes, todas em torno de R2, e **duas delas
inequivocamente no sentido de acesso único** — *"é a única porta de leitura do canal"*
(l. 56) e o Achado **A2** (l. 276). O documento nunca a grafa como construto, nunca a
define, e nunca a emprega fora deste contexto. **A leitura coerente do documento consigo
mesmo é a coloquial.**

**Consequência prática:** a estratégia está **cumprida** quando os cinco consumidores
continuarem obtendo o vínculo do canal por **um único ponto** — o módulo de destino.

### 5.2 Status arquitetural de Ports no Zion OS

> **Ports NÃO passam a fazer parte da arquitetura do Zion OS.**
> **Os diretórios `ports/` e `adapters/` permanecem reservados e vazios.**

*Fundamento:* *Porta* e *Adaptador* têm **zero ocorrências** em toda a arquitetura oficial
(**E1**, **E2**). A abstração que a arquitetura **adota e define** para a necessidade
declarada pelo domínio é o **Repositório** (**E4**). Adotar Ports agora criaria vocabulário
concorrente — vedado pelo invariante *"um significado novo exige um termo novo"*, cujo
corolário é que **um significado já nomeado não recebe um segundo nome**.

**Registrado, sem ação nesta decisão:** as camadas `ports/` e `adapters/`, criadas na
Release 002 (**E10**), carecem de contraparte conceitual. Esta decisão **não as remove** —
remover diretórios versionados é ato de engenharia, fora do escopo de um ADR. Declara
apenas que **permanecem sem status arquitetural** até que um ADR futuro as adote
explicitamente.

### 5.3 Escopo autorizado da migração de R2

> **R2 migra para `src/modules/integration/infrastructure/` por movimento integral, com
> `git mv`, sem introduzir Port, sem criar abstração e sem alterar contrato.**

**Sobre o destino e o agregado Connection.** O destino registrado —
*"Integration — Connection (infraestrutura)"* — designa **a camada** (`infrastructure/`) e
**a verdade servida** (Connection). A ausência de Connection como implementação **não
impede** a migração, por distinção material:

| Responsabilidade | O que falta | Natureza |
|---|---|---|
| **R14** | Operation Center como implementação — **colaborador** que precisa existir para orquestrar | bloqueante |
| **R16** | O **módulo** `identity-access` | bloqueante |
| **R2** | Connection como agregado — mas a **camada** `infrastructure/` **existe**, e o módulo também | **não bloqueante** |

Infraestrutura pode preceder o agregado que servirá. O inverso — orquestrar através de um
módulo inexistente, ou residir em módulo inexistente — não pode.

---

## 6. Consequências

### 6.1 O que muda imediatamente

- A estratégia de R2 passa a ter **uma única interpretação oficial**.
- **Ports adquirem status normativo: não fazem parte da arquitetura.**
- Os bloqueadores **arquitetural** e **de governança** da Pré-Abertura da Release 012 são
  **eliminados**.

### 6.2 O que permanece igual

- **Nenhuma linha de código.** Este ADR não move, cria nem altera arquivo algum.
- A Constituição, a Organização, as arquiteturas dos Módulos e o Glossário — **intocados**.
- O Protocolo de Migração e o Checklist de Elegibilidade — **intocados**.
- O bloqueio de governança sobre `mercadolivre.ts` e `publicar/route.ts` — **vigente**.
- O status de **R15** — **bloqueada**, conforme a Avaliação Arquitetural que confirmou sua
  premissa.
- A linha de base de R2 — **válida**, 12 testes institucionalizados.

### 6.3 Documentos que deverão ser atualizados

Por **release própria**, não por este ADR:

| Documento | Atualização autorizada |
|---|---|
| **Mapeamento Arquitetural** | Anotar, junto à estratégia de R2, que **ADR-009** fixou seu significado. **A expressão original não é removida** — o registro é preservado |
| **Plano Executivo** | Preencher o campo *Estratégia* de R2, hoje ausente (**E9**), com o escopo autorizado em §5.3 |

### 6.4 Releases destravadas

**Uma: a Release 012 (R2).** Após a reexecução da Pré-Abertura, cujos critérios **C9** e
**C16** passam a encontrar fundamento.

### 6.5 Responsabilidades que permanecem bloqueadas

| Responsabilidade | Condição |
|---|---|
| **R15** | Decisão arquitetural sobre a camada cliente→servidor — **não tratada por este ADR** |
| **Grupo C** — 8 responsabilidades | Validação operacional da reutilização de guias em produção |
| **R5** | Especificação do domínio de Vendas/Pedidos |
| **R16** | Especificação e criação do módulo Identity & Access |

---

## 7. Impacto na arquitetura — resposta normativa

**Pergunta:** o Zion OS passa oficialmente a possuir Ports? Ports permanecem apenas
diretórios reservados? Ou a estratégia *"Mover atrás de porta"* deixa de existir?

> **Resposta normativa: Ports permanecem apenas como diretórios reservados.**
>
> **O Zion OS NÃO adota Ports como construto arquitetural.** A abstração oficial para a
> necessidade declarada pelo domínio é o **Repositório**.
>
> **A estratégia *"Mover atrás de porta"* NÃO deixa de existir** — permanece registrada no
> Mapeamento, agora com significado fixado: **preservar o ponto único de acesso**.

---

## 8. Governança

| Pergunta | Resposta | Fundamento |
|---|---|---|
| Quais documentos deverão ser revisados? | **Dois**, ambos em `engineering/`: Mapeamento e Plano Executivo — §6.3 | Alteração de menor precedência decorrente de decisão normativa |
| O Plano Executivo precisa ser atualizado? | **SIM** — preencher o campo *Estratégia* de R2, ausente | **E9** |
| O Mapeamento precisa ser atualizado? | **SIM**, por anotação — **sem remover a redação original** | *"Nenhum artefato de governança é apagado"* |
| A Constituição permanece válida? | **SIM, integralmente** | Nenhuma determinação deste ADR toca documento constitucional |
| O Protocolo permanece válido? | **SIM, integralmente** | O escopo autorizado é movimento integral, plenamente coberto pela Fase 3 |
| Este ADR substitui algum anterior? | **NÃO** | ADR-007 e ADR-008 tratam de matérias distintas |
| Exige revalidação? | **SIM** — §8.1 |

### 8.1 Revalidação obrigatória

Este ADR passa ao estado **Implementado** quando:

1. a Pré-Abertura da Release 012 for **reexecutada** e produzir parecer com **C9** e **C16**
   fundamentados neste ADR; **e**
2. a Release 012 for concluída, com o Mapeamento e o Plano Executivo atualizados conforme
   §6.3.

**Critério de falha:** se a reexecução da Pré-Abertura revelar que o escopo autorizado em
§5.3 é inexequível — por exemplo, se o movimento exigir alterar contrato — este ADR será
objeto de **RFC**, não de correção silenciosa.

---

## 9. Próximos passos

**Missão imediatamente autorizada após a aprovação deste ADR:**

> **Reexecução da Pré-Abertura da Release 012 (R2)**, aplicando integralmente os 17
> critérios do Checklist sobre o `HEAD` vigente, com **C9** e **C16** fundamentados nas
> §5.1 e §5.3 deste ADR.

**Não autorizado por este ADR:** abrir a Release 012 diretamente. O ADR-008 mantém o
Checklist como artefato obrigatório de pré-abertura, e sua reexecução é condição — não
formalidade.

**Sequência prevista, condicionada a cada resultado:**

1. **Institucionalização deste ADR** — release de documentação.
2. **Reexecução da Pré-Abertura da Release 012.**
3. **Release 012 — migração de R2**, se o parecer for `ELEGÍVEL`.
4. Atualização do Mapeamento e do Plano Executivo, conforme §6.3, dentro da Release 012.

**Após a conclusão da Release 012, o backlog dependente apenas de engenharia estará
zerado.** Restarão exclusivamente responsabilidades condicionadas a decisão de arquitetura
(**R15**, **R5**, **R16**) ou a validação operacional em produção (**Grupo C**).

---

## 10. Estado da governança após este ADR

- **ADR-009:** APROVADO. Revalidação pendente.
- **Documentos normativos alterados:** **nenhum.**
- **Artefatos criados:** um — esta decisão.
- **Vocabulário arquitetural criado:** **nenhum.** A decisão **recusa** deliberadamente
  criar o termo *Port*, preservando o invariante de que *"um significado novo exige um termo
  novo"* — e seu corolário: um significado já nomeado não recebe um segundo nome.
- **RFC associada:** nenhuma. Este ADR não decorre de contradição entre regras aprovadas,
  e sim de uma **expressão ambígua em documento de engenharia**. Registrado explicitamente
  para que a ausência de RFC não seja lida como omissão do fluxo.
