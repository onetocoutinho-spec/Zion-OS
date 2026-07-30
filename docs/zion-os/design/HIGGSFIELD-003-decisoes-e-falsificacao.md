# HIGGSFIELD-003 — Decisões aprovadas e falsificação de C

**Data:** 2026-07-29
**Base:** `a092d33` · sucede `HIGGSFIELD-002`
**Status:** decisões registradas · rodada 3 **visual bloqueada** · falsificação **executada analiticamente**
**Código alterado:** nenhum.

---

## 1. DECISÕES APROVADAS

### 1.1 Arquitetura — **C, absorvendo B**

Não é "chat + painel lateral". É **Copilot + workspace adaptativo**:

> a conversa expressa intenção e mantém o fio ·
> o workspace assume a melhor representação operacional para a tarefa atual

B deixa de ser arquitetura paralela e passa a ser um **modo de superfície**.

### 1.2 Mobile — desktop-first, mobile-capable

O desktop aproveita C plenamente para trabalho denso. O mobile **não reproduz o
split comprimido** — tem arquitetura própria, priorizando consultar, conversar,
responder decisões, revisar Proposals, confirmar, resolver conflitos simples,
acompanhar estado e ações rápidas. Operação densa pode ser reduzida ou
especializada.

### 1.3 Copilot estruturalmente presente ≠ Gemini sempre chamado

O interruptor *"Ligar modo conversa (mais capaz, mais caro)"* **sai da tela** —
ele expõe decisão de infraestrutura ao lojista. Mas isso **não** significa LLM em
toda interação. Ver §5, que investiga por que ele existe.

### 1.4 Vocabulário aprovado e congelado

| Situação | Texto |
|---|---|
| `valor_compartilhado` | **"Uma resposta resolve as 47"** |
| `um_por_alvo` | **"Cada uma tem o seu — preciso de 31 valores"** |
| stale | calmo · âmbar · valor anterior × atual · **"O preço não foi alterado."** · ação nomeando a recuperação (`Recalcular com R$ 52,10`) |

Explicam a diferença **sem expor a taxonomia interna**. É por isso que são bons.

---

## 2. BLOQUEIO DA RODADA 3 VISUAL

```
balance → { credits: 0, subscription_plan_type: "free" }
generate_image → "Out of credits in the selected workspace"
```

As 5 gerações da rodada 2 (10 créditos) esgotaram o saldo. **Zero imagens novas.**

Registro adicional: `show_plans_and_credits` devolveu `credit_purchase_links: []`
e `auto_refill.is_eligible: false` — **top-up avulso não está disponível para este
workspace**, só upgrade de plano. A decisão é sua e financeira; não foi tomada.

**Nada foi inventado no lugar das imagens.** O que segue é análise, e está
marcado como tal.

---

## 3. FALSIFICAÇÃO DE C — executada sem imagens

O item 14 pediu para **tentar derrubar C**, não confirmá-la. Essa parte é
raciocínio sobre domínio, código e geometria de tela — não precisa de pixel.

> **Método:** para cada estado, procurar a configuração em que C fica *pior* que
> a alternativa. Onde não achei, digo. Onde achei, digo também.

### 3.1 Tabela densa — o teste mais importante

Era o ponto onde B parecia superior. Fiz a conta de largura, com a sidebar real
de 240px:

| Largura da janela | B: tabela + detalhe | C: conversa + tabela |
|---|---|---|
| 1280 | 240 + **660** + 380 detalhe | 240 + 380 conversa + **660** |
| 1440 | 240 + **820** + 380 | 240 + 380 + **820** |
| 1600 | 240 + **980** + 380 | 240 + 380 + **980** |

**A tabela recebe exatamente a mesma largura nas duas.** Em B, 380px vão para o
painel de detalhe; em C, para a conversa. O custo é idêntico.

O que C perde é **detalhe e tabela simultâneos**. Abaixo de ~1440px o drill-down
precisa *substituir* a tabela, não sentar ao lado.

**Veredito: C sobrevive.** A descoberta B→C se sustenta — e agora com número, não
com impressão. ⚠️ *Analítico; não validado visualmente.*

### 3.2 Cadastro conversacional — achei uma tensão real

O Draft começa com 1–2 fatos. Uma superfície contextual de 660px mostrando
`Marca: Modare` é **pior que não mostrar nada**.

**Isto quase derruba C** — e a saída não é arquitetural, é uma regra de
comportamento:

> A superfície contextual precisa de um estado **"ainda não vale a tela"**. Ela
> só reivindica espaço quando o objeto tem substância; antes disso, a conversa
> ocupa a largura.

**Veredito: C sobrevive, com regra nova obrigatória.**

### 3.3 Consequência — produziu a restrição mais importante de toda a exploração

Depois de aplicar a Proposal de peso, a superfície está mostrando a fila de
decisões. O pricing acabou de desbloquear. Ela deve trocar para pricing?

**Não.** Trocar sozinha seria a interface decidindo o que o lojista vai fazer.
"Adaptativo" viraria "imprevisível" — o risco #2 que eu mesmo registrei.

