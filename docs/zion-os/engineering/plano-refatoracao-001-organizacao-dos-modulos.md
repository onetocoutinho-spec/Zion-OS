# Plano de Refatoração Arquitetural 001 — Organização dos Módulos

> **Natureza.** Plano oficial da **primeira refatoração** do Zion OS. Inaugura a fase
> **Refatoração Arquitetural Controlada**, na qual a arquitetura deixa de existir apenas
> nos documentos e passa a ser visível na organização do código.
>
> **Compromisso inegociável.** **100% do comportamento é preservado.** Nenhuma
> funcionalidade é criada, alterada, otimizada ou removida. Toda mudança é
> **estrutural**.
>
> **Base normativa.** Executa o Passo 1 do Blueprint de Implementação 001, sob a
> arquitetura oficial vigente. Não altera nenhum documento normativo.

---

## 0. Pré-condições (verificação de estado do repositório)

Antes de qualquer execução, três fatos precisam ser reconciliados com o estado real do
repositório:

**P1 — O trabalho de idempotência ainda não está na branch principal.** O commit
`2a91e32` (idempotência das Size Charts) existe apenas em
`origin/feat/ml-size-charts-idempotencia`. A branch principal encontra-se em `ab4682c`.
**Consequência:** refatorar `mercadolivre.ts` ou `publicar/route.ts` antes do merge
produzirá **conflito direto** com esse PR aberto. *Esta refatoração só deve começar
depois que o PR estiver incorporado.*

**P2 — A rota temporária de diagnóstico está na branch principal.**
`src/app/api/ml/diagnostico-guias/route.ts` encontra-se em produção. Sua remoção é a
**Etapa 7** deste plano e permanece pendência de governança.

**P3 — Ponto de partida.** Toda etapa parte da branch principal atualizada. Nenhuma
etapa parte de outra branch de refatoração.

---

## 1. Objetivo

**Por que refatorar.** O Blueprint de Implementação 001 demonstrou que **nenhuma peça da
Sprint 0 ficou sem lugar** — mas várias estão em lugares provisórios. Enquanto a
mecânica de um canal viver no fluxo de publicação, adicionar um segundo marketplace
exigirá tocar código que não deveria saber que marketplaces existem.

**Refatoração × reescrita.** Uma **reescrita** substitui o comportamento e assume o
risco de reintroduzir defeitos já resolvidos. Uma **refatoração** move responsabilidades
**preservando exatamente** o que o sistema faz. A Sprint 0 custou caro para chegar onde
chegou — inclusive um defeito de produção depurado ao longo de dias. Nada disso pode ser
arriscado por organização de código.

**Por que o comportamento deve permanecer idêntico.** Porque é a **única** forma de
saber que a refatoração está correta. Se o comportamento mudar, perde-se o critério
objetivo de sucesso: qualquer diferença passa a ser ambígua entre "melhoria" e
"regressão". Comportamento idêntico é o que torna cada etapa **verificável**.

---

## 2. Estado Atual

A Sprint 0 organiza-se por **natureza técnica** (`lib/marketplaces`, `lib/services`,
`lib/data`, rotas), não por **domínio**. Os problemas estruturais já conhecidos —
levantados pelo Blueprint de Implementação 001, sem procurar novos:

- **O ponto de entrada de publicação acumula responsabilidades de três módulos:**
  autorização (transversal), conexão e renovação (Integration), previsão de categoria e
  bifurcação (Integration), obtenção da grade (Integration), laço de itens
  (Integration) e coordenação/observabilidade (Operation Center).
- **A composição da intenção ocorre fora do domínio**, no caminho que precede a rota.
- **A mecânica do canal está espalhada** entre o construtor de payload, o cliente do
  marketplace e a própria rota.
- **Regras mutáveis estão implícitas** no fluxo (critério de equivalência da grade,
  parâmetros de repetição e paginação).
- **Não existem módulos visíveis** na estrutura do projeto.
- **Código temporário permanece** em produção (rota de diagnóstico).

Nenhum destes é defeito funcional. Todos são **posicionamento**.

