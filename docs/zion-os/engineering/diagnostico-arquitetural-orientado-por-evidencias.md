# Diagnóstico Arquitetural Orientado por Evidências — Zion OS

> **Natureza.** Fotografia arquitetural. **Descreve o que o sistema é**, não o que deveria
> ser. Não propõe melhoria, não busca defeito, não inicia refatoração.
>
> **Base de evidência:** `HEAD d2b0fe588ac50a5e8e16437c16d95a3a6f45192b`, 165 commits,
> 2026-07-02 a 2026-07-21. Todo número foi produzido por comando verificável sobre o
> repositório. Onde a evidência não bastou, está escrito **EVIDÊNCIA INSUFICIENTE**.

---

## 1. Objetivo

Compreender, por evidência, como o Zion OS realmente funciona em produção: onde vivem suas
responsabilidades, onde estão os acoplamentos, o que evolui, o que permanece imóvel, e qual
conhecimento de negócio a arquitetura incorpora.

**A arquitetura em produção não é tratada como problema.** É um sistema que funciona, atende
usuários reais e permaneceu operacional durante todo o Programa de Refatoração. É estudada
como **fonte de conhecimento**.

## 2. Escopo

Todo o código-fonte em `src/` — **328 arquivos** `.ts`/`.tsx`, **37.021 linhas**, dos quais
**33 arquivos de teste**. Fora do escopo: `platform/` (projeto congelado), `node_modules/`,
`docs/`.

## 3. Metodologia

- **Inventário** por listagem de diretório e contagem de arquivos/linhas.
- **Dependências** por busca de `import` no código — nunca por suposição.
- **Evolução** por `git log --name-only` sobre 165 commits.
- **Acoplamento** por *fan-in* (quantos arquivos importam X) e *fan-out* (quantos X importa).
- **Estabilidade** por número de commits por arquivo/subárvore.

Nenhum modelo arquitetural teórico é usado como argumento. Onde um é citado, é **referência
comparativa**, explicitamente marcada.

---

## 4. Inventário

### 4.1 As sete árvores de topo de `src/`

| Árvore | Arquivos | Linhas | Papel observável |
|---|---|---|---|
| `src/app` | 73 | 12.396 | **Entrypoints** — rotas e páginas Next.js. É o que o usuário alcança |
| `src/lib` | 92 | 12.777 | **Núcleo de produção** — serviços, integrações, estado, tipos |
| `src/components` | 33 | 3.952 | UI React |
| `src/infrastructure` | 44 | 2.278 | *(ver §4.3 — ilha)* |
| `src/application` | 41 | 1.792 | *(ver §4.3 — ilha)* |
| `src/domain` | 31 | 1.859 | *(ver §4.3 — ilha)* |
| `src/modules` | 14 | 1.967 | **Destino da refatoração** — R9…R2 |

### 4.2 O mundo de produção — `app` + `lib` + `components` + `modules`

**Integrações externas declaradas** (`package.json`, dependências de produção): **sete**.

| Pacote | Papel |
|---|---|
| `next` 16 · `react` 19 · `react-dom` | Framework — importados por 62 e 67 arquivos |
| `@supabase/supabase-js` | Persistência — importado **diretamente por 6 arquivos** |
| `@anthropic-ai/sdk` | IA — importado por **1 arquivo** |
| `lucide-react` | Ícones |
| `xlsx` | Importação de planilhas |

**Módulos da refatoração** (`src/modules`), ocupação confirmada:

| Módulo | Camada | Conteúdo |
|---|---|---|
| `integration` | `domain` | R11, R12 (6 arquivos) |
| `integration` | `infrastructure` | R2 (2 arquivos) |
| `publication` | `domain` | R9, R13 (4 arquivos) |
| `catalog` | `domain` | R10 (2 arquivos) |
| `operation-center` | — | **vazio** |
| todos | `ports/`, `adapters/` | **vazios** — 0 arquivos (ADR-009) |

### 4.3 Achado estrutural central — duas arquiteturas disjuntas

O repositório contém **dois corpos de código que não se comunicam**.

