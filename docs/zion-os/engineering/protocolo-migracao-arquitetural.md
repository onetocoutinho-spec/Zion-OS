# Protocolo de Migração Arquitetural

> **Origem.** Este protocolo **não foi projetado — foi extraído**. Cada etapa, regra e
> verificação abaixo corresponde a algo efetivamente executado nas **Releases 002 e 003**.
> Nada aqui é hipotético, antecipatório ou inventado.
>
> **Alcance.** Aplica-se a toda migração de responsabilidade da implementação legada para
> a arquitetura modular do Zion OS.
>
> **Não altera** arquitetura, governança, Release Engineering nem ADRs. É procedimento de
> engenharia, subordinado ao Padrão de Release Engineering.

---

## Princípios

1. **Comportamento é preservado por evidência, nunca por presunção.**
2. **Cada migração estabelece sua própria linha de base** — medida **antes** de qualquer
   alteração, e reexecutada depois.
3. **A quantidade de evidências é proporcional ao risco da responsabilidade.**
4. **Escopo mínimo.**
5. **Uma responsabilidade por migração.**
6. **Nenhuma exceção silenciosa.**
7. **Toda conclusão deve ser sustentada por evidência verificável.**
8. **Evidência ambígua não é evidência.** *(Origem: na Release 003, dois comandos de
   coleta produziram saída poluída e um falso positivo; foram refeitos até produzirem
   resultado inequívoco.)*
9. **O commit pode divergir da árvore de trabalho.** *(Origem: incidente E1 da Release
   003 — a lição central deste protocolo.)*

---

# FASE 1 — Verificação de elegibilidade

**Objetivo.** Confirmar que a responsabilidade **pode** ser migrada agora.

**Entradas.** O Mapeamento Arquitetural; as decisões de governança vigentes; o Plano de
Refatoração.

**Execução.**
- Localizar a responsabilidade no Mapeamento (arquivo, funções, módulo destino).
- Confrontar com **bloqueios de governança vigentes**, lendo sua redação exata e
  verificando se ela alcança esta responsabilidade.
- Verificar se existe **linha de base disponível** (testes, ou outra evidência
  comportamental mensurável).
- Identificar **todos os consumidores**, por busca no código — nunca de memória.

**Saídas.** Decisão de prosseguir ou interromper, com fundamento registrado.

**Evidências obrigatórias.**
- Citação do bloqueio de governança e por que alcança (ou não) esta responsabilidade.
- Lista de consumidores obtida por busca.
- Confirmação de existência (ou ausência) de linha de base.

**Critérios de aprovação.** Nenhum bloqueio vigente a alcança **e** existe linha de base
mensurável.

**Critérios de interrupção.** Um bloqueio a alcança; ou não existe linha de base — nesse
caso a migração **não começa**, pois não haveria como comprovar preservação.

> *Observado na Release 003:* verificou-se que o bloqueio de gestão cobria apenas
> `mercadolivre.ts` e `publicar/route.ts`; R9 estava fora deles e possuía testes próprios.
> A elegibilidade foi concluída por leitura da redação, não por interpretação.

---

# FASE 2 — Estabelecimento da linha de base

**Objetivo.** Medir o comportamento atual **antes** de qualquer alteração.

**Entradas.** A responsabilidade elegível e seus consumidores.

**Execução.**
- Registrar a **assinatura pública** (símbolos exportados).
- Executar os **testes da responsabilidade** e registrar os números.
- Executar os **testes dos consumidores que serão alterados** e registrar os números.
- Executar o **build**.
- Registrar convenções relevantes do projeto que a migração precisará preservar.

**Saídas.** Um conjunto de números e símbolos registrados, contra o qual o resultado
final será comparado.

**Evidências obrigatórias.**
- Assinatura pública, listada.
- Resultado dos testes da responsabilidade (total / passou / falhou).
- Resultado dos testes de cada consumidor a ser alterado.
- Resultado do build.

**Critérios de aprovação.** Todos os testes passam **antes** da migração e os números
estão registrados.

**Critérios de interrupção.** Algum teste já falha antes da migração — a linha de base
está corrompida e a preservação não poderia ser demonstrada.

> *Observado na Release 003:* mediram-se **dois** conjuntos — 18 testes da
> responsabilidade e 9 do consumidor cujo import seria alterado. A escolha do segundo
> conjunto foi deliberada: é o único arquivo que a migração modificaria.

---

# FASE 3 — Execução da migração

**Objetivo.** Mover a responsabilidade preservando conteúdo e convenções.

**Entradas.** Linha de base registrada.

**Execução.**
- Mover os arquivos com **`git mv`** — nunca copiar-e-apagar.
- **Migrar o teste junto com o código**, preservando a convenção de teste ao lado da
  implementação.
- Atualizar **apenas os imports necessários**.
- Preservar as **convenções do arquivo consumidor**: forma do caminho (relativo ou alias)
  e **extensão explícita** quando o projeto a exigir.

