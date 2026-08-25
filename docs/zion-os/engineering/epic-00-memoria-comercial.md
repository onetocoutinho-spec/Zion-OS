# Epic 00 — Memória Comercial (Fundação Adaptativa)

> **Natureza.** Fundação conceitual do Zion como **plataforma adaptativa**. Descobre **como
> o sistema aprende com o comportamento de cada empresa** — a partir da realidade atual, sem
> inventar funcionalidade, sem implementar ML. Onde a evidência não bastou: **EVIDÊNCIA
> INSUFICIENTE**.
>
> **Base de evidência:** `HEAD d2b0fe5` — os campos de override, tabelas por cliente,
> configuração de canal e histórico de aprovação já existentes no código.
>
> **Numeração:** Epic **00** — é a fundação **abaixo** do Epic 01 (Esteira). A Esteira gera;
> a Memória faz cada geração exigir menos correção que a anterior.

---

## 1. Objetivo

Responder: **como um sistema comercial aprende com cada empresa, o que preserva, e como esse
aprendizado reduz esforço humano?** Toda nova funcionalidade passará a responder
obrigatoriamente:

> *"O que o Zion aprenderá com esta interação?"* e
> *"Como esse aprendizado reduzirá trabalho para o cliente na próxima vez?"*

## 2. Visão

**Cada interação do cliente torna a próxima mais simples.**

**Descoberta central, por evidência:** o Zion **já armazena as correções do cliente** — mas
ainda **não as realimenta**. O cliente sobrescreve a medida (`tabelaMedidasOverride`), mantém
sua própria guia (`tabelasMedidasCliente`, que **vence** a padrão), escolhe o tipo de anúncio
por canal (`tipoAnuncio` salvo em `canaisMarketplace`), e essas escolhas ficam guardadas —
**mas a próxima geração não parte delas.** O sistema tem **memória de armazenamento** sem
**laço de aprendizado**.

> **A plataforma adaptativa não exige inventar memória. Exige fechar um laço que já tem as
> duas pontas: as correções são gravadas; falta usá-las para pré-preencher a próxima vez.**

---

## 3. Modelo Canônico de Aprendizagem

### 3.1 O laço

```
 (1) o cliente AGE          (2) o sistema OBSERVA        (3) o sistema APRENDE
  corrige a saída da IA  ─►  registra a correção      ─►  conta repetições do padrão
  (categoria, preço,          (já ocorre em parte:          por empresa
   medida, título…)            overrides, tabelas)               │
                                                                  ▼
 (6) o cliente CONFIRMA  ◄─  (5) o sistema SUGERE      ◄─  (4) atinge CONFIANÇA
  ou ajusta                   pré-preenche a próxima         (nº de observações
  (o laço recomeça)           geração com o aprendido        consistentes)
```

**As etapas (1) e (2) já existem parcialmente.** As etapas (3)–(5) são o objeto desta
fundação. **A etapa (6) preserva o controle do cliente** — o aprendizado **sugere**, não
**impõe**, até a confiança e a permissão autorizarem automação.

### 3.2 Como aprende
Por **contagem de correções recorrentes por empresa**, não por ML. Se o cliente escolhe
sempre a mesma categoria para um tipo de produto, ou sempre Premium para um canal, ou sempre
a mesma tabela de medidas para uma marca — isso é um **padrão contável e determinístico**.

### 3.3 O que aprende
As correções que o cliente repete sobre o que o sistema produz — §4.

### 3.4 Quando aprende
A cada correção observada (etapa 2). A **confiança** cresce com repetições consistentes.

### 3.5 Quando esquece
Quando o padrão deixa de se repetir — §5.4.

### 3.6 Quando pergunta de novo / age sozinho
Definido pelo **Modelo de Confiança** (§5) e pela **permissão explícita** do cliente.

---

## 4. Tipos de memória

Derivados da evidência — cada tipo aponta o substrato que **já existe** no sistema.

| Memória | O que aprende | Substrato atual (evidência) |
|---|---|---|
| **Catálogo** | Categoria correta por tipo de produto; atributos recorrentes | `categoriaMarketplaceSugerida`, `categoriaTemplates` |
| **Medidas** | Tabela de medidas por marca/produto | `tabelaMedidasOverride`, `tabelasMedidasCliente` (vence a padrão) |
| **Comercial** | Preço, margem, tipo de anúncio, confiança de custo | `precoVenda`/`margem`/`confiancaCusto`; `tipoAnuncio` por canal |
| **IA (correções)** | Quais ajustes o cliente sempre faz na saída da Esteira | edições em `/anuncios/[id]/editar`; `pendencias.resolvida` |
| **Publicação** | Canal, tipo de anúncio, guia reutilizada | `canaisMarketplace`; reutilização de guia (Blueprint idempotência) |
| **Operacional** | Aprovações, quem aprovou, pendências resolvidas | `aprovadoPor`, `aprovadoEm`, `vereditoA10`, `resolvida` |
| **Visual** | Escolhas de imagem | **EVIDÊNCIA INSUFICIENTE** — há geração e storage; a *escolha* recorrente do cliente não é observável hoje |