**Mundo A — a aplicação em execução.** `src/app` → `src/lib` (+ `components`, `modules`).
É o que serve usuários.

**Mundo B — a tríade `src/domain` + `src/application` + `src/infrastructure`.** 95 arquivos
não-teste, ~5.929 linhas, 21 dos 33 arquivos de teste.

**Evidência de que o Mundo B é uma ilha isolada:**

| Verificação | Resultado |
|---|---|
| Arquivos em `src/app` que importam a tríade | **0** |
| Arquivos em `components`, `lib`, `modules` que importam a tríade | **0** |
| Arquivos da tríade que importam `src/lib` | **0** |
| A tríade é alcançável a partir dos entrypoints (`src/app`)? | **Não** |

**Evidência de que o Mundo B nasceu pronto e nunca mudou:**

| Árvore | Commits que a tocaram | Criada | Última alteração |
|---|---|---|---|
| `src/domain` | **1** | 2026-07-13 | 2026-07-13 |
| `src/application` | **1** | 2026-07-13 | 2026-07-13 |
| `src/infrastructure` | **1** | 2026-07-13 | 2026-07-13 |

As três foram criadas **no mesmo commit** — `1e85fb0`, *"feat(platform): complete Zion
foundation architecture"*, 116 arquivos — e **nunca mais tocadas**. Em contraste, `src/lib`
acumula **82 commits** ao longo dos 19 dias do projeto.

**Conteúdo do Mundo B**, por inventário: agregados `produto-mestre` e `listing`;
value-objects (`dinheiro`, `ean`, `sku-origem`); casos de uso
(`criar-produto-mestre`, `atualizar-preco`, `adicionar-variante`); *ports* de repositório e
publicação de eventos; conectores (`magazord` ERP), persistência Supabase com repositórios e
mapeadores; motor de *intake* com conciliação, validação e relatórios.

