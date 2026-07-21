# Avaliação Arquitetural — R15 · Montagem e disparo no cliente

> **Natureza.** Avaliação arquitetural. **Não decide, não altera, não executa.** Determina
> se uma premissa registrada no Plano Executivo permanece verdadeira.
>
> **Base de evidência:** commit `2e84bcb`. Nenhum arquivo foi alterado.

---

## 1. Escopo

O Plano Executivo registra, para R15, um pré-requisito de natureza distinta de todos os
demais do backlog:

> *"**Pré-requisitos:** linha de base local; **decisão sobre a mudança de camada
> (cliente→servidor) — não coberta por este plano**."*

Cinco migrações foram concluídas desde que essa premissa foi escrita — R9, R11, R10, R13 e
R12. Esta avaliação responde a uma única pergunta:

> **A premissa ainda é verdadeira?**

**Não avalia** se a mudança de camada é boa ideia, nem escolhe alternativa. Determina se a
condição registrada continua existindo.

---

## 2. Premissa original — evidência documental

### 2.1 Mapeamento Arquitetural

**Entrada de R15:**

- *"Finalidade: montar o pedido de publicação e chamar o servidor."*
- *"Arquivo: `services/publicacaoML.ts` (129 linhas)"*
- *"Dependências utilizadas: `mlPayload`, `mlUserProducts`, `canaisMarketplace`, `sessao`,
  `anunciosGerados`, `storageImagens` — **seis origens**"*
- *"Módulo destino: **Publication — Aplicação** (a composição da intenção não pertence à
  camada de apresentação)"*
- *"Acoplamento: **alto de saída**, **baixo de entrada**"*

**Matriz de migração, l. 320:**
`R15 Montagem no cliente | publicacaoML.ts | Publication / Aplicação | **Mover para servidor** | Médio-alto | 6 dependências de saída`

**§3 Responsabilidades misturadas, M4:**

> *"`publicacaoML.ts` reúne composição da intenção e disparo de transporte, com seis
> dependências de saída, **executando fora do servidor**."*

**§6 Classificação de código, l. 303:**

> *"**Orquestração:** R14, R15."*

### 2.2 Plano Executivo

> *"**Por que NÃO pode migrar ainda:** sem teste próprio; o Mapeamento registra alto
> acoplamento de saída (6 dependências) e estratégia de **mover para o servidor**, o que
> **ultrapassa uma migração de localização**."*
> *"**Dependências:** R12, R13."*
> *"**Risco:** Médio-alto · **Complexidade:** Alta"*

### 2.3 Governança

| Artefato | Menções a R15 | Menções à mudança de camada |
|---|---|---|
| `ADR-007` | **0** | 1 — uso genérico do termo *camada*, não sobre R15 |
| `ADR-008` | **0** | **0** |
| `RFC-001` | **0** | **0** |
| `revalidacao-arquitetural-adr-007` | **0** | **0** |

**Nenhum artefato de governança trata da mudança de camada de R15.**

### 2.4 A motivação arquitetural, em síntese

Citando apenas as fontes: R15 **mistura** composição da intenção com disparo de transporte
(**M4**), **executa fora do servidor**, tem **alto acoplamento de saída**, e sua estratégia
registrada é **mover para o servidor** — o que o Plano qualifica como algo que
*"ultrapassa uma migração de localização"*.

---

## 3. Estado arquitetural atual — evidência produzida nesta missão

**Arquivo:** `src/lib/services/publicacaoML.ts` — **129 linhas** ·
SHA-256 `a65ad79152765dc0…`

### 3.1 Símbolos

| Símbolo | Linha | Natureza |
|---|---|---|
| `montarPreviewML` | 44 | **público** — composição **pura**, delega a `montarItemML` |
| `publicarNoML` | 68 | **público** — `async`, orquestração com E/S |
| `OpcoesPublicacao` | 36 | tipo público |
| `ResultadoPublicacao` | 57 | tipo público |
| `num` | 15 | interno — parsing numérico |
| `dadosProduto` | 26 | interno — deriva preço/estoque das variações |

### 3.2 Dependências — **seis**, como no Mapeamento, mas de natureza alterada

