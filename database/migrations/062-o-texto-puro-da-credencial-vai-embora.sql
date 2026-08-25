-- 062 — o texto puro da credencial vai embora
--
-- Segunda metade da 061. SÓ DEPOIS do deploy do código que lê pelas funções
-- `ml_credencial_*`: o código anterior seleciona `refresh_token` pelo nome, e
-- esta migração apaga a coluna.
--
-- Recusa sozinha se sobrar credencial sem cópia cifrada — a 061 já conferiu,
-- mas entre uma e outra o servidor pode ter rotacionado um token, e a
-- rotação do código NOVO grava só no cifrado, enquanto a do código VELHO
-- gravava só no texto puro. Conferir de novo é o que garante que nada se
-- perdeu na janela.

do $$
declare
  orfas int;
begin
  select count(*) into orfas from public.canais_marketplace
   where refresh_token is not null and refresh_token_cifrado is null;
  if orfas > 0 then
    raise exception 'MIGRACAO 062 RECUSADA: % credencial(is) so em texto puro — rode a copia da 061 de novo antes de apagar.', orfas;
  end if;
end $$;

alter table public.canais_marketplace drop column if exists refresh_token;

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='canais_marketplace' and column_name='refresh_token') then
    raise exception 'MIGRACAO 062 INCOMPLETA: refresh_token ainda existe.';
  end if;
  raise notice '062 conferida: canais_marketplace sem texto puro.';
end $$;

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('062', '062-o-texto-puro-da-credencial-vai-embora', now(),
        'DROP da coluna canais_marketplace.refresh_token. A partir daqui a credencial do ML existe so cifrada (refresh_token_cifrado, chave no Vault) e so as funcoes ml_credencial_* a tocam. Aplicada depois do deploy do codigo da 061; recusa se houver credencial sem copia cifrada.')
on conflict do nothing;
