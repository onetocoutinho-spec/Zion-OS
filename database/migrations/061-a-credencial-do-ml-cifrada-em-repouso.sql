-- 061 — a credencial do Mercado Livre cifrada em repouso
--
-- Hardening pós-auditoria (ZION-SECRET-001, passo seguinte à 059).
--
-- ============================================================
-- O QUE A 059 FECHOU, E O QUE ELA NÃO FECHA
-- ============================================================
--
-- A 059 tirou `refresh_token` do alcance do navegador: só `service_role` lê
-- a coluna. Isso fecha o PostgREST. Não fecha um dump do banco, um backup
-- copiado, um `select *` no SQL Editor por quem tem acesso ao projeto, nem
-- o log de uma query. Em todos esses a coluna ainda está em texto puro.
--
-- ============================================================
-- O DESENHO
-- ============================================================
--
-- 1. Uma CHAVE no Vault (`ml_refresh_token_key`), gerada aqui, aleatória,
--    que nunca sai do banco. O Vault a guarda cifrada com a chave raiz do
--    projeto; só `postgres`/`service_role` leem `vault.decrypted_secrets`.
--
-- 2. A coluna `refresh_token_cifrado bytea`: `pgp_sym_encrypt(token, chave)`.
--    Quem copiar a tabela leva bytes; sem o Vault, nada.
--
-- 3. QUATRO FUNÇÕES, e nenhum acesso direto à coluna:
--      ml_credencial_ler(cliente, marketplace)          -> text
--      ml_credencial_gravar(cliente, marketplace, token, seller_id)
--      ml_credencial_rotacionar(cliente, marketplace, token)
--      ml_credencial_limpar(cliente, marketplace)
--    SECURITY DEFINER, `search_path` fixo, EXECUTE só para `service_role`.
--    O tenant vem como argumento porque o chamador é o servidor, DEPOIS de
--    `exigirAcessoAoCliente` — a mesma divisão da 059/060.
--
-- 4. O texto puro é copiado para o cifrado AQUI, e a coluna antiga FICA até
--    a 062: o código no ar ainda a lê. Ordem: 061 -> deploy -> 062.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- a chave, uma vez ----------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'ml_refresh_token_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'ml_refresh_token_key',
      'Chave simetrica de canais_marketplace.refresh_token_cifrado (061). Nunca sai do banco.'
    );
  end if;
end $$;

-- `pgcrypto` no Supabase vive no schema `extensions`: as funções que cifram
-- levam `extensions` no search_path fixo, e o SQL de topo qualifica.

-- ---------- a coluna ----------
alter table public.canais_marketplace
  add column if not exists refresh_token_cifrado bytea;

-- Nenhum papel de navegador alcança a coluna cifrada — a 059 já deixou a
-- tabela com grants por coluna; a coluna nova simplesmente não entra neles.

-- ---------- a chave, lida só por quem define ----------
create or replace function public.ml_chave_da_credencial()
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'ml_refresh_token_key';
$$;
revoke execute on function public.ml_chave_da_credencial() from public, anon, authenticated, service_role;
-- só as funções abaixo (mesmo dono) a chamam; ninguém a executa pela API.

-- ---------- as quatro funções ----------
create or replace function public.ml_credencial_ler(p_cliente uuid, p_marketplace text default 'Mercado Livre')
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  select case when refresh_token_cifrado is null then null
              else pgp_sym_decrypt(refresh_token_cifrado, public.ml_chave_da_credencial()) end
    from public.canais_marketplace
   where cliente_id = p_cliente and marketplace = p_marketplace;
$$;

