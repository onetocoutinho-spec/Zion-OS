-- ============================================================
-- Zion OS v1.2 — Seed de demonstração
--
-- Rode DEPOIS do supabase-schema.sql (e do supabase-rls.sql),
-- no SQL Editor do Supabase. Rode UMA única vez.
--
-- Para recomeçar do zero, descomente o bloco TRUNCATE abaixo.
-- ============================================================

-- truncate table public.pendencias, public.reunioes, public.execucoes_agentes,
--   public.financeiro, public.relatorios, public.tarefas, public.anuncios,
--   public.produtos, public.onboarding_items, public.onboardings,
--   public.agentes, public.clientes cascade;

-- ------------------------------------------------------------
-- CLIENTES
-- ------------------------------------------------------------
insert into public.clientes (id, empresa, responsavel, segmento, marketplaces, plano, status, data_entrada, proxima_reuniao, proxima_acao, risco, observacoes) values
  ('c1000000-0000-4000-8000-000000000001', 'TechSound Brasil', 'Marcos Andrade', 'Eletrônicos / Áudio', '["Mercado Livre","Shopee"]', 'Escala', 'Ativo', '2026-01-12', '2026-07-06', 'Revisar campanha de fones bluetooth no ML', 'Baixo', 'Cliente engajado, responde rápido. Quer entrar na Amazon em agosto.'),
  ('c1000000-0000-4000-8000-000000000002', 'Bella Casa Decor', 'Fernanda Lima', 'Casa e Decoração', '["Mercado Livre","Amazon"]', 'Escala', 'Ativo', '2025-11-03', '2026-07-08', 'Aprovar novas imagens da linha de luminárias', 'Baixo', 'Ticket médio alto. Foco em kits para aumentar recorrência.'),
  ('c1000000-0000-4000-8000-000000000003', 'FitPro Suplementos', 'Ricardo Souza', 'Saúde e Suplementos', '["Mercado Livre","TikTok Shop"]', 'Início', 'Onboarding', '2026-06-15', '2026-07-03', 'Cobrar acessos do TikTok Shop e planilha de custos', 'Médio', 'Primeiro marketplace do cliente. Precisa de acompanhamento próximo.'),
  ('c1000000-0000-4000-8000-000000000004', 'Kids Mundo Brinquedos', 'Juliana Castro', 'Brinquedos', '["Shopee"]', 'Início', 'Onboarding', '2026-06-22', '2026-07-04', 'Rodar diagnóstico inicial da conta Shopee', 'Baixo', 'Estoque grande parado. Potencial de liquidação no 2º semestre.'),
  ('c1000000-0000-4000-8000-000000000005', 'AutoPeças Silva', 'Carlos Silva', 'Automotivo', '["Mercado Livre"]', 'Organiza', 'Em risco', '2025-09-20', '2026-07-02', 'Reunião de realinhamento — apresentar plano de recuperação', 'Alto', 'Reclamou de resultado nos últimos 2 meses. Conta com problema de reputação.'),
  ('c1000000-0000-4000-8000-000000000006', 'Moda Urbana SP', 'Patrícia Nunes', 'Moda e Vestuário', '["TikTok Shop","Shopee"]', 'Escala', 'Em proposta', '2026-06-28', '2026-07-05', 'Enviar proposta ajustada com foco em TikTok Shop', 'Baixo', 'Veio por indicação da Bella Casa. Já vende bem no Instagram.'),
  ('c1000000-0000-4000-8000-000000000007', 'PetLove Acessórios', 'André Martins', 'Pet', '[]', '—', 'Lead', '2026-06-30', null, 'Agendar call de diagnóstico gratuito', 'Baixo', 'Chegou pelo funil do Instagram. Ainda não vende em marketplace.'),
  ('c1000000-0000-4000-8000-000000000008', 'Casa do Chef', 'Roberta Alves', 'Utensílios de Cozinha', '["Mercado Livre","Shopee","Amazon"]', 'Escala', 'Ativo', '2025-08-10', '2026-07-10', 'Apresentar relatório mensal de junho', 'Médio', 'Margens apertadas na Shopee. Avaliar reprecificação da linha de facas.'),
  ('c1000000-0000-4000-8000-000000000009', 'GlowUp Cosméticos', 'Camila Rocha', 'Beleza', '["TikTok Shop"]', 'Início', 'Pausado', '2026-02-18', null, 'Retomar contato em agosto conforme combinado', 'Médio', 'Pausou por fluxo de caixa. Boa relação, quer voltar.');

