# Release 001 — Institucionalização do Release Engineering

> **Natureza.** Plano operacional de release. É **registro operacional**, não artefato
> arquitetural nem norma de governança: documenta **o que será feito e como**, não *o que
> deve ser*.
>
> **Tipo de release:** **Documentação**.
> **Escopo:** inclusão de **um único arquivo**.
>
> **Base factual.** Todo estado descrito foi **verificado no repositório**, conforme o
> princípio de que nenhuma decisão depende de memória ou presunção.

---

## Estado verificado do repositório

- **Linha principal:** `origin/master` em **`ae0b739`** — *"Merge pull request #9 from
  onetocoutinho-spec/docs/versionar-arquitetura-oficial"*.
- **Arquitetura oficial integrada:** **31 arquivos** presentes em `docs/zion-os/`.
- **Sprint 0 integrada:** confirmado — `ADR-006` presente na linha principal, em
  `docs/decisions/`.
- **Diretório de destino já existe:** `docs/zion-os/engineering/` contém 6 documentos
  versionados; o arquivo desta release junta-se a eles.
- **Arquivo a incorporar:** `docs/zion-os/engineering/padrao-release-engineering.md`
  existe em disco e **não está sob controle de versão**.

---

## 1. Objetivo da Release

**Por que esta release existe.** O documento que define o processo oficial de integração
do Zion OS encontra-se fora do controle de versão. Enquanto permanecer assim, o processo
que rege todas as integrações **não integra o repositório que ele governa** — e nenhuma
release futura pode invocá-lo como norma verificável.

**Qual problema resolve.** Elimina a última dependência de armazenamento local entre os
artefatos de processo produzidos até aqui, e torna o padrão de Release Engineering
consultável, rastreável e permanente.

**Por que foi separada da institucionalização da arquitetura.** Porque incluí-la naquela
release teria **alterado o escopo já aprovado**. A branch anterior recebeu parecer
favorável com base em evidência de um conjunto específico de arquivos; acrescentar um
documento depois do parecer significaria integrar algo diferente do que foi revisado —
violando o gate de escopo e o princípio de que *o escopo declarado é o escopo entregue*.

A separação não é formalidade: é a **primeira aplicação prática** do padrão que esta
release institucionaliza.

---

## 2. Escopo

**Contém exclusivamente:** a inclusão do arquivo
`docs/zion-os/engineering/padrao-release-engineering.md`.

**Nenhum outro arquivo pode ser incluído.**

| Pergunta | Resposta |
|---|---|
| Arquivos de código alterados? | **Não** |
| Arquitetura alterada? | **Não** |
| Governança arquitetural alterada? | **Não** |
| Blueprints alterados? | **Não** |
| ADRs alterados? | **Não** |
| RFCs alteradas? | **Não** |

O documento incorporado **descreve processo de entrega**; não define, altera nem
interpreta arquitetura. Sua inclusão não produz efeito normativo sobre a Constituição
nem sobre a Governança Arquitetural.

---

## 3. Estratégia de Branch

**Nome recomendado:** `docs/padrao-release-engineering`
*Justificativa:* prefixo por tipo de release, consistente com a convenção já praticada no
repositório.

**Ponto de criação:** `origin/master` em `ae0b739`, atualizado.
*Justificativa:* o diretório de destino já existe na linha principal; partir dela garante
que a única diferença introduzida seja o arquivo desta release.

**Estratégia de merge:** integração preservando o histórico — **sem reescrita, sem
achatamento, sem perda de autoria**. Commit único, de responsabilidade única.

**Política de revisão:** revisão **independente**, conduzida por quem não produziu a
entrega. A verificação recai sobre **quatro pontos objetivos**, e nenhum deles é o
conteúdo do documento:

1. o conjunto de alterações contém **exclusivamente** o arquivo previsto;
2. o arquivo está no diretório correspondente à sua natureza;
3. **nenhum arquivo de código** foi tocado;
4. o build permanece íntegro.

