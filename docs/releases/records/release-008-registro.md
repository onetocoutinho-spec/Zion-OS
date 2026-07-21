# Registro da Release 008 — Migração da R10 para Catalog/domain

> **Natureza.** Registro operacional. Documenta **o que aconteceu**, não *o que deve
> ser*. Não integra a arquitetura nem a governança normativa.

---

## 1. Objetivo

Migrar a responsabilidade **R10 — Conhecimento de medidas por marca** de `lib/data/` para
`modules/catalog/domain/`, preservando integralmente comportamento, contratos, assinatura
pública, testes, consumidores e **histórico do arquivo**.

**Segunda migração por movimentação integral** (`git mv`) do Zion OS, após a Release 003
(R9). Distinta da Release 007 (R11), que foi extração de símbolos.

- **Release:** 008 · **Tipo:** **Refatoração** · **Data:** 21 de julho de 2026
- **Linha principal antes:** `049f2cf` · **depois:** `33da7f8`
- **Branch:** `refactor/release-008-r10-medidas-por-marca` · **Commit:** `ab19385`
- **Pré-Abertura:** parecer `ELEGÍVEL` (reexecução), 17/17 critérios, 0 bloqueadores

---

## 2. Arquivos movidos

| Origem | Destino | Similaridade |
|---|---|---|
| `src/lib/data/tabelasMedidas.ts` | `src/modules/catalog/domain/tabelasMedidas.ts` | **R100** |
| `src/lib/data/tabelasMedidas.test.ts` | `src/modules/catalog/domain/tabelasMedidas.test.ts` | **R100** |

**Consumidores atualizados — 4, apenas linha de import**, cada um preservando sua própria
convenção, conforme o Protocolo exige:

| Consumidor | Convenção preservada | Import resultante |
|---|---|---|
| `app/cliente/medidas/page.tsx` | alias `@/`, sem extensão | `@/modules/catalog/domain/tabelasMedidas` |
| `app/cliente/produtos/page.tsx` | alias `@/`, sem extensão | `@/modules/catalog/domain/tabelasMedidas` |
| `lib/contexto.ts` | relativo, sem extensão | `../modules/catalog/domain/tabelasMedidas` |
| `lib/marketplaces/mlUserProducts.ts` | relativo, **com** extensão `.ts` | `../../modules/catalog/domain/tabelasMedidas.ts` |

**Volume:** 6 arquivos · **+4 / −4** — uma linha por consumidor. Os dois renames registram
**`0 0`**: zero linhas alteradas.

---

## 3. Evidências

### 3.1 Linha de base (Fase 2) e validação (Fase 4)

| Medida | Antes | Depois | Resultado |
|---|---|---|---|
| Commit | `049f2cf` | `33da7f8` | — |
| **SHA-256 produção** | `c5576aed…5003a` | `c5576aed…5003a` | **IDÊNTICO** |
| **SHA-256 teste** | `53ebba5d…cbe4f` | `53ebba5d…cbe4f` | **IDÊNTICO** |
| Assinatura pública | **9 exports** | **9 exports** | **IDÊNTICA** |
| Testes específicos R10 | 14 · 14 pass · 0 fail | 14 · 14 pass · 0 fail | **IDÊNTICO** |
| Suíte completa | 215 · 215 pass · 0 fail | 215 · 215 pass · 0 fail | **IDÊNTICO** |
| Build | `✓ 17.4s`, exit 0 | `✓ 15.3s`, exit 0 | **ÍNTEGRO** |
| Consumidores | 4 | 4 | **IDÊNTICO** |
| Formas de import | 3 distintas | 3 distintas | **PRESERVADAS** |

### 3.2 Evidências do Protocolo