| Dependência | Localização atual | Natureza |
|---|---|---|
| `montarItemML` | **`modules/integration/domain/mlPayload`** | **pura** — R12, migrada na Release 010 |
| `montarBundleUserProducts` | **`modules/publication/domain/composicaoConteudo`** | **pura** — R13, migrada na Release 009 |
| `buscarCanal` | `lib/services/canaisMarketplace` | E/S — usa `supabase/client` |
| `cabecalhoAutenticacao` | `lib/supabase/sessao` | E/S — usa `supabase/client` |
| `marcarAnuncioPublicado` | `lib/services/anunciosGerados` | E/S — via `criarRepositorio` |
| `urlsDoProduto` | `lib/services/storageImagens` | E/S — usa `supabase/client` |

**`src/lib/supabase/client.ts` declara-se, na linha 1:** *"Cliente Supabase para uso no
**frontend**"* — usa `NEXT_PUBLIC_*` e a *anon key*. É infraestrutura de navegador,
**compartilhada por 15 arquivos**.

### 3.3 Consumidor e camada de execução

**Um único consumidor:** `src/app/esteira/aprovacoes/page.tsx`, cuja linha 1 é
`"use client"`. **R15 executa no navegador.**

Uso registrado:
- l. 342 — `montarPreviewML(registro, { pictures: pics })` → **dry-run local**
- l. 143 — `publicarNoML(preview, true)` → publicação real

### 3.4 Divisão de trabalho com o servidor

`src/app/api/ml/publicar/route.ts`, **linha 3**:

> *"Recebe o payload **JÁ MONTADO pelo cliente** (o builder é puro e sem segredo) + …"*

E o cabeçalho do próprio `publicacaoML.ts`, linha 3:

> *"Dry-run é **100% local** (o builder é puro e sem segredo) → a equipe revisa o payload
> antes."*

**A composição no cliente é comportamento declarado e deliberado**, não acidente. O
servidor recebe o payload pronto, complementa a categoria, monta a guia de tamanhos quando
o modelo exige, e publica.

### 3.5 Camada prevista vs. camada atual

| | Camada |
|---|---|
| **Atual** | Navegador — `lib/services/`, importado por página `"use client"` |
| **Prevista pelo Mapeamento** | **Publication — Aplicação**, com estratégia *"Mover para servidor"* |

A arquitetura do módulo Publication descreve a camada de Aplicação como **Casos de Uso**,
que *"orquestram uma intenção de ponta a ponta"* (l. 80) e *"acolhem a intenção e
orquestram: obtêm o agregado, consultam as políticas…"* (l. 238).

---

## 4. Comparação — a premissa mudou?

| Pergunta da missão | Resposta por evidência |
|---|---|
| **A mudança cliente→servidor ainda é necessária?** | A **necessidade não foi reavaliada por nenhuma decisão**, e nada a eliminou: R15 continua executando no navegador, e a estratégia institucionalizada continua *"Mover para servidor"*, intocada no Mapeamento |
| **A arquitetura atual já resolve parcialmente?** | **Sim, parcialmente** — ver §4.1 |
| **Alguma Release anterior eliminou o problema?** | **Não.** Nenhuma das cinco migrações tocou `publicacaoML.ts` além de duas linhas de import |
| **Surgiu algum novo impedimento?** | **Sim** — ver §4.2 |

### 4.1 O que as migrações efetivamente mudaram

**Duas das seis dependências saíram do território legado.** `montarItemML` e
`montarBundleUserProducts` — as duas **puras** — agora vivem em `modules/`. As dependências
que o Plano registra para R15 (*"Dependências: R12, R13"*) estão, portanto,
**satisfeitas**.

**Consequência precisa:** o que resta acoplando R15 ao navegador é **exatamente a E/S** —
quatro dependências, três delas sobre um cliente Supabase declaradamente de *frontend*.

**O escopo da premissa estreitou.** Ela já não alcança a composição — que hoje é um
invólucro fino sobre funções já migradas e puras. Alcança apenas o **disparo**.

**A premissa estreitou; não desapareceu.**

### 4.2 Novo impedimento identificado

**O Mapeamento, §6 l. 303, classifica R14 e R15 na mesma categoria: *Orquestração*.**

