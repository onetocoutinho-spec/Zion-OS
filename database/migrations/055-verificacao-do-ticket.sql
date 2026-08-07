-- 055 — a prova de que o ticket não é um dado do navegador
--
-- ============================================================
-- O QUE PRECISA SER VERDADE
-- ============================================================
--
-- O ticket existe para substituir um `state` que o navegador controla. Se
-- qualquer uma destas falhar, ele não substitui nada:
--
--   1. ninguém cria ticket para loja que não alcança
--   2. ninguém cria ticket em nome de outro usuário
--   3. consumir devolve a loja — e QUEIMA
--   4. consumir de novo não devolve nada (uso único, inclusive em corrida)
--   5. consumir ticket de outro não devolve nada
--   6. ticket vencido não devolve nada
--   7. o navegador não consegue queimar nem apagar por conta própria
--
-- Roda dentro de uma transação que termina em ROLLBACK: seguro em produção.

begin;

-- (aqui vai o conteúdo da 055, quando rodado antes de aplicá-la)

do $cenario$
declare
  ag    uuid := '0000a1fa-0000-4000-8000-000000000001';
  lojaA uuid := '0000a1fa-0000-4000-8000-00000000a001';
  lojaX uuid := '0000eeee-0000-4000-8000-00000000e001';
  uAg   uuid := '0000a1fa-0000-4000-8000-000000000f01';
  uOut  uuid := '0000eeee-0000-4000-8000-000000000f09';
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
    (uAg,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ag@teste.invalid',now(),now()),
    (uOut, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','out@teste.invalid',now(),now());
  insert into public.agencias (id, nome) values (ag, 'Alfa');
  insert into public.clientes (id, empresa, agencia_id) values
    (lojaA, 'Loja da Alfa', ag),
    (lojaX, 'Loja de terceiro', null);
  insert into public.perfis (id, papel, cliente_id, agencia_id, nome, ativo) values
    (uAg,  'agencia', null,  ag,   'Op Alfa', true),
    (uOut, 'cliente', lojaX, null, 'Terceiro', true);
end $cenario$;

do $t$
declare r text := ''; falhou boolean := false; n int; loja uuid; pols int;
begin
  -- ---------- estrutura ----------
  select count(*) into pols from pg_policies
   where schemaname='public' and tablename='ml_conexoes_pendentes' and cmd in ('UPDATE','DELETE');
  r := r || format('%s politicas de UPDATE/DELETE: %s (esperado 0)%s',
                   case when pols=0 then 'ok' else 'X ' end, pols, chr(10));
  if pols <> 0 then falhou := true; end if;

  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims','{"sub":"0000a1fa-0000-4000-8000-000000000f01","role":"authenticated"}',true);

  -- ---------- 1) ticket para loja que alcanca ----------
  begin
    insert into public.ml_conexoes_pendentes (ticket, cliente_id, usuario_id)
    values ('tk-bom', '0000a1fa-0000-4000-8000-00000000a001', '0000a1fa-0000-4000-8000-000000000f01');
    r := r || 'ok agencia cria ticket para a loja dela' || chr(10);
  exception when others then
    r := r || 'X  agencia NAO conseguiu criar ticket da propria loja' || chr(10); falhou := true;
  end;

  -- ---------- 2) ticket para loja de TERCEIRO ----------
  begin
    insert into public.ml_conexoes_pendentes (ticket, cliente_id, usuario_id)
    values ('tk-invasor', '0000eeee-0000-4000-8000-00000000e001', '0000a1fa-0000-4000-8000-000000000f01');
    r := r || 'X  criou ticket para loja de TERCEIRO — o OAuth gravaria no lugar errado' || chr(10);
    falhou := true;
  exception when insufficient_privilege then
    r := r || 'ok recusa ticket para loja de terceiro' || chr(10);
  end;

  -- ---------- 3) ticket em nome de OUTRO usuario ----------
  begin
    insert into public.ml_conexoes_pendentes (ticket, cliente_id, usuario_id)
    values ('tk-falso', '0000a1fa-0000-4000-8000-00000000a001', '0000eeee-0000-4000-8000-000000000f09');
    r := r || 'X  criou ticket em nome de outro usuario' || chr(10); falhou := true;
  exception when insufficient_privilege then
    r := r || 'ok recusa ticket em nome de terceiro' || chr(10);
  end;

  -- ---------- 4) consumir devolve a loja e QUEIMA ----------
  select c.cliente_id into loja from public.consumir_ticket_ml('tk-bom') c;
  r := r || format('%s consumir devolveu a loja certa%s',
                   case when loja = '0000a1fa-0000-4000-8000-00000000a001' then 'ok' else 'X ' end, chr(10));
  if loja is distinct from '0000a1fa-0000-4000-8000-00000000a001'::uuid then falhou := true; end if;

  select count(*) into n from public.consumir_ticket_ml('tk-bom');
  r := r || format('%s consumir DE NOVO devolveu %s linhas (esperado 0)%s',
                   case when n=0 then 'ok' else 'X ' end, n, chr(10));
  if n <> 0 then falhou := true; end if;

  -- ---------- 5) ticket de OUTRO usuario ----------
  perform set_config('role','postgres',true);
  insert into public.ml_conexoes_pendentes (ticket, cliente_id, usuario_id)
  values ('tk-do-outro', '0000eeee-0000-4000-8000-00000000e001', '0000eeee-0000-4000-8000-000000000f09');
  perform set_config('role','authenticated',true);

  select count(*) into n from public.consumir_ticket_ml('tk-do-outro');
  r := r || format('%s consumir ticket de OUTRO devolveu %s (esperado 0)%s',
                   case when n=0 then 'ok' else 'X ' end, n, chr(10));
  if n <> 0 then falhou := true; end if;

  -- ---------- 6) ticket VENCIDO ----------
  perform set_config('role','postgres',true);
  insert into public.ml_conexoes_pendentes (ticket, cliente_id, usuario_id, expira_em)
  values ('tk-vencido', '0000a1fa-0000-4000-8000-00000000a001',
          '0000a1fa-0000-4000-8000-000000000f01', now() - interval '1 minute');
  perform set_config('role','authenticated',true);

  select count(*) into n from public.consumir_ticket_ml('tk-vencido');
  r := r || format('%s ticket vencido devolveu %s (esperado 0)%s',
                   case when n=0 then 'ok' else 'X ' end, n, chr(10));
  if n <> 0 then falhou := true; end if;

  -- ---------- 7) o navegador nao queima nem apaga ----------
  begin
    update public.ml_conexoes_pendentes set usado_em = null where ticket = 'tk-vencido';
    get diagnostics n = row_count;
    r := r || format('%s update direto afetou %s linhas (esperado 0)%s',
                     case when n=0 then 'ok' else 'X ' end, n, chr(10));
    if n <> 0 then falhou := true; end if;
  exception when insufficient_privilege then
    r := r || 'ok update direto recusado' || chr(10);
  end;

  perform set_config('role','postgres',true);
  raise exception E'\n=== RESULTADO (%) ===\n%',
    case when falhou then 'ALGUMA FALHOU' else 'TODAS PASSARAM' end, r;
end $t$;

rollback;
