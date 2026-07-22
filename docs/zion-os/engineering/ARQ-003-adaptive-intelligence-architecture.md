# ARQ-003 — Adaptive Intelligence Architecture

> **Natureza.** Documento de **arquitetura** — projeta a Adaptive Intelligence Layer (AIL).
> **Não implementa**, não cria algoritmo, não altera comportamento nem o Core Domain.
> Constrói sobre evidência já estabelecida. Onde faltou: **EVIDÊNCIA INSUFICIENTE**.
>
> **Fonte primária:** Epic 00 (Memória Comercial), Cap. 02 (Bounded Contexts), Epic 01
> (Esteira), Plano de Convergência. `HEAD d2b0fe5`.

---

## 1. Objetivo

Responder a uma pergunta de arquitetura:

> **Como uma decisão do cliente se transforma em inteligência do sistema — de forma
> explicável, auditável, reversível, incremental e controlada pelo cliente?**

E definir a camada onde **toda** inteligência do Zion passará a existir. Fora dela, nenhuma.

## 2. Visão geral

**Ponto de partida (evidência do Epic 00):** o Zion **já grava** as correções do cliente —
`categoriaMarketplaceSugerida`, `tabelaMedidasOverride`, `tabelasMedidasCliente`, `tipoAnuncio`
por canal, aprovações (`aprovadoPor`/`aprovadoEm`), pendências `resolvida`. Mas essas memórias
estão **isoladas** e **não realimentadas**. Não há um mecanismo que observe padrões,
consolide conhecimento, explique, sugira e reutilize.

**A AIL é esse mecanismo.** Ela **não substitui** as memórias existentes — as **observa**, e
transforma decisões recorrentes em conhecimento reutilizável.

**A invariante arquitetural central:**

> **A AIL observa e oferece. Nunca controla.** Os contextos emitem decisões; a AIL aprende
> com elas; os contextos **opcionalmente** consultam o que ela aprendeu. Se a AIL for
> removida, o sistema funciona **exatamente como hoje**.

Essa é a garantia de reversibilidade no nível da arquitetura — e a resposta à restrição
"não alterar comportamento".

---

## 3. Adaptive Intelligence Layer

### 3.1 Posição

```
  ┌──────────────────────────────────────────────────────────┐
  │                  BOUNDED CONTEXTS (Cap. 02)               │
  │  Catálogo · Esteira · Precificação · Conexão · Publicação │
  │  Vendas · Identidade                                      │
  └───────┬───────────────────────────────────────▲──────────┘
          │ (a) emite DECISÃO observada            │ (b) consulta SUGESTÃO
          │     (push, fire-and-forget)            │     (pull, opcional)
          ▼                                        │
  ┌──────────────────────────────────────────────────────────┐
  │              ADAPTIVE INTELLIGENCE LAYER (AIL)            │
  │  ┌────────────┐  ┌───────────┐  ┌──────────┐  ┌────────┐  │
  │  │  Decision  │─►│  Padrão   │─►│ Confiança│─►│Sugestão│  │
  │  │  Journal   │  │(contagem) │  │ (escada) │  │(oferta)│  │
  │  └────────────┘  └───────────┘  └──────────┘  └────────┘  │
  │        │ append-only, auditável, por-empresa               │
  └──────────────────────────────────────────────────────────┘
```

**Duas direções, ambas desacopladas:**
- **(a) Observação — push:** um contexto registra uma decisão no Journal. É *fire-and-forget*:
  o contexto **não espera resposta** e não muda seu comportamento. Se a AIL não existir, a
  chamada é um no-op.
- **(b) Sugestão — pull:** um contexto **pergunta** à AIL "há algo aprendido para isto?" antes
  de agir. Se a AIL retornar nada, o contexto age como hoje. **A consulta é opcional e
  aditiva.**

**Nenhuma direção acopla:** a AIL não conhece a lógica dos contextos; os contextos não
dependem de a AIL responder algo útil.

