# Padrão de Release Engineering — Zion OS

> **Natureza.** Documento **normativo de engenharia de entrega**. Define **como
> qualquer alteração é integrada** ao repositório principal. Não define arquitetura,
> não revisa ADRs ou Blueprints, não altera a Governança Arquitetural e não cria
> conceitos arquiteturais.
>
> **Relação com a Governança Arquitetural.** São complementares e distintos: a
> **Governança** rege *o que a arquitetura pode se tornar*; este padrão rege *como
> qualquer alteração entra no repositório com segurança*. Uma release de arquitetura
> obedece **aos dois**.
>
> **Permanência.** Este processo é independente de qualquer release específica, de
> qualquer sprint e de qualquer pessoa. Vale para toda integração futura.

---

## 1. Objetivo

Este processo existe para que **qualquer integração possa ser reproduzida da mesma
forma, por qualquer pessoa, com o mesmo resultado**.

**Riscos que reduz:**

- **Integrar algo diferente do que se acredita estar integrando** — o risco mais comum e
  o mais silencioso.
- **Alterações irreversíveis** — mudanças que, uma vez integradas, não podem ser
  desfeitas sem dano colateral.
- **Regressões silenciosas** — comportamento que muda sem que ninguém tenha decidido
  mudá-lo.
- **Decisões não registradas** — integrações aprovadas por confiança, cuja justificativa
  se perde.
- **Dependência de pessoas** — processos que só funcionam quando quem os conhece está
  presente.
- **Escopo que cresce durante o caminho** — uma entrega que faz mais do que declarou.

**Por que existe.** Porque a qualidade de uma integração não pode depender de quem a
conduz. Um processo definido transforma julgamento individual em **procedimento
verificável** — e é isso que permite auditar o passado e confiar no futuro.

---

## 2. Princípios

1. **Decisões baseadas em evidências verificadas.**
   *Justificativa:* "deve funcionar" não é evidência. Um fato verificado é reproduzível
   por qualquer pessoa; uma impressão não.

2. **Um commit, uma responsabilidade.**
   *Justificativa:* um commit com duas intenções não pode ser revertido sem dano
   colateral. A granularidade do commit define a granularidade do rollback.

3. **Uma revisão, um objetivo.**
   *Justificativa:* uma revisão que avalia tudo não avalia nada bem. Objetivo definido
   produz veredito defensável.

4. **Nenhuma integração baseada em presunções.**
   *Justificativa:* quem aprova deve poder apontar **onde** está a evidência. Presunção
   não é auditável.

5. **Alterações reversíveis.**
   *Justificativa:* a capacidade de desfazer é o que torna seguro avançar. Uma alteração
   irreversível transfere todo o risco para o futuro.

6. **Rastreabilidade obrigatória.**
   *Justificativa:* daqui a anos, o **porquê** importará mais que o **quê**. Sem registro,
   toda decisão vira folclore.

7. **O escopo declarado é o escopo entregue.**
   *Justificativa:* uma release que faz mais do que declarou é inauditável — ninguém
   revisou o excedente.

8. **A ausência de impacto exige evidência.**
   *Justificativa:* afirmar que "nada mudou" é uma afirmação como qualquer outra, e
   afirmações se comprovam.

9. **Nenhuma exceção silenciosa.**
   *Justificativa:* exceções são legítimas; exceções não registradas são o início da
   erosão do processo.

10. **O processo escala com o risco, mas nunca é dispensado.**
    *Justificativa:* releases pequenas usam gates leves; nenhuma release usa gate
    nenhum. A dispensa é a porta pela qual o descontrole entra.

---

## 3. Tipos de Release

Cada tipo define **o que pode mudar**, **o que não pode** e qual evidência o
caracteriza. O tipo é declarado pelo autor **antes** da revisão.

### Documentação
**Altera:** apenas artefatos textuais.
**Não altera:** comportamento, código, execução.
**Evidência característica:** nenhum arquivo de código no conjunto de alterações.
**Gates aplicáveis:** escopo, rastreabilidade, reversibilidade, conflitos.