**Registro factual, sem interpretação:** os **21 testes** internos à tríade passam — integram
os 243 da suíte —, mas exercitam código que **a aplicação em execução nunca chama**. Isto foi
antecipado como observação nas Releases 005 e 010 (*"estruturas em `src/domain`,
`src/application`, `src/infrastructure` que não constam do Mapeamento"*). O diagnóstico o
confirma e o dimensiona.

---

## 5. Dependências

### 5.1 Mapa entre árvores (Mundo A)

```
src/app  ──imports──►  src/lib        (60 arquivos de app importam lib)
   │                      │
   ├──────────────────►  src/modules  (7 arquivos de app importam modules)
   │
   └──────────────────►  src/components

src/domain ◄──► src/application ◄──► src/infrastructure   (fechado em si — Mundo B)
```

### 5.2 Dependências externas

| Externa | Arquivos que a tocam diretamente | Concentração |
|---|---|---|
| `@supabase/supabase-js` | **6** | Alta — o acesso é centralizado |
| `createClient` do Supabase | **3** — `supabase/client.ts`, `supabase/admin.ts`, `auth/serverAuthorization.ts` | O restante consome via `getSupabase()` (17 arquivos) |
| `@anthropic-ai/sdk` | **1** — `lib/agentes/provedorIA.ts` | Máxima — ponto único de acesso à IA |
| Mercado Livre (via `fetch`) | concentrado em `mercadolivre.ts` e rotas `api/ml/*` | — |

### 5.3 Integração interna app↔API (alvos de `fetch`)

O cliente chama o próprio servidor por rotas internas. Alvos mais invocados:

| Rota | Invocações no código |
|---|---|
| `/api/agentes/esteira` | 7 |
| `/api/agentes/executar` | 6 |
| `/api/ml/publicar` | 4 |
| `/api/usuarios` | 3 |

### 5.4 Ciclos

**EVIDÊNCIA INSUFICIENTE** para afirmar ausência total de ciclos — a verificação exaustiva
de ciclos exigiria análise de grafo que este diagnóstico não executou. Nenhum ciclo foi
observado incidentalmente durante o levantamento de hubs.

---

## 6. Responsabilidades

Localização observável de cada tipo de responsabilidade no **Mundo A**:

| Responsabilidade | Onde vive | Evidência |
|---|---|---|
| **Regras de negócio de publicação** | `modules/` (R9…R13) + `lib/marketplaces/mercadolivre.ts` | 6 responsabilidades migradas; 6 ainda em `mercadolivre.ts` |
| **Orquestração** | `app/api/ml/publicar/route.ts` (R14) | 320 linhas; importa 6 origens distintas |
| **Persistência** | `lib/supabase/` + `lib/repositorio.ts` | `mappers.ts` (947 linhas), `repositorio.ts` (fan-in 22) |
| **Integração ML** | `lib/marketplaces/mercadolivre.ts` | 646 linhas, 15 exports, fan-in 10 |
| **IA** | `lib/agentes/` | ponto único em `provedorIA.ts` |
| **Transformação** | `modules/integration/domain` (Tradutor) + `lib/supabase/mappers.ts` | — |
| **Tipos compartilhados** | `lib/types.ts` | fan-in **92** (28% de todos os arquivos) |
| **Estado do cliente** | `lib/store.ts`, `lib/contexto.ts` | fan-in 5 e 4 |

---

## 7. Evolução histórica

### 7.1 Churn por subárvore (alterações de arquivo em 165 commits)

| Árvore | Alterações | Arquivos | Leitura |
|---|---|---|---|
| `src/lib` | **281** | 92 | Núcleo evolutivo — mais tocado do sistema |
| `src/app` | **185** | 73 | Interface evolutiva |
| `src/components` | 77 | 33 | UI moderadamente ativa |
| `src/infrastructure` | 44 | 44 | **1 commit** — congelada |
| `src/application` | 41 | 41 | **1 commit** — congelada |
| `src/domain` | 31 | 31 | **1 commit** — congelada |
| `src/modules` | 15 | 14 | Recente (refatoração) |

### 7.2 Arquivos mais alterados (Mundo A)

| Arquivo | Commits | Linhas | Papel |
|---|---|---|---|
| `lib/types.ts` | **13** | 646 | Hub de tipos |
| `app/cliente/produtos/page.tsx` | 13 | — | Tela central do cliente |
| `components/layout/AppShell.tsx` | 12 | — | Casca da aplicação |
| `lib/supabase/mappers.ts` | 11 | 947 | Mapeamento de persistência |
| `lib/supabase/database.types.ts` | 11 | — | Contrato do banco |
| `lib/services/importarAnunciosML.ts` | 11 | — | Importação de anúncios |

### 7.3 Regiões praticamente imutáveis

| Região | Commits | Evidência de estabilidade |
|---|---|---|
| Mundo B inteiro (domain/application/infrastructure) | **1 cada** | Nasceu pronto, nunca tocado |
| `lib/supabase/client.ts` | **1** | 30 linhas; ponto único de cliente de navegador |

### 7.4 Relação mudança → responsabilidade → impacto

- **`types.ts` muda muito (13×) e tem fan-in 92.** Toda mudança nele potencialmente alcança
  28% dos arquivos. É o ponto de maior **alavancagem de mudança** do sistema.
- **`mappers.ts` muda muito (11×) e é o maior arquivo (947 linhas).** Concentra a tradução
  entre o formato do banco e o do domínio; evolui junto com o esquema.
- **O Mundo B não muda.** Zero impacto de manutenção observado desde 2026-07-13.

---

## 8. Acoplamento

*Fan-in* medido por busca de import. Classificação relativa ao sistema observado.

| Componente | Fan-in | Linhas | Commits | Acoplamento |
|---|---|---|---|---|
| `lib/types.ts` | **92** | 646 | 13 | **Muito alto** |
| `lib/supabase/mappers.ts` | 23 | 947 | 11 | **Alto** |
| `lib/repositorio.ts` | 22 | 219 | 7 | **Alto** |
| `lib/supabase/client.ts` | 15 | 30 | 1 | **Alto** *(mas estável)* |
| `lib/status.ts` | 12 | 102 | 6 | Médio |
| `lib/marketplaces/mercadolivre.ts` | 10 | 646 | 8 | Médio |
| `lib/store.ts` | 5 | 209 | 8 | Baixo |
| `lib/contexto.ts` | 4 | 163 | 7 | Baixo |
| Módulos da refatoração (`modules/*`) | 1–3 cada | — | 1–2 | **Muito baixo** |
| Mundo B (tríade DDD) | **0 externo** | ~5.929 | 1 | **Isolado** |

### 8.1 Hubs arquiteturais

**`lib/types.ts` é o hub central inequívoco** — fan-in 92, o mais alterado do sistema.
Concentra os contratos de dados que atravessam produção. Coesão observável: **EVIDÊNCIA
INSUFICIENTE** — o fan-in alto indica centralidade, mas não mede se o arquivo mistura tipos
não relacionados; isso exigiria análise de conteúdo não realizada aqui.

**Hubs secundários:** `mappers.ts` (persistência), `repositorio.ts` (acesso a dados),
`supabase/client.ts` (conexão — alto fan-in, mas **1 commit**: estável apesar de central).

---

## 9. Estabilidade

| Região | Classificação | Justificativa |
|---|---|---|
| **Mundo B** (domain/application/infrastructure) | **Congelada** | 1 commit cada; nunca alterada; não alcançável pela aplicação |
| `lib/supabase/client.ts` | **Congelada** | 1 commit; 30 linhas; ponto único estável |
| `lib/types.ts`, `mappers.ts`, `database.types.ts` | **Sensível** | Fan-in alto + churn alto: mudança frequente com amplo alcance |
| `app/cliente/produtos/page.tsx`, `AppShell.tsx` | **Sensível** | Churn alto; centrais para a experiência |
| `lib/marketplaces/mercadolivre.ts` | **Crítica** | Fan-in 10; hospeda 6 das 8 responsabilidades do Grupo C; **bloqueada por governança** — sem linha de base observada em produção |
| `app/api/ml/*` (rotas de publicação/venda) | **Crítica** | Caminho de integração externa; falha afeta operação real |
| `lib/agentes/provedorIA.ts` | **Crítica** | Ponto único de IA |
| `modules/*` | **Estável** | Recém-migrados; comportamento preservado por evidência; suíte verde |
| Domínio de Vendas/Pedidos (R5), Identity & Access (R16) | **Desconhecida** | Referenciados pelo código; arquitetura não especificada |

---

## 10. Conhecimento arquitetural

Decisões e invariantes que a arquitetura demonstra manter — por evidência, não por norma:

**C1 — O `refresh_token` do canal nunca trafega pelo navegador.** `canalServidor.ts`
declara-o e os 5 consumidores são rotas de servidor. Invariante de segurança observado em
todo o fluxo de publicação.

**C2 — O acesso à IA é um ponto único.** Um só arquivo (`provedorIA.ts`) importa o SDK
Anthropic. Toda decisão de IA passa por ele.

**C3 — A criação de cliente Supabase é concentrada.** Apenas 3 arquivos chamam
`createClient`; 17 consomem via `getSupabase()`. O acesso a banco tem uma fronteira.

**C4 — `types.ts` é a linguagem compartilhada de fato.** Fan-in 92. Independentemente de
intenção arquitetural, é onde os contratos de dados residem e por onde a mudança se propaga.

**C5 — O modelo User Products é tratado como fluxo distinto do clássico.** `mercadolivre.ts`,
`mlUserProducts.ts` e `mlPayload.ts` mantêm a distinção `family_name` (sem `title`) × `title`
(sem `family_name`) — invariante de negócio nunca violado, protegido por 16 testes.

**C6 — Convenção de imports por consumidor.** Rotas usam alias `@/`; bibliotecas usam
caminho relativo. Preservada em todas as seis migrações.

**C7 — Persistência traduzida por mapeadores dedicados.** `supabase/mappers.ts` isola o
formato do banco do formato da aplicação — o maior arquivo do sistema existe para essa
fronteira.

---

## 11. Dívida arquitetural observável

**Somente itens com evidência objetiva de custo.**

### D1 — Dois corpos de código disjuntos, um deles não alcançável

| Campo | Registro |
|---|---|
| **Problema observado** | 95 arquivos não-teste (~5.929 linhas) em `domain/application/infrastructure` não são importados por nenhum arquivo alcançável a partir dos entrypoints |
| **Evidência** | 0 imports da tríade a partir de `app`, `components`, `lib`, `modules`; 0 imports da tríade para `lib`; criada em 1 commit, 0 alterações desde 2026-07-13 |
| **Impacto** | 21 dos 33 arquivos de teste (e parcela dos 243 testes) exercitam código que a aplicação não executa. A suíte verde não é, nessa parcela, evidência sobre o comportamento em produção |
| **Frequência** | Permanente desde 2026-07-13 |
| **Custo operacional** | **Nenhum observável** — não está no caminho de execução; não pode falhar em produção |
| **Custo de manutenção** | Baixo e latente — o código compila e é buildado (custo de build), mas não recebe manutenção (0 commits) |
| **Confiança da evidência** | **Alta** — verificado por busca exaustiva de import nas duas direções |

### D2 — `mercadolivre.ts` concentra seis responsabilidades sob bloqueio

| Campo | Registro |
|---|---|
| **Problema observado** | 646 linhas, 15 exports, fan-in 10, hospedando R1, R3, R4, R5, R6, R7 |
| **Evidência** | Mapeamento §M1; §7 do Plano Executivo; 8 commits |
| **Impacto** | Seis migrações do Grupo C dependem de um único arquivo cujo comportamento de reutilização de guias **não possui linha de base observada em produção** |
| **Frequência** | Contínua — é caminho de publicação real |
| **Custo operacional** | **EVIDÊNCIA INSUFICIENTE** — não há logs de produção neste diagnóstico |
| **Custo de manutenção** | Alto potencial — alterar qualquer das seis exige tocar um arquivo compartilhado por 10 consumidores |
| **Confiança da evidência** | **Alta** quanto à estrutura; **insuficiente** quanto ao custo operacional real |

### D3 — `types.ts` como ponto de propagação de mudança

| Campo | Registro |
|---|---|
| **Problema observado** | Fan-in 92 + 13 commits: o arquivo mais central é também um dos mais alterados |
| **Evidência** | Busca de import (92) e `git log` (13 commits) |
| **Impacto** | Toda alteração de contrato alcança potencialmente 28% dos arquivos; recompilação ampla |
| **Frequência** | 13 alterações em 19 dias |
| **Custo operacional** | Nenhum direto |
| **Custo de manutenção** | Real mas não quantificado — **se** o arquivo mistura tipos não relacionados, o alcance é maior que o necessário. Verificar exigiria análise de conteúdo: **EVIDÊNCIA INSUFICIENTE** |
| **Confiança da evidência** | Média — a centralidade é fato; o custo por mudança não foi medido |

### D4 — Rota de diagnóstico em produção

| Campo | Registro |
|---|---|
| **Problema observado** | `/api/ml/diagnostico-guias` permanece na linha principal |
| **Evidência** | Mapeamento §B6; presente no repositório |
| **Impacto** | Superfície de API não destinada à operação regular |
| **Custo operacional / manutenção** | **EVIDÊNCIA INSUFICIENTE** — não há dado de uso |
| **Confiança da evidência** | Alta quanto à existência; insuficiente quanto ao custo |

---

## 12. Oportunidades

**Somente fatos. Nenhuma solução, arquitetura ou padrão é proposto** — a missão o veda.

### O1 — Decidir o destino do Mundo B

- **Problema observado:** ~5.929 linhas isoladas, não executadas, mantidas no build.
- **Evidência:** D1.
- **Impacto:** custo de build e de compreensão; a suíte confunde cobertura de produção com
  cobertura de código morto.
- **Benefício esperado:** clareza sobre o que a suíte de fato prova.
- **Complexidade estimada:** **EVIDÊNCIA INSUFICIENTE** — depende de saber se o Mundo B é
  fundação planejada para uso futuro ou vestígio. Isso é decisão, não medição.
- **Confiança:** Alta quanto ao fato; a oportunidade é de **decisão**, não de engenharia.

### O2 — Observar o comportamento de `mercadolivre.ts` em produção

- **Problema observado:** seis responsabilidades bloqueadas por ausência de linha de base
  **observada em produção**.
- **Evidência:** D2; condição de desbloqueio do Grupo C registrada no Plano Executivo.
- **Impacto:** oito das onze pendências do sistema dependem dessa única observação.
- **Benefício esperado:** desbloqueio de mais da metade do backlog pendente.
- **Complexidade estimada:** baixa em engenharia, **condicionada a operação** — exige um
  operador republicando e capturando logs.
- **Confiança:** Alta.

### O3 — Especificar os domínios ausentes

- **Problema observado:** Vendas/Pedidos (R5) e Identity & Access (R16) são referenciados
  pelo código sem arquitetura especificada.
- **Evidência:** Mapeamento §B5; Plano Executivo, Grupo D.
- **Impacto:** duas responsabilidades sem destino.
- **Complexidade:** **EVIDÊNCIA INSUFICIENTE** — depende de especificação inexistente.
- **Confiança:** Alta quanto à ausência.

---

## 13. Limitações

Este diagnóstico **não** produziu, e não afirma ter produzido:

- **Análise de ciclos de dependência** — §5.4, EVIDÊNCIA INSUFICIENTE.
- **Medição de coesão de conteúdo** de `types.ts` e demais hubs — §8.1, EVIDÊNCIA
  INSUFICIENTE.
- **Custo operacional real** de qualquer região — não há logs de produção neste escopo.
- **Cobertura de teste por linha** — contou-se arquivos e execução, não cobertura.
- **Análise de `src/components` e `src/app` além de churn e fan-in** — a camada de UI foi
  inventariada, não dissecada.
- **Avaliação de mérito** de qualquer decisão — o diagnóstico descreve, não julga.

---

## 14. Conclusão

O Zion OS em produção é **um sistema Next.js de página e API** cujo núcleo de negócio vive em
`src/lib` — evolutivo, com 82 commits — e cujo caminho de publicação no Mercado Livre é o
subsistema mais crítico e mais central. Seis responsabilidades foram extraídas para
`src/modules`; seis permanecem concentradas em `mercadolivre.ts`, sob bloqueio de governança.
O acesso a IA e a criação de cliente Supabase são **pontos únicos**, e o `refresh_token`
nunca cruza o navegador — três invariantes que a arquitetura mantém sem exceção observada.

Paralelamente, existe um **segundo corpo de código** — a tríade `domain/application/
infrastructure`, ~6 mil linhas — introduzido pronto num único commit e **nunca executado
pela aplicação**. É o achado mais consequente deste diagnóstico, e sua natureza (fundação
planejada ou vestígio) é **decisão, não medição**.

---

## 15. Parecer final

| Pergunta | Resposta | Evidência |
|---|---|---|
| A arquitetura atual **é compreendida**? | **SIM** | Inventário completo; dependências mapeadas por import; responsabilidades localizadas |
| Possui **regiões estáveis**? | **SIM** | `supabase/client.ts` (1 commit); a tríade inteira (1 commit); módulos migrados |
| Possui **regiões críticas**? | **SIM** | `mercadolivre.ts`, rotas `api/ml/*`, `provedorIA.ts` — §9 |
| Possui **conhecimento institucional relevante**? | **SIM** | Sete invariantes observados — §10 — nenhum violado no histórico |
| Possui **evidências suficientes para justificar futuras evoluções**? | **SIM, com ressalva** | Há linha de base objetiva para decisão (§11–12). Três frentes carecem de dado: custo operacional real, coesão de conteúdo e ciclos — todas marcadas EVIDÊNCIA INSUFICIENTE |

### Parecer

**A arquitetura do Zion OS é compreendida, tem regiões estáveis e críticas identificadas por
evidência, incorpora conhecimento de negócio verificável e possui uma linha de base objetiva
suficiente para fundamentar decisões futuras — desde que cada decisão respeite os limites de
evidência aqui registrados.**

Este documento é uma **fotografia**, não um plano. Não recomenda mudança. Estabelece o que
qualquer decisão futura deverá tomar como fato de partida.

---

*Produzido em 21 de julho de 2026 · `HEAD d2b0fe5` · sem alteração de código, arquitetura ou
governança.*
