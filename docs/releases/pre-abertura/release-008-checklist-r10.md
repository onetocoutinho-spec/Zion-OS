# Checklist de Elegibilidade — R10 · Pré-Abertura da Release 008

> **Instância preenchida** do `engineering/checklist-elegibilidade-migracao.md`.
> Segunda aplicação prática do instrumento.
> Documento de evidência. Não altera artefato institucional algum.

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **Responsabilidade** | **R10** — Conhecimento de medidas por marca |
| **Arquivo de origem** | `src/lib/data/tabelasMedidas.ts` — 290 linhas |
| **Símbolos** | 6 valores (`PADRAO_BR`, `TABELAS_MARCA`, `COMO_MEDIR`, `MODELOS_PADRAO`, `medidasDaMarca`, `montarTabelaMedidas`) + 3 interfaces |
| **Destino arquitetural** | `modules/catalog` — verdade de produto |
| **Release prevista** | **008** |
| **Estado no Plano Executivo** | **Não iniciada** · Grupo B |
| **Linha de base disponível** | 14 testes em `src/lib/data/tabelasMedidas.test.ts` — **não rastreado pelo Git** |
| **Engenheiro responsável** | Release Manager desta execução |
| **Data** | 21 de julho de 2026 |

---

## 2. Verificação de elegibilidade

| # | Critério | Resultado | Evidência | Origem |
|---|---|---|---|---|
| **C1** | Identificada no Mapeamento | **SIM** | §2 l. 148–157 (finalidade, arquivo, funções, dependências, destino, acoplamento, prioridade); §7 matriz l. 319 | Protocolo, Fase 1 |
| **C2** | Destino arquitetural definido | **SIM** | Matriz: *"Catalog"* · estratégia *"Mover arquivo inteiro"*; §2: *"Módulo destino: **Catalog** (verdade de produto)"* | Mapeamento §7 |
| **C3** | Módulo de destino existe | **SIM** | `src/modules/catalog/` presente com as 5 camadas (`domain`, `application`, `ports`, `adapters`, `infrastructure`) | Plano Executivo, *Fontes de classificação* |
| **C4** | Prevista no Plano Executivo | **SIM** | Grupo B l. 94–105; Roadmap l. 253–259; Quadro Executivo l. 298 | Plano Executivo |
| **C5** | Estado permite migração | **SIM** | Quadro Executivo, coluna *Estado*: **`Não iniciada`**. Não é `Bloqueada` nem `Concluída` | Plano Executivo |
| **C6** | **Sem bloqueio de governança** | **SIM** | Redação literal: *"bloqueadas as etapas que **movem, dividem ou reorganizam** `mercadolivre.ts` e `publicar/route.ts`"*. R10 reside em `src/lib/data/tabelasMedidas.ts`. **Nenhum** de seus 4 consumidores é um dos dois arquivos nomeados | Protocolo, Fase 1 — critério de aprovação |
| **C7** | Dependências identificadas | **SIM** | Plano: *"Dependências: nenhuma. **Bloqueia:** R13"*. Matriz: *"Nenhuma de saída"*. Verificado no código: **zero imports** no arquivo | Mapeamento §7; Plano Executivo |
| **C8** | Consumidores por **busca no código** | **SIM** | `grep -rn "data/tabelasMedidas"` em `src/`: **4 consumidores de produção** — `cliente/medidas/page.tsx` (`MODELOS_PADRAO`), `cliente/produtos/page.tsx` e `lib/contexto.ts` (`montarTabelaMedidas`), `lib/marketplaces/mlUserProducts.ts` (`medidasDaMarca`) | Protocolo, Fase 1 — evidência obrigatória nº 2 |
| **C9** | Estratégia definida | **SIM** | Plano: *"mover arquivo inteiro; atualizar 5 importadores"*; Matriz: *"Mover arquivo inteiro"* | Mapeamento §7; Plano Executivo |
| **C10** | **Linha de base mensurável** | **SIM** | Executada nesta verificação: **14 tests · 14 pass · 0 fail**. Cobre os 9 símbolos públicos. Detecção de regressão provada por mutação, **7 de 7**. *Ver ressalva em §4* | Protocolo, Fase 1 — critério de aprovação |
| **C11** | Testes verdes | **SIM** | R10: 14/14. Suíte completa do projeto: **215 tests · 215 pass · 0 fail** | Protocolo, Fase 2; Padrão RE, G2 |
| **C12** | Build íntegro | **SIM** | `✓ Compiled successfully in 12.8s`, exit 0 | Protocolo, Fase 2; Padrão RE, G1 |
| **C13** | Evidências mínimas disponíveis | **SIM** | Plano enumera: *"linha de base criada e verde antes da migração; 5 consumidores atualizados; build"*. Todas obteníveis | Plano Executivo — *Evidências mínimas* |
| **C14** | Riscos conhecidos | **SIM** | **Médio** — *"5 consumidores, três deles telas"* (Plano e Matriz) | Mapeamento §7; Plano Executivo |
| **C15** | Complexidade conhecida | **SIM** | **Média** | Plano Executivo |
| **C16** | Nenhuma decisão pendente | **SIM** | Nenhum ADR pendente alcança R10. ADR-007 trata de Publication; ADR-008 está Aprovado. Nenhuma RFC aberta | Governança §5, §10 |
| **C17** | Uma responsabilidade por migração | **SIM** | Escopo: exclusivamente R10. Arquivo folha, sem símbolos de outras responsabilidades | Protocolo, princípios 4 e 5 |

