-- 083 — Contar as fotos por produto e cor SEM baixar as fotos.
--
-- ===========================================================================
-- O QUE TRAVA HOJE
-- ===========================================================================
--
-- `fotosPorProdutoECor` devolve um MAPA DE CONTAGENS: para cada par
-- (produto, cor), quantas imagens existem. A tela de imagens usa isso para
-- avisar "esta cor deste produto ja tem 54 fotos" antes de um envio repetido.
--
-- Para montar esse mapa, ela lia a tabela inteira e contava no navegador.
--
-- MEDIDO em 27/08/2026, com 8.090 imagens na base da lojista:
--
--     select *                     3.896 ms   ~4,8 MB
--     select produto_id, cor       1.739 ms   ~0,5 MB
--
-- APLICADA no staging em 27/08/2026, e medida ali, mediana de tres:
--
--     select *                     3.645 ms   8.090 linhas   4.821 KB
--     select produto_id, cor       1.556 ms   8.090 linhas     634 KB
--     esta funcao                    355 ms     929 linhas      82 KB
--
-- Dez vezes mais rapida, cinquenta e nove vezes mais leve. E o numero que
-- importa mais que os outros: as 929 chaves saem IGUAIS pelos dois caminhos,
-- zero divergencias, com as somas batendo em 8.090 dos dois lados. A
-- normalizacao em SQL e a de `chaveDaFoto` sao a mesma coisa, comprovado linha
-- a linha e nao por leitura.
--
-- A promessa de seguranca tambem foi conferida contra o banco: `anon` recebe
-- 42501 "permission denied for function", inclusive pedindo o cliente_id de
-- cada uma das tres lojas da base.
--
-- O primeiro numero ja foi consertado no app: a consulta passou a pedir so as
-- duas colunas que a contagem le. Sobrou o formato: OITO MIL LINHAS
-- atravessando a rede para virar OITOCENTAS contagens. Contar e trabalho de
-- banco de dados; o navegador estava fazendo o papel de operario.
--
-- E o custo cresce com a coisa errada. O numero de contagens e limitado pelos
-- produtos e cores do catalogo; o numero de LINHAS cresce com cada foto
-- enviada. Hoje sao 8.090 para 800 respostas — dez para uma —, e a razao so
-- piora conforme a loja fotografa mais.
--
-- ===========================================================================
-- SECURITY INVOKER, E ISSO E O PONTO
-- ===========================================================================
--
-- `security definer` faria a funcao rodar com os poderes de quem a criou, e uma
-- lojista poderia contar as fotos de OUTRA loja passando o cliente_id dela. Com
-- `security invoker` a RLS de `imagens_produto` continua valendo dentro da
-- funcao, exatamente como valia na consulta que ela substitui.
--
-- O parametro `p_cliente` fica assim mesmo: ele nao e a barreira — a RLS e — mas
-- ele deixa o indice `idx_img_produto` fazer o trabalho em vez de varrer.
--
-- ===========================================================================
-- COR NULA E COR VAZIA SAO A MESMA COISA AQUI
-- ===========================================================================
--
-- `chaveDaFoto` no app normaliza a cor: `(cor ?? "").trim().toLowerCase()`.
-- Uma foto sem cor e uma foto com cor "" caem na MESMA chave, e precisam cair
-- no mesmo grupo aqui — senao a contagem diverge da chave que a tela procura, e
-- o aviso de foto repetida some justamente onde a cor nao foi informada.
--
-- A normalizacao e repetida em SQL de proposito, e nao chamada de la: as duas
-- rodam em maquinas diferentes. O que amarra as duas e o teste do app, que
-- compara chave por chave.
--
-- ===========================================================================
-- INCREMENTAL. Rode UMA vez no SQL Editor.
-- Nao cria tabela, nao altera coluna, nao apaga linha, nao toca em RLS.
-- ===========================================================================

create or replace function public.contar_fotos_por_produto_e_cor(p_cliente uuid)
returns table (produto_id uuid, cor text, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    i.produto_id,
    -- A MESMA normalizacao de `chaveDaFoto`: nulo e vazio viram a mesma chave.
    lower(btrim(coalesce(i.cor, ''))) as cor,
    count(*) as total
  from public.imagens_produto i
  where i.cliente_id = p_cliente
  group by i.produto_id, lower(btrim(coalesce(i.cor, '')))
$$;

-- `authenticated` e `service_role`; `anon` nao le catalogo de ninguem.
revoke all on function public.contar_fotos_por_produto_e_cor(uuid) from public, anon;
grant execute on function public.contar_fotos_por_produto_e_cor(uuid) to authenticated, service_role;

comment on function public.contar_fotos_por_produto_e_cor(uuid) is
  'Contagem de fotos por produto e cor, agrupada no banco. Substitui a leitura de 8.090 linhas por ~800 respostas. security invoker: a RLS de imagens_produto continua valendo. Cor nula e cor vazia caem na mesma chave, como em chaveDaFoto.';

-- ★ Auto-registro (convencao declarada na 024).
insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('083', '083-contar-fotos-sem-baixar-fotos', now(),
        'RPC de contagem agrupada para fotosPorProdutoECor. Medido em 27/08/2026: a tela lia 8.090 linhas (~4,8 MB com select *, ~0,5 MB so com produto_id+cor) para montar ~800 contagens, a cada escolha de pasta. A razao piora conforme a loja fotografa mais. security invoker de proposito: security definer deixaria uma lojista contar fotos de outra passando o cliente_id dela. Cor nula e vazia normalizadas juntas, para casar com chaveDaFoto do app.')
on conflict (numero) do nothing;

-- ===========================================================================
-- DESFAZER
-- ===========================================================================
--
--   drop function if exists public.contar_fotos_por_produto_e_cor(uuid);
--   delete from public.migracoes_aplicadas where numero = '083';
--
-- O app volta a funcionar sozinho: `fotosPorProdutoECor` cai para a leitura
-- direta quando a funcao nao existe, pelo mesmo motivo de sempre — uma migracao
-- que ainda nao rodou nao pode derrubar a tela.
