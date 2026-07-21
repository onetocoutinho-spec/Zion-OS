# Estratégia de Construção de Linhas de Base — Grupo B

> **Natureza.** Documento de engenharia. **Produz evidência e orienta o trabalho, mas não
> rege.** Não cria critério, fase, regra ou decisão. Não altera o Mapeamento, o Protocolo,
> o Plano Executivo, o Checklist nem a Governança.
>
> **Fundamento.** Levantamento direto do código em `4f3913b` (pós-Release 007) e artefatos
> institucionalizados. Toda afirmação abaixo tem evidência verificável.

---

## 1. Objetivo

Responder a uma pergunta de engenharia, não de arquitetura:

> **Como construir linha de base para responsabilidades que ainda não a possuem, quando
> elas compartilham arquivo com outras responsabilidades?**

O Protocolo de Migração é categórico: *"sem linha de base mensurável, a migração **não
começa**, pois não haveria como comprovar preservação."* Após a Release 007, o Grupo A está
esgotado e **as cinco responsabilidades restantes do Grupo B esbarram nessa exigência**. O
gargalo deixou de ser arquitetural.

Este documento **não constrói** linha de base alguma. Ele determina, com evidência, o que
cada responsabilidade tem hoje, o que falta, e qual o caminho mínimo até a suficiência.

---

## 2. Escopo

**Analisadas:** R10, R13, R12, R15, R2 — as cinco do Grupo B.

**Fora do escopo:** Grupo C (bloqueado por governança), Grupo D (sem destino
arquitetural), qualquer alteração de código, qualquer abertura de Release.

**Base de evidência:** `src/` na linha principal `4f3913b`; 29 arquivos de teste;
Mapeamento Arquitetural; Plano Executivo; Protocolo de Migração.

---

## 3. Responsabilidades analisadas

### 3.1 R10 — Conhecimento de medidas por marca

| Item | Evidência |
|---|---|
| **Arquivo** | `src/lib/data/tabelasMedidas.ts` — 290 linhas |
| **Símbolos públicos** | `PADRAO_BR`, `TABELAS_MARCA`, `COMO_MEDIR`, `MODELOS_PADRAO`, `medidasDaMarca`, `montarTabelaMedidas` + 3 interfaces (`LinhaMedidaLite`, `TabelaClienteLite`, `ResultadoTabela`) |
| **Símbolos internos** | Nenhum símbolo privado relevante identificado |
| **Dependências de saída** | **Zero imports.** Arquivo folha |
| **Consumidores reais** | **4** — `mlUserProducts.ts` (`medidasDaMarca`), `contexto.ts` e `cliente/produtos/page.tsx` (`montarTabelaMedidas`), `cliente/medidas/page.tsx` (`MODELOS_PADRAO`) |
| **Testes próprios** | **Nenhum** |
| **Cobertura indireta** | **Parcial** — `medidasDaMarca` é chamada por `montarBundleUserProducts` (l. 233), coberta pelos **7 testes** de `mlUserProducts.test.ts` |

### 3.2 R13 — Composição do conteúdo pretendido

| Item | Evidência |
|---|---|
| **Arquivo** | `src/lib/marketplaces/mlUserProducts.ts` — `montarBundleUserProducts` (l. 238) |
| **Símbolos públicos** | `montarBundleUserProducts`, `BundleUserProducts`, `ResultadoBundle` |
| **Dependências de saída** | `normalizarTamanho` (R9, **já migrada**), `medidasDaMarca` (R10), tipo `AnuncioGerado` |
| **Consumidores reais** | **1** de produção — `publicacaoML.ts`; **1** de teste |
| **Testes próprios** | **7 testes diretos** em `mlUserProducts.test.ts` — caminho feliz, medida por marca, falha sem marca, gênero ausente, marca pendente, sem variação válida, dedup |
| **Cobertura indireta** | Não aplicável — cobertura é direta |

### 3.3 R12 — Montagem do payload no formato do canal