### Arquitetura
**Altera:** artefatos normativos da arquitetura.
**Não altera:** comportamento diretamente.
**Exigência adicional:** só ocorre mediante **decisão arquitetural aprovada**, conforme a
Governança Arquitetural — este padrão não a substitui.
**Evidência característica:** referência explícita à decisão que a autorizou e ao que
**não** foi alterado.
**Gates aplicáveis:** todos os de Documentação **+** impacto arquitetural e revalidação.

### Implementação
**Altera:** comportamento do sistema — introduz ou modifica funcionalidade.
**Evidência característica:** demonstração de que o comportamento novo é o pretendido.
**Gates aplicáveis:** **todos**, com o rigor máximo.

### Refatoração
**Altera:** estrutura interna.
**Não altera:** comportamento — em nenhuma hipótese.
**Evidência característica:** **comportamento idêntico comprovado** e forma de alteração
previsível para o tipo de movimento realizado.
**Gates aplicáveis:** todos, com ênfase em impacto funcional e reversibilidade.
**Regra própria:** se for necessário alterar comportamento para concluir, **deixa de ser
refatoração** — a entrega é interrompida e reclassificada.

### Correção
**Altera:** comportamento defeituoso, restaurando o pretendido.
**Evidência característica:** demonstração do defeito **e** da sua eliminação.
**Gates aplicáveis:** todos, com ênfase em impacto funcional e ausência de regressão.

### Infraestrutura
**Altera:** meios de execução, configuração ou operação.
**Não altera:** domínio nem comportamento de negócio.
**Evidência característica:** plano de reversão operacional explícito.
**Gates aplicáveis:** todos, com ênfase em reversibilidade e verificação pós-merge.

---

## 4. Fluxo Oficial

**Implementação → Autoavaliação → Integration Review → Merge → Verificação pós-merge →
Tag (quando aplicável) → Encerramento.**

**Implementação.** O trabalho é realizado em ramo próprio, com commits de
responsabilidade única e escopo declarado.

**Autoavaliação.** O autor verifica a própria entrega **antes** de submetê-la: confirma
o tipo de release, executa os gates aplicáveis e reúne as evidências. *Propósito:* a
revisão não deve descobrir o que o autor já poderia ter descoberto — isso desperdiça o
recurso mais caro do processo, que é a atenção de quem revisa.

**Integration Review.** Revisão formal **independente**, que decide com base nas
evidências e emite parecer. *Propósito:* é o último gate. Sem ela, a integração ocorre
por confiança — e confiança não é auditável.

**Merge.** A integração propriamente dita, preservando o histórico: sem reescrita, sem
achatamento, sem perda de autoria. *Propósito:* incorporar exatamente o que foi
aprovado, e nada além.

**Verificação pós-merge.** Reexecução das verificações **na linha principal já
integrada**. *Propósito:* uma entrega correta isoladamente pode falhar em conjunto; só a
verificação após a integração prova o resultado real.

**Tag (quando aplicável).** Marcação de um ponto recuperável do histórico. *Propósito:*
permitir retorno a um estado conhecido sem depender de reconstrução manual.

**Encerramento.** Registro do resultado, das pendências transferidas e das evidências
produzidas. *Propósito:* uma release sem encerramento deixa pendências órfãs — e
pendências órfãs reaparecem como surpresas.

**Regra de interrupção.** O fluxo pode ser **interrompido** em qualquer etapa sem deixar
o repositório inconsistente. Etapas podem ser **encerradas cedo**; **nunca puladas**.

---

## 5. Gates de Aprovação

Cada gate declara objetivo, evidência esperada e condição de aprovação. Um gate **não
verificado** conta como **não aprovado**.

**G1 — Build.**
*Objetivo:* garantir que o projeto permanece íntegro.
*Evidência:* resultado da construção, obtido antes e depois da integração.
*Aprovação:* conclusão sem erro, em ambos os momentos.

**G2 — Testes.**
*Objetivo:* garantir que o comportamento verificável permanece correto.
*Evidência:* resultado das verificações automatizadas existentes; quando não houver
cobertura automatizada, registro explícito da verificação manual realizada.
*Aprovação:* nenhuma verificação falhando; ausência de cobertura **declarada**, nunca
omitida.

**G3 — Impacto funcional.**
*Objetivo:* determinar se o comportamento muda — e se essa mudança era pretendida.
*Evidência:* comparação entre o comportamento declarado e o observado.
*Aprovação:* toda mudança de comportamento é intencional e declarada; em refatoração,
**nenhuma**.

