# GLOSSARY — Termos ambíguos e sua leitura canônica

> Nascido na AR-001 (Parte 5). Complementa a Linguagem Ubíqua da RFC-AIL-002 §10
> (que permanece canônica para o núcleo da AIL). Aqui vivem apenas os termos que
> a revisão encontrou com mais de um significado. **Uma fonte canônica por
> conceito; este arquivo só aponta, nunca redefine.**

| Termo | Significados em uso | Leitura canônica |
|---|---|---|
| `support` / `suporte` / `ocorrencias` | RFC (support) · docs (suporte) · código+tabela (`ocorrencias`) | O mesmo número: \|DecisionIds distintos\|. Código/banco usam `ocorrencias`; prosa usa suporte |
| **`confiança`** | (1) escada da AIL (`ConfidencePadrao`) · (2) `confiança do custo` no Produto (S-11) · (3) `confianca` do `Autor` adormecido (E5.1) | Três conceitos distintos. Em prosa da AIL, "Confidence". **Atenção ao acordar E5.1**: renomear ou qualificar antes de conviverem |
| `empresa` / `clienteId` / tenant | AIL usa `empresa`; domínio usa `clienteId`; docs usam tenant | Um conceito: a fronteira de isolamento. Producers preenchem `Decision.empresa` com o `clienteId` |
| `emergente` | estado do Pattern (`EstadoPadrao`) e estado do slot (`EstadoSlot`) | Dois eixos distintos, tipos distintos protegem; em prosa, qualificar ("slot emergente") |
| `aprovado` | veredito A10 (sistema) · status do anúncio (humano) · aceite do ML (ambiente) | Três aprovações de três autoridades (PR-008/010); nunca usar sem qualificar |
| `autor` | `Decision.autor` (string; anônima na prática — S-36) · `Autor{tipo,id,agenteCodigo,confianca}` (fundação E5.1 — S-35) | Duplicidade registrada; resolução pertence ao ciclo E5.1 (exigirá decisão) |
| Raízes de docs | `docs/engineering/` = programa de evolução (backlog, seeds, reports, reviews) · `docs/zion-os/engineering/` = arquitetura congelada (RFCs, ADRs, planos de release AIL) | Ambas canônicas, escopos distintos |
| "ledger de Outcomes" | RFC-AIL-005 §4/§9 | **Projeção** `f(ofertas × Journal)` — definido por ADR-001; nunca um armazém |
| "efêmera" (Suggestion) | RFC-AIL-002 §4/§10 | Vida da **oferta** (pontual, um destino); o **fato** da oferta é histórico — ADR-001 |
