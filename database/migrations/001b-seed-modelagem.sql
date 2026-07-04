-- ============================================================
-- Zion OS v1.7 — Seed complementar da modelagem de produtos
--
-- OPCIONAL. Rode DEPOIS da migração 001, no SQL Editor.
-- Insere os 6 templates de categoria (universais e úteis a todos) e um
-- calçado de exemplo com variações, para testar no Supabase.
-- Usa UUIDs fixos; rode uma única vez.
-- ============================================================

-- Templates de categoria (universais)
insert into public.categoria_templates
  (id, categoria_zion, marketplace, nome_template, descricao, campos_obrigatorios, campos_recomendados, atributos_marketplace, regras_variacao, checklist_categoria, agentes_recomendados)
values
  ('70000000-0000-4000-8000-000000000001', 'Calçados', 'Mercado Livre', 'Calçados — ML',
   'Controle derivação por derivação (cor × tamanho). Cada par é um SKU com estoque próprio.',
   '["Gênero","Material do cabedal","Tipo de fechamento","Cor","Tamanho"]',
   '["Material do solado","Altura do salto","Garantia"]',
   '["GTIN/EAN por variação","Tabela de medidas","Marca","Modelo"]',
   'Variação obrigatória por cor + tamanho. Cada combinação = 1 SKU + 1 EAN.',
   '["SKU e EAN preenchidos em todas as variações","Estoque por tamanho conferido","Foto principal com fundo branco","Tabela de medidas na descrição","Peso e dimensões por variação (frete)"]',
   '["Zion Variações e SKUs","Zion Gerador de Grade","Zion Anúncio Variações ML"]'),
  ('70000000-0000-4000-8000-000000000002', 'Roupas', 'Todos', 'Roupas — Vestuário',
   'Variação por cor e tamanho. Atenção à tabela de medidas e composição do tecido.',
   '["Composição","Cor","Tamanho","Gênero"]',
   '["Tipo de manga","Modelagem","Instruções de lavagem"]',
   '["Marca","GTIN por variação","Tabela de medidas (P/M/G/GG)"]',
   'Variação por cor + tamanho. Grade padrão P/M/G/GG.',
   '["Tabela de medidas na descrição","Composição do tecido informada","Foto de cada cor","Cuidados de lavagem"]',
   '["Zion Variações e SKUs","Zion Gerador de Grade","Zion Imagens por Variação"]'),
  ('70000000-0000-4000-8000-000000000003', 'Acessórios', 'Todos', 'Acessórios',
   'Muitos são produtos simples ou com variação só por cor.',
   '["Material","Cor"]', '["Dimensões","Público-alvo"]', '["Marca","GTIN"]',
   'Geralmente simples ou variação por cor.',
   '["Material informado","Dimensões corretas","Foto principal limpa"]',
   '["Zion Produto Pai","Zion Atributos por Categoria"]'),
  ('70000000-0000-4000-8000-000000000004', 'Cosméticos', 'Todos', 'Cosméticos e Beleza',
   'Variação frequente por aroma/fragrância ou volume. Cuidado com restrições do marketplace.',
   '["Volume/Conteúdo","Aroma/Fragrância","Indicação"]',
   '["Ingredientes","Validade","Registro ANVISA"]',
   '["Marca","GTIN por variação","Categoria regulada"]',
   'Variação por aroma e/ou volume.',
   '["Aroma/volume em cada variação","Ingredientes e validade informados","Verificar restrições de categoria"]',
   '["Zion Variações e SKUs","Zion Atributos por Categoria"]'),
  ('70000000-0000-4000-8000-000000000005', 'Eletrônicos', 'Todos', 'Eletrônicos e Eletroportáteis',
   'Variação por voltagem (110V/220V) é comum e crítica. Ficha técnica detalhada.',
   '["Voltagem","Potência","Garantia"]',
   '["Bivolt","Consumo (W)","Certificação Inmetro"]',
   '["Marca","Modelo","GTIN por voltagem","Ficha técnica completa"]',
   'Variação por voltagem quando aplicável (110V/220V/Bivolt).',
   '["Voltagem correta em cada variação","Ficha técnica completa (evita bloqueio)","Garantia informada","Certificação quando exigida"]',
   '["Zion Variações e SKUs","Zion Atributos por Categoria","Zion Checklist por Categoria"]'),
  ('70000000-0000-4000-8000-000000000006', 'Casa e Utilidades', 'Todos', 'Casa e Utilidades',
   'Mix de produtos simples e com variação (cor, tamanho, kit). Atenção a dimensões para frete.',
   '["Material","Dimensões"]', '["Capacidade","Cor","Peso"]',
   '["Marca","GTIN","Dimensões da embalagem"]',
   'Simples, por cor, por tamanho ou kits.',
   '["Dimensões e peso corretos (frete)","Material informado","Foto principal limpa"]',
   '["Zion Produto Pai","Zion Precificação por Derivação"]');