> ### A REGRA
> **O workspace nunca troca de modo sozinho. Só a INTENÇÃO troca o modo.**
>
> A consequência aparece **dentro do modo atual**: a fila recomputa, o cartão de
> peso some, os contadores caem, e uma linha nova diz o que desbloqueou. O
> convite para seguir vive na **conversa**, não num salto de tela.

**Veredito: C sobrevive, e ficou mais definida.**

### 3.4 Conflito, proveniência, prejuízo — três "modos" que não existem

Testei se cada um justifica uma superfície própria:

| Hipótese | Resultado |
|---|---|
| **conflito** = modo | ❌ É pequeno e de alta consequência: dois valores, duas origens, uma escolha. Cabe como **tipo de cartão dentro da fila de decisões**. |
| **proveniência** = modo | ❌ Você pediu para *não* abandonar o contexto. É **disclosure dentro do cartão** que já mostra o valor. |
| **prejuízo** = modo | ❌ É o modo **pricing** com resultado negativo e uma transição oferecida ("simula um preço sustentável"). |

**Isto é resultado de falsificação, e simplifica o produto:**

```
Hipótese inicial:  8 modos
Depois de testar:  5 modos reais

  MODOS         fila de decisões · triagem/tabela · pricing · Draft · preparação
  CARTÕES       conflito · Proposal
  DISCLOSURE    proveniência
```

**Três modos a menos para construir.**

### 3.5 Conversa longa · ação rápida

12 turnos numa coluna de 380px: cada turno é curto **porque a estrutura está na
superfície**. A conversa vira o fio, não o conteúdo — que é o desenho pretendido.
Ação rápida ("esse produto dá prejuízo?") resolve em um turno. **Sobrevivem.**

### 3.6 Mobile — **aqui C não sobrevive, e isso já estava decidido**

Três zonas não coexistem em 375px. Não é falha da escolha: é a razão de você ter
aprovado arquitetura mobile própria.

**Restrição inegociável que o mobile herda:**

> `[Aplicar a 47 variantes]` **não pode virar** `[Confirmar]` por falta de espaço.
> O botão quebra em duas linhas. O escopo nunca é a coisa que se corta.

### 3.7 Placar

| Estado | C sobrevive? | O que a falsificação produziu |
|---|---|---|
| tabela densa | ✅ | largura idêntica a B; drill-down substitui abaixo de 1440 |
| cadastro | ✅ | regra "ainda não vale a tela" |
| conflito | ✅ | vira cartão, não modo |
| proveniência | ✅ | vira disclosure, não modo |
| prejuízo | ✅ | vira estado do pricing |
| consequência | ✅ | **regra: só a intenção troca o modo** |
| conversa longa | ✅ | — |
| ação rápida | ✅ | — |
| **mobile** | ❌ | arquitetura própria (já decidido) |

**C resistiu no desktop.** Não protegi a decisão: as duas tensões reais (§3.2 e
§3.3) estão registradas, e as duas viraram regra em vez de exceção.

---

## 4. COMPONENTES — derivados da exploração completa

| Componente | Estado | Origem |
|---|---|---|
| **Workspace shell** (3 zonas + regras de largura) | a validar | §3.1 |
| **Coluna de conversa** (turnos curtos, rastro de ferramenta, input fixo) | ✅ validado nas 5 gerações | R1+R2 |
| **Superfície contextual** (5 modos + estado "ainda não vale a tela") | parcial | §3.2, §3.4 |
| **Fila de decisões** (numerada, por impacto) | ✅ validado | C2-panorama |
| **Cartão de decisão agrupada** (escopo, amostra, "Ver todas as N") | ✅ validado | C2-panorama |
| **Faixa de estatísticas** (4 números inline) | ✅ validado | C2-panorama |
| **Breakdown de preço** (7 parcelas que fecham) | ✅ validado | R1 A e C |
| **Cartões de cenário** (comparação lado a lado) | ✅ validado | R1 C |
| **Barra de Proposal** (DE→PARA + botão nomeado) | ✅ validado | R1 C |
| **Painel de stale** (âmbar, dois valores, recuperação) | ✅ validado | C2-stale |
| **Pílula de precisão** (`estimativa`) | ✅ validado 3× | R1+R2 |
| **Tabela operacional densa** (12+ linhas, seleção, filtros) | ❌ **não gerada** | — |
| **Draft vivo** | ❌ **não gerado** | — |
| **Trilha de preparação** (5 etapas não lineares) | ❌ **não gerada** | — |
| **Cartão de conflito** | ❌ **não gerado** | — |
| **Disclosure de proveniência** | ❌ **não gerado** | — |
| **Shell mobile** | ❌ **não gerado** | — |

**11 validados visualmente · 6 pendentes.**

---

## 5. O OPT-IN — investigado antes de remover, como pedido

### Por que ele existe

Medido e comentado no código: o laço com ferramentas custa **~2.600 tokens por
conversa** contra **~400 por pergunta** na rota de intenção — **6 a 19 vezes
mais**. O interruptor existia para o lojista não pagar isso sem saber.

### O que a investigação achou — e muda a conclusão

