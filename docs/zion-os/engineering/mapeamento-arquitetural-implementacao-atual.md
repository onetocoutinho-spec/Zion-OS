# Mapeamento Arquitetural da Implementação Atual

> **Natureza.** Linha de base para as etapas seguintes da refatoração arquitetural.
> **Identifica e registra**; não altera código, não move arquivos, não modifica
> arquitetura, não propõe melhorias e não inicia refatoração.
>
> **Método.** Todas as afirmações derivam de leitura direta do código na linha
> principal: contagem de linhas, símbolos exportados, importações e dependências
> reversas. Nenhuma afirmação é de memória.

---

## 1. Visão geral quantitativa

| Arquivo | Linhas | Consumido por |
|---|---:|---:|
| `src/lib/marketplaces/mercadolivre.ts` | **646** | **10 arquivos** |
| `src/app/api/ml/publicar/route.ts` | **320** | — (rota) |
| `src/lib/marketplaces/mlUserProducts.ts` | 310 | 3 |
| `src/lib/data/tabelasMedidas.ts` | 290 | 5 |
| `src/lib/auth/serverAuthorization.ts` | 209 | — |
| `src/lib/marketplaces/mlPayload.ts` | 138 | 1 |
| `src/lib/services/publicacaoML.ts` | 129 | 1 |
| `src/lib/marketplaces/normalizarTamanho.ts` | 94 | 2 |
| `src/lib/marketplaces/canalServidor.ts` | 81 | 6 |

**Observação estrutural relevante:** `mercadolivre.ts` **não importa nada** — é folha de
dependência. Todo o seu acoplamento é de **entrada** (10 consumidores), nenhum de saída.

---

## 2. Responsabilidades identificadas

### R1 — Custódia e renovação de credenciais do canal

- **Finalidade:** trocar código OAuth por tokens e renovar o acesso.
- **Arquivo:** `mercadolivre.ts` (linhas 68–132)
- **Funções:** `trocarCodigoPorToken`, `renovarToken`; constante `TOKEN_URL` (l. 11)
- **Dependências utilizadas:** nenhuma interna
- **Dependências recebidas:** `api/ml/conectar/route.ts`, `api/ml/publicar/route.ts`,
  `api/ml/vendas/route.ts`, `api/ml/importar-anuncios/route.ts`,
  `api/ml/diagnostico-guias/route.ts`
- **Chamadas externas:** endpoint de token do canal
- **Módulo destino:** **Integration — Connection**
- **Acoplamento:** **médio** (5 consumidores, mas superfície pequena e estável)
- **Prioridade de extração:** **média**

### R2 — Persistência do vínculo do canal

- **Finalidade:** ler e atualizar o registro do canal do cliente.
- **Arquivo:** `canalServidor.ts` (81 linhas)
- **Funções:** `lerCanalServidor`, `atualizarRefreshTokenServidor`
- **Dependências utilizadas:** cliente de persistência (tipo externo)
- **Dependências recebidas:** 6 arquivos
- **Módulo destino:** **Integration — Connection (infraestrutura)**
- **Acoplamento:** **alto** (6 consumidores; é a única porta de leitura do canal)
- **Prioridade de extração:** **baixa** — coeso e estável; mover cedo traria risco sem
  ganho proporcional

### R3 — Determinação de categoria do canal

- **Finalidade:** prever a categoria a partir do título.
- **Arquivo:** `mercadolivre.ts` (l. 134–144)
- **Funções:** `preverCategoria`
- **Dependências recebidas:** `api/ml/publicar/route.ts`
- **Chamadas externas:** endpoint de descoberta de domínio do canal
- **Módulo destino:** **Integration — Capability**
- **Acoplamento:** **baixo** (1 consumidor, função isolada de 11 linhas)
- **Prioridade de extração:** **alta** — candidato natural, custo mínimo

### R4 — Publicação de item no canal

