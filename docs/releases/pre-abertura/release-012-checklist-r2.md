# Checklist de Elegibilidade — R2 · Pré-Abertura da Release 012

> **Instância preenchida** do `engineering/checklist-elegibilidade-migracao.md`.
> Sexta aplicação prática do instrumento.
>
> **Por que esta Pré-Abertura existe.** A missão recebida determinava executar diretamente
> a migração de R2. Verificou-se que **nenhuma Pré-Abertura havia sido executada para R2** —
> os cinco documentos existentes cobrem R11, R10, R13 e R12. O **ADR-008 (APROVADO)** torna
> o Checklist obrigatório *"antes da abertura de Release de migração arquitetural, **da
> criação da branch e da definição do escopo**"*. Executá-la é condição, não opção.
>
> **Independência declarada.** Toda evidência foi produzida sobre o commit `2e84bcb`.

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **Responsabilidade** | **R2** — Persistência do vínculo do canal |
| **Release** | **012** |
| **Commit atual** | `2e84bcb2bd436adb6e4f441371f9832b4ab4c7c6` · `master` == `origin/master` |
| **Arquivos** | `src/lib/marketplaces/canalServidor.ts` (81 linhas) · `canalServidor.test.ts` |
| **SHA-256** | produção `e2c484850a724875…` · teste `e8c642531beb01a0…` — ambos `==HEAD` |
| **Destino registrado** | **Integration — Connection (infraestrutura)** |
| **Estratégia registrada** | **"Mover atrás de porta"** — Mapeamento §7, l. 324 |
| **Linha de base** | **12 testes**, institucionalizados na Release 016 · verificados: **12 pass · 0 fail** |
| **Estado no Plano** | `Não iniciada` · Bloqueio `Nenhum` · **Categoria A** · *"Executar Pré-Abertura"* |

### 1.1 Consumidores — obtidos por busca

**Cinco de produção**, todos rotas de API, todos com alias `@/` sem extensão:
`conectar` · `publicar` · `vendas` · `importar-anuncios` · `diagnostico-guias`.

> O Mapeamento registra **6**. O sexto — `lib/services/canaisMarketplace.ts` — referencia
> `canalServidor.ts` **apenas em um comentário** (l. 5). Divergência já registrada na
> análise do Grupo B como **D2**.

### 1.2 Dependências

Uma única: `SupabaseClient` de `@supabase/supabase-js` — **tipo apenas**, importado de
**pacote** (não caminho relativo), e **injetado por parâmetro**.

---

## 2. Verificação de elegibilidade — os 17 critérios

