-- ============================================================
-- 051 — o Zion LEMBRA o que leu do marketplace
-- ============================================================
--
-- O DEFEITO
-- ---------
-- Em 02–03/08/2026 a leitura completa da conta produziu, pela primeira vez, um
-- retrato honesto da loja:
--
--     6 anúncios cancelados por infração de propriedade intelectual
--     150 aguardando correção · 60 sem estoque · 21 pausados por ela
--     341 capas fora do padrão · 3.751 peças paradas atrás disso
--
-- E TUDO ISSO FOI JOGADO FORA. Nada disso é gravado: a medição vive na memória
-- da aba e some num F5.
--
-- Para a lojista, isso significa que ela não opera — ela RECONSULTA:
--
--   · precisa rodar "Conferir agora" (781 anúncios, ~40 requisições ao ML)
--     toda vez que quiser ver qualquer coisa;
--   · não consegue abrir de manhã e ver o que mudou desde ontem;
--   · não sabe se o que fez ontem funcionou;
--   · "faltavam 341, agora faltam 320" é impossível de dizer.
--
-- A migração 050 deu memória ao ESTADO (`active`, `paused`…). Esta dá memória
-- ao PORQUÊ e ao que decide a ordem do trabalho.
--
-- O QUE ENTRA, E POR QUE CADA UM
-- ------------------------------
--   sub_status_marketplace   a palavra do ML sobre por que não está no ar:
--                            `forbidden`, `waiting_for_patch`, `out_of_stock`.
--                            É o mesmo campo que revelou as 6 infrações, e hoje
--                            some a cada leitura.
--
--   foto_capa_max_size       o tamanho REAL da capa, que o ML declara em
--                            `max_size`. Sem ele, a lista de fotos a refazer
--                            precisa de uma releitura inteira da conta.
--
--   estoque_marketplace      o estoque NO ML. É ele que ordena o trabalho — as
--                            802 peças do Chinelo Ortopédico vêm antes das 3 de
--                            outro. O estoque do ERP não serve: o que interessa
--                            é o que está parado NA VITRINE.
--
-- QUANDO foi lido já existe: `status_marketplace_em`, da 050. Os quatro campos
-- são preenchidos na MESMA leitura, então uma data só descreve todos.
--
-- AS MESMAS TRÊS REGRAS DA 050
-- ----------------------------
-- NULLABLE, SEM DEFAULT, SEM BACKFILL.
--
-- `NULL` significa NÃO SABEMOS — nunca "está tudo bem", nunca zero. Um
-- `estoque_marketplace` com default 0 faria toda linha nova nascer afirmando
-- que não há estoque, e a ordem do trabalho sairia errada em silêncio.
--
-- As linhas existentes ficam nulas. Nós não sabemos o sub_status delas HOJE —
-- sabemos o que a leitura de agora diz, e são coisas diferentes. A próxima
-- importação preenche o que ela própria observar.
--
-- RLS: NADA a fazer. A tabela já tem as políticas, e coluna nova herda a linha.
-- Registrado porque "não mexi" é uma afirmação, não um esquecimento.
-- ============================================================

alter table public.anuncios_gerados
  add column if not exists sub_status_marketplace text[];

alter table public.anuncios_gerados
  add column if not exists foto_capa_max_size text;

alter table public.anuncios_gerados
  add column if not exists estoque_marketplace integer;

-- "Quais anúncios deste cliente têm alguma pendência do ML?" é a pergunta que
-- a tela faz. O índice parcial cobre só as linhas que têm resposta.
create index if not exists idx_anuncios_gerados_sub_status
  on public.anuncios_gerados (cliente_id)
  where sub_status_marketplace is not null;

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('051', '051-a-memoria-do-marketplace', now(),
        'anuncios_gerados ganha sub_status_marketplace, foto_capa_max_size e estoque_marketplace (nullable, sem default, sem backfill). A leitura do ML era medida e descartada: 6 infracoes, 150 aguardando correcao e 341 capas fora do padrao sumiam num F5. Reaproveita status_marketplace_em da 050 como data da leitura. RLS intocada.')
on conflict do nothing;

-- ============================================================
-- Rollback lógico
-- ============================================================
--   drop index if exists idx_anuncios_gerados_sub_status;
--   alter table public.anuncios_gerados drop column if exists estoque_marketplace;
--   alter table public.anuncios_gerados drop column if exists foto_capa_max_size;
--   alter table public.anuncios_gerados drop column if exists sub_status_marketplace;
--
-- Reverter também `AnuncioGeradoRegistro`, o mapeador, e o trecho da importação
-- que grava os três — a tela volta a depender de "Conferir agora".
-- ============================================================
