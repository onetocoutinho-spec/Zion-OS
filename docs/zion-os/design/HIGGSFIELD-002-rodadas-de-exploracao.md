# HIGGSFIELD-002 — Rodadas de exploração

**Data:** 2026-07-29
**Base:** `5823937` · contrato: `HIGGSFIELD-001`
**Status:** duas rodadas executadas. **Nenhuma direção escolhida. Nenhum código alterado.**

---

## 1. MCP HIGGSFIELD — capacidades REAIS

Inspecionei as tools antes de usar. O servidor é de **mídia generativa**, não de design.

### O que existe e foi usado

| Capacidade | Tool | Usado |
|---|---|---|
| catálogo de modelos | `models_explore` | ✅ para escolher o modelo certo |
| gerar imagem | `generate_image` | ✅ 5 gerações, `nano_banana_pro`, 2k, 16:9 |
| preflight de custo | `get_cost: true` | ✅ 2 créditos/imagem antes de gastar |
| recuperar resultado | `job_display`, `show_generations` | ✅ |
| assets | URLs CloudFront no retorno | ✅ baixados |

### O que existe e NÃO serve a este trabalho

`generate_video` · `generate_audio` · `generate_3d` · `create_website` (gera um site
com stack própria — não explora a UI de um produto existente) · Marketing Studio
(anúncios de produto) · `autosprite` (sprites de jogo).

### O que NÃO existe — e muda o que este handoff pode ser

- ❌ **iterar sobre estrutura** — cada chamada é uma geração nova, sem memória de layout
- ❌ **devolver specs, tokens ou medidas** — a saída é um PNG, não um documento de design
- ❌ **projeto/workspace de design** — não há entidade "projeto" para versionar direções
- ❌ **editar uma região da geração anterior** — só regerar por prompt inteiro

### Consequência honesta

> **O Higgsfield gera ESTÍMULO VISUAL. Ele não decide arquitetura de interação e
> não produz contrato de implementação.**

Quem explorou as arquiteturas, avaliou contra o domínio e filtrou as violações
**fui eu**. As imagens servem para você *ver* e decidir — não para serem
implementadas pixel a pixel.

**Todo texto e todo número nas imagens é decoração.** Modelos de imagem inventam
conteúdo. Os valores certos estão no domínio, não no PNG.

### Uma limitação a registrar

Tentei enviar screenshot real do Zion como referência: subi o dev server, `/cliente`
respondeu 200, mas **o painel do navegador não estava sendo exibido** e a captura
falhou. Sem screenshot, o design system foi transmitido por **descrição precisa**
(hex, radius, escala tipográfica) — o que explica a fidelidade de cor e a
**infidelidade da navegação** nas primeiras gerações.

---

## 2. RODADA 1 — três arquiteturas

Mesma sessão nas três, para comparar **arquitetura, não conteúdo**.