| Item | Evidência |
|---|---|
| **Arquivos** | `mlUserProducts.ts` — `montarItensUserProducts` (l. 90) · `mlPayload.ts` — `montarItemML`, `listingTypeId` |
| **Símbolos públicos** | `montarItensUserProducts`, `montarItemML`, `listingTypeId`, `OpcoesUserProducts`, `VariacaoUP`, `OpcoesPayloadML` |
| **Dependências de saída** | `mlPayload` ← `mlUserProducts` (`listingTypeId`); tipos `AnuncioGerado` e `Produto` |
| **Consumidores reais** | `montarItensUserProducts` ← `publicar/route.ts`; `montarItemML` ← `publicacaoML.ts`; `listingTypeId` ← `mlUserProducts.ts` (uso interno de R12) |
| **Testes próprios** | **Nenhum** |
| **Cobertura indireta** | **Nenhuma.** `montarBundleUserProducts` — a única função testada do arquivo — **não chama** `montarItensUserProducts` nem `listingTypeId` (verificado por leitura do corpo, l. 215–290) |

### 3.4 R15 — Montagem e disparo no cliente

| Item | Evidência |
|---|---|
| **Arquivo** | `src/lib/services/publicacaoML.ts` — 129 linhas |
| **Símbolos públicos** | `montarPreviewML`, `publicarNoML`, `OpcoesPublicacao`, `ResultadoPublicacao` |
| **Dependências de saída** | **Seis** — `mlPayload`, `mlUserProducts`, `canaisMarketplace`, `supabase/sessao`, `anunciosGerados`, `storageImagens` |
| **Consumidores reais** | **1** — `esteira/aprovacoes/page.tsx` |
| **Testes próprios** | **Nenhum** |
| **Cobertura indireta** | **Nenhuma** |

### 3.5 R2 — Persistência do vínculo do canal

| Item | Evidência |
|---|---|
| **Arquivo** | `src/lib/marketplaces/canalServidor.ts` — 81 linhas |
| **Símbolos públicos** | `lerCanalServidor`, `salvarRefreshTokenServidor`, `atualizarRefreshTokenServidor`, `CanalSecreto` |
| **Dependências de saída** | **Uma** — tipo `SupabaseClient` de `@supabase/supabase-js` |
| **Consumidores reais** | **5** rotas de API — `conectar`, `diagnostico-guias`, `importar-anuncios`, `publicar`, `vendas` |
| **Testes próprios** | **Nenhum** |
| **Cobertura indireta** | **Nenhuma** |

### 3.6 Divergências entre o Mapeamento e o código — registradas, não corrigidas

Três constatações factuais. **O Mapeamento não foi alterado por este documento.**

**D1 — R10: o Mapeamento registra 5 consumidores; o código mostra 4.** A lista inclui
`cliente/otimizar/page.tsx`, que **não importa** `data/tabelasMedidas`. Ele importa de
`services/tabelasMedidasCliente.ts` — arquivo distinto — e possui uma variável local
chamada `tabelasMedidas`. **Colisão de nome**, não consumo.

**D2 — R2: o Mapeamento registra 6 arquivos recebendo; o código mostra 5.** O sexto,
`services/canaisMarketplace.ts`, menciona `canalServidor.ts` **apenas em um comentário**
(l. 5). Menção não é dependência.

**D3 — Os caminhos do Mapeamento são nomes de arquivo, não caminhos completos.** Já
registrado como **E3** na Release 007. `tabelasMedidas.ts` reside em `src/lib/data/`, não
em `src/lib/marketplaces/`.

> As três divergências **reduzem** acoplamento estimado — nenhuma o aumenta. Nenhuma altera
> classificação de risco, grupo ou prioridade.

---

## 4. Linha de base atual — classificação

