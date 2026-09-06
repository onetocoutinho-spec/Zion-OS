# Problems — achados verificados no HEAD atual

Data: 2026-09-06 · Commit: `c04ca51` · Escopo: fases DISCOVER/UNDERSTAND/MAP da skill `zion-product-ui-ux`, somente leitura. Ordenado por impacto ÷ esforço (não por severidade nem ordem alfabética).

Complementa `docs/product/ux/02-PROBLEMS.md` (auditoria completa de 2026-08-21, 37 achados) — não repete os achados de lá que já foram corrigidos (confirmado nesta sessão: contexto global de loja, switcher, home de portfólio, faixa "operando", 403 explicativo, autonomia de agência para convidar/criar loja — todos implementados e mesclados). Os achados abaixo são **novos ou reabertos** pela reverificação de hoje.

---

### [P1] Segurança/Arquitetura · Disciplina de tenant em rotas com `service_role`
**Evidência:** `src/lib/supabase/admin.ts:16-27` (cliente admin, ignora RLS); confirmado em ~40 arquivos que o filtro de tenant é aplicado **no código da rota**, não estruturalmente. O próprio código admite isso: `src/lib/auth/serverAuthorization.ts:118-125` ("as rotas que chamam `exigirAcessoAoCliente` seguem usando `service_role` [...] Aqui é a única parede"). Precedente real: `database/migrations/041-fecha-o-rls-que-a-005-nao-fechou.sql:40-56` documenta que, em 2026-07-29, 29 tabelas ficaram com RLS neutralizado (`using(true)` OR `cliente_escopo`) e um cliente real leu 74 produtos (73 dele + 1 de outro) e **escreveu** em dados de outro tenant, antes de ser corrigido.
**Problema:** o isolamento entre lojas/agências hoje depende de toda rota nova (e toda rota futura) lembrar de chamar `exigirAcessoAoCliente`/`exigirAutenticado` antes de qualquer função que use `service_role`. Não há um mecanismo automático (lint, tipo, wrapper) que barre uma rota que esqueça isso — e o produto já teve exatamente essa classe de falha, por um motivo estrutural diferente (RLS incompleta), mas na mesma família de risco (isolamento de tenant dependente de disciplina manual).
**Impacto:** todos os tenants (lojas e agências), com frequência potencial de "uma vez, quando alguém esquecer" — mas custo alto quando acontece: vazamento ou escrita cruzada entre clientes pagantes.
**Recomendação:** não é achado de UX a implementar aqui — é matéria da skill de auditoria de segurança dedicada (`zion-saas-security-audit`). Registrar como encaminhamento: (a) inventariar as ~40 rotas com `service_role` e confirmar 100% delas passam por `exigir*` antes; (b) considerar um wrapper de tipo (`clienteId: TenantVerificado`) que só pode ser produzido por `exigirAcessoAoCliente`, tornando o esquecimento um erro de compilação, não de revisão manual.
**Esforço:** M (auditoria) + L (wrapper estrutural), fora do escopo desta sessão somente-leitura.

---

### [P2] UX · `/vendas` e `/esteira` não respeitam o modo portfólio
**Evidência:** `src/app/vendas/page.tsx:36-37,96-98` (`const clienteId = lojaId ?? ""`; sem loja escolhida, mostra só `EmptyState` "Escolha a loja para ver o faturamento"); `src/app/esteira/page.tsx:55,93` (mesmo padrão, e força a entrada em uma loja ao escolher um produto). Contraste correto no mesmo grupo de menu: `src/app/produtos/page.tsx:128-146` agrupa por loja quando não há loja escolhida, e filtra quando há.
**Problema:** uma agência no modo "Todas as lojas" não consegue ver vendas nem a esteira agregadas do portfólio — precisa entrar loja por loja, mesmo que as telas vizinhas do mesmo grupo (`Produtos`, `Pendências`, `Relatórios`) já suportem os dois modos.
**Impacto:** agências com carteira de várias lojas, toda vez que quiserem uma visão consolidada de faturamento ou de esteira — provavelmente diário/semanal, dado que são as duas telas mais "operacionais" do produto.
**Recomendação:** replicar o padrão já existente em `/produtos` (agrupar por loja quando `lojaId` é nulo) nessas duas telas — não é migração de schema, é lógica de apresentação que já tem um exemplo funcionando no próprio código.
**Esforço:** S–M por tela (o padrão já existe, é replicar).