**A classificação surgiu da evidência:** cada memória corresponde a um ponto onde o cliente
**já corrige e o sistema já grava** — exceto a Visual, marcada por falta de sinal de escolha.

---

## 5. Modelo de Confiança

**Níveis conceituais** (os percentuais são ilustrativos — o modelo é a **escada**, não os
números):

| Confiança | Comportamento | Controle do cliente |
|---|---|---|
| **Baixa** — poucas observações | **Apenas observa** — registra, não age | Total; nem vê |
| **Emergente** — padrão se formando | **Sugere** — pré-preenche, editável | Total; aceita ou ignora |
| **Alta** — padrão consistente | **Pede confirmação** — "quer que eu já preencha assim?" | Confirma explicitamente |
| **Muito alta + permitido** | **Automatiza** — preenche sozinho, sinalizando | Pode desligar; pode desfazer |

**Regras da escada:**
1. **A confiança nasce de observações, não de suposição.** Sem repetição, não há sugestão.
2. **A confiança sobe com consistência e cai com contradição.** Uma correção que quebra o
   padrão reduz a confiança.
3. **Automação exige dois gatilhos: confiança alta E permissão explícita do cliente.** Nunca
   um só.
4. **Nenhum nível remove o controle** — mesmo automatizado, é reversível e desligável.

---

## 6. Modelo de Explicabilidade

**Toda sugestão ou automação responde a seis perguntas** — todas deriváveis de dados
contáveis, sem IA:

| Pergunta | Fonte da resposta |
|---|---|
| **Por que fiz isso?** | O padrão observado (ex.: "você escolheu esta categoria") |
| **Em que me baseei?** | As interações que formaram o padrão |
| **Quantas vezes observei?** | A contagem de repetições |
| **Qual minha confiança?** | O nível da escada (§5) |
| **Como desfazer?** | A ação reversível correspondente |
| **Como impedir que aconteça de novo?** | Desligar o aprendizado daquele padrão |

**Nenhuma automação sem essas seis respostas prontas.** Explicabilidade não é opcional — é
pré-condição de agir.

---

## 7. Princípios oficiais do aprendizado

Descobertos a partir das restrições e da evidência:

1. **Nunca perguntar duas vezes o que o cliente já respondeu de forma consistente.**
2. **Nunca automatizar sem evidência contável** — sem repetição observada, não há ação.
3. **Toda automação é reversível** — o cliente desfaz sem dano.
4. **Toda sugestão é explicável** — as seis perguntas do §6 sempre têm resposta.
5. **Toda decisão é auditável** — quem, quando, com base em quê (o substrato `aprovadoPor`/
   `aprovadoEm` já é o embrião disso).
6. **O padrão é por empresa** — o que o Zion aprende de um cliente **nunca** vaza para outro.
   *(Coerente com o multi-tenancy já existente — migrações 016/017.)*
7. **Aprender jamais bloqueia** — a memória **sugere e antecipa**; nunca impede uma ação que
   o cliente queira fazer. *(Herda a lição do Plano de Convergência: aditivo, nunca
   bloqueante.)*
8. **O cliente pode esquecer** — desligar um aprendizado é um direito, não uma exceção.

---

## 8. Roadmap

**Três fases estritas, na ordem obrigatória: observar → sugerir → automatizar.** A Fase 1
**não altera comportamento algum** — apenas registra. Nenhuma fase é Big Bang.

### Fase 1 — OBSERVAR (zero mudança de comportamento)
Registrar as correções recorrentes que **já ocorrem**, sem agir sobre elas. O sistema passa a
**contar** quantas vezes o cliente corrige a mesma coisa. Nada muda para o cliente.

### Fase 2 — SUGERIR (aditivo, opt-in)
Onde há padrão consistente, **pré-preencher a próxima geração** com o aprendido — sempre
editável, sempre explicável. O cliente aceita ou ignora.

### Fase 3 — AUTOMATIZAR (com permissão explícita)
Onde a confiança é muito alta **e** o cliente autorizou, preencher sozinho — sinalizando e
reversível.

**Regra inviolável:** nenhuma fase começa sem a anterior estar consolidada. **Nunca se
automatiza o que não se observou o suficiente para sugerir.**

---

## 9. Releases

Pequenas, reversíveis, na ordem do roadmap. As da Fase 1 **não alteram nada** que o cliente
perceba.