| # | Critério | Resultado | Evidência produzida nesta execução | Origem |
|---|---|---|---|---|
| **C1** | Identificada no Mapeamento | **SIM** | §2: finalidade, arquivo (81 linhas), funções, dependências, destino, acoplamento **alto** (6 consumidores), prioridade **baixa**. §7 matriz l. 324 | Protocolo, Fase 1 |
| **C2** | Destino arquitetural definido | **SIM** | Matriz: `Integration / Connection (infra)`. §2: *"Integration — Connection (infraestrutura)"* | Mapeamento §7 |
| **C3** | Módulo de destino existe | **SIM** | `src/modules/integration/` com as 5 camadas. **Ressalva material em §4.4** | Plano Executivo |
| **C4** | Prevista no Plano Executivo | **SIM** | Grupo B; Quadro l. 320; Release prevista 012 | Plano Executivo |
| **C5** | Estado permite migração | **SIM** | Quadro l. 320: `Não iniciada` · `Nenhum` · **Categoria A** | Plano Executivo |
| **C6** | **Sem bloqueio de governança** | **SIM** | Redação relida: bloqueiam-se etapas que movem, dividem ou reorganizam `mercadolivre.ts` e `publicar/route.ts`. R2 reside em `canalServidor.ts`. O consumidor `publicar/route.ts` sofreria **apenas alteração de import** — precedente das Releases 007, 009 e 010 | Protocolo, Fase 1 |
| **C7** | Dependências identificadas | **SIM** | Plano: *"Dependências: nenhuma"*. Verificado: uma única dependência de tipo, de pacote, injetada por parâmetro | Mapeamento §7; Plano Executivo |
| **C8** | Consumidores por **busca no código** | **SIM** | 5 de produção, tabela §1.1. Nenhum de memória | Protocolo, Fase 1 — evidência obrigatória nº 2 |
| **C9** | **Estratégia de migração definida** | **NÃO** | **Ver §3 — o bloqueador desta Pré-Abertura** | Mapeamento §7; Plano Executivo |
| **C10** | **Linha de base mensurável** | **SIM** | 12 testes rastreados, blob `==HEAD`, execução nova: **12 pass · 0 fail**. Institucionalizada na Release 016 | Protocolo, Fase 1 |
| **C11** | Testes verdes | **SIM** | R2: 12/12 | Protocolo, Fase 2; Padrão RE, G2 |
| **C12** | Build íntegro | **N/A** | Não executado: a Pré-Abertura foi interrompida em C9 antes da validação funcional completa. Registrado como **não verificado**, não como aprovado | Protocolo, Fase 2 |
| **C13** | Evidências mínimas disponíveis | **SIM** | Plano: *"6 consumidores atualizados; build; auditoria de commit"* — obteníveis | Plano Executivo |
| **C14** | Riscos conhecidos | **SIM** | **Médio** — Matriz l. 324 e Plano | Mapeamento §7 |
| **C15** | Complexidade conhecida | **SIM** | **Média** | Plano Executivo |
| **C16** | Nenhuma decisão pendente | **NÃO** | **Ver §3.3** — a estratégia registrada depende de decisão inexistente | Governança §5, §10 |
| **C17** | Uma responsabilidade por migração | **SIM** | Escopo: exclusivamente R2. O arquivo é integralmente R2 | Protocolo, princípios 4 e 5 |

**Resultado: 14 SIM · 2 NÃO · 1 N/A.**

---

## 3. O bloqueador — C9 e C16

### 3.1 A estratégia registrada nomeia um construto que não existe

O Mapeamento, §7 matriz l. 324, registra:

> `R2 Vínculo do canal | canalServidor.ts | Integration / Connection (infra) | **Mover atrás de porta** | Médio | 6 consumidores`

**Evidência sobre o construto "porta":**

| Verificação | Resultado |
|---|---|
| Ocorrências de *Porta* / *Portas* em `constitution/`, `organization/`, `modules/` | **ZERO** |
| Portas implementadas em `src/modules/*/ports/` | **ZERO** — os 4 módulos contêm apenas `.gitkeep` |
| ADR ou RFC especificando portas | **NENHUM** |
| Origem da camada `ports/` | Release 002, que criou **cinco camadas por módulo** sem especificar o conceito |

**A estratégia é nomeada, não especificada.** Executá-la exigiria decidir o que é uma
porta neste projeto, qual sua interface, e como os 5 consumidores passariam a depender
dela — decisões de design que **nenhum documento institucionalizado fornece**. R2 seria a
**primeira porta do Zion OS**, estabelecendo precedente para os quatro módulos.

### 3.2 O Plano Executivo omite o campo Estratégia para R2

Comparação entre entradas do mesmo documento:

| Responsabilidade | Campo *Estratégia* |
|---|---|
| R10 | *"mover arquivo inteiro; atualizar 5 importadores"* |
| R13 | *"dividir de R11/R12; mover a parcela de composição para Publication"* |
| R12 | *"mover e separar de R13"* |
| **R2** | **ausente** |

O critério **C9** lê duas fontes. Uma nomeia estratégia não especificada; a outra **não
registra estratégia alguma**. **Nenhuma das duas define estratégia executável.**

### 3.3 O destino designa a infraestrutura de um agregado não implementado

