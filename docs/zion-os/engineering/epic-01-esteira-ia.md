# Epic 01 — Esteira IA (Core Domain)

> **Natureza.** Investigação de **produto** sobre o Core Domain — como tornar a Esteira mais
> útil ao cliente **sem alterar sua identidade**. Toda melhoria é **aditiva**, reversível e
> fortalece o núcleo. Onde a evidência não bastou: **EVIDÊNCIA INSUFICIENTE**.
>
> **Base de evidência:** `HEAD d2b0fe5` — código real dos agentes (`lib/agentes/catalogo.ts`,
> `esteira.ts`), o schema do Anúncio Gerado, o checklist de qualidade e as regras-mãe.

---

## 1. Objetivo

Responder: **como tornar a Esteira IA significativamente mais útil ao cliente sem
descaracterizá-la?** Toda proposta responde à pergunta-guia:

> *"Esta mudança torna o cliente mais rápido, mais seguro e mais bem-sucedido na criação de
> anúncios de alta qualidade?"*

## 2. Responsabilidade da Esteira

**Responsabilidade exclusiva (por evidência):** transformar um **briefing de produto** em um
**Anúncio de Mercado Livre completo e pronto para competir**, rodando internamente uma linha
de produção de agentes de IA, e **barrando** o que não estiver pronto.

**Problemas que resolve:**
- Criar título, descrição, ficha técnica, medidas, variações e imagens de qualidade **sem
  conhecimento especializado** do cliente.
- **Impedir** que um anúncio incompleto seja publicado (a trava A10).
- **Nunca inventar dado** — o que falta é registrado, não fabricado.

**Identidade a preservar:** é uma **linha de produção com portão de qualidade**. Não é um
editor manual, não é um integrador, não é um gerador solto de texto. Toda evolução deve
manter as duas propriedades — **produz** e **julga**.

---

## 3. Fluxo completo

### 3.1 Entradas (o briefing)

Campos observados em `BRIEFING_MODELO`: nome, marca, modelo, categoria ML, material, cor(es),
tamanho(s)/grade, SKU, código interno, **preço de custo**, **preço de venda**, estoque por
variação, medidas, peso.

### 3.2 A linha de produção — 13 agentes (A0–A12)

| Código | Nome | Objetivo (evidência: `catalogo.ts`) |
|---|---|---|
| **A0** | Pesquisador/Enriquecedor | Enriquecer o briefing |
| **A1** | Diagnóstico | Nota 0–100 do estado atual |
| **A2** | SEO | Palavras-chave |
| **A3** | Título | Título ≤60, keyword na frente |
| **A4** | Estrutura | Monta o anúncio juntando os construtores |
| **A5** | Descrição | Descrição completa e curta |
| **A6** | Ficha e Atributos | Atributos obrigatórios (filtros de busca) |
| **A7** | Medidas | Tabela de medidas + como medir |
| **A8** | Variações e SKU | Grade completa, SKU único, EAN por variação |
| **A9** | Benchmark | Comparação competitiva |
| **A10** | **Revisão Final** | **A trava** — barra o que não está pronto |
| **A11** | Otimizador | Melhorar anúncios **já ativos** |
| **A12** | Imagens | Imagens sugeridas |

**Composição observada:** `A1 → A2 → A9 → A4(A3,A5,A6,A7,A8,A12) → A10`, em **uma única
passada**, sem expor etapas intermediárias. **A11 não integra essa passada** — atua sobre
anúncios já publicados.

### 3.3 Saída (o Anúncio Gerado)

`notaDiagnostico`, `tituloOtimizado`, `palavrasChavePrincipais/Secundarias`,
`descricaoCompleta/Curta`, `fichaTecnica`, `tabelaMedidas`, `comoMedir`, `forma`,
`variacoes`, `imagensSugeridas`, `faq`, **`pendencias`**, **`vereditoA10`**,
**`motivoVeredito`**.

### 3.4 Até a publicação

