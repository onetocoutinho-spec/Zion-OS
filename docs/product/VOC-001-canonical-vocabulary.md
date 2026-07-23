# VOC-001 — Zion Canonical Vocabulary

> Documento normativo de linguagem: **uma palavra, um significado; um
> conceito, um nome.** Nenhum documento futuro redefine um termo daqui —
> instancia-se, jamais se redefine. 34 conceitos oficiais · 3 conflitos
> resolvidos · 6 termos abolidos.

## Verbetes fundamentais

| § | Termo | Definição canônica | Nunca significa |
|---|---|---|---|
| 1 | **Parte** | quem participa do comércio de forma imputável | usuário do software; papel de acesso |
| 2 | **Produto** | o referente físico sobre o qual tudo se alega | anúncio, cadastro, SKU, linha de planilha |
| 3 | **Verdade** | a coleção viva de alegações imputáveis sobre um Produto, testada pela realidade, com lacunas declaradas | "os dados", a ficha, certeza absoluta |
| 4 | **Alegação** | um fato afirmado sobre um Produto, com Origem e história | campo de formulário; opinião |
| 5 | **Expressão** | a Verdade traduzida para a língua de um Canal e de um público; representa, jamais altera | a verdade; texto editável isolado |
| 6 | **Oferta** | uma Expressão unida a um Compromisso comercial: a promessa posta à venda | produto; desconto; a Oferta de Sugestão do motor (C1) |
| 7 | **Presença** | a Oferta viva dentro de um Canal, com identidade, estado e saúde locais | cadastro; cópia do produto |
| 8 | **Canal** | jurisdição de expressão e fonte de veredito: dita língua, leis e público — nunca a Verdade | integração; API. Subtipos: marketplace, ERP, **Porta** (canal na Chegada) |
| 9 | **Compromisso** | a decisão que assume responsabilidade: preço, termos, o "vai", a autonomia | fato; atributo; configuração |
| 10 | **Veredito** | a resposta da realidade a uma promessa (aceite, rejeição, venda, devolução, pergunta, avaliação) | erro de sistema; log; "feedback" |
| 11 | **Missão** | a unidade universal de trabalho: uma decisão irredutível, preparada, endereçada e rastreada | tarefa, ticket, notificação, alerta |
| 12 | **Combinado** | delegação viva: autonomia concedida pelo Cliente sobre um assunto, com evidência, escopo e volta | configuração, toggle, permissão |

## Demais conceitos oficiais

**Domínio/Operação:** Operação (o conjunto de estoque, compromissos, execução
e memória de uma Parte que vende) · **Cliente** (a Parte que contrata a Zion)
· **Comprador** (quem compra no Canal) · Fornecedor · Estoque · Identidade ·
Família · Evidência crua · Retificação · Completude (relativa a
propósito×canal) · Lacuna · Origem · **Segunda Verdade** (o que a Operação
aprende sobre si — sujeita às mesmas leis) · **Endereçado** (a Parte dona da
decisão de uma missão).

**UX/Produto Zion:** Ciclo (Chegada→Completude→Preparação→Decisão→Presença→
Evolução) · Decolagem (F4) · Vigília (F5) · as 5 áreas — **Hoje · Catálogo ·
Anúncios · Pulso · Zion** · Catálogo Vivo · Vitrine · Fila · Conversa · Diário
· Resumo (07:50) · Lente (multi-operação) · Silêncio · **Os 4 Motivos**
(dinheiro em risco · operação travada · oportunidade com prazo · consentimento
obrigatório).

**Verbos oficiais:** alegar · retificar · completar · expressar · prometer ·
publicar · manter · atender · dispensar · combinar · revogar · assinar ·
arbitrar · aprender.

## Grafo conceitual

```
PARTE ─possui─► OPERAÇÃO ─mantém─► ESTOQUE
  │ alega                │ assume
  ▼                      ▼
VERDADE ◄─referencia─ COMPROMISSO
  │ traduz-se (por CANAL)   │ decide
  ▼                         │
EXPRESSÃO ─une-se─► OFERTA ─vive como─► PRESENÇA (no CANAL)
                                            │ recebe
                                            ▼
        SEGUNDA VERDADE ◄─alimenta─ VEREDITO (do COMPRADOR/CANAL)
              └─merece─► COMBINADO ─autoriza─► execução autônoma
  (transversal: MISSÃO — como qualquer decisão chega ao humano)
```

## Regras linguísticas

| ❌ Nunca | ✅ Sempre |
|---|---|
| "cadastro do marketplace" | **Presença** |
| "editar o anúncio" | **retificar a Verdade** ou **atualizar a Expressão**, conforme |
| "o cliente perguntou" (comprador) | **o Comprador perguntou** |
| "sincronizar produtos" | **traduzir para o Canal** / **manter a Presença** |
| "dados faltando" | **Lacunas** |
| "a IA decidiu" | **a Zion executou o Combinado** |
| "preço do produto" | **preço da Oferta** |
| "notificação" | **Conversa** ou **Missão**, conforme |

## Interface × Interno

**O Cliente pode ver:** produto, *anúncio* (=Presença, na voz dele), *loja*
(=Operação), Combinado, Diário, Pulso, Hoje, canal/marketplace, comprador,
estoque, preço, "o que falta". **Jamais vê:** Verdade, Alegação, Expressão,
Presença (a palavra), Veredito, Parte, Compromisso, Lacuna, Segunda Verdade —
e nenhum termo do motor (Pattern, Confidence, Knowledge, Delegation, Journal,
Outcome). *Na interface a Verdade se diz "o que sabemos sobre o produto"; o
Veredito se diz pelo fato ("o ML recusou porque…").*

**Registros internos:** Domínio → documentação/modelagem · Motor DI →
`docs/zion-os/` (estrato próprio, termos qualificados) · UX → design/produto ·
Ontologia de tokens → cadeia `system/`.

## Conflitos resolvidos

- **C1 · "Oferta"** — domínio comercial × motor DI (fato da ADR-001, tabela
  `ofertas`). Resolução: em documentação, o termo do motor é sempre
  qualificado — **"Oferta de Sugestão"**; o do domínio é absoluto. Código não
  muda.
- **C2 · "Completude"/"Contexto"** — homônimos na Ontologia de tokens; a regra
  de estratos (PX-006) cobre: qualificar quando cruzarem.
- **C3 · "Cliente"** — a ambiguidade mais perigosa (lojista × comprador).
  **Norma: Cliente = quem contrata a Zion; Comprador = quem compra no canal.**
  Sem exceções.

## Termos abolidos

~~acervo~~ (→Estoque) · ~~cadastro~~ (→Verdade ou Catálogo Vivo) ·
~~ticket/tarefa~~ (→Missão) · ~~dashboard~~ (→Pulso) · ~~notificação~~
(→Conversa/Missão) · ~~sincronização de conteúdo~~ (→tradução/manutenção).

## Veredito

Nenhum conceito fundamental sem nome (o último — o dono da decisão — foi
batizado **Endereçado**, por extração). Nenhuma palavra oficial ambígua após
C1–C3. Completo para a fundação existente: **34 conceitos, o menor conjunto
que explica integralmente PX + UX + DOM.**
