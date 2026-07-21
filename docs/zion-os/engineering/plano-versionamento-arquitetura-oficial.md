# Plano de Versionamento da Arquitetura Oficial

> **Natureza.** Procedimento de **configuração e governança**. Não escreve arquitetura,
> não altera código, não revisa conteúdo. Seu único objetivo é fazer o **patrimônio
> intelectual oficial do Zion OS** passar a integrar permanentemente o repositório.
>
> **Premissa de governança.** Versionamento **não é conveniência — é requisito**.
> Nenhuma decisão arquitetural pode depender da existência de um único computador.
>
> **Base factual.** O inventário do §1 foi verificado no repositório. Nenhuma afirmação
> é suposição.

---

## 0. Achado crítico de inventário

Antes do plano, um fato que **altera a estrutura proposta** e precisa ser registrado:

**Já existe `docs/architecture/` rastreado na linha principal**, contendo uma
**arquitetura anterior** do projeto — com documentos de domínio de negócio, produto
mestre, adaptador de marketplace, SDK de conector, barramento de eventos, motor de
marketplace, roteiro de execução e conformidade arquitetural.

**Consequência.** Versionar a Constituição do Zion OS dentro de `docs/architecture/`
colocaria **duas arquiteturas distintas no mesmo diretório**, sem qualquer indicação de
qual é a vigente. Isso contraria diretamente a lei do Manifesto — *"a arquitetura possui
uma única versão oficial"* — e produziria, no próprio repositório, a ambiguidade que
toda a Governança existe para impedir.

**Tratamento neste plano.** A arquitetura oficial recebe um **espaço próprio e
inequívoco**; o material anterior **permanece intocado**. A questão de qual é o status
daquele material (vigente? superado? histórico?) é **legítima e relevante**, mas
**não é resolvida aqui** — resolvê-la exigiria revisar conteúdo, o que este plano proíbe
(§6). Fica **registrada como pendência de governança**.

---

## 1. Inventário Oficial

**27 documentos** encontram-se em disco local, **nenhum versionado**. Classificação:

### Normativos — regem a plataforma; só mudam por ADR aprovado

**Constituição (10)**
Manifesto Arquitetural · Especificação Arquitetural · Modelo de Domínio · Máquina de
Estados · Taxonomia de Sinais · Política de Priorização · Arquitetura da IA · Contrato
de Eventos · Modelo de Consistência e Fronteiras · Governança Arquitetural

**Organização (3)**
Arquitetura do Sistema · Arquitetura dos Módulos · Glossário Arquitetural

**Arquitetura dos Módulos (3)**
Operation Center · Publication · Integration

### Decisões — normativas em efeito; autorizam alteração

**Governança (2)**
ADR-006 (idempotência de Size Charts) · ADR-007 (deliberação da RFC-001)

> **Situação particular do ADR-006:** é o **único** documento aprovado que já está sob
> versionamento — porém apenas na branch da Sprint 0, ainda não integrada. Ver §3.

### Evidências — registram; não regem

**Engenharia e Governança (4)**
Blueprint 001 (Publicação Idempotente) · Blueprint 002 (Estoque Indisponível) ·
RFC-001 (Ciclo de Vida da Publication) · Revalidação Arquitetural do ADR-007

### Planos de execução — orientam trabalho; não regem domínio

**Engenharia (3)**
Blueprint de Implementação 001 · Plano de Refatoração Arquitetural 001 · Plano de
Encerramento da Sprint 0

### Fora do inventário oficial — status não avaliado

**Governança pré-existente (2)**
ADR-003 e ADR-005 encontram-se em disco, **também sem versionamento**, e **não foram
produzidos nem revisados** neste ciclo. Não integram o inventário oficial deste plano.
Sua inclusão exige conferência prévia por quem detém contexto — **registrada como
pendência**, não executada aqui.

---

## 2. Estrutura de Diretórios

Organização definitiva da arquitetura oficial, em espaço próprio e inequívoco:

```
docs/zion-os/
    constitution/
    organization/
    modules/
    engineering/
    governance/
```

**Responsabilidade de cada pasta.**

- **`constitution/`** — os documentos de **mais alta precedência**. Regem toda a
  plataforma; nada pode contradizê-los. Alteração exige ADR aprovado e o mais alto grau
  de escrutínio.
- **`organization/`** — como o software se organiza sob a Constituição: arquitetura do
  sistema, anatomia dos módulos e o **Glossário normativo**, fonte única da linguagem.
- **`modules/`** — a arquitetura lógica interna de cada módulo. Derivam da Organização e
  não a contradizem.
- **`engineering/`** — os artefatos que **testam e guiam**: Blueprints arquiteturais,
  Blueprints de Implementação e planos de execução. Produzem evidência; não regem.
- **`governance/`** — o registro das **decisões e do processo**: ADRs, RFCs e
  revalidações. É a memória de **por que** a plataforma é como é.

**Por que este espaço, e não `docs/architecture/`.** Porque aquele diretório já abriga
material anterior (§0). Um espaço próprio elimina a ambiguidade **sem tocar** no que
existe — respeitando integralmente o não-escopo deste plano.

**Nota sobre movimentação.** Os documentos deste inventário **nunca foram versionados**.
Não há, portanto, histórico a preservar: colocá-los diretamente no destino definitivo
**não é reorganizar** — é **escolher onde nascem**. Este é o único momento em que a
localização pode ser decidida sem custo algum.

---

## 3. Estratégia de Commit

**Branch recomendada.** `docs/versionar-arquitetura-oficial`, criada a partir da linha
principal atualizada.

**Estratégia de merge.** Integração preservando o histórico, sem reescrita e sem
achatamento. O commit deve permanecer identificável como o marco em que a arquitetura
passou a existir no repositório.