---

## 3. Estado Desejado

Quatro módulos visíveis na própria estrutura do código, cada um com suas camadas:

- **Publication** — a intenção de presença: seu domínio (agregado, políticas, serviços),
  sua aplicação (casos de uso), suas portas e seus adaptadores de fronteira.
- **Integration** — a fronteira com o mundo externo: canal e capacidades, conexão,
  comunicação, tradutores e o adaptador de canal.
- **Operation Center** — a coordenação: o laço que decide e acompanha.
- **Catalog** — a verdade do produto (nesta refatoração, apenas o que já existe:
  conhecimento de medidas).

Dentro de cada módulo, a separação entre **domínio**, **aplicação**, **portas** e
**adaptadores** deve ser evidente pela navegação, sem consultar documentação.

*Este plano não constrói o estado desejado por completo — ele o torna **visível** e move
o que já existe para dentro dele.*

---

## 4. Estratégia

A estratégia é **incremental e reversível**, por quatro razões objetivas:

- **Baixo risco.** Cada etapa altera uma única dimensão. Movimento de arquivo não muda
  comportamento; extração de regra não muda valor; introdução de porta não muda fluxo.
  Misturar duas dimensões num commit torna impossível saber qual causou um problema.
- **Facilidade de revisão.** Um PR que move arquivos é revisável em minutos. Um PR que
  move, extrai e reorganiza simultaneamente não é revisável — é aprovado por confiança.
- **Facilidade de rollback.** Cada etapa é revertível isoladamente, sem desfazer as
  demais. Nenhuma etapa depende da conclusão de uma **futura**.
- **Facilidade de teste.** Comportamento preservado permite usar a verificação mais
  barata que existe: **comparar antes e depois**.

**Regra de interrupção.** A refatoração pode parar **ao final de qualquer etapa** sem
deixar o sistema inconsistente. Um estado intermediário é sempre um estado válido.

---

## 5 e 6. Plano de Execução e Sequência Recomendada

> Sete etapas. Cada uma explica **por que vem antes da próxima**. Nenhuma depende da
> conclusão de uma etapa posterior.

### Etapa 1 — Criar a estrutura dos módulos

**Objetivo.** Tornar os quatro módulos visíveis no projeto, **sem mover código algum**.
**Arquivos impactados.** Nenhum existente. Criação de `src/modules/publication/`,
`src/modules/integration/`, `src/modules/operation-center/`, `src/modules/catalog/`,
cada um com um marcador declarando sua fronteira (qual verdade possui e o que **não** lhe
pertence).
**Responsabilidades movidas.** Nenhuma.
**Responsabilidades preservadas.** Todas.
**Risco.** **Nulo** — nada é movido, nada é importado, nada é executado.
**Critério de conclusão.** Estrutura existe; build permanece verde; nenhum arquivo
existente foi tocado.
**Critério de rollback.** Remover os diretórios criados.
**Por que vem antes da próxima.** Cria-se o **destino** antes de mover qualquer coisa. A
topologia pode ser discutida e revisada isoladamente, sem que nenhum código esteja em
risco.

### Etapa 2 — Mover código sem alterar comportamento

**Objetivo.** Relocar cada peça para o seu dono, alterando **apenas caminhos de
importação**.
**Arquivos impactados** (uma sub-etapa por commit, independentes entre si):

- `src/lib/marketplaces/normalizarTamanho.ts` + teste → **Publication / domínio**
- `src/lib/data/tabelasMedidas.ts` → **Catalog**
- `src/lib/marketplaces/mercadolivre.ts` → **Integration**
- `src/lib/marketplaces/mlUserProducts.ts` + teste → **Integration**
- `src/lib/marketplaces/mlPayload.ts` → **Integration**
- `src/lib/marketplaces/canalServidor.ts` → **Integration**