**Resultado dos critérios: 17 SIM · 0 NÃO · 0 NÃO APLICÁVEL.**

---

## 3. Verificação do Protocolo — Fase 1

### 3.1 Execução

| # | Verificação | Resultado | Evidência |
|---|---|---|---|
| **P1** | Localizada no Mapeamento — arquivo, funções, módulo destino | **Sim** | §2 l. 148–157; §7 l. 319. Arquivo, funções, destino *Catalog* |
| **P2** | Bloqueios de governança confrontados **pela redação exata** | **Sim** | Citada integralmente em C6. Objeto: `mercadolivre.ts` e `publicar/route.ts`. R10 reside em `lib/data/`; nenhum consumidor é um dos dois arquivos. Conclusão por **leitura**, não interpretação |
| **P3** | Existência de linha de base verificada | **Sim** | 14 testes executados: 14 pass, 0 fail. **Porém não versionada** — ver §5 |
| **P4** | **Todos** os consumidores identificados por busca no código | **Sim** | Busca exaustiva por `data/tabelasMedidas`. 4 consumidores de produção. Nenhum de memória |

### 3.2 Evidências obrigatórias

| # | Evidência | Registro |
|---|---|---|
| **E1** | Citação do bloqueio e por que **não** alcança R10 | *"bloqueadas as etapas que movem, dividem ou reorganizam `mercadolivre.ts` e `publicar/route.ts`"*. R10 vive em `src/lib/data/tabelasMedidas.ts`, arquivo não nomeado. Seus 4 consumidores são duas telas, `contexto.ts` e `mlUserProducts.ts` — **nenhum é um dos dois arquivos bloqueados** |
| **E2** | Lista de consumidores **obtida por busca** | `cliente/medidas/page.tsx` · `cliente/produtos/page.tsx` · `lib/contexto.ts` · `lib/marketplaces/mlUserProducts.ts`. Formas de import divergentes: alias `@/` (duas telas), relativo sem extensão (`contexto.ts`), relativo **com** extensão `.ts` (`mlUserProducts.ts`) |
| **E3** | Confirmação de linha de base | **Existe e é mensurável** — 14 testes, 9 símbolos públicos, mutação 7/7. **Não institucionalizada** — ver §5 |

### 3.3 Critérios de aprovação e interrupção

| Condição | Redação literal | Verificado |
|---|---|---|
| **Aprovação** | *"Nenhum bloqueio vigente a alcança **e** existe linha de base mensurável."* | **SATISFEITA** |
| **Interrupção** | *"Um bloqueio a alcança; ou não existe linha de base."* | **NÃO ACIONADA** |