O Anúncio Gerado aprovado segue para **BC5 Publicação** (Cap. 02) — clássico ou User
Products conforme a categoria. **A fronteira do Core Domain termina no veredito A10.**

---

## 4. Decisões (PASSO 2)

Decisões que a Esteira toma, descobertas no código:

| Decisão | Onde | Critério |
|---|---|---|
| **Diagnosticar** (nota 0–100) | A1 | Estado atual do anúncio |
| **Enriquecer** | A0 | Completar o briefing |
| **Gerar** conteúdo | A2–A8, A12 | Regras de cada agente |
| **Registrar pendência** | regras-mãe | Dado faltante → `⚠️ informação necessária: <campo>` — **nunca inventa** |
| **Validar preço** | regra-mãe | Margem ≥5% pela fórmula Zion |
| **Aprovar / Reprovar** | **A10** | Checklist de qualidade 100% ✅ |
| **Justificar** reprovação | A10 | `motivoVeredito` |

**A decisão central é a do A10:** aprovar **só** se o checklist inteiro passar. É o que torna
a Esteira uma linha com **portão**, não um gerador.

---

## 5. Critérios de qualidade

**O que caracteriza um anúncio excelente (checklist A10, 13 itens — evidência literal):**
título ≤60 com keyword na frente sem cor/tamanho · categoria correta · atributos
obrigatórios 100% · cor/material/gênero/tipo · descrição completa (benefícios, material,
cuidados, envio, garantia, embalagem) · descrição curta · tabela de medidas real + como medir
+ forma · variações completas (grade, SKU único, EAN por variação, mesmo anúncio) · **preço
com margem ≥5%** · capa 1:1 + detalhe + medidas · português correto e coerente · **sem
pendência** · **teste final: o cliente compra sem precisar perguntar nada**.

**O que caracteriza um anúncio ruim:** qualquer item do checklist não atendido → **reprovado**.

**Critérios redundantes:** **EVIDÊNCIA INSUFICIENTE** — os 13 itens parecem ortogonais; não
foi feita análise de sobreposição semântica entre eles.

**Critérios ausentes:** **EVIDÊNCIA INSUFICIENTE** para afirmar ausência — mas registra-se
que **o checklist avalia o conteúdo, não o desempenho** (não há critério de conversão
esperada, só de completude). É observação factual, não lacuna afirmada.

---

## 6. Pontos de atrito do cliente

Derivados do fluxo — **cada um ligado a evidência do comportamento**:

| # | Atrito | Evidência |
|---|---|---|
| **F1** | **O cliente não vê por que reprovou, item a item** | A10 emite `vereditoA10` + **um** `motivoVeredito`; o checklist de 13 itens é avaliado internamente mas **não** exposto por item |
| **F2** | **Pendências são uma lista plana** | `pendencias` = strings `⚠️ informação necessária: <campo>`; o cliente sabe *o quê* falta, não necessariamente *onde* preencher |
| **F3** | **Preço reprovado só é descoberto após rodar a Esteira** | A margem é uma **fórmula determinística** (regra-mãe), mas a reprovação por preço vem no fim, junto de tudo |
| **F4** | **O ganho de qualidade não é visível** | A1 dá nota do estado **inicial**; não há nota do resultado **produzido** — o cliente não vê o "antes → depois" |
| **F5** | **A passada é opaca** | Deliberadamente "sem expor etapas intermediárias" — bom para simplicidade, mas o cliente não entende o que a Esteira fez por ele |

---

## 7. Oportunidades de automação

O que o **sistema pode fazer sozinho**, hoje deixado ao cliente:

- **Checar preço antes de rodar** — a fórmula de margem não precisa de IA; pode rodar
  instantaneamente ao digitar o preço (evita F3).
- **Validar EAN por variação** — o checklist exige "EAN por variação"; a validação de dígito
  GTIN é determinística (VO `Ean` da Convergência 001) — pode sinalizar EAN inválido **antes**
  de rodar, alimentando as pendências.
