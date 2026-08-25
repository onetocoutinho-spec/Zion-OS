# Capítulo 01 — Modelo Funcional Canônico do Zion OS

> **Natureza.** Modelo funcional do produto, derivado do **comportamento observável** em
> produção — telas, rotas e serviços que entregam valor ao usuário. **Não descreve código,
> arquitetura ou padrões.** Onde a evidência não bastou: **EVIDÊNCIA INSUFICIENTE**.
>
> **Base de evidência:** `HEAD d2b0fe5`. 61 telas, 11 rotas de API, 41 serviços observados.

---

## 1. Objetivo

Responder, por evidência, a uma pergunta de negócio — não de engenharia:

> **O que o Zion OS realmente faz?**

E converter as descobertas em um **backlog executável por pequenas releases incrementais**.

## 2. Escopo

O **produto em produção**: o que o usuário consegue fazer. Fonte de evidência: as telas
(`src/app/*/page.tsx`), as capacidades de servidor (`src/app/api/*/route.ts`) e os serviços
que as sustentam (`src/lib/services`). A Fundação (`src/domain` etc.) **não** é objeto — não
entrega comportamento ao usuário (estabelecido em missões anteriores).

## 3. Metodologia

Cada capacidade foi derivada da **tríade observável**: uma **tela** que o usuário acessa +
uma **rota** que executa + um **serviço** que a entrega. Nenhuma capacidade foi inferida de
nome de arquivo isolado. Onde só há um dos três, está registrado como parcial.

---

## 4. Visão geral

### 4.1 Dois usuários observados

A evidência revela **duas superfícies de uso distintas**:

| Persona | Superfície | Evidência |
|---|---|---|
| **Equipe (agência)** | `/produtos`, `/clientes`, `/agentes`, `/esteira`, `/anuncios`, `/auditoria-massa`, `/financeiro`, `/relatorios`, `/onboarding`, `/templates`, `/reunioes`, `/tarefas` | ~40 telas administrativas |
| **Cliente (self-service)** | `/cliente/produtos`, `/cliente/otimizar`, `/cliente/anuncios`, `/cliente/precificacao`, `/cliente/imagens`, `/cliente/medidas`, `/cliente/vendas`, `/cliente/conectar-ml`, `/cliente/auditoria`, `/cliente/pendencias`, `/cliente/relatorios`, `/cliente/configuracoes`, `/cliente/ajuda` | 13 telas `/cliente/*` |

**Leitura factual:** o Zion opera como **plataforma de duas faces** — uma equipe interna e
um portal onde o próprio cliente executa seu trabalho. Ambas compartilham o mesmo motor.

### 4.2 O motor central — a Esteira de IA

A capacidade recorrente, presente em ambas as superfícies, é a **Esteira**: um pipeline de
agentes de IA (**A1 a A10**) que transforma um produto cru em um **Anúncio Gerado**
completo, com um **veredito de qualidade final** (A10 = aprovado/reprovado). É o que
distingue o Zion de um integrador de marketplace.

---

## 5. Capacidades

Cada capacidade: valor ao usuário + evidência (tela · rota · serviço).

### C1 — Cadastro e importação de produtos
- **Objetivo:** trazer produtos para o sistema.
- **Problema resolvido:** ter uma base de produtos para operar.
- **Entradas:** cadastro manual; planilha CSV; custos; anúncios existentes do ML.
- **Saídas:** produtos na base do cliente.
- **Evidência:** telas `/produtos`, `/produtos/importar`, `/cliente/produtos`; serviços
  `produtos`, `importacaoProdutos`, `importacaoCsv`, `importacaoCustos`, `importarAnunciosML`.

### C2 — Geração de anúncio por IA (Esteira) — **o núcleo**
- **Objetivo:** transformar um produto cru em um anúncio pronto para o marketplace.
- **Problema resolvido:** criar título, descrição, palavras-chave, ficha técnica e imagens
  de qualidade sem trabalho manual especializado.
- **Entradas:** produto (ficha, variações, marca).
- **Saídas:** **Anúncio Gerado** com: `notaDiagnostico` (A1), `tituloOtimizado` (SEO ≤60,
  keyword na frente), `palavrasChave`, `descricaoCompleta`, `fichaTecnica`,
  `imagensSugeridas`, `faq`, e **`vereditoA10`** (aprovado só se passar no checklist).