- **Finalidade:** criar o anúncio no canal.
- **Arquivo:** `mercadolivre.ts` (l. 146–170)
- **Funções:** `criarItem`; tipo `ResultadoItemML`
- **Dependências recebidas:** `api/ml/publicar/route.ts`
- **Chamadas externas:** endpoint de itens do canal
- **Módulo destino:** **Integration — adaptador de canal**
- **Acoplamento:** **baixo**
- **Prioridade de extração:** **alta**

### R5 — Leitura de vendas do canal

- **Finalidade:** buscar pedidos pagos do vendedor.
- **Arquivo:** `mercadolivre.ts` (l. 172–258)
- **Funções:** `buscarPedidosML`; tipos `ItemPedidoML`, `PedidoML`, `OrderRaw`
- **Dependências recebidas:** `api/ml/vendas/route.ts`, `services/vendasML.ts`,
  `app/vendas/page.tsx`, `app/cliente/vendas/page.tsx`
- **Módulo destino:** **Integration — fronteira**, servindo um domínio **ainda não
  especificado** (Vendas/Pedidos foi reconhecido como domínio futuro)
- **Acoplamento:** **médio** (4 consumidores)
- **Prioridade de extração:** **baixa** — pertence a um domínio cuja arquitetura ainda
  não existe

### R6 — Importação de anúncios existentes

- **Finalidade:** ler anúncios já cadastrados na conta do vendedor.
- **Arquivo:** `mercadolivre.ts` (l. 260–388)
- **Funções:** `buscarAnunciosDoVendedor`, `mapearItem`, `attr`; tipos `AnuncioML`,
  `VariacaoAnuncioML`, `ItemRaw`
- **Dependências recebidas:** `api/ml/importar-anuncios/route.ts`,
  `services/importarAnunciosML.ts`
- **Módulo destino:** **Integration — Tradutor** (`mapearItem` e `attr` são tradução
  pura: convertem a forma do canal em forma do Zion)
- **Acoplamento:** **médio**
- **Prioridade de extração:** **média**

### R7 — Obtenção e reutilização da guia de medidas

- **Finalidade:** localizar guia equivalente do vendedor ou criá-la; obter os
  identificadores de linha.
- **Arquivo:** `mercadolivre.ts` (l. 390–646) — **~238 linhas**
- **Funções:** `criarGuiaTamanhos`; internas `buscarGuiaZion`, `buscarRowsOficiais`;
  auxiliares `normalizarNomeGuia` (l. 39–46), `mensagemErroTexto` (l. 48–66); tipos
  `LinhaGuiaTamanho`, `GuiaTamanhos`
- **Dependências recebidas:** `api/ml/publicar/route.ts`
- **Chamadas externas:** busca de guias, criação de guia, leitura de guia
- **Módulo destino:** **Integration** — distribuída internamente em **Mapping**
  (correspondência com a guia), **Capability** (exigências do canal), **Communication**
  (o diálogo) e **Policies** (equivalência, idempotência de comunicação, repetição)
- **Acoplamento:** **baixo de entrada** (1 consumidor), **alto internamente** (concentra
  quatro preocupações em uma função)
- **Prioridade de extração:** **alta** por valor arquitetural; **contida** por risco (ver
  §6)

### R8 — Tradução de erros do canal

- **Finalidade:** converter recusas do canal em mensagens do Zion.
- **Arquivo:** `mercadolivre.ts` — `extrairErro` (l. 19–31), `mensagemErroTexto` (l. 48–66)
- **Dependências recebidas:** uso interno por R1, R4, R6, R7
- **Módulo destino:** **Integration — Tradutor**
- **Acoplamento:** **médio** (usadas por quatro responsabilidades distintas do mesmo
  arquivo)
- **Prioridade de extração:** **média**

### R9 — Canonização de tamanhos

- **Finalidade:** normalizar a expressão de tamanhos para a linguagem do Zion.
- **Arquivo:** `normalizarTamanho.ts` (94 linhas)
- **Funções:** `normalizarTamanho`
- **Dependências utilizadas:** **nenhuma** — função pura
- **Dependências recebidas:** `mlUserProducts.ts` e o próprio teste
- **Chamadas externas:** nenhuma
- **Módulo destino:** **Publication — domínio** (compõe o conteúdo pretendido)
- **Acoplamento:** **baixo** — o mais baixo do conjunto
- **Prioridade de extração:** **alta** — função pura, testada, sem dependências