**G4 — Impacto arquitetural.**
*Objetivo:* garantir que nenhuma fronteira, responsabilidade ou regra normativa é
alterada sem autorização.
*Evidência:* declaração do que muda e do que **permanece inalterado**; quando houver
alteração normativa, a decisão que a autorizou.
*Aprovação:* nenhuma alteração normativa sem autorização registrada.

**G5 — Impacto documental.**
*Objetivo:* garantir coerência entre o que o repositório faz e o que declara.
*Evidência:* documentos afetados e sua situação após a entrega.
*Aprovação:* nenhuma documentação contradiz o estado resultante.

**G6 — Reversibilidade.**
*Objetivo:* assegurar que a integração pode ser desfeita.
*Evidência:* natureza das alterações e existência de caminho de reversão.
*Aprovação:* a reversão é possível sem dano colateral e sem intervenção manual
extraordinária.

**G7 — Rastreabilidade.**
*Objetivo:* assegurar que a entrega poderá ser compreendida no futuro.
*Evidência:* commits com responsabilidade única, mensagens que declaram intenção,
autoria preservada e vínculo com a decisão de origem quando houver.
*Aprovação:* qualquer alteração pode ser explicada a partir do histórico.

**G8 — Conflitos.**
*Objetivo:* garantir que a integração não exige reconciliação manual imprevista.
*Evidência:* relação entre o ramo e a linha principal.
*Aprovação:* ausência de conflito, ou conflito resolvido e **revisado** como parte da
entrega.

**G9 — Escopo.**
*Objetivo:* garantir que a entrega faz exatamente o que declarou.
*Evidência:* conjunto de alterações confrontado com o escopo declarado.
*Aprovação:* nenhuma alteração fora do escopo — nem mesmo benéfica.

---

## 6. Critérios de Rejeição

Uma integração **não pode ocorrer** quando:

- **Evidência insuficiente** — algum gate foi presumido em vez de verificado.
- **Alterações fora do escopo declarado** — ainda que corretas ou desejáveis.
- **Build quebrado** — em qualquer dos dois momentos de verificação.
- **Verificação falhando** sem justificativa registrada e aceita.
- **Risco identificado e não mitigado**, nem formalmente aceito.
- **Documentação inconsistente** com o estado resultante.
- **Impossibilidade de reversão** integral.
- **Commit com múltiplas intenções** — impede rollback granular.
- **Alteração normativa sem autorização** exigida pela Governança.
- **Escopo declarado ausente** — não se aprova o que não se sabe avaliar.

A rejeição **não é um julgamento sobre o trabalho**: é a constatação de que a evidência
disponível não sustenta a decisão. Uma entrega rejeitada retorna com evidência
adicional, não com insistência.

---

## 7. Critérios de Aceitação

**Integração técnica — concluída quando:**
todos os gates aplicáveis foram aprovados com evidência; o merge preservou o histórico;
a verificação pós-merge reproduziu o resultado esperado; e a reversão permanece possível.

**Integração documental — concluída quando:**
a documentação afetada reflete o estado resultante; nenhum documento contradiz o
repositório; e as decisões que motivaram a entrega estão referenciadas.

**Encerramento operacional — concluído quando:**
o parecer da revisão está registrado; as evidências estão preservadas; as pendências
foram **explicitamente transferidas** com destino definido; e, quando aplicável, o ponto
do histórico foi marcado.

Uma release **só está encerrada quando os três níveis estão concluídos**. Integração
técnica sem encerramento operacional é trabalho inacabado que aparenta estar pronto.

---

## 8. Evidências

Toda release é acompanhada, no mínimo, de:

- **Tipo declarado** da release e seu escopo;
- **Commits** — quantidade e intenção de cada um;
- **Arquivos alterados** — quantidade e natureza (adição, alteração, remoção);
- **Resultado da construção** — antes e depois da integração;
- **Resultado das verificações** — ou declaração explícita de ausência de cobertura;
- **Impactos** — funcional, arquitetural e documental, incluindo o que **não** mudou;
- **Riscos** — separados em **eliminados**, **remanescentes** e **fora de escopo**;
- **Decisões** que autorizaram a entrega, quando aplicável;
- **Parecer final** — aprovado, aprovado com ressalvas ou rejeitado, com justificativa.