- **Estados:** rascunho → gerado → aprovado/reprovado (veredito A10).
- **Eventos produzidos:** anúncio gerado; veredito emitido.
- **Evidência:** telas `/esteira`, `/esteira/aprovacoes`, `/esteira/lote`, `/cliente/otimizar`;
  rota `agentes/esteira`; serviços `esteira`, `cadeiaEsteira`, schema do `AnuncioGerado`.

### C3 — Otimização em lote
- **Objetivo:** rodar a Esteira sobre muitos produtos de uma vez.
- **Evidência:** telas `/otimizar-lote`, `/esteira/lote`, `/fila-otimizacao`,
  `/cliente/otimizar`; rota `otimizar/worker`; serviços `filaOtimizacao`,
  `filaOtimizacaoProduto`, `execucoesLote`.

### C4 — Precificação
- **Objetivo:** definir preço com base em custo, margem e confiança.
- **Saídas:** `precoVenda`, `precoMinimo`, `margem`, `confiancaCusto`.
- **Evidência:** tela `/cliente/precificacao`; serviços `precificacaoVariantes`, `financeiro`.

### C5 — Tabelas de medidas (calçado)
- **Objetivo:** fornecer a guia de medidas por marca, exigida pelo modelo de calçado do ML.
- **Evidência:** tela `/cliente/medidas`; serviço `tabelasMedidasCliente`; dado
  `tabelasMedidas` (migrado como R10).

### C6 — Geração de imagens por IA
- **Objetivo:** produzir imagens sugeridas para o anúncio.
- **Evidência:** tela `/cliente/imagens`; rota `imagens/gerar`; serviços `imagemIA`,
  `imagensProduto`, `storageImagens`.

### C7 — Auditoria e pendências
- **Objetivo:** identificar o que falta ou está errado antes de publicar.
- **Saídas:** pendências, problemas de anúncio.
- **Evidência:** telas `/auditoria-massa`, `/cliente/auditoria`, `/pendencias`,
  `/cliente/pendencias`; serviços `auditoriaDaBase`, `auditorias`, `problemasAnuncio`,
  `pendencias`.

### C8 — Conexão de canal (Mercado Livre)
- **Objetivo:** conectar a conta do cliente ao ML por OAuth.
- **Restrição observada:** o `refresh_token` nunca trafega pelo navegador.
- **Evidência:** tela `/cliente/conectar-ml`; rotas `ml/autorizar`, `ml/conectar`; serviço
  `canaisMarketplace`.

### C9 — Publicação no Mercado Livre — **entrega final de valor**
- **Objetivo:** publicar o anúncio no ML.
- **Estados:** dry-run (revisão) → publicação real.
- **Restrição observada:** dois modelos — clássico e **User Products** (calçado, com guia
  de tamanhos); a categoria decide qual.
- **Evidência:** rota `ml/publicar`; serviço `publicacaoML`.

### C10 — Importação de anúncios existentes
- **Objetivo:** trazer anúncios já publicados no ML para dentro do Zion.
- **Evidência:** rota `ml/importar-anuncios`; serviço `importarAnunciosML`.

### C11 — Leitura de vendas
- **Objetivo:** ver as vendas do canal dentro do Zion.
- **Evidência:** telas `/vendas`, `/cliente/vendas`; rota `ml/vendas`; serviço `vendasML`.

### C12 — Configuração de agentes de IA
- **Objetivo:** criar e editar os agentes que compõem a Esteira.
- **Evidência:** telas `/agentes`, `/agentes/novo`, `/agentes/[id]/editar`; rota
  `agentes/executar`; serviços `agentes`, `agentePortal`, `categoriaTemplates`.

### C13 — Portal self-service do cliente
- **Objetivo:** permitir que o cliente opere sozinho.
- **Evidência:** as 13 telas `/cliente/*`; serviço `perfil`; tela `/cliente/ajuda`.

### C14 — Gestão de clientes (agência)
- **Objetivo:** cadastrar e administrar clientes atendidos.
- **Evidência:** telas `/clientes`, `/clientes/novo`, `/clientes/[id]`; serviço `clientes`.