| | R14 | R15 |
|---|---|---|
| Arquivo | `publicar/route.ts` | `publicacaoML.ts` |
| Camada de execução | **servidor** | **navegador** |
| Destino | Interface + OC + Integration | Publication — Aplicação |
| Estado | **Bloqueada** — *Governança + OC inexistente* | Não iniciada |
| Prioridade | *"Última"* | Média |

Mover R15 para o servidor a colocaria **no território que R14 ocupa hoje**: o servidor já
orquestra — determina categoria, monta a guia de tamanhos, decide entre modelo clássico e
User Products, publica. Existiriam dois orquestradores de publicação no servidor, ou seria
necessário fundi-los.

**R14 está bloqueada por duas condições** — o bloqueio de governança sobre
`publicar/route.ts` e a inexistência do Operation Center como implementação.

**Este impedimento não está registrado.** O Plano lista as dependências de R15 como
*"R12, R13"* — nada sobre R14. A relação existe no Mapeamento apenas como classificação
conjunta em *Orquestração*, sem que nenhum documento a explore.

---

## 5. Dependências — impacto restrito ou sistêmico?

| Dimensão | Evidência | Alcance |
|---|---|---|
| **Consumidores de R15** | **1** — `esteira/aprovacoes/page.tsx` | **Restrito** |
| **Dependências de saída** | **6** — 2 puras já migradas, 4 de E/S | Misto |
| **Infraestrutura das 3 dependências Supabase** | `supabase/client.ts`, *"para uso no frontend"*, **consumido por 15 arquivos** | **Sistêmico** |
| **Fronteira de módulo** | Destino Publication/Aplicação sobrepõe território de R14 | **Sistêmico** |
| **Injeção de dependências** | **Ausente** — as 4 dependências de E/S são importadas diretamente, não injetadas | **Sistêmico** |

### 5.1 A diferença decisiva em relação a R2

R2 pôde receber linha de base **sem alterar uma linha de produção** porque seu cliente de
persistência é **injetado por parâmetro**. R15 **importa diretamente** suas quatro
dependências de E/S. Isolá-las exige substituição de módulo — ou alteração da assinatura,
o que **não seria refatoração**.

**Conclusão de impacto:** a entrada de R15 é restrita (um consumidor); a **saída é
sistêmica**. Mover a camada não é operação local: alcança infraestrutura compartilhada por
15 arquivos e a fronteira entre dois módulos.

---

## 6. Alternativas arquiteturais

**Nenhuma é escolhida.** Registro para deliberação futura.

### Alternativa A — Migrar apenas de localização, preservando a camada

Mover `publicacaoML.ts` para `modules/publication/application/` **sem** movê-lo para o
servidor. Continua executando no navegador.

*Vantagens:* migração de localização pura; `git mv` aplicável; escopo restrito a 1
consumidor; destrava R15 imediatamente.
*Riscos:* contraria a estratégia registrada no Mapeamento (*"Mover para servidor"*);
mantém **M4** — mistura de composição e transporte — dentro de um módulo arquitetural,
tornando o problema menos visível.
*Compatibilidade:* parcial. O destino confere; a camada de execução, não.
*Impacto no Plano:* exigiria registrar que a estratégia mudou.
*Impacto em migrações futuras:* R14, quando desbloqueada, encontraria um orquestrador de
cliente já dentro de `modules/`.

### Alternativa B — Dividir R15: composição agora, disparo depois

`montarPreviewML` + `num` + `dadosProduto` migram para `modules/publication`; `publicarNoML`
permanece onde está até a decisão de camada.

*Vantagens:* a parte pura é testável e migrável hoje — suas dependências (R12, R13) já
estão migradas; **resolve M4 de fato**, separando composição de transporte; precedente
direto nas Releases 007 e 009.
*Riscos:* cria uma responsabilidade parcialmente migrada, estado que o backlog ainda não
teve; exige decidir se o remanescente continua sendo "R15".
*Compatibilidade:* alta com a arquitetura; média com o Plano, que trata R15 como unidade.
*Impacto no Plano:* exigiria desdobrar R15 em duas entradas.
*Impacto em migrações futuras:* reduz o que resta para a decisão de camada ao mínimo.

