# ADR-008 — Institucionalização do Checklist de Elegibilidade de Migração

- **Órgão deliberante:** Conselho de Arquitetura do Zion OS
- **Origem:** demanda de engenharia — consolidação operacional dos critérios de
  elegibilidade já institucionalizados
- **Estado:** **APROVADO**
- **Efeito:** autoriza a institucionalização do
  `engineering/checklist-elegibilidade-migracao.md` e a **obrigatoriedade** de sua
  execução antes da abertura de qualquer Release de migração arquitetural

---

## 1. Objetivo

Este ADR existe por uma razão precisa, e é importante nomeá-la sem eufemismo.

O Checklist de Elegibilidade de Migração **não cria nenhum critério novo**. Cada uma de
suas 17 verificações é reprodução de regra já institucionalizada no Protocolo de Migração
Arquitetural, no Plano Executivo, no Mapeamento Arquitetural, no Padrão de Release
Engineering ou na Governança Arquitetural.

Mas **tornar sua execução obrigatória é, em si, uma alteração normativa do processo de
engenharia** — e a Governança é inequívoca a respeito:

> *"Nenhuma alteração normativa ocorre sem ADR aprovado. Sem exceção, sem urgência que a
> justifique."* — Governança Arquitetural, §5

O documento poderia ter sido integrado ao repositório como material orientativo sem
qualquer deliberação. O que exige este ADR não é o **conteúdo** do Checklist — é o
**verbo "deve"**. É a passagem de *instrumento disponível* para *etapa exigida*.

Este ADR autoriza exatamente essa passagem, e nada além dela.

---

## 2. Contexto

### 2.1 A situação atual

Determinar se uma responsabilidade pode iniciar migração exige, hoje, consultar cinco
artefatos: localizar a responsabilidade no Mapeamento, confrontar a redação literal dos
bloqueios de governança, verificar linha de base no Plano Executivo, ler os critérios de
interrupção do Protocolo e conferir os gates do Padrão de Release Engineering.

O procedimento **funciona** — foi aplicado com sucesso na Release 003, quando se verificou
que o bloqueio de gestão cobria apenas `mercadolivre.ts` e `publicar/route.ts` e que R9
estava fora deles. O Protocolo registra que *"a elegibilidade foi concluída por leitura da
redação, não por interpretação."*

O que o procedimento **não tem** é forma. Ele depende de o engenheiro lembrar de todas as
consultas, na ordem certa, e registrar o resultado de cada uma.

### 2.2 O que está em jogo

O Protocolo estabelece que, sem linha de base mensurável, *"a migração **não começa**, pois
não haveria como comprovar preservação"*. E que um bloqueio de governança que alcance a
responsabilidade a interrompe.

Estes são critérios de **interrupção**, não de correção. Descobri-los tarde não produz um
ajuste — produz uma release abortada, com branch criada, escopo declarado e trabalho
perdido. O custo de esquecer uma consulta é assimétrico.

### 2.3 Por que agora

Oito responsabilidades do Grupo C aguardam uma única condição de desbloqueio. Quando ela
ocorrer, oito verificações de elegibilidade serão executadas em sequência, cada uma
exigindo criação de linha de base própria. É precisamente o cenário em que a repetição
informal falha.

---

## 3. Alternativas avaliadas

### Alternativa A — Institucionalizar o Checklist como artefato obrigatório

A execução do Checklist passa a ser exigida antes da abertura de toda Release de migração.
O documento preenchido integra o registro oficial da release.

*A favor:* torna a Fase 1 do Protocolo — que **já é obrigatória** — verificável e
auditável; produz evidência arquivada; elimina a dependência de memória.
*Contra:* acrescenta uma etapa formal ao processo; exige este ADR.

### Alternativa B — Institucionalizar como material orientativo

O Checklist entra no repositório sem obrigatoriedade. O engenheiro o usa se quiser.

*A favor:* dispensa deliberação; nenhum ADR necessário; nenhuma alteração normativa.
*Contra:* não resolve o problema. Um instrumento facultativo contra esquecimento é
consultado exatamente por quem não iria esquecer. A Fase 1 continuaria sem forma
verificável, e a assimetria de custo da §2.2 permaneceria intacta.