- **Verificar completude do briefing** — os campos do `BRIEFING_MODELO` são conhecidos; o
  sistema pode avisar campos-chave ausentes antes de gastar uma chamada de IA.

## 8. Oportunidades para IA (copiloto)

**Perguntas que o cliente faz repetidamente** — e que a Esteira **já tem dados para
responder**:

| Pergunta do cliente | Dado que já existe |
|---|---|
| "Por que reprovou?" | `motivoVeredito` + checklist interno |
| "O que falta preencher?" | `pendencias` |
| "Meu preço está ok?" | fórmula de margem (regra-mãe) |
| "Meu anúncio melhorou?" | `notaDiagnostico` (inicial) — falta a do resultado |
| "Meu título está bom?" | regras do A3 (≤60, keyword, sem cor/tamanho) |

**Ações preventivas que evitariam erro antes da publicação:** todas as acima, aplicadas
**antes** do veredito final, transformam reprovação em correção guiada.

> **Princípio preservado:** nenhuma dessas oportunidades **muda o que a Esteira decide** —
> elas **expõem e antecipam** o que ela já decide. A identidade "produz + julga" fica intacta.

---

## 9. Melhorias incrementais

Cada uma é **aditiva** — acrescenta um campo, uma verificação ou uma exibição, **sem alterar
o comportamento de aprovar/reprovar**.

### M1 — Expor o checklist item a item
- **Problema (F1):** cliente vê só aprovado/reprovado + um motivo.
- **Benefício:** sabe exatamente quais dos 13 critérios passaram e quais faltaram.
- **Impacto:** alto — transforma "reprovado" em lista de ações.
- **Dependências:** campo aditivo no schema de saída (checklist avaliado por item).
- **Complexidade:** Média · **Risco:** Baixo (aditivo; veredito final inalterado).
- **Aceitação:** cada item do checklist retorna ✅/❌; `vereditoA10` permanece idêntico.
- **Indicador:** redução do nº de ciclos até aprovação.

### M2 — Pendências acionáveis
- **Problema (F2):** lista plana de pendências.
- **Benefício:** cada pendência aponta o campo do briefing a preencher.
- **Impacto:** alto — reduz esforço de descobrir onde agir.
- **Dependências:** `pendencias` já carrega o `<campo>`; mapear campo → tela.
- **Complexidade:** Baixa · **Risco:** Baixo.
- **Aceitação:** cada pendência exibe o campo e o link/lugar de preenchimento.
- **Indicador:** tempo entre reprovação e reenvio.

### M3 — Verificação determinística de preço (pré-Esteira)
- **Problema (F3):** preço reprovado só no fim.
- **Benefício:** feedback instantâneo ao digitar o preço, antes de rodar a IA.
- **Impacto:** alto — evita uma passada inteira reprovada por preço.
- **Dependências:** a fórmula de margem já existe como regra-mãe.
- **Complexidade:** Baixa · **Risco:** Baixo (cálculo puro, sem IA).
- **Aceitação:** preço abaixo do piso é sinalizado antes de rodar; a Esteira continua
  aplicando a mesma regra internamente.
- **Indicador:** queda de reprovações cujo motivo é preço.

### M4 — Nota do resultado (antes → depois)
- **Problema (F4):** só há nota do estado inicial.
- **Benefício:** o cliente vê o ganho de qualidade que a Esteira entregou.
- **Impacto:** médio — confiança e percepção de valor.
- **Dependências:** campo aditivo (nota do anúncio produzido).
- **Complexidade:** Média · **Risco:** Baixo.
- **Aceitação:** saída traz nota inicial **e** final; comportamento inalterado.
- **Indicador:** percepção de valor (qualitativo).

### M5 — Validação aditiva de EAN por variação
- **Problema (F1/automação):** EAN inválido só é notado tarde.
- **Benefício:** EAN com dígito verificador inválido é sinalizado como pendência antecipada.
- **Impacto:** médio — evita reprovação por variação inválida.
- **Dependências:** VO `Ean` (Convergência 001); **aditivo, não bloqueante**.
- **Complexidade:** Média · **Risco:** Médio — não pode virar bloqueio (mudaria comportamento).
- **Aceitação:** EAN inválido **sinalizado** em pendências; publicação inalterada.
- **Indicador:** redução de variações reprovadas por EAN.