### Alternativa C — Mover R15 integralmente para o servidor, fundindo com R14

`publicarNoML` deixa de existir no cliente; a página chama diretamente a rota, que passa a
compor o payload.

*Vantagens:* elimina a duplicação de orquestração; alinha-se à estratégia registrada.
*Riscos:* **elimina o dry-run local**, comportamento declarado em duas fontes; depende de
R14, **bloqueada por duas condições**; é a alternativa de maior alcance.
*Compatibilidade:* alta com o destino; bloqueada pelo estado de R14.
*Impacto no Plano:* R15 passaria a depender de R14 — dependência hoje não registrada.
*Impacto em migrações futuras:* subordina R15 ao desbloqueio do Grupo C e à existência do
Operation Center.

### Alternativa D — Mover para o servidor como Caso de Uso independente

R15 vira um Caso de Uso em `modules/publication/application/` executado no servidor;
`publicar/route.ts` (R14) permanece como interface HTTP que o invoca.

*Vantagens:* respeita a arquitetura do módulo — Casos de Uso orquestram, a rota apenas
acolhe; não exige fundir com R14.
*Riscos:* exige substituir as 3 dependências de Supabase de navegador por equivalentes de
servidor — **alteração de comportamento, não refatoração**; o dry-run passaria a exigir
ida ao servidor.
*Compatibilidade:* alta com a arquitetura alvo; baixa com o Protocolo, que veda alterar
comportamento em refatoração.
*Impacto no Plano:* exigiria reclassificar R15 de Refatoração para outro tipo de release.
*Impacto em migrações futuras:* estabeleceria o padrão de Caso de Uso para o módulo.

### Alternativa E — Declarar R15 sem destino arquitetural imediato

Reclassificar R15 para o **Grupo D**, junto de R5 e R16 — responsabilidades cujo destino
depende de arquitetura ainda não especificada.

*Vantagens:* honesto quanto ao estado real; não força decisão prematura; encerra o Grupo B
sem pendência artificial.
*Riscos:* adia indefinidamente; `publicacaoML.ts` permanece fora de `modules/`.
*Compatibilidade:* total — é exatamente o critério do Grupo D.
*Impacto no Plano:* mover R15 de Grupo B para Grupo D.
*Impacto em migrações futuras:* nenhum imediato.

---

## 7. Governança

| Pergunta | Resposta | Evidência |
|---|---|---|
| **Exige ADR novo?** | **SIM**, para qualquer alternativa exceto E | A Governança §5 determina que *"nenhuma alteração normativa ocorre sem ADR aprovado"*. Definir a camada de execução de uma responsabilidade e resolver a sobreposição de fronteira com R14 são alterações normativas. O Plano declara a decisão *"não coberta"* — não existe autorização vigente |
| **Exige atualização de ADR existente?** | **NÃO** | Nenhum dos 4 artefatos de governança menciona R15 ou a mudança de camada. Não há decisão anterior a substituir |
| **Exige atualização do Plano Executivo?** | **SIM**, em qualquer alternativa | Todas alteram a entrada de R15 — estratégia, grupo, dependências ou desdobramento |
| **Exige atualização do Roadmap?** | **Depende** — A e B mantêm R15 na Release 011; C subordina-a ao Grupo C; E a remove do roadmap | — |
| **Nenhuma atualização é necessária?** | **NÃO** | Manter o estado atual perpetua uma pendência que o próprio Plano registra como não coberta |

**Observação sobre o Mapeamento.** Ele registra a estratégia *"Mover para servidor"*, mas
sua natureza é **factual** — descreve o que existe e o que se pretende, não autoriza. A
autorização é do ADR, que não existe.

---

## 8. Bloqueadores

| Categoria | Situação | Evidência |
|---|---|---|
| **Técnico** | **Presente** | Sem linha de base; as 4 dependências de E/S são importadas diretamente, **sem injeção** — diferentemente de R2. Isolá-las exige substituição de módulo |
| **Arquitetural** | **PRESENTE** | A camada de execução de R15 não está decidida. Seu destino (Publication/Aplicação = Casos de Uso) sobrepõe-se ao território de R14, classificada com ela como *Orquestração* pelo Mapeamento §6 |
| **Governança** | **Presente** | Nenhum ADR autoriza a mudança de camada. O Plano declara a decisão *"não coberta por este plano"* |
| **Operacional** | **Ausente** | Nada impede tecnicamente iniciar o trabalho; o repositório está limpo e a suíte verde |