-- ------------------------------------------------------------
-- AGENTES IA
-- ------------------------------------------------------------
insert into public.agentes (id, nome, area, objetivo, quando_usar, entrada_necessaria, saida_esperada, prompt_resumido, status_implantacao, frequencia_uso, agentes_conectados) values
  ('de000000-0000-4000-8000-000000000001', 'Zion Comercial', 'Comercial', 'Qualificar leads e gerar propostas personalizadas', 'Quando entrar um lead novo ou for preciso montar proposta', 'Dados do lead: segmento, faturamento, marketplaces atuais', 'Diagnóstico rápido + proposta com plano recomendado', 'Analise o lead, identifique dores em marketplace e monte proposta com plano Início, Organiza ou Escala.', 'Ativo', 'Sob demanda', '["Zion Onboarding"]'),
  ('de000000-0000-4000-8000-000000000002', 'Zion Onboarding', 'Onboarding', 'Guiar o checklist de entrada de novos clientes', 'Assim que o contrato for fechado', 'Contrato, acessos e base de produtos do cliente', 'Checklist preenchido + plano de 30 dias + lista de pendências', 'Conduza o onboarding: valide acessos, base de produtos, diagnóstico e gere o plano de 30 dias.', 'Ativo', 'Sob demanda', '["Zion Diagnóstico ML","Zion Precificação"]'),
  ('de000000-0000-4000-8000-000000000003', 'Zion Diagnóstico ML', 'Mercado Livre', 'Diagnosticar contas e anúncios no Mercado Livre', 'No onboarding e em revisões mensais de conta', 'Print/export da conta ML: reputação, anúncios, métricas', 'Relatório de diagnóstico com prioridades de correção', 'Avalie reputação, qualidade dos anúncios, SEO, preço e concorrência. Liste os 10 ajustes de maior impacto.', 'Ativo', 'Semanal', '["Zion SEO ML","Zion Precificação"]'),
  ('de000000-0000-4000-8000-000000000004', 'Zion SEO ML', 'Mercado Livre', 'Otimizar títulos, fichas técnicas e descrições no ML', 'Para cada anúncio novo ou em otimização', 'Produto, categoria, palavras-chave e anúncio atual', 'Título otimizado + ficha técnica completa + descrição', 'Gere título de até 60 caracteres com palavras-chave de maior busca, ficha técnica completa e descrição vendedora.', 'Ativo', 'Diário', '["Zion Diagnóstico ML","Zion Imagens"]'),
  ('de000000-0000-4000-8000-000000000005', 'Zion TikTok Creator', 'TikTok Shop', 'Criar roteiros de vídeo e copy para TikTok Shop', 'Ao lançar produto no TikTok Shop ou renovar criativos', 'Produto, público-alvo e diferenciais', '3 roteiros de vídeo curto + títulos e hashtags', 'Crie roteiros de vídeos curtos com gancho nos 3 primeiros segundos, focados em conversão no TikTok Shop.', 'Em teste', 'Semanal', '["Zion Imagens"]'),
  ('de000000-0000-4000-8000-000000000006', 'Zion Precificação', 'Precificação', 'Calcular preço ideal por marketplace considerando taxas e margem', 'No cadastro de produto e em revisões de margem', 'Custo, frete, taxas do marketplace e margem desejada', 'Preço sugerido por marketplace + análise de margem', 'Calcule preço de venda por marketplace: custo + taxas + frete + margem alvo. Aponte se o preço é competitivo.', 'Ativo', 'Diário', '["Zion Concorrência"]'),
  ('de000000-0000-4000-8000-000000000007', 'Zion Imagens', 'Imagens', 'Gerar briefings de imagem e avaliar criativos de anúncios', 'Antes de sessões de foto e ao revisar anúncios', 'Produto, marketplace e imagens atuais', 'Briefing de fotos + checklist de qualidade por marketplace', 'Monte briefing de imagens: foto principal fundo branco, lifestyle, infográficos e requisitos do marketplace.', 'Ativo', 'Semanal', '["Zion SEO ML","Zion TikTok Creator"]'),
  ('de000000-0000-4000-8000-000000000008', 'Zion Relatórios', 'Relatórios', 'Gerar relatórios mensais padronizados por cliente', 'No fechamento de cada mês', 'Tarefas concluídas, métricas e pendências do período', 'Relatório mensal pronto para envio ao cliente', 'Compile o que foi feito, resultados, problemas, oportunidades e próximas ações em formato de relatório Zion.', 'Ativo', 'Quinzenal', '["Zion Performance"]'),
  ('de000000-0000-4000-8000-000000000009', 'Zion Atendimento', 'Atendimento', 'Responder perguntas de compradores nos marketplaces', 'Na rotina diária de perguntas e pós-venda', 'Pergunta do comprador + dados do produto', 'Resposta pronta, cordial e orientada a conversão', 'Responda perguntas de compradores com tom cordial, informação precisa e chamada para compra.', 'Em teste', 'Diário', '[]'),
  ('de000000-0000-4000-8000-000000000010', 'Zion Concorrência', 'Performance', 'Monitorar concorrentes e sugerir ajustes de posicionamento', 'Revisões semanais e quando vendas caírem', 'Links dos concorrentes diretos do produto', 'Comparativo de preço, título, imagens e avaliações', 'Compare o anúncio com os 5 principais concorrentes e liste ajustes para ganhar a disputa.', 'Em teste', 'Semanal', '["Zion Precificação","Zion SEO ML"]'),
  ('de000000-0000-4000-8000-000000000011', 'Zion Financeiro', 'Financeiro', 'Acompanhar cobranças, margens e saúde financeira da agência', 'Fechamento semanal do financeiro', 'Registros de pagamento e custos operacionais', 'Resumo de recebimentos, atrasos e lucro por cliente', 'Analise recebimentos, aponte atrasos e calcule lucro estimado por cliente e total da agência.', 'Planejado', 'Semanal', '[]'),
  ('de000000-0000-4000-8000-000000000012', 'Zion Processos', 'Processos internos', 'Documentar e padronizar processos internos da agência', 'Quando um processo novo for criado ou ajustado', 'Descrição do processo em texto livre', 'SOP padronizado passo a passo', 'Transforme a descrição em um SOP: objetivo, responsável, passo a passo, ferramentas e critérios de qualidade.', 'Planejado', 'Sob demanda', '["Zion Onboarding"]');

