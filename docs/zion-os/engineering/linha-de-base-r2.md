# Linha de Base — R2 · Persistência do vínculo do canal

> **Natureza.** Registro de engenharia. Documenta a construção de uma linha de base.
> **Não é migração, não é Release, não altera arquitetura.**
>
> **Base de evidência:** commit `9d29094`. Nenhum arquivo de produção foi modificado.

---

## 1. Delimitação da responsabilidade

**R2 vive em um único arquivo.** A responsabilidade **não atravessa** mais de um arquivo —
diferentemente de R12, que atravessava dois.

**Arquivo:** `src/lib/marketplaces/canalServidor.ts` — 82 linhas ·
SHA-256 `e2c484850a72487549f709902666a17dff6966507379313e43a5ca6ab6cd5c93`

### 1.1 Exports

| Símbolo | Linha | Natureza |
|---|---|---|
| `CanalSecreto` | 16 | interface — contrato de leitura |
| `lerCanalServidor` | 24 | função `async` |
| `salvarRefreshTokenServidor` | 46 | função `async` |
| `atualizarRefreshTokenServidor` | 68 | função `async` |

### 1.2 Símbolos internos

| Símbolo | Linha | Valor |
|---|---|---|
| `PADRAO` | 13 | `"Mercado Livre"` — marketplace padrão das três funções |

### 1.3 Dependências

| Dependência | Natureza |
|---|---|
| `SupabaseClient` de `@supabase/supabase-js` | **tipo apenas**, l. 11 — **injetado por parâmetro**, nunca construído |

**Nenhuma outra dependência de saída.** O arquivo não importa nada do projeto.

### 1.4 Consumidores — obtidos por busca no código

**Cinco**, todos rotas de API, todos com alias `@/` sem extensão:

| Consumidor | Símbolos |
|---|---|
| `src/app/api/ml/conectar/route.ts` | `salvarRefreshTokenServidor` |
| `src/app/api/ml/publicar/route.ts` | `lerCanalServidor`, `atualizarRefreshTokenServidor` |
| `src/app/api/ml/vendas/route.ts` | `lerCanalServidor`, `atualizarRefreshTokenServidor` |
| `src/app/api/ml/importar-anuncios/route.ts` | `lerCanalServidor`, `atualizarRefreshTokenServidor` |
| `src/app/api/ml/diagnostico-guias/route.ts` | `lerCanalServidor`, `atualizarRefreshTokenServidor` |

`CanalSecreto` **não possui consumidor externo**.

> `src/lib/services/canaisMarketplace.ts` menciona `canalServidor.ts` **apenas em um
> comentário** (l. 5). Não é dependência — confirmado por leitura da linha.

### 1.5 Fronteiras da responsabilidade

R2 é a **única porta de leitura e escrita do vínculo do canal**. Sua fronteira é nítida:

- **Dentro:** montar consultas à tabela `canais_marketplace`, mapear o registro para
  `CanalSecreto`, traduzir erro do cliente em `Error`.
- **Fora:** obter o cliente de persistência (vem por parâmetro), autorizar o acesso (o RLS
  o faz, apoiado no token que o chamador injeta), decidir *quando* ler ou gravar.

---

## 2. Superfície comportamental

Somente comportamento **comprovado por leitura do código** e exercitado por teste.

### 2.1 `lerCanalServidor(supabase, clienteId, marketplace = "Mercado Livre")`

**Saída:** `Promise<CanalSecreto | null>`

| Regra | Comportamento |
|---|---|
| Tabela | sempre `canais_marketplace` |
| Colunas | exatamente `"refresh_token, seller_id, tipo_anuncio, ativo"` |
| Filtros | `cliente_id` **e** `marketplace`, nesta ordem |
| Cardinalidade | `maybeSingle()` — **ausência não é erro** |
| Erro | `throw new Error(error.message)` — a mensagem é preservada; o objeto de erro original **não** é propagado |
| Sem registro | devolve **`null`**, não lança |
| Mapeamento | `refresh_token → refreshToken` · `seller_id → sellerId` · `tipo_anuncio → tipoAnuncio` · `ativo → ativo` |
| **Padrões na leitura** | `tipoAnuncio ?? "Premium"` · `ativo ?? true` · `refreshToken ?? null` · `sellerId ?? null` |

### 2.2 `salvarRefreshTokenServidor(supabase, clienteId, refreshToken, marketplace = PADRAO, extra = {})`

**Saída:** `Promise<void>`

