-- 087 — A CAIXA DE CORREIO DO MERCADO LIVRE
--
-- ===========================================================================
-- POR QUE ESTA TABELA EXISTE
-- ===========================================================================
--
-- A operação de marketplace da casa descobre o que mudou VARRENDO: um vigia
-- local pergunta ao ML, de 5 em 5 minutos, se algum anúncio mudou de preço,
-- se alguma campanha voltou sozinha, se entrou venda. Isso tem dois custos.
-- O primeiro é a cota: o rate limit do ML é de 18.000 requisições por hora
-- POR APLICAÇÃO — não por conta —, e hoje 8 contas dividem essa cota
-- perguntando "mudou alguma coisa?". O segundo é o atraso: o que acontece
-- às 14h02 só é visto às 14h05, e campanha recriada sozinha pode rodar uma
-- tarde inteira antes de alguém ver.
--
-- O ML oferece o contrário disso: ele AVISA. O que faltava era um endereço
-- que sempre responda — e o vigia não serve, porque mora numa máquina que
-- desliga.
--
-- ===========================================================================
-- O CONTRATO QUE O ML IMPÕE, E QUE DESENHA ESTA TABELA
-- ===========================================================================
--
-- Três frases da documentação decidem tudo:
--
--   "200 em até 500 ms" — senão o ML DESATIVA os tópicos, em silêncio, e é
--   preciso assinar de novo.
--
--   "O corpo não traz o dado — traz o caminho." A notificação diz
--   `resource: /items/MLB123`, e quem quiser o detalhe faz um GET depois.
--
--   Retentativas por 1 hora, oito tentativas; depois a mensagem é DESCARTADA.
--
-- Daí sai a forma: esta tabela é uma CAIXA DE CORREIO, não um processador. A
-- rota recebe, grava e responde. Quem lê e decide é o zion-ml, que roda na
-- máquina onde os tokens das contas de cliente vivem — e eles não saem de lá.
--
-- ===========================================================================
-- O QUE NÃO ENTRA, E POR QUÊ
-- ===========================================================================
--
-- Não há coluna para o DADO do recurso (preço novo, status novo). Guardar
-- aqui exigiria que este servidor tivesse o token da conta do cliente, e o
-- desenho inteiro existe para que ele NÃO tenha. O que vaza daqui, se vazar,
-- é um aviso de que algo mudou — não credencial e não dado de cliente.
--
-- Não há `cliente_id`. A notificação traz o `user_id` do vendedor no ML, e o
-- mapeamento user_id -> cliente mora no zion-ml. Duplicá-lo aqui criaria duas
-- fontes de verdade sobre de quem é a conta, que é exatamente o erro que a
-- regra "um slug, uma conta" existe para impedir.

create table if not exists public.ml_notificacoes (
  id              bigserial primary key,

  -- O `_id` que o ML manda. É a chave de deduplicação: as 8 tentativas de
  -- uma mesma notificação chegam com o MESMO _id, e sem unicidade uma
  -- resposta lenta viraria oito linhas do mesmo evento.
  notificacao_id  text        not null unique,

  topico          text        not null,
  recurso         text        not null,
  user_id_ml      text        not null,
  application_id  text,

  -- `attempts` do ML. Vale mais do que parece: chegar com attempts > 1
  -- significa que a tentativa anterior NÃO recebeu 200 — é o sintoma de
  -- que estamos perto de ter os tópicos desativados.
  tentativas      integer,

  enviado_em      timestamptz,          -- `sent`, no relógio do ML (UTC)
  recebido_em     timestamptz not null default now(),

  -- NULL enquanto ninguém consumiu. É o que separa a caixa de correio de um
  -- log: aqui existe pendente, e pendente é o que o zion-ml vem buscar.
  processado_em   timestamptz,

  corpo           jsonb       not null
);

-- A única pergunta que esta tabela responde em caminho quente: "o que chegou
-- e ainda não foi processado?". Parcial porque a tabela cresce para sempre e
-- a parte pendente é sempre pequena.
create index if not exists ml_notificacoes_pendentes_idx
  on public.ml_notificacoes (id)
  where processado_em is null;

-- Segunda pergunta, fria: "o que chegou deste vendedor neste tópico?", para
-- investigar um caso específico depois.
create index if not exists ml_notificacoes_vendedor_idx
  on public.ml_notificacoes (user_id_ml, topico, recebido_em desc);

alter table public.ml_notificacoes enable row level security;

-- Sem policy de propósito: RLS ligada e nenhuma policy significa que ninguém
-- lê por sessão de usuário. Quem escreve é a rota do callback e quem lê é o
-- dreno — os dois com service_role, que ignora RLS. Um cliente do portal não
-- tem pergunta a fazer a esta tabela, e no dia em que tiver, a policy que
-- nascer vai precisar dizer de qual cliente é cada linha, o que hoje esta
-- tabela deliberadamente não sabe.

comment on table public.ml_notificacoes is
  'Caixa de correio das notificações do Mercado Livre. A rota /ml-callback-zionml grava e responde 200 em menos de 500 ms; o zion-ml consome pelo dreno e busca o detalhe com o token da conta. Não guarda dado de cliente, só o aviso de que algo mudou.';
comment on column public.ml_notificacoes.notificacao_id is
  'O `_id` do ML. Único: as retentativas da mesma notificação trazem o mesmo valor.';
comment on column public.ml_notificacoes.recurso is
  'O `resource` do ML — o CAMINHO do que mudou (ex.: /items/MLB123), não o dado.';
comment on column public.ml_notificacoes.tentativas is
  '`attempts` do ML. Maior que 1 significa que a tentativa anterior não recebeu 200.';
comment on column public.ml_notificacoes.processado_em is
  'NULL = o zion-ml ainda não consumiu. É o que torna esta tabela uma fila, e não um log.';