*O conteúdo do documento não é objeto desta revisão* — ele já foi produzido e aceito como
padrão; esta release apenas o incorpora.

---

## 4. Evidências Esperadas

Coletadas **antes** do merge e registradas no parecer:

| Evidência | Valor esperado |
|---|---|
| Commits na branch | **1** |
| Arquivos alterados | **1** |
| Natureza da alteração | **Adição** (nenhuma deleção, nenhuma modificação) |
| Arquivos de código alterados | **0** |
| Alterações fora de `docs/zion-os/engineering/` | **0** |
| Impacto sobre a arquitetura | **Nenhum** — nenhum artefato normativo tocado |
| Impacto sobre build | **Nenhum** — construção íntegra antes e depois |
| Impacto sobre comportamento | **Nenhum** |
| Reversibilidade | **Total** — adição pura, revertível por completo |
| Rastreabilidade | Commit com intenção declarada, autoria preservada |
| Conflitos | **Nenhum** — arquivo novo em diretório existente |

**Padrão de qualidade:** toda evidência deve ser **verificável por terceiros** a partir do
repositório, sem depender de quem produziu a entrega.

---

## 5. Critérios de Aprovação

A release **somente** pode ser aprovada se **todos** forem verdadeiros:

- altera **exclusivamente documentação**;
- **não** modifica arquitetura;
- **não** modifica código;
- **não** altera comportamento do sistema;
- permanece **integralmente reversível**;
- possui escopo **idêntico** ao declarado — nem menos, nem mais.

Um critério **não verificado** conta como **não atendido**.

---

## 6. Critérios de Rejeição

A release **deve ser rejeitada** caso ocorra qualquer uma das situações:

- **qualquer arquivo além do previsto** seja incluído — ainda que útil ou correto;
- exista **alteração funcional**;
- exista **alteração arquitetural**;
- exista **alteração de governança** fora do documento desta release;
- o **escopo não corresponda** às alterações apresentadas;
- alguma evidência tenha sido **presumida** em vez de verificada;
- o **build** falhe em qualquer dos dois momentos de verificação.

A rejeição não julga o trabalho: constata que a evidência disponível não sustenta a
decisão.

---

## 7. Plano de Execução

**Passo 1 — Criar a branch.**
A partir de `origin/master` atualizado.
*Conclusão:* branch criada e apontando para a mesma referência da linha principal.

**Passo 2 — Adicionar o documento.**
Incluir **apenas** `docs/zion-os/engineering/padrao-release-engineering.md`, em commit
único com intenção declarada.
*Conclusão:* commit criado; nenhum outro caminho presente no conjunto de alterações.

**Passo 3 — Revisar as alterações.**
Conferir o conjunto de alterações contra o escopo declarado.
*Conclusão:* exatamente 1 arquivo, do tipo adição, no diretório previsto.

**Passo 4 — Executar as verificações previstas.**
Coletar todas as evidências do §4, incluindo a construção do projeto.
*Conclusão:* todas as evidências coletadas correspondem aos valores esperados.

**Passo 5 — Abrir o Pull Request.**
Declarar tipo, escopo e evidências.
*Conclusão:* PR aberto, com escopo declarado explicitamente.

**Passo 6 — Integration Review.**
Revisão independente, verificando os quatro pontos do §3 e os critérios do §5.
*Conclusão:* parecer emitido — aprovado, aprovado com ressalvas ou rejeitado.

**Passo 7 — Integrar na linha principal.**
Somente após parecer favorável, preservando o histórico.
*Conclusão:* merge concluído sem reescrita e sem conflito.

**Passo 8 — Confirmar o merge.**
Verificar, na linha principal já integrada, que o arquivo está presente, que nenhum
outro caminho foi afetado e que a construção permanece íntegra.
*Conclusão:* verificação pós-merge reproduz o resultado esperado.

