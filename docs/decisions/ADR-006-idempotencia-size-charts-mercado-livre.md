# ADR-006 — Idempotência das Size Charts do Zion no Mercado Livre

- **Status:** Proposto (acompanha o PR de idempotência das Size Charts)
- **Escopo:** Guias de tamanho (Size Charts) criadas **pelo próprio Zion** para o
  fluxo User Products do Mercado Livre.
- **Não escopo:** Compatibilidade com guias legadas / criadas fora do Zion (ver §7).

> **Como ler este documento.** As seções estão deliberadamente separadas para que
> qualquer engenheiro distinga **fato / contrato oficial** (§3) de **premissa
> operacional** (§4). Nada em §4 deve ser tratado como garantia da API. Se você
> vier consertar um bug meses depois, comece por §5 (riscos) e §6 (gatilhos de
> revisão).

---

## 1. Contexto

O fluxo User Products publica **um item por tamanho**, todos associados a uma
**Size Chart** (`SIZE_GRID_ID`). Até este PR, o Zion executava
`POST /catalog/charts` **incondicionalmente** a cada publicação.

Como o **nome** da guia é **determinístico** (`marca + família`, truncado em 60) e
o Mercado Livre impõe **nome único** por (vendedor, domínio, características), a
consequência era:

- **1ª publicação de um produto:** cria a guia, funciona.
- **2ª publicação do mesmo produto** (retry, republicação, reprocessamento):
  `400 chart_name_unavailable` → **a publicação quebra**.

O problema **não** é payload, rowId nem o Mercado Livre — é o **ciclo de vida** da
Size Chart dentro da integração: um recurso **persistente e reutilizável** estava
sendo tratado como efêmero. Este PR introduz **idempotência**: descobrir e
reutilizar a guia do Zion quando ela já existe; criar somente quando não existe.

---

## 2. Decisão arquitetural — Read Before Write

Adotou-se **Read Before Write** usando exclusivamente endpoints oficiais:

```
obterOuCriarGuia()
  ├─ POST /catalog/charts/search   (descoberta paginada; reutiliza se achar)
  └─ POST /catalog/charts          (cria SOMENTE se não existir)
        ↓
   GET /catalog/charts/{id}  →  rows[].id  →  createItem()      (INALTERADO)
```

**Por quê este padrão, e não alternativas:**