-- Produto pai de exemplo: Tênis Casual Urbano (cliente Moda Urbana SP)
insert into public.produtos
  (id, cliente_id, nome, marca, modelo, categoria, sku, cor, tamanho, custo, preco_venda, estoque,
   marketplace, status_cadastro, status_seo, status_descricao, status_imagens, status_precificacao,
   prioridade, observacoes, tipo_produto, categoria_marketplace_sugerida, descricao_base, beneficios, cuidados)
values
  ('b2000000-0000-4000-8000-000000000011', 'c1000000-0000-4000-8000-000000000006',
   'Tênis Casual Urbano (exemplo v1.7)', 'Moda Urbana', 'MU-TEN-01', 'Calçados > Tênis', 'MU-TEN-01',
   'Preto', '38', 79, 199.90, 0, 'Mercado Livre', 'Em cadastro', 'Em andamento', 'Pendente',
   'Pendente', 'Pendente', 'Alta', 'Calçado: controlar cada derivação cor × tamanho por SKU.',
   'com_variacao', 'MLB1276 - Calçados > Tênis',
   'Tênis casual urbano em couro sintético, solado leve em EVA e palmilha macia.',
   'Solado antiderrapante · palmilha em memory foam · costura reforçada',
   'Limpar com pano úmido. Não usar máquina de lavar.');

-- Variações do calçado (cor × tamanho)
insert into public.produto_variantes
  (produto_id, cliente_id, sku, ean, cor, tamanho, custo, preco_base, estoque, peso, altura, largura, comprimento, status)
values
  ('b2000000-0000-4000-8000-000000000011', 'c1000000-0000-4000-8000-000000000006', 'MU-TEN-01-PTO-38', '7890000000181', 'Preto', '38', 79, 199.90, 12, 0.85, 12, 20, 32, 'Ativa'),
  ('b2000000-0000-4000-8000-000000000011', 'c1000000-0000-4000-8000-000000000006', 'MU-TEN-01-PTO-39', '7890000000198', 'Preto', '39', 79, 199.90, 8, 0.90, 12, 20, 33, 'Ativa'),
  ('b2000000-0000-4000-8000-000000000011', 'c1000000-0000-4000-8000-000000000006', 'MU-TEN-01-AVE-38', '7890000000204', 'Avelã', '38', 82, 209.90, 0, 0.85, 12, 20, 32, 'Sem estoque'),
  ('b2000000-0000-4000-8000-000000000011', 'c1000000-0000-4000-8000-000000000006', 'MU-TEN-01-AVE-39', '7890000000211', 'Avelã', '39', 82, 209.90, 5, 0.90, 12, 20, 33, 'Ativa');

-- Novos agentes da modelagem marketplace (v1.7)
insert into public.agentes
  (id, nome, area, objetivo, quando_usar, entrada_necessaria, saida_esperada, prompt_resumido, status_implantacao, frequencia_uso, agentes_conectados)