### 3.4 Tipo da migração e compatibilidade com a Fase 3

**Tipo: movimento de arquivo inteiro.** Diferentemente da Release 007 — que foi **extração
de símbolos** e exigiu evidência substitutiva —, R10 move um arquivo completo.

| Evidência característica da Fase 3 | Aplicável a R10 |
|---|---|
| `git mv` — nunca copiar-e-apagar | **Sim** |
| Rename registrado pelo Git | **Sim** |
| **Similaridade 100%** | **Sim** |
| Migrar o teste junto com o código | **Sim** — *condicionado a §5* |
| Alteração mínima nos consumidores | **Sim** — 4 arquivos, apenas caminho de import |

**Confirmado: a estratégia prevista permanece integralmente compatível com as evidências
características da Fase 3.** R10 é o caso para o qual o Protocolo foi originalmente
extraído — o mesmo formato da Release 003 (R9).

**Convenções a preservar**, verificadas no código: três formas distintas de import entre os
consumidores. `mlUserProducts.ts` usa caminho relativo **com extensão `.ts`**; `contexto.ts`
usa relativo **sem** extensão; as duas telas usam alias `@/` **sem** extensão. Cada
consumidor deve manter a sua.

---

## 4. Validação da linha de base

| # | Verificação exigida | Resultado |
|---|---|---|
| 1 | 14 testes específicos | **14 tests · 14 pass · 0 fail** |
| 2 | Cobertura dos 9 símbolos públicos | **9 de 9** — 6 valores por asserção, 3 interfaces por compilação |
| 3 | Suíte completa verde | **215 tests · 215 pass · 0 fail · 0 skipped** |
| 4 | Build aprovado | **`✓ Compiled successfully in 12.8s`**, exit 0 |
| 5 | Mutação 7/7 detectada | **7 de 7** — produzida nesta sessão contra o arquivo de hash `fde18b7c…`, o mesmo verificado agora |
| 6 | Hash do arquivo de produção inalterado | **IDENTICO** a `HEAD` — `fde18b7c7ebaed5675daf33fe70bd933e8bc2b2a` |

**As seis verificações passam.** A linha de base é tecnicamente suficiente: mensurável,
verde, proporcional ao risco e **comprovadamente capaz de detectar regressão**.

> **Ressalva sobre C10.** O critério exige que a linha de base **exista e seja mensurável** —
> e ela é, verificado por execução. O critério **não exige** que esteja versionada, e por
> isso C10 é registrado como **SIM**. A ausência de versionamento é tratada onde
> corresponde: na seção de bloqueadores.

---

## 5. Bloqueadores

| Categoria | Bloqueador | Origem | Impacto | Situação |
|---|---|---|---|---|
| **Técnico** | Nenhum | — | — | **Ausente** |
| **Arquitetural** | Nenhum | — | — | **Ausente** |
| **Governança** | Nenhum | — | — | **Ausente** |
| **Operacional** | **B1 — Linha de base não institucionalizada** | Ver abaixo | Impede que a Fase 5 compare contra um estado auditável | **PRESENTE** |

**Bloqueadores identificados: 1.**

### B1 — A linha de base de R10 não está institucionalizada

**Duas manifestações independentes do mesmo fato.**

**(a) O arquivo de teste não está sob controle de versão.**

`src/lib/data/tabelasMedidas.test.ts` é **não rastreado**. Nenhum commit o contém.
`git ls-files --error-unmatch` retorna ausência; `git status` o lista como `??`.

*Consequência concreta, não teórica:* a Release 008 criaria sua branch a partir de
`origin/master`, que **não contém a linha de base**. O Protocolo, Fase 5, exige
*"reexecutar **exatamente** os mesmos testes da Fase 2"* e comparar *"cada medida com a
linha de base, **número a número**"*. Não existe estado no repositório em que os 14 testes
tenham sido medidos **antes** da migração. A medição de 14/14 é reproduzível apenas nesta
árvore de trabalho, por esta sessão — **não por um terceiro auditando a release**.

