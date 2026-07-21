# Linha de Base — R12 · Montagem do payload no formato do canal

> **Natureza.** Registro de engenharia. Documenta a construção de uma linha de base.
> **Não é migração, não é Release, não altera arquitetura.**
>
> **Base de evidência:** commit `cf4b9fe`. Nenhum arquivo de produção foi modificado.
>
> **Princípio adotado:** a unidade de proteção é a **responsabilidade**, não o arquivo.
> R12 hoje vive em dois arquivos; a linha de base protege a responsabilidade inteira.

---

## 1. Objetivo

Construir linha de base suficiente para validar a futura migração de **R12**, hoje
classificada em **categoria C** — sem cobertura identificável — pela análise do Grupo B.

O Protocolo é a razão desta missão existir: *"sem linha de base mensurável, a migração
**não começa**."*

---

## 2. Delimitação da responsabilidade

R12 é a única responsabilidade que **atravessa dois arquivos**.

### 2.1 `src/lib/marketplaces/mlUserProducts.ts` — 105 linhas, 4 exports

Após a Release 009, **todo o arquivo é R12**.

| Elemento | Linha | Classificação |
|---|---|---|
| `montarItensUserProducts` | 60 | **símbolo público** — a responsabilidade |
| `OpcoesUserProducts` | 36 | **tipo público** — contrato de entrada |
| `VariacaoUP` | 25 | **tipo público** — usado no contrato |
| `EMPTY_GTIN_REASON_ID` | 21 | **constante pública** |

### 2.2 `src/lib/marketplaces/mlPayload.ts` — 138 linhas, 3 exports

| Elemento | Linha | Classificação |
|---|---|---|
| `montarItemML` | 67 | **símbolo público** — a responsabilidade |
| `listingTypeId` | 15 | **símbolo público** — compartilhado entre os dois arquivos |
| `OpcoesPayloadML` | 56 | **tipo público** — contrato de entrada |
| `MAPA_ATRIBUTOS_ML` | 20 | **helper interno** — tabela de tradução |
| `normalizar` | 38 | **helper interno** |
| `paraNumero` | 46 | **helper interno** |

### 2.3 Dependências e consumidores — obtidos por busca

| Símbolo | Consumidor externo |
|---|---|
| `montarItensUserProducts` | `src/app/api/ml/publicar/route.ts` |
| `montarItemML` | `src/lib/services/publicacaoML.ts` |
| **`VariacaoUP`** | **`src/modules/publication/domain/composicaoConteudo.ts`** — R13, migrada |
| `listingTypeId` | nenhum externo — consumido por `mlUserProducts.ts` (interno a R12) |
| `EMPTY_GTIN_REASON_ID` · `OpcoesUserProducts` · `OpcoesPayloadML` | nenhum externo |

**Dependências de saída:** `AnuncioGerado` (esteira de IA) e `Produto` — ver achado **A1**.

**Acoplamento interno de R12:** `mlUserProducts.ts` importa `listingTypeId` de
`mlPayload.ts`. A responsabilidade é internamente coesa entre os dois arquivos.

---

## 3. Superfície comportamental

Comportamentos que **precisam permanecer invariáveis** durante a futura migração.

### 3.1 `listingTypeId` — resolução do tipo de anúncio

| Entrada | Saída |
|---|---|
| contém `prem`, `pro` ou `gold_pro` *(sem distinção de caixa)* | `"gold_pro"` |
| qualquer outra, inclusive vazia | `"gold_special"` |

### 3.2 `montarItensUserProducts` — modelo User Products

**Entrada:** `OpcoesUserProducts`. **Saída:** um item por variação.

**Invariante central:** o item usa **`family_name`** e **nunca `title`** — o ML rejeita
`title` neste modelo. Todos os itens da família compartilham o mesmo `family_name`.

| Regra | Comportamento |
|---|---|
| Atributos sempre presentes | `BRAND`, `MODEL`, `GENDER` *(por `value_id`)* |
| `FOOTWEAR_TYPE` | apenas se `footwearTypeId` informado |
| `COLOR` | `corId` → `value_id`; senão `cor` → `value_name`; ausentes → sem atributo |
| `SIZE` e `SIZE_GRID_ID` | sempre |
| `SIZE_GRID_ROW_ID` | apenas se houver linha para o tamanho em `rowIdPorTamanho` |
| `GTIN` / `EMPTY_GTIN_REASON` | EAN não-branco → `GTIN` **aparado**; senão → `EMPTY_GTIN_REASON` com `EMPTY_GTIN_REASON_ID` |
| `SELLER_SKU` e `seller_custom_field` | apenas se `sku`; ausente não cria campo |
| `available_quantity` | `max(0, round(estoque))` — **nunca negativo** |
| Campos fixos do canal | `currency_id: BRL`, `buying_mode`, `condition: new`, `shipping` me2 com frete grátis, `sale_terms` com 2 entradas |
| `listing_type_id` | **delegado** a `listingTypeId` |

