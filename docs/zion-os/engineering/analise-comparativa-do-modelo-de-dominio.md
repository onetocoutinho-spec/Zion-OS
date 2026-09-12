# Análise Comparativa do Modelo de Domínio — Zion OS

> **Natureza.** Análise de **domínio**, não de arquitetura. Compara o modelo de negócio da
> produção com o da Fundação. Não decide implementação, migração ou convergência.
>
> **Base de evidência:** `HEAD d2b0fe5`. Leitura direta dos tipos, agregados e rotas.
> Onde a evidência não bastou: **EVIDÊNCIA INSUFICIENTE**.

---

## 1. Objetivo

Responder, por evidência observável, a uma única pergunta:

> **Qual domínio representa corretamente o negócio atual do Zion OS?**

Separando três coisas que costumam se confundir: **diferença de modelagem** (forma técnica),
**diferença de implementação** (validação, representação) e **diferença real de negócio**
(o que o produto faz).

## 2. Escopo

Os conceitos de domínio de dois lados:

- **Produção:** `src/lib/types.ts`, serviços de `src/lib`, rotas de `src/app/api`.
- **Fundação:** agregados e value objects de `src/domain`.

Não é escopo: arquitetura, camadas, dependências — tratados em documentos anteriores.

## 3. Metodologia

- **Domínio de produção** inferido do que o sistema **executa**: tipos que persiste, regras
  que valida, rotas que expõe.
- **Domínio da Fundação** lido dos agregados e VOs.
- Comparação **conceito a conceito**, classificando cada divergência por sua **origem**
  (representação, validação, modelo, conceito, negócio).

Nenhum modelo teórico é usado como argumento.

---

## 4. Domínio da Produção

### 4.1 O conceito central — `Produto` (achatado, orientado a publicação)

`Produto` (`types.ts:98`) é uma estrutura **plana e operacional**, com ~30 campos:

| Dimensão | Campos | O que revela |
|---|---|---|
| **Identidade** | `id`, `clienteId`, `sku`, `codErp` | Produto por cliente |
| **Variação achatada** | `cor`, `tamanho` **no próprio produto** | Uma linha = uma combinação |
| **Preço operacional** | `custo`, `precoVenda`, `precoMinimo`, `margem`, `confiancaCusto` | Precificação com confiança |
| **Status por etapa** | `statusCadastro`, `statusSeo`, `statusDescricao`, `statusImagens`, `statusPrecificacao` | **Cinco status paralelos** — progresso num pipeline de publicação |
| **Canal** | `marketplace`, `categoriaMarketplaceSugerida` | **Marketplace acoplado ao produto** |
| **Composição** | `tipoProduto` (`simples/com_variacao/kit/combo/catalogo`), `componentes` | Classificação por **composição** |

### 4.2 Variantes — três estruturas paralelas

A produção **não** consolida variação num único lugar. Modela-a em **três tipos
especializados**, cada um para uma preocupação:

| Tipo | Arquivo | Preocupação |
|---|---|---|
| `ProdutoVariante` | `data/produtoVariantes.ts` | A variante do produto |
| `AnuncioVariante` | `data/anuncioVariantes.ts` | A variante **no anúncio** |
| `PrecificacaoVariante` | `data/precificacaoVariantes.ts` | A variante **no preço** |

### 4.3 O que o negócio de produção faz — 11 capacidades

As rotas de API são a evidência direta do negócio:
`agentes/esteira` · `agentes/executar` · `imagens/gerar` · `ml/autorizar` · `ml/conectar` ·
`ml/diagnostico-guias` · `ml/importar-anuncios` · `ml/publicar` · `ml/vendas` ·
`otimizar/worker` · `usuarios`.

**Leitura factual:** o negócio de produção é **publicar produtos no Mercado Livre com
assistência de IA** — cadastro, otimização (SEO/descrição/imagem), precificação e
publicação, mais importação de anúncios e leitura de vendas.

### 4.4 Regras que a produção **executa** sobre valores

| Valor | Regra em produção | Evidência |
|---|---|---|
| **EAN** | Remove não-dígitos (`replace(/\D/g,"")`); **não valida** comprimento nem dígito | 0 arquivos validam |
| **Dinheiro** | `number` float; sem restrição de sinal no tipo | `precoVenda: number` |
| **SKU** | Primitivo livre; **não normaliza** | 0 arquivos normalizam |

---

## 5. Domínio da Fundação

### 5.1 O conceito central — `ProdutoMestre` (normalizado, orientado a catálogo)

`ProdutoMestre` (453 linhas) é um **agregado canônico**:

| Dimensão | Como modela | Evidência |
|---|---|---|
| **Ciclo de vida** | **Um status linear**: `rascunho → enriquecido → pendente_aprovacao → aprovado → publicado → pausado → arquivado` (+ `reativar`) | máquina de estados `transicionar()` |
| **Variantes** | **Coleção no agregado** — `_variantes: Variante[]`, `adicionarVariante` | uma entidade, um lugar |
| **Preços** | `Map<string, Preco>` | preço por chave |
| **Versionamento** | `_versaoAtual`, `_versoes[]` | histórico de versões |
| **Origem** | `ModoOperacao`: `revenda` × `fabricacao_propria` | classificação por **origem** |
| **Eventos** | `_eventos: EventoDominio[]`, `puxarEventos()` | eventos de domínio |
| **Canal** | **1 referência** a marketplace | produto **separado** do canal |

### 5.2 Value Objects com regra de negócio

| VO | Regra que **encapsula** | Evidência |
|---|---|---|
| **`Ean`** | Comprimento 8/12/13/14 **e dígito verificador GTIN**; rejeita inválido | `ean.ts:20-38` |
| **`Dinheiro`** | Centavos inteiros; **não-negativo**; finito | `dinheiro.ts:11-19` |
| **`SkuOrigem`** | Trim, colapsa espaços, maiúsculas; rejeita vazio | `sku-origem.ts:12-16` |

### 5.3 O que a Fundação **não** modela

- **Status por etapa de publicação** (SEO/descrição/imagem/precificação) — **ausente**.
- **`marketplace` no produto** — deliberadamente separado.
- **Composição** (`kit`/`combo`/`catalogo`) — **ausente**.
- **IA / esteira / otimização** — **ausente**.

---

## 6. Comparação conceito a conceito

| Conceito | Produção | Fundação | Diferença | Mudança de comportamento | Compatível? |
|---|---|---|---|---|---|
| **Produto** | Plano, por combinação, marketplace acoplado, 5 status de pipeline | Agregado canônico, variantes coletadas, 1 status linear, versionado | **Escopo e forma** | Sim | **Não** — modelam facetas distintas |
| **Variante** | 3 tipos paralelos (produto/anúncio/preço) | 1 entidade no agregado | **Modelo** | Sim | Parcial |
| **EAN** | texto, sem validação | VO com validação GTIN | **Validação** | Sim — rejeita o que hoje passa | Não (drop-in) |
| **Dinheiro** | `number` float | centavos inteiros, não-negativo | **Representação + validação** | Sim | Não |
| **SKU** | texto livre | VO normalizado | **Validação + dado** | Sim | Não |
| **Versão** | **inexistente** | histórico versionado | **Conceito novo** | Sim | Conceito ausente em produção |
| **Origem (ModoOperacao)** | **inexistente** | revenda × fabricação | **Conceito novo** | — | Ausente em produção |
| **Composição (TipoProduto)** | kit/combo/catálogo | **inexistente** | **Conceito ausente na Fundação** | — | Ausente na Fundação |
| **Status de publicação** | 5 status por etapa | **inexistente** | **Conceito ausente na Fundação** | — | Ausente na Fundação |

---

## 7. Divergências — origem de cada uma (PASSO 4 e 5)

| Conceito | Acrescenta regra? | Elimina regra? | Altera contrato? | Conceito novo? | **Origem da divergência** |
|---|---|---|---|---|---|
| **Produto ↔ ProdutoMestre** | Sim (versão, origem) | Sim (status por etapa, composição) | Sim | Parcial | **Modelo + Negócio** — escopos distintos |
| **Variante** | Consolida | Separa 3 preocupações | Sim | Não | **Modelo** |
| **EAN** | **Sim** (GTIN) | Não | Sim | Não | **Validação** |
| **Dinheiro** | **Sim** (não-negativo) | Não | Sim | Não | **Representação + Validação** |
| **SKU** | **Sim** (normalização) | Não | Sim | Não | **Validação** |
| **Versão** | **Sim** | Não | Sim | **Sim** | **Conceito** |
| **ModoOperacao** | **Sim** | Não | — | **Sim** | **Negócio** |
| **TipoProduto / status de etapa** | — | Fundação não tem | — | Produção-exclusivo | **Negócio** |

**A divergência não é uniforme.** Há **três naturezas distintas**:

1. **Enriquecimento do mesmo conceito** — EAN, Dinheiro, SKU: mesmo conceito de negócio, a
   Fundação adiciona **validação real** que a produção não executa.
2. **Modelo diferente do mesmo escopo** — Variante: mesma coisa, forma diferente
   (consolidada × distribuída).
3. **Escopos de negócio diferentes** — ProdutoMestre é **catálogo canônico**; Produto é
   **item de pipeline de publicação**. Versão e Origem existem só de um lado; Status de
   etapa e Composição, só do outro.

