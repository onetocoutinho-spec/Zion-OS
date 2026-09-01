-- ============================================================
-- A FILA DO ENSAIO DA CAPA — os anúncios que o ML está esperando consertar
--
-- SOMENTE LEITURA. Nada aqui escreve.
-- ============================================================
--
-- O QUE ESTA CONSULTA RESPONDE — E O QUE ELA NÃO RESPONDE
-- ------------------------------------------------------
-- A pergunta original era "quantos dos anúncios em `waiting_for_patch` o
-- `melhor-capa` resolve sozinho?". ESTA CONSULTA NÃO RESPONDE ISSO, e é
-- importante dizer por quê antes de alguém confiar no número errado.
--
-- `melhor-capa` decide olhando TODAS as fotos de dentro de cada anúncio, lidas
-- ao vivo do ML (`GET /items/{mlb}?attributes=id,pictures`). O banco guarda
-- apenas `anuncios_gerados.foto_capa_max_size` — a medida da CAPA, e de mais
-- nada. A foto 1200x1200 que está em segundo lugar dentro do anúncio, que é
-- exatamente a que `promoverMelhorFoto` procura, não existe em tabela nenhuma.
--
-- Fingir que o SQL sabe produziria o mesmo defeito que `capaForaDoPadrao.ts`
-- documenta: a primeira auditoria adivinhou pelo sufixo da URL e errou.
--
-- Então o que esta consulta faz é montar a FILA: quais produtos rodar no
-- ensaio, em que ordem, quantas chamadas cada um custa, e o que sobra de plano
-- B quando o ensaio disser "nenhuma-serve".
--
-- POR QUE POR PRODUTO, E NÃO POR ANÚNCIO
-- --------------------------------------
-- `melhor-capa` recebe `produtoId`, não `mlb`, e lê no máximo 12 anúncios por
-- chamada (`MAXIMO_POR_CHAMADA`), paginando por `desde`. Uma lista de anúncios
-- não seria acionável: a unidade de trabalho é o produto.
--
-- `anuncios_no_produto` conta TODOS os anúncios do produto, não só os em
-- espera, porque `planejar()` fatia sobre todos. É esse número que dita
-- `chamadas_do_ensaio` — foi ignorá-lo que deixou 163 anúncios fora de alcance
-- na varredura de 14/08.
--
-- A RÉGUA É A DE `capaForaDoPadrao.lerMaxSize`, PALAVRA POR PALAVRA
-- -----------------------------------------------------------------
-- Quadrada E com pelo menos 1200 de lado (`LADO_MINIMO_DA_CAPA`). O regexp
-- abaixo é o mesmo `^\s*(\d+)\s*[xX]\s*(\d+)\s*$`. Uma segunda régua aqui diria
-- "serve" sobre o que o resto do sistema reprova.
--
-- `capa_sem_medida` NUNCA é somada a `capa_reprovada`: "não medimos" e "está
-- ruim" são respostas diferentes, e só a segunda manda alguém trabalhar.
--
-- O QUE ELA DEVOLVEU EM 24/08/2026
-- --------------------------------
--   140 anúncios em `waiting_for_patch`, em 19 produtos   (138 em under_review)
--   136 com a capa reprovada pela régua;  4 com a capa APROVADA
--    29 chamadas de ensaio para varrer tudo
--   100 dos 140 sem NENHUMA foto de plano B no acervo
--
-- Os 4 com capa aprovada são o achado que a consulta não procurava: "Papete
-- Slide Feminina Zaxy 19359 Mood" está retido com a capa dentro do padrão.
-- O ensaio vai devolver `capa-ja-e-a-melhor` neles e não haverá o que trocar —
-- a retenção é por outra coisa (foto secundária, ou título que não corresponde).
-- Tratá-los como problema de capa é gastar chamada para não mudar nada.
-- ============================================================