create or replace function public.ml_credencial_gravar(
  p_cliente uuid, p_marketplace text, p_token text, p_seller_id text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
begin
  if p_token is null or p_token = '' then
    raise exception 'token vazio';
  end if;
  insert into public.canais_marketplace (cliente_id, marketplace, refresh_token_cifrado, seller_id, ativo, atualizado_em)
  values (p_cliente, p_marketplace, pgp_sym_encrypt(p_token, public.ml_chave_da_credencial()), p_seller_id, true, now())
  on conflict (cliente_id, marketplace) do update
     set refresh_token_cifrado = excluded.refresh_token_cifrado,
         seller_id             = coalesce(excluded.seller_id, public.canais_marketplace.seller_id),
         ativo                 = true,
         atualizado_em         = now();
end $$;

create or replace function public.ml_credencial_rotacionar(p_cliente uuid, p_marketplace text, p_token text)
returns void
language sql
volatile
security definer
set search_path = public, extensions
as $$
  update public.canais_marketplace
     set refresh_token_cifrado = pgp_sym_encrypt(p_token, public.ml_chave_da_credencial()),
         atualizado_em = now()
   where cliente_id = p_cliente and marketplace = p_marketplace and p_token is not null and p_token <> '';
$$;

create or replace function public.ml_credencial_limpar(p_cliente uuid, p_marketplace text default 'Mercado Livre')
returns void
language sql
volatile
security definer
set search_path = public, extensions
as $$
  update public.canais_marketplace
     set refresh_token_cifrado = null, ativo = false, atualizado_em = now()
   where cliente_id = p_cliente and marketplace = p_marketplace;
$$;

revoke execute on function public.ml_credencial_ler(uuid, text)                from public, anon, authenticated;
revoke execute on function public.ml_credencial_gravar(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.ml_credencial_rotacionar(uuid, text, text)   from public, anon, authenticated;
revoke execute on function public.ml_credencial_limpar(uuid, text)             from public, anon, authenticated;
grant  execute on function public.ml_credencial_ler(uuid, text)                to service_role;
grant  execute on function public.ml_credencial_gravar(uuid, text, text, text) to service_role;
grant  execute on function public.ml_credencial_rotacionar(uuid, text, text)   to service_role;
grant  execute on function public.ml_credencial_limpar(uuid, text)             to service_role;

-- ---------- copia o que existe em texto puro ----------
update public.canais_marketplace
   set refresh_token_cifrado = extensions.pgp_sym_encrypt(refresh_token, public.ml_chave_da_credencial())
 where refresh_token is not null and refresh_token_cifrado is null;

-- ---------- a prova ----------
do $$
declare
  sem_copia int;
  nav boolean;
begin
  select count(*) into sem_copia from public.canais_marketplace
   where refresh_token is not null and refresh_token_cifrado is null;
  if sem_copia > 0 then
    raise exception 'MIGRACAO 061 INCOMPLETA: % credencial(is) sem copia cifrada.', sem_copia;
  end if;

  -- ida e volta: o que foi cifrado volta igual
  if exists (select 1 from public.canais_marketplace
              where refresh_token is not null
                and extensions.pgp_sym_decrypt(refresh_token_cifrado, public.ml_chave_da_credencial()) <> refresh_token) then
    raise exception 'MIGRACAO 061 INCOMPLETA: decifrar nao devolve o original.';
  end if;

  select bool_or(has_function_privilege(r, f, 'execute')) into nav
    from unnest(array['anon','authenticated']) r,
         unnest(array['public.ml_credencial_ler(uuid,text)',
                      'public.ml_credencial_gravar(uuid,text,text,text)',
                      'public.ml_credencial_rotacionar(uuid,text,text)',
                      'public.ml_credencial_limpar(uuid,text)',
                      'public.ml_chave_da_credencial()']) f;
  if nav then
    raise exception 'MIGRACAO 061 INCOMPLETA: funcao de credencial executavel pelo navegador.';
  end if;
  raise notice '061 conferida: chave no Vault, copia cifrada integra, funcoes so por service_role.';
end $$;

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('061', '061-a-credencial-do-ml-cifrada-em-repouso', now(),
        'Hardening pos-059. Chave simetrica no Vault (ml_refresh_token_key), coluna refresh_token_cifrado (pgp_sym_encrypt) e quatro funcoes SECURITY DEFINER (ler/gravar/rotacionar/limpar) executaveis so por service_role — o servidor para de tocar na coluna e passa a chamar as funcoes. Texto puro copiado para o cifrado e MANTIDO ate a 062, porque o codigo no ar ainda o le. Ordem: 061 -> deploy -> 062.')
on conflict do nothing;

-- Rollback lógico: as funções podem ficar; `alter table ... drop column
-- refresh_token_cifrado` e o código volta a ler `refresh_token` (que a 061
-- não apagou). A chave no Vault pode ficar: não serve para nada sem a coluna.