### C15 — Relatórios
- **Objetivo:** consolidar resultados para leitura.
- **Evidência:** telas `/relatorios`, `/cliente/relatorios`; serviço `relatorios`.

### C16 — Onboarding
- **Objetivo:** conduzir o início do uso.
- **Evidência:** tela `/onboarding`; serviço `onboardings`.

### Capacidades administrativas/operacionais internas
- **Financeiro** (`/financeiro`), **Reuniões** (`/reunioes`), **Tarefas** (`/tarefas`),
  **Usuários** (`/usuarios/novo`, rota `usuarios`), **Busca** (`/busca`, serviço `busca`),
  **Exportação ERP** (serviço `exportacaoErp`). Sustentam a operação da agência, não o valor
  central do produto.

---

## 6. Cadeia de valor

Reconstruída sob a ótica do negócio, do nascimento do produto à geração de valor:

```
 (1) ENTRA            (2) ENRIQUECE (IA)         (3) PREPARA           (4) PUBLICA        (5) RETORNA
  produto cru   ──►   Esteira A1→A10        ──►  preço · medidas  ──►  Mercado Livre ──►  vendas
  cadastro/CSV/       diagnóstico→título→         imagens · auditoria    (clássico ou       lidas de volta
  import ML           descrição→ficha→            → pendências           User Products)     (C11)
  (C1, C10)           imagens→FAQ→veredito         (C4,C5,C6,C7)          via canal (C8,C9)
                      (C2, C3)
```

**Como um produto nasce:** por cadastro, importação de planilha ou importação de anúncio
existente do ML (C1, C10).

**Como é enriquecido:** pela Esteira de IA — um produto cru vira um Anúncio Gerado com
diagnóstico, SEO, descrição, ficha, imagens e FAQ (C2), individualmente ou em lote (C3).

**Como é preparado:** precificação (C4), guia de medidas para calçado (C5), imagens (C6), e
auditoria que aponta pendências (C7).

**Como é publicado:** conectado o canal (C8), publica no ML — clássico ou User Products,
conforme a categoria (C9).

**Como gera valor:** o cliente obtém anúncios de qualidade sem trabalho manual
especializado, e vê as vendas de volta (C11). **O valor é a transformação
produto-cru → anúncio-publicável-aprovado, feita por IA com portão de qualidade.**

---

## 7. Relações entre capacidades

| Capacidade | Inicia | Depende de | Consome | Complementa | Observa |
|---|---|---|---|---|---|
| C2 Esteira | C1 (produto existe) | C1 | produto | C4,C5,C6 | C7 |
| C3 Lote | usuário | C2 | fila | — | C7 |
| C9 Publicação | usuário/aprovação | C2 (anúncio), C8 (canal), C5 (medidas p/ calçado) | Anúncio Gerado | — | C7 |
| C8 Conexão | usuário | — | OAuth ML | C9 | — |
| C11 Vendas | usuário | C8, C9 | ML | — | — |
| C7 Auditoria | usuário/sistema | C1 | base | C2, C9 | — |
| C12 Agentes | usuário | — | — | C2 (define a Esteira) | — |
| C13 Portal | cliente | todas as `/cliente/*` | — | — | — |

**Dependência crítica observada:** **C9 (publicação) depende de C2, C8 e — para calçado —
C5.** A Esteira (C2) é o insumo; sem ela, a publicação não tem o que publicar.

---

## 8. Classificações