### M6 — Copiloto de dúvidas do veredito
- **Problema (F1/copiloto):** perguntas repetidas ("por que reprovou?", "o que falta?").
- **Benefício:** respostas diretas montadas a partir de `motivoVeredito` + `pendencias` +
  margem — **sem nova chamada de IA**.
- **Impacto:** alto — reduz atrito e suporte.
- **Dependências:** M1, M2, M3 (fornecem os dados estruturados).
- **Complexidade:** Média · **Risco:** Baixo.
- **Aceitação:** as perguntas frequentes têm resposta derivada de dados já produzidos.
- **Indicador:** menos idas ao suporte/ajuda.

### M7 — Verificação de completude do briefing (pré-Esteira)
- **Problema (automação/F5):** o cliente roda a Esteira e descobre depois o que faltava.
- **Benefício:** aviso de campos-chave ausentes antes de gastar a chamada.
- **Impacto:** médio.
- **Dependências:** campos do `BRIEFING_MODELO`.
- **Complexidade:** Baixa · **Risco:** Baixo.
- **Aceitação:** campos essenciais ausentes são avisados antes de rodar; nada é bloqueado.
- **Indicador:** redução de passadas com pendências óbvias.

---

## 10. Priorização

| Melhoria | Impacto no cliente | Valor de negócio | Complexidade | Urgência | **Prioridade** |
|---|---|---|---|---|---|
| **M2 Pendências acionáveis** | Alto | Alto | Baixa | Média | **Alta** |
| **M3 Preço pré-Esteira** | Alto | Alto | Baixa | Média | **Alta** |
| **M1 Checklist item a item** | Alto | Alto | Média | Média | **Alta** |
| **M7 Completude do briefing** | Médio | Médio | Baixa | Baixa | **Média** |
| **M6 Copiloto do veredito** | Alto | Médio | Média | Baixa | **Média** *(depende de M1–M3)* |
| **M4 Nota antes→depois** | Médio | Médio | Média | Baixa | **Média** |
| **M5 EAN aditivo** | Médio | Médio | Média | Baixa | **Média** |

**Justificativa da ordem:** M2 e M3 são **Alta** por unirem alto impacto e baixa
complexidade — reduzem esforço imediatamente sem tocar a IA. M1 é **Alta** por impacto, mas
exige campo aditivo no schema (média complexidade). M6 é potente mas **depende** de M1–M3.
M4/M5 entregam valor real, porém secundário ao de reduzir reprovações.

---

## 11. Roadmap

Sequência incremental. Cada release é pequena, reversível, entregável isoladamente. **Nenhum
Big Bang, nenhuma reescrita.** As três primeiras **não tocam a IA** — são determinísticas ou
de exibição.

**Onda 1 — Reduzir esforço (sem tocar a IA):** R-M3 → R-M2 → R-M7
**Onda 2 — Transparência (campos aditivos):** R-M1 → R-M4
**Onda 3 — Copiloto e validação:** R-M6 → R-M5

---

## 12. Releases

### R-M3 — Verificação de preço antes de rodar *(o menor passo, alto valor)*
- **Objetivo:** sinalizar preço abaixo do piso ao digitá-lo, antes da Esteira.
- **Escopo:** um cálculo determinístico (fórmula de margem já existente) na tela de preço.
- **Aceitação:** preço abaixo de 5% é sinalizado; a Esteira segue aplicando a mesma regra;
  nenhum comportamento de aprovação alterado; suíte verde.
- **Rollback:** remover o aviso — a Esteira continua idêntica.
- **Estimativa:** **Baixa**.

### R-M2 — Pendências com destino
- **Objetivo:** cada pendência aponta o campo/tela a preencher.
- **Escopo:** exibição — mapear o `<campo>` das pendências para o local de edição.
- **Aceitação:** toda pendência exibe onde agir; o conteúdo das pendências (produzido pela IA)
  é inalterado.