**Passo 9 — Encerrar a release.**
Registrar o resultado, as evidências e as pendências transferidas.
*Conclusão:* os três níveis de aceitação (§9) satisfeitos.

**Regra de interrupção.** Falha na condição de conclusão de qualquer passo interrompe a
execução naquele ponto. Nenhum passo é executado "para ver se resolve".

---

## 8. Riscos

### Riscos eliminados por esta release

| Descrição | Prob. | Impacto | Mitigação | Situação |
|---|---|---|---|---|
| Processo de release existir apenas em armazenamento local | Alta | Alto | Versionamento e publicação | **ELIMINADO** ao concluir |
| Releases futuras sem procedimento oficial consultável | Alta | Médio | Padrão passa a integrar o repositório | **ELIMINADO** ao concluir |

### Riscos remanescentes

| Descrição | Prob. | Impacto | Mitigação | Situação |
|---|---|---|---|---|
| Escopo crescer durante a execução (inclusão de arquivos úteis) | Média | Médio | Gate de escopo; rejeição automática | **CONTROLADO** |
| Divergência entre o padrão escrito e a prática efetiva | Média | Médio | Aplicação nas próximas releases; exceções registradas | **ABERTO — não bloqueia** |

### Riscos fora de escopo

*Registrados por rastreabilidade; **nenhum** é afetado por esta release nem a bloqueia.*

| Descrição | Situação |
|---|---|
| `ADR-006` reside em `docs/decisions/`, fora da estrutura oficial | **ABERTO** — reconciliação prevista, release própria |
| Rota temporária de diagnóstico presente na linha principal | **ABERTO** — Etapa 7 do plano de refatoração |
| `ADR-003` e `ADR-005` sem versionamento | **ABERTO** — exigem conferência de conteúdo |
| Vigência do material em `docs/architecture/` não avaliada | **ABERTO** — atividade dedicada |
| Integration Review da institucionalização não preservado no repositório | **ABERTO** — registro operacional |
| Validação em produção da reutilização de guia (Sprint 0) | **ABERTO** — verificação operacional |

---

## 9. Critérios de Encerramento

**Integração técnica — concluída quando:** todos os critérios do §5 foram verificados com
evidência; o merge preservou o histórico; a verificação pós-merge reproduziu o resultado
esperado; a reversão permanece possível.

**Integração documental — concluída quando:** o padrão está presente na linha principal,
no diretório correspondente à sua natureza; nenhum documento existente contradiz o estado
resultante.

**Encerramento operacional — concluído quando:** o parecer está registrado; as evidências
estão preservadas; as pendências foram **explicitamente transferidas** com destino
definido.

Ao final deverá ser possível afirmar:

- **o padrão oficial de Release Engineering integra o histórico do projeto;**
- **futuras releases passam a possuir procedimento oficial consultável;**
- **nenhuma alteração funcional foi realizada;**
- **nenhuma alteração arquitetural foi realizada;**
- **a release permanece totalmente auditável e reversível.**

---

## 10. Declaração Oficial

> **O Zion OS passa a possuir um processo oficial de Release Engineering
> institucionalizado.**
>
> **Toda integração futura deverá observar este padrão, salvo exceções explicitamente
> registradas e justificadas.**

*Esta declaração torna-se efetiva com a conclusão verificada dos Passos 1 a 9 (§7) e a
satisfação integral dos Critérios de Encerramento (§9). Até lá, permanece como resultado
pretendido, não como fato consumado.*

---

## Nota de disciplina

Este plano é **registro operacional** e, conforme o padrão que institucionaliza, **não
integra o escopo da própria release** — cujo escopo é, e permanece, **exclusivamente** o
arquivo `padrao-release-engineering.md`.

A preservação dos registros operacionais no repositório é tratada como atividade própria,
registrada em §8 entre os itens fora de escopo. Incluí-la aqui repetiria exatamente o erro
que levou esta release a existir separada da anterior.