### 3.2 Responsabilidade exclusiva
Transformar **decisões observadas** em **conhecimento reutilizável e explicável**, sob uma
escada de confiança que preserva o controle do cliente. **Nada mais.** A AIL não decide o que
publicar, não gera conteúdo, não valida negócio — isso é dos contextos.

---

## 4. Modelo Canônico de Decisão

**O que é uma decisão:** um ato observável em que o cliente **escolhe, corrige ou confirma**
algo que o sistema produziu ou propôs.

**Atributos mínimos** (o registro canônico):

| Atributo | Significado | Substrato existente |
|---|---|---|
| **id** | identidade da decisão | — |
| **empresa (tenant)** | de quem é — **isolamento** | multi-tenancy (016/017) |
| **autor** | quem tomou | `aprovadoPor` |
| **quando** | timestamp | `aprovadoEm` |
| **contexto** | qual Bounded Context (Catálogo, Comercial…) | Cap. 02 |
| **entidade afetada** | produto / canal / anúncio | ids existentes |
| **campo** | o que foi decidido | `categoria`, `tipoAnuncio`, `medida`… |
| **estado anterior** | o valor que o sistema propôs | `categoriaMarketplaceSugerida` (a sugestão) |
| **novo estado** | o valor que o cliente escolheu | o override |
| **justificativa** | por quê (opcional) | — |
| **evidência** | o que sustenta (origem do registro) | a tela/ação de origem |

**Observação factual:** os atributos **autor**, **quando**, **estado anterior** e **novo
estado** **já existem** dispersos no sistema. O modelo canônico os **unifica** num registro,
não os inventa.

---

## 5. Decision Journal

**Um log append-only, por empresa, de decisões canônicas.** É o coração da AIL e a fonte de
toda auditoria.

| Propriedade | Projeto |
|---|---|
| **Como registra** | Cada decisão vira uma entrada imutável. **Nunca sobrescreve** — corrigir é uma nova entrada |
| **Eventos que produz** | *decisão-registrada*; ao consolidar: *padrão-detectado*, *sugestão-criada*, *sugestão-aceita/ignorada*, *padrão-esquecido* |
| **Como é auditado** | O histórico completo é reconstituível: quem, quando, o quê, com base em quê |
| **Como é reconstruído** | Reproduzindo o log em ordem — o estado do aprendizado é uma **projeção** do Journal |
| **Como é explicado** | Cada sugestão aponta as entradas do Journal que a sustentam |
| **Como é esquecido** | O cliente marca um padrão como *esquecido* — uma nova entrada que **encerra** o padrão. **O histórico permanece** (auditoria); a projeção deixa de sugerir |

**Princípio do Journal:** *esquecer não é apagar.* O direito de o cliente parar de receber uma
sugestão é preservado **sem** destruir a trilha de auditoria — coerente com o invariante de
governança "nenhum artefato é apagado".

---

## 6. Modelo de Aprendizado

### 6.1 Quando uma decisão vira conhecimento

Uma escala de **maturidade do aprendizado**, por contagem determinística — **não ML**:

| Nível | Definição | Ação da AIL |
|---|---|---|
| **Evento isolado** | 1 ocorrência | Registra; nada mais |
| **Hábito** | repetição consistente do mesmo campo/valor | Candidato a sugestão |
| **Preferência** | hábito que o cliente **confirmou** explicitamente | Sugestão forte |
| **Regra** | preferência que vale para todo um contexto/categoria | Candidato a automação |
| **Automação** | regra **+ permissão explícita** do cliente | Age sozinho, sinalizando |

### 6.2 Como evitar falso aprendizado
- **Sem repetição, não há sugestão** — um evento isolado nunca vira conhecimento.
- **Consistência é exigida** — correções contraditórias não formam padrão.
- **A contagem é por (empresa, contexto, campo)** — não se generaliza entre campos distintos.

