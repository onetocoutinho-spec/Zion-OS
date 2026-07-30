# COPILOT-006 — Pricing e margem pelo Copilot

**Data:** 2026-07-29
**Ramo:** `feat/copilot-lote-com-escopo-congelado`
**Sucede:** COPILOT-005 (preparação do anúncio, concluída em `3367bb0`)
**Portão:** 1515 testes · TS 0 · lint sem erros · build ok

---

## 1. RECONHECIMENTO — o motor financeiro real

### Onde a matemática vive

`modules/pricing/domain/modeloPreco.ts` é **a autoridade**, e não foi tocada.

| Função | Responde |
|---|---|
| `comissaoPercentual` | a tarifa de venda — API do ML quando há, tabela de Moda quando não |
| `taxaFixaVenda` | taxa fixa por venda da API; zero quando não vem |
| `envioDoModelo` | custo de envio pela tabela oficial |
| `custoDaVenda` | comissão + taxa fixa + envio + custos do lojista |
| `lucroLiquido` | preço − custo − custo da venda |
| `margemLiquida` | lucro / preço, em % |
| `precoMinimo` | **a inversão** — o menor preço que entrega a margem pedida |

### Os componentes REAIS da conta

| Componente | De onde vem | Pode faltar? |
|---|---|---|
| custo do produto | `produtos.custo` | **sim** → bloqueia |
| comissão do ML | API (`/sites/MLB/listing_prices`) → senão tabela `COMISSAO_MODA` | não (cai na tabela) |
| taxa fixa por venda | API | não (zero) |
| frete | `tabelaEnvioML` — matriz **peso cobrável × faixa de preço × reputação** | **sim** → bloqueia (sem peso) |
| imposto | `clientes.imposto_percentual` (033) | não (zero) |
| comissão do gestor | `clientes.comissao_gestor_percentual` | não (zero) |
| comissão do sistema | `clientes.comissao_sistema_percentual` | não (zero) |
| cupom | `clientes.cupom_percentual` — **separado do imposto de propósito** | não (zero) |
| embalagem, etiqueta, informativos | `clientes.custo_*` — R$ por pedido | não (zero) |
| `vendedorPagaFrete` | `produtos.vendedor_paga_frete` (034) | `null` = assume que paga |
| margem mínima | `clientes.margem_minima` (029) | não (padrão 5%) |

**Não inventei nenhuma taxa.** O que não está nesta tabela não entra na conta.

### Representação monetária e arredondamento

- O motor trabalha em **reais como `number`**, arredondando **no centavo**
  (`Math.round(v * 100) / 100`) a cada parcela. A margem sai com **uma casa**
  (`Math.round(x * 1000) / 10`). Preservei os dois.
- A entrada do lojista passa por `lerDinheiroEmCentavos` — o parser da vertical
  de cadastro: `"47,80"` → 4780, `"1.249,90"` → 124990, e **`"1.2"` → `null`**,
  porque é genuinamente ambíguo.
- As **precondições** da Proposal viajam em **centavos inteiros**: float binário
  numa comparação de revalidação compararia `47.800000000000004`.

### O que descobri sobre "aplicar preço"

**A tela de precificação do portal não escreve preço.** Ela só mostra. O preço
entra por importação, cadastro manual e `atualizarProduto` (tela da equipe).

Então "aplicar" precisava de semântica definida, e ela é: **`produtos.preco_venda`
no catálogo do Zion**, mais a `margem` derivada. **Não é publicar** — o anúncio
no ar não é tocado.

---

## 2. AUTORIDADE — o Gemini não faz conta de dinheiro

```
linguagem natural → intenção → conversaDePreco → modeloPreco → estrutura → Gemini explica
```

`conversaDePreco.ts` **não calcula nada por conta própria**: ele compõe, nomeia
as parcelas e classifica estados. Um teste prova que a margem devolvida é
literalmente `margemLiquida(...)` do motor, e outro prova que **as parcelas somam
de volta ao preço** — um detalhamento que não se confere é decoração.

O prompt proíbe explicitamente subtrair, dividir e multiplicar valores.

---

## 3. MARGEM — a definição, escrita

> **margem % = (preço − custo − comissão − taxa fixa − envio − imposto − cupom −
> comissões internas − embalagem) / preço × 100**

É **margem líquida sobre o preço de venda**. **Não é markup** (lucro sobre o
custo) e **não é margem bruta**. Não existe função que converta entre eles — a
conversão implícita é o erro que vende no prejuízo com cara de lucro.

Quando o lojista diz "quero ganhar 10%", o Copilot assume margem líquida (o
padrão do Zion) **e diz que assumiu**.

---

## 4. COMISSÃO — três estados, nenhum inventado

| Estado | Quando | Como aparece |
|---|---|---|
| `api` | a tarifa exata da conta, para a categoria e o preço | "16,5% da sua conta" |
| `tabela` | a de Moda, quando não há API | "**estimativa** — não a comissão exata da sua conta" |
| `indisponivel` | nem uma nem outra | **bloqueia**; nenhum percentual é inventado |

