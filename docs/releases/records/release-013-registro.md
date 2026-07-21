# Registro da Release 013 — Checklist de Elegibilidade de Migração

> **Natureza.** Registro operacional. Documenta **o que aconteceu**, não *o que deve
> ser*. Não integra a arquitetura nem a governança normativa.

---

## 1. Objetivo

Institucionalizar o **Checklist de Elegibilidade de Migração Arquitetural** como artefato
**obrigatório de pré-abertura** de toda Release de migração, e o **ADR-008** que autoriza
essa obrigatoriedade.

---

## 2. Contexto

### 2.1 O problema que o Checklist resolve

Determinar se uma responsabilidade pode iniciar migração exigia consultar cinco artefatos
distintos. O procedimento funcionava — foi aplicado com êxito na Release 003 — mas não
tinha forma verificável, e os critérios que ele apura são de **interrupção**, não de
correção: descobri-los tarde não produz ajuste, produz release abortada.

### 2.2 Duas decisões de gestão tomadas antes da execução

Esta release foi **interrompida antes do PASSO 1** e submetida a deliberação, por conter
duas contradições que nenhuma execução literal poderia resolver.

**Decisão 1 — numeração.** A missão determinava executar como **Release 007** e,
simultaneamente, **não alterar o roadmap**. O roadmap institucionalizado reserva o número
**007 para a migração da R11** — em três ocorrências. Executar como 007 recriaria
exatamente o **Achado A1**, eliminado uma release antes.

*Decisão:* executar como **Release 013**, fora do bloco reservado 007–012. Respeita
integralmente as restrições declaradas — escopo mínimo, zero alteração no roadmap, zero
colisão — ao custo de uma numeração não sequencial, registrada aqui e no ADR-008.

**Decisão 2 — normatividade.** O Checklist declara-se *"artefato obrigatório"*. Ainda que
não crie critério algum, **tornar sua execução obrigatória é alteração normativa do
processo de engenharia** — vedada pela Governança sem ADR aprovado.

*Decisão:* exigir ADR de institucionalização. Isso **ampliou o escopo** de um para dois
arquivos — ampliação autorizada explicitamente, registrada como exceção **E1**.

---

## 3. Escopo

**Declarado originalmente:** um arquivo — o Checklist.
**Ampliado por autorização:** dois arquivos — o Checklist e o ADR-008.
**Entregue:** idêntico ao escopo ampliado — 2 arquivos, **609 inserções**, nenhuma remoção,
nenhuma modificação.

- **Release:** 013 · **Tipo:** Documentação · **Data:** 21 de julho de 2026
- **Linha principal antes:** `ab70445` · **depois:** `def906f`
- **Branch:** `docs/release-013-checklist-elegibilidade` · **Commit:** `fee81de`

---

## 4. Documentos institucionalizados

**`docs/zion-os/engineering/checklist-elegibilidade-migracao.md`** — 339 linhas.
Instrumento operacional que responde a uma única pergunta: *a responsabilidade está
elegível para migração?* Contém 17 critérios com origem documental citada, as 7
verificações obrigatórias da Fase 1 do Protocolo (P1–P4, E1–E3), tabela de bloqueadores,
parecer binário `ELEGÍVEL` / `NÃO ELEGÍVEL`, matriz-resumo e tabela de rastreabilidade
documental.

Declara sua própria subordinação: *"em caso de divergência entre este checklist e sua
fonte, prevalece a fonte."*

**`docs/zion-os/governance/ADR-008-institucionalizacao-do-checklist-de-elegibilidade.md`**
— autoriza a existência do Checklist, a obrigatoriedade de sua execução e sua inclusão no
registro oficial das releases de migração. Avalia quatro alternativas, delimita
exaustivamente o que **não** decide, e registra a consequência negativa principal: *"um
instrumento consolidador desatualizado é pior que a consulta distribuída, porque a
substitui aparentando autoridade."*

Rejeitou a Alternativa D — incorporar as verificações ao próprio Protocolo — por
incompatibilidade com a natureza do documento, que foi *"extraído, não projetado"*.

---

## 5. Evidências coletadas

| # | Evidência | Resultado |
|---|---|---|
| Auditoria | Arquivos esperados no commit | **2 de 2** |
| Auditoria | Ausentes | **0** |
| Auditoria | Excedentes | **0** |
| Auditoria | Arquivos funcionais / de código | **0** |
| Auditoria | Árvore consistente | **0** pendências em `docs/zion-os` |
| Auditoria | Diff compatível | **`A A`** — adição pura |
| EV1 | Arquivos adicionados | **2** (escopo ampliado e autorizado) |
| EV2 | Arquivos de código alterados | **0** |
| EV3 | Alterações em `src/`, `modules/`, `constitution/`, `organization/` | **0 · 0 · 0 · 0** |
| EV4 | Critérios com origem documental | **17 de 17** |
| EV5 | Citações confrontadas com a fonte | **32 de 32 verificadas** |
| EV6 | Decisões arquitetônicas modificadas | **0** — 0 modificações, 0 remoções, 0 renomeações |
| EV7 | Regras de governança alteradas | **0** — ADR-008 é adição; adicionar ADR **é** o mecanismo da governança, não sua violação |
| EV8 | Integridade das fontes | **5 de 5 hash-idênticas** a `origin/master`: Protocolo, Plano Executivo, Mapeamento, Padrão de Release Engineering, Governança Arquitetural |
| EV9 | Build | **`✓ Compiled successfully in 114s`**, exit 0 |
| — | Pós-merge | escopo preservado (2 `A`); 0 conflitos; local == remoto |