- **É o fluxo que a própria API sugere.** A documentação trata a Size Chart como
  recurso reutilizável ("get all size charts created by the user to use with other
  products") e expõe `search` como mecanismo de descoberta. O
  `chart_name_unavailable` é o mecanismo de deduplicação **do próprio ML** — ele
  empurra o integrador a reutilizar em vez de recriar.
- **Sem estado local.** Não cria tabela, cache, UUID nem timestamp. A "chave" é o
  **nome** — a mesma chave de unicidade que o ML já impõe.
- **Preserva a arquitetura validada (Marco M1).** Tudo **depois** da obtenção da
  guia (GET → `rows[].id` → `createItem`) permanece **byte-a-byte inalterado**. A
  única decisão adicionada é *"reutilizar"* vs *"criar"*.

A janela de corrida (duas execuções concorrentes do mesmo produto) é fechada
tratando `chart_name_unavailable` no `create` como **sinal de reutilização**:
rebusca e reusa a guia que a execução vencedora acabou de criar (ver §4/§5).

---

## 3. Contratos confirmados da API

> Fatos suportados por **documentação oficial** e/ou **validação em produção**
> (conta real Chinelaria, seller `2332812759`, domínio `SANDALS_AND_CLOGS`).

| # | Fato | Fonte |
|---|------|-------|
| 3.1 | O endpoint **`POST /catalog/charts/search`** existe e lista guias do vendedor. | Doc oficial + produção |
| 3.2 | Envelope de **sucesso** = **`{ paging, charts }`** (objeto; a lista está em `charts`, **não** em `results`). | Produção |
| 3.3 | Bloco **`paging`** presente com `total`, `offset`, `limit`. **`limit` default = 100**. | Produção |
| 3.4 | A busca retorna a **CLASSE inteira** (N guias), não uma única. Observado `total: 12` só para Feminino. | Produção |
| 3.5 | **`GENDER` é filtro OBRIGATÓRIO**; sem ele → `400 filters_validation_error / required_filter_missing`. | Produção |
| 3.6 | Cada item traz: `id`, `names`, `domain_id`, `site_id`, `type`, `seller_id`, `measure_type`, `main_attribute_id`, `attributes`, `rows`. | Produção |
| 3.7 | **`names`** é objeto indexado por site: `names["MLB"] = "<nome>"`. | Produção |
| 3.8 | O item da busca já traz **`rows[].id`** embutidos (ex.: `"3211594:1"`). | Produção |
| 3.9 | `POST /catalog/charts` valida de forma **assíncrona**; **não garante** `rows[].id` na resposta do POST. | Produção (M1) |
| 3.10 | **`GET /catalog/charts/{id}`** é a fonte oficial dos `rows[].id`. | Doc oficial + produção (M1) |
| 3.11 | Criar guia com nome já usado por outra "with the same characteristics" → **`chart_name_unavailable`**. | Produção (reproduzido) |
| 3.12 | **`main_attribute`** é campo oficial; valores válidos = os marcados como **`main_attribute_candidate`** na ficha do domínio. **`MANUFACTURER_SIZE`** é um valor válido. | Doc oficial |
| 3.13 | Envelope de **erro** = `{ error, message, status, errors:[{code,message}] }`. | Produção |

Referências: [Manage size guide (developers.mercadolivre.com.br)](https://developers.mercadolivre.com.br/en_us/size-guide) · [Create customized size charts (.ar)](https://developers.mercadolibre.com.ar/en_us/size-guide) · [Manage size chart (global-selling)](https://global-selling.mercadolibre.com/devsite/manage-size-chart) · [Validations](https://global-selling.mercadolibre.com/devsite/size-chart-validation).

---

## 4. Premissas operacionais

> **Nada aqui é contrato da API.** São decisões baseadas na **evidência atual**.
> Se qualquer uma mudar, ver §5 e §6.

### Premissa A — `main_attribute_id == "MANUFACTURER_SIZE"` como filtro anti-legado

A implementação só considera reutilizável uma guia cujo `main_attribute_id`
seja `"MANUFACTURER_SIZE"`, para ignorar guias legadas (criadas fora do Zion,
observadas com `BR_SIZE`).

- ✅ **O campo é oficial** (`main_attribute` / `main_attribute_candidate` — 3.12).
- ⚠️ **O uso como discriminador NÃO é contrato.** Não existe, na documentação,
  garantia de que `main_attribute_id` **identifique a origem** de uma guia. O
  filtro repousa em **três premissas não contratuais**:
  1. a API **ecoa** na busca o `main_attribute` enviado no create (echo fiel);
  2. o **Zion sempre cria** com `MANUFACTURER_SIZE` (verdade do nosso código, não
     da API);
  3. guias **legadas** usam outro valor — **observamos** `BR_SIZE` nas 12 guias da
     conta, mas o painel do ML **pode** escolher `MANUFACTURER_SIZE`.
- 📌 **Natureza:** decisão **operacional**, baseada nas evidências de hoje. O
  `main_attribute` é uma **escolha entre candidatos**, então diferentes guias
  podem legitimamente divergir nesse campo.

### Premissa B — comparação textual dos nomes

Antes de comparar, o nome passa por **normalização local**: `trim()` + colapso de
espaços internos/duplicados (`\s+` → um espaço). A comparação é **case-sensitive**
e **accent-sensitive**. A normalização é aplicada **dos dois lados** (nome desejado
e `names["MLB"]` retornado) e serve **apenas para reduzir falsos negativos**
(ex.: `"...Modare "` com espaço final). **O nome usado na criação não é alterado.**

- ⚠️ **Não existe documentação oficial** do Mercado Livre sobre como o nome é
  comparado para efeito de unicidade (`chart_name_unavailable`), especificamente:
  - **case sensitivity** — desconhecido;
  - **normalização Unicode** — desconhecido;
  - **acentuação** — desconhecido;
  - **trim / espaços** — desconhecido.
- O único sinal é a mensagem *"already in use in another chart with the same
  characteristics"*, e **"same characteristics" não é especificado**.
- 📌 **Natureza:** a normalização é uma **heurística local**, escolhida para
  maximizar acerto de reutilização, **não** um espelho documentado do algoritmo do
  ML.

---

## 5. Riscos conhecidos (permanecem)

> Somente riscos **reais e ainda abertos**. Riscos já resolvidos (envelope,
> presença de `names`, paginação existir) **não** são listados.

- **R-A1 — Echo do `main_attribute` não confirmado para guias nossas.** Se a busca
  **não** devolver `main_attribute_id: "MANUFACTURER_SIZE"` para uma guia criada
  pelo Zion, o filtro excluiria a **própria** guia → reuso nunca dispara → volta o
  `chart_name_unavailable`. Observável no 1º reuso (log `origem`).
- **R-A2 — Guia legada com `MANUFACTURER_SIZE`.** Uma guia não-Zion com esse
  `main_attribute` + mesmo gênero + nome colidindo (normalizado) seria reutilizada
  indevidamente. Baixíssimo (o nome determinístico separa), mas não excluído.
- **R-A3 — Mudança dos main attributes do domínio.** Se o ML alterar os
  `main_attribute_candidate` do domínio, ou parar de ecoar o valor enviado, o
  filtro perde validade.
- **R-B1 — Algoritmo de comparação textual do ML diverge do nosso.** Se a
  unicidade do ML for **mais frouxa** que a nossa (ex.: case/accent-insensitive)
  **e** o mesmo produto gerar nomes diferindo só por case/acento — o que o gerador
  determinístico **não** produz hoje — o `create` colidiria e a rebusca (mesma
  comparação estrita) não acharia → publicação falha. Não alcançável com nomes
  determinísticos; não excluído por contrato.
- **R-C1 — Contrato do `search` muda.** Envelope, `paging`, ou filtros
  obrigatórios (hoje `GENDER`) podem mudar sem aviso e quebrar a descoberta.
- **R-C2 — Paginação >100 não verificada em produção.** O laço `offset/limit`
  segue a convenção padrão do ML, mas **nenhuma classe da conta passa de 100 guias
  hoje** (Feminino: 12). O caminho multi-página é, por ora, **não testado
  empiricamente**.

---

## 6. Critérios para futura revisão

Revisitar esta implementação quando:

- **Surgir documentação oficial** sobre comparação textual de nomes (case /
  Unicode / acentos) → alinhar a normalização da Premissa B ao contrato real.
- **O contrato do `search` mudar** (envelope, `paging`, filtros obrigatórios) →
  atualizar a descoberta/paginação.
- **For necessário reutilizar guias legadas** (criadas fora do Zion) →
  substituir o filtro da Premissa A por uma estratégia de compatibilidade (outro
  PR; ver §7).
- **Surgirem novos modelos de Size Chart** (outros domínios/categorias com
  `main_attribute` diferente de `MANUFACTURER_SIZE`) → o filtro anti-legado
  precisará ser parametrizado por domínio.
- **Um vendedor cruzar 100 guias numa classe** → validar empiricamente a
  paginação (R-C2) com dados reais.
- **Os logs mostrarem `origem:"create"` para um produto sabidamente
  republicado** → sinal de que Premissa A (echo/filtro) ou B (comparação) falhou;
  investigar por `nomeComparado`, `candidatosEncontrados`, `paginasConsultadas`.

**Observabilidade de apoio:** o log `ml.guia` carrega
`publishId, chartId, origem, motivo, buscaStatus, candidatosEncontrados,
paginaAtual, paginasConsultadas, nomeComparado` — suficiente para diagnosticar
qualquer um dos riscos acima sem reproduzir localmente.

---

## 7. Escopo deliberadamente fora deste PR

Este PR **NÃO** resolve — e não deve ser interpretado como se resolvesse:

- **Reutilização de guias legadas** (criadas fora do Zion; observadas com
  `main_attribute_id = BR_SIZE`). São ignoradas de propósito.
- **Adaptação `BR_SIZE` ↔ `MANUFACTURER_SIZE`** (as guias legadas têm rows com
  atributo `SIZE`/`BR_SIZE`; o mapeamento do Zion é por `MANUFACTURER_SIZE`).
- **Migração** de guias existentes para o padrão Zion.
- **Cache** de `família → chartId` ou qualquer memoização.
- **Otimizações de performance** (ex.: curto-circuito entre itens da mesma
  publicação, busca por nome no servidor do ML).

Cada um desses é candidato a um **PR próprio**, com sua própria investigação de
contrato — não deve ser embutido aqui.