---

### [P2] Navegação · Quatro rotas de nome/propósito sobreposto para "processar em lote"
**Evidência:** `/otimizar-lote` (rota de primeiro nível, **não presente** em `GRUPOS`, `src/components/layout/nav.ts:60-143` — só alcançável por link direto/redirect), `/fila-otimizacao` (só equipe), `/esteira/lote`, `/auditoria-massa/*`.
**Problema:** quatro rotas com nomes quase idênticos ("otimizar-lote", "fila-otimizacao", "esteira/lote", "auditoria-massa") e propósitos que se sobrepõem, uma delas órfã do menu. É exatamente o sinal de alerta "hierarquia rasa/nomenclatura ruim" que a skill pede para marcar.
**Impacto:** equipe e agência, na hora de decidir onde processar/otimizar produtos em massa — risco de escolher a tela errada ou não achar a certa.
**Recomendação:** não decidir fusão sem entender uso real (não deletar nada) — mapear quantos acessos cada rota recebe e se `/otimizar-lote` ainda é usada por algum fluxo/link antes de propor consolidação. Isso é trabalho de fase AUDIT/DESIGN, fora do escopo desta sessão.
**Esforço:** S para o levantamento de uso; M–L para eventual consolidação.

---

### [P2] Design system · Dois sistemas de tokens não integrados
**Evidência:** produção usa um núcleo pequeno de tokens em `src/app/globals.css:53-78` (`--surface-raised`, `--surface-input`, `--surface-sidebar`), com comentário explícito dizendo que **não deve** importar `src/design/foundation` porque aquele é "o sistema tokenizado da Vertical Slice Zero (/z)" e seu gerador "diz 'jamais no globals.css de produção'". `src/design/tokens.json` e `src/design/foundation/*`/`semantic/*` existem como sistema completo, mas isolados para `/z`.
**Problema:** a maior parte de cor/espaçamento/raio em produção ainda é Tailwind hardcoded nas telas, não tokens — e existe um segundo sistema de tokens completo no repositório que não alimenta produção nenhuma. Isso é retrabalho represado: quando (se) o design system experimental for adotado, será uma migração grande, não incremental.
**Impacto:** manutenção (baixa consistência visual entre telas), e custo crescente de migração futura quanto mais telas novas usarem valores hardcoded em vez do núcleo de tokens já existente.
**Recomendação:** ao criar telas novas, usar o núcleo de tokens já existente (`--surface-*`) em vez de valores hardcoded; decidir explicitamente (fase DESIGN, não aqui) se o sistema de `/z` será promovido ou descontinuado — mantê-lo indefinidamente como "terceira via" é o pior dos cenários.
**Esforço:** S (disciplina em telas novas) a L (unificação retroativa).

---

### [P2] Acessibilidade · Modais não migrados para a primitiva `Dialog`
**Evidência:** `src/components/ui/Dialog.tsx:41` é a primitiva consolidada (comentário nas linhas 3-17 relata que havia "três modais escritos à mão [...] e oito `fixed inset-0` soltos"). Ainda não migrados: `src/components/client-portal/CadastrarProduto.tsx:118`, `src/components/client-portal/PublicarAnuncio.tsx:168`, `src/app/cliente/produtos/page.tsx:1338` e `:1388`.
**Problema:** esses quatro modais são `fixed inset-0` escritos à mão, sem `role="dialog"`, sem foco preso, sem fechar com Esc confirmado — atrás do padrão que o resto do produto já adotou.
**Impacto:** usuários de teclado/leitor de tela nessas quatro telas especificamente (cadastro de produto e publicação de anúncio no portal do lojista — telas de uso frequente).
**Recomendação:** migrar os quatro para `Dialog`, seguindo o exemplo já feito em `ModalPublicar` (`src/app/esteira/aprovacoes/page.tsx:597-599,634`).
**Esforço:** S por modal, 4 modais = M no total.

---

