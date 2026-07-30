# DB-AUDIT-001 — O estado real do banco, conferido linha a linha

**Data:** 2026-07-29
**Projeto Supabase:** `ouynursknlgtmewcdjzr` (sa-east-1, ACTIVE_HEALTHY, Postgres 17.6)
**Branch:** `feat/copilot-lote-com-escopo-congelado` @ `ae6e329`
**Nada foi aplicado.** Toda alteração aqui é proposta; a aplicação é manual e do lojista.

> Existe um segundo projeto, `fivlziuvxvhpuibrjwlq` (`zion-os-staging`, INACTIVE).
> O `.env.local` aponta para `ouynursknlgtmewcdjzr` — é este que foi auditado.
> Staging está parado e **não** recebeu nenhuma das migrações 029–035.

---

## 1. Banco real

38 tabelas em `public`, todas com RLS ligado. As que importam:

| Tabela | Linhas | Papel |
|---|---:|---|
| `clientes` | 1 | o tenant único de hoje |
| `produtos` | 73 | o catálogo, só o que veio do ML |
| `produto_variantes` | 684 | a grade |
| `imagens_produto` | 595 | |
| `anuncios_gerados` | 582 | saída da esteira |
| `perfis` | 3 | 2 `equipe`, 1 `cliente` |
| `decisoes` | 3 | AIL |
| `migracoes_aplicadas` | 29 | o ledger |
| `copilot_conversas` | **0** | 035 |
| `copilot_mensagens` | **0** | 035 |
| `copilot_propostas` | **0** | 035 |
| `copilot_acoes` | **0** | 035 |
| `copilot_cadastros` | — | **não existe** |
| `procedencia_de_campo` | — | **não existe** |

As quatro tabelas do Copilot existem e estão **vazias**. Isso é um fato importante
para tudo o que vem depois: não há dado a migrar, não há backfill a fazer, e
nenhuma migração pendente pode falhar por causa de linha existente.

### Funções de tenancy

| Função | Estado |
|---|---|
| `cliente_do_usuario()` | existe, `SECURITY DEFINER`, retorna `uuid` |
| `eh_equipe()` | existe, **nega por padrão** (`coalesce(..., false)`) — 016 §2 aplicada |

---

## 2. Migrations — estado real, não o presumido

O repositório tem 40 arquivos. O ledger `migracoes_aplicadas` tem 29 linhas e
para em **034**. O `supabase_migrations.schema_migrations` (usado pelo MCP) tem
4 linhas: `033`, `034` e **035 em duas partes**.

As duas fontes discordam, e nenhuma das duas é confiável sozinha. A coluna
"Estado" abaixo vem de **inspeção do schema**, não de registro.

| # | Migração | Estado | Como foi determinado |
|---|---|---|---|
| 001–004 | modelagem, auditoria, marketplace, anúncios | **APLICADA** | tabelas e colunas presentes |
| **005** | portal-cliente | **PARCIALMENTE APLICADA** | §1/§2 (funções) sim; **§3 não**; §4 parcial — ver §5 |
| 006–015 | self-service … kit-componentes | **APLICADA** | políticas `cliente_escopo` e colunas presentes |
| 016 | fix-multitenancy-security | **APLICADA** | `eh_equipe()` nega por padrão |
| **017** | organizacoes | **NÃO APLICADA** | `to_regclass('public.organizacoes')` → null |
| **018** | origem-produto | **NÃO APLICADA** | tabela ausente |
| **019** | catalogo | **NÃO APLICADA** | tabela ausente |
| **020** | produto-mestre | **NÃO APLICADA** | tabela ausente |
| **021** | produto-mestre-versao | **NÃO APLICADA** | depende de 020 |
| 022–028 | AIL, detector, ledger, ofertas, autoria, knowledge, delegação | **APLICADA** | tabelas presentes |
| 029 | margem-minima-cliente | **APLICADA** | `clientes.margem_minima` presente |
| 030 | limpar-preco-minimo-sem-base | **APLICADA** | efeito de dados, no ledger |
| 031 | desfazer-custos-que-sao-referencia | **APLICADA** | efeito de dados, no ledger |
| **032** | limpar-base-manter-so-o-ml | **APLICADA, ARQUIVO AUSENTE** | no ledger; **não existe no repositório** |
| 033 | custos-do-lojista | **APLICADA** | 7 colunas em `clientes` |
| 034 | quem-paga-o-frete | **APLICADA** | `produtos.vendedor_paga_frete` |
| **035** | copilot-propostas-e-conversas | **APLICADA, FORA DO LEDGER** | 4 tabelas + 4 políticas presentes; ausente em `migracoes_aplicadas` |
| **036** | indices-para-busca-forte | **PENDENTE** | nenhum dos dois índices existe |
| **037** | cadastro-conversacional | **PENDENTE** | `copilot_cadastros` ausente; `draft_id` e `metadata` ausentes |
| **038** | procedencia-de-campo | **PENDENTE** | tabela ausente |
| **039** | proposta-de-titulo | **PENDENTE** | `texto` ausente; CHECK sem `titulo` |
| **040** | proposta-de-preco | **PENDENTE** | CHECK sem `preco` |