**Padrão de qualidade da evidência:** toda evidência deve ser **verificável por
terceiros** a partir do repositório, sem depender de quem produziu a entrega.

---

## 9. Registro Histórico

**Natureza.** Registros de release constituem o **histórico operacional** do projeto.
**Não fazem parte da arquitetura nem da governança normativa**: não regem, não definem
conceitos e não podem ser invocados como norma. Documentam **o que aconteceu**, não **o
que deve ser**.

**O que se registra:**

- **Releases** — tipo, escopo, data, conjunto de commits e resultado.
- **Integration Reviews** — o parecer e as evidências que o sustentaram.
- **Tags** — os pontos recuperáveis do histórico e o que representam.
- **Marcos** — conclusões de ciclos e mudanças de fase do projeto.

**Onde vivem.** Em espaço próprio, **separado** dos artefatos arquiteturais, de modo que
a arquitetura permaneça inequívoca e o histórico operacional permaneça consultável. A
separação é deliberada: misturá-los levaria, com o tempo, a tratar registro operacional
como norma.

**Permanência.** Registros operacionais **não são apagados**. Um registro incorreto é
**corrigido por um novo registro**, nunca por reescrita — o passado é o único dado que
não pode ser melhorado.

---

## 10. Papéis

Os papéis são **funções**, não pessoas. Uma mesma pessoa pode exercer vários — com uma
restrição inegociável.

**Autor.** Realiza a entrega. Declara tipo e escopo, garante commits de responsabilidade
única, executa a autoavaliação e reúne as evidências. *Responde por:* a entrega fazer o
que declara — e apenas isso.

**Revisor.** Conduz a Integration Review. Verifica os gates, confronta evidências e emite
parecer. *Responde por:* a decisão ser sustentada por evidência verificável.

**Release Manager.** Conduz o fluxo: confirma pré-condições, executa a integração
preservando o histórico, realiza a verificação pós-merge e o encerramento. *Responde
por:* o procedimento ser seguido integralmente e nada além do aprovado ser integrado.

**Configuration Manager.** Zela pela integridade do repositório: estrutura, versionamento,
rastreabilidade e preservação dos artefatos. *Responde por:* nada de valor existir fora
do controle de versão.

**Tech Lead.** Arbitra ambiguidades de escopo e classificação, decide sobre riscos
remanescentes e autoriza exceções ao processo. *Responde por:* as exceções serem raras,
justificadas e registradas.

**Restrição inegociável.** **Autor e Revisor não podem ser exercidos pela mesma pessoa
na mesma release.** Autoavaliação é obrigatória, mas não substitui revisão — quem produz
não consegue enxergar o que não considerou.

---

## 11. Declaração Oficial

> **Toda integração ao repositório principal do Zion OS deverá seguir este
> procedimento.**
>
> **Nenhuma alteração será integrada sem tipo declarado, escopo definido, gates
> verificados com evidência e parecer registrado.**
>
> **Qualquer exceção deverá ser explicitamente registrada e justificada, indicando qual
> etapa foi dispensada, por qual motivo e sob responsabilidade de quem.**

**Sobre exceções.** Exceções são legítimas — urgência existe e o processo serve ao
projeto, não o contrário. O que não é legítimo é a exceção **silenciosa**. Uma exceção
registrada é uma decisão; uma exceção omitida é uma falha de processo que se descobre
tarde demais.

**Sobre a evolução deste padrão.** Este documento pertence à engenharia de entrega e
evolui pelos mesmos princípios que estabelece: por alteração declarada, revisada e
registrada. Ele **não altera** a Governança Arquitetural, e a Governança Arquitetural não
o substitui — uma release de arquitetura obedece **aos dois**.

---

## Encerramento

Um processo de release existe para que a qualidade de uma integração **não dependa de
quem a conduz**. Quando o procedimento é o mesmo, a evidência é verificável e o registro
é permanente, qualquer pessoa consegue responder, anos depois, às três perguntas que
importam: **o que entrou**, **por que foi aprovado** e **como desfazer**.

Enquanto essas três perguntas tiverem resposta, a linha principal do Zion OS permanece
confiável.