**(b) O Plano Executivo ainda registra R10 como carente de linha de base.**

O Quadro Executivo, l. 298, registra:
`| **R10** | Não iniciada | Sem linha de base | 008 | Aguardando preparação | Criar linha de base |`

E a entrada de R10, l. 96–97: *"**Por que NÃO pode migrar ainda:** não possui teste próprio
(verificado); o Protocolo (Fase 1) exige linha de base mensurável."* · *"**Pré-requisitos:**
criar linha de base local para `medidasDaMarca`."*

O pré-requisito **foi cumprido de fato**, mas o registro institucional não reflete isso — e
**esta missão está expressamente proibida de alterar o Plano Executivo**.

**Ação necessária.** Uma Release do tipo **Documentação** institucionalizando:

1. `src/lib/data/tabelasMedidas.test.ts` — a linha de base;
2. `docs/zion-os/engineering/linha-de-base-r10.md` — seu registro de construção;
3. a atualização da linha de R10 no Plano Executivo, refletindo que o pré-requisito foi
   cumprido;
4. opcionalmente, `docs/zion-os/engineering/estrategia-linhas-de-base-grupo-b.md`, hoje
   igualmente não rastreado.

Concluída essa release, **reexecutar esta Pré-Abertura**. Nenhum critério do Checklist
mudaria; apenas B1 deixaria de existir.

### Caminho alternativo — considerado e rejeitado, com fundamento

*Poder-se-ia* incluir a institucionalização da linha de base como **primeiro commit da
própria Release 008**, seguido do commit de migração. Tecnicamente viável: o Padrão de
Release Engineering admite mais de um commit, exigindo apenas *"commits com
responsabilidade única"* (G7).

**Rejeitado.** O Protocolo, Fase 2, determina medir o comportamento *"**ANTES** de qualquer
alteração"*. Uma linha de base que entra no repositório **dentro da mesma release** que a
consome não constitui um "antes" independente: ela nasceria e seria usada no mesmo ato,
sem jamais ter existido como estado verificável por si. A separação em duas releases
preserva a independência entre a medição e o seu uso — que é precisamente o que dá valor
probatório à comparação da Fase 5.

**Registro:** a alternativa foi avaliada, não ignorada.

### Registrado, **não** classificado como bloqueador

| Constatação | Por que não bloqueia |
|---|---|
| O Plano cita *"5 importadores"*; o código mostra **4** | Divergência **D1**, já registrada na análise do Grupo B: `cliente/otimizar/page.tsx` importa de `tabelasMedidasCliente.ts`, arquivo distinto, e possui variável local homônima. O erro do Mapeamento é **conservador** — superestima acoplamento |
| Três formas distintas de import entre os consumidores | Convenção a preservar na Fase 3, não impedimento. Registrado em §3.4 |
| Comentários do arquivo contradizem o código quanto a Vizzano/Moleca/Actvitta | Achado **A1** do registro da linha de base. Não corrigido deliberadamente, para não quebrar a similaridade de 100% |
| A linha de base foi construída **antes** desta Fase 1 | Anomalia de ordenação, não de conteúdo. O Protocolo exige que a linha de base exista na Fase 1 e seja medida na Fase 2 — ambas satisfeitas. Registrado por transparência |

---

## 6. Parecer

# NÃO ELEGÍVEL

**Regra de decisão aplicada**, na redação do próprio Checklist:

> *"**NÃO ELEGÍVEL** decorre de qualquer reprovação, de **qualquer bloqueador registrado**,
> ou de qualquer critério não verificado."*

Existe **um** bloqueador registrado — **B1**, operacional. O parecer é binário e não admite
gradação: dezessete critérios aprovados não compensam um bloqueador. *"Um único `NÃO`
reprova. Não há compensação entre critérios."*

---

## 7. Justificativa — o primeiro bloqueador

**Por que a migração não pode iniciar.**