Sobre 017–021: **não é possível determinar a intenção** só pelo banco. As tabelas
não existem e as migrações não estão no ledger. Elas podem ser trabalho abandonado
(`produto_mestre` foi substituído por `produtos` + `produto_variantes`) ou dívida.
Não são pré-requisito de nada em 036–040 — nenhuma linha das pendentes as referencia.
Fica registrado como pergunta em aberto, não como pendência a aplicar.

---

## 3. O que cada pendente faz, do que depende, e o que quebra sem ela

### 036 — índices para a busca forte

**Faz:** dois índices btree **parciais**:
`produto_variantes (cliente_id, ean) where ean is not null and ean <> ''` e
`produtos (cliente_id, modelo) where modelo is not null and modelo <> ''`.

**Depende de:** nada. Independente das outras quatro.

**Sem ela:** **degradação de performance apenas.** A busca por EAN e por modelo
faz varredura sequencial. Com 684 variantes e 73 produtos isso é instantâneo. Nada
quebra, nada fica indisponível, nada mente.

**Medido agora:** 444 variantes têm EAN (240 não têm — o índice parcial as exclui);
73 de 73 produtos têm modelo.

**Não cria UNIQUE**, e isso continua correto: medidos hoje, **117 grupos de SKU
duplicado e 112 de EAN duplicado**. Um UNIQUE falharia na aplicação.

**Achado novo:** `modelo` também tem duplicata — 2 grupos:
`1816` (Babuche Yvate masculino e feminino) e `SLIM SQUARE LISO` (dois Havaianas).
Não é defeito: `buscaNoCatalogo` usa `.limit()`, não `.single()`, então os dois
viram dois candidatos e a máquina de desambiguação resolve. Registrado para que
ninguém proponha UNIQUE em `modelo` mais tarde achando que 73/73 significa único.

---

### 037 — cadastro conversacional

**Faz:** cria `copilot_cadastros`; troca o CHECK de `copilot_propostas.tipo` para
`('peso','custo','cadastro')`; adiciona `copilot_propostas.draft_id`;
adiciona `copilot_mensagens.metadata`; liga RLS com policy de SELECT por tenant.

**Depende de:** `copilot_propostas`, `copilot_conversas`, `clientes`, `produtos`
(todas presentes) e de `cliente_do_usuario()` (presente — a policy **vai** ser criada).
**É pré-requisito de 039 e 040** (ver §7).

**Sem ela — quebra funcional, e ela é maior do que parece:**

`criarProposta` em `copilotPropostas.ts:110-111` insere `draft_id` e `texto`
**incondicionalmente**, em toda proposta de todo tipo. As colunas não existem.
PostgREST rejeita a coluna desconhecida e a função lança.

> **Consequência:** o Copilot está quebrado HOJE, em produção, para **todos** os
> cinco tipos — incluindo `peso` e `custo`, que funcionavam antes de 037 ser
> escrita. Não é "a vertical nova não funciona": é "a vertical antiga parou".
> Este é o achado mais grave da auditoria e é o que decide a ordem de aplicação.

Além disso:
- `gravarTurno` (`copilotConversas.ts:116`) insere `metadata` — **falha silenciosa**:
  o `catch` só faz `console.error`, então a resposta chega ao lojista e o histórico
  inteiro da conversa não é gravado. Sem sintoma na tela.
- `ultimaApresentacao` (`copilotConversas.ts:144`) faz `select("papel, metadata")` —
  erro → `return []` → **"o segundo" nunca resolve**, silenciosamente. O Copilot
  responde "não sei a qual você se refere" e parece burro, não quebrado.
- Todo `copilotCadastros.ts` opera sobre tabela inexistente: leituras devolvem
  `null`/`[]`, `salvarDraft` devolve `false`, `marcarDraftCriado` engole o erro.
  **Fallback seguro por acidente, não por desenho:** o cadastro conversacional se
  comporta como se o lojista nunca tivesse dito nada, a cada turno.

Se `criarProposta` fosse consertado sem 037, os tipos `cadastro`/`titulo`/`preco`
ainda bateriam no CHECK `tipo in ('peso','custo')` — erro de banco, não silencioso.

---

### 038 — procedência de campo