- **Rollback:** voltar à lista plana.
- **Estimativa:** **Baixa**.

### R-M7 — Completude do briefing
- **Objetivo:** avisar campos-chave ausentes antes de rodar.
- **Escopo:** verificação dos campos do briefing na tela de entrada.
- **Aceitação:** aviso não bloqueante; o cliente ainda pode rodar; nada muda na Esteira.
- **Rollback:** remover o aviso.
- **Estimativa:** **Baixa**.

### R-M1 — Checklist item a item
- **Objetivo:** expor os 13 critérios com ✅/❌.
- **Escopo:** **campo aditivo** na saída da Esteira (resultado por item do checklist) + exibição.
- **Aceitação:** cada item retorna estado; `vereditoA10` e `motivoVeredito` permanecem;
  ausência do campo não quebra consumidores existentes.
- **Rollback:** ocultar a exibição; remover o campo aditivo.
- **Estimativa:** **Média**.

### R-M4 — Nota antes→depois
- **Objetivo:** exibir nota inicial e final.
- **Escopo:** campo aditivo (nota do resultado) + exibição.
- **Aceitação:** duas notas exibidas; comportamento inalterado.
- **Rollback:** remover o campo/exibição.
- **Estimativa:** **Média**.

### R-M6 — Copiloto do veredito
- **Objetivo:** responder as perguntas frequentes a partir de dados já produzidos.
- **Escopo:** composição de respostas de `motivoVeredito` + pendências (R-M2) + preço (R-M3)
  + checklist (R-M1) — **sem nova chamada de IA**.
- **Aceitação:** as perguntas do §8 têm resposta derivada; nenhuma nova decisão é tomada.
- **Rollback:** ocultar o copiloto.
- **Estimativa:** **Média** *(depende de R-M1–M3)*.

### R-M5 — EAN aditivo
- **Objetivo:** sinalizar EAN inválido como pendência antecipada.
- **Escopo:** VO `Ean` aplicado **de forma aditiva** na entrada de variações.
- **Aceitação:** EAN inválido **sinalizado**, **nunca bloqueado**; publicação idêntica; suíte
  verde. *(Critério explícito para conter o risco de virar bloqueio.)*
- **Rollback:** remover a validação.
- **Estimativa:** **Média**.

---

## 13. Conclusões

A Esteira já é um **Core Domain maduro e bem definido**: 13 agentes, um checklist de 13
critérios como trava, regras-mãe invioláveis (não inventar dado, margem ≥5%, título ≤60,
"comprar sem perguntar"). Sua identidade — **produzir o anúncio e julgar sua qualidade** — é
o diferencial competitivo, e **nenhuma melhoria aqui a altera**.

**Descoberta central:** a maior alavanca de valor **não é gerar mais** — é **expor melhor o
que a Esteira já sabe**. Ela avalia 13 critérios mas mostra um veredito; produz pendências
mas como lista plana; aplica uma fórmula de preço determinística mas só revela a reprovação no
fim. **O atrito do cliente está na opacidade, não na capacidade.** As melhorias de maior
prioridade (M1, M2, M3) apenas **tornam visível e antecipam** decisões que a Esteira já toma.

**Segunda descoberta:** três das sete melhorias **não tocam a IA** — são determinísticas
(preço) ou de exibição (pendências, checklist). São as de melhor relação valor/risco, e
respondem "sim" à pergunta-guia: tornam o cliente **mais rápido** (M2, M7), **mais seguro**
(M3, M5) e **mais bem-sucedido** (M1, M4, M6).

> **A Esteira não precisa de reescrita para evoluir. Precisa de transparência.** Cada release
> proposta expõe ou antecipa o que ela já faz — fortalecendo o núcleo sem tocar em sua
> identidade.

---

*Produzido em 21 de julho de 2026 · `HEAD d2b0fe5` · sem alteração de código, comportamento
ou arquitetura.*