**Responsabilidades movidas.** Nenhuma — apenas **localização**.
**Responsabilidades preservadas.** Todas, integralmente.
**Risco.** **Baixo.** O único efeito é a atualização de importações.
**Critério de conclusão.** Build verde; testes existentes passando; **zero diferença de
comportamento**.
**Critério de rollback.** Reverter o commit da sub-etapa — movimento puro, sempre
revertível.
**Nota deliberada.** `mlUserProducts.ts` é movido **inteiro** para Integration, embora
contenha também composição de conteúdo. A **divisão** ocorre na Etapa 5. Mover e dividir
no mesmo commit violaria "uma responsabilidade por vez".
**Por que vem antes da próxima.** Não se extrai regra de um arquivo que ainda vai mudar
de lugar. Mover primeiro faz com que toda extração posterior ocorra no destino final.

### Etapa 3 — Extrair Policies

**Objetivo.** Dar **nome e lugar** às regras mutáveis já existentes, **sem alterar seus
valores nem sua lógica**.
**Arquivos impactados.** `mercadolivre.ts` (já em Integration).
**Responsabilidades movidas.** Do fluxo para unidades nomeadas: o **critério de
equivalência** da grade (normalização de nome e filtro por padrão) e os **parâmetros de
comunicação** (limite de página, teto de páginas, número de tentativas de leitura).
**Responsabilidades preservadas.** Os valores e o comportamento resultante, idênticos.
**Risco.** **Baixo–médio** — código muda de lugar **dentro** do módulo.
**Critério de conclusão.** As regras existem como unidades nomeadas; o comportamento
observável é idêntico, incluindo os campos dos registros estruturados.
**Critério de rollback.** Reverter o commit; as regras voltam a ser inline.
**Fora de escopo, registrado.** A política de **elegibilidade** (identificador comercial)
**não** é criada aqui: hoje quem recusa é o canal, e antecipar essa verificação **mudaria
comportamento**. Fica registrada para refatoração futura.
**Por que vem antes da próxima.** Regras precisam existir como unidades antes de serem
declaradas como dependências por uma porta.

### Etapa 4 — Introduzir portas

**Objetivo.** Fazer o fluxo passar a depender de **interfaces declaradas**, em vez de
chamar diretamente as funções de canal.
**Arquivos impactados.** `src/app/api/ml/publicar/route.ts`,
`src/lib/services/publicacaoML.ts`, módulo Integration.
**Responsabilidades movidas.** Nenhuma — introduz-se **indireção**, não realocação.
**Responsabilidades preservadas.** Todas; as implementações continuam sendo exatamente
as atuais.
**Risco.** **Médio** — é a primeira etapa que altera a forma de acoplamento.
**Critério de conclusão.** O fluxo executa idêntico; a dependência aponta para a porta;
a implementação atual é injetada sem modificação.
**Critério de rollback.** Reverter o commit; o fluxo volta a chamar diretamente.
**Por que vem antes da próxima.** Sem portas, não há **atrás de quê** colocar um
adaptador. A porta é o que permite trocar a implementação sem tocar quem a usa.

### Etapa 5 — Extrair adaptadores

**Objetivo.** Isolar **toda** a mecânica do canal atrás da porta e separar os tradutores.
Resolve o **Bloqueador 1**.
**Arquivos impactados.** `mercadolivre.ts`, `mlUserProducts.ts`, `mlPayload.ts` (todos
já em Integration).
**Responsabilidades movidas.** A montagem no formato do canal e a conversa tornam-se
**adaptador de canal**; a tradução de erro torna-se **tradutor**; e a parcela de
`montarBundleUserProducts` que compõe **conteúdo em vocabulário do Zion** é extraída para
**Publication**.
**Responsabilidades preservadas.** O payload produzido e as chamadas realizadas
permanecem **idênticos**.
**Risco.** **Médio — o mais alto da série.** É a única etapa que divide um artefato entre
dois módulos.
**Critério de conclusão.** Um segundo canal hipotético exigiria **apenas** capacidades,
mapeamentos e tradutor — sem tocar nada fora da Integration. Comportamento idêntico.
**Critério de rollback.** Reverter o commit; o artefato volta a ser único.
**Por que vem antes da próxima.** A infraestrutura só pode ser separada depois que a
mecânica de canal estiver isolada; antes disso, não há linha nítida entre "conversa com
o canal" e "realização técnica".