### R10 — Conhecimento de medidas por marca

- **Finalidade:** fornecer a correspondência tamanho→medida por marca.
- **Arquivo:** `tabelasMedidas.ts` (290 linhas)
- **Funções:** `medidasDaMarca` e tabelas de referência
- **Dependências recebidas:** `mlUserProducts.ts`, `contexto.ts`,
  `cliente/medidas/page.tsx`, `cliente/otimizar/page.tsx`, `cliente/produtos/page.tsx`
- **Módulo destino:** **Catalog** (verdade de produto)
- **Acoplamento:** **médio-alto** (5 consumidores, incluindo três telas)
- **Prioridade de extração:** **média**

### R11 — Determinação de exigência do modelo do canal

- **Finalidade:** saber se a categoria exige o modelo por tamanho e qual domínio de
  medidas usar.
- **Arquivo:** `mlUserProducts.ts` — `precisaUserProducts` (l. 49),
  `dominioDaCategoria` (l. 143), constantes `CATEGORIAS_USER_PRODUCTS` (l. 47) e
  `DOMINIO_POR_CATEGORIA` (l. 139)
- **Dependências recebidas:** `api/ml/publicar/route.ts`
- **Módulo destino:** **Integration — Capability**
- **Acoplamento:** **baixo**
- **Prioridade de extração:** **alta**

### R12 — Montagem do payload no formato do canal

- **Finalidade:** dar forma ao que o canal exige.
- **Arquivos:** `mlUserProducts.ts` — `montarItensUserProducts` (l. 90);
  `mlPayload.ts` — `montarItemML`, `listingTypeId`
- **Dependências utilizadas:** `mlPayload` ← `mlUserProducts`; tipos de `agentes/esteira`
  e `types`
- **Dependências recebidas:** `publicacaoML.ts`, `api/ml/publicar/route.ts`
- **Módulo destino:** **Integration — Tradutor**
- **Acoplamento:** **médio**
- **Prioridade de extração:** **média**

### R13 — Composição do conteúdo pretendido

- **Finalidade:** reunir marca, gênero, tamanhos, medidas e variações do que se pretende
  publicar.
- **Arquivo:** `mlUserProducts.ts` — `montarBundleUserProducts` (l. 238)
- **Dependências utilizadas:** `normalizarTamanho` (R9), `medidasDaMarca` (R10),
  `AnuncioGerado` (tipo da esteira de IA)
- **Dependências recebidas:** `publicacaoML.ts`
- **Módulo destino:** **Publication — domínio (Planejamento)**
- **Acoplamento:** **alto** — depende de três origens distintas e convive no mesmo
  arquivo que tradução de canal (R11, R12)
- **Prioridade de extração:** **alta** por valor; **contida** por risco

### R14 — Orquestração da publicação (servidor)

- **Finalidade:** conduzir a publicação de ponta a ponta.
- **Arquivo:** `api/ml/publicar/route.ts` (320 linhas; manipulador único)
- **Dependências utilizadas:** R1, R3, R4, R7, R11, R12, R2 e autorização
- **Módulo destino:** **distribuído** — Interface (entrada), Operation Center
  (coordenação), Integration (execução)
- **Acoplamento:** **alto** — maior concentração de dependências do conjunto
- **Prioridade de extração:** **alta** por valor; **última** por risco

### R15 — Montagem e disparo no cliente

- **Finalidade:** montar o pedido de publicação e chamar o servidor.
- **Arquivo:** `services/publicacaoML.ts` (129 linhas)
- **Dependências utilizadas:** `mlPayload`, `mlUserProducts`, `canaisMarketplace`,
  `sessao`, `anunciosGerados`, `storageImagens` — **seis origens**
- **Dependências recebidas:** `esteira/aprovacoes/page.tsx`
- **Módulo destino:** **Publication — Aplicação** (a composição da intenção não pertence
  à camada de apresentação)