### 6.3 Como detectar mudança de comportamento
Uma **sequência de contradições** a um padrão estabelecido sinaliza que a empresa mudou de
estratégia. A resposta: o padrão antigo é **aposentado** (encerrado no Journal) e o
**reaprendizado** começa do zero para aquele campo. Isso responde diretamente ao risco de
"hábito antigo prejudicar novo comportamento" (Epic 00, R1).

---

## 7. Modelo de Confiança

**Escada conceitual** — os limiares são de projeto, não fixados aqui:

| Nível | O que a AIL faz | Controle do cliente |
|---|---|---|
| **Observação** | Só registra | Não vê |
| **Baixa** | Nada visível | — |
| **Média** | **Sugere** (pré-preenche, editável) | Aceita ou ignora |
| **Alta** | **Pede confirmação** explícita | Confirma |
| **Automatizável** | **Automatiza** — se **permitido** | Desliga / desfaz a qualquer momento |

**Regras da confiança:**
1. Nasce de observações, morre de contradições.
2. **Automação exige dois gatilhos: confiança alta E permissão.** Nunca um só.
3. Nenhum nível remove o controle.

*(Consolida e formaliza a escada esboçada no Epic 00 §5.)*

---

## 8. Modelo de Explicabilidade

**Toda sugestão carrega sua explicação — pré-condição de existir.** Seis respostas, todas
projeções do Journal, **sem IA**:

| Pergunta | Fonte |
|---|---|
| **Por que foi criada?** | O padrão (campo + valor recorrente) |
| **Quais decisões sustentam?** | As entradas do Journal que a formaram |
| **Há quanto tempo acontece?** | A janela temporal dessas entradas |
| **Quais exceções existem?** | As contradições registradas |
| **Como desfazer?** | Reverter a aplicação da sugestão |
| **Como impedir novas semelhantes?** | Esquecer o padrão |

**Arquitetura da explicabilidade:** a explicação **não é gerada** — é **derivada** do Journal
por consulta. Isso a torna sempre verdadeira e auditável: a explicação **é** a evidência.

---

## 9. Modelo de Memória

| Tipo | Conteúdo | Compartilhável? | Isolamento |
|---|---|---|---|
| **Temporária** | Observação de uma sessão em curso | Não | Por sessão |
| **Persistente** | O Journal — durável | Não | Por empresa |
| **Da Empresa (tenant)** | Padrões, preferências, regras de **uma** empresa | **NUNCA** | RLS existente (016/017) |
| **Global (agregada)** | Padrões **anônimos e agregados** entre empresas | Só o agregado, nunca o bruto | Ver §9.1 |

### 9.1 Memória Global — a mais sensível, projetada de forma conservadora

**Dado bruto de uma empresa NUNCA cruza a fronteira do tenant.** A única inteligência
agregada admissível é **estatística e anônima** — por exemplo, "categoria X costuma usar
atributo Y" — derivada de muitas empresas, sem que nenhuma seja identificável.

> **EVIDÊNCIA INSUFICIENTE / decisão de governança pendente:** se e como habilitar memória
> global é uma **decisão de produto e privacidade**, não de arquitetura. Este documento a
> **projeta como possível**, mas a **condiciona** a uma deliberação futura (candidata a ADR).
> Até lá, a AIL opera **exclusivamente** em memória por empresa.

**Invariante de isolamento:** o que o Zion aprende de uma empresa serve **àquela** empresa. O
multi-tenancy existente é a fronteira; a AIL respeita-o por construção.

---

## 10. Integração com os contextos

**Regra de ouro: a AIL depende de nada; os contextos dependem da AIL apenas de forma opcional
e aditiva.**

| Contexto (Cap. 02) | Emite para a AIL | Consulta da AIL |
|---|---|---|
| **Catálogo** | correção de categoria, atributos, medida | categoria/medida aprendida ao cadastrar |
| **Esteira (Core)** | *(nada — o Core não muda)* | preferências aprendidas como **contexto de entrada**, sem alterar o veredito |
| **Precificação** | ajustes de margem/preço | margem preferida como sugestão |
| **Conexão** | escolha de canal | — |
| **Publicação** | tipo de anúncio escolhido, guia reutilizada | tipo de anúncio preferido por canal |
| **Vendas** | *(observador — read-only)* | — |
| **Identidade** | — | fornece o tenant (fronteira de isolamento) |