**Faz:** cria `procedencia_de_campo` (append-only), dois índices, RLS + SELECT por tenant.

**Depende de:** `clientes` e `cliente_do_usuario()`. **Independente de 036/037/039/040.**

**Sem ela — recurso indisponível, com degradação parcial silenciosa:**
`registrarProcedencia` falha dentro de `try/catch` que só loga — e o comentário no
código diz a verdade: *"a escrita em si NÃO foi revertida"*. O custo é gravado no
produto e o rastro de origem não. `historicoDoCampo` continua devolvendo as três
trilhas antigas (`decisoes`, `copilot_acoes`, `copilot_cadastros`), então a tela
mostra histórico parcial sem avisar que a trilha nova não existe.

**A invariante se sustenta:** ausência de linha = origem não registrada. Como a
tabela não existe, **tudo** é origem não registrada — que é exatamente a verdade
sobre os 73 produtos e 684 variantes escritos antes disto. **Não há backfill a fazer
e não se deve inventar um.** `origem` não aceita `'desconhecida'`, e isso não muda.

---

### 039 — proposta de título

**Faz:** CHECK vira `('peso','custo','cadastro','titulo')`; adiciona
`copilot_propostas.texto`.

**Depende de:** 037 (pela ordem do CHECK — ver §7). **É pré-requisito de 040.**

**Sem ela:** coberta pela quebra de 037 (`texto` é inserido incondicionalmente).
Isolando o efeito próprio: **quebra funcional** — proposta de título viola o CHECK.

---

### 040 — proposta de preço

**Faz:** CHECK vira `('peso','custo','cadastro','titulo','preco')`; comenta a coluna `valor`.

**Depende de:** 039 (ordem do CHECK). Não adiciona coluna nenhuma.

**Sem ela:** **quebra funcional** — `tipo='preco'` viola o CHECK. Aplicar preço pelo
Copilot é recusado pelo banco.

---

## 4. Schema drift

Cinco divergências reais, nenhuma delas no schema do Copilot novo:

1. **035 aplicada sem registro no ledger.** Foi aplicada em 2026-07-29 via
   `apply_migration` (aparece em `supabase_migrations` como duas entradas), e o
   ledger `migracoes_aplicadas` não sabe. **Toda leitura do ledger subestima o
   banco em uma migração.**

2. **032 no ledger sem arquivo no repositório.** `032-limpar-base-manter-so-o-ml.sql`
   está registrado como aplicado em 2026-07-28 e o arquivo não existe. O efeito é
   verificável (73 produtos, os 1.733 da planilha não estão lá), mas **o SQL que o
   produziu não é reproduzível**. Um banco novo não chega a este estado rodando o
   repositório.

3. **017–021 no repositório sem nada no banco.** Cinco migrações, cinco tabelas
   ausentes, zero linhas no ledger.

4. **Duas fontes de verdade sobre migrações** (`migracoes_aplicadas` e
   `supabase_migrations.schema_migrations`), com conteúdos diferentes e nenhuma
   regra dizendo qual manda.

5. **005 §3 nunca aplicada** — a mais grave. Detalhada abaixo.

---

## 5. RLS e isolamento de tenant

### O que está certo: as tabelas do Copilot

As quatro tabelas de 035 têm exatamente o desenho pretendido:

```
copilot_conversas  SELECT  using (cliente_id = cliente_do_usuario())
copilot_mensagens  SELECT  using (cliente_id = cliente_do_usuario())
copilot_propostas  SELECT  using (cliente_id = cliente_do_usuario())
copilot_acoes      SELECT  using (cliente_id = cliente_do_usuario())
```

**Só SELECT.** Não há política de INSERT/UPDATE/DELETE, então o cliente do portal
não consegue escrever nem com a chave anon e sessão válida. Toda escrita passa pela
rota autenticada com `service_role`, que ignora RLS por desenho. **Um cliente com
UPDATE em `copilot_propostas` marcaria a própria proposta como `executada` e
pularia a revalidação inteira — isso está corretamente impedido.**

037 e 038 seguem o mesmo padrão, e a função de que dependem existe: as políticas
**serão** criadas, não vão cair no ramo `raise notice` que deixaria a tabela negando tudo.

### O que está errado: a fundação embaixo delas

**Migração 005 §3 nunca foi aplicada.** Ela deveria ter trocado, em 24 tabelas,
`equipe_autenticada (using true)` por `equipe_total (using eh_equipe())`.

Estado real:

| Política | Tabelas | Predicado |
|---|---:|---|
| `equipe_autenticada` | **29** | `using (true) with check (true)`, para `authenticated`, `for ALL` |
| `equipe_total` | 1 | só `canais_marketplace` (veio da 009, não da 005) |
| `cliente_escopo` | 10 | `cliente_id = cliente_do_usuario()` |