- **Acoplamento:** **alto de saída**, **baixo de entrada**
- **Prioridade de extração:** **média**

### R16 — Autorização de acesso

- **Finalidade:** aferir quem pode operar cada cliente.
- **Arquivo:** `auth/serverAuthorization.ts` (209 linhas)
- **Módulo destino:** **capacidade transversal**, apoiada em Identity & Access
- **Acoplamento:** **médio**
- **Prioridade de extração:** **baixa** — já isolada e coesa

### R17 — Telemetria da publicação

- **Finalidade:** registrar o curso da publicação e da obtenção da guia.
- **Arquivos:** `api/ml/publicar/route.ts` (auxiliar `log`, l. 75–94; marcação
  `ml.publicar`); `mercadolivre.ts` (marcação `ml.guia`, ao final de R7)
- **Módulo destino:** **capacidade transversal (observabilidade)**
- **Acoplamento:** **médio** — entrelaçada ao fluxo em ambos os arquivos
- **Prioridade de extração:** **baixa** — constitui hoje o **contrato comportamental**
  usado para comprovar preservação de comportamento

---

## 3. Responsabilidades misturadas

Registro factual, sem juízo:

**M1 — `mercadolivre.ts` reúne seis responsabilidades de naturezas distintas**
(R1, R3, R4, R5, R6, R7), servindo consumidores diferentes: autenticação, taxonomia,
publicação, vendas, importação e guias de medidas. Evidência: 10 consumidores, cada um
importando um subconjunto distinto.

**M2 — `mlUserProducts.ts` reúne tradução de canal e composição de conteúdo**
(R11 e R12 convivendo com R13). Evidência: importa `normalizarTamanho` e
`medidasDaMarca` (composição) no mesmo arquivo em que define
`CATEGORIAS_USER_PRODUCTS` e `montarItensUserProducts` (tradução).

**M3 — `publicar/route.ts` reúne entrada, autorização, conexão, capacidade, tradução,
execução e coordenação** em um único manipulador de 320 linhas.

**M4 — `publicacaoML.ts` reúne composição da intenção e disparo de transporte**, com seis
dependências de saída, executando fora do servidor.

---

## 4. Funções muito grandes

| Função | Arquivo | Extensão aproximada |
|---|---|---:|
| `criarGuiaTamanhos` | `mercadolivre.ts` (l. 408–646) | **~238 linhas** |
| Manipulador `POST` | `publicar/route.ts` | **~275 linhas** |
| `buscarAnunciosDoVendedor` + auxiliares | `mercadolivre.ts` (l. 260–388) | ~128 linhas |
| `montarBundleUserProducts` | `mlUserProducts.ts` (l. 238–310) | ~72 linhas |

---

## 5. Pontos de acoplamento

**A1 — `mercadolivre.ts` como ponto único de acesso ao canal.** Dez consumidores. Sua
divisão altera importações em dez arquivos, ainda que nenhum comportamento mude.

**A2 — `canalServidor.ts` como porta única de leitura do canal.** Seis consumidores.

**A3 — `tabelasMedidas.ts` alcançando a camada de apresentação.** Cinco consumidores,
três dos quais são telas.

**A4 — `mlUserProducts.ts` dependendo do tipo `AnuncioGerado`** (`agentes/esteira`):
vínculo entre a montagem para o canal e a estrutura produzida pela esteira de IA.

**A5 — Telemetria entrelaçada ao fluxo** em `publicar/route.ts` e em `criarGuiaTamanhos`.

**A6 — `mercadolivre.ts` sem dependências de saída.** Registro favorável: extrair partes
dele não quebra dependências internas; apenas realoca consumidores.

---

## 6. Classificação de código

**Domínio (regra de negócio):** R9 (canonização), R13 (composição do conteúdo), R10
(conhecimento de medidas).

**Integrações externas:** R1, R3, R4, R5, R6, R7, R11, R12.

**Infraestrutura:** R2 (persistência do vínculo), constantes de endpoint (l. 10–11),
`auth/serverAuthorization.ts` (mecanismo).

**Telemetria:** R17.