**Sobre EV8 — a evidência decisiva.** Comparar o hash de árvore de cada documento-fonte
antes e depois é prova **mecânica e não interpretável** de que nenhuma delas foi tocada.
As cinco são idênticas byte a byte. Não existe caminho pelo qual arquitetura, governança,
protocolo, plano ou mapeamento pudessem ter mudado.

---

## 6. Exceções registradas

**E1 — Ampliação do escopo declarado, de um para dois arquivos.**
*Constatação:* a missão declarava escopo exclusivo de um arquivo. A decisão de exigir ADR
de institucionalização tornou necessária a inclusão do ADR-008.
*Decisão:* ampliação **autorizada explicitamente** antes da execução.
*Mitigação:* ambos os arquivos são documentação pura; auditoria confirmou 0 excedentes.
*Responsabilidade:* decisão de gestão, registrada na §2.2.

**E2 — Numeração não sequencial da release.**
*Constatação:* esta release recebeu **013**, sucedendo a **006**. Os números 007–012
permanecem reservados pelo roadmap às migrações previstas.
*Decisão:* deliberada, para não recriar o Achado A1.
*Impacto:* o histórico de releases apresenta uma lacuna aparente entre 006 e 013.
*Mitigação:* registrado aqui e no ADR-008, §10.
*Responsabilidade:* decisão de gestão, registrada na §2.2.

**E3 — Evidência ambígua produzida e descartada durante a Revisão Técnica.**
*Constatação:* a verificação de 32 citações reportou **uma FALHA** — a frase *"um gate não
verificado conta como não aprovado"*, supostamente ausente do Padrão de Release
Engineering.
*Decisão:* a evidência foi **rejeitada** e a verificação refeita. A frase **existe**,
dividida entre as linhas 173 e 174 da fonte; o `grep` de linha única não podia encontrá-la.
Reconfirmada por exibição direta do contexto.
*Fundamento:* princípio institucionalizado — *evidência ambígua não é evidência*.
*Responsabilidade:* segunda aplicação bem-sucedida do princípio, após a Release 006.

**E4 — Artefatos de governança não rastreados.**
*Constatação:* **ADR-003**, **ADR-005** e **ADR-006** permanecem não rastreados em
`docs/decisions/`, fora de `docs/zion-os/governance/`.
*Decisão:* não tratado nesta release — está fora do escopo declarado.
*Impacto:* a numeração de ADRs vive hoje em dois diretórios.
*Destino:* pendência já registrada, mantida em aberto.
*Responsabilidade:* registrado para deliberação futura.

**E5 — Autor e Revisor exercidos pela mesma função.**
*Mitigação:* veredito apoiado exclusivamente em evidência mecanicamente verificável —
hashes de árvore, contagens de arquivos e confronto literal de citações.
*Responsabilidade:* Release Manager desta execução.

**Observação factual, sem interpretação:** os arquivos não rastreados caíram de **163**
(Release 006) para **13**. A causa não foi investigada — está fora do escopo desta release.

---

## 7. Auditoria do Commit

Executada conforme a **Fase 4 do Protocolo de Migração Arquitetural**.

| Verificação | Resultado |
|---|---|
| Arquivos esperados | 2 |
| Arquivos presentes | **2** |
| Nenhum ausente | **0** |
| Nenhum excedente | **0** |
| Nenhum arquivo funcional | **0** |
| Nenhum arquivo de código | **0** |
| Diff compatível | **`A A`** |
| Árvore consistente | **0** pendências |
| Commit consistente | **sim** |

**APROVADA — 9 de 9.**

---

## 8. Integration Review

