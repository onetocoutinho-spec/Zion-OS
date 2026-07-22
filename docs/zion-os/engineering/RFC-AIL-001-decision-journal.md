# RFC-001 — Decision Journal (R-AIL-1)

> **Natureza.** RFC de **projeto técnico** da primeira Release da Adaptive Intelligence Layer.
> **Não implementa código.** Projeta uma Release **puramente aditiva**: se removida, o sistema
> funciona exatamente como hoje. Onde faltou evidência: **EVIDÊNCIA INSUFICIENTE**.
>
> **Fonte:** ARQ-003 (Adaptive Intelligence Architecture), Epic 00 (Memória Comercial),
> Cap. 02 (Bounded Contexts). `HEAD d2b0fe5`.

> ### ⚠ Nota de numeração — colisão registrada
> Já existe uma **RFC-001** no acervo de governança:
> `governance/RFC-001-ciclo-de-vida-da-publication.md` (ciclo de vida da Publication,
> deliberada pelo ADR-007). Esta RFC pertence a uma **série distinta** — RFCs de engenharia
> da AIL — e vive em `engineering/`. **A colisão é registrada, não ignorada**, seguindo o
> precedente do programa (Achado A1 / Release 006; numeração do ADR-009). **Recomendação:**
> ao institucionalizar, a governança decide o identificador definitivo — por exemplo
> `RFC-AIL-001` — para evitar ambiguidade. O conteúdo abaixo independe do identificador final.

---

## 1. Objetivo

Registrar as **decisões relevantes do cliente** — sem produzir sugestão, automação ou IA, e
**sem alterar nenhuma tela, regra ou comportamento**. Apenas observar e gravar, para servir de
fundação ao **Pattern Detector** (R-AIL-2) e ao **Suggestion Engine** (R-AIL-3).

## 2. Escopo

- Um **Decision Journal**: registro append-only de decisões canônicas, por empresa.
- Um **ponto de registro** *fire-and-forget* que os contextos chamam onde a decisão **já é
  persistida** hoje.
- **Métricas** de observação do próprio Journal.

## 3. Fora do escopo

- **Qualquer** sugestão, automação, detecção de padrão ou IA/ML.
- **Qualquer** alteração na Esteira (Core Domain), Catálogo, Publicação ou qualquer regra.
- **Qualquer** mudança de tela ou de fluxo percebida pelo cliente.
- Barramento de eventos explícito (ARQ-003 §10 — não é pré-requisito).
- Memória global/agregada (ARQ-003 §9.1 — condicionada a decisão futura).

---

## 4. PASSO 1 e 2 — Pontos de decisão e o que entra no Journal

### 4.1 Pontos de decisão identificados no sistema

| Ponto de decisão | Onde acontece hoje (evidência) | Valor de aprendizado |
|---|---|---|
| **Correção de categoria** | `categoriaMarketplaceSugerida` alterada | **Alto** — a categoria correta por tipo de produto é aprendível |
| **Tipo de anúncio por canal** | `tipoAnuncio` em `canaisMarketplace.ts` | **Alto** — preferência recorrente por canal |
| **Override de medida** | `tabelaMedidasOverride`; `tabelasMedidasCliente` | **Alto** — guia por marca/produto |
| **Resolução de pendência** | `resolvida` em `pendencias.ts` — o cliente **fornece** o dado que faltava | **Alto** — o valor preenchido é aprendível |
| **Correção de preço** | `precoVenda`/`margem` ajustados | **Médio** — preferência comercial |
| **Correção de atributos/ficha** | edição da `fichaTecnica` | **Médio** — atributos recorrentes |
| **Aprovação do anúncio** | `status: "aprovado"`, `aprovadoPor`, `aprovadoEm` em `anunciosGerados.ts` | **Baixo** *(ver §4.3)* |
| **Reprovação** | veredito reprovado + motivo | **Médio** — o que costuma faltar |
| **Troca de imagem** | escolha de imagem | **EVIDÊNCIA INSUFICIENTE** — Epic 00: sinal de escolha não observável hoje |

### 4.2 Critério de entrada no Journal

> **Uma decisão entra no Journal apenas se for uma ESCOLHA DO CLIENTE que CORRIGE ou
> SOBRESCREVE uma proposta do sistema.** Mudanças **dirigidas pelo sistema** (timestamps,
> rotação de token, transições automáticas de status, sucesso/falha de publicação) **não são
> decisões** — são operações técnicas e **não entram**.