| Regra | Comportamento |
|---|---|
| Operação | `upsert` com `{ onConflict: "cliente_id,marketplace" }` |
| Linha gravada | `cliente_id`, `marketplace`, `refresh_token`, `ativo: true`, `atualizado_em` |
| **`ativo`** | **sempre `true`** — gravar reativa o canal |
| `atualizado_em` | ISO-8601 de `new Date().toISOString()` |
| `seller_id` | incluído **apenas** quando `extra.sellerId != null` — `undefined` e `null` são excluídos |
| Erro | `throw new Error(error.message)` |

### 2.3 `atualizarRefreshTokenServidor(supabase, clienteId, refreshToken, marketplace = PADRAO)`

**Saída:** `Promise<void>`

| Regra | Comportamento |
|---|---|
| **Guarda** | `if (!refreshToken) return;` — token vazio é **no-op total**: o cliente **não é chamado** |
| Operação | `update` com `{ refresh_token, atualizado_em }` |
| **`ativo`** | **não é tocado** — diferentemente da gravação inicial |
| Filtros | `cliente_id` **e** `marketplace` |
| Erro | `throw new Error(error.message)` |

### 2.4 Invariantes que a migração deverá preservar

1. **Nome da tabela** — `canais_marketplace`, nas três funções.
2. **Marketplace padrão** — `"Mercado Livre"`, nas três.
3. **Conjunto exato de colunas lidas** — quatro, nem mais nem menos.
4. **Ausência de registro é `null`, não exceção** — `maybeSingle`, não `single`.
5. **Os dois filtros sempre presentes** — remover `marketplace` faria a consulta atravessar
   canais.
6. **Assimetria deliberada entre gravar e rotacionar** — gravar marca `ativo: true`;
   rotacionar não toca `ativo`.
7. **Token vazio não chega ao banco.**
8. **Erros viram `Error` com a mensagem preservada.**

---

## 3. Projeto da linha de base

**Um arquivo de teste, ao lado da implementação:**
`src/lib/marketplaces/canalServidor.test.ts` — **12 testes**.

### 3.1 Neutralidade quanto à estratégia de migração

R2 ocupa **um único arquivo**. Um teste ao lado dele é a estrutura que **não antecipa
nada**: acompanha o código em movimento integral, em extração ou em qualquer outra
estratégia. **Esta engenharia não decide a estratégia da futura Release.**

### 3.2 Substituto do cliente de persistência

As três funções recebem o cliente **por parâmetro** — nenhuma o constrói. Isso permitiu
testá-las **sem alterar uma linha de produção**.

O substituto (`ClienteFake`) reproduz o construtor de consulta do Supabase, que é
**encadeável e aguardável ao mesmo tempo**: `.eq()` devolve a si mesmo, e o próprio objeto
resolve quando aguardado — necessário porque `update().eq().eq()` é aguardado diretamente,
sem `maybeSingle()`. Cada chamada é registrada com tabela, operação, colunas, linha,
opções, patch e filtros, permitindo asserção sobre **o que foi pedido ao banco**, não
apenas sobre o retorno.

### 3.3 Independência verificada

| Verificação | Resultado |
|---|---|
| Imports de `modules/` *(responsabilidades já migradas)* | **0** |
| Imports de pacotes externos | **0** — apenas `node:test` e `node:assert/strict` |
| Tipo do cliente | derivado por `Parameters<typeof lerCanalServidor>[0]` — **sem importar `@supabase/supabase-js`** |

A derivação do tipo a partir da própria assinatura é deliberada: mantém a linha de base
**reproduzível em ambiente sem dependências instaladas**, endereçando a limitação
registrada na Pré-Abertura da Release 010, quando um clone sem `node_modules` invalidou
uma medição.

**Nenhum segredo real é usado.** Todos os tokens dos testes são fictícios (`TG-fake-N`).

---

## 4. Testes