**Saídas.** Árvore de trabalho com a responsabilidade no destino e consumidores
atualizados.

**Evidências obrigatórias.**
- Confirmação de que o Git registrou **rename** (não delete + add).
- **Similaridade do rename** — 100% é a prova de que nenhum byte mudou.
- Número de linhas alteradas em cada consumidor.

**Critérios de aprovação.** Rename registrado com similaridade 100% e alteração mínima
nos consumidores.

**Critérios de interrupção.** Similaridade inferior a 100% sem explicação; ou necessidade
de alterar lógica para concluir o movimento.

> *Observado na Release 003:* preservou-se a extensão `.ts` no import porque os testes
> executam sob TypeScript nativo; e manteve-se caminho relativo porque o consumidor usava
> exclusivamente relativos, embora exista alias no projeto.

---

# FASE 4 — Auditoria do commit *(etapa obrigatória)*

**Objetivo.** Garantir que o **commit** contém exatamente o que a árvore de trabalho
demonstra.

**Entradas.** Commit produzido, ainda **não publicado**.

**Execução.**
- Listar os arquivos **contidos no commit**.
- Comparar com os arquivos **esperados pelo escopo**.
- Verificar se restou algo **modificado fora do commit**.
- Inspecionar o **conteúdo commitado** dos consumidores, confirmando que a atualização
  entrou.

**Saídas.** Commit auditado — ou corrigido antes de qualquer publicação.

**Evidências obrigatórias.**
- Lista de arquivos do commit.
- Estado da árvore de trabalho após o commit.
- Conteúdo commitado do trecho alterado em cada consumidor.

**Critérios de aprovação.** Arquivos esperados presentes; nenhum ausente; nenhum
excedente; diff compatível com o escopo; árvore consistente com o commit.

**Critérios de interrupção.** Divergência entre commit e árvore. Se o commit **ainda não
foi publicado**, corrigir por emenda e reauditar. Se **já foi publicado**, interromper e
tratar como incidente.

> **Esta fase existe por causa de um fato, não de uma suposição.** Na Release 003, o
> comando de staging abortou ao encontrar um caminho que já não existia e **não incluiu a
> atualização do consumidor**. O commit resultante continha os renames sem o import
> corrigido — um estado que **não compilaria**. Foi detectado exatamente aqui, corrigido
> por emenda antes da publicação, e nunca chegou à linha principal.

---

# FASE 5 — Validação pós-migração

**Objetivo.** Demonstrar que o comportamento não mudou.

**Entradas.** Commit auditado; linha de base da Fase 2.

**Execução.**
- Reexecutar **exatamente** os mesmos testes da Fase 2.
- Reconferir a **assinatura pública** no novo local.
- Verificar que **nenhuma referência ao caminho antigo** permanece no código.
- Executar o **build**.
- Comparar cada medida com a linha de base, **número a número**.

**Saídas.** Tabela antes/depois, com toda diferença explicada.

**Evidências obrigatórias.**
- Resultado dos testes, comparado à linha de base.
- Assinatura pública, comparada.
- Ausência de referências órfãs.
- Build.

**Critérios de aprovação.** Todos os números idênticos à linha de base; assinatura
idêntica; build íntegro.

**Critérios de interrupção.** Qualquer diferença não explicada por evidência.

> *Observado na Release 003:* a verificação de referências órfãs produziu um falso
> positivo; ao refazê-la corretamente, revelou-se que as ocorrências eram um import
> legítimo do mesmo diretório e um **comentário desatualizado**. O comentário foi
> **registrado como achado e não corrigido**, para não quebrar a similaridade de 100% nem
> ampliar o escopo declarado.

---

# FASE 6 — Release

**Objetivo.** Institucionalizar a migração pelo processo oficial.

**Entradas.** Commit auditado e validado.

**Execução.** Seguir o **Padrão de Release Engineering** — publicação, Integration Review,
merge, verificação pós-merge e registro.

**Saídas.** Migração integrada e registrada.

**Evidências obrigatórias.** As da Fase 5, mais: escopo entregue, divergência com a linha
principal, verificação pós-merge e parecer.

**Critérios de aprovação.** Os do Padrão de Release Engineering.

**Critérios de interrupção.** Os do Padrão de Release Engineering.

---

# Fluxograma operacional

```
FASE 1  Elegibilidade
        bloqueio alcança? ──sim──> INTERROMPER
        existe linha de base? ──não──> INTERROMPER
              │ ok
              ▼
FASE 2  Linha de base (ANTES de tocar em qualquer coisa)
        algum teste já falha? ──sim──> INTERROMPER
              │ ok
              ▼
FASE 3  Migração  (git mv · teste junto · imports mínimos · convenções)
        similaridade < 100% sem explicação? ──sim──> INTERROMPER
              │ ok
              ▼
FASE 4  AUDITORIA DO COMMIT   ◄── etapa que interceptou E1
        commit diverge da árvore? ──sim──> não publicado: EMENDAR e reauditar
                                        └─ publicado: INTERROMPER (incidente)
              │ ok
              ▼
FASE 5  Validação pós-migração (reexecutar a MESMA linha de base)
        alguma diferença sem explicação? ──sim──> INTERROMPER
              │ ok
              ▼
FASE 6  Release (Padrão de Release Engineering)
              │
              ▼
        INTEGRADA E REGISTRADA
```