| # | Evidência | Resultado |
|---|---|---|
| **EV1** | Git registrou **rename**, não delete+add | **Sim** — 2 renames |
| **EV2** | **Similaridade 100%** | **R100 em ambos os arquivos** |
| **EV3** | Linhas alteradas por consumidor | **1** cada, todas de import |
| **EV4** | Assinatura pública comparada | 9 → 9, símbolos idênticos |
| **EV5** | Ausência de referências órfãs ao caminho antigo | **1 ocorrência — comentário**. Ver §5, achado A1 |
| **EV6** | Build antes e depois | Ambos exit 0 |
| **EV7** | Testes reexecutados contra a linha de base | 14/14 e 215/215, número a número |
| **EV8** | Nenhuma documentação ou governança no commit | **0** arquivos em `docs/` |
| **EV9** | Outras responsabilidades intactas | R9, R11, R12 (`mlPayload.ts`) — **hash idêntico**; R13 (`montarBundleUserProducts`) presente na origem |
| — | Pós-merge | escopo preservado (2 R100 + 4 M); 0 conflitos; local == remoto; 14/14 reexecutados na linha principal |

**Dupla independência da prova.** O `R100` do Git e o `SHA-256` do conteúdo medem coisas
diferentes e convergem: o primeiro atesta que o Git reconheceu o movimento como renomeação
sem alteração; o segundo, que o conteúdo é byte a byte o mesmo. O Protocolo exige
exatamente isso: *"as evidências devem ser independentes entre si."*

---

## 4. Incidente E1 — recorrência, e a fase que a interceptou

**Este é o registro mais importante desta release.**

### 4.1 O que aconteceu

O comando de staging foi montado incluindo os **caminhos de origem** dos arquivos já
movidos. Como `git mv` já havia removido e indexado a renomeação, o `git add` abortou:

```
fatal: pathspec 'src/lib/data/tabelasMedidas.ts' did not match any files
```

O comando parou **antes de alcançar os quatro consumidores**. O commit resultante —
`e63e787` — continha **apenas os dois renames**, com os consumidores ainda apontando para o
caminho antigo. **Esse commit não compilaria.**

### 4.2 Como foi detectado

Pela **Auditoria do Commit — Fase 4 do Protocolo**, na verificação que compara os arquivos
do commit com os esperados pelo escopo:

```
arquivos no commit:  2   (esperado 6)
modificações:        0   (esperado 4 consumidores)
árvore consistente:  4 pendências em src/
conteúdo commitado dos consumidores: 0 de 4 atualizados
```

### 4.3 Como foi corrigido

O Protocolo determina: *"Se o commit **ainda não foi publicado**, corrigir por emenda e
reauditar. Se **já foi publicado**, interromper e tratar como incidente."*

Verificado que o commit **não havia sido publicado** — `git branch -r --contains e63e787`
retornou **0**. Os quatro consumidores foram indexados e o commit emendado para `ab19385`.
A auditoria foi **reexecutada integralmente** e aprovou 8 de 8, incluindo a inspeção do
**conteúdo commitado** de cada consumidor: 4 de 4 com o novo import, 0 com o antigo.

### 4.4 Por que isto importa

**É a segunda ocorrência do mesmo incidente.** A Fase 4 do Protocolo existe *"por causa de
um fato, não de uma suposição"* — o incidente E1 da Release 003, cujo commit também
continha os renames sem a atualização do consumidor.

A recorrência confirma três coisas:

1. **O modo de falha é sistemático**, não acidental. Ele decorre da interação entre
   `git mv` e um `git add` que ainda referencia caminhos de origem — e reaparecerá em toda
   migração por movimentação que não isolar o staging.
2. **A Fase 4 funciona.** Interceptou o defeito antes da publicação, exatamente como
   projetada, sem depender de vigilância humana.
3. **Verificar a árvore não substitui verificar o commit.** A árvore de trabalho estava
   correta o tempo todo — build verde, testes verdes, consumidores atualizados. **Somente a
   inspeção do conteúdo commitado revelou a divergência.**

---

## 5. Achados e exceções

**A1 — Comentário com o caminho antigo no arquivo de teste migrado.**
*Constatação:* a linha 2 de `tabelasMedidas.test.ts` mantém
`// Puros, sem rede/banco. Rodar: node --test src/lib/data/tabelasMedidas.test.ts`.
*Decisão:* **não corrigido.**
*Fundamento:* corrigi-lo **quebraria a similaridade de 100%**, que é a evidência central
desta release, e ampliaria o escopo declarado. A missão veda expressamente alterar
comentários. É o mesmo tratamento dado ao achado equivalente na **Release 003**, cujo
registro consta do próprio Protocolo.
*Destino:* registrado para deliberação futura.