values
  ('de000000-0000-4000-8000-000000000013', 'Zion Produto Pai', 'Mercado Livre', 'Estruturar o produto pai: nome, categoria, descrição base, benefícios e cuidados', 'Ao cadastrar um produto novo antes de criar variações', 'Dados brutos do produto', 'Produto pai estruturado + tipo de produto sugerido', 'Organize o produto pai: nome comercial, categoria, descrição base, benefícios e cuidados. Indique se é simples ou com variação.', 'Em teste', 'Diário', '["Zion Variações e SKUs","Zion Atributos por Categoria"]'),
  ('de000000-0000-4000-8000-000000000014', 'Zion Variações e SKUs', 'Mercado Livre', 'Definir as derivações e gerar SKUs padronizados', 'Para produtos com variação', 'Produto pai + eixos de variação', 'Lista de variações com SKU, EAN e estoque', 'Liste as derivações, gere SKUs consistentes e sugira padrão de EAN e estoque.', 'Em teste', 'Diário', '["Zion Gerador de Grade","Zion Precificação por Derivação"]'),
  ('de000000-0000-4000-8000-000000000015', 'Zion Gerador de Grade', 'Mercado Livre', 'Gerar a grade completa de variações a partir dos eixos', 'Quando o produto tem múltiplos eixos', 'Valores de cada eixo', 'Todas as combinações', 'Gere o produto cartesiano de todas as combinações, com SKU sugerido.', 'Ativo', 'Diário', '["Zion Variações e SKUs"]'),
  ('de000000-0000-4000-8000-000000000016', 'Zion Atributos por Categoria', 'Mercado Livre', 'Preencher a ficha técnica com atributos obrigatórios e recomendados', 'Antes de publicar', 'Produto + template da categoria', 'Atributos preenchidos', 'Preencha os atributos obrigatórios e recomendados da categoria, sinalizando o que falta.', 'Em teste', 'Diário', '["Zion Checklist por Categoria"]'),
  ('de000000-0000-4000-8000-000000000017', 'Zion Anúncio por Marketplace', 'Mercado Livre', 'Montar o anúncio para um marketplace específico', 'Ao criar o anúncio', 'Produto pai + marketplace', 'Título, descrição e categoria', 'Monte o anúncio: título com palavras-chave, descrição estruturada e categoria correta.', 'Ativo', 'Diário', '["Zion Anúncio Variações ML","Zion Imagens por Variação"]'),
  ('de000000-0000-4000-8000-000000000018', 'Zion Anúncio Variações ML', 'Mercado Livre', 'Vincular variações ao anúncio no formato do ML', 'Ao publicar com variações no ML', 'Anúncio + variações', 'Variações vinculadas com SKU, preço e estoque', 'Vincule cada variação ao anúncio no padrão do ML.', 'Em teste', 'Diário', '["Zion Precificação por Derivação"]'),
  ('de000000-0000-4000-8000-000000000019', 'Zion Precificação por Derivação', 'Precificação', 'Calcular preço e margem por variação', 'Ao precificar cada derivação', 'Custo, taxas e margem alvo', 'Preço, lucro, margem e preço mínimo', 'Para cada variação calcule preço, lucro líquido, margem e preço mínimo.', 'Em teste', 'Diário', '["Zion Concorrência"]'),
  ('de000000-0000-4000-8000-000000000020', 'Zion Imagens por Variação', 'Imagens', 'Planejar imagens por produto e variação', 'Ao preparar o material visual', 'Produto + variações + marketplace', 'Briefing de imagens por variação', 'Monte o plano de imagens: principal por cor, lifestyle e infográficos.', 'Em teste', 'Semanal', '["Zion SEO ML"]'),
  ('de000000-0000-4000-8000-000000000021', 'Zion Checklist por Categoria', 'Processos internos', 'Rodar o checklist de qualidade da categoria', 'Última etapa antes de publicar', 'Produto + anúncio + template', 'Pendências que bloqueiam a publicação', 'Rode o checklist e liste o que impede a publicação.', 'Em teste', 'Diário', '["Zion Atributos por Categoria"]');