**Protocolo.** As duas condições de aprovação da Fase 1 estão satisfeitas — nenhum bloqueio
de governança alcança R10, e existe linha de base mensurável. **O impedimento não está na
Fase 1; está na Fase 5.** O Protocolo exige *"reexecutar exatamente os mesmos testes da
Fase 2"* e comparar *"número a número"*. Como o arquivo de teste não existe em commit
algum, a Release 008 não teria um estado "antes" verificável no repositório — a comparação
seria feita contra uma medição que só esta árvore de trabalho pode reproduzir.

**Plano Executivo.** Registra, na linha 298, o bloqueio de R10 como **"Sem linha de base"** e
a próxima ação como **"Criar linha de base"**. Esse registro está factualmente
desatualizado — a linha de base existe —, mas **é o registro institucional vigente**, e
esta missão não pode alterá-lo. Abrir a Release 008 contra um Plano que declara o
pré-requisito pendente romperia a rastreabilidade entre o backlog e a execução.

**Checklist.** Dezessete critérios aprovados, um bloqueador operacional registrado. A regra
de decisão do instrumento produz `NÃO ELEGÍVEL` sem margem interpretativa.

**Governança.** Nada aqui é questão de governança: nenhum bloqueio vigente alcança R10 e
nenhuma decisão está pendente. O impedimento é **operacional e inteiramente resolúvel** —
uma release de documentação o elimina.

**Natureza do impedimento.** R10 é tecnicamente a responsabilidade mais bem preparada do
backlog: arquivo folha, zero dependências de saída, `git mv` aplicável, similaridade 100%
disponível, 14 testes com detecção de regressão provada por mutação. **Nada no código a
impede.** O que a impede é que o trabalho já feito ainda não entrou no registro auditável
do projeto.

---

## 8. Autorização

**A abertura da Release 008 NÃO está autorizada.**

| Item | Estado |
|---|---|
| Parecer | **NÃO ELEGÍVEL** |
| Critérios | 17 SIM · 0 NÃO |
| Bloqueadores | **1** — operacional |
| Branch criada | **Nenhuma** |
| Código alterado | **Nenhum** |
| Migração iniciada | **Não** |

**Execução encerrada no PASSO 5**, conforme a instrução: *"Caso exista qualquer bloqueador:
interromper imediatamente."*

**Condição única para reversão do parecer:** institucionalizar a linha de base — arquivo de
teste, registro de construção e atualização da linha de R10 no Plano Executivo — por uma
Release de Documentação. Após seu merge, reexecutar esta Pré-Abertura.

**Prognóstico registrado, não presumido:** os 17 critérios foram verificados nesta execução
e nenhum depende do versionamento. Eliminado B1, a reexecução tende a produzir `ELEGÍVEL` —
mas **deverá ser executada na íntegra**, não presumida.

---

## Anexo — Matriz resumida

| Critério | Resultado |
|---|---|
| C1 · Identificada no Mapeamento | ✓ |
| C2 · Destino arquitetural definido | ✓ |
| C3 · Módulo de destino existe | ✓ |
| C4 · Prevista no Plano Executivo | ✓ |
| C5 · Estado permite migração | ✓ |
| C6 · **Sem bloqueio de governança** | ✓ |
| C7 · Dependências identificadas | ✓ |
| C8 · Consumidores identificados por busca | ✓ |
| C9 · Estratégia definida | ✓ |
| C10 · **Linha de base existente** | ✓ |
| C11 · Testes verdes | ✓ |
| C12 · Build íntegro | ✓ |
| C13 · Evidências mínimas disponíveis | ✓ |
| C14 · Riscos conhecidos | ✓ |
| C15 · Complexidade conhecida | ✓ |
| C16 · Nenhuma decisão pendente | ✓ |
| C17 · Uma responsabilidade por migração | ✓ |
| Protocolo · Fase 1 (P1–P4, E1–E3) | ✓ |
| Fase 3 · `git mv` e similaridade 100% aplicáveis | ✓ |
| **Bloqueadores registrados** | **1** |
| **ELEGÍVEL** | **NÃO** |
