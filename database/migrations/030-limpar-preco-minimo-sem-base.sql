-- ============================================================
-- Zion OS — Migração 030: apagar os preços mínimos que ninguém pode sustentar
--
-- INCREMENTAL e NÃO DESTRUTIVA do esquema (só limpa dado inválido).
-- Rode UMA vez no SQL Editor.
--
-- O QUE ESTÁ ERRADO HOJE
--
-- Medido na base do primeiro lojista: 1.733 de 1.806 produtos têm
-- `preco_minimo` gravado, e TODOS valem R$ 1,77 — tênis, mochila, chinelo e
-- slime pelo mesmo piso. Não é coincidência: é a fórmula antiga rodando com
-- custo 0 e frete 0. Dividir quase nada pelo divisor de margem dá quase nada.
--
-- Esses números foram gravados ANTES das correções de precificação. O código
-- de hoje já se recusa a produzi-los: sem peso, `precoMinimo` devolve
-- { ok: false, motivo: "sem_peso" } e a importação não escreve nada. Ou seja,
-- nenhuma linha nova nasce assim — o que sobrou é entulho de uma versão que
-- estimava.
--
-- POR QUE ISSO É PIOR QUE CAMPO VAZIO
--
-- Vazio o lojista desconfia e vai atrás. R$ 1,77 parece resposta. A tela
-- apresenta como cálculo, e quem precifica olhando para ele erra achando que
-- acertou. Todo o trabalho de fazer o sistema dizer "não sei" em vez de chutar
-- está sendo contornado por um número velho parado na coluna.
--
-- A REGRA
--
-- Fica `null` todo preço mínimo que o modelo ATUAL não conseguiria recalcular:
-- sem custo, ou sem nenhuma variante com peso. Não é "apagar tudo" — é manter
-- exatamente o que ainda se sustenta. Como a regra é declarativa e não uma
-- lista de ids, rodar de novo é inofensivo (idempotente): na segunda vez não
-- há mais nada que se encaixe.
--
-- `margem` NÃO é tocada: ela é escolha do lojista (ver migração 029), não
-- resultado de conta. Apagar seria jogar fora uma decisão dele.
-- ============================================================

update public.produtos p
   set preco_minimo = null,
       updated_at   = now()
 where p.preco_minimo is not null
   and (
         coalesce(p.custo, 0) <= 0
      or not exists (
           select 1
             from public.produto_variantes v
            where v.produto_id = p.id
              and coalesce(v.peso, 0) > 0
         )
       );

-- ------------------------------------------------------------
-- VERIFICAÇÃO (somente leitura):
--   -- esperado: 0 linhas. Todo preço mínimo restante tem custo E peso atrás.
--   select count(*) as insustentaveis
--     from public.produtos p
--    where p.preco_minimo is not null
--      and (coalesce(p.custo,0) <= 0
--           or not exists (select 1 from public.produto_variantes v
--                           where v.produto_id = p.id and coalesce(v.peso,0) > 0));
--
--   -- o que sobrou, e por quê:
--   select count(*) filter (where preco_minimo is not null) as com_piso,
--          count(*) filter (where coalesce(custo,0) > 0)    as com_custo,
--          count(*)                                          as total
--     from public.produtos;
--
-- REVERTER:
--   Não há reversão: o valor apagado era resultado de cálculo, não entrada do
--   lojista. Ele volta sozinho — e correto — assim que houver custo e peso,
--   pela própria importação. Restaurar R$ 1,77 seria restaurar o defeito.
--   delete from public.migracoes_aplicadas where numero = '030';
-- ------------------------------------------------------------

-- ★ Auto-registro (convenção ≥024):
insert into public.migracoes_aplicadas (numero, nome, observacao)
values ('030','030-limpar-preco-minimo-sem-base','apaga o preço mínimo que o modelo atual não sustenta (sem custo ou sem peso) — era R$ 1,77 igual para 1.733 produtos')
on conflict (numero) do nothing;