**O Copilot opera hoje em `tabela`, e diz isso.** O motivo é medido, não
preguiça: a tarifa exata depende de **categoria + preço + tipo de anúncio**,
exige o access_token do lojista (rotacionando o refresh_token a cada chamada), e
a maioria dos produtos desta base **não tem categoria preenchida** — sem ela a
rota `/api/ml/custos` sequer consulta a tarifa.

O domínio não muda por isso: `comissaoPercentual` prefere `percentualVendaML`
quando ele existe. Quando a API alimentar esta camada, só a procedência muda.

---

## 5. FRETE

`custoDeEnvio(pesoCobravel, preco, reputacao)` — matriz oficial encodada.
Os componentes que o Copilot consegue explicar são os reais:

- **peso cobrável** = o MAIOR entre real e cubado (volume / 6000 × 1000)
- **faixa de preço** — o envio salta em R$ 79, quando o frete grátis passa a ser
  do vendedor
- **reputação** — escolhe entre as três tabelas
- **`vendedorPagaFrete: false`** → o frete não é custo do lojista, e **o peso
  deixa de ser pendência**
- teto: abaixo de R$ 19 o envio custa no máximo metade do preço

Sem peso e com o vendedor pagando → `bloqueado por peso`, e isso conecta com o
resolvedor de pendências da COPILOT-004, que já sabe preparar a correção.

---

## 6. SIMULAÇÃO

`simular([79.90, 84.90, 89.90], entradas)` → um cenário por preço.

**O envio NÃO é reaproveitado entre preços** — ele é uma matriz peso × *faixa de
preço*, e dois preços em faixas diferentes têm envios diferentes. Reusar o
primeiro daria uma tabela plausível e errada; há teste para isso.

O que se reaproveita é o `ModeloTaxas` (embalagem, reputação, custos do lojista),
que não muda com o preço. `simularComTaxasPorPreco` existe para quando a API
entrar com uma tarifa por cenário.

---

## 7. PREÇO MÍNIMO

Reusa `precoMinimo` inteiro — a inversão faixa a faixa, porque o envio depende do
preço que se quer descobrir.

- **sem prejuízo** = `precoMinimo(custo, 0, taxas)` → lucro ≥ 0
- **na margem** = `precoMinimo(custo, margemMinima, taxas)`

Testes de ida e volta: o preço para 10% **decomposto entrega 10%** (meio ponto de
folga pelo arredondamento no centavo), margem maior pede preço maior, e o piso
sem prejuízo fica **acima do custo do produto** — porque vender custa dinheiro.
Fronteira de faixa (R$ 78,99 / 79 / 79,01) testada.

---

## 8. LOTE — e a separação que o reconhecimento obrigou

`triarCatalogo` roda **no backend, com a tabela**, e **declara isso**
(`comissaoUsada: "tabela"`).

Não foi escolha de conveniência: a tarifa exata é **por produto e por preço**.
300 produtos seriam 300 chamadas ao ML com rotação de credencial em cada uma.

> **triagem local acha quem está em risco · o número exato sai produto a produto**

Classes: `prejuizo`, `abaixo_da_margem`, `saudavel`, `sem_preco`, `bloqueado`,
`conflito`. O modelo recebe contagens e até 8 piores; **a tela recebe os itens**.
Limite de 300, e o truncamento é dito com o total real.

---

## 9. PROPOSAL — alvo e precondições

**Migração 040**: `tipo` ganha `'preco'`. `valor` já carregava reais — sem hack.

**Alvo:** `produtos.preco_venda` + `margem` derivada. **Não publica.**

**Precondições — as quatro entradas da conta:**

| campo | por quê |
|---|---|
| `custoDoProduto` | centavos inteiros — muda o preço inteiro |
| `precoAtual` | centavos inteiros — o "de" que a pessoa leu |
| `pesoCobravelGramas` | muda a faixa de frete |
| `impressaoDaConfiguracao` | hash de imposto, cupom, comissões e fixos |

O cenário exigido está coberto: T0 custo R$ 47,80 → proposta R$ 89,90 → T1 custo
vira R$ 55 → T2 clique → **obsoleta, nada gravado**.

**A comissão da API NÃO entra nas precondições**, e é deliberado: ela é
consultada *com* o preço, e o preço é justamente o que a proposta congela.
Revalidá-la exigiria uma chamada externa dentro da confirmação, e uma falha de
rede transformaria uma proposta boa em "obsoleta".

Idempotência, reserva atômica e auditoria: **herdadas intactas**.

---

## 10. PROVENIÊNCIA

Duas linhas, duas origens — a distinção que a COPILOT-004 existe para manter:

| campo | origem | método |
|---|---|---|
| `preco` | `cliente` | `copilot` — ele disse o número ou aprovou a margem |
| `margem` | `zion` | `calculo` — aritmética determinística |

E o resultado carrega a procedência dos **inputs**: custo, comissão (`api` /
`tabela`), frete (`tabela_oficial` / `nao_se_aplica` / `ausente`), custos do
lojista (`informados` / `zerados`), reputação.

---

## 11. ANOMALIA