| Resp. | Categoria | Justificativa fundada em evidência |
|---|---|---|
| **R13** | **A** — possui linha de base própria | **7 testes diretos** sobre `montarBundleUserProducts`, cobrindo caminho feliz, quatro modos de falha e deduplicação. Executados nesta análise: **7 pass, 0 fail** |
| **R10** | **B** — apenas cobertura compartilhada | `medidasDaMarca` é exercitada indiretamente pelos 7 testes de R13 (chamada em `mlUserProducts.ts` l. 233). Os demais 5 símbolos públicos — incluindo `montarTabelaMedidas`, que tem 2 consumidores — **não possuem cobertura alguma**. Como a estratégia do Mapeamento é *"mover arquivo inteiro"*, a cobertura parcial não basta |
| **R12** | **C** — sem cobertura identificável | Nenhum teste direto. Verificado que a única função testada do arquivo (`montarBundleUserProducts`) **não invoca** `montarItensUserProducts` nem `listingTypeId`. `montarItemML` só é chamada por `publicacaoML.ts`, igualmente sem testes |
| **R15** | **C** — sem cobertura identificável | Nenhum teste. Único consumidor é uma tela |
| **R2** | **C** — sem cobertura identificável | Nenhum teste. Cinco consumidores, todos rotas de API |

**Distribuição: 1 em A · 1 em B · 3 em C.**

### 4.1 Constatação que reposiciona R13

**R13 já possui linha de base própria e suficiente.** O que a impede não é ausência de
evidência — é a dependência de R10 e o risco de dividir um arquivo entre dois módulos,
exatamente como o Plano Executivo registra: *"o Mapeamento classifica seu acoplamento como
alto — depende de R9 (✔ migrada), R10 (não migrada) ... e sua estratégia exige dividir o
arquivo entre dois módulos."*

Este documento **confirma** a classificação do Plano por outro caminho, e torna explícito
que **nenhum trabalho de teste é necessário para R13**.

---

## 5. Dependências

### 5.1 Entre responsabilidades

```
R9 (migrada) ──┐
               ├──> R13 ──> consumida por R15
R10 ───────────┘
R12 (mlPayload) ──> usada por R15
R12 (mlUserProducts) ──> usada por publicar/route.ts
R2 ──> usada por 5 rotas de API
```

- **R13 depende de R10** — chamada direta a `medidasDaMarca`. Dependência **real**,
  confirmada no código (l. 233).
- **R15 depende de R12 e R13** — importa `montarItemML` e `montarBundleUserProducts`.
- **R12 é internamente coeso entre dois arquivos** — `montarItensUserProducts` chama
  `listingTypeId`. A dependência é **dentro da própria responsabilidade**.
- **R10 e R2 não dependem de nenhuma outra responsabilidade.**

### 5.2 Dependências técnicas que impedem isolamento

| Resp. | Obstáculo ao isolamento | Gravidade |
|---|---|---|
| **R10** | **Nenhum.** Arquivo folha, zero imports, funções puras | — |
| **R13** | Nenhum para teste. Já isolado por 7 testes existentes | — |
| **R12** | **Nenhum técnico.** `montarItensUserProducts` e `montarItemML` são funções puras: recebem objeto, retornam objeto. Nenhuma E/S | — |
| **R15** | **Seis dependências de saída**, incluindo rede (`fetch` ao servidor), sessão Supabase e storage. Isolar exige substituir todas | **Alta** |
| **R2** | **Uma** dependência — `SupabaseClient`, injetado por parâmetro. Funções `async` | **Baixa** |

### 5.3 Constatação decisiva sobre R12

`montarItensUserProducts` e `montarItemML` **não realizam E/S**. Recebem opções e devolvem
um objeto. São tão testáveis quanto `normalizarTamanho` (R9) ou `precisaUserProducts`
(R11) — as duas responsabilidades já migradas com sucesso.

**A ausência de testes em R12 não decorre de dificuldade técnica.** Decorre de não terem
sido escritos.

### 5.4 Constatação decisiva sobre R2