**Bloqueador arquitetural: existe.** Não foi eliminado por nenhuma das cinco migrações.

---

## 9. Parecer

# A) A premissa arquitetural permanece válida

# R15 continua bloqueada até decisão arquitetural

**Justificativa, exclusivamente por evidência desta missão:**

**1. Nenhuma decisão foi tomada.** Os quatro artefatos de governança rastreados registram
**zero menções** a R15 e **zero** à mudança de camada. Não existe ADR, RFC ou deliberação.

**2. Nada moveu R15.** `publicacaoML.ts` permanece em `src/lib/services/`, importado por
uma página `"use client"`. Nenhuma das cinco migrações alterou mais que duas linhas de
import nesse arquivo.

**3. A estratégia institucionalizada é inalterada.** O Mapeamento continua registrando
*"Mover para servidor"* (l. 320) e *"executando fora do servidor"* (M4). Nenhuma release
tocou o Mapeamento.

**4. A divisão de trabalho cliente/servidor é a mesma.** A rota declara, na linha 3,
receber *"o payload JÁ MONTADO pelo cliente"*. O dry-run local é comportamento **declarado
em duas fontes**, não acidente — movê-lo é decisão de produto e arquitetura, não
refatoração.

**5. Um novo impedimento foi identificado.** O Mapeamento classifica **R14 e R15 juntas
como Orquestração** (§6, l. 303). R14 está **Bloqueada — Governança + OC inexistente**.
Mover R15 para o servidor a colocaria no território de R14. Esta relação **não está
registrada** em nenhum documento além dessa classificação conjunta.

**6. O impacto é sistêmico.** Três das quatro dependências de E/S usam
`supabase/client.ts` — declarado *"para uso no frontend"* e compartilhado por **15
arquivos**. E, diferentemente de R2, R15 **não recebe suas dependências por injeção**.

### 9.1 O que mudou — registrado, sem alterar o parecer

**O escopo da premissa estreitou.** As duas dependências puras de R15 — R12 e R13, as
mesmas que o Plano registra como suas dependências — **foram migradas** e hoje vivem em
`modules/`. O que resta acoplando R15 ao navegador é **exatamente a E/S**.

A premissa já não alcança a **composição**; alcança apenas o **disparo**. Isso não a
elimina: torna-a mais precisa, e torna a **Alternativa B** materialmente mais viável do que
era quando a premissa foi escrita.

---

## 10. Próximos passos

**Esta avaliação não os executa nem os recomenda.** Registra o que cada caminho exigiria.

| Se a decisão for | Primeiro passo |
|---|---|
| **Alternativa A ou B** | ADR autorizando a estratégia revista; depois engenharia de linha de base do escopo autorizado |
| **Alternativa C ou D** | ADR resolvendo a fronteira com R14 — que permanece bloqueada; a decisão pode ser inexequível antes do desbloqueio do Grupo C |
| **Alternativa E** | Atualização do Plano Executivo movendo R15 para o Grupo D, sem ADR — reclassificação factual, não normativa |

**Condição comum a A, B, C e D:** um **ADR aprovado**. A Governança não admite alteração
normativa sem ele, e o Plano declara a decisão não coberta.

**Estado do backlog após esta avaliação — inalterado:**

| Situação | Responsabilidades |
|---|---|
| Concluídas | R9 · R11 · R10 · R13 · R12 |
| Categoria A, prontas para Pré-Abertura | **R2** |
| Bloqueada por decisão arquitetural | **R15** |
| Bloqueadas por governança (Grupo C) | 8 |
| Sem destino arquitetural (Grupo D) | R5 · R16 |

**Constatação factual, sem recomendação:** **R2 é a única responsabilidade do backlog
inteiro que pode avançar hoje** sem decisão pendente, sem trabalho de engenharia prévio e
sem desbloqueio de governança.
