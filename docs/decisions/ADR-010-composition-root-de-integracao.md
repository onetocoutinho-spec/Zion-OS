# ADR-010 — Composition Root de Integração: conveniência de construção opcional

## Status

**Accepted** — 2026-07-24 · Platform v2

---

## Contexto

Para que uma superfície de produto acione uma Capability, ela precisa dispor de um Runtime e enviar-lhe uma intenção do usuário. Antes desta decisão, a Platform não normatizava **como** essa ligação deve ser expressa.

Na ausência de norma, cada superfície montava manualmente toda a cadeia de construção — a fábrica de decisões, o despachante e o aninhamento entre eles — além de declarar a porta de publicação de eventos e compor o artefato de intenção campo a campo. Essa montagem é idêntica em qualquer integração: nada nela varia além de qual Capability é acionada.

Disso decorriam dois problemas arquiteturais:

1. **A superfície carregava conhecimento que não contribui para compreender o fluxo**, misturado, no mesmo lugar, com o conhecimento que contribui — sem critério que os distinguisse.
2. **Não havia norma sobre o que deve permanecer visível** na superfície e o que pode ser encapsulado. Sem esse limite, qualquer simplificação futura seria indistinguível de uma ocultação da arquitetura.

O EXP-002 foi conduzido para determinar esse limite. Esta ADR registra a norma resultante.

---

## Decisão

A Platform v2 adota **parcialmente** o resultado do EXP-002, nos termos abaixo.

### O que passa a fazer parte da Platform

Uma **conveniência de construção** que recebe uma Capability e uma porta de publicação de eventos e devolve um Runtime pronto, encapsulando a fábrica de decisões, o despachante e o aninhamento entre eles. Ela vive fora das camadas congeladas e não altera nenhum contrato existente.

### O que permanece explícito na superfície

- a Capability acionada;
- o ato de envio da intenção ao Runtime;
- o identificador de missão e o payload;
- os campos `type` e `timestamp` da intenção do usuário;
- a porta de publicação de eventos (`ShellPort`);
- o Adapter da Capability.

### O que continua opcional

A conveniência de construção. O composition root explícito permanece válido, suficiente e suportado. Nenhuma superfície é obrigada a adotar a conveniência.

### O que permanece proibido

- Encapsular os campos `type` e `timestamp` da intenção do usuário.
- Fornecer a porta de publicação de eventos por meio de valor implícito.
- Conveniências que removam o Runtime, a Decision ou a intenção do usuário do ponto de chamada.
- Qualquer conveniência que exija alteração das camadas congeladas: Runtime, Mission, Shell, Adaptive Intelligence, Capabilities, Adapters e serviços.

### O que permanece em aberto

Fora da norma até nova decisão arquitetural:

- qualquer conveniência que incida sobre o Adapter;
- a natureza da porta de publicação de eventos em superfícies que consomem feedback;
- a aplicação da conveniência a uma segunda superfície de produção.

---

## Consequências

- Simplificação do composition root nas superfícies que adotarem a conveniência.
- Preservação da transparência arquitetural no ponto de chamada.
- Manutenção da opcionalidade: dois caminhos de integração permanecem válidos.
- Inexistência de mudanças no Runtime.
- Inexistência de mudanças em Capabilities e Adapters.
- Inexistência de mudanças na Adaptive Intelligence.
- Inexistência de mudanças na Mission e na Shell.
- Comportamento de execução inalterado.
- Existência de um limite normativo explícito entre o que pode ser encapsulado e o que deve permanecer visível.
- Os itens em aberto permanecem fora da norma até nova decisão arquitetural.

---

## Referências

- EXP-002 — Experimental Design
- EXP-002 — Execution Report
- EXP-002 — Architectural Decision Review