As tabelas com as duas políticas (`produtos`, `produto_variantes`, `anuncios_gerados`,
…) têm ambas **PERMISSIVE**, e políticas permissivas se combinam com **OR**. Então
`cliente_escopo` está neutralizada: `true OR (cliente_id = ...)` é `true`.

Conferi os GRANTs antes de afirmar impacto — `anon` e `authenticated` têm
`SELECT, INSERT, UPDATE, DELETE, TRUNCATE` em todas elas (o padrão do Supabase).
**RLS é o único portão, e em 29 tabelas o portão está aberto.**

**O que isso significa hoje, concretamente:** o usuário `cliente` do portal, com a
chave anon e a sessão dele, pode ler e escrever qualquer linha de `produtos`,
`clientes`, `padroes`, `ofertas`, `conhecimentos`, `delegacoes`, `financeiro` — e
de **`decisoes`, a AIL, que o Copilot trata como somente-leitura**, e de
**`migracoes_aplicadas`, o próprio ledger**.

Com 1 tenant, vazamento entre clientes é hipotético. **Escrita indevida no próprio
tenant não é.** E no pivot self-service, o segundo cliente cadastrado torna o
vazamento real no mesmo dia.

### Por que isto NÃO vira SQL pronto neste documento

A instrução foi clara nas duas direções: não afrouxar RLS, e não corrigir defeito
em silêncio. Corrigir isto é **apertar**, o que é a direção certa, mas apertar RLS
sem medir o que lê cada tabela derruba tela em produção. O que já sei:

- O portal do cliente lê quase tudo por funções `portal_*` (`SECURITY DEFINER`),
  que **ignoram RLS** — essas sobrevivem.
- Do navegador, com a chave anon, o portal toca direto só
  `onboardings`, `onboarding_items`, `fila_otimizacao_produto`, `canais_marketplace`.
  As duas últimas têm `cliente_escopo` e sobrevivem. As duas primeiras **não são
  lidas pelo portal do cliente** (conferido em `src/app/cliente/` e
  `src/components/client-portal/`) — só pelo painel da equipe.
- `src/lib/repositorio.ts` usa a chave do navegador com nome de tabela genérico:
  é o painel interno, e os 2 usuários `equipe` continuam passando por `eh_equipe()`.

Isso é indício forte de que a correção é segura, **não é prova**. Fica como
**DB-FIX-001**, trabalho próprio, com verificação de tela antes e depois. O esboço
está em §8 marcado como não-pronto.

### Outros achados dos advisors (todos pré-existentes)

- `set_updated_at` sem `search_path` fixo.
- Sete funções `SECURITY DEFINER` executáveis por `anon`, incluindo
  `portal_definir_custos_do_lojista` e `portal_definir_margem_minima` — **funções
  que escrevem**. Elas se escopam internamente por `cliente_do_usuario()`, que
  devolve null sem sessão, então o efeito prático é nulo; mas o `EXECUTE` para
  `anon` é folga desnecessária.
- Bucket público `produtos-imagens` permite listar todos os arquivos.
- Proteção contra senha vazada desligada no Auth.

Nenhum deles é criado ou piorado por 036–040.

---

## 6. Dados existentes

**Nenhuma migração pendente tem risco vindo de dado existente.** As três tabelas
que elas tocam com CHECK ou constraint (`copilot_propostas`, `copilot_mensagens`,
`copilot_cadastros`) estão vazias ou não existem. Um `ADD CONSTRAINT` valida as
linhas atuais: com zero linhas, valida instantaneamente e não pode falhar.

Medições do catálogo (contexto, não bloqueio):

| Medida | Valor |
|---|---:|
| produtos | 73 |
| produtos com `modelo` | 73 |
| grupos de `modelo` duplicado | **2** |
| variantes | 684 |
| variantes com EAN | 444 |
| grupos de EAN duplicado | **112** |
| variantes com SKU | 479 |
| grupos de SKU duplicado | **117** |
| **produtos com custo > 0** | **30 de 73** |
| produtos com preço > 0 | 73 |
| variantes com peso > 0 | 525 de 684 |

Os números batem exatamente com os que 036 e 037 declaram em seus cabeçalhos —
nada mudou na base desde que foram escritas.

**Só 30 de 73 produtos têm custo.** Não bloqueia migração nenhuma, e não é defeito:
é o resíduo de 031, que apagou 87 custos que eram código de modelo. Mas define o
teto real da vertical de pricing: o Copilot só consegue calcular margem para 30
produtos, e para os outros 43 a resposta correta é pedir o custo.

**Backfill de procedência: nenhum, e por desenho.** Ausência de linha continua
significando origem não registrada.