### Etapa 6 — Separar infraestrutura

**Objetivo.** Deixar a realização técnica (leitura do canal, custódia e renovação de
credenciais) **atrás de portas**, de modo que o domínio não a conheça.
**Arquivos impactados.** `canalServidor.ts` (em Integration),
`src/app/api/ml/publicar/route.ts`, `src/app/api/ml/autorizar/route.ts`.
**Responsabilidades movidas.** Da chamada direta para realização de porta.
**Responsabilidades preservadas.** Todo o comportamento de conexão e renovação,
inclusive a persistência do valor rotacionado.
**Risco.** **Médio** — toca o caminho de credenciais, que é sensível.
**Critério de conclusão.** O ponto de entrada torna-se fino; o domínio não referencia
realização técnica alguma; comportamento idêntico.
**Critério de rollback.** Reverter o commit.
**Por que vem antes da próxima.** É a última etapa que **move**; a seguinte apenas
**remove**. Concluir os movimentos antes de remover mantém disponível qualquer apoio de
verificação até o fim.

### Etapa 7 — Remover código temporário

**Objetivo.** Eliminar a rota temporária de diagnóstico.
**Arquivos impactados.** `src/app/api/ml/diagnostico-guias/route.ts` (remoção).
**Responsabilidades movidas.** Nenhuma.
**Responsabilidades preservadas.** Todas — o artefato não participa de nenhum fluxo.
**Risco.** **Nulo–baixo.**
**Critério de conclusão.** O arquivo não existe; build verde; nenhum fluxo afetado.
**Critério de rollback.** Reverter o commit (o artefato permanece no histórico).
**Por que vem por último.** É a **única** etapa que remove em vez de mover. Mantê-la
disponível durante as Etapas 4–6 permite reverificar o contrato do canal caso alguma
dúvida surja durante o isolamento da fronteira. *Observação de governança: por ser
independente e de risco nulo, pode ser antecipada a qualquer momento, se a pendência de
governança for considerada prioritária.*

---

## 7. Estratégia de Commits

Uma branch por etapa; **um commit por intenção**; nenhum commit mistura duas intenções.

**Etapa 1** — branch `refactor/modules-scaffold`
`refactor(modules): criar estrutura dos módulos sem mover código`
*Objetivo:* tornar os módulos visíveis. *Evidência:* build verde; `git diff --stat` mostra
apenas arquivos novos.

**Etapa 2** — branch `refactor/move-to-modules` *(um commit por sub-etapa)*
`refactor(publication): mover normalizarTamanho para o módulo Publication`
`refactor(catalog): mover tabelasMedidas para o módulo Catalog`
`refactor(integration): mover cliente do canal para o módulo Integration`
*Objetivo:* relocar sem alterar comportamento. *Evidência:* build verde; testes passando;
diff composto **apenas** de renomeações e ajustes de importação.

**Etapa 3** — branch `refactor/extract-policies`
`refactor(integration): extrair critério de equivalência e parâmetros de comunicação`
*Objetivo:* nomear regras mutáveis. *Evidência:* comportamento e campos de registro
idênticos.

**Etapa 4** — branch `refactor/introduce-ports`
`refactor(publication): depender de porta de canal em vez de chamada direta`
*Objetivo:* inverter a dependência. *Evidência:* fluxo idêntico; implementação atual
injetada sem modificação.

**Etapa 5** — branch `refactor/extract-adapters`
`refactor(integration): isolar adaptador de canal e tradutores`
*Objetivo:* resolver o bloqueador multi-canal. *Evidência:* payload e chamadas idênticos.

**Etapa 6** — branch `refactor/separate-infrastructure`
`refactor(integration): mover realização de conexão para trás de porta`
*Objetivo:* domínio livre de realização técnica. *Evidência:* comportamento de conexão
idêntico.

**Etapa 7** — branch `chore/remove-diagnostic-route`
`chore(ml-diag): remover rota temporária de diagnóstico`
*Objetivo:* higiene e governança. *Evidência:* build verde; nenhum fluxo afetado.