### 4.3 Justificativa das exclusões

- **Aprovação pura** — o *ato* de aprovar é operacional (o cliente clica "aprovar"). O que tem
  valor de aprendizado são as **edições feitas antes** de aprovar (deltas de título,
  descrição, atributos), não o clique. Registra-se a aprovação **como marco de correlação**,
  não como decisão aprendível por si.
- **Operações técnicas** — `atualizado_em`, `refresh_token` rotacionado, guia de tamanhos
  criada: são efeitos do sistema, não escolhas do cliente. Ignoradas por **DecisionIgnored**.
- **Troca de imagem** — **EVIDÊNCIA INSUFICIENTE**: não há hoje um sinal que distinga "o
  cliente escolheu esta imagem em vez daquela" de "a imagem foi definida". Fora do Journal até
  existir o sinal.

---

## 5. PASSO 3 — Modelo Canônico do Decision Journal

Estende o modelo canônico de decisão (ARQ-003 §4) com os campos de implementação
(Origem, Correlação, Metadados). **Registro imutável.**

| Campo | Tipo conceitual | Descrição |
|---|---|---|
| **DecisionId** | id | Identidade única da entrada |
| **Tenant** | id de empresa | **Fronteira de isolamento** — nunca cruza (RLS existente) |
| **Usuário** | id/nome | Quem tomou (substrato: `aprovadoPor`) |
| **Contexto** | enum | Bounded Context (Catálogo, Comercial, Publicação…) — Cap. 02 |
| **Entidade** | tipo + id | O que foi afetado (produto, canal, anúncio) |
| **Campo** | string | O que foi decidido (`categoria`, `tipoAnuncio`, `medida`…) |
| **ValorAnterior** | valor | O que o **sistema propôs** (ex.: `categoriaMarketplaceSugerida`) |
| **ValorNovo** | valor | O que o **cliente escolheu** |
| **Origem** | string | Tela/ação que originou (rastreabilidade) |
| **Timestamp** | ISO datetime | Quando (substrato: `aprovadoEm`) |
| **Correlação** | id | Liga decisões da mesma sessão/produto/execução da Esteira |
| **Metadados** | objeto opcional | Extensão futura, sem quebrar o modelo |

**Notas de projeto:**
- **ValorAnterior + ValorNovo** são o **delta** — a essência da correção; é o que o Pattern
  Detector contará.
- **Correlação** permite reconstruir "todas as decisões deste produto nesta passada".
- **Tenant + Contexto + Campo + ValorNovo** é a **chave de padrão** que R-AIL-2 usará.

---

## 6. PASSO 4 — Fluxo (fire-and-forget)

### 6.1 Como um contexto registra

```
  [ ponto onde a decisão JÁ é persistida hoje ]
              │  (a persistência normal ocorre — inalterada)
              ▼
   registrarDecisao(decisão)   ◄── chamada aditiva, lateral
              │
              │  fire-and-forget:
              │   • NÃO é aguardada pela correção do fluxo
              │   • falha aqui é capturada e descartada (DecisionDiscarded)
              │   • ausência da AIL = no-op
              ▼
      [ Decision Journal ]  (append-only)
```

### 6.2 Garantias de desacoplamento (ARQ-003 §3.1)

| Pergunta | Resposta de projeto |
|---|---|
| **Quem chama?** | O contexto, no ponto onde a decisão já é gravada |
| **Quando chama?** | **Depois** de a persistência normal ter sucesso |
| **Como evitar acoplamento?** | `registrarDecisao` é um **port lateral**; o contexto não conhece a lógica da AIL nem espera resposta útil |
| **Como garantir que falha no Journal nunca interrompe o fluxo?** | A chamada é **fire-and-forget**: envolvida em captura que **engole** qualquer erro; o resultado do fluxo principal **não depende** dela. Se o Journal estiver fora, o fluxo termina idêntico |

**Invariante:** o Journal é um **observador lateral**. Nenhuma correção do cliente depende
dele para ter sucesso. Isto satisfaz "não alterar comportamento" por construção.

---

## 7. PASSO 5 — Eventos

O Journal produz eventos **internos** (para observabilidade e futuras fases), não visíveis ao
cliente:

| Evento | Quando |
|---|---|
| **DecisionRecorded** | Uma decisão válida foi gravada |
| **DecisionIgnored** | A mudança era operação técnica, não decisão do cliente (filtrada antes de gravar) |
| **DecisionDuplicated** | Decisão idêntica já registrada na mesma correlação — idempotência |
| **DecisionDiscarded** | O registro **falhou** e foi engolido (fire-and-forget) — só para saúde do Journal |

**Idempotência:** `DecisionDuplicated` evita inflar contagens quando o mesmo salvamento
dispara duas vezes. A chave de duplicidade é (Tenant, Entidade, Campo, ValorNovo, Correlação).

---

## 8. PASSO 6 — Auditoria

| Pergunta | Como o projeto responde |
|---|---|
| **Como reconstruir uma decisão?** | Ler a entrada imutável — todos os campos do §5 estão nela |
| **Como explicar uma decisão?** | Os campos **são** a explicação: quem, quando, de qual valor para qual, em que contexto/entidade |
| **Como rastrear a origem?** | `Origem` (tela/ação) + `Correlação` (a sessão/passada) |
| **Como identificar quem tomou?** | `Usuário` — derivado do substrato `aprovadoPor` já existente |

**Append-only garante auditoria total:** o histórico nunca é sobrescrito; o estado do
aprendizado é sempre uma **projeção** reproduzível do Journal (base para R-AIL-2/3).

---

## 9. PASSO 7 — Observabilidade (métricas, não dashboards)

Métricas do próprio Journal — **definidas, não visualizadas**:

| Métrica | O que mede |
|---|---|
| **Decisões por contexto** | Volume por Bounded Context |
| **Decisões por empresa** | Volume por tenant |
| **Campos mais corrigidos** | Quais campos o cliente mais sobrescreve — proto-sinal de aprendizado |
| **Decisões repetidas** | Mesma (Tenant, Contexto, Campo, ValorNovo) — proto-padrão |
| **Taxa de DecisionDiscarded** | Saúde do Journal — quantos registros falharam |
| **Taxa de DecisionIgnored** | Quanto do fluxo é operação técnica vs decisão real |

> **Nenhum dashboard é proposto** — apenas as métricas que R-AIL-2 (Pattern Detector) e a
> operação precisarão. "Campos mais corrigidos" e "Decisões repetidas" são literalmente a
> matéria-prima da detecção de padrão.

---

## 10. PASSO 8 — Releases

**Quatro releases, cada uma independente e reversível. Nenhum Big Bang.**

### R-DJ-1 — Infraestrutura *(o menor passo — não conecta nada)*
- **Objetivo:** o Journal (armazenamento append-only) + o port `registrarDecisao` fire-and-forget.
- **Escopo:** a estrutura e o port. **Nenhum contexto é conectado.** Nada o chama ainda.
- **Aceitação:** o Journal existe; `registrarDecisao` grava e é fire-and-forget; **zero
  chamadas** de contexto; nenhuma tela muda; suíte verde. **Comportamento 100% idêntico** —
  o código novo não é exercitado por nenhum fluxo.
- **Rollback:** remover a estrutura — nada dependia dela.
- **Riscos:** mínimos — código morto até R-DJ-2, por definição.

### R-DJ-2 — Primeiro contexto: correção de categoria
- **Objetivo:** conectar **um** ponto de decisão — a correção de `categoriaMarketplaceSugerida`.
- **Escopo:** **uma** chamada `registrarDecisao` no ponto onde a categoria já é gravada.
- **Aceitação:** correções de categoria aparecem no Journal; a tela e a persistência são
  **idênticas**; falha no registro não afeta o salvamento; suíte verde.
- **Rollback:** remover a chamada — volta ao estado de R-DJ-1.
- **Riscos:** baixo — uma linha lateral, fire-and-forget.

### R-DJ-3 — Segundo contexto: tipo de anúncio e override de medida
- **Objetivo:** conectar `tipoAnuncio` (por canal) e `tabelaMedidasOverride`.
- **Escopo:** duas chamadas laterais nos pontos existentes.
- **Aceitação:** essas decisões aparecem no Journal; comportamento inalterado; suíte verde.
- **Rollback:** remover as chamadas.
- **Riscos:** baixo.

### R-DJ-4 — Cobertura completa
- **Objetivo:** conectar os pontos restantes de **alto/médio** valor (pendência resolvida,
  preço, atributos, reprovação).