---

## 7. Ordem de aplicação

A dependência que importa não é óbvia e está escondida num bloco `DO`.

037, 039 e 040 contêm **o mesmo bloco** que localiza qualquer CHECK em
`copilot_propostas` mencionando `tipo` e `peso`, dropa, e recria com uma lista
**cumulativa**:

```
037 → ('peso','custo','cadastro')
039 → ('peso','custo','cadastro','titulo')
040 → ('peso','custo','cadastro','titulo','preco')
```

Cada uma dropa a anterior. **Quem roda por último manda.** Rodar 040 e depois 039
deixa a lista sem `preco`, e a proposta de preço passa a ser recusada pelo banco —
sem erro na aplicação, porque a migração "deu certo".

Além disso, `copilot_propostas.draft_id` tem FK para `copilot_cadastros(id)`: 037
precisa criar a tabela antes, e faz isso no mesmo arquivo.

**Ordem obrigatória:** `037 → 039 → 040`
**Livres:** `036` e `038`, em qualquer ponto.

**Ordem recomendada — e o porquê de cada posição:**

| Ordem | Migração | Por que aqui |
|---|---|---|
| 1º | **037** | Devolve o Copilot ao ar. Enquanto `draft_id` não existir, **toda** proposta falha, inclusive peso e custo. É a única com urgência. |
| 2º | **039** | `texto` é a segunda metade da mesma quebra — `criarProposta` insere as duas colunas juntas. Até aqui, nada funciona. |
| 3º | **040** | Fecha a lista de tipos. Depois desta o Copilot está inteiro. |
| 4º | **038** | Liga a trilha de procedência para tudo que for escrito daqui em diante. Quanto antes, menos escrita sem rastro. |
| 5º | **036** | Só performance. Pode esperar, e pode ser aplicada a qualquer momento sem consequência. |

**Segurança e idempotência de cada uma, conferida contra o estado atual:**

| Migração | Reexecutável? | Por quê |
|---|---|---|
| 036 | **sim** | `create index if not exists` nos dois |
| 037 | **sim** | `create table/index if not exists`; `add column if not exists`; o bloco `DO` dropa o CHECK antes de recriar; a policy é protegida por `exception when duplicate_object` |
| 038 | **sim** | mesmo padrão |
| 039 | **sim** | `DO` + `add column if not exists` |
| 040 | **sim** | `DO` + `comment on` |

Nenhuma é destrutiva. Nenhuma apaga dado. Nenhuma pode falhar por linha existente
(as tabelas alvo estão vazias). Os `CREATE INDEX` de 036 pegam lock de escrita,
que em 684 linhas dura milissegundos — `CONCURRENTLY` seria cerimônia sem ganho.

---

## 8. SQL para aplicar manualmente

Rodar **no SQL Editor do projeto `ouynursknlgtmewcdjzr`**, um bloco por vez, na
ordem. Os arquivos completos e comentados estão em `database/migrations/`; os
blocos abaixo são o conteúdo executável deles, sem alteração de semântica.

Depois de cada bloco, rodar a conferência correspondente da §9 antes de seguir.

### Bloco 1 — 037 (o que devolve o Copilot ao ar)

```sql
-- database/migrations/037-cadastro-conversacional.sql
create table if not exists public.copilot_cadastros (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  conversa_id uuid not null references public.copilot_conversas(id) on delete cascade,
  criado_por uuid references auth.users(id) on delete set null,
  status text not null default 'ativo'
    check (status in ('ativo','pronto_para_finalizar','aguardando_confirmacao','criado','cancelado')),
  fatos jsonb not null default '{}'::jsonb,
  variantes jsonb not null default '[]'::jsonb,
  conflitos jsonb not null default '[]'::jsonb,
  formato smallint not null default 1,
  proposta_id uuid references public.copilot_propostas(id) on delete set null,
  produto_id uuid references public.produtos(id) on delete set null,
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint copilot_cadastros_desfecho_coerente
    check ((status = 'criado') = (produto_id is not null))
);

create index if not exists copilot_cadastros_abertos_idx
  on public.copilot_cadastros (cliente_id, status, atualizado_em desc);
create index if not exists copilot_cadastros_conversa_idx
  on public.copilot_cadastros (conversa_id, atualizado_em desc);

do $$
declare c record;
begin
  for c in
    select con.conname from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public' and rel.relname = 'copilot_propostas'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%tipo%'
       and pg_get_constraintdef(con.oid) ilike '%peso%'
  loop
    execute format('alter table public.copilot_propostas drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.copilot_propostas
  add constraint copilot_propostas_tipo_check
  check (tipo in ('peso','custo','cadastro'));

alter table public.copilot_propostas
  add column if not exists draft_id uuid references public.copilot_cadastros(id) on delete set null;

create index if not exists copilot_propostas_draft_idx
  on public.copilot_propostas (draft_id);

alter table public.copilot_mensagens
  add column if not exists metadata jsonb;

comment on column public.copilot_mensagens.metadata is
  'O que esta mensagem apresentou, para referências como "o segundo" resolverem para um id em vez de uma frase.';

alter table public.copilot_cadastros enable row level security;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'cliente_do_usuario') then
    execute $p$
      create policy copilot_cadastros_leitura on public.copilot_cadastros
        for select using (cliente_id = public.cliente_do_usuario());
    $p$;
  else
    raise notice 'cliente_do_usuario() ausente: RLS ligado sem politicas (nega tudo).';
  end if;
exception when duplicate_object then
  raise notice 'politica de copilot_cadastros ja existia; nada a fazer';
end $$;
```