**Conteúdo.** **Exclusivamente documentação.** Nenhum arquivo de código pode ser criado,
alterado ou removido. Um diff que contenha qualquer caminho de código **invalida o
commit**.

**Granularidade.** Um commit por categoria, para que a revisão seja possível e o
histórico seja legível:

`docs(constitution): versionar a Constituição Arquitetural do Zion OS`
`docs(organization): versionar Arquitetura do Sistema, dos Módulos e Glossário`
`docs(modules): versionar arquitetura dos módulos Operation Center, Publication e Integration`
`docs(engineering): versionar Blueprints e planos de execução`
`docs(governance): versionar ADRs, RFC e revalidação arquitetural`

**Critérios para revisão.** Quem revisar deve verificar **apenas quatro coisas**, e
nenhuma delas é o conteúdo:

1. o diff contém **somente** arquivos de documentação;
2. cada documento está na pasta correspondente à sua natureza (§2);
3. **nenhum texto foi alterado** em relação ao aprovado;
4. o build permanece íntegro.

*Revisar o conteúdo dos documentos está **fora** do escopo — eles já foram aprovados.*

**Ordem em relação ao encerramento da Sprint 0.** As duas frentes tocam caminhos
**disjuntos** (documentação × código), e por isso **não há conflito possível** entre
elas. Duas consequências devem ser conhecidas:

- Versionar **antes** do merge da Sprint 0 elimina imediatamente o risco de perda — e faz
  com que aquela integração deixe de ser um avanço direto, passando a ser um merge
  comum, **ainda assim sem conflito**;
- Versionar **depois** preserva o avanço direto, ao custo de manter o risco em aberto por
  mais tempo.

**Reconciliação do ADR-006.** Como aquele documento chega pela branch da Sprint 0 em
`docs/decisions/`, ele ficará fora da estrutura definitiva. Sua relocação para
`docs/zion-os/governance/` deve ocorrer em **commit próprio, após a integração da Sprint
0** — movimento de documentação, sem alteração de texto.

---

## 4. Rastreabilidade

**O versionamento é, em si, o mecanismo primário de rastreabilidade.** No instante em
que um documento entra no repositório, ele passa a possuir **data, autoria, histórico
completo e imutabilidade do passado** — exatamente o que a Governança exige e o que o
armazenamento local não oferece.

Sobre esse alicerce, define-se a **convenção de metadados** que cada documento deverá
indicar:

- **Status** — vigente · superado · encerrado · aberto (para RFCs);
- **Data** — de aprovação;
- **Versão** — do documento;
- **Documentos relacionados** — dos quais deriva ou aos quais serve;
- **ADRs que o alteraram** — a cadeia decisão → alteração, reconstituível;
- **RFCs que originaram mudanças** — a evidência que motivou cada alteração.

**Aplicação da convenção.** Ela vale **prospectivamente**: todo documento novo já nasce
com ela, e todo documento alterado por ADR futuro a recebe no mesmo commit que o altera.
**Aplicá-la retroativamente aos documentos existentes exigiria editá-los** — o que este
plano proíbe (§6). Enquanto isso, o histórico do repositório supre integralmente a
função de rastreabilidade.

*Referência já existente:* o documento do módulo Publication registra em seu cabeçalho o
ADR que autorizou sua revisão — exemplo concreto da convenção em uso.

---

## 5. Critérios de Aceitação

Ao final, deverá ser possível afirmar objetivamente:

- **Nenhum documento aprovado permanece fora do Git** — os 25 documentos do inventário
  oficial estão versionados, e o ADR-006 reconciliado após a Sprint 0.
- **Toda decisão arquitetural possui histórico** — data, autoria e evolução recuperáveis
  do repositório.
- **Todos os ADRs possuem rastreabilidade** — localização permanente em `governance/`.
- **Todos os Blueprints possuem localização permanente** — em `engineering/`.
- **Toda evolução futura ocorrerá sobre documentos versionados** — nenhuma alteração
  arquitetural será considerada oficial fora do histórico.
- **Nenhum arquivo de código foi alterado** por este procedimento.

---

## 6. Não Escopo

É **proibido**, durante este procedimento: revisar documentos; corrigir texto (inclusive
erros evidentes); alterar arquitetura; reorganizar conteúdo; criar novos artefatos.

**Somente versionar.**

Pendências identificadas e **deliberadamente não resolvidas** aqui:

- o **status do material em `docs/architecture/`** (§0);
- a **inclusão de ADR-003 e ADR-005** (§1);
- a **aplicação retroativa** da convenção de metadados (§4).

Cada uma exigiria revisar conteúdo. Todas ficam registradas para tratamento próprio.

---

## 7. Declaração Oficial

> **A arquitetura oficial do Zion OS passa a integrar permanentemente o repositório do
> projeto.**
>
> **A partir deste ponto, nenhuma alteração arquitetural será considerada oficial
> enquanto não estiver registrada e versionada no histórico Git.**

*Esta declaração torna-se efetiva com a conclusão verificada dos commits definidos em §3
e a satisfação integral dos Critérios de Aceitação (§5).*

---

## Encerramento

A arquitetura do Zion OS foi tratada, desde o primeiro documento, como **patrimônio
permanente** — construída para durar mais que qualquer decisão técnica, qualquer
tecnologia e qualquer equipe. Esse tratamento seria contraditório se ela continuasse
existindo em um único disco.

Ao final deste plano, o repositório torna-se a **única fonte oficial** da arquitetura:
rastreável, auditável, recuperável e independente de qualquer máquina. A Constituição
que proíbe apagar artefatos passa, ela própria, a ser inapagável.