### Alternativa C — Não institucionalizar

Manter a consulta distribuída entre os cinco artefatos.

*A favor:* zero alteração; zero risco de introduzir regra por acidente.
*Contra:* preserva o problema por inteiro. Rejeitada não por ser insegura, mas por ser
inerte.

### Alternativa D — Incorporar as verificações ao próprio Protocolo

Expandir a Fase 1 do Protocolo para conter as 17 verificações.

*A favor:* uma fonte a menos; nenhum artefato novo.
*Contra:* **alteraria o Protocolo** — documento cuja origem declarada é ter sido
*"extraído, não projetado"*, com cada etapa correspondendo a algo efetivamente executado
nas Releases 002 e 003. Acrescentar-lhe verificações não executadas violaria sua natureza
constitutiva. Rejeitada por incompatibilidade com a origem do documento.

---

## 4. Decisão oficial

**Aprovada a Alternativa A.**

O `engineering/checklist-elegibilidade-migracao.md` é institucionalizado como **artefato
obrigatório de pré-abertura** de toda Release de migração arquitetural.

**Fundamento da escolha.** A Alternativa A é a única que resolve o problema sem tocar em
documento normativo existente. Ela não expande a Fase 1 — ela lhe dá forma. A obrigação
que este ADR cria não é a de verificar elegibilidade (o Protocolo já a exige); é a de
**registrar** essa verificação em formato auditável.

**Princípio da menor onda de choque.** A decisão adiciona um artefato e uma obrigação de
registro. Não altera uma linha sequer do Protocolo, do Plano Executivo, do Mapeamento, da
Constituição, do Glossário ou do Padrão de Release Engineering.

---

## 5. Alterações normativas autorizadas

Conforme a Governança — *"somente ADR aprovado altera a arquitetura oficial, e apenas os
documentos e trechos que ele nomeia explicitamente"* —, este ADR nomeia exaustivamente o
que autoriza:

**Autorizado:**

1. A **existência** do `engineering/checklist-elegibilidade-migracao.md` como artefato
   oficial do processo de engenharia.
2. A **obrigatoriedade** de sua execução antes da abertura de Release de migração
   arquitetural, da criação da branch e da definição do escopo.
3. A **inclusão** do documento preenchido no registro oficial da release correspondente,
   como evidência de entrada da Fase 2 do Protocolo.

**Não autorizado — e explicitamente preservado sem alteração:**

| Documento | Situação |
|---|---|
| Protocolo de Migração Arquitetural | **Inalterado.** Nenhuma fase, critério ou princípio modificado |
| Plano Executivo da Refatoração | **Inalterado.** Nenhum estado, grupo, release prevista, risco ou prioridade modificado |
| Mapeamento Arquitetural | **Inalterado** |
| Padrão de Release Engineering | **Inalterado.** Nenhum gate, tipo ou critério modificado |
| Governança Arquitetural | **Inalterada** |
| Constituição · Organização · Módulos · Glossário | **Inalterados** |

---

## 6. Delimitação — o que este ADR **não** decide

Registro explícito, para que a leitura futura não atribua a este ADR alcance que ele não
possui:

- **Não cria critério de elegibilidade.** Os 17 critérios do Checklist preexistem; o
  documento os cita, não os institui.
- **Não hierarquiza critérios.** A distinção entre os dois critérios de aprovação literais
  da Fase 1 (ausência de bloqueio · existência de linha de base) e as demais verificações
  é do **Protocolo**, reproduzida pelo Checklist na sua Nota de Atribuição.
- **Não reatribui fases.** As verificações de teste e build permanecem, normativamente, na
  Fase 2. O Checklist as antecipa por conveniência operacional e **registra** essa
  antecipação — não a converte em critério de elegibilidade.
- **Não altera o roadmap** nem qualquer release prevista.
- **Não autoriza migração alguma.** Em particular, não autoriza a migração da R11.
- **Não dispensa nenhuma fase** do Protocolo nem nenhum gate do Padrão de Release
  Engineering.

---

## 7. Impacto arquitetural