`canalServidor.ts` recebe o cliente Supabase **por parâmetro**, não o constrói. Isso
significa que um substituto pode ser injetado sem qualquer alteração no código de
produção.

**E o repositório já contém um padrão provado para isso:**
`src/infrastructure/persistence/supabase/tests/repository.test.ts` define e **exporta** uma
classe `SupabaseFake` — *"Supabase fake em memória"* — usada por três arquivos de teste,
inclusive testes ponta a ponta.

> **Registro factual, sem interpretação:** o `SupabaseFake` existente implementa a
> interface `ClienteSupabase` do diretório `infrastructure/`, que **não é** a interface
> `SupabaseClient` de `@supabase/supabase-js` usada por `canalServidor.ts`. O **padrão** é
> reaproveitável; a **classe**, não diretamente. Esta análise **não avaliou** o custo de
> adaptação.

---

## 6. Estratégia de construção da linha de base

> **Fundamento comum.** O Protocolo exige *"linha de base mensurável"* (Fase 1), *"todos os
> testes passam antes da migração"* (Fase 2) e *"números idênticos à linha de base"*
> (Fase 5). O princípio 3 estabelece que *"a quantidade de evidências é proporcional ao
> risco"*. As estratégias abaixo aplicam esses critérios; **não criam nenhum outro**.

### 6.1 R10 — completar a cobertura de um arquivo folha

**Estratégia mínima.** Criar `tabelasMedidas.test.ts` ao lado da implementação, cobrindo os
símbolos hoje descobertos. `medidasDaMarca` já é exercitada indiretamente, mas a migração
move o arquivo inteiro — a cobertura precisa alcançar o que os 4 consumidores usam:
`medidasDaMarca`, `montarTabelaMedidas` e `MODELOS_PADRAO`.

**Por que é o caso mais fácil.** Zero dependências de saída. Funções puras sobre tabelas
constantes. Não requer substituto de nada.

**Evidências necessárias:** teste criado e verde antes da migração; números registrados;
build.

**Riscos:** **Baixo.** Escrever teste para função pura sem tocar produção.

**Critério de suficiência:** cada símbolo importado por algum consumidor real possui ao
menos uma asserção sobre valor de retorno, incluindo o caso de marca desconhecida.

### 6.2 R13 — nenhuma construção necessária

**Estratégia:** **nenhuma.** A linha de base existe e é suficiente: 7 testes, verdes,
cobrindo caminho feliz, quatro modos de falha e deduplicação.

**O que falta para R13 não é teste — é a migração de R10**, sua dependência registrada.

**Evidências necessárias na migração:** os mesmos 7 testes antes e depois; demonstração de
que a divisão não alterou lógica; build; auditoria de commit. Exatamente o que o Plano
Executivo já enumera.

**Riscos:** **Alto**, mas **não por cobertura** — pela divisão do arquivo entre dois
módulos, conforme o Mapeamento registra.

**Critério de suficiência:** já atingido.

### 6.3 R12 — testar duas funções puras

**Estratégia mínima.** Criar dois arquivos de teste, um por arquivo de origem:
`mlPayload.test.ts` (para `montarItemML` e `listingTypeId`) e testes de
`montarItensUserProducts` acrescidos ao arquivo existente de `mlUserProducts`.

**Ponto de atenção declarado.** Ambas as funções retornam `Record<string, unknown>`
destinado ao Mercado Livre. O valor da linha de base está em fixar **a forma do payload** —
presença e valor dos atributos que o canal exige. A Release 007 demonstrou que asserção
sobre valor de retorno é evidência suficiente para função pura.

**Evidências necessárias:** testes verdes antes; assinatura pública registrada; build.

**Riscos:** **Baixo-médio.** Técnico: baixo, são funções puras. O risco real é
**cobertura insuficiente** — um teste que verifique apenas dois campos do payload daria
falsa segurança na migração.

