# Tarefas — uma loja assina e opera sozinha

> **Estado em 25/08/2026:** T2, T3, **CHECKPOINT 2** e **T4** feitos. A Fase 3 encolheu e
> saiu do caminho crítico. **T1 continua aberta** e é a única que não sai daqui: exige
> navegador, e-mail, planilha real e a decisão sobre qual conta ML conectar. O staging foi
> religado em 25/08, então ela roda lá — não em produção. CHECKPOINT 1 e Fase 4 dependem dela.


Plano completo, com o porquê de cada tarefa: [plan.md](plan.md).
Aprovado em 25/08/2026.

Ordem: **T1 e T2 correm juntas** (independentes). **T3** não depende de nenhuma das duas,
mas o CHECKPOINT 1 pode reordená-la. **Fase 4** só abre depois do CHECKPOINT 1.

---

## T1 · Medir o caminho da loja nova — **no staging** (revisto em 25/08)

> Tudo em AUD-005 foi lido, não executado. Sem isto, o CHECKPOINT 1 e a Fase 4 são palpite.

A decisão de medir na conta real caiu: o projeto `zion-os-staging`
(`fivlziuvxvhpuibrjwlq`, us-east-1, criado em 10/07/2026) estava só **pausado**, e foi
religado em 25/08. Com ele de pé, as cinco guardas de mexer em produção deixam de ser
necessárias — e a mais séria delas some junto: nenhum anúncio de teste pode ir parar na
loja que vende.

Antes de percorrer:

- [x] **Deriva medida em 25/08** — [11-ONDE-O-STAGING-PAROU.md](../docs/staging-setup/11-ONDE-O-STAGING-PAROU.md):
      o staging parou na **016**, o repositório está na **076**, faltam **58 migrações**
      (022–076; os números 017–021 não existem)
- [x] **As 58 migrações aplicadas em 25/08** — staging e produção agora têm o mesmo
      esquema (52 tabelas, contagem de colunas idêntica). A comparação achou deriva entre
      repositório e produção nos dois sentidos: [INC-012](../docs/engineering/incidents/INC-012-o-repositorio-e-a-producao-derivaram-nos-dois-sentidos.md)
- [x] **Variáveis do staging** — `.env.staging` criado em 25/08 com a URL e a chave
      anônima do Supabase de staging PREENCHIDAS (são públicas por desenho)
- [ ] **Preencher as credenciais** que sobraram no `.env.staging`, cada uma com o
      lugar de onde se pega anotado ao lado: `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`,
      `ML_CLIENT_ID`/`ML_CLIENT_SECRET`/`ML_REDIRECT_URI`, chave de IA, `CRON_SECRET`
- [ ] Para rodar local contra o staging: `cp .env.staging .env.development.local`
      (o Next NÃO carrega `.env.staging` — ver a ressalva na
      [05](../docs/staging-setup/05-VARIAVEIS-DE-AMBIENTE.md)). Para voltar, apague o arquivo
- [ ] **App ML separado** para staging, com `ML_REDIRECT_URI` próprio
      ([04-MERCADO-LIVRE-STAGING.md](../docs/staging-setup/04-MERCADO-LIVRE-STAGING.md)) —
      nunca o `client_secret` de produção
- [ ] A conta ML conectada é de **teste ou controlada**. O ML não tem sandbox completo:
      publicar por uma conta que vende coloca anúncio de teste numa loja real

O percurso:

- [ ] 1 · assinar — `signUp` no navegador
- [ ] 2 · provisionar — tela "Vamos montar sua loja"
- [ ] 3 · importar base — **planilha de ERP real**, não o modelo gerado
- [ ] 4 · imagens
- [ ] 5 · descrições
- [ ] 6 · atributos
- [ ] 7 · publicar (ou dry-run, se não houver conta ML de teste)
- [ ] 8 · acompanhar

Aceite:

- [ ] `docs/engineering/AUD-006-a-loja-nova-medida.md`, uma linha por passo:
      *passou sozinho* / *parou aqui, por isto*
- [ ] Todo passo que parou registra a **mensagem exata** da tela
- [ ] Nada escrito na base de produção

---

## T2 · O plano fantasma

> `provisionar` cria com `plano: "Essencial"`; `PLANOS` não tem "Essencial". Abrir e
> salvar a ficha dessa loja no formulário da equipe reescreve o plano em silêncio.

- [x] "Essencial" entra em `PLANOS` ([lib/constantes.ts:70](../src/lib/constantes.ts:70))
- [x] `PLANO_INICIAL` deixa de ser literal em
      [api/loja/provisionar/route.ts:40](../src/app/api/loja/provisionar/route.ts:40) e
      passa a sair do mesmo módulo
- [x] Teste novo reprova se o plano de entrada não estiver em `PLANOS`
      (idioma de `fontesDeImportacao.test.ts`)
- [x] Abrir e salvar em `ClienteForm` uma loja auto-provisionada **preserva** o plano
- [x] `npm run typecheck` · `npm run lint` · `npm test` verdes

---

## CHECKPOINT 1 — depois de T1