### Bloco 2 — 039

```sql
-- database/migrations/039-proposta-de-titulo.sql
do $$
declare c record;
begin
  for c in
    select con.conname from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public' and rel.relname = 'copilot_propostas'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%tipo%'
       and pg_get_constraintdef(con.oid) ilike '%peso%'
  loop
    execute format('alter table public.copilot_propostas drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.copilot_propostas
  add constraint copilot_propostas_tipo_check
  check (tipo in ('peso', 'custo', 'cadastro', 'titulo'));

alter table public.copilot_propostas
  add column if not exists texto text;

comment on column public.copilot_propostas.texto is
  'O conteúdo proposto quando ele é texto (ex.: título). Nulo nos tipos numéricos.';
```

### Bloco 3 — 040

```sql
-- database/migrations/040-proposta-de-preco.sql
do $$
declare c record;
begin
  for c in
    select con.conname from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public' and rel.relname = 'copilot_propostas'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%tipo%'
       and pg_get_constraintdef(con.oid) ilike '%peso%'
  loop
    execute format('alter table public.copilot_propostas drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.copilot_propostas
  add constraint copilot_propostas_tipo_check
  check (tipo in ('peso', 'custo', 'cadastro', 'titulo', 'preco'));

comment on column public.copilot_propostas.valor is
  'Unidade canônica por tipo: gramas (peso), reais (custo, preco), caracteres (titulo).';
```

### Bloco 4 — 038

```sql
-- database/migrations/038-procedencia-de-campo.sql
create table if not exists public.procedencia_de_campo (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  entidade_tipo text not null check (entidade_tipo in ('produto', 'variante')),
  entidade_id uuid not null,
  campo text not null,
  valor text not null,
  valor_anterior text,
  origem text not null check (origem in ('cliente', 'erp', 'planilha', 'marketplace', 'zion')),
  metodo text not null
    check (metodo in ('cadastro_manual', 'copilot', 'importacao', 'api_marketplace', 'calculo')),
  ator uuid references auth.users(id) on delete set null,
  evidencia_registro text,
  evidencia_id text,
  registrado_em timestamptz not null default now()
);

create index if not exists procedencia_de_campo_alvo_idx
  on public.procedencia_de_campo (cliente_id, entidade_id, campo, registrado_em desc);
create index if not exists procedencia_de_campo_campo_idx
  on public.procedencia_de_campo (cliente_id, campo, registrado_em desc);

comment on table public.procedencia_de_campo is
  'Append-only. Ausência de linha significa origem desconhecida — nunca gravar palpite.';

alter table public.procedencia_de_campo enable row level security;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'cliente_do_usuario') then
    execute $p$
      create policy procedencia_de_campo_leitura on public.procedencia_de_campo
        for select using (cliente_id = public.cliente_do_usuario());
    $p$;
  else
    raise notice 'cliente_do_usuario() ausente: RLS ligado sem politicas (nega tudo).';
  end if;
exception when duplicate_object then
  raise notice 'politica de procedencia_de_campo ja existia; nada a fazer';
end $$;
```

### Bloco 5 — 036

```sql
-- database/migrations/036-indices-para-busca-forte.sql
create index if not exists idx_variantes_cliente_ean
  on public.produto_variantes (cliente_id, ean)
  where ean is not null and ean <> '';

create index if not exists idx_produtos_cliente_modelo
  on public.produtos (cliente_id, modelo)
  where modelo is not null and modelo <> '';
```

### Bloco 6 — o ledger (opcional, corrige o drift nº 1)

O ledger não registra a 035, que **está** aplicada. Este bloco alinha o registro
ao fato. Não altera schema.