---

## 8. Classificação por conceito

| Conceito | Classificação | Justificativa objetiva |
|---|---|---|
| **EAN** | **DOMÍNIO EVOLUÍDO** | Mesmo conceito (código de barras); a Fundação adiciona a regra GTIN que a produção não tem. Evolução clara do **mesmo** domínio |
| **Dinheiro** | **DOMÍNIO EVOLUÍDO** | Mesmo conceito (valor monetário); adiciona não-negatividade e precisão em centavos |
| **SKU** | **DOMÍNIO EVOLUÍDO** | Mesmo conceito; adiciona normalização determinística |
| **Versão** | **DOMÍNIO EVOLUÍDO** | Conceito que **enriquece** o mesmo produto (histórico); ausente em produção, mas não conflita |
| **ProdutoMestre ↔ Produto** | **DOMÍNIO ALTERNATIVO** | Modelam **facetas distintas** do negócio: catálogo canônico × item de publicação. Não é evolução linear de um no outro |
| **Variante** | **DOMÍNIO ALTERNATIVO** | Mesmo referente, modelos incompatíveis (1 agregado × 3 estruturas) |
| **ModoOperacao (origem)** | **DOMÍNIO ALTERNATIVO** | Dimensão de negócio (origem) que a produção não rastreia |
| **Listing** | **EVIDÊNCIA INSUFICIENTE** | A produção usa `AnuncioGerado`/`anuncios`; comparar exigiria mapear semântica de anúncio dos dois lados, não realizado aqui |
| **Status de publicação / TipoProduto** | **DOMÍNIO CONSOLIDADO na produção** | Conceitos que **só a produção** tem, exigidos pelo negócio real (11 rotas de publicação) — a Fundação não os modela |
| **Eventos de Domínio** | **EVIDÊNCIA INSUFICIENTE** | Mecanismo técnico; seu **valor de negócio** depende de consumidores que não existem |

**Nenhum conceito é DOMÍNIO OBSOLETO.** Nenhum lado perdeu aderência — cada um serve um
propósito que o outro não cobre.

---

## 9. Matriz de Evolução do Domínio

| Conceito | Domínio Atual | Domínio Fundação | Benefício observado | Risco observado | Estado | Convergência recomendada |
|---|---|---|---|---|---|---|
| **EAN** | texto sem validação | GTIN validado | Rejeita código de barras inválido | Rejeita entradas hoje aceitas | Evoluído | **AINDA NÃO** — depende de o negócio querer rejeitar EAN inválido |
| **Dinheiro** | float | centavos não-negativos | Precisão; sem preço negativo | Conversão float↔centavos | Evoluído | **AINDA NÃO** |
| **SKU** | texto livre | normalizado | Igualdade determinística de SKU | Altera o dado gravado | Evoluído | **AINDA NÃO** |
| **Versão** | inexistente | versionado | Histórico de produto | Sem consumidor atual | Evoluído | **SEM EVIDÊNCIA** de necessidade atual |
| **ProdutoMestre** | item de pipeline | catálogo canônico | Modelo normalizado | Escopo diferente do atual | Alternativo | **NÃO** — não substitui o produto de publicação |
| **ModoOperacao** | inexistente | revenda×fabricação | Classificação por origem | Sem uso atual | Alternativo | **SEM EVIDÊNCIA** |
| **Status de etapa** | 5 status paralelos | inexistente | Rastreia pipeline real | — | Consolidado (produção) | **N/A** — a Fundação teria de adicioná-lo |

**Padrão observável:** os **value objects** (EAN, Dinheiro, SKU) são os únicos candidatos a
convergência de domínio — porque são o **mesmo conceito enriquecido**. Os **agregados** são
modelos alternativos de **escopos diferentes**, não evoluções.

---

## 10. Evidências

| # | Evidência | Resultado |
|---|---|---|
| **EV1** | Produção versiona produtos? | **Não** — 0 campos de versão; migração 021 não usada por produção |
| **EV2** | Produção valida EAN (GTIN)? | **Não** — 0 arquivos |
| **EV3** | Fundação valida EAN? | **Sim** — algoritmo GTIN + comprimento |
| **EV4** | Produção tem status por etapa de publicação? | **Sim** — 5 campos |
| **EV5** | Fundação tem status por etapa? | **Não** — status linear único |
| **EV6** | Produção acopla marketplace ao produto? | **Sim** |
| **EV7** | Fundação separa produto de canal? | **Sim** — 1 referência a marketplace |
| **EV8** | `TipoProduto` (produção) = `ModoOperacao` (Fundação)? | **Não** — composição × origem, dimensões distintas |
| **EV9** | Produção consolida variantes? | **Não** — 3 estruturas paralelas |
| **EV10** | Negócio real da produção | Publicação ML + IA — 11 rotas de API |