O destino registrado é **"Integration — Connection (infraestrutura)"**.

A arquitetura do módulo Integration define **Connection** como **agregado raiz** (l. 144):
*"a ponte de um cliente específico com um canal… Guarda a custódia das credenciais, a
validade e a saúde da ponte, com seu ciclo de vida"*, com máquina de estados própria
(l. 159).

**Evidência sobre a implementação:**

`src/modules/integration/` contém **apenas `domain/`** — R11 e R12, quatro arquivos de
código. **Zero arquivos** em `application/`, `ports/`, `adapters/` e `infrastructure/`.
**Connection não existe como implementação.**

**Precedente institucional direto.** O Plano Executivo bloqueia duas responsabilidades por
razão idêntica:

- **R14** — *"além do bloqueio, seu destino exige que o **Operation Center exista como
  implementação**, o que hoje não ocorre."*
- **R16** — *"o módulo `identity-access` **não existe** em `src/modules/`."*

R2 pertence à mesma classe: seu destino nomeia um **agregado não implementado**, e sua
estratégia exige um **construto não especificado**.

### 3.4 A tensão documental, registrada

| Fonte | O que registra sobre os pré-requisitos de R2 |
|---|---|
| **Plano Executivo** | *"Pré-requisito — CONCLUÍDO (Release 016): linha de base local"* — **e apenas isso**. Nenhuma menção a porta ou a Connection |
| **Mapeamento** | Estratégia *"Mover atrás de porta"*; destino *"Connection (infraestrutura)"* |

Ambos residem em `engineering/` — **mesma precedência**. O Plano declara expressamente que
seu *"fundamento de toda classificação"* é o Mapeamento; logo o Mapeamento **informa** o
Plano, e a omissão do Plano **não revoga** a estratégia registrada.

A Governança determina: *"Documento de maior precedência prevalece, **e o conflito é
registrado**."* Não havendo diferença de precedência, resta o registro — feito aqui.

### 3.5 O que **não** é o bloqueador

Registro explícito, para que o impedimento não seja lido como mais amplo do que é:

- **Não é falta de linha de base.** Existe, está institucionalizada e verde: 12/12.
- **Não é bloqueio de governança de gestão.** A redação nomeia dois arquivos; nenhum é de R2.
- **Não é acoplamento.** Uma única dependência, de tipo, injetada por parâmetro.
- **Não é dificuldade técnica.** Ver §3.6.

### 3.6 A migração de localização seria o caso mais limpo do backlog

Constatação registrada **sem que constitua autorização**:

`canalServidor.ts` importa **um único símbolo, de pacote** (`@supabase/supabase-js`) — não
há caminho relativo a reapontar. O teste importa `./canalServidor.ts` e dois *builtins* do
Node. Um `git mv` dos dois arquivos, mantidos no mesmo diretório, produziria
**R100 em ambos** — sem uma única linha alterada nos arquivos movidos.

Nenhuma migração anterior teve essa propriedade nos dois arquivos simultaneamente. **A
dificuldade de R2 não é técnica; é de definição de escopo.**

---

## 4. Verificação do Protocolo — Fase 1

### 4.1 Execução

| # | Verificação | Resultado | Evidência |
|---|---|---|---|
| **P1** | Localizada no Mapeamento | **Sim** | §2 e §7 relidos |
| **P2** | Bloqueios confrontados **pela redação exata** | **Sim** | Bloqueio de gestão não alcança R2 — §4.3 |
| **P3** | Existência de linha de base verificada | **Sim** | 12 testes rastreados, verdes |
| **P4** | **Todos** os consumidores por busca no código | **Sim** | 5 de produção; nenhum de memória |

### 4.2 Critérios de aprovação e interrupção — Fase 1

| Condição | Redação literal | Verificado |
|---|---|---|
| **Aprovação** | *"Nenhum bloqueio vigente a alcança **e** existe linha de base mensurável."* | **SATISFEITA** |
| **Interrupção** | *"Um bloqueio a alcança; ou não existe linha de base."* | **NÃO ACIONADA** |