| # | Teste | Comportamento protegido |
|---|---|---|
| 1 | `lerCanalServidor` — tabela, colunas e filtros, com padrão | Nome da tabela, as 4 colunas, os 2 filtros, `maybeSingle` |
| 2 | `lerCanalServidor` — marketplace explícito | O parâmetro sobrepõe `PADRAO` |
| 3 | `lerCanalServidor` — registro mapeado campo a campo | Correspondência coluna → propriedade |
| 4 | `lerCanalServidor` — campos nulos recebem padrões | `"Premium"` e `true` |
| 5 | `lerCanalServidor` — sem registro devolve `null` | Ausência não é erro |
| 6 | `lerCanalServidor` — erro vira `Error` com a mensagem | Tradução do erro |
| 7 | `salvarRefreshTokenServidor` — upsert, chave de conflito e linha | `onConflict`, 5 campos, `ativo: true`, ISO |
| 8 | `salvarRefreshTokenServidor` — `seller_id` condicional | Três casos: informado, ausente, `null` |
| 9 | `salvarRefreshTokenServidor` — marketplace explícito e erro | Parâmetro e propagação |
| 10 | `atualizarRefreshTokenServidor` — patch e filtros | Exatamente 2 chaves no patch; **`ativo` intocado** |
| 11 | `atualizarRefreshTokenServidor` — token vazio é no-op | **Zero chamadas ao cliente**, mesmo com erro configurado |
| 12 | `atualizarRefreshTokenServidor` — marketplace explícito e erro | Parâmetro e propagação |

**Cobertura:** os **4 símbolos públicos** — 3 funções por asserção direta, `CanalSecreto`
por compilação e pelo `deepEqual` do teste 3. O símbolo interno `PADRAO` é protegido
indiretamente pelos testes 1, 7 e 10.

---

## 5. Build

`✓ Compiled successfully in 15.2s`, exit 0.

---

## 6. Suíte

| Execução | Resultado |
|---|---|
| Testes de R2 | **12 tests · 12 pass · 0 fail** |
| Suíte completa | **243 tests · 243 pass · 0 fail · 0 skipped** |

A suíte do projeto cresceu de **231** para **243** — exatamente os 12 testes acrescidos.

---

## 7. Validação por mutação

Executada em **cópia isolada** no diretório temporário. O arquivo de produção **nunca foi
tocado** — SHA-256 conferido depois, idêntico ao do PASSO 1.

| # | Mutação | Detectada |
|---|---|---|
| 1 | `PADRAO` deixa de ser `"Mercado Livre"` | **Sim** — 3 falhas |
| 2 | Nome da tabela alterado | **Sim** — 3 falhas |
| 3 | `select` perde a coluna `ativo` | **Sim** |
| 4 | Filtro por `marketplace` removido na leitura | **Sim** — 2 falhas |
| 5 | `maybeSingle()` vira `single()` | **Sim** — 6 falhas |
| 6 | Padrão de `tipoAnuncio` deixa de ser `"Premium"` | **Sim** |
| 7 | Padrão de `ativo` passa a ser `false` | **Sim** |
| 8 | Erro de leitura deixa de ser lançado | **Sim** |
| 9 | `upsert` deixa de marcar `ativo: true` | **Sim** |
| 10 | `onConflict` alterado | **Sim** |
| 11 | `seller_id` passa a entrar sempre | **Sim** |
| 12 | Guarda de token vazio removida | **Sim** |
| 13 | `update` passa a mexer em `ativo` | **Sim** |
| 14 | `update` perde o filtro de `marketplace` | **Sim** — 2 falhas |

**14 de 14 detectadas.** Nenhuma mutação sobreviveu; nenhuma correção da linha de base foi
necessária.

---

## 8. Achados registrados — não corrigidos

**A1 — O cabeçalho do arquivo atribui o código à responsabilidade errada.**
*Constatação:* a linha 1 declara `// Acesso ao canal de marketplace NO SERVIDOR (R3).`
O Mapeamento Arquitetural atribui este arquivo a **R2 — Persistência do vínculo do canal**;
**R3** é *Determinação de categoria do canal*, que reside em `mercadolivre.ts` (l. 134–144).
*Decisão:* **não corrigido** — é comentário, e alterá-lo modificaria produção e reduziria a
similaridade de uma futura migração.
*Impacto:* nulo sobre comportamento. Risco de leitura equivocada em auditoria futura.

**A2 — Comentários citam migrações de banco por número.**
*Constatação:* as linhas 6–7 referenciam *"equipe_total, migração 009"* e
*"cliente_escopo, migração 011"*.
*Decisão:* **não corrigido.** Registro factual: são **migrações de banco de dados**, não
Releases do Plano Executivo — a coincidência numérica com as Releases 009 e 011 é
acidental e pode confundir.

**A3 — `atualizado_em` depende do relógio do sistema.**
*Constatação:* `new Date().toISOString()` aparece em duas funções, tornando a saída
não-determinística.
*Decisão:* **não corrigido** — injetar um relógio alteraria a assinatura pública.
*Cobertura:* os testes assertam o **formato ISO-8601**, não o valor. Uma regressão que
trocasse o formato seria detectada; uma que trocasse o instante, não.