---

# Checklist operacional

- ☐ Responsabilidade localizada no Mapeamento Arquitetural
- ☐ Bloqueios de governança lidos e confrontados com esta responsabilidade
- ☐ Consumidores identificados **por busca no código**
- ☐ Linha de base existente confirmada
- ☐ Assinatura pública registrada
- ☐ Testes da responsabilidade executados e números registrados
- ☐ Testes dos consumidores a alterar executados e números registrados
- ☐ Build executado antes da migração
- ☐ Convenções do projeto identificadas (forma do caminho, extensão)
- ☐ Arquivos movidos com `git mv`
- ☐ Teste migrado junto com o código
- ☐ Imports atualizados — apenas os necessários
- ☐ Auditoria do commit realizada
- ☐ Linha de base reexecutada e comparada
- ☐ Build executado após a migração
- ☐ Release conduzida pelo padrão oficial

---

# Checklist de auditoria do commit

- ☐ Arquivos esperados **presentes** no commit
- ☐ Nenhum arquivo esperado **ausente**
- ☐ Nenhum arquivo **excedente**
- ☐ Diff **compatível com o escopo** declarado
- ☐ Commit **consistente** — contém a migração completa
- ☐ Árvore de trabalho **consistente** com o commit
- ☐ Consumidores **atualizados dentro do commit** *(verificar o conteúdo commitado, não
  o da árvore)*

> O último item é o que interceptou E1. **Verificar a árvore não substitui verificar o
> commit.**

---

# Checklist de preservação de comportamento

- ☐ Mesma **assinatura pública** — símbolos exportados idênticos
- ☐ Mesma **implementação** — rename com similaridade 100%
- ☐ Mesmo **resultado dos testes** — números idênticos à linha de base
- ☐ Mesma **compilação** — build íntegro antes e depois
- ☐ Mesmos **consumidores** — apenas caminhos de import alterados
- ☐ Nenhum **log**, telemetria ou API pública tocado
- ☐ Nenhuma **referência órfã** ao caminho antigo

> As evidências devem ser **independentes entre si**. Similaridade de arquivo, símbolos
> exportados, execução de testes e compilação medem coisas diferentes; a convergência
> delas é o argumento.

---

# Critérios para interromper uma migração

- Bloqueio de governança alcança a responsabilidade.
- Não existe linha de base mensurável.
- Algum teste já falha **antes** da migração.
- Similaridade do rename inferior a 100% sem explicação.
- Foi necessário **alterar lógica** para concluir o movimento.
- Commit diverge da árvore de trabalho **e já foi publicado**.
- Qualquer diferença pós-migração não explicada por evidência.
- Evidência **ambígua** que não pôde ser refeita de forma inequívoca.

---

# Critérios para aprovar uma migração

- Elegibilidade confirmada por leitura da redação dos bloqueios.
- Linha de base medida **antes** e reexecutada **depois**, com números idênticos.
- Rename com similaridade **100%**.
- Assinatura pública **inalterada**.
- Consumidores alterados **apenas** em caminhos de import.
- Build íntegro antes e depois.
- Commit auditado, sem divergência com a árvore.
- Escopo entregue **idêntico** ao declarado.
- Exceções e achados **registrados**, nenhum silencioso.

---

# Relação com o Padrão de Release Engineering

Os dois documentos são **complementares e hierárquicos**:

- O **Padrão de Release Engineering** rege **como qualquer alteração entra no
  repositório** — tipos de release, gates, papéis, evidências, registro.
- Este **Protocolo de Migração Arquitetural** rege **como uma responsabilidade é movida**
  antes de chegar a esse ponto.

**As Fases 1 a 5 acontecem antes** do fluxo de release. **A Fase 6 é** o fluxo de release,
com tipo declarado **Refatoração**.

O protocolo **não substitui nem altera** o Padrão: ele **alimenta** seus gates com as
evidências específicas de migração. Onde o Padrão exige "impacto funcional" e
"reversibilidade", este protocolo diz **exatamente quais medidas** produzem essas
evidências no caso de uma migração.

Em caso de conflito, **prevalece o Padrão de Release Engineering**.

---

## Nota sobre proporcionalidade

R9 foi o caso mais favorável possível: função pura, sem dependências de saída, coberta por
testes próprios. O protocolo foi validado nessas condições.

O princípio 3 — *a quantidade de evidências é proporcional ao risco* — implica que
responsabilidades sem testes próprios, com múltiplos consumidores ou entrelaçadas a
funções maiores exigirão **evidência adicional**, definida caso a caso na Fase 1. Este
protocolo estabelece o **mínimo**, não o suficiente para todos os casos.