| Capacidade | Categoria | Justificativa |
|---|---|---|
| **C2 Esteira de IA** | **CORE** | É o valor central: transforma produto cru em anúncio aprovado. Diferencial |
| **C9 Publicação ML** | **CORE** | Entrega final — sem ela, o valor não se realiza no canal |
| C1 Cadastro/importação | SUPORTE | Viabiliza C2 |
| C3 Otimização em lote | CORE (escala do C2) | É o C2 aplicado em escala |
| C4 Precificação | SUPORTE | Prepara para publicar |
| C5 Medidas | SUPORTE | Pré-requisito de calçado no ML |
| C6 Imagens IA | SUPORTE | Enriquece o anúncio |
| C7 Auditoria/pendências | OPERACIONAL | Garante qualidade antes de publicar |
| C8 Conexão de canal | INTEGRAÇÃO | Ponte com o ML |
| C10 Importação de anúncios | INTEGRAÇÃO | Traz o existente do ML |
| C11 Vendas | INTEGRAÇÃO | Lê o resultado do ML |
| C12 Agentes | SUPORTE | Define como a Esteira opera |
| C13 Portal self-service | CORE (modelo de entrega) | É como o valor chega ao cliente sozinho |
| C14 Clientes | ADMINISTRATIVA | Gestão da agência |
| C15 Relatórios | OPERACIONAL | Leitura de resultados |
| C16 Onboarding | OPERACIONAL | Início de uso |
| Financeiro/Reuniões/Tarefas | ADMINISTRATIVA | Operação interna |

---

## 9. Dependências

**Cadeia principal (crítica):** C1 → C2 → C9 → C11, com C8 habilitando C9.
**Cadeia de preparação (paralela):** C4, C5, C6, C7 alimentam C9.
**Cadeia de configuração:** C12 define o comportamento de C2.
**Entrega:** C13 embrulha tudo para o cliente operar sozinho.

---

## 10. Criticidade

| Capacidade | Pode deixar de existir? | Se falhar, o sistema é útil? | Diferencial? | Obrigatória? |
|---|---|---|---|---|
| **C2 Esteira** | **Não** | **Não** — sem ela, é um cadastro | **Sim** | Sim |
| **C9 Publicação** | Não | Não — o valor não sai do Zion | Não (é comum) | Sim |
| C5 Medidas | Não, para calçado | Parcial — só calçado afeta | Não | Sim p/ calçado |
| C8 Conexão | Não | Não publica | Não | Sim |
| C13 Portal | Depende do modelo | Sim (equipe opera) | Sim (self-service) | Depende |
| C7 Auditoria | Sim | Sim, com risco de qualidade | Parcial (veredito A10) | Não |
| C14–C16, admin | Sim | Sim | Não | Não |

---

## 11. Sobreposições — fatos observados

**S1 — Variação modelada em três lugares.** `produtoVariantes`, `anuncioVariantes` e
`precificacaoVariantes` tratam a mesma variação sob três recortes. *Fato observado; não
julgado.*

**S2 — Importação com múltiplos serviços.** `importacaoProdutos`, `importacaoCsv`,
`importacaoCustos`, `importacoes`, `importarAnunciosML` — cinco serviços na fronteira de
entrada. *Fragmentação observada.*

**S3 — Auditoria em dois níveis.** `auditoriaDaBase` e `auditorias` + `auditoria-massa`. A
distinção exata entre eles é **EVIDÊNCIA INSUFICIENTE** sem ler os corpos.

**S4 — Dois mundos de produto.** O `Produto` de publicação (produção) e o `ProdutoMestre`
canônico (Fundação) — divergência de escopo já estabelecida na Análise de Domínio. **Não
reinvestigada aqui.**

---

## 12. Limites

- **Onde o Zion começa:** quando um produto entra (cadastro/import).
- **Onde termina:** quando o anúncio está publicado no ML e as vendas retornam. **Não**
  gerencia estoque-fonte, logística ou pagamento — nenhuma tela/rota observada para isso.
- **Fronteira com o ML:** o Zion **traduz e publica**, mas o ML é a autoridade do anúncio
  ativo. A leitura de vendas confirma essa fronteira (C11).
- **Fronteira com o ERP:** há `exportacaoErp` e importação de custos, mas **EVIDÊNCIA
  INSUFICIENTE** sobre a profundidade da integração ERP em produção.

---

## 13. Backlog Arquitetural

Cada item nasce de **evidência já produzida** (nesta missão ou anteriores). **Nenhum exige
reescrita.** Tipo · Necessita implementação · tamanho de release.

