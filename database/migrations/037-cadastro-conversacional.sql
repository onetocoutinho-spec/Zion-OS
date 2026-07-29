-- ============================================================
-- Zion OS — Migração 037: o cadastro conversacional que sobrevive ao navegador
--
-- INCREMENTAL e NÃO DESTRUTIVA. Rode UMA vez no SQL Editor.
--
-- APLICAÇÃO MANUAL. Nada aqui foi aplicado remotamente.
--
-- O QUE FALTAVA
--
-- O Copilot já sabia acumular fatos de um cadastro com procedência e já sabia
-- montar a grade de variantes — mas tudo isso vivia num turno. Fechar o
-- navegador apagava o trabalho, e "continua aquele cadastro" não tinha do que
-- continuar.
--
-- Esta migração dá durabilidade a esse estado e estende a Proposal existente
-- para cobrir a única escrita que ela ainda não cobria: CRIAR produto.
--
-- ============================================================
-- A ESCOLHA DE FORMA — por que colunas para umas coisas e jsonb para outras
-- ============================================================
--
-- A pergunta que decidiu não foi estética, foi: COMO ESTES DADOS SÃO
-- CONSULTADOS E ATUALIZADOS?
--
-- Um Draft é sempre lido INTEIRO (a conversa precisa de tudo que já sabe) e
-- gravado INTEIRO (cada turno recalcula prontidão sobre o conjunto). Nunca
-- existe uma consulta do tipo "todos os drafts cujo fato X é Y", nem uma
-- atualização parcial que não passe pelo domínio.
--
-- Então:
--
--   COLUNA  o que a BUSCA usa, o que a POLÍTICA precisa ler sem join, e o que
--           tem invariante que o banco pode garantir:
--             cliente_id  -> RLS e isolamento de tenant
--             status      -> ciclo de vida, com CHECK
--             conversa_id -> retomada e vínculo com o fio
--             produto_id  -> o desfecho, com FK real
--             proposta_id -> a autorização que gerou a criação
--             versao      -> escrita concorrente
--
--   JSONB   o que só o domínio interpreta e que evolui junto com ele:
--             fatos      -> {campo: {valor, procedencia}}
--             variantes  -> [{cor, tamanho, sku, ean}]
--             conflitos  -> [{campo, valorAtual, valorNovo, procedencia}]
--
-- NÃO normalizamos variantes numa tabela. Elas não são consultadas fora do
-- Draft, e a única "invariante" que uma tabela permitiria — SKU único — É FALSA
-- NESTA BASE: 117 SKUs e 112 EANs duplicados, medidos em 2026-07-29. Uma tabela
-- criaria índices para consultas que não existem e prometeria uma unicidade que
-- o catálogo real não tem.
--
-- NÃO jogamos status nem tenant no jsonb. Um `status` dentro de jsonb não aceita
-- CHECK, e um `cliente_id` dentro de jsonb não sustenta RLS sem função — e
-- política que depende de expressão sobre jsonb é política que alguém desliga.
--
-- `formato` versiona o jsonb. Quando a forma dos fatos mudar, a leitura sabe o
-- que está lendo em vez de adivinhar pela presença de chaves.
--
-- ============================================================
-- MULTITENANCY
-- ============================================================
--
-- O tenant vem da SESSÃO, na rota, sempre. Nunca do Gemini, nunca do corpo da
-- requisição. Um Draft de outro cliente é indistinguível de inexistente para
-- quem pergunta — a comparação vive no domínio (`draftVisivelPara`), e a
-- mensagem devolvida é a mesma nos dois casos. A diferença fica no log, que é
-- onde ela serve.
--
-- Aqui, como em 035: o cliente do portal tem apenas SELECT. Toda escrita passa
-- pela rota autenticada com a service key. Um cliente com UPDATE em
-- `copilot_cadastros` marcaria o próprio Draft como `criado` e pularia a
-- revalidação inteira.
-- ============================================================

-- ---------- o cadastro em conversa ----------

create table if not exists public.copilot_cadastros (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  -- O fio a que este cadastro pertence. A retomada procura por aqui, e a
  -- auditoria reconstrói "usuário -> conversa -> cadastro" sem inferência.
  conversa_id uuid not null references public.copilot_conversas(id) on delete cascade,
  criado_por uuid references auth.users(id) on delete set null,

  -- O ciclo de vida. `criado` e `cancelado` são terminais: o domínio recusa sair
  -- deles, e o CHECK garante que nenhum caminho invente um sexto estado.
  status text not null default 'ativo'
    check (status in ('ativo','pronto_para_finalizar','aguardando_confirmacao','criado','cancelado')),

  -- {campo: {valor, procedencia}}. A PROCEDÊNCIA viaja junto com o valor porque
  -- é ela que distingue "o lojista disse R$ 47,80" de "a IA achou que fosse".
  -- Guardar só o valor apagaria a distinção que o módulo inteiro existe para
  -- manter — e dinheiro está em CENTAVOS INTEIROS aqui.
  fatos jsonb not null default '{}'::jsonb,
  -- [{cor, tamanho, sku, ean}] — a grade. SKU e EAN são TEXTO: 473 SKUs desta
  -- base começam com zero, e um número perderia o zero em silêncio.
  variantes jsonb not null default '[]'::jsonb,
  -- Discordâncias abertas em campo crítico. Enquanto houver, não fica pronto.
  conflitos jsonb not null default '[]'::jsonb,
  -- A forma do jsonb acima. Sobe quando o domínio mudar a estrutura.
  formato smallint not null default 1,

  -- A autorização que vai (ou foi) criar o produto. `on delete set null` e não
  -- cascade: apagar uma proposta não pode apagar o trabalho do lojista.
  proposta_id uuid references public.copilot_propostas(id) on delete set null,
  -- O desfecho. Preenchido só depois de o produto existir de verdade.
  produto_id uuid references public.produtos(id) on delete set null,

  -- Trava de escrita concorrente: duas abas conversando no mesmo cadastro.
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- COERÊNCIA DO DESFECHO, no banco e não só no código: `criado` sem produto é
  -- uma mentira sobre o que aconteceu, e produto sem `criado` é um produto que
  -- nasceu fora do caminho autorizado. As duas situações seriam invisíveis.
  constraint copilot_cadastros_desfecho_coerente
    check ((status = 'criado') = (produto_id is not null))
);