**A4 — `CanalSecreto` é exportado sem consumidor externo.**
*Constatação:* nenhum arquivo fora de `canalServidor.ts` referencia o tipo.
*Decisão:* registro factual. É o contrato de retorno de `lerCanalServidor`; sua exportação
é legítima ainda que não importada.

**A5 — O arquivo declara-se *server-only* sem mecanismo que o garanta.**
*Constatação:* a linha 9 adverte `⚠️ Server-only. Não importe em componentes do navegador.`
A garantia é **convencional**, não técnica: nenhuma diretiva impede o import no cliente.
*Decisão:* registro factual, sem proposta. A verificação de que os 5 consumidores são
rotas de API foi feita e **confirma** que a convenção está sendo respeitada hoje.

---

## 9. Evidências descartadas

**E1 — Cinco mutações reportadas como "não aplicadas".**
*Constatação:* na primeira rodada, 5 das 14 mutações não alteraram o arquivo, e o resultado
foi reportado como `??? NÃO APLICADA` — **não** como sobrevivência.
*Investigação:* o arquivo possui **terminadores CRLF** (`file` confirma:
*"with CRLF line terminators"*). Os padrões multilinha usavam `\n` e **não casavam** contra
`\r\n`.
*Decisão:* os cinco resultados foram **descartados** e as mutações refeitas com padrões
tolerantes a CRLF (`\r?\n`). **Todas as cinco foram detectadas.**
*Fundamento:* *evidência ambígua não é evidência*. Décima terceira aplicação do princípio.

**Registro de método.** Uma mutação que não se aplica **não é uma mutação que sobreviveu**.
Confundir as duas produziria falsa confiança — ou falso alarme — em direções opostas. A
distinção foi feita explicitamente pelo verificador, que compara o arquivo com o original
antes de executar os testes.

---

## 10. Parecer técnico

# ✓ LINHA DE BASE SUFICIENTE

**Fundamentação, exclusivamente por evidência produzida nesta missão:**

**Delimitação completa.** R2 ocupa um único arquivo, com 4 exports, 1 símbolo interno,
1 dependência de tipo injetada por parâmetro e 5 consumidores identificados por busca. A
fronteira da responsabilidade foi registrada.

**Mensurabilidade.** 12 testes, 12 aprovados, números reexecutáveis. A suíte do projeto
passou de 231 para 243.

**Verdes antes de qualquer migração.** 12/12 e 243/243; build exit 0.

**Cobertura da superfície.** Os **4 símbolos públicos** estão protegidos, incluindo os
**oito invariantes** da §2.4 — entre eles a assimetria deliberada entre gravar e rotacionar,
e o no-op de token vazio.

**Capacidade de detectar regressão.** **14 de 14 mutações detectadas**, sem nenhuma
sobrevivente e sem necessidade de corrigir a linha de base. Este é o argumento decisivo:
os demais critérios provam que a linha de base **existe**; apenas este prova que ela
**funciona**.

**Produção byte a byte idêntica.** SHA-256 `e2c48485…` antes e depois; blob `==HEAD`;
zero arquivos de produção modificados. O cliente injetado por parâmetro tornou
desnecessária qualquer alteração.

**Independência.** Zero imports de `modules/` e zero de pacotes externos. A linha de base é
reproduzível mesmo em ambiente sem dependências instaladas.

> **Ressalva de escopo.** Este parecer atesta **exclusivamente** a suficiência da linha de
> base. **Não institucionaliza** os artefatos, **não decide** a estratégia da futura
> migração e **não substitui** a Pré-Abertura, que deverá executar os 17 critérios do
> Checklist na íntegra.

---

## 11. Estado resultante

| Resp. | Categoria antes | Categoria agora |
|---|---|---|
| **R2** | **C** — sem cobertura identificável | **A** — linha de base própria ✔ |
| R15 | C | C — inalterada |

**Restante do backlog: 1 em A · 0 em B · 1 em C.**

**R15 passa a ser a última responsabilidade sem linha de base** do Grupo B — e a única do
backlog inteiro cujo pré-requisito **não é técnico**: a decisão sobre a mudança de camada
cliente→servidor, que o Plano Executivo declara **não coberta**.

**Próximo passo natural**, no padrão das Releases 014 e 015: institucionalizar esta linha
de base por release própria. Sem isso, a Pré-Abertura da migração de R2 reprovaria pelo
mesmo bloqueador operacional **B1** que reprovou a da Release 008.