**Critério de suficiência:** o teste falha se qualquer atributo obrigatório do payload for
removido ou tiver seu valor alterado. Este é o critério que torna a linha de base capaz de
detectar regressão, e não apenas de existir.

### 6.4 R2 — injetar um substituto do cliente de persistência

**Estratégia mínima.** Criar `canalServidor.test.ts` que injete um substituto em memória do
`SupabaseClient` nas três funções, verificando: leitura de canal existente, leitura de
canal inexistente, gravação e atualização do token.

**Viabilidade demonstrada.** O cliente é recebido por parâmetro — nenhuma alteração de
produção é necessária. O repositório já prova o padrão em
`infrastructure/persistence/supabase/tests/`.

**Ponto de atenção declarado.** As três funções manipulam `refresh_token`. Os testes devem
usar valores fictícios; **nenhum segredo real pode entrar em arquivo de teste**.

**Evidências necessárias:** testes verdes antes; build; comportamento das três funções
registrado.

**Riscos:** **Médio.** Técnico baixo (injeção já disponível), mas o substituto precisa
emular fielmente o encadeamento de consulta do Supabase — um substituto complacente
passaria em testes que a implementação real reprovaria.

**Critério de suficiência:** as três funções públicas exercitadas em caminho feliz e no
caminho de ausência de registro, com asserção sobre o valor retornado e sobre o que foi
gravado.

### 6.5 R15 — a mais custosa, e a única com pré-requisito não técnico

**Estratégia mínima.** Duas partes, deliberadamente separadas:

1. **`montarPreviewML`** — aparenta ser composição pura; testável isoladamente.
2. **`publicarNoML`** — `async`, com seis dependências de saída, incluindo rede. Isolá-la
   exige substituir seis origens.

**Constatação registrada.** O Plano Executivo estabelece que R15 depende de *"decisão sobre
a mudança de camada (cliente→servidor) — **não coberta** por este plano"*. Construir linha
de base para `publicarNoML` **no formato atual** pode produzir evidência sobre um desenho
que a decisão pendente venha a descartar.

**Este documento não decide.** Registra que R15 é a única do Grupo B cujo trabalho de teste
pode ser invalidado por uma decisão ainda não tomada.

**Evidências necessárias:** o Plano já as declara *"a definir na Fase 1 da respectiva
migração"*. Nada a antecipar aqui.

**Riscos:** **Médio-alto**, conforme o Mapeamento.

**Critério de suficiência:** **não determinável** enquanto a decisão de camada não existir.
Constatação, não julgamento.

---

## 7. Ordem recomendada

### 7.1 A ordem atual continua sendo a melhor?

**Para as três primeiras — sim, demonstradamente. Para as duas últimas — há um motivo
técnico que merece registro.**

**R10 → R13 → R12 (Releases 008 → 009 → 010): confirmada por evidência.**

- **R10 primeiro** é o único encadeamento possível: R13 chama `medidasDaMarca`
  diretamente. Além disso, R10 é o caso mais barato — arquivo folha, zero dependências, com
  parte da cobertura já existente por via indireta.
- **R13 em seguida** porque, satisfeita a dependência, **nenhum trabalho de teste é
  necessário** — seus 7 testes já existem. É a única do Grupo B nessa condição.
- **R12 depois de R13** porque ambos dividem `mlUserProducts.ts`. O Plano registra:
  *"recomendável, para não dividir o mesmo arquivo duas vezes."* Confirmado.

**R15 → R2 (Releases 011 → 012): motivo técnico identificado.**

A ordem atual coloca **R15 antes de R2**. A evidência levantada aponta na direção
contrária, por três medidas independentes:

| Medida | R15 | R2 |
|---|---|---|
| Dependências de saída a substituir | **6** | **1** |
| Cliente externo injetado por parâmetro | Não | **Sim** |
| Padrão de substituto já provado no repositório | Não | **Sim** |
| Pré-requisito não técnico pendente | **Sim** — decisão de camada | Não |

