# Adaptive Intelligence Layer

**Verdade que possui:** a observação de decisões do cliente e sua futura
transformação em conhecimento reutilizável.

**Estado atual — R-DJ-1:** apenas a **infraestrutura mínima**. Contém o modelo
canônico `Decision`, o Port `DecisionJournal` (fire-and-forget) e a implementação
ativa `NoOpDecisionJournal` (descarta tudo). **Não observa nada ainda.**

**Fronteira (observador lateral).** Este módulo é **completamente isolado**:
nenhum arquivo fora dele o importa. A observação real só começa quando um serviço
chamar `registrarDecisao` — o que é a Release **R-DJ-2**, não esta.

**Invariante.** `registrarDecisao` é fire-and-forget: retorna `void`, **nunca
lança**, e nenhuma correção do cliente depende dela. Remover este módulo por
inteiro devolve o sistema ao estado anterior sem resíduo.

**O que NÃO lhe pertence (ainda):** persistência, tabelas, migrações, eventos,
Pattern Detector, Suggestion Engine, sugestões, automações — releases futuras.

Referências:
`docs/zion-os/engineering/RFC-AIL-001-decision-journal.md`,
`docs/zion-os/engineering/RFC-AIL-002-canonical-learning-model.md`,
`docs/zion-os/engineering/IMP-AIL-001-rdj1-implementation-plan.md`.
