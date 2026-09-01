-- 080 — A produção também diz o próprio nome.
--
-- ===========================================================================
-- O QUE ACONTECEU EM 26/08/2026
-- ===========================================================================
--
-- `environment_metadata` existia SÓ no staging, com a linha `staging`. A tela
-- passou a ler essa marca e mostrar uma faixa amarela de "ambiente de teste".
--
-- A regra que escrevi era: faixa só com prova; a AUSENCIA significa producao.
-- Isso protege contra o caso generico e nao protegeu contra o caso real —
-- porque ausencia nao e mensagem. Quem esta na producao achando que esta no
-- teste nao consegue ler o que nao esta na tela.
--
-- No mesmo dia isso custou duas vezes: o lojista rodou "Descobrir categorias"
-- na conta que paga (falhou por falta de coluna, sem tocar o Mercado Livre) e
-- depois aplicou uma categoria em 16 produtos reais. A causa raiz era o
-- servidor LOCAL: `.env.local` aponta para a producao, e `npm run dev` carrega
-- `.env.local`.
--
-- ===========================================================================
-- POR QUE A INSERCAO E CONDICIONAL
-- ===========================================================================
--
-- Uma migracao nao sabe em qual banco esta rodando — e e exatamente isso que a
-- tabela existe para resolver. Entao a linha `producao` so entra quando a
-- tabela esta VAZIA. No staging ela ja tem `staging`, e nada acontece.
--
-- Sem essa guarda, rodar esta migracao no staging o marcaria como producao e
-- apagaria a faixa justamente onde ela serve.
--
-- De quebra, os dois bancos passam a ter o mesmo schema: `environment_metadata`
-- era a UNICA divergencia entre eles (688 colunas contra 690).

create table if not exists public.environment_metadata (
  environment text primary key,
  criado_em   timestamptz not null default now()
);

-- Vazia = ninguem se identificou ainda. Este banco recebeu esta migracao pelo
-- caminho normal de deploy, e o caminho normal termina na producao.
insert into public.environment_metadata (environment)
select 'producao'
 where not exists (select 1 from public.environment_metadata);

-- A MARCA PRECISA SER LEGIVEL PELA TELA.
--
-- A RLS da base legada liga `row level security` em tudo, e sem politica isso
-- nega por padrao: o navegador nao conseguia ler a propria placa da porta. A
-- leitura fica aberta de proposito — a tabela guarda uma palavra, e a funcao
-- dela e ser lida. Escrever continua fechado (nenhuma politica de INSERT,
-- UPDATE ou DELETE).
alter table public.environment_metadata enable row level security;
drop policy if exists environment_metadata_leitura on public.environment_metadata;
create policy environment_metadata_leitura
  on public.environment_metadata for select
  to anon, authenticated
  using (true);

-- ★ Auto-registro (convencao declarada na 024).
insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('080', '080-a-producao-tambem-se-identifica', now(),
        'environment_metadata passa a existir nos DOIS bancos, para a tela poder distinguir "producao" de "nao sei" — antes a ausencia da tabela significava as duas coisas. A linha so entra quando a tabela esta vazia, porque uma migracao nao sabe onde esta rodando; no staging ela ja tem staging e nada muda. Motivo: em 26/08/2026 o servidor local (.env.local aponta para producao) operou a conta que paga duas vezes, e a faixa de ambiente nao tinha como avisar.')
on conflict (numero) do nothing;