**O motivo técnico é o último item.** R15 é a única responsabilidade do Grupo B cujo
trabalho de linha de base pode ser **invalidado por uma decisão que ainda não foi tomada**.
R2 não tem essa exposição: seu único pré-requisito é mecânico.

**Contra-argumento registrado, do próprio Mapeamento.** A prioridade de extração de R2 é
**baixa**: *"coeso e estável; mover cedo traria risco sem ganho proporcional."* Isso
sustenta mantê-la por último **na ordem de migração**.

### 7.2 A distinção que resolve a tensão aparente

**Construir linha de base não é migrar.** São duas atividades com custos, riscos e
pré-requisitos distintos:

- A **ordem de migração** é do Plano Executivo, e sua justificativa para R2 por último —
  baixa prioridade, alto acoplamento de entrada — permanece válida.
- A **ordem de construção de linha de base** é o objeto deste documento. Nada no Protocolo,
  no Plano ou no Checklist exige que as duas coincidam, e construir uma linha de base **não
  altera código de produção**.

Sob esse recorte, a sequência de **trabalho de teste** sugerida pela evidência é:

**R10 → (R13 dispensa) → R12 → R2 → R15**

R2 antes de R15 porque é mais barato, mais seguro e livre de decisão pendente. **A ordem de
migração do Plano permanece intocada** — este documento não a altera e não propõe alterá-la.

---

## 8. Riscos

| # | Risco | Tipo | Nível | Justificativa |
|---|---|---|---|---|
| **RS1** | **Linha de base complacente** — teste que passa mas não detectaria regressão | Cobertura | **Alto** | O maior risco do conjunto. Um teste de `montarItemML` que verifique dois campos daria falsa segurança na migração de R12. O Protocolo exige preservação *comprovada*, e uma linha de base fraca produz prova fraca |
| **RS2** | **Substituto de Supabase complacente** (R2) | Cobertura | **Médio** | Um substituto que não emule o encadeamento real de consulta passaria em testes que a implementação verdadeira reprovaria |
| **RS3** | **Trabalho invalidado por decisão pendente** (R15) | Arquitetural | **Médio-alto** | A decisão cliente→servidor pode descartar o desenho testado. Explicitamente fora do Plano |
| **RS4** | **Regressão durante a escrita dos testes** | Regressão | **Baixo** | Escrever teste não altera produção. Risco só existiria se a escrita "corrigisse" comportamento ao encontrá-lo estranho — vedado: o teste deve registrar o comportamento **atual**, não o desejado |
| **RS5** | **Divisão de `mlUserProducts.ts` em duas releases** (R13 e R12) | Técnico | **Médio** | O arquivo já foi tocado na Release 007. Duas divisões adicionais aumentam a chance de diff acidental. Mitigado pela auditoria de commit, que já interceptou incidente equivalente |
| **RS6** | **Acoplamento real menor que o mapeado** | Arquitetural | **Baixo** | D1 e D2 mostram que o Mapeamento **superestima** consumidores em dois casos. Superestimar acoplamento leva a excesso de cautela, não a risco |
| **RS7** | **Segredos em arquivo de teste** (R2) | Técnico | **Baixo** | `canalServidor.ts` manipula `refresh_token`. Mitigável integralmente com valores fictícios |
| **RS8** | **Cobertura indireta confundida com linha de base própria** (R10) | Cobertura | **Médio** | `medidasDaMarca` já é exercitada via R13. Tomar isso por suficiente deixaria `montarTabelaMedidas` — com 2 consumidores — sem prova alguma, num movimento de arquivo inteiro |

---

## 9. Critérios de suficiência

Derivados do Protocolo. **Nenhum critério novo.**

**C-S1 — Mensurabilidade.** A linha de base produz **números** — total, passou, falhou —
reexecutáveis de forma idêntica após a migração. *(Protocolo, Fases 2 e 5.)*

