-- 068 — o perfil de conteúdo da loja
--
-- NÃO APLICADA. Nasceu como arquivo, para o dono aplicar no projeto principal
-- (auditoria do Copilot, 2026-08-22, roadmap NEXT item 7 / trilha 6).
--
-- O QUE MUDA
--
-- Toda loja recebia o MESMO prompt de título e descrição. Não havia onde
-- dizer "a gente fala de você, não de senhora", "nunca escreva 'promoção'",
-- "nosso público é mãe de criança pequena". O Copilot não tinha como
-- responder "como ESTA loja gosta de vender".
--
-- Uma linha por loja, editada pela própria loja na tela de Configurações (e
-- pela agência/equipe, no alcance de cada uma). O servidor lê e injeta nos
-- geradores. Campos de TEXTO LIVRE e listas — sem enum de "tom", porque o
-- tom de uma loja de calçado infantil não cabe em cinco opções.
--
-- Nenhum campo é inferido: o que não foi escrito pela loja não existe.
-- Aprendizado por aprovação/rejeição fica para depois (pattern-detector).
--
-- REVERTER: drop table public.perfis_de_conteudo.

create table if not exists public.perfis_de_conteudo (
  cliente_id          uuid primary key references public.clientes(id) on delete cascade,
  -- "Falamos de você, direto, sem jargão. Somos alegres, não infantis."
  tom                 text,
  -- "Mães de crianças de 1 a 6 anos, classe C, compram pelo celular."
  publico             text,
  -- Palavras que a loja QUER ver: "confortável", "macio", "antiderrapante".
  palavras_preferidas text[] not null default '{}',
  -- Palavras que a loja NÃO quer: "promoção", "barato", "imperdível".
  palavras_proibidas  text[] not null default '{}',
  -- O que mais o gerador precisa saber, em prosa.
  observacoes         text,
  atualizado_em       timestamptz not null default now(),
  atualizado_por      uuid
);

alter table public.perfis_de_conteudo enable row level security;

drop policy if exists cliente_escopo on public.perfis_de_conteudo;
create policy cliente_escopo on public.perfis_de_conteudo
  for all to authenticated
  using (cliente_id = public.cliente_do_usuario())
  with check (cliente_id = public.cliente_do_usuario());

drop policy if exists agencia_escopo on public.perfis_de_conteudo;
create policy agencia_escopo on public.perfis_de_conteudo
  for all to authenticated
  using (cliente_id in (select public.lojas_da_agencia()))
  with check (cliente_id in (select public.lojas_da_agencia()));

drop policy if exists equipe_total on public.perfis_de_conteudo;
create policy equipe_total on public.perfis_de_conteudo
  for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe());

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('068', '068-o-perfil-de-conteudo-da-loja', now(),
        'perfis_de_conteudo: tom, publico, palavras preferidas/proibidas e observacoes por loja, editados na tela de Configuracoes e injetados nos geradores de titulo/descricao pelo servidor. RLS: cliente a propria, agencia o escopo, equipe tudo.')
on conflict do nothing;