| # | Título | Problema observado | Evidência | Tipo | Necessita impl.? | Prioridade | Complexidade |
|---|---|---|---|---|---|---|---|
| **B1** | Remover rota de diagnóstico de produção | `/api/ml/diagnostico-guias` permanece na linha principal | Mapeamento §B6; Diagnóstico D4 | Governança | **SIM** | Média | Baixa |
| **B2** | Corrigir índice do README (ADR-008 + 8 artefatos ausentes) | Índice de governança omite ADR aprovado | Release 017, achado A1 | Documentação | **SIM** | Alta | Baixa |
| **B3** | Reconciliar ADR-003/005/006 em `governance/` | Três ADRs fora do acervo rastreado | Registrado desde a Release 005 | Governança | **SIM** | Média | Baixa |
| **B4** | Institucionalizar os 5 documentos de análise pós-programa | Diagnóstico, validação, convergência, domínio e este capítulo não rastreados | Esta série de missões | Documentação | **SIM** | Alta | Baixa |
| **B5** | Adotar VO `Ean` como validação **aditiva** | Produção não valida dígito GTIN; VO existe e é testado | Análise de Domínio §8; Convergência 001 | Domínio | **SIM** | Média | Baixa |
| **B6** | Adotar VO `SkuOrigem` como normalização **aditiva** | Produção não normaliza SKU | Convergência 001 §6 | Domínio | **SIM** | Baixa | Baixa |
| **B7** | Consolidar entrada de importação (S2) | 5 serviços de importação fragmentados | §11 S2 | Produto | **SIM** | Baixa | Média |
| **B8** | Decidir destino da Fundação (Mundo B) | ~6 mil linhas não executadas | Diagnóstico D1; Validação da Fundação | Arquitetura | **NÃO** — é decisão, não engenharia | Alta | — |
| **B9** | Validação operacional da reutilização de guias | Desbloqueia 8 responsabilidades do Grupo C | Plano Executivo; Encerramento | Operação | **NÃO** — exige operador em produção | Alta | — |
| **B10** | Especificar Vendas/Pedidos (R5) e Identity & Access (R16) | 2 responsabilidades sem destino arquitetural | Plano Executivo, Grupo D | Arquitetura | **NÃO** — exige especificação | Média | — |
| **B11** | Esclarecer distinção `auditoriaDaBase` × `auditorias` (S3) | Duas auditorias, semântica não observável | §11 S3 | Documentação | **SIM** | Baixa | Baixa |

---

## 14. Releases sugeridas

**Somente para itens com "Necessita implementação: SIM".** Todas pequenas, reversíveis,
incrementais — **nenhuma Big Bang**.

### R-B2 — Corrigir o índice do README *(o menor passo, maior clareza)*
- **Objetivo:** o índice de governança listar todos os artefatos rastreados, incluindo ADR-008.
- **Escopo:** um arquivo — `docs/zion-os/README.md`.
- **Critérios de aceitação:** os 3 ADRs e os documentos de engenharia rastreados constam do índice.
- **Riscos:** nenhum — documentação.
- **Rollback:** reverter o commit.
- **Estimativa:** **Baixa**.

### R-B4 — Institucionalizar os documentos de análise pós-programa
- **Objetivo:** preservar diagnóstico, validação, convergência, domínio e este capítulo no registro oficial.
- **Escopo:** 5 arquivos de documentação já existentes; nenhum código.
- **Critérios de aceitação:** os 5 rastreados; índice atualizado.
- **Riscos:** nenhum.
- **Rollback:** reverter o commit.
- **Estimativa:** **Baixa**.

### R-B1 — Remover a rota de diagnóstico
- **Objetivo:** retirar `/api/ml/diagnostico-guias` da produção.
- **Escopo:** uma rota + seus consumidores diretos (se houver).
- **Critérios de aceitação:** rota ausente; build verde; suíte verde; nenhuma tela a referencia.
- **Riscos:** baixo — verificar que nenhuma tela depende dela antes de remover.
- **Rollback:** reverter o commit; a rota é isolada.
- **Estimativa:** **Baixa**.

### R-B5 — `Ean` como validação aditiva
- **Objetivo:** validar EAN (dígito GTIN) em **um** ponto de entrada, **sem rejeitar** o que hoje é aceito — apenas sinalizar.
- **Escopo:** um consumidor; o VO e seus 2 arquivos-shared.
- **Critérios de aceitação:** EAN inválido é **sinalizado** (pendência/aviso), não bloqueado; comportamento de publicação inalterado; suíte verde.
- **Riscos:** médio — não transformar sinalização em bloqueio (mudaria comportamento). O critério de aceitação existe para conter isso.
- **Rollback:** remover o import; estado anterior restaurado.
- **Estimativa:** **Média**.