```
ferramentas no catálogo ......................... 17
alcançáveis pela rota de intenção (~400 tokens) ... 0
```

A rota barata **não chama ferramenta nenhuma**. Ela classifica uma frase numa
lista fechada de 7 intenções e devolve uma intenção — o domínio responde no
cliente. Cadastro, pendências, proveniência, preparação, título e pricing vivem
**exclusivamente** no laço de ferramentas.

> **Consequência:** "Copilot estruturalmente presente" **exige** o laço de
> ferramentas sempre disponível. O interruptor não é uma preferência de custo —
> é o que hoje separa o Copilot antigo do produto que as quatro verticais
> construíram.

### Impacto técnico a resolver (não nesta rodada)

1. **Roteamento interno substitui o controle visível.** Perguntas que a rota de intenção resolve continuam nela; o resto sobe para o laço. O lojista não escolhe.
2. **O roteador precisa ser barato e determinístico.** Um LLM decidindo se chama o LLM anula a economia. Candidato: classificação por padrão sobre a frase, com fallback para o laço — regra do domínio, não do modelo.
3. **Piso de custo por conversa sobe.** Precisa de medição antes de ligar para todo mundo.
4. **`maxDuration`:** 30s na rota de intenção, 60s no laço. Roteamento sempre-ligado paga 60s no pior caso.

**Registrado como decisão de produto e custo. Nada implementado.**

---

## 6. COMPORTAMENTOS

### Desktop

| # | Regra | Origem |
|---|---|---|
| D1 | **Só a intenção troca o modo do workspace.** Nunca automático. | §3.3 |
| D2 | A consequência aparece **dentro do modo atual** (recomputa, não salta). | §3.3 |
| D3 | A superfície tem estado **"ainda não vale a tela"**; abaixo dele, a conversa ocupa a largura. | §3.2 |
| D4 | Abaixo de ~1440px, drill-down **substitui** a tabela. Acima, coexistem. | §3.1 |
| D5 | Rótulo persistente do objeto em foco na superfície (contra desorientação). | risco #2 de H-002 |
| D6 | Toda Proposal mostra DE→PARA e o botão **nomeia a ação com escopo**. | R1 C |
| D7 | Sem `propostaId`, sem botão. | domínio |

### Mobile — hipótese a validar

| # | Regra |
|---|---|
| M1 | Duas superfícies alternáveis — **Conversa ↕ Contexto** — preservando o fio |
| M2 | A conversa é a home; o contexto é vista empurrada, com voltar |
| M3 | Confirmação **sempre** mostra escopo; o botão quebra linha, **nunca** vira "Confirmar" |
| M4 | Tabela densa vira **lista de cartões**, não tabela rolável horizontalmente |
| M5 | Breakdown de 7 parcelas: resumo + expandir |

---

## 7. VOCABULÁRIO CONSOLIDADO

| Domínio | UI |
|---|---|
| comissão de tabela | **`estimativa`** — pílula âmbar discreta |
| comissão da API | **`confirmado pelo Mercado Livre`** |
| comissão indisponível | **`não consegui a comissão`** — sem número |
| `valor_compartilhado` | **"Uma resposta resolve as 47"** |
| `um_por_alvo` | **"Cada uma tem o seu — preciso de 31 valores"** |
| bloqueio | **"trava precificar"** — linha âmbar |
| proposta obsoleta | **"O cálculo mudou antes de eu aplicar"** + **"O preço não foi alterado."** |
| origem ausente | **"Origem não registrada"** — estado legítimo, não erro |
| preparar × publicar | **"Muda no seu catálogo. Não publica no Mercado Livre."** |

Nenhum percentual de confiança em lugar nenhum.

---

## 8. JOBS HIGGSFIELD

Rodada 3: **nenhum job** — sem créditos. Rodadas 1 e 2 em `HIGGSFIELD-002` §14
(5 jobs, IDs e URLs preservados, recuperáveis por `job_display`).

---

## 9. PRONTO PARA IMPLEMENTAR?

### Não. Faltam três coisas — e só uma depende de você.

**① Validação visual dos 6 componentes pendentes** — bloqueado por créditos.
Sem isso, implementar tabela densa, Draft vivo, trilha de preparação, conflito,
proveniência e mobile seria desenhar direto no código, que é exatamente o que
esta fase existe para evitar.

**② Medidas de layout** — derivo das regras D1–D7 e proponho para você aprovar.
Não precisa de imagem.

**③ Plano de migração do `ChatDaOperacao`** — 935 linhas, 8 cartões inline, duas
superfícies (painel + página) que C substitui. Precisa de plano antes de
qualquer linha.

### O que dá para fazer AGORA sem risco

Três dívidas que a exploração expôs, **independentes da direção escolhida**:

- **`useLiveQuery` engole erro** → falha e vazio são idênticos na tela. Qualquer arquitetura sofre com isso.
- **Sem skeleton** → a tela pisca de vazio para cheio.
- **Duas superfícies do Copilot** com regra de visibilidade que ninguém entende.

Nenhuma delas exige decidir layout. **Posso atacá-las enquanto a validação visual
espera.**