**Constatação relevante:** os **dois critérios literais da Fase 1 estão satisfeitos**. O
impedimento **não vem da Fase 1 do Protocolo** — vem dos critérios **C9** e **C16** do
Checklist, e da seção de bloqueadores.

### 4.3 Bloqueio de gestão — leitura

*"Bloqueadas as etapas que **movem, dividem ou reorganizam** `mercadolivre.ts` e
`publicar/route.ts`."* R2 reside em `canalServidor.ts` — não nomeado. O consumidor
`publicar/route.ts` sofreria **apenas alteração de linha de import**, distinção já
estabelecida pelo Plano para R11 e aplicada nas Releases 007, 009 e 010.

### 4.4 Ressalva sobre C3

O módulo `integration` **existe** com suas cinco camadas — C3 é **SIM**. Mas o **agregado**
que o destino nomeia (Connection) **não existe como implementação**, e a camada `ports/`
**nunca recebeu um arquivo**. C3 verifica a existência do **módulo**, não do **agregado** —
por isso o achado consta de §3.3, não de C3.

---

## 5. Bloqueadores

| Categoria | Situação | Evidência objetiva |
|---|---|---|
| **Técnico** | **Ausente** | Uma dependência, de pacote, injetada; linha de base 12/12; `git mv` produziria R100 em ambos os arquivos |
| **Arquitetural** | **PRESENTE** | Estratégia *"Mover atrás de porta"* nomeia construto com **zero especificação** e **zero implementações**; destino nomeia agregado (**Connection**) **não implementado** |
| **Governança** | **PRESENTE** | Nenhum ADR especifica portas nem autoriza escopo alternativo. A Governança veda alteração normativa sem ADR aprovado |
| **Operacional** | **Ausente** | Linha de base institucionalizada e reproduzível; árvore consistente no escopo |

**Bloqueadores identificados: 2 — arquitetural e de governança.**

### 5.1 Registrado, não classificado como bloqueador

| Constatação | Por que não bloqueia |
|---|---|
| O Mapeamento registra **6 consumidores**; a busca encontra **5** de produção | O sexto é referência em comentário — divergência **D2**, já registrada. O erro é conservador |
| `docs/zion-os/engineering/avaliacao-arquitetural-r15.md` está **não rastreado** | Artefato da missão anterior, alheio a R2. Registrado como pendência de institucionalização |
| O cabeçalho de `canalServidor.ts` atribui o código a **R3** | Achado **A1** da Release 016, registrado e não corrigido |

---

## 6. Parecer

# NÃO ELEGÍVEL

**Regra de decisão aplicada**, na redação do Checklist:

> *"**NÃO ELEGÍVEL** decorre de qualquer reprovação, de qualquer bloqueador registrado, ou
> de qualquer critério não verificado."*

Há **duas reprovações** (C9 e C16), **dois bloqueadores** (arquitetural e de governança) e
**um critério não verificado** (C12). *"Um único `NÃO` reprova. Não há compensação entre
critérios."*

---

## 7. Justificativa

**Mapeamento.** A estratégia registrada para R2 é *"Mover atrás de porta"*. O construto
**porta** não é definido em nenhum documento arquitetural — zero ocorrências em
`constitution/`, `organization/` e `modules/` — e nunca foi implementado: a camada `ports/`
dos quatro módulos contém apenas `.gitkeep` desde a Release 002. Executar a estratégia
exigiria **inventar** o conceito.

**Plano Executivo.** Omite o campo *Estratégia* para R2 — presente em R10, R13 e R12.
Nenhuma das duas fontes que o critério C9 consulta define estratégia executável.

**Arquitetura do módulo.** O destino nomeia **Connection**, agregado raiz do Integration
com ciclo de vida próprio. `src/modules/integration/` contém apenas `domain/`; **Connection
não existe como implementação**. O Plano bloqueia **R14** e **R16** por razão idêntica —
destino que exige implementação inexistente.

