# Plano de Encerramento da Sprint 0

> **Natureza.** Procedimento oficial de **integração** da Sprint 0 à linha principal.
> Não realiza refatoração, não altera arquitetura, não move arquivos. Seu único objetivo
> é **encerrar corretamente o primeiro ciclo completo de desenvolvimento** do Zion OS e
> estabelecer uma base única para as fases seguintes.
>
> **Base factual.** Todo o §1 deriva de inventário verificado no repositório. Nenhuma
> afirmação deste plano é suposição.

---

## 1. Estado Atual

**Linha principal.** `origin/master` encontra-se em **`ab4682c`** — *"Merge pull request
#7 from onetocoutinho-spec/chore/ml-diag-charts-search"*. Contém, portanto, apenas o
trabalho de diagnóstico da fronteira, **não** a funcionalidade da Sprint 0.

**Branch da Sprint 0.** `origin/feat/ml-size-charts-idempotencia` encontra-se em
**`2a91e32`** — *"feat(mercadolivre): idempotência de Size Charts do Zion via
search-before-create"*.

**Commit relevante.** Um único commit, com **3 arquivos** e **+419 / −29** linhas:
`docs/decisions/ADR-006-...md` (novo), `src/app/api/ml/publicar/route.ts` e
`src/lib/marketplaces/mercadolivre.ts`. Autor e committer:
`onetocoutinho-spec`.

**Divergência.** Contagem `origin/master ↔ branch` = **0 / 1**. A linha principal não
possui nenhum commit ausente da branch; a branch possui exatamente **um** commit à
frente.

**Base de merge.** `merge-base` = **`ab4682c`** = `origin/master`. Consequência
verificada: **o merge é um avanço direto (fast-forward), sem qualquer conflito
possível.**

**Situação do PR.** A branch está publicada no repositório remoto. O estado formal do
Pull Request no serviço de hospedagem **não pôde ser verificado** deste ambiente (não há
cliente disponível para consulta). Deve ser confirmado visualmente antes da execução.

**Divergências encontradas no inventário.**

- **D1 — A funcionalidade não está na linha principal.** Confirmado: `2a91e32` existe
  apenas na branch da Sprint 0.
- **D2 — A rota temporária de diagnóstico está na linha principal.**
  `src/app/api/ml/diagnostico-guias/route.ts` consta em `origin/master`. *Sua remoção é
  Etapa 7 do plano de refatoração — **fora do escopo deste encerramento**.*
- **D3 — Não existe verificação automatizada de testes.** O projeto declara apenas o
  procedimento de **build**; não há alvo de teste configurado, embora existam arquivos de
  teste (`normalizarTamanho`, `mlUserProducts`). A verificação de testes é, hoje,
  **manual**.
- **D4 — A documentação arquitetural aprovada não está versionada.** Verificado: **zero**
  arquivos rastreados na linha principal em `docs/product` e `docs/decisions`, enquanto
  existem **21** documentos em `docs/product` e **5** em `docs/decisions` no disco local.
  Exceção: o ADR-006 acompanha o commit da Sprint 0 e passa a ser rastreado com o merge.

---

## 2. Pré-condições

Todas devem ser verdadeiras **antes** de qualquer integração:

- **PC1 — Revisão concluída.** A revisão de manutenção foi realizada e concluída com
  parecer **APROVADO**, sem itens bloqueadores.
- **PC2 — Arquitetura validada.** Blueprint 001 e Blueprint 002 executados e aprovados;
  Revalidação Arquitetural do ADR-007 concluída sem regressões.
- **PC3 — ADRs aprovados.** ADR-006 (idempotência) e ADR-007 (identidade da Publication)
  aprovados e incorporados.
- **PC4 — Ausência de RFCs abertas relacionadas.** A RFC-001 foi **encerrada
  definitivamente**. Nenhuma RFC aberta incide sobre este merge.
- **PC5 — Build íntegro.** O procedimento de build deve concluir sem erro na branch da
  Sprint 0 **e** novamente após a integração.
- **PC6 — Testes existentes executados.** Dada a **D3**, os testes unitários da Sprint 0
  devem ser executados **manualmente** e passar. *Registrar o resultado como evidência.*
- **PC7 — Estado do PR confirmado visualmente.** Dado que não foi possível verificar o
  PR deste ambiente, seu estado deve ser conferido antes da execução.
- **PC8 — Nenhuma alteração estrutural pendente.** Nenhuma refatoração pode ter sido
  iniciada; a árvore de trabalho não deve conter movimentação de arquivos de código.

