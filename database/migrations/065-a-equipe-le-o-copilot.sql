-- 065 — a equipe lê o Copilot
--
-- NÃO APLICADA. Nasceu como arquivo, para o dono aplicar no projeto principal
-- (auditoria do Copilot, 2026-08-22, roadmap NOW item 3).
--
-- O QUE MUDA
--
-- As cinco tabelas do Copilot (`copilot_conversas`, `copilot_mensagens`,
-- `copilot_propostas`, `copilot_acoes`, `copilot_cadastros`) nasceram na 035
-- com uma policy só: o lojista lê a própria (`cliente_do_usuario()`). A 054
-- acrescentou `agencia_escopo` em toda tabela com `cliente_id` — inclusive
-- nestas. A EQUIPE ficou de fora: `cliente_do_usuario()` é nulo para ela, e
-- não há `equipe_total` aqui, ao contrário do resto do schema.
--
-- Até hoje era invisível, porque a rota do Copilot devolvia 403 para equipe
-- e agência. Com a rota aberta aos dois papéis (mesmo commit), a equipe
-- conseguiria CONVERSAR (a escrita é por service_role) e não conseguiria LER
-- a própria conversa pelo navegador — nem auditar a de ninguém.
--
-- Uma policy de SELECT por tabela, no molde de `equipe_le_consumo` (060).
-- Só leitura: a escrita nas `copilot_*` continua exclusiva do servidor.
--
-- O QUE NÃO MUDA: nenhuma policy existente, nenhuma função, nenhuma coluna.
--
-- REVERTER: drop policy equipe_le_copilot on cada uma das cinco tabelas.

do $$
declare
  t text;
begin
  foreach t in array array[
    'copilot_conversas', 'copilot_mensagens', 'copilot_propostas', 'copilot_acoes', 'copilot_cadastros'
  ] loop
    execute format(
      'drop policy if exists equipe_le_copilot on public.%I', t
    );
    execute format(
      'create policy equipe_le_copilot on public.%I for select to authenticated using (public.eh_equipe())', t
    );
  end loop;
end $$;

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('065', '065-a-equipe-le-o-copilot', now(),
        'Policy equipe_le_copilot (SELECT, eh_equipe()) nas cinco tabelas copilot_*. Aditiva; escrita segue por service_role.')
on conflict do nothing;
