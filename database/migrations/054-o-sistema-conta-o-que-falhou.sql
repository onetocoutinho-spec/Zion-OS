-- ============================================================
-- 054 — o sistema CONTA o que falhou, em vez de a lojista tirar print
-- ============================================================
--
-- O DEFEITO
-- ---------
-- O Zion sabe quando algo dá errado. Ele só não conta para ninguém.
--
-- Medido em 04/08/2026, no repositório inteiro:
--
--     146  blocos `catch`
--      50  `console.error` / `console.warn`
--       9  rotas de API — `agentes, assistente, consulta-peso, imagens, loja,
--          ml, otimizar, usuarios, versao`
--       0  que RECEBEM um erro do navegador
--
-- Todo destino é local. `useLiveQuery` (hooks.ts:107) grava
-- `[Zion OS] Falha ao consultar dados:` no console DA LOJISTA. A telemetria de
-- `consultaPeso` — que é bem pensada, e cujo padrão esta migração segue — vive
-- em localStorage, e o próprio comentário admite: "não atravessa dispositivo
-- nem navegador".
--
-- A consequência está escrita no handoff de 04/08, e ele a trata como método
-- quando ela é sintoma:
--
--     "a evidência que falta está no console do navegador da lojista.
--      Peça o console antes de ler código."
--
-- Enquanto isso for verdade, o dono é o instrumento de medição do próprio
-- produto — e nenhuma afirmação de "está funcionando" pode ser feita, porque
-- ninguém consegue ver. Não se declara funcional um sistema que não fala.
--
-- O QUE ENTRA
-- -----------
-- Uma tabela, e o fio que faltava do outro lado.
--
--   tipo         a taxonomia curta: `consulta_falhou`, `gravacao_falhou`,
--                `lote_parcial`. É por ela que se conta, não pela mensagem.
--   origem       ONDE no código, não em que tela: `useLiveQuery`,
--                `importarAnunciosML`. Sobrevive a redesenho de UI.
--   severidade   `erro` (a pessoa foi impedida) ou `aviso` (seguiu com menos).
--   mensagem     o texto técnico, REDIGIDO — ver a nota de privacidade.
--   contexto     jsonb de escalares curtos: identificadores, contagens.
--   repeticoes   quantas vezes o MESMO evento ocorreu na janela agregada. Um
--                `useLiveQuery` em laço produziria centenas de linhas por
--                minuto; o cliente agrega antes de mandar, e uma linha com
--                `repeticoes = 240` é mais informativa que 240 linhas.
--
-- PRIVACIDADE — a regra que o projeto já tinha, aplicada aqui
-- -----------------------------------------------------------
-- `consultaPeso.ts:27` decidiu, e decidiu certo: "A frase do operador NÃO é
-- gravada. Ele digita nome de fornecedor, código interno, observação
-- comercial." A mesma regra vale aqui, e agora vale contra um risco novo:
-- mensagem de erro de banco CARREGA DADO. O Postgres devolve
-- `Key (sku)=(ABC-123) already exists` — o valor vai junto com o defeito.
--
-- Por isso a redação NÃO é responsabilidade de quem chama: ela mora em
-- `modules/observability/domain/evento.ts`, é pura, e é testada. Foi a lição
-- de 04/08 — regra em quatro lugares vira quatro regras — aplicada antes de
-- existir o segundo lugar.
--
-- NADA de conteúdo do lojista entra aqui. Identificador entra; texto que ele
-- escreveu, não.
--
-- POR QUE ESTA MIGRAÇÃO É SEGURA NA ORDEM EM QUE ESTÁ
-- ---------------------------------------------------
-- A 053 ensinou que a ordem importa, e ensinou caro:
--
--     coluna/tabela NOVA  →  código velho ignora        (banco na frente: ok)
--     RESTRIÇÃO nova      →  código velho QUEBRA        (código na frente)
--
-- Esta é tabela nova. É o lado seguro da defasagem: nada existente lê ou
-- escreve nela, e aplicá-la antes ou depois do merge dá no mesmo. Não há
-- restrição sobre dado que já existe, então não há caminho de escrita que ela
-- possa quebrar — que foi exatamente o que a 053 não pôde dizer de si.
-- ============================================================