### R-B6 — `SkuOrigem` como normalização aditiva
- **Objetivo:** oferecer normalização de SKU em um ponto, sem alterar o dado já gravado.
- **Escopo:** um consumidor + o VO.
- **Critérios de aceitação:** SKUs novos podem ser normalizados na exibição/comparação; dados existentes intocados; suíte verde.
- **Riscos:** baixo — aditivo e reversível.
- **Rollback:** remover o import.
- **Estimativa:** **Baixa**.

### R-B3 / R-B11 — Reconciliação de ADRs e esclarecimento de auditoria
- **Objetivo:** mover ADR-003/005/006 para `governance/` (B3); documentar a distinção das duas auditorias (B11).
- **Escopo:** documentação.
- **Critérios de aceitação:** ADRs rastreados; nota de distinção registrada.
- **Riscos:** nenhum.
- **Rollback:** reverter.
- **Estimativa:** **Baixa**.

### R-B7 — Consolidação de importação *(a única com desenho a decidir)*
- **Objetivo:** reduzir a fragmentação dos 5 serviços de importação.
- **Escopo:** **EVIDÊNCIA INSUFICIENTE** para definir sem antes mapear responsabilidades de cada serviço — **precede uma missão de descoberta**, não uma release imediata.
- **Estimativa:** **Média** *(condicionada à descoberta)*.

---

## 15. Evidências insuficientes

- **Distinção `auditoriaDaBase` × `auditorias`** (S3) — não lida internamente.
- **Profundidade da integração ERP** — há serviços, não o fluxo completo observado.
- **Consumo real dos agentes configuráveis** — as telas existem; a extensão do uso em
  produção não é observável sem dados de operação.
- **Benefício operacional** de B5/B6 — o valor das validações é real no conceito; seu
  impacto medido em produção exige dados não disponíveis.
- **Semântica de `Listing`** vs anúncio de produção — fora do escopo desta missão.

---

## 16. Conclusões

### Síntese executiva

**Qual problema o Zion resolve?** Transformar produtos crus em **anúncios de marketplace
prontos e aprovados**, sem exigir do cliente conhecimento especializado de SEO, cópia,
ficha técnica ou imagem.

**Qual transformação entrega?** `produto cru → anúncio publicável, diagnosticado, otimizado
e aprovado por um portão de qualidade → publicado no Mercado Livre → vendas de volta`.

**Quais capacidades são o núcleo?** **C2 (Esteira de IA)** e **C9 (Publicação)** — uma
gera o valor, a outra o realiza. **C13 (portal self-service)** é o núcleo do **modelo de
entrega**.

**Quais apenas dão suporte?** C1, C4, C5, C6, C12 preparam; C7, C15, C16 operam; C14 e o
bloco administrativo gerem a agência.

**Qual é a cadeia principal de geração de valor?** C1 → **C2** → (C4/C5/C6/C7) → C8 →
**C9** → C11.

**O que torna o Zion diferente de um simples integrador de marketplace?** A **Esteira de IA
com portão de qualidade A1→A10**. Um integrador move dados entre sistemas; o Zion
**produz o conteúdo do anúncio e julga sua qualidade** antes de publicar. Essa é a
evidência que separa "integrador" de "fábrica de anúncios assistida por IA".

### Fechamento

Este capítulo estabelece o **Modelo Funcional Canônico** por evidência de comportamento, e
converteu-o em **11 itens de backlog** — 7 executáveis por pequenas releases, 4 que são
**decisões ou observações, não engenharia**. As releases sugeridas começam pelo menor passo
(corrigir o índice) e nenhuma exige reescrita.

> **A partir daqui, conhecimento vira engenharia rastreável:** cada item do §13 aponta a
> evidência que o originou e o menor passo que o executa — ou registra, honestamente, que
> não é engenharia.

---

*Produzido em 21 de julho de 2026 · `HEAD d2b0fe5` · sem alteração de código, produto, banco
ou governança.*