---

## 3. Riscos

**R1 — Conflito de merge · RISCO BAIXO.** Verificado que a base de merge coincide com a
linha principal e a divergência é `0/1`. Tecnicamente **não há conflito possível**. Este
risco é considerado eliminado por evidência, não por expectativa.

**R2 — Regressão funcional · RISCO BAIXO.** O commit é cirúrgico (3 arquivos), foi
revisado, e a mudança é **não regressiva por construção**: caso as premissas empíricas
falhem, o pior cenário é o comportamento **anterior** ao PR. Nenhum caminho leva a
comportamento pior que o vigente.

**R3 — Comportamento ainda não validado em produção · RISCO MÉDIO.** O plano de validação
do ADR-006 previa confirmar, em produção, a **reutilização na segunda publicação** do
mesmo produto (`origem: reuse`, sem colisão de nome). **Essa validação não foi
executada.** O merge, portanto, integra comportamento revisado e construído, porém ainda
não observado em produção. *Mitigação: a assinatura de registro estruturado permite
confirmar o comportamento na primeira republicação real, sem instrumentação adicional.*

**R4 — Ausência de porta de qualidade automatizada · RISCO MÉDIO.** Sem alvo de teste
configurado (**D3**), a verificação depende de disciplina humana. *Mitigação: a
pré-condição PC6 torna a execução manual obrigatória e registrada.*

**R5 — Documentação arquitetural não versionada · RISCO ALTO.** Este é o **maior risco
do quadro atual**, e não é sobre o merge. Vinte e seis documentos aprovados — incluindo
a Constituição, o Glossário normativo, os Blueprints e a Governança — existem
**exclusivamente em disco local**, sem versionamento, sem histórico e sem cópia remota.
Uma falha de máquina eliminaria integralmente a arquitetura oficial do Zion OS. Além do
risco de perda, a situação contraria a própria Governança Arquitetural, que exige
decisões **rastreáveis** e artefatos que **nunca desaparecem**. *Mitigação: incorporada
como passo obrigatório deste encerramento (§4, Passo 6).*

**R6 — Rota temporária em produção · RISCO MÉDIO (governança).** Registrado, **fora do
escopo** deste plano; endereçado na Etapa 7 do Plano de Refatoração 001.

---

## 4. Estratégia de Merge

Sequência com **portas de verificação**. Cada passo produz evidência antes de habilitar
o seguinte.

**Passo 1 — Confirmar as pré-condições.** Verificar PC1 a PC8. *Porta:* qualquer
pré-condição falsa **interrompe** o procedimento.

**Passo 2 — Sincronizar as referências.** Atualizar as referências remotas e reconfirmar
que a divergência permanece `0/1` e que a base de merge continua coincidindo com a linha
principal. *Porta:* se a linha principal tiver avançado, **reavaliar** o risco R1 antes
de prosseguir — o avanço direto pode ter deixado de ser possível.

**Passo 3 — Verificar a branch isoladamente.** Executar o build e os testes existentes
**na branch da Sprint 0**. *Porta:* build verde e testes aprovados.

**Passo 4 — Integrar.** Realizar a integração da branch à linha principal, preservando o
histórico (o commit `2a91e32` deve permanecer identificável, com autoria original). *Não
reescrever, não achatar, não recriar o commit.*

**Passo 5 — Verificar após a integração.** Executar novamente build e testes **na linha
principal já integrada**. *Porta:* resultado idêntico ao Passo 3.

**Passo 6 — Versionar a documentação aprovada.** Incorporar à linha principal os
documentos arquitetônicos aprovados, em **commit separado** do merge (uma intenção por
commit). *Observação obrigatória:* dois documentos em `docs/decisions` (ADR-003 e
ADR-005) **são anteriores a este ciclo** e não foram produzidos nem revisados aqui — seu
conteúdo deve ser conferido antes da inclusão, ou sua inclusão deve ser adiada.
*Porta:* build verde; nenhum arquivo de código incluído neste commit.

**Passo 7 — Confirmar comportamento.** Confirmar que o comportamento observável
permanece o mesmo: nenhuma alteração de fluxo, de payload ou da assinatura dos registros
estruturados. *Porta:* nenhuma diferença observável.

**Passo 8 — Publicar.** Disponibilizar a linha principal integrada. *Porta:* publicação
concluída sem erro.

**Regra de interrupção.** Falha em qualquer porta interrompe o procedimento no ponto em
que ocorreu. Nenhum passo é executado "para ver se resolve".

---