**Governança.** Definir o que é uma porta no Zion OS, e se R2 deve ou não passar por uma,
é **alteração normativa**: estabelece precedente para os quatro módulos. A Governança
determina que *"nenhuma alteração normativa ocorre sem ADR aprovado"*. Não existe ADR.

**Protocolo.** Os dois critérios literais da Fase 1 **estão satisfeitos** — nenhum bloqueio
de gestão alcança R2 e existe linha de base mensurável. **O impedimento não é do Protocolo**;
é de definição de escopo, que o Checklist verifica em C9 e C16.

### 7.1 O que este parecer não afirma

Não afirma que R2 seja tecnicamente difícil — é o contrário: seria a migração mais limpa
já executada, com R100 nos dois arquivos e nenhuma linha alterada neles.

Não afirma que R2 deva esperar indefinidamente. Afirma que **existem dois escopos
materialmente diferentes** — mover para `infrastructure/`, ou mover **e** introduzir a
primeira porta do projeto — e que **nenhum documento institucionalizado autoriza escolher
entre eles**. Escolher unilateralmente seria criar arquitetura, não executá-la.

---

## 8. Impedimento — condição de reversão

**A abertura da Release 012 NÃO está autorizada.**

| Item | Estado |
|---|---|
| Parecer | **NÃO ELEGÍVEL** |
| Critérios | 14 SIM · 2 NÃO · 1 N/A |
| Bloqueadores | **2** — arquitetural e de governança |
| Branch criada | **Nenhuma** |
| Código alterado | **Nenhum** |
| Migração iniciada | **Não** |

**Condição de reversão — um ADR aprovado que decida o escopo**, entre pelo menos estas
possibilidades, que este documento **registra sem escolher**:

| Escopo | O que exigiria |
|---|---|
| **Movimento de localização** — `git mv` para `integration/infrastructure/`, sem porta | ADR declarando que a estratégia *"atrás de porta"* é forma-alvo futura, não escopo desta release. Executável de imediato, com R100 em ambos os arquivos |
| **Movimento com porta** — introduzir a primeira porta do Zion OS | ADR especificando o conceito de Porta para os módulos, sua interface e como os consumidores dependem dela |
| **Aguardar Connection** — migrar somente quando o agregado existir | ADR ou reclassificação alinhando R2 ao tratamento de R14 e R16 |

**Prognóstico registrado, não presumido:** eliminados C9 e C16, os demais 14 critérios
foram verificados nesta execução e nenhum depende do escopo escolhido — exceto C12, não
verificado. A reexecução tende a produzir `ELEGÍVEL`, mas **deverá ser executada na
íntegra**.

---

## Anexo — Matriz resumida

| Critério | Resultado |
|---|---|
| C1 · Identificada no Mapeamento | ✓ |
| C2 · Destino arquitetural definido | ✓ |
| C3 · Módulo de destino existe | ✓ |
| C4 · Prevista no Plano Executivo | ✓ |
| C5 · Estado permite migração | ✓ |
| C6 · **Sem bloqueio de governança de gestão** | ✓ |
| C7 · Dependências identificadas | ✓ |
| C8 · Consumidores identificados por busca | ✓ |
| C9 · **Estratégia definida** | **✗** |
| C10 · **Linha de base existente** | ✓ |
| C11 · Testes verdes | ✓ |
| C12 · Build íntegro | **não verificado** |
| C13 · Evidências mínimas disponíveis | ✓ |
| C14 · Riscos conhecidos | ✓ |
| C15 · Complexidade conhecida | ✓ |
| C16 · **Nenhuma decisão pendente** | **✗** |
| C17 · Uma responsabilidade por migração | ✓ |
| Protocolo · Fase 1 — critérios literais | ✓ satisfeitos |
| Bloqueadores registrados | **2** |
| **ELEGÍVEL** | **NÃO** |