### [P3] Arquitetura de informação · Ausência de página "minha agência"
**Evidência:** busca por diretório `src/app/agencia` (singular) não encontrou nada. Dados da própria agência aparecem fatiados entre a home de portfólio (`/`, `src/app/page.tsx`) e um card dentro de `/configuracoes` (`configuracoes/page.tsx:29-30,34`, tela compartilhada com a equipe).
**Problema:** não há uma tela única de "identidade da minha agência" (nome, plano, integrações, dados cadastrais) — só a lista de lojas (portfólio) e um card genérico de configurações.
**Impacto:** usuários com papel `agencia`, ao procurar onde editar dados da própria agência.
**Recomendação:** avaliar (fase DESIGN, fora deste escopo) se vale a pena uma rota `/agencia` própria ou se consolidar tudo dentro de `/configuracoes` é suficiente — é lacuna, não redundância a remover.
**Esforço:** M, depende da decisão de design.

---

### [P3] Navegação · `/z` — segunda arquitetura paralela, fora do produto, ainda no repositório
**Evidência:** `src/app/z/page.tsx:1-143`, `src/shell/Frame/Frame.tsx`, `src/design/foundation/*` — deliberadamente fora do menu (`SO_EQUIPE_FORA_DO_MENU`, `nav.ts:169`), com testes próprios (`controlesNativos.test.ts`, `oNavegadorNaoAlcancaEssaOrigem.test.ts` na raiz de `src/app`).
**Problema:** é um protótipo de arquitetura vivo (lê dados reais, não é mock), mantido, mas nunca promovido a produto — desde a auditoria de agosto (`docs/product/ux/README.md:25`, "sem adotar o Shell de `/z`"). Continuar mantendo dois sistemas de shell/design em paralelo tem custo de manutenção contínuo sem retorno de produto até que uma decisão seja tomada.
**Impacto:** carga cognitiva para quem entra no repositório (mais uma arquitetura para entender) e custo de manutenção dos testes/dependências associadas.
**Recomendação:** decisão explícita (não desta sessão): promover, congelar documentadamente como "spike encerrado", ou arquivar. Não decidir sozinho aqui — é chamado de "risco aberto" para o usuário resolver.
**Esforço:** decisão é imediata (S); execução da decisão varia de S (documentar como encerrado) a L (promover a produto).

---

### [P3] Nomenclatura · `clientes`/`cliente` ainda significa "loja" na interface
**Evidência:** avisos redundantes no próprio código contra confusão — `src/lib/auth/roteamentoPapel.ts:69-70` e `src/components/layout/AppShell.tsx:220-221`. A emenda "Loja ≠ Cliente" já estava registrada como pendente em `docs/product/ux/README.md:26` desde agosto.
**Problema:** o nome físico da tabela/rota (`clientes` = loja) segue diferente do vocabulário de produto (loja), e os rótulos de menu/carteira ainda usam "Clientes" em vez de "Lojas" em pelo menos uma tela (`src/app/clientes/page.tsx`). Renomear rota física é bloqueado pelo `redirect_uri` fixo do OAuth do Mercado Livre (`next.config.ts:127-131`) — problema técnico real, não só preguiça.
**Impacto:** novos usuários e novos desenvolvedores, ao aprender o vocabulário do produto.
**Recomendação:** já documentado como pendente (fatia 8 do README, `docs/product/ux/README.md:40`); esta reverificação confirma que continua sem solução física — não é achado novo, é confirmação de que o item aberto continua aberto.
**Esforço:** L (bloqueado por dependência externa — o redirect_uri do ML).

---

## Riscos abertos (não avaliados a fundo nesta sessão, fora do escopo de leitura)

- **Rótulos de menu vistos pelo usuário final** (ex.: se o item de menu já diz "Lojas" mesmo a rota sendo `/clientes`) não foram verificados pixel a pixel — os agentes leram o código-fonte das rotas e comentários, não uma varredura de todo texto visível de UI. Recomenda-se, antes de decidir a fatia de vocabulário, uma varredura de string literal nos componentes de menu.
- **As ~40 ocorrências de `service_role`** foram amostradas, não auditadas uma a uma linha por linha — o achado P1 acima já recomenda esse levantamento completo como próximo passo, idealmente pela skill `zion-saas-security-audit`.
- **Uso real de `/otimizar-lote`** (analytics de acesso) não foi verificado — a recomendação de consolidação depende desse dado, que não existe no código-fonte.