**Orquestração:** R14, R15.

---

## 7. Matriz de migração

| Responsabilidade | Localização atual | Módulo destino | Estratégia | Risco | Dependências |
|---|---|---|---|---|---|
| R9 Canonização de tamanhos | `normalizarTamanho.ts` | Publication / domínio | Mover arquivo inteiro | **Baixo** | Nenhuma de saída; 2 consumidores |
| R3 Categoria do canal | `mercadolivre.ts` 134–144 | Integration / Capability | Extrair função | **Baixo** | 1 consumidor |
| R4 Publicação de item | `mercadolivre.ts` 146–170 | Integration / adaptador | Extrair função | **Baixo** | 1 consumidor |
| R11 Exigência do modelo | `mlUserProducts.ts` 47–153 | Integration / Capability | Extrair funções e constantes | **Baixo** | 1 consumidor |
| R8 Tradução de erros | `mercadolivre.ts` 19–66 | Integration / Tradutor | Extrair funções | **Baixo-médio** | Usadas por R1, R4, R6, R7 |
| R1 Credenciais do canal | `mercadolivre.ts` 68–132 | Integration / Connection | Extrair par de funções | **Médio** | 5 consumidores |
| R6 Importação de anúncios | `mercadolivre.ts` 260–388 | Integration / Tradutor | Mover bloco | **Médio** | 2 consumidores |
| R12 Payload do canal | `mlUserProducts.ts` 90; `mlPayload.ts` | Integration / Tradutor | Mover e separar de R13 | **Médio** | 2 consumidores |
| R10 Medidas por marca | `tabelasMedidas.ts` | Catalog | Mover arquivo inteiro | **Médio** | 5 consumidores, 3 telas |
| R15 Montagem no cliente | `publicacaoML.ts` | Publication / Aplicação | Mover para servidor | **Médio-alto** | 6 dependências de saída |
| R13 Composição do conteúdo | `mlUserProducts.ts` 238–310 | Publication / domínio | **Dividir** do arquivo de tradução | **Alto** | Depende de R9, R10 e tipo da esteira |
| R5 Vendas | `mercadolivre.ts` 172–258 | Integration / fronteira | Aguardar domínio | **Médio** | 4 consumidores; domínio inexistente |
| R7 Guia de medidas | `mercadolivre.ts` 390–646 | Integration (Mapping/Capability/Communication/Policies) | Mover bloco; distribuir internamente | **Alto** | Função de ~238 linhas; comportamento sem linha de base observada |
| R2 Vínculo do canal | `canalServidor.ts` | Integration / Connection (infra) | Mover atrás de porta | **Médio** | 6 consumidores |
| R17 Telemetria | Dois arquivos | Capacidade transversal | Preservar sem alterar | **Alto** | É o contrato de comparação de comportamento |
| R16 Autorização | `serverAuthorization.ts` | Capacidade transversal | Manter | **Baixo** | Já isolada |
| R14 Orquestração | `publicar/route.ts` | Interface + OC + Integration | Dividir por último | **Alto** | Depende de 7 responsabilidades |

---

## 8. Observações de linha de base

Registros factuais que condicionam as etapas seguintes:

**B1.** O contrato comportamental disponível para comprovar preservação são as marcações
`ml.publicar` e `ml.guia` (R17). Alterar R17 removeria o instrumento de comparação.

**B2.** O comportamento de **reutilização** de guia (R7) **ainda não foi observado em
produção** — a assinatura correspondente não possui linha de base registrada.

**B3.** `mercadolivre.ts` não possui dependências de saída, o que torna a divisão de seus
blocos uma operação de realocação de consumidores, não de reescrita de dependências.

**B4.** As duas responsabilidades de menor risco e menor acoplamento — R9 e R3 — são
funções isoladas, uma delas pura e coberta por teste.

**B5.** Existe um domínio referenciado pelo código (**Vendas/Pedidos**, R5) para o qual
não há arquitetura de módulo especificada.

**B6.** A rota temporária de diagnóstico (`api/ml/diagnostico-guias`) consome R1 e
permanece na linha principal.
