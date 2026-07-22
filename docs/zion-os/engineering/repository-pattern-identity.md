# Repository Pattern — Preservação de Identidade (`salvar`)

> **Natureza.** Contrato **oficial** do Repository Pattern do Zion, introduzido pela release
> **R-INF-001 — Repository Identity Preservation**. Genérico, sem relação com nenhuma feature.
> Formaliza o segundo modelo de identidade suportado pela infraestrutura de persistência.

---

## 1. Os dois modelos de identidade

A infraestrutura (`criarRepositorio`) passa a suportar **oficialmente** dois modelos:

| Modelo | Verbo | Autoridade da identidade |
|---|---|---|
| Identidade nasce na **persistência** | `criar(Omit<T,"id">)` | A **persistência** cunha o `id` (Supabase `gen_random_uuid()`; demo `prefixo-…`). |
| Identidade nasce no **domínio** | `salvar(T)` | O **domínio** — `salvar` **nunca** gera nem altera o `id`; apenas o registra. |

Ambos coexistem na mesma infraestrutura; nenhum consumidor existente é afetado.

## 2. Contrato comportamental de `salvar(entidade: T): Promise<T>`

| Aspecto | Definição |
|---|---|
| **Autoridade da identidade** | O domínio. `salvar` usa `entidade.id` como fornecido; nunca o gera nem o altera. |
| **Inserção** | Quando **não existe** linha com `entidade.id` → cria uma nova, **com o id fornecido**. |
| **Atualização** | Quando **já existe** linha com `entidade.id` → sobrescreve os campos mapeados. |
| **Conflito de identidade** | Caso esperado e determinístico → resolve como **UPDATE** (last-write-wins nas colunas fornecidas). **Nunca lança, nunca duplica.** |
| **Idempotência** | `salvar(e)` invocado N vezes ≡ 1 vez; **sempre exatamente 1 linha** para aquele `id`. Idempotente por construção (a chave é o id do domínio). |
| **Pré-condição** | `entidade.id` **não vazio** (o domínio já atribuiu identidade). Id ausente/vazio é uso incorreto — para "a persistência cunha o id", use `criar`. |
| **Pós-condição** | Existe exatamente 1 linha com `id = entidade.id`, contendo `paraBanco(entidade)`. |

### 2.1 Cláusulas explícitas sobre o retorno e a fonte de verdade

- **O retorno é a *representação persistida* da entidade, não necessariamente a instância
  recebida.** O chamador deve tratar **o valor retornado** como autoritativo (reflete defaults do
  servidor e normalizações do mapper). É o mesmo contrato de `criar`/`atualizar`, que já retornam
  `paraApp(row)`.
- **Os campos persistidos representados pelo mapper tornam-se a fonte de verdade** após a
  operação. Apenas o que `paraBanco` escreve é persistido; o que `paraApp` lê de volta é a verdade.
  Campos presentes na instância de entrada mas **não** mapeados **não** integram a verdade
  persistida.

## 3. Equivalência observável — Supabase × modo demo

A semântica **observável** é idêntica nos dois modos: mesma autoridade (domínio),
*insert-se-ausente / update-se-presente* por `id`, **1 linha por `id`**, last-write-wins.

| Modo | Mecanismo | Observável |
|---|---|---|
| **Supabase** | `upsert({ ...paraBanco(e), id: e.id }, { onConflict: "id" })` | `buscar(e.id)` → projeção persistida de `e` |
| **Demo (store)** | `upsertItem(colecao, e)` — `findIndex` por `id` → insere ou substitui | `buscar(e.id)` → `e` persistido |

**Diferença interna aceitável (documentada):** em conflito, o Supabase toca apenas as colunas do
payload — colunas gerenciadas pelo servidor **não mapeadas** em `T` (ex.: `created_at`) permanecem
intactas; o store demo não possui colunas fora de `T`. Isso **não altera** nenhum campo observável
de `T`. **Diferença comportamental: nenhuma.**

## 4. Superfície de API

- **Pública:** `criarRepositorio(...).salvar(entidade)` — parte oficial do contrato do Repository.
- **Interna:** `upsertItem` no `store.ts` — primitivo de infraestrutura (irmão de
  `createItem`/`updateItem`), consumido apenas pela camada de repositório.

## 5. Cenários de uso (além de qualquer feature específica)

Importações/integrações idempotentes usando o **id externo** como identidade (ex.: id de item do
marketplace → reimportar não duplica); migrações entre ambientes preservando ids; logs/auditoria
com id atribuído no domínio; ids gerados no cliente (offline-first); chaves naturais/determinísticas.

## 6. Compatibilidade e reversibilidade

- **Aditivo:** nenhum método existente muda; `salvar` é opcional; nenhum consumidor ou mapper
  precisa ser adaptado.
- **Rollback:** remover `salvar` (corpo + `return`) de `repositorio.ts`, `upsertItem` de `store.ts`
  e os testes. Como nada é obrigado a consumir `salvar`, a remoção não afeta nenhum domínio.

---

*R-INF-001 · infraestrutura compartilhada · evolução estritamente aditiva do Repository Pattern.*
