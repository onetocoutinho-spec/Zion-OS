-- ============================================================
-- Zion OS — Migração 038: procedência de campo (de onde veio este valor)
--
-- INCREMENTAL e NÃO DESTRUTIVA. Rode UMA vez no SQL Editor.
--
-- APLICAÇÃO MANUAL. Nada aqui foi aplicado remotamente.
--
-- O QUE JÁ EXISTIA — e por que não bastava
--
-- Três trilhas parciais, cada uma dona de um pedaço:
--
--   `decisoes` (022)        AIL. Append-only, com valor_anterior e autor.
--                           Cobre APENAS categoriaMarketplace, precoVenda,
--                           tabelaMedidas e custo, e SÓ pelo caminho
--                           `produtos.atualizarProduto`. Peso, SKU, EAN e
--                           estoque nunca passaram por lá.
--
--   `copilot_acoes` (035)   O que o Copilot gravou, com antes/depois e a
--                           proposta que autorizou. Cobre só o Copilot.
--
--   `copilot_cadastros` (037) A procedência por campo de um produto NASCIDO na
--                           conversa. Cobre só o cadastro conversacional.
--
-- Fora dessas três: nada. Peso vindo de planilha, SKU vindo do ERP, estoque de
-- qualquer lugar — nenhum deixou rastro. E a AIL é observador lateral e não se
-- mexe: escrever nela para tapar buraco de procedência distorceria a semântica
-- de aprendizado que ela tem (RFC-AIL-001).
--
-- ============================================================
-- A INVARIANTE QUE VALE MAIS QUE A TABELA
-- ============================================================
--
--     AUSÊNCIA DE LINHA É "ORIGEM DESCONHECIDA"
--
-- `origem` NÃO aceita o valor 'desconhecida'. Não é descuido: uma linha dizendo
-- "não sei de onde veio" é indistinguível de um palpite gravado, e o dia em que
-- alguém precisar de um default vai escolher o mais provável. Sem linha, a
-- resposta é obrigatoriamente "a origem desse valor não foi registrada" — que é
-- a verdade sobre os 73 produtos e 684 variantes escritos antes disto existir.
--
-- ESTA TABELA NÃO RECONSTRÓI O PASSADO. Ela torna o futuro rastreável. Não há
-- backfill possível e não se deve inventar um: "provavelmente veio da planilha"
-- apresentado como fato é pior que a ausência, porque a ausência ninguém usa
-- para decidir.
--
-- ============================================================
-- PROCEDÊNCIA NÃO É CONFIANÇA — e por isso não há coluna de confiança
-- ============================================================
--
-- `produtos.confianca_custo` já existe e mistura as duas coisas: a importação
-- grava 'alta' porque LEU a célula corretamente, e foi assim que R$ 30.277.872
-- entraram com selo de alta confiança a partir de uma coluna que era referência
-- de modelo.
--
-- Aqui só se registra DE ONDE veio, POR QUAL caminho, POR QUEM e QUANDO. Se o
-- valor presta é outra pergunta, e ela já tem dono: `custoDigitado` para
-- dinheiro, `validarRascunho` para o obrigatório.
--
-- ============================================================
-- ACESSO
-- ============================================================
--
-- Append-only e escrita só pelo servidor, como o resto das tabelas de rastro. O
-- cliente do portal lê o que é dele — a tela precisa responder "de onde veio
-- esse custo?" sem uma ida ao servidor para cada campo.
-- ============================================================

create table if not exists public.procedencia_de_campo (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,

  -- O alvo. Sem FK para `produtos`/`produto_variantes` de propósito: a trilha
  -- SOBREVIVE ao alvo. Apagar um produto não pode apagar o registro de que
  -- alguém informou um custo para ele — é justamente aí que a pergunta aparece.
  entidade_tipo text not null check (entidade_tipo in ('produto', 'variante')),
  entidade_id uuid not null,

  campo text not null,

  -- TEXTO, sempre. 473 SKUs desta base começam com zero, e um numeric perderia
  -- o zero em silêncio. Dinheiro entra aqui como foi escrito; a unidade
  -- canônica vive no domínio, não no rastro.
  valor text not null,
  -- O que havia antes, quando se sabia. `null` = não havia, ou não foi lido.
  valor_anterior text,

  -- DE ONDE veio como fato. 'desconhecida' não entra — ver o cabeçalho.
  origem text not null check (origem in ('cliente', 'erp', 'planilha', 'marketplace', 'zion')),
  -- POR QUAL caminho entrou. Responde "esse SKU veio da planilha?".
  metodo text not null
    check (metodo in ('cadastro_manual', 'copilot', 'importacao', 'api_marketplace', 'calculo')),

  -- QUEM. `null` quando foi o sistema — e `null` aqui significa isso, não
  -- "não sei": a origem já diz se havia humano.
  ator uuid references auth.users(id) on delete set null,

  -- A EVIDÊNCIA: o registro que sustenta a afirmação. Sem ela, "veio do
  -- Copilot" é uma frase; com o id da proposta, é algo que alguém abre e confere.
  evidencia_registro text,
  evidencia_id text,

  registrado_em timestamptz not null default now()
);

-- A consulta de todo drill-down: "a procedência deste campo deste alvo, do mais
-- recente para o mais antigo".
create index if not exists procedencia_de_campo_alvo_idx
  on public.procedencia_de_campo (cliente_id, entidade_id, campo, registrado_em desc);

-- Para varrer o catálogo procurando conflitos por campo.
create index if not exists procedencia_de_campo_campo_idx
  on public.procedencia_de_campo (cliente_id, campo, registrado_em desc);

comment on table public.procedencia_de_campo is
  'Append-only. Ausência de linha significa origem desconhecida — nunca gravar palpite.';

-- ============================================================
-- RLS — leitura do próprio tenant, escrita só pelo servidor
-- ============================================================

alter table public.procedencia_de_campo enable row level security;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'cliente_do_usuario') then
    execute $p$
      create policy procedencia_de_campo_leitura on public.procedencia_de_campo
        for select using (cliente_id = public.cliente_do_usuario());
    $p$;
  else
    raise notice 'cliente_do_usuario() ausente: RLS ligado sem politicas (nega tudo).';
  end if;
exception when duplicate_object then
  raise notice 'politica de procedencia_de_campo ja existia; nada a fazer';
end $$;

-- ============================================================
-- Conferência
-- ============================================================
-- select column_name, data_type from information_schema.columns
--  where table_schema='public' and table_name='procedencia_de_campo'
--  order by ordinal_position;
--
-- Esperado ZERO linhas logo após aplicar: a trilha começa agora.
-- select count(*) from public.procedencia_de_campo;