### A — Conversational Workspace
`c688666a-0288-4512-a469-14e6c2b3cd21` · [PNG](https://d8j0ntlcm91z4.cloudfront.net/user_3GVSiSyjUKOCnZJ3LKm6hqv09Tb/hf_20260730_013841_c688666a-0288-4512-a469-14e6c2b3cd21.png)

Sidebar + coluna de conversa larga (~760px). O breakdown vira **cartão inline** na
conversa; a comparação de cenários vira tabela logo abaixo.

**Funcionou:** o cartão de breakdown é lindo e legível — linhas com `−`, divisor,
resultado em esmeralda. A pílula âmbar **"estimativa"** no canto do cartão resolve
o problema da precisão **sem alarme**. Densidade e tokens corretos.

**Falhou:** tudo empilha na vertical. Comparar 3 cenários exige rolar por baixo do
breakdown. Em uma sessão de 12 passos, o contexto sobe e some.

**🚨 Violações de domínio detectadas:**
1. *"com base na sua meta e na **concorrência**"* — **competitor pricing NÃO EXISTE** e está explicitamente fora de escopo (COPILOT-006 §30)
2. Números internamente inconsistentes (R$ 79,90 → −R$ 15,73 não fecha com custo R$ 47,80)
3. Avatar do assistente é o **logo da OpenAI**

### B — Operational Command Center
`bc8600b0-a9d8-4255-95f7-2f38ef205411` · [PNG](https://d8j0ntlcm91z4.cloudfront.net/user_3GVSiSyjUKOCnZJ3LKm6hqv09Tb/hf_20260730_013902_bc8600b0-a9d8-4255-95f7-2f38ef205411.png)

Faixa do Copilot no topo · 4 métricas · tabela densa + painel de detalhe.

**Funcionou — e este é o achado:** a **tabela densa de 6 produtos** com
preço/sobra/margem/estado responde *"quais estão abaixo da margem?"* num relance.
É objetivamente melhor que A para triagem. A **faixa do Copilot** faz ele parecer
parte do sistema, não um chat anexado. Linha em prejuízo em vermelho, sem drama.

**Falhou:** a faixa cabe **uma linha**. A sessão de 12 passos — simular três
preços, escolher margem, receber proposta — não tem onde acontecer. A conversa
vira notificação.

**Violação:** navegação inventada ("Análise / Operações / Suporte") em vez das 5
áreas reais. Renderizou com moldura de dispositivo sobre fundo claro.

### C — Adaptive Split Workspace
`7d5146bf-a6d8-4832-99f8-006d19caa78d` · [PNG](https://d8j0ntlcm91z4.cloudfront.net/user_3GVSiSyjUKOCnZJ3LKm6hqv09Tb/hf_20260730_013923_7d5146bf-a6d8-4832-99f8-006d19caa78d.png)

Sidebar · conversa (~420px) · superfície contextual que virou **simulador de preço**.

**Funcionou:** os **três cartões de cenário lado a lado**, com o do meio marcado
em violeta e a pílula "meta 12%", respondem *"qual é melhor?"* em um segundo — o
objetivo declarado do item 8. A **barra de proposta** no rodapé é o contrato da
Proposal inteiro: `De R$ 129,90 para R$ 84,90` + **"Aplicar R$ 84,90"** + "Agora
não". Por acaso, a aritmética fechou (84,90 − 47,80 − 16,13 − 8,45 − 1,12 = 11,40;
11,40/84,90 = 13,4%).

**Falhou:** *"PRICE SIMULATOR"* em inglês e a ~48px — viola o idioma **e** o teto
de 24px. Os hex do prompt vazaram como texto literal (`#8b8b94`) sob cada rótulo.
Coluna de conversa com muito espaço morto.

---

## 3. AVALIAÇÃO — matriz

| Critério | A · Conversational | B · Command Center | C · Adaptive Split |
|---|---|---|---|
| velocidade até a 1ª decisão | 🟡 rola para achar | 🟢 tudo à vista | 🟢 decisão à direita |
| compreensão do *porquê* | 🟢 breakdown inline | 🟡 painel estreito | 🟢 breakdown largo |
| densidade | 🔴 vertical, desperdiça | 🟢 excelente | 🟢 boa |
| contexto (falar do que se vê) | 🟡 o objeto some ao rolar | 🔴 conversa de 1 linha | 🟢 os dois presentes |
| risco de confirmar sem ler | 🟡 proposta no fluxo | 🟡 sem lugar claro | 🟢 barra fixa, DE→PARA |
| escalabilidade (8→12 cartões) | 🔴 fila infinita | 🟡 painel único | 🟢 superfície troca |
| conversa longa (12 turnos) | 🟢 natural | 🔴 não cabe | 🟢 coluna dedicada |
| tarefa rápida ("dá prejuízo?") | 🟡 pergunta e espera | 🟢 tabela responde | 🟢 os dois caminhos |
| mobile | 🟢 uma coluna já é | 🟡 tabela sofre | 🔴 precisa alternar |
| consistência com o Zion atual | 🟢 é o que já existe | 🟡 muda a navegação | 🟢 evolui sem romper |

### Trade-offs, sem eufemismo

- **A** é o caminho de menor esforço e **mantém o problema #1 do handoff**: informação estruturada espremida numa coluna.
- **B** ganha em densidade e **perde a capacidade que custou quatro verticais** — o lojista expressar intenção em vez de caçar a tela.
- **C** ganha nos dois e **paga em mobile e complexidade de implementação**.

---

## 4. ELIMINADA

**A — Conversational Workspace.**
Não porque é feia: porque **não resolve o problema que motivou o handoff**. O
Copilot já devolve 8 tipos de cartão, e A os empilha numa coluna. Escalabilidade
🔴 e densidade 🔴 são justamente os dois critérios que o produto já reprova hoje.

## 5. FINALISTAS — e uma descoberta

**C (Adaptive Split)** e **B (Command Center)**.

Mas a rodada 1 revelou algo que muda a pergunta:

> **B não é uma arquitetura concorrente de C. É um dos modos de superfície de C.**

A tabela densa de B — a melhor peça da rodada — é exatamente o que a superfície
contextual de C deveria mostrar quando a tarefa é **triagem**, do mesmo jeito que
ela vira **simulador** quando a tarefa é preço. Isso é literalmente o que
"adaptive" significa.

Portanto a rodada 2 aprofundou **C absorvendo a virtude de B**.

---

## 6. RODADA 2 — C refinada

Correções aplicadas ao prompt: só português · proibir hex como texto · as 5 áreas
reais · teto de 24px explícito · sem moldura de dispositivo · conversa densa.

### C2 · Panorama + Decisão agrupada
`5ade4a92-adc5-40f8-8fa9-cc003f37266c` · [PNG](https://d8j0ntlcm91z4.cloudfront.net/user_3GVSiSyjUKOCnZJ3LKm6hqv09Tb/hf_20260730_014220_5ade4a92-adc5-40f8-8fa9-cc003f37266c.png)

**O melhor achado da sessão inteira** — a decisão agrupada resolvida:

- **`uma resposta resolve as 47`** — pílula violeta no cartão. É a semântica de `valor_compartilhado` dita em cinco palavras.
- **`cada uma tem o seu — preciso de 31 valores`** — no cartão de EAN. É `um_por_alvo`, e a diferença entre os dois fica **óbvia sem explicação**.
- **`trava precificar`** em âmbar — a consequência, ali.
- Amostra de 3 variantes + **`Ver todas as 47`** — não esconde escopo, não despeja 47 linhas.
- Faixa de estatísticas inline (126 · 92 · 2 · 13) em vez de 4 cards gigantes.
- Navegação real restaurada.

**Defeitos:** rótulos duplicaram o número ("128 PENDÊNCIAS" sobre "126"); conversa
ainda com espaço morto embaixo; moldura arredondada persistiu.

### C2 · Stale
`6e30c8f6-a743-4e85-bd81-e3b920beccce` · [PNG](https://d8j0ntlcm91z4.cloudfront.net/user_3GVSiSyjUKOCnZJ3LKm6hqv09Tb/hf_20260730_014248_6e30c8f6-a743-4e85-bd81-e3b920beccce.png)

**O segundo melhor.** O estado que o handoff pediu para não parecer erro técnico:

```
┌─ borda âmbar fina, sem vermelho, sem ícone de erro ─────────┐
│  O cálculo mudou antes de eu aplicar                        │
│  O preço não foi alterado.                                  │
│  ┌──────────────────┬──────────────────┐                    │
│  │ CUSTO QUE EU USEI│ CUSTO AGORA      │                    │
│  │ R̶$̶ ̶4̶7̶,̶8̶0̶          │ R$ 52,10         │                    │
│  └──────────────────┴──────────────────┘                    │
│  Isso muda a margem que você aprovou.                       │
│  [Recalcular com R$ 52,10]  [Deixar como está]              │
└─────────────────────────────────────────────────────────────┘
   ↓ proposta anterior, esmaecida, botão desabilitado
     De R̶$̶ ̶1̶2̶9̶,̶9̶0̶ para R$ 84,90
     [Aplicar R$ 84,90]  ← desabilitado
     proposta obsoleta · nada foi gravado
```

O tachado no valor antigo, o botão de recuperação **nomeando o novo custo**, e a
proposta morta ficando visível mas inerte — o usuário entende que foi
**protegido**, não que o sistema falhou.

**Defeito:** o texto do assistente saiu como gibberish ("vos apnts os produtos
para, atante..."). Artefato clássico do gerador — ignorar.

---

## 7. COMO C TRATA CADA ESTADO

| Estado | Superfície contextual vira | Conversa faz |
|---|---|---|
| **panorama** | faixa de estatísticas + fila de decisões numeradas | recebe "o que precisa de mim?" |
| **decisão agrupada** | cartão expandido, escopo + amostra + "ver todas" | recebe a resposta ("todas 0,42 kg") |
| **pricing** | breakdown de 7 parcelas + dois pisos | recebe "por quanto posso vender?" |
| **simulação** | 3 cartões de cenário lado a lado | recebe "simula 79,90 / 84,90 / 89,90" |
| **Proposal** | barra fixa no rodapé, DE→PARA | recebe "pode aplicar" |
| **stale** | painel âmbar + proposta morta esmaecida | recebe "recalcular" |
| **preparação** | trilha de 5 etapas (**a explorar — não gerada**) | recebe "e agora?" |
| **triagem de margem** | **tabela densa de B** (**a explorar**) | recebe "quais estão abaixo da margem?" |

---

## 8. O QUE AS RODADAS **NÃO** COBRIRAM

Sendo explícito, porque isto define o que ainda falta decidir:

- ❌ **preparação do anúncio** (5 etapas, dependências não lineares)
- ❌ **cadastro conversacional** com estrutura viva
- ❌ **consequência visível** — o momento "peso resolvido → pricing desbloqueado"
- ❌ **proveniência** em disclosure progressivo
- ❌ **conflito** (dois valores, duas origens)
- ❌ **mobile** — nenhuma geração
- ❌ **prejuízo** como estado dedicado
- ❌ a **tabela densa de B dentro de C**

Custo até aqui: **10 créditos** (5 × 2).

---

## 9. DESIGN SYSTEM — o veredito

| | |
|---|---|
| **REUTILIZAR** | fundo `#08080d` · superfície `#0e0e16` · sidebar `#0b0b12` · texto `#e4e4e7` / `#8b8b94` · violeta `#7c3aed` · radius 8/12/full · bordas `white/5–10` · profundidade sem sombra · teto de 24px · tons semânticos `cor/10 + cor-400 + ring cor/20` · toque 44px em ponteiro grosso |
| **EVOLUIR** | **pílula de precisão** (âmbar discreta, dentro do cartão) · **pílula de escopo** (violeta: "uma resposta resolve as 47") · **linha de consequência** (âmbar: "trava precificar") · **linha DE→PARA** com tachado no valor velho · **borda âmbar de painel** para stale — todos são combinações do que já existe |
| **NOVO** | **nada de cor ou tipografia.** Só um token de layout: a largura da coluna de conversa e da superfície contextual. **Não há segundo design system.** |

---

## 10. VOCABULÁRIO DE PRECISÃO — validado

A pílula **`estimativa`** funcionou nas três gerações: presente, legível, **sem
assustar**. Proposta:

| Nível | Rótulo na UI | Tom | Onde |
|---|---|---|---|
| tabela/padrão | **`estimativa`** | âmbar discreto | pílula no canto do cartão |
| API do ML | **`confirmado pelo Mercado Livre`** | verde ou neutro | mesma posição |
| indisponível | **`não consegui a comissão`** | âmbar + bloqueio | no lugar do número |

Nenhum percentual de confiança. A diferença é de **fonte**, e o rótulo diz a fonte.

---

## 11. MOTION — funcional

Só o que comunica mudança de estado. **Nada foi gerado** (o MCP não produz motion
spec); isto é proposta a validar:

| Momento | Sugestão |
|---|---|
| superfície contextual troca de modo | crossfade 160ms, sem deslizar |
| Proposal aparece | a barra do rodapé sobe 8px + fade, 200ms |
| **etapa desbloqueada** | o item muda de tom em 300ms — **o mais importante** |
| stale | a proposta antiga esmaece para 40% em 200ms; o painel âmbar entra por cima |
| cálculo concluído | os números fazem *tick* de contagem curta, ≤250ms |
| pendência resolvida | o contador decrementa com o número deslizando |

---

## 12. RISCOS

**De UX**
1. **Mobile é o ponto fraco de C** — três zonas não cabem em 375px, e nada foi explorado
2. **Desorientação** — a superfície mudar sozinha pode confundir; precisa de rótulo persistente do objeto em foco
3. **Coluna de conversa vazia** — apareceu nas quatro gerações de C; sem conteúdo suficiente ela parece defeito

**De implementação**
4. `ChatDaOperacao` tem 935 linhas e 8 cartões inline; C exige **separar o que é fala do que é superfície** — refatoração real
5. Hoje há **duas** superfícies do Copilot (painel + página). C substitui as duas — a migração precisa de plano
6. `useLiveQuery` engole erro; uma superfície contextual que carrega dados precisa distinguir **vazio de falha** antes
7. O modo conversa é opt-in por link; C não faz sentido sem ele sempre ligado — **decisão de produto e de custo**

---

## 13. RECOMENDAÇÃO

**C — Adaptive Split Workspace, absorvendo a tabela densa de B como um dos modos
de superfície.**

Três razões, nesta ordem:

1. **É a única que resolve o problema #1 do handoff.** O Copilot já produz superfície operacional; A e B forçam a escolher entre ter conversa e ter densidade.
2. **A rodada 2 provou o que mais importava.** Se `uma resposta resolve as 47` ou o stale calmo tivessem falhado, eu recomendaria B. Não falharam — e são as duas peças mais difíceis do produto.
3. **Não pede design system novo.** Tudo é recombinação do que existe. O custo está no layout e na refatoração, não numa segunda identidade visual.

**O risco que aceito ao recomendar:** mobile. Não foi explorado, e é onde C é mais
fraca. Se o lojista usa o Zion majoritariamente no celular, **esta recomendação
muda** — e essa é uma informação que eu não tenho.

---

## 14. ARTEFATOS

| # | Estado | Job ID | Arquivo local |
|---|---|---|---|
| 1 | A · Conversational | `c688666a-…` | `scratchpad/direcao-A.png` |
| 2 | B · Command Center | `bc8600b0-…` | `scratchpad/direcao-B.png` |
| 3 | C · Adaptive Split | `7d5146bf-…` | `scratchpad/direcao-C.png` |
| 4 | C2 · Panorama + decisão | `5ade4a92-…` | `scratchpad/C2-panorama.png` |
| 5 | C2 · Stale | `6e30c8f6-…` | `scratchpad/C2-stale.png` |

URLs CloudFront nas seções 2 e 6. Recuperáveis por `job_display` com o ID.

> ⚠️ **Nenhum texto ou número dessas imagens é contrato.** Modelos de imagem
> inventam conteúdo — inclusive uma capacidade de "concorrência" que não existe.
> O contrato é o domínio.