`anomaliaDeCusto` (COPILOT-004, que reusa `custoDigitado`) entra como
**`custoEmConflito`**, e `avaliar` checa **conflito antes de bloqueio**: um custo
em disputa não é "falta custo".

Um custo de R$ 30.277.872 devolve `conflito` e **não produz recomendação de
preço**. Procedência não salva valor: "veio da planilha" não torna trinta
milhões plausíveis.

---

## 12. INTEGRAÇÃO

- **Pendências (004):** pricing bloqueado por peso é a mesma pendência que o
  resolvedor já classifica e sabe preparar. Não há segundo sistema.
- **Preparação (005):** a etapa `pricing` do orquestrador usa `precoMinimo` com o
  mesmo motivo tipado. Aplicar preço muda `produtos.preco_venda`, e a próxima
  avaliação da preparação reflete isso — sem readiness duplicada.

---

## 13. UI — estados funcionais

`PainelDePreco` e `CartaoDePreco`, decisões em `cartaoDePreco.ts`.

| Estado | O que aparece |
|---|---|
| bloqueado | o que falta — **nenhum número** |
| conflito | a anomalia, em âmbar |
| calculável | detalhamento, piso sem prejuízo, piso na margem, saúde |
| simulação | **tabela** preço / sobra / margem |
| triagem | prejuízo, abaixo da margem, os piores, não avaliados |
| proposta | **DE → PARA** + detalhamento + aviso se abaixo do piso |
| aplicado | vira registro, sem botão |

O detalhamento **soma de cima para baixo**; parcela zero não aparece. Preço
abaixo do piso **avisa e não bloqueia** — vender no prejuízo pode ser estratégia,
e é a mesma regra do `avisoDePreco` no cadastro manual.

---

## 14. HIGGSFIELD — estados para UX

| # | Estado | Dado real |
|---|---|---|
| 1 | pricing bloqueado | lista do que falta, sem número |
| 2 | preço calculável | hoje + dois pisos + saúde |
| 3 | breakdown | 7 parcelas nomeadas que fecham no preço |
| 4 | simulação | N cenários com lucro e margem |
| 5 | comparação de cenários | tabela lado a lado |
| 6 | margem alvo | preço calculado + a margem entregue |
| 7 | prejuízo | lucro negativo, saúde "Prejuízo" |
| 8 | abaixo da margem | margem < piso escolhido |
| 9 | Proposal | DE → PARA + detalhamento + alerta |
| 10 | stale | quatro precondições, com o que mudou |
| 11 | aplicado | preço e margem novos, com procedência |

O eixo que mais pede desenho: **o breakdown como subtração visível** — é ele que
transforma "R$ 89,90" em "e por isso sobra R$ 11,17".

---

## 15. MIGRATIONS

| # | Estado |
|---|---|
| 035 | **APLICADA** |
| 036 · 037 · 038 · 039 | **PENDENTES** |
| 040 — proposta de preço | **PENDENTE** (entregue nesta sessão) |

Nenhuma aplicada. Nenhuma anterior modificada.

---

## 16. TESTES

| Arquivo | Novos |
|---|---|
| `conversaDePreco.test.ts` | 45 |
| `precoPelaFerramenta.test.ts` | 41 |
| **Total novo** | **86** |
| **Suíte** | **1515** (era 1429) |

Um teste meu estava errado e o resultado corrigiu: ele proibia a palavra
"publicado" na saída e reprovava a frase **"NADA foi publicado no Mercado
Livre"** — justamente a que se quer ter. Agora a checagem é do que foi
*afirmado* (id de anúncio, "publiquei"), e a negação tem teste próprio.

---

## 17. PORTÃO

```
1515 testes · TS 0 · typecheck:test 0 · lint sem erros · build ok
```

---

## 18. LIMITAÇÕES REAIS

1. **A comissão do Copilot é a da TABELA, não a da conta.** Ligar a API exigiria
   categoria por produto (quase sempre ausente) e rotação de credencial por
   preço. Está declarado em toda resposta, e a tela de precificação continua
   sendo onde o número exato aparece.
2. **A reputação também é a padrão** (verde), pelo mesmo motivo: ela vem de
   `/users/me`, com token.
3. **A triagem usa a tabela** e diz isso. Ela acha quem está em risco; não
   promete o número exato.
4. **Triagem de 300 produtos por vez**, com o total real informado.
5. **"Aplicar" não publica.** O preço muda no catálogo do Zion; o anúncio no ar
   não é tocado. Isso é a fronteira desta vertical, não um esquecimento.
6. **A margem gravada usa a comissão da tabela** — coerente com o cálculo que o
   lojista aprovou, e não necessariamente igual à que a tela de precificação
   mostra com a API.
7. **Não há repricing contínuo, competitor pricing nem promoções.** Fora de
   escopo por decisão declarada.
8. **040 não aplicada.** Até lá, `propor_preco` monta o cartão mas a Proposal
   falha ao gravar (o `check` recusa `tipo = 'preco'`) — e sem id não há botão,
   que é o comportamento seguro.
9. **Nada foi exercido em tela.** A bateria manual continua adiada.