-- A retomada: os abertos deste cliente, do mais recente para o mais antigo.
create index if not exists copilot_cadastros_abertos_idx
  on public.copilot_cadastros (cliente_id, status, atualizado_em desc);

-- O cadastro aberto DESTA conversa — a consulta de todo turno.
create index if not exists copilot_cadastros_conversa_idx
  on public.copilot_cadastros (conversa_id, atualizado_em desc);

-- NÃO existe unicidade "um cadastro aberto por conversa". Ela pareceria
-- proteção e seria uma parede: um lojista pode legitimamente cadastrar dois
-- produtos no mesmo fio, e o erro chegaria como falha de banco, sem saída. O
-- reuso do cadastro aberto acontece no serviço, onde há o que fazer a respeito.

-- ---------- a Proposal agora também CRIA ----------
--
-- `cadastro` entra na lista fechada de tipos em vez de ganhar uma segunda
-- primitive de aprovação. As três proteções são as mesmas: identidade (o id vem
-- do banco), precondições (o conjunto de possíveis duplicatas não pode ter
-- mudado) e idempotência (a transição atômica `pendente` -> `executada`).
--
-- Nele, `alvos` carrega o ID DO DRAFT: o que está sendo autorizado é a
-- materialização daquele cadastro, não uma escrita num produto que já existe.

do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public'
       and rel.relname = 'copilot_propostas'
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

-- O vínculo explícito, para a auditoria não depender de interpretar `alvos`.
alter table public.copilot_propostas
  add column if not exists draft_id uuid references public.copilot_cadastros(id) on delete set null;

create index if not exists copilot_propostas_draft_idx
  on public.copilot_propostas (draft_id);

-- ---------- "o segundo" ----------
--
-- Quando uma resposta mostra três candidatos e o lojista diz "o segundo", há
-- duas formas de resolver isso e uma delas é errada: guardar a frase e
-- reinterpretá-la depois. Ela funciona até a lista mudar de ordem — e aí "o
-- segundo" aponta para outro produto, sem nada na tela denunciando.
--
-- `metadata` guarda O QUE AQUELA MENSAGEM MOSTROU e em que ordem:
--
--   {"candidatos": {"origem": "busca",
--                   "itens": [{"ordem": 1, "tipo": "produto", "id": "...", "rotulo": "..."}]}}
--
-- A resolução acontece uma vez, no servidor, contra o conjunto daquela
-- mensagem. Daí em diante toda ação usa o id.

alter table public.copilot_mensagens
  add column if not exists metadata jsonb;

comment on column public.copilot_mensagens.metadata is
  'O que esta mensagem apresentou, para referências como "o segundo" resolverem para um id em vez de uma frase.';

-- ============================================================
-- RLS — leitura do próprio tenant, escrita só pelo servidor
-- ============================================================

alter table public.copilot_cadastros enable row level security;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'cliente_do_usuario') then
    execute $p$
      create policy copilot_cadastros_leitura on public.copilot_cadastros
        for select using (cliente_id = public.cliente_do_usuario());
    $p$;
  else
    -- Sem a função de tenancy, NÃO criamos política permissiva. Tabela com RLS
    -- ligado e sem política nenhuma nega tudo — o padrão seguro. Melhor a tela
    -- não ler do que ler o tenant errado.
    raise notice 'cliente_do_usuario() ausente: RLS ligado sem politicas (nega tudo).';
  end if;
exception when duplicate_object then
  raise notice 'politica de copilot_cadastros ja existia; nada a fazer';
end $$;

-- ============================================================
-- Conferência
-- ============================================================
-- select column_name, data_type from information_schema.columns
--  where table_schema='public' and table_name='copilot_cadastros' order by ordinal_position;
--
-- select pg_get_constraintdef(oid) from pg_constraint
--  where conname = 'copilot_propostas_tipo_check';
-- Esperado: CHECK (tipo = ANY (ARRAY['peso','custo','cadastro']))
--
-- select column_name from information_schema.columns
--  where table_schema='public' and table_name='copilot_mensagens' and column_name='metadata';
-- Esperado: uma linha.
