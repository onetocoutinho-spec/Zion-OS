-- A DIMENSÃO DA FOTO, GUARDADA NA HORA EM QUE SE SABE.
--
-- ===========================================================================
-- POR QUE — medido em 11/08/2026
-- ===========================================================================
--
-- `imagens_produto` guardava url, tipo e status, e nenhuma dimensão. Para
-- responder "existe capa melhor no cadastro deste produto?" foi preciso baixar
-- o cabeçalho das 228 fotos de 28 produtos, uma a uma, de fora do sistema.
--
-- A resposta valeu a viagem: três produtos JÁ TÊM foto 1200x1200 e estão com a
-- capa errada — 40 anúncios e 184 unidades só no Chinelo Havaianas Top Liso. E
-- 24 produtos não têm nenhuma foto aproveitável, porque o que está lá é banner
-- de catálogo do fornecedor (199x110, 185x90, 165x93), não fotografia.
--
-- Nenhuma dessas duas frases podia ser dita antes de medir, e medir de fora não
-- é resposta: é uma tarde.
--
-- ===========================================================================
-- A ARMADILHA QUE ISTO TAMBÉM FECHA
-- ===========================================================================
--
-- A `url` guardada aponta para a variante `-O` do CDN do Mercado Livre, que
-- serve 500px. O ORIGINAL está em `-F` e tem 1200. Medir a url do banco diria
-- "nenhuma foto chega a 1200" — falso, e falso na direção que faz desistir do
-- conserto. Com a dimensão gravada NO UPLOAD, medida no arquivo que a lojista
-- escolheu, essa confusão deixa de existir.
--
-- ===========================================================================
-- NULO É "NÃO MEDIMOS", NUNCA "NÃO TEM"
-- ===========================================================================
--
-- As 780+ linhas que já existem nascem com NULL e assim ficam: elas foram
-- criadas antes de haver medida, e inventar zero faria toda foto antiga parecer
-- inválida. Quem ler tem que distinguir as duas coisas — é a mesma disciplina
-- de `vendedor_paga_frete` e da contagem de infrações.

alter table public.imagens_produto
  add column if not exists largura integer,
  add column if not exists altura integer;

comment on column public.imagens_produto.largura is
  'Largura em pixels, medida no upload. NULL = não medimos (foto anterior a 11/08/2026), nunca "não tem".';
comment on column public.imagens_produto.altura is
  'Altura em pixels, medida no upload. NULL = não medimos, nunca "não tem".';

-- Dimensão é par: uma sem a outra não responde nada, e meia medida gravada é
-- pior que nenhuma porque parece resposta.
alter table public.imagens_produto
  drop constraint if exists imagens_produto_dimensao_completa;
alter table public.imagens_produto
  add constraint imagens_produto_dimensao_completa
  check ((largura is null) = (altura is null));

-- Positivas quando existirem: zero não é dimensão, é a ausência dela — o mesmo
-- argumento que impede gravar peso zero.
alter table public.imagens_produto
  drop constraint if exists imagens_produto_dimensao_positiva;
alter table public.imagens_produto
  add constraint imagens_produto_dimensao_positiva
  check (
    (largura is null or largura > 0) and (altura is null or altura > 0)
  );