### R-MC1 — Registrar a correção de categoria *(o menor passo — observar)*
- **Objetivo:** contar quantas vezes o cliente confirma/corrige a `categoriaMarketplaceSugerida` por tipo de produto.
- **Escopo:** registro do evento de correção; **nenhuma** ação sobre ele.
- **Aceitação:** a contagem é gravada; o comportamento da tela é **idêntico**; suíte verde.
- **Rollback:** parar de registrar — nada dependia disso.
- **Estimativa:** **Baixa**.

### R-MC2 — Registrar override de medidas e escolha de tipo de anúncio *(observar)*
- **Objetivo:** contar overrides de medida por marca e a escolha recorrente de `tipoAnuncio` por canal — sinais que **já são gravados como estado**, agora contados como padrão.
- **Escopo:** registro; nenhuma ação.
- **Aceitação:** contagens gravadas; comportamento inalterado.
- **Rollback:** parar de registrar.
- **Estimativa:** **Baixa**.

### R-MC3 — Sugerir categoria aprendida *(sugerir — Fase 2)*
- **Objetivo:** onde a correção de categoria se repetiu de forma consistente, **pré-preencher** a sugestão na próxima geração, editável.
- **Escopo:** pré-preenchimento + explicação (as seis perguntas do §6).
- **Aceitação:** a sugestão aparece com "por quê" e "quantas vezes"; o cliente pode ignorar; se não houver padrão, comportamento idêntico ao atual.
- **Rollback:** desligar a sugestão — volta ao estado atual.
- **Estimativa:** **Média** *(depende de R-MC1)*.

### R-MC4 — Sugerir tipo de anúncio e medida aprendidos *(sugerir)*
- **Objetivo:** pré-preencher `tipoAnuncio` e tabela de medidas quando o padrão for consistente.
- **Escopo:** pré-preenchimento explicável.
- **Aceitação:** sugestão editável e explicada; sem padrão → sem mudança.
- **Rollback:** desligar.
- **Estimativa:** **Média** *(depende de R-MC2)*.

### R-MC5 — Painel de aprendizado explicável *(transversal)*
- **Objetivo:** mostrar ao cliente o que o Zion aprendeu dele, com as seis perguntas respondidas e o botão de esquecer.
- **Escopo:** exibição do que R-MC1–4 registraram; controle de desligar por padrão.
- **Aceitação:** cada aprendizado exibe origem, contagem, confiança e "esquecer"; nada é automatizado sem permissão.
- **Rollback:** ocultar o painel.
- **Estimativa:** **Média**.

> **Automação (Fase 3) não gera release nesta fundação.** Só é proposta **depois** de as
> sugestões (Fase 2) estarem consolidadas e o cliente ter autorizado — condição, não etapa
> automática.

---

## 10. Riscos

| # | Risco | Evidência/origem | Mitigação registrada |
|---|---|---|---|
| **R1** | Hábito antigo prejudica novo comportamento | Padrões mudam (nova estratégia do cliente) | §5 regra 2 — confiança **cai com contradição**; §7.8 — o cliente pode esquecer |
| **R2** | Automação sem controle | Restrição central da missão | §5 regra 3 — automação exige confiança **E** permissão; §7.3 — sempre reversível |
| **R3** | Aprendizado de um cliente vazar para outro | Multi-tenant | §7.6 — padrão **por empresa**; herda RLS existente |
| **R4** | Sugestão vira bloqueio | Lição do Plano de Convergência | §7.7 — aprender **nunca bloqueia** |
| **R5** | Falsa aprendizagem por poucas amostras | — | §5 regra 1 — sem repetição, não há sugestão |
| **R6** | Confundir memória com ML | Restrição da missão | Todo o modelo é **contagem determinística**; nenhuma release implementa ML |

---

## 11. Conclusões

**O Zion já é meio-adaptativo sem saber.** A evidência mostra que as correções do cliente
**já são gravadas** — overrides de medida, guias próprias que vencem a padrão, tipo de anúncio
por canal, categoria sugerida, histórico de aprovação. **O que falta não é memória; é o
laço** que usa essas correções para reduzir a próxima interação.

**A fundação adaptativa é, portanto, alcançável sem ML e sem reescrita:** é **contar padrões
que já existem** e **realimentá-los como sugestão**, sob uma escada de confiança que preserva
o controle do cliente em todos os níveis.

**A disciplina que torna isso seguro** está em três invariantes: observar antes de sugerir,
sugerir antes de automatizar, e nunca remover o controle. A Fase 1 inteira **não muda nada**
que o cliente perceba — só começa a contar. É o menor passo possível para uma plataforma que
aprende.

> **A partir desta fundação, toda funcionalidade responde: "o que o Zion aprende com isto?" e
> "como reduz o trabalho da próxima vez?" — e a resposta nasce de correções que o cliente já
> faz e o sistema já guarda, não de inteligência inventada.**

---

*Produzido em 21 de julho de 2026 · `HEAD d2b0fe5` · sem alteração de código, comportamento
ou arquitetura.*