- **Escopo:** chamadas laterais; **imagem permanece fora** (EVIDÊNCIA INSUFICIENTE).
- **Aceitação:** cobertura dos pontos justificados no §4.1; nada muda para o cliente.
- **Rollback:** remover as chamadas, por ponto.
- **Riscos:** baixo — cada ponto é independente e reversível isolado.

---

## 11. Critérios de aceitação (globais)

| Critério | Verificação |
|---|---|
| Implementável incrementalmente | 4 releases independentes; cada ponto conectável isolado |
| Sem breaking changes | O port é aditivo; o modelo é novo; nada existente muda |
| Não altera comportamento atual | Fire-and-forget lateral; R-DJ-1 nem é chamado |
| Rollback completo | Remover chamadas (por ponto) e a estrutura restaura o estado atual |
| Fundação para Pattern Detector | Chave de padrão (Tenant, Contexto, Campo, ValorNovo) + métricas |
| Fundação para Suggestion Engine | Delta (Anterior→Novo) + Correlação + Origem = explicabilidade completa |

---

## 12. Rollback

**Reversibilidade em três níveis, do mais fino ao total:**
1. **Por ponto:** remover uma chamada `registrarDecisao` — aquele contexto para de registrar.
2. **Por release:** reverter o commit da release — volta ao estado anterior.
3. **Total:** remover a estrutura do Journal — o sistema fica **idêntico ao de hoje**, pois
   nada de produção depende dele.

**Garantia:** como o Journal é **somente observador lateral**, nenhum rollback causa perda de
função ao cliente — no máximo, para-se de aprender.

---

## 13. Riscos

| # | Risco | Mitigação (projetada) |
|---|---|---|
| **R1** | Registro acoplar-se ao fluxo | Fire-and-forget; §6.2 — resultado do fluxo não depende do Journal |
| **R2** | Falha no Journal quebrar salvamento | Erro capturado e descartado (DecisionDiscarded); nunca propagado |
| **R3** | Vazamento entre empresas | Tenant obrigatório; RLS existente; nunca cruza |
| **R4** | Registrar operação técnica como decisão | Critério §4.2 + DecisionIgnored |
| **R5** | Duplicidade inflar contagens | DecisionDuplicated (idempotência) |
| **R6** | Journal virar risco de privacidade | Append-only auditável; "esquecer não é apagar" (fase futura); sem dado sensível além do já persistido |
| **R7** | Escopo vazar para sugestão/automação | Esta RFC **só grava**; §3 explícito; sugestão é R-AIL-3, outra RFC |

---

## 14. Próximas RFCs

| RFC | Fase (ARQ-003) | Depende de |
|---|---|---|
| **RFC — Pattern Detector** (R-AIL-2) | Detectar padrões por contagem determinística | Este Journal |
| **RFC — Suggestion Engine** (R-AIL-3) | Oferecer sugestões explicáveis (pull) | Journal + Pattern Detector |
| **RFC — Confidence & Automation** (R-AIL-4) | Automação opt-in, permission-gated | Suggestion Engine |
| **RFC — Relearning** (R-AIL-5) | Detecção de contradição e reaprendizado | Todas as anteriores |

---

## 15. Conclusão

O Decision Journal é a **menor fundação possível** da Adaptive Intelligence Layer: um registro
append-only que observa, de forma **lateral e fire-and-forget**, as decisões que o cliente
**já toma e o sistema já grava** — começando por **nenhuma conexão** (R-DJ-1) e avançando um
ponto de cada vez.

**A propriedade central é a reversibilidade por construção:** o Journal só observa; se
desaparecer, o Zion funciona exatamente como hoje. Nenhuma tela muda, nenhuma regra muda,
nenhuma decisão do cliente depende dele. É o primeiro passo — e o mais seguro possível — de um
sistema que aprende.

> **Esta RFC grava. Não sugere, não automatiza, não decide.** Ela apenas garante que, quando
> as próximas fases chegarem, haverá uma trilha auditável e explicável do que cada empresa já
> ensinou ao Zion — sem que uma linha do comportamento atual tenha mudado para construí-la.

---

*Produzido em 21 de julho de 2026 · `HEAD d2b0fe5` · RFC de projeto · sem alteração de código,
comportamento ou Core Domain.*