## 5. Critérios de Aceitação

Após o procedimento, deve ser possível afirmar objetivamente:

- **A Sprint 0 está oficialmente concluída.**
- **A linha principal contém a implementação** de idempotência (`2a91e32` alcançável a
  partir de `master`).
- **Nenhuma funcionalidade foi perdida** — os três arquivos do commit estão íntegros na
  linha principal.
- **Nenhum comportamento mudou** em relação ao que foi revisado e construído.
- **A arquitetura permanece válida** — nenhum documento normativo foi alterado por este
  procedimento.
- **O Blueprint de Implementação 001 continua aderente** — o mapeamento
  arquitetura→código permanece verdadeiro, pois nenhuma responsabilidade foi movida.
- **A documentação aprovada está versionada** e recuperável a partir do repositório.

---

## 6. Critérios de Não-Escopo

Durante este procedimento é **proibido**: mover arquivos; reorganizar módulos; alterar
responsabilidades; **remover código temporário**; otimizar código; iniciar refatorações;
alterar arquitetura.

**Toda alteração estrutural pertence exclusivamente à fase seguinte.** A remoção da rota
de diagnóstico (**D2/R6**), ainda que trivial e desejável, **não** ocorre aqui — ela é
Etapa 7 do Plano de Refatoração 001. Misturar integração com reorganização eliminaria a
propriedade que torna este encerramento auditável: a de que **nada além do previsto
mudou**.

---

## 7. Evidências Esperadas

Ao final devem existir, e ser conferíveis:

- **Integração registrada** na linha principal, com o commit `2a91e32` alcançável e
  autoria preservada.
- **Branch integrada**, com histórico consistente e sem reescrita.
- **Resultado do build** verde, registrado antes e depois da integração.
- **Resultado dos testes existentes**, executados manualmente e aprovados (evidência
  exigida por PC6/D3).
- **Documentação versionada** — os documentos aprovados presentes na linha principal, em
  commit próprio.
- **Histórico consistente** — nenhuma reescrita, nenhum achatamento, nenhuma perda de
  autoria.
- **Registro do que permaneceu pendente:** validação em produção da reutilização (**R3**)
  e remoção da rota temporária (**D2**).

---

## 8. Próxima Fase

O encerramento da Sprint 0 **habilita formalmente** a execução do **Plano de Refatoração
Arquitetural 001 — Organização dos Módulos**.

**Por que esta ordem reduz risco.** O plano de refatoração incide sobre exatamente os
dois arquivos de código que a Sprint 0 modifica: o cliente do canal e o ponto de entrada
de publicação. Refatorar antes da integração significaria mover, dividir e reorganizar
arquivos que possuem alterações pendentes em outra linha — transformando um avanço
direto sem conflito em uma reconciliação manual de código que ninguém precisa fazer.

**Por que esta ordem evita conflitos.** Com a integração concluída, existe **uma única
base**. Toda etapa de refatoração parte dela, e cada etapa pode ser revertida
isoladamente sem afetar a funcionalidade — porque a funcionalidade já está estabelecida e
estável na linha principal.

**Regra de sequenciamento.** Nenhuma etapa do Plano de Refatoração 001 pode iniciar antes
da conclusão dos Passos 1 a 8 deste procedimento.

---

## 9. Declaração Oficial

> **A Sprint 0 encontra-se oficialmente encerrada.**
>
> **A implementação de idempotência passa a integrar a linha principal do Zion OS.**
>
> **A partir deste ponto, toda evolução ocorrerá sobre uma base única e estável.**
>
> **Inicia-se oficialmente a fase de Refatoração Arquitetural Controlada.**

*Esta declaração torna-se efetiva com a conclusão verificada dos Passos 1 a 8 (§4) e a
satisfação integral dos Critérios de Aceitação (§5). Até lá, permanece como o resultado
pretendido do procedimento, não como fato consumado.*

---

## Registro de pendências transferidas

Encerrar a Sprint 0 **não encerra** o que dela decorre. Transferem-se, formalmente
registradas:

- **Validação em produção da reutilização de guia** (R3) — primeira republicação real
  deve confirmar `origem: reuse`, sem colisão de nome.
- **Remoção da rota temporária de diagnóstico** (D2/R6) — Etapa 7 do Plano de Refatoração
  001.
- **Ausência de porta de qualidade automatizada** (D3) — registrada para tratamento
  futuro; não bloqueia este encerramento.
- **Achados 1 e 3 do Blueprint 002** — permanecem abertos, sem incidência sobre este
  procedimento.