create table if not exists public.eventos (
  id          uuid primary key default gen_random_uuid(),
  -- NULLABLE de propósito: a falha mais interessante é a que acontece ANTES de
  -- saber quem é o cliente (sessão expirada, RLS barrando, rede caindo no
  -- login). Exigir `cliente_id` aqui perderia justamente esses.
  cliente_id  uuid references public.clientes(id) on delete cascade,
  tipo        text        not null,
  origem      text        not null,
  severidade  text        not null default 'erro',
  mensagem    text        not null default '',
  contexto    jsonb       not null default '{}'::jsonb,
  repeticoes  integer     not null default 1,
  criado_em   timestamptz not null default now()
);

comment on table public.eventos is
  'O que falhou, dito pelo sistema. Existe para que ninguem precise pedir print do console. Mensagem REDIGIDA em modules/observability/domain/evento.ts — conteudo do lojista nao entra.';

-- "O que quebrou para este cliente, mais recente primeiro" é a pergunta da
-- tela. "Qual defeito é o mais comum" é a pergunta de quem prioriza.
create index if not exists idx_eventos_cliente_recentes
  on public.eventos (cliente_id, criado_em desc);

create index if not exists idx_eventos_tipo_recentes
  on public.eventos (tipo, criado_em desc);

alter table public.eventos enable row level security;

-- As mesmas duas políticas do resto do sistema (016/041/052). A equipe lê
-- tudo, inclusive as linhas de `cliente_id` nulo — que o cliente nunca alcança,
-- porque `null = cliente_do_usuario()` não casa. A escrita real vem da rota,
-- com service_role, que não passa por RLS.
drop policy if exists equipe_total on public.eventos;
create policy equipe_total on public.eventos
  for all to authenticated
  using      (eh_equipe())
  with check (eh_equipe());

drop policy if exists cliente_escopo on public.eventos;
create policy cliente_escopo on public.eventos
  for all to authenticated
  using      (cliente_id = cliente_do_usuario())
  with check (cliente_id = cliente_do_usuario());

-- ============================================================
-- A MIGRAÇÃO CONFERE O PRÓPRIO EFEITO E ABORTA SE NÃO BATER
-- ============================================================
-- Herdado da 052. E com a ressalva que a 053 pagou para aprender: isto prova
-- o que o BANCO faz, não o que o APP faz. O DoD do app está nos testes de
-- `evento.ts` e `eventos.ts`, e a prova de que o fio existe de ponta a ponta
-- só acontece com uma sessão real gravando uma linha aqui.
do $$
declare
  politicas integer;
  colunas   integer;
begin
  select count(*) into politicas
    from pg_policies
   where schemaname = 'public'
     and tablename  = 'eventos'
     and policyname in ('equipe_total', 'cliente_escopo');

  if politicas <> 2 then
    raise exception 'esperava 2 politicas em eventos, encontrei %', politicas;
  end if;

  select count(*) into colunas
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'eventos'
     and column_name in ('tipo', 'origem', 'severidade', 'mensagem', 'contexto', 'repeticoes');

  if colunas <> 6 then
    raise exception 'esperava 6 colunas de conteudo em eventos, encontrei %', colunas;
  end if;
end $$;

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('054', '054-o-sistema-conta-o-que-falhou', now(),
        'Tabela eventos: o destino que nao existia. Medido em 04/08: 146 catch, 50 console.error e 9 rotas, nenhuma recebendo erro do navegador — toda instrumentacao terminava no cliente e o dono virava o sensor ("peca o console da lojista"). Mensagem redigida no dominio (erro de banco carrega dado: Key (sku)=(...)). Agrega repeticoes para nao inundar. Tabela nova = lado seguro da defasagem, ao contrario da 053.')
on conflict do nothing;

-- ============================================================
-- Rollback
-- ============================================================
--   drop table if exists public.eventos;
--
-- Nenhum dado existente é tocado, e nada lê esta tabela além da tela nova —
-- derrubá-la devolve o estado anterior por completo, inclusive a necessidade
-- de pedir print, que é o motivo de ela existir.
-- ============================================================