| # | Verificação | Evidência | Conclusão |
|---|---|---|---|
| 1 | Escopo integralmente respeitado | 2 arquivos, ambos declarados | **APROVADO** |
| 2 | Somente documentação | 2/2 são `.md` | **APROVADO** |
| 3 | Nenhum arquivo funcional alterado | 0 | **APROVADO** |
| 4 | Nenhum código modificado | 0 em `src/` | **APROVADO** |
| 5 | Nenhuma alteração arquitetural | 0 modificações em `constitution/`, `organization/`, `modules/` | **APROVADO** |
| 6 | Nenhuma alteração de governança | 0 modificações; 1 adição (ADR-008) | **APROVADO** |
| 7 | Protocolo inalterado | 0 · hash idêntico | **APROVADO** |
| 8 | Plano Executivo inalterado | 0 · hash idêntico | **APROVADO** |
| 9 | Mapeamento inalterado | 0 · hash idêntico | **APROVADO** |
| 10 | Consistência com os artefatos institucionais | 32/32 citações verificadas; 5/5 fontes hash-idênticas | **APROVADO** |
| 11 | Build aprovado | `✓ Compiled successfully in 114s`, exit 0 | **APROVADO** |

**APROVADO — 11 de 11.**

---

## 9. Parecer técnico

**APROVADO.**

*Fundamentação:* escopo entregue idêntico ao escopo ampliado autorizado; auditoria de
commit sem ausências nem excedentes; nenhum arquivo de código alterado; **nenhum documento
normativo modificado, comprovado por identidade de hash**; build íntegro; integração
reversível por completo.

**Argumento de ausência de impacto comportamental:** ambas as entradas são adições puras
de texto. Nenhum arquivo em `src/` foi tocado. Não existe caminho pelo qual o
comportamento do sistema pudesse ter mudado.

**Argumento de não-criação de regra:** as 32 citações literais do Checklist foram
confrontadas, uma a uma, com o texto das fontes. Todas existem. O único critério não
enumerado na especificação original — **C17, "uma responsabilidade por migração"** —
deriva literalmente dos princípios 4 e 5 do Protocolo e do Roadmap do Plano Executivo, e
sua adição está registrada de forma auditável na seção de Validação do próprio documento.

**Argumento de conformidade com a governança:** a obrigatoriedade do Checklist — única
alteração normativa desta release — foi autorizada por ADR aprovado, conforme exige a
Governança. O ADR nomeia exaustivamente o que autoriza e o que preserva. Adicionar um ADR
não é alterar a governança; **é exercê-la**.

---

## 10. Resultado final

- **Integração técnica:** concluída. Auditoria e gates verificados; merge preservou o
  histórico; verificação pós-merge reproduziu o resultado esperado; reversão possível.
- **Integração documental:** concluída. O Checklist está em `engineering/`, o ADR-008 em
  `governance/`; nenhum documento existente contradiz o estado resultante.
- **Encerramento operacional:** concluído. Parecer registrado; evidências preservadas;
  cinco exceções registradas com destino definido.

**Release 013 — CONCLUÍDA.**

**Nenhuma migração foi iniciada.** Nenhum código foi alterado. A **R11 permanece não
iniciada**, e sua migração continua prevista como **Release 007**.

---

## 11. Estado atualizado do processo de engenharia

**O que mudou.** Toda Release de migração arquitetural passa a exigir, antes de sua
abertura, da criação da branch e da definição do escopo, a execução do Checklist de
Elegibilidade — com parecer binário e evidência arquivada.

**O que não mudou.** Nada além disso. As fases do Protocolo, os gates do Padrão de Release
Engineering, os estados e prioridades do Plano Executivo, as classificações do Mapeamento
e as regras da Governança permanecem exatamente como estavam, comprovadamente.

**Fluxo resultante de uma Release de migração:**

1. **Checklist de Elegibilidade** → parecer `ELEGÍVEL` ou `NÃO ELEGÍVEL` *(novo — esta release)*
2. Protocolo, Fase 2 — linha de base
3. Protocolo, Fase 3 — execução
4. Protocolo, Fase 4 — auditoria do commit
5. Protocolo, Fase 5 — validação pós-migração
6. Protocolo, Fase 6 — Padrão de Release Engineering

**Estado do ADR-008:** **APROVADO**, revalidação **pendente**. Passará a *Implementado*
quando o Checklist for executado na íntegra, ao menos uma vez, antes de uma Release de
migração real. Se essa primeira execução exigir critério não previsto, o Checklist será
objeto de RFC — não de correção silenciosa.

**Roadmap:** inalterado. R11 → 007 · R10 → 008 · R13 → 009 · R12 → 010 · R15 → 011 ·
R2 → 012. Números 007–012 permanecem reservados.

**Próxima ação prevista:** execução do Checklist de Elegibilidade para a **R11**, como
etapa de pré-abertura da Release 007. Será a primeira aplicação real do instrumento e a
revalidação do ADR-008.

**Pendências que permanecem em aberto:** validação operacional da reutilização de guias
(bloqueia as 8 responsabilidades do Grupo C); remoção da rota de diagnóstico
`/api/ml/diagnostico-guias`; consolidação dos ADR-003, ADR-005 e ADR-006 em
`governance/`; avaliação de vigência de `docs/architecture/`; investigação das estruturas
`src/domain/`, `src/application/` e `src/infrastructure/` não cobertas pelo Mapeamento.