**Sobre o Core Domain (Esteira):** a AIL **nunca** altera o que a Esteira decide. No máximo,
fornece **contexto de entrada** aprendido (ex.: "esta empresa sempre usa Premium") — mas o
checklist A10 e as regras-mãe permanecem **intocados**. Isto satisfaz a restrição "não
modificar o Core Domain": a Esteira continua sendo a autoridade; a AIL só reduz o que o
cliente precisa digitar antes.

**Ausência de barramento de eventos — registrada.** O Cap. 02 constatou que **não há event
bus hoje** (acoplamento por chamada direta). A AIL **não exige** criar um: a observação (push)
pode ocorrer nos pontos onde a correção **já é gravada**, de forma aditiva. Um barramento
explícito é **evolução possível**, não pré-requisito — evita-se a reescrita.

---

## 11. Princípios arquiteturais

1. **Toda decisão é observável** — se não passa pelo Journal, não vira inteligência.
2. **Toda sugestão é explicável** — a explicação é derivada do Journal, sempre.
3. **Toda automação é reversível** — o cliente desfaz sem dano.
4. **Toda memória tem ciclo de vida** — nasce, amadurece, pode ser esquecida.
5. **Nunca automatizar sem evidência** — contagem consistente é pré-condição.
6. **A AIL observa e oferece; nunca controla** — os contextos permanecem soberanos.
7. **Reversibilidade arquitetural:** remover a AIL devolve o sistema ao estado atual.
8. **Isolamento por empresa é inviolável** — dado bruto nunca cruza o tenant.
9. **O cliente é dono do próprio aprendizado** — vê, revisa, desfaz, esquece.
10. **O Core Domain é intocável** — a Esteira decide; a AIL aprende com as decisões.
11. **Esquecer não é apagar** — a auditoria sobrevive ao esquecimento.
12. **Toda inteligência vive na AIL** — nenhum contexto cria memória oculta própria.

---

## 12. Roadmap

Cinco releases, na ordem obrigatória **observar → detectar → sugerir → automatizar →
reaprender**. Nenhuma altera comportamento até a Fase de sugestão, e mesmo esta é opt-in.

| Release | Fase | Muda comportamento? |
|---|---|---|
| **R1** | Registrar decisões (Journal) | **Não** — só observa |
| **R2** | Detectar padrões (contagem interna) | **Não** — sem UI |
| **R3** | Mostrar sugestões (pull, opt-in) | Aditivo — editável |
| **R4** | Automações opt-in (permissão) | Aditivo — reversível |
| **R5** | Aprendizado contínuo (contradição/reaprendizado) | Aditivo |

---

## 13. Releases

### R-AIL-1 — Decision Journal (observar) *(menor passo, zero mudança)*
- **Objetivo:** registrar decisões canônicas nos pontos onde a correção **já é gravada**.
- **Escopo:** a estrutura do Journal + o registro em **um** ponto (ex.: correção de categoria).
- **Aceitação:** decisões são registradas; **nenhuma** tela muda; suíte verde; o registro é
  *fire-and-forget* (falha nele não afeta o fluxo).
- **Rollback:** parar de registrar — nada depende do Journal ainda.
- **Estimativa:** **Média** *(nova estrutura de persistência, aditiva)*.

### R-AIL-2 — Detecção de padrões (interno)
- **Objetivo:** projetar padrões a partir do Journal (contagem por empresa/contexto/campo).
- **Escopo:** cálculo determinístico; **sem UI**; sem ação.
- **Aceitação:** padrões computáveis e auditáveis; nada visível ao cliente.
- **Rollback:** desligar o cálculo.
- **Estimativa:** **Média**.