### 3.3 `montarItemML` — modelo clássico

**Entrada:** `OpcoesPayloadML`. **Saída:** um item com `variations`.

**Invariante central:** o item usa **`title`** *(truncado em 60)* e **nunca
`family_name`**. É o modelo oposto ao anterior — a distinção é a razão de R12 existir em
duas formas.

| Regra | Comportamento |
|---|---|
| Ficha técnica → atributos | id do `MAPA_ATRIBUTOS_ML` após normalizar *(trim, minúsculas, sem acento)*; sem mapeamento → `{ name, value_name }`, **nunca id inventado** |
| Pendências | valores com *"informação necessária"* são **descartados** |
| `SELLER_SKU` | `produto.sku` ou, na falta, `produto.codErp`; **não duplica** se já veio da ficha |
| `EMPTY_GTIN_REASON` | apenas se **nenhuma** variação tiver EAN |
| Variações | filtradas por `tamanho \|\| cor`; `attribute_combinations` com `SIZE`/`COLOR` |
| Estoque da variação | `max(0, round(paraNumero(estoque)))` — **nunca negativo** |
| Preço da variação | `paraNumero(preco)` ou, se zero, `produto.precoVenda` |
| Preço do item | `produto.precoVenda`; se zero, o **menor preço positivo** da grade; sem grade, permanece zero |
| Com variações | `item.variations` presente e `available_quantity` **ausente** na raiz |
| Sem variações | `available_quantity = max(1, estoque \|\| 1)` e `seller_custom_field` na raiz |

**Parsing numérico** (`paraNumero`): aceita `"59,90"` → `59.9` e `"1.234,56"` → `1234.56`.

---

## 4. Projeto da linha de base

**Dois arquivos de teste**, um ao lado de cada implementação, conforme a convenção do
projeto:

| Arquivo | Cobre | Testes |
|---|---|---|
| `src/lib/marketplaces/mlPayload.test.ts` | `listingTypeId`, `montarItemML` | **8** |
| `src/lib/marketplaces/mlUserProducts.test.ts` | `montarItensUserProducts` | **8** |

**Total: 16 testes.**

**Por que dois arquivos e não um.** A decisão é **deliberadamente neutra**. O Plano
Executivo ainda não determinou se R12 migrará como movimento integral, extração ou
estratégia híbrida — e essa decisão pertence à Pré-Abertura da Release 010, não a esta
missão. Manter os testes alinhados à estrutura de arquivos atual permite que cada um
acompanhe seu código **qualquer que seja a divisão escolhida**. Um arquivo único
presumiria que R12 migra como bloco indivisível.

**Independência de R13 — exigência cumprida.** Nenhum dos 16 testes importa
`montarBundleUserProducts` nem qualquer símbolo de `modules/publication/domain`. As
entradas são construídas localmente por *fixtures* próprias em cada arquivo.

---

## 5. Execução

| # | Verificação | Resultado |
|---|---|---|
| **E1** | `mlPayload.test.ts` | **8 tests · 8 pass · 0 fail** |
| **E2** | `mlUserProducts.test.ts` | **8 tests · 8 pass · 0 fail** |
| **E3** | Suíte completa | **231 tests · 231 pass · 0 fail · 0 skipped** |
| **E4** | Build | **`✓ Compiled successfully in 24.2s`**, exit 0 |
| **E5** | Arquivos de produção modificados | **0** |
| **E6** | `mlUserProducts.ts` e `mlPayload.ts` — hash vs `HEAD` | **IDÊNTICOS** |

A suíte do projeto cresceu de **215** para **231** — exatamente os 16 testes acrescidos.

### 5.1 Símbolos protegidos

| Símbolo | Protegido | Como |
|---|---|---|
| `listingTypeId` | **Sim** | Teste dedicado + delegação verificada nos dois builders |
| `montarItensUserProducts` | **Sim** | 8 testes cobrindo todos os ramos de atributo e item |
| `montarItemML` | **Sim** | 7 testes cobrindo atributos, variações, preço e ramos raiz |
| `EMPTY_GTIN_REASON_ID` | **Sim** | Asserção de identidade no atributo gerado |
| `OpcoesUserProducts` · `VariacaoUP` · `OpcoesPayloadML` | **Sim** | Compilação — construídos estruturalmente pelas *fixtures* |
| `MAPA_ATRIBUTOS_ML` · `normalizar` · `paraNumero` | **Sim** | Indiretamente, pela superfície pública — mutações confirmam |