**E1 — Incidente de staging.** Documentado integralmente na §4.
*Responsabilidade:* Release Manager desta execução. *Impacto na linha principal:* **nenhum** —
o commit defeituoso nunca foi publicado.

**E2 — Evidência ambígua produzida e descartada.**
*Constatação:* a verificação nº 12 da Integration Review reportou *"4 inserções / 461
remoções"* nos consumidores. Investigada: o comando usou filtro de caminho **sem `-M`**,
de modo que o arquivo movido foi contabilizado como 461 remoções no diretório de origem.
*Decisão:* evidência **rejeitada**; refeita com `-M`, revelando `1 1` por consumidor e
`0 0` nos dois renames.
*Fundamento:* *evidência ambígua não é evidência*. Sétima aplicação do princípio.

**E3 — Entrada da R13 no Plano Executivo ficou factualmente desatualizada.**
*Constatação:* a entrada de R13 declara *"depende de R9 (✔ migrada), **R10 (não
migrada)**"* e *"Pré-requisitos: R10 migrada"*; seu Quadro registra *"Aguardar Release
008"*. Com esta release, R10 **está** migrada.
*Decisão:* **não alterado.** A missão restringe a atualização do Plano exclusivamente à
entrada da R10. *"Nenhuma outra linha poderá ser modificada."*
*Destino:* correção devida na Pré-Abertura ou na execução da Release 009, que tem R13 por
objeto.

**E4 — Autor e Revisor exercidos pela mesma função.**
*Mitigação:* veredito apoiado exclusivamente em evidência mecanicamente verificável.

---

## 6. Auditoria do Commit

Executada duas vezes: reprovou na primeira, aprovou após a emenda.

| Verificação | 1ª execução (`e63e787`) | Após emenda (`ab19385`) |
|---|---|---|
| Arquivos esperados / presentes | 6 / **2** ❌ | 6 / **6** ✔ |
| Renames R100 | 2 ✔ | 2 ✔ |
| Modificações (consumidores) | **0** ❌ | **4** ✔ |
| Excedentes | 0 ✔ | 0 ✔ |
| Documentação tocada | 0 ✔ | 0 ✔ |
| Árvore consistente com o commit | **4 pendências** ❌ | **0** ✔ |
| Consumidores atualizados **dentro do commit** | **0 de 4** ❌ | **4 de 4** ✔ |
| Commit consistente | **NÃO** ❌ | **SIM** ✔ |

**APROVADA — 8 de 8**, na reauditoria.

---

## 7. Integration Review

| # | Verificação | Evidência | Conclusão |
|---|---|---|---|
| 1 | Somente R10 modificada | 6 arquivos: 2 de R10 + 4 consumidores | **APROVADO** |
| 2 | R9 intacta | `normalizarTamanho.ts` hash idêntico | **APROVADO** |
| 3 | R11 intacta | `exigenciaModeloCanal.ts` hash idêntico | **APROVADO** |
| 4 | R12 intacta | `mlPayload.ts` hash idêntico | **APROVADO** |
| 5 | R13 preservada | `montarBundleUserProducts` presente na origem | **APROVADO** |
| 6 | Nenhuma documentação alterada | 0 arquivos em `docs/` | **APROVADO** |
| 7 | Nenhuma governança alterada | 0 em `governance/`, `constitution/`, Protocolo, Checklist | **APROVADO** |
| 8 | Similaridade 100% | 2 renames **R100** | **APROVADO** |
| 9 | Assinatura pública preservada | 9 exports antes e depois | **APROVADO** |
| 10 | Conteúdo byte a byte | SHA-256 idêntico em produção e teste | **APROVADO** |
| 11 | Build e testes | `✓ 15.3s` · 14/14 · 215/215 | **APROVADO** |
| 12 | Diff dos consumidores restrito a import | `1 1` por consumidor; `0 0` nos renames | **APROVADO** |

**APROVADO — 12 de 12.**

---

## 8. Merge