- [ ] Ler AUD-006: **a loja chega ao fim sozinha?**
- [ ] **Chega** → Fase 4 liberada
- [ ] **Não chega** → o que parou vira tarefa; cobrança continua adiada

---

## T3 · Atributos: parar de jogar fora o que o ML manda

> Medido em 25/08 em `/categories/MLB273770/attributes`: 78 atributos, 6 obrigatórios,
> e 5 deles já vêm com a lista de valores aceitos (BRAND 11 · GENDER 6 · COLOR 51 ·
> SIZE 44 · FOOTWEAR_TYPE 4; só MODEL é livre). 49 de 78 trazem lista. O código guarda
> só `{id, nome}`.

- [x] `atributosObrigatorios` e `recorteDaCategoria`
      ([mercadolivre.ts:303](../src/lib/marketplaces/mercadolivre.ts:303)) preservam
      `value_type`, `values` (id + nome), `hint` e `value_max_length`
- [x] `ExigenciaDaCategoria` ganha as opções aceitas; `OBRIGATORIOS_CALCADO` segue como
      fallback sem rede
- [x] `AtributoResolvido` passa a ter três estados: resolvido · escolha entre N opções ·
      pergunta aberta
- [x] Superfície da pergunta **rastreada, não presumida** — seguir o `AtributoResolvido`
      até `preparacaoDoAnuncio.ts`, `briefingDosAtributos` e `api/otimizar/worker`

Aceite:

- [x] Teste com a resposta real do ML **fixada em arquivo** (sem rede no teste) provando
      que `values`, `value_type` e `hint` sobrevivem
- [x] Obrigatório de tipo lista que o cadastro não resolve vira **escolha entre as opções
      do ML**, não pergunta aberta
- [x] Categoria que não responde continua entrando com listas vazias — a falha aberta não
      pode virar bloqueio
- [x] Nenhum valor inventado: fora do cadastro e fora da lista do ML continua `null`
- [x] `npm run typecheck` · `npm run lint` · `npm test` verdes

---

## CHECKPOINT 2 — feito em 25/08 · [AUD-007](../docs/engineering/AUD-007-o-que-o-ml-exige-nas-categorias-reais.md)

- [x] Medir as **categorias reais da conta**: quantos obrigatórios trazem lista de valores
- [x] **24 dos 31 obrigatórios (77%) chegam com valores publicados pelo ML**
- [x] Dos 7 que não chegam, 6 são `MODEL` e 1 é `BRAND` — os dois saem do **cadastro**
- [x] Conclusão: **nenhum obrigatório desta conta depende de olhar concorrente**

---

## FASE 3 · Concorrentes no ML — encolheu, sai do caminho crítico

O CHECKPOINT 2 respondeu: ou o ML publica o valor, ou o cadastro já tem. Buscar
concorrente continua fazendo sentido para **posicionamento** — título, preço, o que os
melhores anúncios fazem —, que é trabalho de *vender melhor*, não de *conseguir publicar*.

Sai do caminho da loja que opera sozinha. Não é mais bloqueio do marco.

---

## T4 · A categoria certa nos cinco caminhos — [INC-011](../docs/engineering/incidents/INC-011-o-retrato-de-calcado-vale-para-85-por-cento.md)

> Descoberto pela medição do CHECKPOINT 2. **118 dos 792 anúncios (15%)** estão em
> categorias onde o retrato `OBRIGATORIOS_CALCADO`, passado à mão por cinco caminhos,
> está errado — e erra nas duas direções.

- [x] Decisão pura de qual lista vale, com procedência: `obrigatoriosDoProduto.ts`
- [x] **Categoria desconhecida não virou parede nova** — e lista vazia do ML cai no
      palpite, não em "não exige nada"
- [x] `api/otimizar/worker` lê `anuncios_gerados.categoria_ml` e busca a lista real
- [x] `app/cliente/anunciar` usa a categoria que já tinha em memória + `/api/ml/categoria`
- [x] Os 3 caminhos do assistente: o porto passou a trazer `obrigatorios` no item, com
      UMA ida ao ML por categoria distinta (seis, não trezentas)
- [ ] **Falta:** medição depois — quantas pendências de atributo sumiram por categoria

Aceite:

- [x] Nenhum dos cinco caminhos passa `OBRIGATORIOS_CALCADO` sem antes tentar a categoria
- [x] Teste provando que MLB23332 não gera pendência de `FOOTWEAR_TYPE`
- [x] Teste provando que categoria desconhecida não bloqueia (sai idêntico ao de antes)
- [x] `npm run typecheck` · `npm run lint` · `npm test` verdes (3.778 testes)


## FASE 4 · Cobrança — bloqueada pelo CHECKPOINT 1

"Billing não existe. Zero linhas" (PLANO-001:178). A decisão de mantê-lo fora do caminho
crítico continua de pé até AUD-006 dizer que a loja chega ao fim.

---

## Ao rodar o gate

`npm run gate` **já fica vermelho** nesta branch: `typecheck:test` tem 13 erros anteriores
a este plano, em `trilhaDaConversa`, `faixaLater`, `filaDeCorrecao` e `gradeNoMarketplace`
— nenhum deles tocado por tarefa daqui. Conferido em 25/08 (13 antes, 13 depois). Não é seu.