```sql
insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao) values
  ('035','035-copilot-propostas-e-conversas', now(), 'aplicada em 2026-07-29 via apply_migration; ledger alinhado em DB-AUDIT-001'),
  ('036','036-indices-para-busca-forte',       now(), 'indices parciais para EAN e modelo; sem UNIQUE (117 SKUs e 112 EANs duplicados)'),
  ('037','037-cadastro-conversacional',        now(), 'copilot_cadastros + draft_id + metadata; tipo aceita cadastro'),
  ('038','038-procedencia-de-campo',           now(), 'trilha append-only; ausencia de linha = origem nao registrada; sem backfill'),
  ('039','039-proposta-de-titulo',             now(), 'tipo aceita titulo; coluna texto'),
  ('040','040-proposta-de-preco',              now(), 'tipo aceita preco; valor em reais neste tipo')
on conflict do nothing;
```

> Inserir **só as linhas das migrações efetivamente rodadas.** Registrar o que não
> foi aplicado é como o ledger deixou de ser confiável.

### NÃO PRONTO — esboço de DB-FIX-001 (RLS)

**Não rodar.** Está aqui para ser discutido, não executado. Precisa de verificação
de tela antes e depois, e é trabalho próprio.

```sql
-- ESBOÇO. NÃO APLICAR SEM DB-FIX-001.
-- Executa o que 005 §3 pretendia e nunca fez.
do $$
declare t text;
begin
  foreach t in array array[
    'clientes','onboardings','onboarding_items','produtos','anuncios','agentes',
    'tarefas','relatorios','financeiro','execucoes_agentes','reunioes','pendencias',
    'produto_variantes','produto_atributos','categoria_templates','anuncio_variantes',
    'precificacao_variantes','imagens_produto','importacoes_anuncios','auditorias_anuncios',
    'problemas_anuncio','fila_otimizacao','execucoes_lote','anuncios_gerados',
    'decisoes','padroes','ofertas','conhecimentos','delegacoes'
  ]
  loop
    if to_regclass('public.'||t) is not null then
      execute format('drop policy if exists "equipe_autenticada" on public.%I', t);
      execute format('drop policy if exists "equipe_total" on public.%I', t);
      execute format(
        'create policy "equipe_total" on public.%I for all to authenticated
           using (public.eh_equipe()) with check (public.eh_equipe())', t);
    end if;
  end loop;
end $$;
```

Antes de aplicar isto é preciso: confirmar que os 2 perfis `equipe` estão `ativo`;
abrir o painel interno e o portal do cliente com RLS apertado num branch do banco;
e decidir se `decisoes`, `padroes` e `ofertas` — que hoje o cliente escreve — devem
ficar `eh_equipe()`-only ou ganhar leitura escopada.

---

## 9. Verificação, depois de aplicar

Uma consulta por bloco. Rodar logo após o bloco correspondente.

```sql
-- Depois do Bloco 1 (037)
select
  (to_regclass('public.copilot_cadastros') is not null)                     as tabela_criada,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='copilot_propostas'
      and column_name='draft_id')                                           as tem_draft_id,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='copilot_mensagens'
      and column_name='metadata')                                           as tem_metadata,
  (select pg_get_constraintdef(oid) from pg_constraint
    where conname='copilot_propostas_tipo_check')                           as tipos_aceitos,
  (select count(*) from pg_policies
    where schemaname='public' and tablename='copilot_cadastros')            as politicas;
-- Esperado: true | 1 | 1 | CHECK (tipo = ANY (ARRAY['peso','custo','cadastro'])) | 1
```

```sql
-- Depois do Bloco 2 (039)
select
  (select pg_get_constraintdef(oid) from pg_constraint
    where conname='copilot_propostas_tipo_check')                           as tipos_aceitos,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='copilot_propostas'
      and column_name='texto')                                              as tem_texto;
-- Esperado: CHECK (tipo = ANY (ARRAY['peso','custo','cadastro','titulo'])) | 1
```

```sql
-- Depois do Bloco 3 (040) — a conferência mais importante da sequência
select pg_get_constraintdef(oid) as tipos_aceitos
  from pg_constraint where conname='copilot_propostas_tipo_check';
-- Esperado: CHECK (tipo = ANY (ARRAY['peso','custo','cadastro','titulo','preco']))
-- Se faltar 'preco', a ordem foi invertida: rode o Bloco 3 de novo.
```

```sql
-- Depois do Bloco 4 (038)
select
  (to_regclass('public.procedencia_de_campo') is not null)                  as tabela_criada,
  (select count(*) from public.procedencia_de_campo)                        as linhas,
  (select count(*) from pg_indexes where schemaname='public'
     and tablename='procedencia_de_campo')                                  as indices,
  (select count(*) from pg_policies where schemaname='public'
     and tablename='procedencia_de_campo')                                  as politicas,
  (select pg_get_constraintdef(oid) from pg_constraint
     where conrelid='public.procedencia_de_campo'::regclass
       and pg_get_constraintdef(oid) ilike '%origem%')                      as check_origem;
-- Esperado: true | 0 | 3 (2 + pkey) | 1 | CHECK sem 'desconhecida'
-- linhas = 0 é o certo. A trilha começa agora; não há backfill.
```