### R-AIL-3 — Sugestões explicáveis (pull, opt-in)
- **Objetivo:** um contexto **consulta** a AIL e exibe a sugestão com as seis respostas do §8.
- **Escopo:** consulta pull em **um** contexto (ex.: pré-preencher categoria) + explicação.
- **Aceitação:** sem padrão → comportamento idêntico; com padrão → sugestão editável e
  explicada; o Core Domain (Esteira) inalterado.
- **Rollback:** desligar a consulta — volta ao atual.
- **Estimativa:** **Média**.

### R-AIL-4 — Automação opt-in
- **Objetivo:** onde confiança alta **e** permissão, aplicar sozinho, sinalizando.
- **Escopo:** um campo, gated por permissão explícita; reversível.
- **Aceitação:** só automatiza o permitido; sempre desfazível e desligável.
- **Rollback:** revogar a permissão — para de automatizar.
- **Estimativa:** **Média**.

### R-AIL-5 — Reaprendizado
- **Objetivo:** detectar contradição a um padrão e aposentá-lo, recomeçando o aprendizado.
- **Escopo:** regra de contradição sobre o Journal.
- **Aceitação:** padrão obsoleto para de sugerir; histórico preservado.
- **Rollback:** desligar a detecção.
- **Estimativa:** **Média**.

> **Painel de aprendizado** (o cliente vê/revisa/esquece o que a AIL sabe) atravessa R3–R5 —
> é a face de controle exigida pelo princípio 9. Pode ser uma release própria após R3.

---

## 14. Riscos

| # | Risco | Mitigação (projetada) |
|---|---|---|
| **R1** | Acoplar contextos à AIL | §3.1 — observação *fire-and-forget*, sugestão *pull* opcional; princípio 6/7 |
| **R2** | Vazamento entre empresas | §9.1; princípio 8 — isolamento por tenant, dado bruto nunca cruza |
| **R3** | Automação fora de controle | §7 regra 2 — confiança **E** permissão; princípios 3/9 |
| **R4** | Falso aprendizado | §6.2 — sem repetição consistente, nada; princípio 5 |
| **R5** | Sugestão virar bloqueio | Herda a lição da Convergência — a AIL **oferece**, nunca impede |
| **R6** | Explicação não confiável | §8 — a explicação é **derivada** do Journal, não gerada |
| **R7** | Journal virar risco de privacidade | Princípio 11 — esquecer preserva auditoria; memória global condicionada a ADR |
| **R8** | Confundir a camada com ML | Todo o modelo é **contagem determinística**; nenhuma release implementa ML |

---

## 15. Conclusões

O Zion tem as **duas pontas** de uma plataforma que aprende — grava as correções do cliente e
tem contextos bem definidos — mas **não tem o fio** que as liga. A **Adaptive Intelligence
Layer é esse fio**: um **Decision Journal** append-only que observa decisões, uma **contagem
determinística** que as consolida em padrões, uma **escada de confiança** que decide entre
observar/sugerir/automatizar, e uma **explicabilidade derivada do próprio Journal** que torna
toda sugestão auditável.

**A escolha arquitetural decisiva é o desacoplamento por direção:** os contextos **empurram**
decisões (sem esperar resposta) e **puxam** sugestões (sem depender delas). Isso garante a
propriedade mais importante para uma restrição de "não alterar comportamento": **se a AIL for
removida, nada muda.** A inteligência é **aditiva por construção**.

**Nada aqui é ML.** É memória disciplinada: contar o que o cliente já decidiu e oferecer de
volta, sob controle total dele. O Core Domain — a Esteira e seu veredito — permanece a
autoridade; a AIL apenas faz cada interação exigir menos da anterior.

> **A partir desta arquitetura, toda funcionalidade responde: que decisão observa, o que
> aprende, como reutiliza, e como o cliente entende/revê/desfaz. E toda inteligência do Zion
> passa a viver em um só lugar, auditável e reversível — nunca oculta dentro de um contexto.**

---

*Produzido em 21 de julho de 2026 · `HEAD d2b0fe5` · documento de arquitetura · sem alteração
de código, comportamento ou Core Domain.*
