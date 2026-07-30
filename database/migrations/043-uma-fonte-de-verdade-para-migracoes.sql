-- ============================================================
-- Zion OS — Migração 043: uma fonte de verdade para migrações (DB-FIX-003)
--
-- INCREMENTAL. NÃO destrutiva. Cria uma view e documenta uma regra.
--
-- ============================================================
-- O PROBLEMA
-- ============================================================
--
-- Duas coisas registram migrações neste banco, e elas discordavam:
--
--   public.migracoes_aplicadas               o ledger do projeto (migração 024)
--   supabase_migrations.schema_migrations    subproduto do CLI/MCP do Supabase
--
-- A 035 foi aplicada por `apply_migration`, entrou no segundo e NÃO entrou no
-- primeiro. Ninguém percebeu por dois dias — até a DB-AUDIT-001 conferir o schema
-- em vez de acreditar no registro.
--
-- ============================================================
-- A CAUSA RAIZ NÃO É "FALTOU DISCIPLINA"
-- ============================================================
--
-- Registrar no ledger era um PASSO SEPARADO de aplicar. Passo separado se
-- esquece — e quando esquece não acontece nada, porque um ledger desatualizado
-- não quebra tela nenhuma. É o mesmo modo de falha da 005: silencioso por
-- construção.
--
-- Documentar "lembre-se de atualizar o ledger" seria repetir o erro com mais
-- palavras.
--
-- ============================================================
-- A REGRA, e por que ela funciona
-- ============================================================
--
--   TODA MIGRAÇÃO DAQUI EM DIANTE INSERE A PRÓPRIA LINHA NO LEDGER, COMO ÚLTIMA
--   INSTRUÇÃO DO PRÓPRIO ARQUIVO.
--
-- Não é convenção de processo, é conteúdo do arquivo. Se a migração rodou, a
-- linha existe; se não rodou, não existe. Some a janela entre "aplicou" e
-- "registrou", que é onde a 035 caiu.
--
-- `on conflict do nothing` mantém a migração reexecutável.
--
-- Modelo para copiar no fim de cada migração nova:
--
--   insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
--   values ('0NN', '0NN-nome-do-arquivo', now(), 'o que ela faz, em uma linha')
--   on conflict do nothing;
--
-- ============================================================
-- QUEM MANDA
-- ============================================================
--
-- `public.migracoes_aplicadas` é a FONTE DE VERDADE. Ela cobre 001–043;
-- `schema_migrations` só conhece o que passou por `apply_migration` (033 em
-- diante) e nada sabe do que foi rodado à mão no SQL Editor.
--
-- `schema_migrations` NÃO é sincronizada por esta migração e não deve ser. É
-- tabela da plataforma, e escrever nela para "alinhar" criaria uma terceira
-- versão da história. Ela vira o que sempre foi: um log da ferramenta.
--
-- ============================================================
-- E A DETECÇÃO
-- ============================================================
--
-- A regra previne o caso novo. Para o caso que já existe — e para qualquer
-- aplicação feita fora do padrão — a view abaixo transforma arqueologia em uma
-- consulta.
--
-- Ela NÃO é exposta ao portal: sem grant para `anon`/`authenticated`, só
-- `postgres` e `service_role` leem. É ferramenta de operador, não recurso de app.
-- ============================================================

create or replace view public.migracoes_divergencia as
with ferramenta as (
  select
    version,
    name,
    (regexp_match(name, '_(\d{3})$'))[1] as numero
  from supabase_migrations.schema_migrations
)
select
  coalesce(l.numero, f.numero)                       as numero,
  l.nome                                             as no_ledger,
  f.name                                             as na_ferramenta,
  case
    when f.numero is null and f.name is not null then
      'na ferramenta sem numero no nome — nao da para casar (use o sufixo _NNN)'
    when f.name is null then
      'so no ledger — aplicada a mao no SQL Editor, o que e legitimo'
    when l.numero is null then
      'SO NA FERRAMENTA — O LEDGER ESTA DESATUALIZADO'
    else 'nas duas'
  end                                                as situacao
from public.migracoes_aplicadas l
full outer join ferramenta f on f.numero = l.numero
order by 1 nulls last;

comment on view public.migracoes_divergencia is
  'Ledger (fonte de verdade) x log do CLI/MCP. Linha com "SO NA FERRAMENTA" significa migracao aplicada e nao registrada — foi assim que a 035 se perdeu.';

-- Sem grants: `anon` e `authenticated` não leem. Só operador.
revoke all on public.migracoes_divergencia from public, anon, authenticated;

-- ---------- a prova ----------

do $$
declare desalinhadas int;
begin
  select count(*) into desalinhadas
    from public.migracoes_divergencia
   where situacao like 'SO NA FERRAMENTA%';

  if desalinhadas > 0 then
    raise exception
      'MIGRACAO 043: % migracao(oes) aplicadas e ausentes do ledger. Registre antes de seguir.',
      desalinhadas;
  end if;

  raise notice '043 conferida: ledger e ferramenta alinhados.';
end $$;

-- ---------- a regra, exercida por esta própria migração ----------

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('043', '043-uma-fonte-de-verdade-para-migracoes', now(),
        'ledger vira fonte de verdade; toda migracao passa a registrar a si mesma; view de divergencia para o passado')
on conflict do nothing;

-- ============================================================
-- Conferência
-- ============================================================
-- select * from public.migracoes_divergencia where situacao <> 'nas duas';
-- Esperado: nenhuma linha 'SO NA FERRAMENTA'. As 'so no ledger' são normais
-- (001–032 foram aplicadas à mão, antes de o MCP existir no fluxo).