---

## 11. Limitações

- **EVIDÊNCIA INSUFICIENTE** sobre `Listing` × `AnuncioGerado` — a comparação exigiria mapear
  a semântica de anúncio dos dois lados, não realizada.
- **EVIDÊNCIA INSUFICIENTE** sobre o **valor de negócio** dos Eventos de Domínio e do
  Versionamento — os conceitos existem; sua necessidade atual não é observável sem um
  consumidor.
- Não foi avaliada a **intenção** por trás da Fundação — só o que ela modela.
- A análise cobre os conceitos centrais; conceitos periféricos de ambos os lados podem não
  ter sido comparados.

---

## 12. Conclusão

Produção e Fundação **não são o mesmo domínio em maturidades diferentes**. A evidência mostra
**três relações distintas**, não uma:

1. **Nos value objects** (EAN, Dinheiro, SKU), a Fundação é uma **evolução legítima do mesmo
   conceito** — encapsula regras de negócio (código de barras válido, preço não-negativo,
   SKU normalizado) que a produção simplesmente **não executa**. A diferença aqui **é de
   negócio**, não de sofisticação: responder "o produto precisa de EAN válido?" é uma
   pergunta de domínio.

2. **No agregado de produto**, os dois modelam **escopos diferentes do negócio**:
   `ProdutoMestre` é um **catálogo canônico versionado**; `Produto` é um **item que flui por
   um pipeline de publicação no Mercado Livre**. Um tem versão e origem; o outro tem status
   por etapa, composição de kit e canal. **Nenhum é o outro amadurecido.**

3. **Em conceitos exclusivos de cada lado** (status de publicação e composição na produção;
   versão e origem na Fundação), a divergência é de **conceito de negócio** — cada lado
   rastreia o que seu propósito exige.

---

## Parecer final

**O domínio atualmente em produção continua sendo o domínio oficial do Zion OS?**
**SIM.** É o domínio que **executa o negócio real** — 11 rotas de publicação, IA e vendas
servem usuários hoje. Nenhum conceito de produção perdeu aderência.

**A Fundação representa uma evolução legítima do negócio?**
**PARCIALMENTE, e apenas em conceitos específicos.** Nos value objects (EAN, Dinheiro, SKU),
**sim** — são regras de domínio mais ricas sobre os **mesmos** conceitos. Nos agregados,
**não** — são um modelo **alternativo** de um escopo diferente (catálogo), não uma evolução
do escopo atual (publicação).

**A Fundação representa apenas uma modelagem mais sofisticada?**
**NÃO para os value objects** — eles codificam regras de negócio ausentes na produção, o que
é diferença de domínio, não de técnica. **PARCIALMENTE para os agregados** — a normalização
de `ProdutoMestre` é mais sofisticada, mas serve **outro escopo**, então não é "o mesmo
modelo melhor feito".

**Existem conceitos da Fundação que deveriam tornar-se o domínio oficial?**
**EVIDÊNCIA INSUFICIENTE para afirmar "deveriam".** A evidência mostra que os **value objects
são candidatos** — encapsulam regras que o negócio poderia querer (EAN válido, preço
não-negativo). Mas "deveria" é decisão de produto: depende de o negócio **querer** rejeitar
EAN inválido hoje, o que esta análise não decide.

**Existem conceitos da produção que devem permanecer inalterados?**
**SIM, por evidência.** O **status por etapa de publicação**, o **acoplamento produto↔canal**
e a **composição (kit/combo/catálogo)** sustentam o negócio real de publicação — 11 rotas
dependem deles, e a Fundação **não os modela**. Substituir o domínio de produção pelo da
Fundação **perderia** esses conceitos.

> **Síntese sustentada por evidência:** o domínio oficial do Zion OS é o **domínio de
> publicação** que opera hoje. A Fundação não o substitui — ela oferece **regras de valor
> mais ricas** (candidatas a enriquecer conceitos existentes) e um **modelo de catálogo
> alternativo** (que serviria um escopo que o produto ainda não opera). A convergência de
> domínio, se ocorrer, tem fundamento **apenas nos value objects**; nos agregados, seria
> adotar um **negócio diferente**, não evoluir o atual.

**Esta análise não recomenda convergir.** Estabelece, por evidência, **onde** haveria
evolução de domínio (value objects) e **onde** haveria troca de escopo de negócio
(agregados) — para que qualquer decisão futura distinga uma da outra.

---

*Produzido em 21 de julho de 2026 · `HEAD d2b0fe5` · sem alteração de código, domínio, banco
ou governança.*