**Cobertura funcional: 7 de 7 símbolos públicos + 3 helpers internos**, estes por via
indireta comprovada.

---

## 6. Validação por mutação

Executada em **cópia isolada** no diretório temporário. O código de produção **nunca foi
tocado** — hash idêntico ao de `HEAD` verificado depois.

| # | Mutação | Detectada |
|---|---|---|
| 1 | `listingTypeId` inverte `gold_pro`/`gold_special` | **Sim** — 3 falhas |
| 2 | `title` deixa de ser truncado em 60 | **Sim** |
| 3 | `marca` deixa de mapear para `BRAND` | **Sim** |
| 4 | `normalizar` deixa de remover acentos | **Sim** |
| 5 | Pendência *"informação necessária"* deixa de ser filtrada | **Sim** |
| 6 | `EMPTY_GTIN_REASON` com id errado | **Sim** |
| 7 | **Piso zero do estoque em `montarItemML`** | **Não** → ver §6.1 |
| 8 | `family_name` vira `title` *(quebra do invariante central)* | **Sim** |
| 9 | `GENDER` passa a usar `value_name` em vez de `value_id` | **Sim** |
| 10 | `COLOR` deixa de preferir `corId` | **Sim** |
| 11 | `SIZE_GRID_ROW_ID` passa a ser sempre adicionado | **Sim** |
| 12 | EAN deixa de ser aparado | **Sim** |
| 13 | Piso zero do estoque em `montarItensUserProducts` | **Sim** |
| 14 | `seller_custom_field` deixa de ser preenchido | **Sim** |

**Resultado da primeira rodada: 13 de 14.**

### 6.1 A lacuna encontrada — e fechada

A mutação **7** sobreviveu: remover o `Math.max(0, …)` do estoque das variações em
`montarItemML` **não quebrou nenhum teste**. O caso de estoque negativo estava coberto em
`montarItensUserProducts`, mas **não** em `montarItemML`.

**Correção aplicada à linha de base** — nenhuma alteração de produção: o teste de variações
passou a incluir uma variação com `estoque: "-5"` e `preco: "0"`, assertando
`available_quantity === 0` e o *fallback* de preço para `produto.precoVenda`.

**Remutação após a correção:**

| Mutação | Detectada |
|---|---|
| Piso zero do estoque em `montarItemML` | **Sim** |
| *Fallback* de preço da variação para `produto.precoVenda` | **Sim** |

**Resultado final: 14 de 14 detectadas** — mais uma mutação adicional que a correção
passou a cobrir.

### 6.2 Evidência ambígua descartada durante a mutação

A remutação do *fallback* de preço reportou inicialmente **NÃO DETECTADA**. Investigada:
o comando `sed` falhou com `unterminated s command` — o `||` do padrão colidiu com o
delimitador `|` do meu laço, e **a mutação nunca foi aplicada**. Refeita com substituição
literal, com verificação explícita de que o arquivo mudou antes de rodar os testes:
**detectada**.

*Fundamento:* *evidência ambígua não é evidência*. Nona aplicação do princípio.

---

## 7. Limitações conhecidas

**L1 — O conteúdo integral de `MAPA_ATRIBUTOS_ML` não é asserido.** A tabela tem 16
entradas; os testes verificam `marca → BRAND`, `tipo de calçado → FOOTWEAR_TYPE` e o
comportamento de fallback para atributo não mapeado. Uma alteração isolada em, por exemplo,
`material → MATERIAL` **não seria detectada**.

*Mitigação para a futura migração:* se R12 migrar por movimento de arquivo, a similaridade
100% cobre os dados; se migrar por extração, o SHA-256 do bloco cumpre a mesma função —
como ocorreu nas Releases 007 e 009. **Os dados são cobertos pela evidência de preservação;
o comportamento, por estes testes.**

**L2 — Os helpers internos não têm teste direto.** `normalizar`, `paraNumero` e
`MAPA_ATRIBUTOS_ML` são exercitados pela superfície pública. As mutações 3, 4 e as duas de
parsing confirmam que regressões neles são percebidas.

**L3 — Tipos são protegidos por compilação, não por asserção de runtime.**
`OpcoesUserProducts`, `VariacaoUP` e `OpcoesPayloadML` não existem em tempo de execução;
uma alteração incompatível quebra o build dos testes que os constroem.