with wfp as (
  -- Os anúncios que o ML pausou ESPERANDO correção. `@>` e não `= any(...)`
  -- para usar o índice de array, caso ele venha a existir.
  select a.produto_id,
         a.ml_item_id,
         regexp_match(coalesce(a.foto_capa_max_size, ''),
                      '^\s*(\d+)\s*[xX]\s*(\d+)\s*$') as m
  from public.anuncios_gerados a
  where a.ml_item_id is not null
    and a.sub_status_marketplace @> array['waiting_for_patch']
),
por_produto as (
  select produto_id,
         count(*) as wfp_total,
         count(*) filter (where m is null) as capa_nao_medida,
         count(*) filter (
           where m is not null
             and not ((m[1])::int = (m[2])::int and (m[1])::int >= 1200)
         ) as capa_fora
  from wfp
  group by produto_id
),
alcance as (
  -- TODOS os anúncios do produto — é sobre estes que o ensaio pagina.
  select produto_id, count(*) as anuncios_do_produto
  from public.anuncios_gerados
  where ml_item_id is not null
  group by produto_id
),
acervo as (
  -- O plano B: foto do cadastro que serviria de capa (`serveDeCapa`).
  -- Sem `cor`, `aplicar-capa` não sabe em qual anúncio pôr — a troca é por cor.
  select produto_id,
         count(*) filter (where largura = altura and largura >= 1200) as fotos_servem,
         count(*) filter (
           where largura = altura and largura >= 1200
             and nullif(trim(cor), '') is not null
         ) as servem_com_cor
  from public.imagens_produto
  group by produto_id
)
select
  p.nome,
  pp.wfp_total                             as em_espera,
  pp.capa_fora                             as capa_reprovada,
  pp.capa_nao_medida                       as capa_sem_medida,
  al.anuncios_do_produto                   as anuncios_no_produto,
  ceil(al.anuncios_do_produto / 12.0)::int as chamadas_do_ensaio,
  coalesce(ac.fotos_servem, 0)             as acervo_serve,
  coalesce(ac.servem_com_cor, 0)           as acervo_com_cor,
  case
    when coalesce(ac.fotos_servem, 0)   = 0 then 'so o ensaio salva'
    when coalesce(ac.servem_com_cor, 0) = 0 then 'acervo sem cor: exige a lojista'
    else 'tem plano B no acervo'
  end                                      as se_o_ensaio_falhar,
  pp.produto_id
from por_produto pp
join public.produtos p on p.id = pp.produto_id
join alcance al        on al.produto_id = pp.produto_id
left join acervo ac    on ac.produto_id = pp.produto_id
order by pp.wfp_total desc, p.nome;

-- ------------------------------------------------------------
-- COMO USAR O RESULTADO
--
-- Para cada linha, de cima para baixo, o ENSAIO (não escreve nada):
--
--   GET /api/ml/melhor-capa?clienteId=<id>&produtoId=<produto_id>
--   GET /api/ml/melhor-capa?clienteId=<id>&produtoId=<produto_id>&desde=12
--   ...até `proximoDesde` voltar null
--
-- A resposta separa em três: `trocariam`, `jaEstaoCertos`, `semFotoBoa`.
-- SÓ `trocariam` é conserto de graça — reordenar foto que já está no anúncio,
-- sem upload e sem o ML reprocessar imagem.
--
-- `semFotoBoa` cruzado com `acervo_serve` desta consulta dá a decisão seguinte:
--   acervo_serve > 0  → `aplicar-capa` (sobe do cadastro; precisa da cor)
--   acervo_serve = 0  → é foto nova. Não há caminho de software.
--
-- Só depois de o ensaio inteiro estar lido é que se sabe quanto do problema é
-- reordenação e quanto é ensaio fotográfico. Hoje, 100 dos 140 não têm plano B
-- no acervo — se o ensaio não os salvar, eles são viagem ao fabricante.
-- ------------------------------------------------------------
