-- 087 — a fila só aceita o produto do mesmo cliente
--
-- ============================================================
-- ACHADO 1 DA AUDITORIA DE ISOLAMENTO (06/09/2026)
-- ============================================================
--
-- `fila_otimizacao_produto` (migração 012) tem duas colunas de posse na MESMA
-- linha — `cliente_id` e `produto_id` — e nada nunca conferiu que elas
-- concordam entre si:
--
--   * A policy de RLS (`012:34-37`, mantida pela 041/016) é
--     `with check (cliente_id = cliente_do_usuario() or eh_equipe())` — valida
--     só o `cliente_id`, nunca a relação com `produto_id`.
--   * O worker do cron (`otimizar/worker/route.ts`, `service_role`, ignora
--     RLS) lê o produto só por `id`, sem filtrar por `cliente_id` da fila.
--
-- Consequência: um usuário autenticado com papel `cliente` podia inserir uma
-- linha com `cliente_id = <o próprio>` e `produto_id = <de qualquer outro
-- tenant>` — a RLS deixava passar porque nunca olhava o `produto_id`, e o
-- worker processava sem revalidar posse, gerando (dentro do tenant do
-- atacante) um rascunho de anúncio derivado do produto real de outro
-- cliente.
--
-- É o mesmo formato do incidente de 29/07/2026 (a policy `equipe_autenticada
-- using(true)` que a 041 fechou): uma camada confiou que a anterior já tinha
-- validado, e nenhuma das duas validou o PAR completo.
--
-- ============================================================
-- POR QUE É UM TRIGGER, E NÃO SÓ UMA POLICY MELHOR
-- ============================================================
--
-- A RLS só protege quem passa pelo PostgREST com uma sessão autenticada. O
-- worker do cron usa `service_role`, que ignora RLS por desenho — não dá para
-- fechar o buraco só na policy. Um trigger `BEFORE INSERT OR UPDATE` roda para
-- QUALQUER caminho de escrita na tabela, `service_role` incluído. É o único
-- lugar em que a regra `cliente_id ↔ produto_id` é SEMPRE verdadeira,
-- independente de qual código grava na fila hoje ou escrever amanhã.
--
-- `security definer` com `search_path` fixo: a checagem lê `public.produtos`
-- SEM depender da visibilidade RLS de quem disparou a escrita (um `cliente`
-- só enxerga os próprios produtos via RLS — se o trigger rodasse com o
-- privilégio do chamador, a comparação ficaria "existe uma linha que EU vejo"
-- em vez de "existe uma linha, ponto", o que é uma pergunta diferente e mais
-- fraca).
--
-- ============================================================
-- POR QUE COBRE INSERT *E* UPDATE
-- ============================================================
--
-- `enfileirarProdutos` (`src/lib/services/filaOtimizacaoProduto.ts:31-34`)
-- grava com `upsert(..., { onConflict: "produto_id" })` — reenfileirar um
-- produto já na fila é um UPDATE, não um INSERT. Um trigger só de INSERT
-- deixaria uma segunda porta aberta: gravar a linha "certa" primeiro e depois
-- fazer UPDATE trocando o `produto_id` para o de outro tenant. O worker nunca
-- muda `produto_id`/`cliente_id` em seus UPDATEs (só `status`, `tentativas`,
-- `erro`, `anuncio_id` — conferido em `otimizar/worker/route.ts`), então
-- cobrir UPDATE não quebra o caminho normal: a revalidação nesses casos só
-- confirma um par que já era válido.
--
-- ============================================================
-- O QUE ISTO NÃO CONSERTA
-- ============================================================
--
-- Não é uma migração de dados: não apaga nem corrige linha nenhuma que já
-- exista hoje em `fila_otimizacao_produto` com o par errado. O trigger só
-- vale para escritas NOVAS, a partir de quando esta migração rodar. Se a
-- suspeita é que já existe dado sujo, a conferência abaixo (seção
-- CONFERÊNCIA) responde isso — rode ANTES de aplicar, para não confundir
-- "o trigger não travou nada" com "não havia nada para travar".
--
-- Não é o único lugar com o padrão de duas FKs para tenants diferentes sem
-- constraint cruzando as duas — a auditoria não teve escopo para varrer as
-- 57 tabelas procurando por outras ocorrências (fica como exercício futuro).

-- ============================================================
-- A REGRA
-- ============================================================

create or replace function public.fila_otimizacao_valida_posse()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
      from public.produtos p
     where p.id = new.produto_id
       and p.cliente_id = new.cliente_id
  ) then
    raise exception
      'produto_de_outro_tenant: o produto % nao pertence ao cliente % — a fila so aceita produto do mesmo cliente que o enfileira.',
      new.produto_id, new.cliente_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.fila_otimizacao_valida_posse() from public, anon, authenticated;
-- Sem grant explícito de EXECUTE a mais ninguém: funções de trigger são
-- chamadas pelo próprio mecanismo de trigger do Postgres, não por SQL direto
-- — não precisam de GRANT para quem escreve na tabela.

drop trigger if exists trg_fila_otimizacao_valida_posse on public.fila_otimizacao_produto;
create trigger trg_fila_otimizacao_valida_posse
  before insert or update on public.fila_otimizacao_produto
  for each row execute function public.fila_otimizacao_valida_posse();

comment on function public.fila_otimizacao_valida_posse() is
  'Achado 1 (auditoria de isolamento, 06/09/2026): recusa INSERT/UPDATE em fila_otimizacao_produto cujo produto_id nao pertenca ao cliente_id da mesma linha. security definer + search_path fixo para nao depender da visibilidade RLS de quem escreve (cobre tambem o worker, que usa service_role).';

-- ============================================================
-- CONFERÊNCIA
-- ============================================================
--
-- Antes de aplicar em produção, rode para saber se já existe dado sujo (o
-- trigger, por si só, não retroage sobre linhas existentes):
--
--   select f.id, f.cliente_id, f.produto_id, p.cliente_id as dono_real
--     from public.fila_otimizacao_produto f
--     join public.produtos p on p.id = f.produto_id
--    where p.cliente_id <> f.cliente_id;
--
-- Tem que voltar vazio. Se não vier vazio, cada linha encontrada é uma
-- exploração real do achado 1 e precisa de decisão own (apagar a linha da
-- fila, e avaliar se o anúncio gerado a partir dela já foi publicado) antes
-- de seguir — apagar a linha sem investigar o que ela já gerou seria esconder
-- o sintoma, não a causa.
--
-- Depois de aplicar, a mesma inserção cruzada tem que falhar com
-- `produto_de_outro_tenant` — ver `087-verificacao-da-fila.sql`.

-- ============================================================
-- O LEDGER (regra da 043: a propria migracao registra a propria linha)
-- ============================================================

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('087', '087-a-fila-so-aceita-o-produto-do-mesmo-cliente', now(),
        'Trigger BEFORE INSERT OR UPDATE em fila_otimizacao_produto (achado 1): recusa a linha se produto_id nao pertencer ao cliente_id da mesma linha. security definer para valer tambem para o worker (service_role, ignora RLS). Nao corrige linha existente — so escritas novas.')
on conflict do nothing;