```sql
-- Depois do Bloco 5 (036)
select indexname from pg_indexes where schemaname='public'
  and indexname in ('idx_variantes_cliente_ean','idx_produtos_cliente_modelo');
-- Esperado: as duas linhas.

explain analyze select id from public.produto_variantes
  where cliente_id = (select id from public.clientes limit 1)
    and ean = (select ean from public.produto_variantes
                where ean is not null and ean <> '' limit 1);
-- Esperado: Index Scan usando idx_variantes_cliente_ean.
```

```sql
-- Verificação final, depois de todos os blocos
select
  (select count(*) from pg_policies where schemaname='public'
     and tablename like 'copilot%')                                         as politicas_copilot,
  (select count(*) from pg_policies where schemaname='public'
     and tablename like 'copilot%' and cmd <> 'SELECT')                     as politicas_de_escrita,
  (select pg_get_constraintdef(oid) from pg_constraint
     where conname='copilot_propostas_tipo_check')                          as tipos_aceitos;
-- Esperado: 6 | 0 | lista com os cinco tipos
-- politicas_de_escrita DEVE ser 0. Se não for, alguém abriu escrita pelo navegador.
```

---

## 10. Código bloqueado esperando schema

| Capacidade | Bloqueada por | Como falha hoje |
|---|---|---|
| **Proposta de peso** (COPILOT-001) | **037 + 039** | **quebra funcional** — `criarProposta` insere `draft_id`/`texto` inexistentes |
| **Proposta de custo** (COPILOT-002) | **037 + 039** | idem |
| Cadastro conversacional (COPILOT-003) | 037 | draft nunca persiste; **falha silenciosa** — cada turno recomeça do zero |
| Retomada de cadastro | 037 | `draftsAbertos` devolve `[]` — "não há cadastro em aberto", que é mentira |
| Referência estruturada ("o segundo") | 037 (`metadata`) | **falha silenciosa** nos dois lados: não grava e não lê |
| Histórico da conversa | 037 (`metadata`) | **falha silenciosa** — `gravarTurno` engole o erro; nenhuma mensagem é gravada |
| Procedência de campo (COPILOT-004) | 038 | **falha silenciosa** — valor gravado, rastro não; histórico parcial sem aviso |
| Resolução de pendências | 038 (parcial) | funciona sobre as trilhas antigas; perde a procedência nova |
| Preparação de anúncio (COPILOT-005) | 039 | proposta de título recusada pelo CHECK |
| Pricing pelo Copilot (COPILOT-006) | 040 | proposta de preço recusada pelo CHECK |
| Auditoria proposta→ação | 037 (`draft_id`) | vínculo só por `alvos`, sem coluna explícita |

**O gate está verde: 1515 testes passando, typecheck e lint limpos.** Isso não
contradiz nada acima — os testes são de domínio puro e não tocam o banco. A
distância entre "o gate passa" e "o Copilot funciona" é exatamente o conteúdo
desta auditoria, e é o argumento mais forte a favor de aplicar 037 antes de
escrever qualquer linha nova.

---

## 11. Achados que viram trabalho próprio

Nenhum foi corrigido. Documentados, nesta ordem de gravidade:

1. **DB-FIX-001 — 005 §3 nunca aplicada.** 29 tabelas com `using (true)` para
   `authenticated`; `cliente_escopo` neutralizada por OR; GRANTs abertos. Inclui
   escrita do cliente em `decisoes` (AIL) e `migracoes_aplicadas` (o ledger).
2. **DB-FIX-002 — 032 no ledger sem arquivo.** O estado atual do catálogo não é
   reproduzível a partir do repositório.
3. **DB-FIX-003 — duas fontes de verdade sobre migrações**, com conteúdos
   divergentes e sem regra de precedência.
4. **DB-FIX-004 — 017–021 sem destino declarado.** Cinco migrações no repositório,
   zero efeito no banco. Aplicar ou arquivar, com a decisão escrita.
5. **DB-FIX-005 — folgas dos advisors:** `search_path` de `set_updated_at`,
   `EXECUTE` para `anon` em sete funções `SECURITY DEFINER` (duas delas escrevem),
   bucket público listável, proteção de senha vazada desligada.

Nenhum destes é criado por 036–040, e nenhum bloqueia a aplicação delas.
