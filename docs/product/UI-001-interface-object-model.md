# UI-001 — Interface Object Model

> Os objetos permanentes da interface — o contrato entre experiência,
> wireframes e frontend. **Princípio absoluto:** páginas não existem no
> modelo; as áreas são cômodos que aproximam objetos. Inclui a Emenda
> VAL-001·E2 (o 11º objeto: Regra).

## O catálogo (11 objetos primários + 3 virtuais + constituintes)

| Objeto | Natureza | Dono | Visibilidade | Essência |
|---|---|---|---|---|
| **Missão** | transitória | Zion propõe · Endereçado decide | Fila; Diário depois | nasce de Lacuna/Veredito/lote/4 Motivos **ou encomenda do Cliente (E3)**; expira declarando-se; responde-se, nunca se edita |
| **Conversa** (⊃ Mensagens: Resumo, Percepção, Pedido, Prestação) | permanente | Cliente ⇄ Zion | área Zion; atenção só pelos 4 Motivos | a voz; some da atenção para o Diário |
| **Combinado** | permanente | **Cliente** concede | área Zion; citado nos atos | nasce de proposta aceita; **revoga com um toque**; nunca some do histórico |
| **Regra** *(Emenda E2)* | permanente | **Cliente** | área Zion; citada nos atos que limita | **compromisso paramétrico e reutilizável** (margem mínima, piso/teto…); os Combinados executam DENTRO de Regras; L9 preservada — regra é decisão, nunca fato |
| **Diário** (⊃ Registros) | histórico imutável | Operação | sob demanda; alvo de todo "por quê?" | só cresce; erros com o mesmo destaque; ressalva E7 (lei do território) |
| **Produto** (⊃ Lacunas, Família, Evidência) | permanente | Operação | Catálogo; dentro de missões | verdade retifica-se com história; Zion registra alegações com origem |
| **Anúncio** | derivado, recomputável (L6) | Operação (conteúdo) · Canal (registro) | Vitrine (na missão) e Anúncios | `em preparo→em revisão→no ar→pausado→recusado`; pode estar **honestamente defasado** (E6) |
| **Canal** | permanente | Cliente (grant) · Canal (leis) | Zion/onboarding | conectar/revogar são atos do Cliente |
| **Loja** (Operação) | permanente | Cliente | via Lente (2+) | — |
| **Estado** | virtual, derivado | ninguém | Hoje (frase) · Pulso (profundidade) | inclui a expectativa honesta; jamais editável |
| **Lacuna** | transitória | a verdade do Produto/Anúncio | etiqueta âmbar | fato ausente + propósito bloqueado; morre respondida; Zion jamais preenche |

**Virtuais:** Fila (missões por prioridade E8) · Lote (a forma plural da
missão) · Lente (dormente com 1 loja).

## Classificação

Trabalho (Missão+Fila+Lote) · Relação (Conversa, Combinado, **Regra**) ·
Prova (Diário) · Propriedade (Produto, Anúncio, Canal, Loja) · Leitura
(Estado+Lente) · Ponte (Lacuna).

## O grafo (direções decididas)

O Diário **registra** a Missão (testemunha universal) · a Conversa **gera** o
Combinado, que **referencia** a Conversa (a evidência do grant) · o Combinado
**executa dentro** de Regras · o Resumo **referencia** missões, nunca as
contém · o Anúncio **referencia** o Produto (deriva da verdade — L6) · a
Lacuna **origina** Missões · o Estado **deriva** de tudo.

## Atenção · Escala · Invariantes

Disputam atenção: **só** Missão (posição na fila) e Mensagem (4 Motivos).
Todos os demais aguardam em silêncio; nenhum objeto porta badge. Escala:
mesmos objetos, mais instâncias; só Lente (materializa) e Fila (Endereçado/
equipe) mudam de comportamento. Jamais desaparecem: Missão, Conversa, Diário,
Combinado — o núcleo da relação.

## Teste Apple

Núcleo irredutível: **Missão(+Fila) · Conversa · Diário · Combinado · Produto
· Anúncio · Canal · Estado** (a Regra junta-se ao núcleo de Relação por E2).
Remover qualquer um destrói o produto.

## Contrato para wireframes (responsabilidades)

**Missão:** as 6 partes; tempo estimado; "agora não" sem culpa; o Endereçado
quando não for o leitor. **Fila:** ordem com razão; contagem em palavras;
jamais badges. **Conversa/Mensagem:** primeira pessoa; ação de um toque; "por
quê? →". **Combinado:** a evidência que o mereceu; escopo; desligar de um
toque. **Regra:** o parâmetro em linguagem de gente ("nunca vender abaixo de
15% de margem"); quem a definiu e quando; edição = novo compromisso com
histórico. **Diário:** quem-o quê-quando-por quê; erros com o mesmo destaque;
desfazer no desfazível. **Produto:** o que sabemos + Lacunas com destino +
quem disse (a um toque) + história discreta. **Lacuna:** fato ausente +
propósito + caminho mais curto. **Anúncio:** como o Comprador verá; estado em
palavras; rastreável; jamais formulário cru. **Canal:** saúde em uma frase;
conectar/revogar como atos. **Estado:** UMA frase primeiro; profundidade só
por escavação; sem nota, sem score. **Lente:** visível quando ativa; troca em
um gesto.

> **Nenhum wireframe criará um objeto novo. Todo wireframe apenas materializa
> estes objetos, sob estes contratos.**