**Regra de tamanho.** Nenhum PR desta série deve exceder o que um revisor consegue
avaliar de uma sentada. Se um PR crescer além disso, ele contém mais de uma intenção e
**deve ser dividido**.

---

## 8. Estratégia de Testes

**O que deve ser testado.** Três camadas de evidência, da mais barata à mais cara:

1. **Compilação e testes existentes.** Os testes unitários da Sprint 0
   (`normalizarTamanho`, `mlUserProducts`) cobrem exatamente as funções puras mais
   movimentadas. São a rede de segurança primária.
2. **Forma do diff.** Numa refatoração correta, o diff tem forma previsível: a Etapa 2
   contém apenas renomeações e importações; a Etapa 4, apenas indireção. **Um diff com
   forma inesperada é o primeiro sinal de que comportamento mudou.**
3. **Assinatura observável em produção.** Os registros estruturados da Sprint 0 são o
   **contrato comportamental** deste fluxo: os eventos da publicação e os campos da
   grade — origem, motivo, fonte das linhas, uso de fallback, páginas consultadas. Uma
   refatoração que preserva comportamento produz **a mesma assinatura**.

**Quando testar.** A cada commit, sem exceção — não ao final da etapa. Um commit que não
compila ou quebra teste **não entra**.

**O que caracteriza regressão.** Qualquer diferença observável: um teste que falha; um
payload diferente; um campo de registro ausente, renomeado ou com valor distinto; uma
chamada a mais ou a menos; qualquer alteração de mensagem de erro percebida por quem
opera.

**Quando interromper a refatoração.** Imediatamente, se: um teste falhar e a causa não
for compreendida em minutos; a assinatura de registro mudar sem explicação; um diff
apresentar forma inesperada; ou for necessário **alterar comportamento para prosseguir**.
Nesse último caso, a necessidade é registrada e a etapa é **abandonada** — não adaptada.

---

## 9. Critérios de Aceitação

Ao final, deverá ser possível afirmar objetivamente:

- **Cada responsabilidade possui um único dono** — todo comportamento tem exatamente um
  módulo que responde por ele.
- **Os módulos estão visíveis no código** — a navegação revela Publication, Integration,
  Operation Center e Catalog.
- **A integração não conhece domínio** — nenhuma decisão de negócio vive na fronteira.
- **O domínio não conhece infraestrutura** — nenhuma realização técnica é referenciada
  de dentro.
- **Publication não conhece o Mercado Livre** — nenhum termo, formato ou conceito do
  canal aparece fora da Integration.
- **O código temporário foi removido.**
- **A arquitetura tornou-se evidente sem leitura da documentação.**

---

## 10. Critérios de Não-Escopo

Durante esta refatoração é **proibido**: criar funcionalidades; alterar comportamento;
otimizar performance; alterar contratos externos; alterar APIs; alterar banco de dados;
alterar regras de negócio; alterar arquitetura.

**Toda necessidade identificada é registrada, nunca executada.** Já registradas: a
política de elegibilidade antecipada (Etapa 3); a criação do agregado Publication com
identidade e ciclo de vida; e o módulo Operation Center — todos pertencentes aos Passos
6 e 7 do Blueprint de Implementação 001, fora deste plano.

---

## 11. Resultado Esperado

Ao final, um desenvolvedor que nunca leu a documentação abre o projeto e vê **quatro
módulos**. Dentro de cada um, encontra o que é **domínio**, o que é **aplicação**, o que
são **portas** e o que são **adaptadores**. Ao procurar onde o Mercado Livre é
mencionado, encontra **um único lugar** — a Integration. Ao procurar onde se decide o
que publicar, **não** encontra a Integration.

O sistema faz **exatamente** o que fazia antes. Nenhum anúncio é publicado de forma
diferente; nenhuma grade é criada de forma diferente; nenhum registro sai diferente. O
que mudou não foi o que o software faz — foi **o que ele revela sobre si mesmo**.

A arquitetura deixa de ser algo que se lê e passa a ser algo que se **vê**.