**Nenhum.**

O Checklist reside em `engineering/` — espaço que, pela definição da própria arquitetura,
**produz evidência e orienta o trabalho, mas não rege**. Não descreve fronteira, agregado,
invariante, evento ou responsabilidade de domínio. Não existe caminho pelo qual a
arquitetura do Zion OS pudesse mudar em consequência desta decisão.

O impacto é sobre o **processo de engenharia**, e está integralmente contido na §5.

---

## 8. Impacto sobre o comportamento do sistema

**Nenhum.** Nenhum arquivo em `src/` é criado, alterado ou removido por esta decisão.

---

## 9. Compatibilidade

**Total.** A Release 003 — única migração executada até aqui — satisfez, de fato, os
critérios que o Checklist consolida: localizou R9 no Mapeamento, confrontou a redação do
bloqueio, confirmou linha de base (18 testes próprios) e identificou o consumidor por
busca. A formalização não invalida nenhuma execução anterior; descreve o que já se fez.

---

## 10. Plano de aplicação

1. **Release 013 — Documentação.** Institucionaliza este ADR e o Checklist. Escopo de dois
   arquivos, nenhum funcional.
2. **Primeira aplicação.** A próxima Release de migração — a da R11, prevista no roadmap
   como Release 007 — executará o Checklist antes de sua abertura.

> **Nota de numeração.** Esta release recebe o número **013** deliberadamente. O roadmap
> institucionalizado reserva **007 a 012** para as migrações previstas. Numerá-la como 007
> recriaria o **Achado A1** — duas designações distintas sob o mesmo número — eliminado na
> Release 006. A não-sequencialidade é o custo aceito para preservar a rastreabilidade do
> roadmap sem alterá-lo.

---

## 11. Revalidação obrigatória

Este ADR passa ao estado **Implementado** quando, e somente quando:

- a Release 013 estiver concluída e registrada; **e**
- o Checklist tiver sido executado ao menos uma vez, na íntegra, antes da abertura de uma
  Release de migração real, produzindo parecer `ELEGÍVEL` ou `NÃO ELEGÍVEL` sustentado por
  evidência.

A primeira execução é a revalidação. Até que ocorra, o ADR permanece **Aprovado** — a
decisão é oficial, mas sua eficácia prática não foi demonstrada.

**Critério de falha da revalidação:** se a primeira execução exigir critério não previsto,
ou se algum critério previsto se revelar inverificável na prática, o Checklist será objeto
de RFC — **não de correção silenciosa**.

---

## 12. Consequências

**Aceitas:**

- Toda Release de migração passa a exigir uma etapa formal adicional antes de sua abertura.
- O Checklist torna-se um documento que precisa ser mantido: se o Protocolo, o Plano
  Executivo ou o Mapeamento evoluírem, ele deve acompanhá-los. **Um instrumento
  consolidador desatualizado é pior que a consulta distribuída**, porque a substitui
  aparentando autoridade. Esta é a principal consequência negativa desta decisão, e ela é
  registrada, não minimizada.
- Mitigação prevista pela própria Governança: *"alteração em documento de maior
  precedência obriga a reexaminar os de menor precedência que dela dependem. A cascata é
  parte da alteração, não um trabalho posterior."* O Checklist é, por construção, de menor
  precedência que todas as suas fontes.

**Obtidas:**

- A Fase 1 do Protocolo passa a produzir evidência arquivada, e não apenas uma conclusão.
- A reprovação passa a ser registrada com justificativa, conforme o invariante *"a ausência
  de decisão é registrada como decisão"*.
- Oito verificações do Grupo C, quando desbloqueadas, terão forma única e comparável.

---

## 13. Estado da governança após este ADR

- **ADR-008:** APROVADO. Revalidação pendente.
- **Documentos normativos alterados:** **nenhum.**
- **Artefatos criados:** um — o Checklist de Elegibilidade de Migração.
- **RFC associada:** nenhuma. Este ADR não decorre de contradição comprovada, e sim de uma
  demanda operacional que não colide com regra alguma. Registrado explicitamente para que
  a ausência de RFC não seja lida como omissão do fluxo.
