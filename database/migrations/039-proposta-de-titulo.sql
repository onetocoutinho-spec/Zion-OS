-- ============================================================
-- Zion OS — Migração 039: a Proposal também troca TÍTULO
--
-- INCREMENTAL e NÃO DESTRUTIVA. Rode UMA vez no SQL Editor.
--
-- APLICAÇÃO MANUAL. Nada aqui foi aplicado remotamente.
--
-- POR QUE EXISTE
--
-- "Melhore o título desse anúncio" é a primeira intenção do Copilot cujo
-- resultado é TEXTO, não número. As três proteções da Proposal continuam
-- valendo — identidade, precondições, idempotência —, mas duas colunas dela
-- foram desenhadas para dinheiro e peso:
--
--   valor numeric not null   -- gramas ou reais
--   precondicoes jsonb       -- [{campo, valorNaCriacao: number|null}]
--
-- Um título não cabe em `valor`, e "o título atual mudou?" não se responde com
-- um número solto.
--
-- O QUE ESTA MIGRAÇÃO FAZ
--
-- 1. `titulo` entra na lista fechada de tipos.
-- 2. `texto` guarda o conteúdo proposto — o título em si.
-- 3. `valor` continua NOT NULL e passa a carregar, neste tipo, a CONTAGEM DE
--    CARACTERES do título proposto. Não é um zero de enfeite: o limite de 60
--    caracteres do Mercado Livre é a razão de o agente de título existir, e é o
--    número que a auditoria quer ver.
--
-- A PRECONDIÇÃO DE UM TEXTO
--
-- A revalidação continua numérica, e continua sendo revalidação de verdade: a
-- precondição guarda uma IMPRESSÃO do título atual (hash de 31 bits). Se
-- alguém trocar o título entre a proposta e o clique, a impressão muda e a
-- proposta fica obsoleta — nada é sobrescrito.
--
-- Um hash não diz O QUE mudou, e é a única perda em relação ao valor guardado
-- dos outros tipos. Para dinheiro isso importaria ("de R$ 42 para R$ 55"); para
-- título, o `texto` e o `resumo` já mostram o que estava lá.
-- ============================================================

do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public'
       and rel.relname = 'copilot_propostas'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%tipo%'
       and pg_get_constraintdef(con.oid) ilike '%peso%'
  loop
    execute format('alter table public.copilot_propostas drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.copilot_propostas
  add constraint copilot_propostas_tipo_check
  check (tipo in ('peso', 'custo', 'cadastro', 'titulo'));

-- O conteúdo proposto, quando ele é texto. `null` nos tipos numéricos.
alter table public.copilot_propostas
  add column if not exists texto text;

comment on column public.copilot_propostas.texto is
  'O conteúdo proposto quando ele é texto (ex.: título). Nulo nos tipos numéricos.';

-- ============================================================
-- Conferência
-- ============================================================
-- select pg_get_constraintdef(oid) from pg_constraint
--  where conname = 'copilot_propostas_tipo_check';
-- Esperado: CHECK (tipo = ANY (ARRAY['peso','custo','cadastro','titulo']))
--
-- select column_name from information_schema.columns
--  where table_schema='public' and table_name='copilot_propostas' and column_name='texto';
-- Esperado: uma linha.