-- ------------------------------------------------------------
-- PRODUTOS
-- ------------------------------------------------------------
insert into public.produtos (id, cliente_id, nome, marca, modelo, categoria, sku, cor, tamanho, custo, preco_venda, estoque, marketplace, status_cadastro, status_seo, status_descricao, status_imagens, status_precificacao, prioridade, observacoes) values
  ('b2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Fone Bluetooth TWS Pro', 'TechSound', 'TS-200', 'Áudio > Fones', 'TS-200-PTO', 'Preto', 'Único', 48, 129.90, 320, 'Mercado Livre', 'Publicado', 'Concluído', 'Concluído', 'Em andamento', 'Concluído', 'Alta', 'Campeão de vendas. Refazer imagens com fundo lifestyle.'),
  ('b2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'Caixa de Som Portátil 30W', 'TechSound', 'TS-BOX30', 'Áudio > Caixas de Som', 'TS-BOX30-AZL', 'Azul', 'Único', 95, 249.90, 140, 'Shopee', 'Em cadastro', 'Em andamento', 'Pendente', 'Pendente', 'Concluído', 'Média', 'Aguardando vídeo do produto para a Shopee.'),
  ('b2000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002', 'Luminária de Mesa Minimalista', 'Bella Casa', 'LUM-M01', 'Decoração > Iluminação', 'BC-LUM-M01-BRC', 'Branco', '35cm', 62, 179.90, 85, 'Amazon', 'Publicado', 'Concluído', 'Concluído', 'Concluído', 'Em andamento', 'Média', 'Concorrente baixou preço — reavaliar margem.'),
  ('b2000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000002', 'Kit 3 Vasos Cerâmica Escandinavos', 'Bella Casa', 'VAS-K3', 'Decoração > Vasos', 'BC-VAS-K3-NAT', 'Natural', 'P/M/G', 74, 199.90, 60, 'Mercado Livre', 'Em cadastro', 'Em andamento', 'Em andamento', 'Pendente', 'Concluído', 'Alta', 'Lançamento da linha kits. Prioridade do mês.'),
  ('b2000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000003', 'Whey Protein Concentrado 900g', 'FitPro', 'WPC-900', 'Suplementos > Proteínas', 'FP-WPC900-CHO', 'Chocolate', '900g', 55, 139.90, 200, 'Mercado Livre', 'Não iniciado', 'Pendente', 'Pendente', 'Pendente', 'Em andamento', 'Urgente', 'Primeiro produto do onboarding. Cadastrar assim que custos chegarem.'),
  ('b2000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000003', 'Creatina Monohidratada 300g', 'FitPro', 'CRE-300', 'Suplementos > Creatina', 'FP-CRE300-NAT', '—', '300g', 32, 89.90, 350, 'TikTok Shop', 'Não iniciado', 'Pendente', 'Pendente', 'Pendente', 'Pendente', 'Alta', 'Produto com maior potencial no TikTok Shop.'),
  ('b2000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000004', 'Blocos de Montar 250 Peças', 'KidsMundo', 'BM-250', 'Brinquedos > Educativos', 'KM-BM250-COL', 'Colorido', '250 pçs', 38, 99.90, 500, 'Shopee', 'Em cadastro', 'Em andamento', 'Em andamento', 'Pendente', 'Concluído', 'Alta', 'Aguardando fotos originais do cliente.'),
  ('b2000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000005', 'Farol de Milha Universal LED', 'SilvaParts', 'FML-LED2', 'Automotivo > Iluminação', 'AS-FML2-PAR', '—', 'Par', 42, 119.90, 90, 'Mercado Livre', 'Com erro', 'Concluído', 'Concluído', 'Concluído', 'Concluído', 'Urgente', 'Anúncio bloqueado por ficha técnica incompleta. Corrigir hoje.'),
  ('b2000000-0000-4000-8000-000000000009', 'c1000000-0000-4000-8000-000000000008', 'Kit Facas Inox Profissional 6 Peças', 'Casa do Chef', 'KF-6P', 'Cozinha > Cutelaria', 'CC-KF6P-INX', 'Inox', '6 pçs', 88, 229.90, 45, 'Shopee', 'Publicado', 'Concluído', 'Concluído', 'Concluído', 'Em andamento', 'Média', 'Margem apertada com frete grátis da Shopee. Reprecificar.'),
  ('b2000000-0000-4000-8000-000000000010', 'c1000000-0000-4000-8000-000000000008', 'Panela de Ferro Fundido 28cm', 'Casa do Chef', 'PF-28', 'Cozinha > Panelas', 'CC-PF28-PTO', 'Preto', '28cm', 120, 299.90, 30, 'Amazon', 'Publicado', 'Em andamento', 'Concluído', 'Concluído', 'Concluído', 'Baixa', 'Boa conversão orgânica na Amazon.');

-- ------------------------------------------------------------
-- ANÚNCIOS
-- ------------------------------------------------------------
insert into public.anuncios (id, cliente_id, produto_id, marketplace, link, titulo_atual, titulo_otimizado, status_seo, status_descricao, status_imagens, status_precificacao, status_concorrencia, status_revisao, status_publicacao, proxima_acao, responsavel) values
  ('a3000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'Mercado Livre', 'https://produto.mercadolivre.com.br/MLB-fone-tws-pro', 'Fone de ouvido bluetooth sem fio', 'Fone Bluetooth TWS Pro Sem Fio 40h Bateria Cancelamento Ruído', 'Concluído', 'Concluído', 'Em andamento', 'Concluído', 'Concluído', 'Em andamento', 'Publicado', 'Subir novas imagens lifestyle e revisar ficha técnica', 'Lucas'),
  ('a3000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002', 'Shopee', 'https://shopee.com.br/caixa-som-30w', 'Caixa de som 30w', 'Caixa de Som Bluetooth 30W Portátil À Prova D''água IPX6', 'Em andamento', 'Pendente', 'Pendente', 'Concluído', 'Em andamento', 'Pendente', 'Pendente', 'Finalizar descrição e cobrar vídeo do produto', 'Lucas'),
  ('a3000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000003', 'Amazon', 'https://amazon.com.br/dp/luminaria-minimalista', 'Luminária de Mesa Minimalista Branca 35cm Abajur Quarto Sala', 'Luminária de Mesa Minimalista Branca 35cm Abajur Quarto Sala', 'Concluído', 'Concluído', 'Concluído', 'Em andamento', 'Em andamento', 'Concluído', 'Publicado', 'Análise de concorrência — concorrente baixou 12% o preço', 'Amanda'),
  ('a3000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000004', 'Mercado Livre', '—', '—', 'Kit 3 Vasos Decorativos Cerâmica Escandinavo Sala Estante', 'Concluído', 'Em andamento', 'Pendente', 'Concluído', 'Concluído', 'Pendente', 'Pendente', 'Sessão de fotos do kit agendada para 04/07', 'Amanda'),
  ('a3000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000005', 'b2000000-0000-4000-8000-000000000008', 'Mercado Livre', 'https://produto.mercadolivre.com.br/MLB-farol-milha-led', 'Farol de milha led universal par', 'Par Farol de Milha LED Universal 6000K Carro Moto + Suporte', 'Concluído', 'Concluído', 'Concluído', 'Concluído', 'Concluído', 'Em andamento', 'Pendente', 'URGENTE: corrigir ficha técnica para desbloquear anúncio', 'Lucas'),
  ('a3000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000007', 'Shopee', '—', '—', 'Blocos de Montar 250 Peças Educativo Compatível Encaixe Fácil', 'Em andamento', 'Em andamento', 'Pendente', 'Concluído', 'Pendente', 'Pendente', 'Pendente', 'Aguardando fotos originais do cliente para montar criativos', 'Amanda'),
  ('a3000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000008', 'b2000000-0000-4000-8000-000000000009', 'Shopee', 'https://shopee.com.br/kit-facas-inox-6p', 'Kit Facas Inox Profissional 6 Peças Chef Cozinha + Suporte', 'Kit Facas Inox Profissional 6 Peças Chef Cozinha + Suporte', 'Concluído', 'Concluído', 'Concluído', 'Em andamento', 'Concluído', 'Concluído', 'Publicado', 'Reprecificar considerando taxa de frete grátis', 'Rafael'),
  ('a3000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000008', 'b2000000-0000-4000-8000-000000000010', 'Amazon', 'https://amazon.com.br/dp/panela-ferro-28', 'Panela de Ferro Fundido 28cm', 'Panela de Ferro Fundido 28cm Pré-Curada Fogão Forno Indução', 'Em andamento', 'Concluído', 'Concluído', 'Concluído', 'Concluído', 'Pendente', 'Publicado', 'Aplicar título otimizado e revisar bullets', 'Rafael');

-- ------------------------------------------------------------
-- TAREFAS
-- ------------------------------------------------------------
insert into public.tarefas (id, cliente_id, produto_id, anuncio_id, agente_id, area, tarefa, responsavel, prioridade, status, prazo, proxima_acao, observacoes) values
  ('fa000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000005', 'b2000000-0000-4000-8000-000000000008', 'a3000000-0000-4000-8000-000000000005', 'de000000-0000-4000-8000-000000000004', 'Mercado Livre', 'Corrigir ficha técnica do farol de milha (anúncio bloqueado)', 'Lucas', 'Urgente', 'Em andamento', '2026-07-02', 'Preencher atributos obrigatórios e reenviar para revisão', 'Anúncio principal do cliente. Impacto direto no faturamento.'),
  ('fa000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000005', null, null, 'de000000-0000-4000-8000-000000000003', 'Agência', 'Preparar plano de recuperação para reunião de realinhamento', 'Camila', 'Urgente', 'Em revisão', '2026-07-02', 'Revisar apresentação com diagnóstico e metas de 60 dias', 'Cliente em risco de churn.'),
  ('fa000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000003', null, null, 'de000000-0000-4000-8000-000000000002', 'Onboarding', 'Cobrar acessos do TikTok Shop e planilha de custos', 'Camila', 'Alta', 'Aguardando cliente', '2026-07-03', 'Follow-up por WhatsApp na quinta-feira', 'Sem os custos não dá para precificar o Whey.'),
  ('fa000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000007', 'Imagens', 'Produzir novas imagens lifestyle do Fone TWS Pro', 'Amanda', 'Alta', 'Em andamento', '2026-07-07', 'Finalizar edição das 6 fotos e enviar para aprovação', 'Briefing gerado pelo agente já aprovado pelo cliente.'),
  ('fa000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000003', 'a3000000-0000-4000-8000-000000000003', 'de000000-0000-4000-8000-000000000006', 'Precificação', 'Reprecificar luminária após queda de preço do concorrente', 'Rafael', 'Média', 'Não iniciado', '2026-07-04', 'Rodar agente de precificação com novo cenário', 'Concorrente baixou 12%. Avaliar kit para proteger margem.'),
  ('fa000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000004', 'a3000000-0000-4000-8000-000000000004', 'de000000-0000-4000-8000-000000000004', 'Anúncios', 'Publicar anúncio do Kit 3 Vasos no Mercado Livre', 'Amanda', 'Alta', 'Travado', '2026-06-30', 'Destravar: depende da sessão de fotos de 04/07', 'Prazo estourou por falta das fotos.'),
  ('fa000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000004', null, null, 'de000000-0000-4000-8000-000000000003', 'Onboarding', 'Rodar diagnóstico inicial da conta Shopee', 'Lucas', 'Alta', 'Não iniciado', '2026-07-04', 'Exportar dados da conta e rodar o agente', ''),
  ('fa000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000008', null, null, 'de000000-0000-4000-8000-000000000008', 'Relatórios', 'Montar relatório mensal de junho', 'Camila', 'Alta', 'Em andamento', '2026-07-08', 'Consolidar métricas dos 3 marketplaces', 'Apresentação na reunião de 10/07.'),
  ('fa000000-0000-4000-8000-000000000009', 'c1000000-0000-4000-8000-000000000008', 'b2000000-0000-4000-8000-000000000009', 'a3000000-0000-4000-8000-000000000007', 'de000000-0000-4000-8000-000000000006', 'Precificação', 'Reprecificar kit de facas considerando frete grátis Shopee', 'Rafael', 'Média', 'Aguardando aprovação', '2026-07-05', 'Cliente precisa aprovar novo preço de R$ 249,90', ''),
  ('fa000000-0000-4000-8000-000000000010', 'c1000000-0000-4000-8000-000000000006', null, null, 'de000000-0000-4000-8000-000000000001', 'Comercial', 'Enviar proposta ajustada com foco em TikTok Shop', 'Camila', 'Alta', 'Em andamento', '2026-07-03', 'Ajustar escopo de criativos e enviar por e-mail', 'Lead quente, veio por indicação.'),
  ('fa000000-0000-4000-8000-000000000011', 'c1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000004', 'Anúncios', 'Finalizar cadastro da caixa de som na Shopee', 'Lucas', 'Média', 'Aguardando cliente', '2026-06-28', 'Cobrar vídeo do produto (obrigatório na categoria)', 'Atrasada — cliente ainda não enviou o vídeo.'),
  ('fa000000-0000-4000-8000-000000000012', 'c1000000-0000-4000-8000-000000000007', null, null, 'de000000-0000-4000-8000-000000000001', 'Comercial', 'Agendar call de diagnóstico gratuito', 'Camila', 'Média', 'Concluído', '2026-07-01', 'Call marcada para 07/07 às 14h', '');

-- ------------------------------------------------------------
-- ONBOARDINGS + ITENS
-- ------------------------------------------------------------
insert into public.onboardings (id, cliente_id, pendencias_cliente, observacoes) values
  ('0b100000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003', '["Enviar acesso do TikTok Shop","Enviar planilha de custos atualizada"]', 'Acesso TikTok travado: cliente ainda não criou a conta seller.'),
  ('0b100000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000004', '["Enviar base de produtos em planilha","Enviar fotos originais"]', 'Cliente só opera Shopee por enquanto; ML fica para fase 2.'),
  ('0b100000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000008', '[]', 'Onboarding modelo — usar como referência de fluxo completo.'),
  ('0b100000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000006', '["Assinar contrato"]', 'Aguardando assinatura da proposta para iniciar.');

-- FitPro Suplementos
insert into public.onboarding_items (onboarding_id, chave, status) values
  ('0b100000-0000-4000-8000-000000000001', 'contratoFechado', 'Concluído'),
  ('0b100000-0000-4000-8000-000000000001', 'boasVindas', 'Concluído'),
  ('0b100000-0000-4000-8000-000000000001', 'acessosML', 'Concluído'),
  ('0b100000-0000-4000-8000-000000000001', 'acessosTikTok', 'Travado'),
  ('0b100000-0000-4000-8000-000000000001', 'acessosShopee', 'Pendente'),
  ('0b100000-0000-4000-8000-000000000001', 'acessoERP', 'Pendente'),
  ('0b100000-0000-4000-8000-000000000001', 'baseProdutos', 'Concluído'),
  ('0b100000-0000-4000-8000-000000000001', 'pastaCriada', 'Concluído'),
  ('0b100000-0000-4000-8000-000000000001', 'diagnosticoIniciado', 'Em andamento'),
  ('0b100000-0000-4000-8000-000000000001', 'diagnosticoConcluido', 'Pendente'),
  ('0b100000-0000-4000-8000-000000000001', 'reuniaoInicial', 'Concluído'),
  ('0b100000-0000-4000-8000-000000000001', 'plano30Dias', 'Pendente'),
  ('0b100000-0000-4000-8000-000000000001', 'primeirasTarefas', 'Concluído'),
  ('0b100000-0000-4000-8000-000000000001', 'clienteLiberado', 'Pendente');

-- Kids Mundo Brinquedos
insert into public.onboarding_items (onboarding_id, chave, status) values
  ('0b100000-0000-4000-8000-000000000002', 'contratoFechado', 'Concluído'),
  ('0b100000-0000-4000-8000-000000000002', 'boasVindas', 'Concluído'),
  ('0b100000-0000-4000-8000-000000000002', 'acessosML', 'Pendente'),
  ('0b100000-0000-4000-8000-000000000002', 'acessosTikTok', 'Pendente'),
  ('0b100000-0000-4000-8000-000000000002', 'acessosShopee', 'Concluído'),
  ('0b100000-0000-4000-8000-000000000002', 'acessoERP', 'Pendente'),
  ('0b100000-0000-4000-8000-000000000002', 'baseProdutos', 'Em andamento'),
  ('0b100000-0000-4000-8000-000000000002', 'pastaCriada', 'Concluído'),
  ('0b100000-0000-4000-8000-000000000002', 'diagnosticoIniciado', 'Pendente'),
  ('0b100000-0000-4000-8000-000000000002', 'diagnosticoConcluido', 'Pendente'),
  ('0b100000-0000-4000-8000-000000000002', 'reuniaoInicial', 'Concluído'),
  ('0b100000-0000-4000-8000-000000000002', 'plano30Dias', 'Pendente'),
  ('0b100000-0000-4000-8000-000000000002', 'primeirasTarefas', 'Em andamento'),
  ('0b100000-0000-4000-8000-000000000002', 'clienteLiberado', 'Pendente');

-- Casa do Chef (concluído)
insert into public.onboarding_items (onboarding_id, chave, status)
select '0b100000-0000-4000-8000-000000000003', chave, 'Concluído'
from unnest(array[
  'contratoFechado','boasVindas','acessosML','acessosTikTok','acessosShopee',
  'acessoERP','baseProdutos','pastaCriada','diagnosticoIniciado',
  'diagnosticoConcluido','reuniaoInicial','plano30Dias','primeirasTarefas','clienteLiberado'
]) as chave;

-- Moda Urbana SP (não iniciado)
insert into public.onboarding_items (onboarding_id, chave, status)
select '0b100000-0000-4000-8000-000000000004', chave, 'Pendente'
from unnest(array[
  'contratoFechado','boasVindas','acessosML','acessosTikTok','acessosShopee',
  'acessoERP','baseProdutos','pastaCriada','diagnosticoIniciado',
  'diagnosticoConcluido','reuniaoInicial','plano30Dias','primeirasTarefas','clienteLiberado'
]) as chave;

-- ------------------------------------------------------------
-- RELATÓRIOS
-- ------------------------------------------------------------
insert into public.relatorios (id, cliente_id, periodo, o_que_foi_feito, produtos_trabalhados, anuncios_revisados, problemas_encontrados, oportunidades, pendencias, proximas_acoes, status) values
  ('0e100000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Junho/2026', 'Otimização de 8 anúncios no ML, lançamento de 2 produtos na Shopee, ajuste de campanha de ads', 10, 8, 'Imagens antigas com baixa conversão no anúncio principal', 'Entrada na Amazon em agosto; kit fone + caixa de som', 'Vídeo da caixa de som para a Shopee', 'Novas imagens lifestyle, estudo de entrada na Amazon', 'Enviado'),
  ('0e100000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'Junho/2026', 'SEO da linha de luminárias, preparação do lançamento da linha de kits', 7, 5, 'Concorrente agressivo em preço na Amazon', 'Linha de kits com margem melhor; datas sazonais do 2º semestre', 'Fotos do kit de vasos (sessão 04/07)', 'Publicar kit no ML, reprecificar luminária', 'Em elaboração'),
  ('0e100000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000008', 'Junho/2026', 'Revisão completa dos anúncios Amazon, reprecificação parcial Shopee', 12, 9, 'Margem apertada na Shopee com programa de frete grátis', 'Panela de ferro com boa tração orgânica na Amazon — escalar com ads', 'Aprovação do novo preço do kit de facas', 'Apresentar relatório em 10/07, iniciar ads na Amazon', 'Em elaboração'),
  ('0e100000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000005', 'Junho/2026', 'Diagnóstico de reputação, correção de 4 anúncios, plano de recuperação', 6, 6, 'Reputação amarela por atraso de despacho; anúncio principal bloqueado', 'Categoria de iluminação LED em alta no ML', 'Cliente precisa ajustar processo de expedição', 'Reunião de realinhamento 02/07, desbloqueio do anúncio', 'Pendente'),
  ('0e100000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000008', 'Maio/2026', 'Onboarding Amazon concluído, 5 produtos publicados', 5, 5, 'Fichas incompletas herdadas do cadastro antigo', 'Linha premium com pouca concorrência na Amazon', '—', 'Revisão SEO mensal, monitorar buy box', 'Aprovado');

-- ------------------------------------------------------------
-- FINANCEIRO
-- ------------------------------------------------------------
insert into public.financeiro (id, cliente_id, plano, valor_mensal, data_vencimento, status_pagamento, servicos_extras, custo_operacional, lucro_estimado, observacoes) values
  ('0f100000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Escala', 3500, '2026-07-05', 'Pendente', 'Pacote de 6 imagens lifestyle (R$ 600)', 1400, 2700, 'Extra de imagens será faturado junto com a mensalidade.'),
  ('0f100000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'Escala', 3500, '2026-07-10', 'Pendente', '—', 1300, 2200, ''),
  ('0f100000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000003', 'Início', 1800, '2026-07-15', 'Pago', 'Setup TikTok Shop (R$ 800, pago no fechamento)', 900, 900, 'Primeira mensalidade paga antecipada.'),
  ('0f100000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000004', 'Início', 1800, '2026-07-22', 'Pendente', '—', 850, 950, ''),
  ('0f100000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000005', 'Organiza', 2500, '2026-06-20', 'Atrasado', '—', 1200, 1300, '12 dias de atraso. Tratar cobrança na reunião de realinhamento.'),
  ('0f100000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000008', 'Escala', 3500, '2026-07-08', 'Pendente', 'Gestão de ads Amazon (R$ 900/mês a partir de julho)', 1600, 2800, 'Upsell de ads aprovado em junho.'),
  ('0f100000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000009', 'Início', 0, '2026-08-01', 'Pendente', '—', 0, 0, 'Contrato pausado até agosto. Sem cobrança em julho.');

-- ------------------------------------------------------------
-- EXECUÇÕES DE AGENTES (simuladas)
-- ------------------------------------------------------------
insert into public.execucoes_agentes (id, agente_id, data_hora, contexto, resultado) values
  ('0c100000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000004', '2026-07-01T10:32:00-03', 'Fone Bluetooth TWS Pro — TechSound Brasil', 'Título otimizado + ficha técnica gerados (execução simulada)'),
  ('0c100000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000006', '2026-06-30T16:05:00-03', 'Kit Facas Inox — Casa do Chef, cenário frete grátis Shopee', 'Preço sugerido R$ 249,90 com margem de 24% (execução simulada)'),
  ('0c100000-0000-4000-8000-000000000003', 'de000000-0000-4000-8000-000000000003', '2026-06-28T09:15:00-03', 'Conta AutoPeças Silva — diagnóstico de reputação', '10 ajustes prioritários identificados (execução simulada)');

-- ------------------------------------------------------------
-- REUNIÕES (exemplos — módulo chega na v1.3)
-- ------------------------------------------------------------
insert into public.reunioes (id, cliente_id, titulo, data_hora, pauta, status) values
  ('0d100000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000005', 'Reunião de realinhamento', '2026-07-02T10:00:00-03', 'Plano de recuperação e metas de 60 dias', 'Agendada'),
  ('0d100000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000008', 'Apresentação do relatório de junho', '2026-07-10T14:00:00-03', 'Resultados de junho + início de ads Amazon', 'Agendada');

-- ------------------------------------------------------------
-- PENDÊNCIAS (exemplos — módulo dedicado chega na v1.3)
-- ------------------------------------------------------------
insert into public.pendencias (id, cliente_id, tarefa_id, descricao, resolvida) values
  ('0a100000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003', 'fa000000-0000-4000-8000-000000000003', 'Enviar acesso do TikTok Shop', false),
  ('0a100000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000003', 'fa000000-0000-4000-8000-000000000003', 'Enviar planilha de custos atualizada', false),
  ('0a100000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000004', null, 'Enviar base de produtos em planilha', false),
  ('0a100000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000004', null, 'Enviar fotos originais', false),
  ('0a100000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-000000000011', 'Enviar vídeo da caixa de som (obrigatório na Shopee)', false);