**L4 — A linha de base não cobre a interação entre R12 e seus consumidores.**
`publicar/route.ts` e `publicacaoML.ts` não possuem testes próprios. A migração deverá
apoiar-se em *diff do consumidor* e *build*, como nas Releases 007, 008 e 009.

**L5 — Não foi avaliado se os dois builders deveriam compartilhar código.**
`montarItemML` e `montarItensUserProducts` repetem os mesmos `sale_terms`, `shipping`,
`currency_id` e `buying_mode`. Os testes **registram essa duplicação como comportamento
atual**, conforme o critério de registrar o que o código faz, não o que deveria fazer.

---

## 8. Achados registrados — não corrigidos

**A1 — Import não utilizado em `mlPayload.ts`.**
*Constatação:* a linha 12 declara `import type { Produto } from "../types";`. `Produto`
**não aparece em nenhum outro ponto do arquivo** — o campo `produto` de `OpcoesPayloadML`
é tipado inline.
*Decisão:* **não corrigido.** A missão veda alterar imports, e removê-lo modificaria
produção.

**A2 — Literal `"17055160"` duplicado.**
*Constatação:* `mlUserProducts.ts` l. 21 o define como `EMPTY_GTIN_REASON_ID`;
`mlPayload.ts` l. 87 o repete **hardcoded**, sem importar a constante.
*Decisão:* **não corrigido.** Ambos são R12 e migrarão juntos; unificá-los é alteração de
implementação, vedada nesta missão.
*Cobertura:* os testes assertam o valor nos **dois** caminhos, de modo que uma divergência
futura entre eles seria detectada.

**A3 — `VariacaoUP` é consumido por R13, já migrada.**
*Constatação:* `modules/publication/domain/composicaoConteudo.ts` importa `VariacaoUP` de
`lib/marketplaces/mlUserProducts.ts`.
*Decisão:* registro factual. Consequência conhecida e declarada da Release 009.
*Relevância:* quando R12 migrar, este import precisará ser reapontado — **um consumidor a
mais** do que os dois de produção.

---

## 9. Parecer técnico

# ✓ LINHA DE BASE SUFICIENTE

**Fundamentação, exclusivamente por evidência produzida nesta execução:**

**Mensurabilidade.** 16 testes, 16 aprovados, números reexecutáveis. A suíte do projeto
passou de 215 para 231.

**Verdes antes de qualquer migração.** 16/16 e 231/231; build exit 0.

**Cobertura da superfície da responsabilidade.** Os **7 símbolos públicos** de R12 estão
protegidos, nos dois arquivos que hoje a implementam — incluindo os dois **invariantes
centrais** que distinguem os modelos: `family_name` **sem** `title` no User Products, e
`title` **sem** `family_name` no clássico.

**Capacidade de detectar regressão.** **14 de 14 mutações detectadas**, após fechar a única
lacuna que a primeira rodada revelou. Este é o argumento decisivo: os demais critérios
provam que a linha de base **existe**; apenas este prova que ela **funciona**.

**Proporcionalidade.** R12 é classificada como risco **Médio** com 2 consumidores de
produção mais um consumidor de tipo criado pela Release 009. Dezesseis testes, todos os
ramos de decisão e prova de mutação são proporcionais.

**Comportamento preservado.** Nenhum arquivo de produção foi modificado — hash idêntico ao
de `HEAD` em ambos.

**Independência de R13.** Cumprida integralmente: nenhum teste importa símbolo de
`modules/publication/domain`.

> **Ressalva de escopo.** Este parecer atesta **exclusivamente** a suficiência da linha de
> base. **Não decide o tipo da futura migração** — movimento integral, extração ou híbrido —
> nem se R12 migrará em uma ou duas etapas. Essas decisões pertencem à Pré-Abertura da
> Release 010, que deverá determiná-las por evidência própria.

---

## 10. Estado resultante do Grupo B

| Resp. | Categoria antes | Categoria agora |
|---|---|---|
| **R12** | **C** — sem cobertura identificável | **A** — linha de base própria ✔ |
| R15 | C | C — inalterada |
| R2 | C | C — inalterada |

**Distribuição do backlog restante: 1 em A · 0 em B · 2 em C.**

Com R12 em categoria A, a **Release 010 deixa de estar bloqueada por ausência de linha de
base**. Restam R15 e R2, cujas estratégias já estão registradas na análise do Grupo B —
sendo R2 a mais barata e R15 a única com pré-requisito não técnico pendente.