**C-S2 — Verdes antes.** Todos os testes passam **antes** de qualquer alteração. Um teste
já vermelho corrompe a linha de base. *(Protocolo, Fase 2 — critério de interrupção.)*

**C-S3 — Cobertura da superfície consumida.** Todo símbolo público efetivamente importado
por algum consumidor real possui ao menos uma asserção. Símbolos exportados sem consumidor
não exigem cobertura para fins de migração.

**C-S4 — Capacidade de detectar regressão.** O teste **falha** se o comportamento mudar.
Critério que separa linha de base real de linha de base decorativa, e que endereça RS1.

**C-S5 — Proporcionalidade ao risco.** Responsabilidade de risco maior exige mais
evidência. *(Protocolo, princípio 3 e Nota sobre proporcionalidade.)*

**C-S6 — Registro do comportamento atual, não do desejado.** O teste documenta o que o
código **faz**, não o que deveria fazer. Comportamento julgado incorreto é **registrado
como achado**, jamais corrigido junto — a Release 003 estabeleceu o precedente ao registrar
um comentário desatualizado sem corrigi-lo, para não ampliar o escopo.

---

## 10. Conclusões

**C1 — O gargalo é menor do que aparentava.** Das cinco responsabilidades do Grupo B,
**uma já está pronta** (R13, categoria A) e **uma tem parte do caminho andado** (R10,
categoria B). Três exigem trabalho do zero.

**C2 — R13 não precisa de trabalho de teste algum.** Seus 7 testes existem e são
suficientes. O que a bloqueia é a dependência de R10 — dependência real, confirmada no
código. Isto **confirma** a classificação do Plano Executivo por caminho independente.

**C3 — R10 e R12 são tecnicamente triviais.** Arquivo folha sem dependências (R10) e
funções puras sem E/S (R12). A ausência de testes não decorre de dificuldade — decorre de
não terem sido escritos. São do mesmo tipo de R9 e R11, ambas já migradas com sucesso.

**C4 — R2 é mais fácil do que sua posição no roadmap sugere.** Cliente injetado por
parâmetro, uma única dependência, e um padrão de substituto **já provado no próprio
repositório**.

**C5 — R15 é a única com obstáculo não técnico.** Seis dependências de saída e uma decisão
arquitetural pendente que pode invalidar o trabalho. É a única cujo critério de suficiência
**não é determinável hoje**.

**C6 — O maior risco não é técnico, é de complacência.** RS1 e RS8: uma linha de base que
existe mas não detecta regressão é pior do que nenhuma, porque autoriza uma migração sem
prova real. O critério **C-S4** existe para isso.

**C7 — O Mapeamento superestima acoplamento em dois pontos.** D1 e D2 reduzem consumidores
de R10 (5→4) e R2 (6→5). Registrado sem alterar o Mapeamento; o erro é conservador.

**C8 — A ordem de migração do Plano permanece adequada; a ordem de construção de linha de
base pode diferir.** São atividades distintas, e construir linha de base não altera código
de produção. A evidência sugere **R10 → R12 → R2 → R15** para o trabalho de teste, com R13
dispensada. **Nada no Plano Executivo foi alterado por esta análise.**

---

## Registro de método

Três verificações produziram evidência ambígua durante este levantamento e foram
**descartadas e refeitas**, conforme o princípio institucionalizado:

1. Contagem de consumidores por símbolo — o filtro de exclusão do arquivo de definição
   estava incorreto, inflando todos os números. Refeita listando arquivos explicitamente.
2. Consumidores de R10 — o padrão de busca por `import` perdeu a forma com extensão `.ts`
   usada por `mlUserProducts.ts`. Refeita buscando toda referência ao identificador, o que
   revelou tanto o consumidor perdido quanto a colisão de nome de D1.
3. Consumidores de R2 — a contagem incluía `canaisMarketplace.ts`. Inspeção da linha
   revelou tratar-se de **comentário**. Excluído.

**Nenhuma das três divergências correspondia a um problema real no código.**