| Verificação | Resultado |
|---|---|
| Conflitos | **0** |
| Commit final | `33da7f8` |
| Sincronização local | `master` atualizado |
| Sincronização remota | local == `origin/master` |
| Árvore limpa | **0** pendências em `src/` |
| Escopo preservado | 2 `R100` + 4 `M` |
| Verificação pós-merge | 14/14 reexecutados na linha principal |

---

## 9. Atualização do Plano Executivo

Alterada **exclusivamente** a entrada da R10. Volume: **+11 / −6**.

| Campo | Antes | Depois |
|---|---|---|
| Estado | **Não iniciada** | **CONCLUÍDA** ✅ |
| Release | prevista 008 | **executada 008** |
| Bloqueio | Nenhum | — |
| Situação | Linha de base pronta (Release 014) | Migrada, comportamento preservado |
| Próxima ação | Executar Pré-Abertura | Nenhuma |
| Destino | `modules/catalog` | `modules/catalog/domain/tabelasMedidas.ts` ✔ |

**Resumo do backlog:** de *2 concluídas · 5 aguardando engenharia adicional* para
**3 concluídas · 4 aguardando engenharia adicional**. Bloqueadas por governança (8) e sem
destino (2) inalteradas.

**Verificado:** exatamente **uma** linha do Quadro Executivo alterada, a de R10. As linhas
de R11 e R13 aparecem no diff apenas como contexto. Ver exceção **E3** quanto à entrada de
R13, deliberadamente não tocada.

---

## 10. Commit

| Item | Valor |
|---|---|
| Commit da migração | **`ab19385`** |
| Commit descartado por emenda | `e63e787` — nunca publicado |
| Merge | `33da7f8` |
| Autor | `onetocoutinho-spec` |
| Tipo declarado | **Refatoração** |

---

## 11. Resultado final

- **Integração técnica:** concluída. Auditoria reexecutada e aprovada; gates verificados;
  merge preservou o histórico; verificação pós-merge reproduziu o resultado; reversão
  possível.
- **Integração documental:** concluída. O Plano Executivo reflete o estado resultante.
- **Encerramento operacional:** concluído. Um incidente, um achado e duas exceções
  registrados; nenhum silencioso.

**Release 008 — CONCLUÍDA.**

**R10 — MIGRADA.** O módulo **Catalog** deixa de estar vazio: passa a conter sua primeira
responsabilidade real — o conhecimento de medidas por marca, verdade de produto.

### Critérios de sucesso

| Critério | Resultado |
|---|---|
| Git registrar R100 para produção | **SIM** |
| Git registrar R100 para testes | **SIM** |
| Build permanecer verde | **SIM** — `✓ 15.3s` |
| Suíte completa permanecer verde | **SIM** — 215/215 |
| 14 testes específicos verdes | **SIM** |
| Apenas R10 modificada | **SIM** |
| Auditoria aprovar | **SIM** — após emenda |
| Integration Review aprovar | **SIM** — 12/12 |
| Merge concluído | **SIM** — 0 conflitos |
| Plano Executivo atualizado | **SIM** |
| Registro oficial produzido | **SIM** — este documento |

---

## 12. Estado do backlog

| Grupo | Situação |
|---|---|
| **Concluídas** | **R9** (003) · **R11** (007) · **R10** (008) |
| **Grupo B restante** | R13 → 009 · R12 → 010 · R15 → 011 · R2 → 012 |
| **Grupo C** | 8 responsabilidades, bloqueadas pela validação operacional em produção |
| **Grupo D** | R5 e R16, sem destino arquitetural |

**R13 está desbloqueada.** Sua única dependência registrada — R10 migrada — foi satisfeita
por esta release. E, conforme a análise do Grupo B, **R13 já possui linha de base própria**:
os 7 testes de `montarBundleUserProducts` em `mlUserProducts.test.ts`. É a única
responsabilidade do backlog que não exige trabalho de teste prévio.

**Próxima ação prevista:** Pré-Abertura da **Release 009** (R13), que deverá corrigir a
entrada desatualizada registrada em **E3** e observar que R13 é uma **divisão de arquivo** —
não um movimento —, exigindo evidência substitutiva à similaridade de 100%, como ocorreu na
Release 007.
