# Operation Center — Taxonomia de Sinais (v1)

> **Natureza.** Este documento define **todos os tipos de fato de negócio** que o
> Operation Center pode observar. Não há eventos técnicos, filas, API, banco,
> broker ou implementação — de propósito. Um Signal é um **fato**, não um evento de
> mensageria; a forma técnica de propagá-lo é assunto de outro documento.
>
> **Subordinação.** Não altera nem contradiz os documentos aprovados (Arquitetura,
> Modelo de Domínio, Máquina de Estados). Todo Signal aqui é justificável pela
> linguagem ubíqua já fixada.
>
> **Princípio fundamental.** Um Signal representa **algo que aconteceu**. Nunca uma
> decisão, nunca uma ação, nunca um comando. Ele apenas **informa que a realidade
> mudou**.

---

## 1. Objetivo

Os Signals são a **porta de entrada** do domínio: nada acontece no Operation Center
sem que primeiro um fato tenha sido observado. Todo o resto do sistema **nasce
deles** — um Signal pode ser pesado por uma Decision, que pode originar uma Mission,
que comanda Actions, que produzem Resultados (que, por sua vez, podem virar novos
Signals). O laço inteiro começa aqui.

Este documento fixa **quais fatos existem** como conceito permanente de negócio, de
forma independente de qualquer marketplace, integração ou tecnologia. Se amanhã o
Zion operar dez marketplaces com outra stack, os fatos ("um anúncio foi pausado",
"faltou estoque") continuam os mesmos.

---

## 2. Princípios

1. **Signal representa um fato** — uma verdade sobre a realidade num instante.
2. **Signal é imutável** — uma vez observado, não muda; sua "resolução" é um **novo**
   fato, não uma edição.
3. **Signal não executa trabalho** — é inerte; não publica, não corrige, não muda
   estado de nada.
4. **Signal nunca conhece Missões** — não sabe o que será feito a partir dele.
5. **Signal nunca conhece a IA** — não sabe quem o consumirá nem como.
6. **Signal nunca conhece módulos técnicos** — não sabe de marketplace, banco ou
   integração; refere-se ao mundo por **identidade (Alvo)**, nunca contém a verdade
   de outro domínio.
7. **Signal pode não gerar nenhuma Decision** — ser observado não obriga a agir.
8. **Signal não nasce de uma decisão** — vem da realidade, não de um julgamento; um
   julgamento jamais fabrica um fato para se justificar.

---

## 3. Classificação dos Signals

As famílias são organizadas pelo **assunto do fato** (do que ele fala). **Quem o
produz** varia (Integrações, ERP/canal, IA, Operador, Plataforma) e é registrado em
cada Signal — não é uma família.

- **A. Operação** — fatos sobre a condição agregada de uma Operação.
- **B. Catálogo (Produto)** — fatos sobre produtos.
- **C. Publicação (Anúncio)** — fatos sobre anúncios.
- **D. Canal & Conexão** — fatos sobre a conectividade com o canal.
- **E. Estoque** — fatos sobre disponibilidade.
- **F. Preço** — fatos sobre preço.
- **G. Sistema & Plataforma** — fatos sobre a própria capacidade de observar/operar.
- **H. Observação (Assistida/Humana)** — fatos **observados** pela IA ou relatados
  por um operador.

> **Por que não existe família "Auditoria".** Auditoria **registra** Signals,
> Decisions, Missions e Actions — ela **observa o domínio**, não **produz fatos de
> negócio**. Tratá-la como fonte de Signals inverteria o fluxo. Ela é transversal, e
> fica fora desta taxonomia por definição.

---

## 4. Catálogo de Signals

> Para cada Signal: **Descrição · Quando ocorre · Produz · Consome · Impacto
> operacional · Exemplo · O que NÃO é.** Conceito, nunca payload.

### A. Operação

**OperaçãoIniciada** — uma operação passou a existir (um cliente começou a ser
operado num canal). *Quando:* ao habilitar um cliente num canal. *Produz:*
Integrações/Operador. *Consome:* Operação. *Impacto:* Operação. *Ex:* "Chinelaria
começou a ser operada no ML". *NÃO é:* a conexão do canal em si (isso é família D).

**OperaçãoSuspensa** — a operação de um cliente foi interrompida. *Quando:* pausa
comercial/contratual. *Produz:* Operador. *Consome:* Operação. *Impacto:* Operação.
*NÃO é:* um canal expirado (fato técnico ≠ decisão comercial).

**SaúdeOperacionalDegradou** — a condição geral de uma Operação piorou. *Quando:*
acúmulo de fatos negativos (pausas, falhas). *Produz:* Operação (derivado). *Consome:*
Supervisor/Decision. *Impacto:* Operação/Cliente. *NÃO é:* um problema específico —
é o **resumo** dele.

**SaúdeOperacionalRestabelecida** — a condição voltou ao normal. *Impacto:*
Operação. *NÃO é:* garantia de que tudo foi resolvido — só que o resumo melhorou.

### B. Catálogo (Produto)

**ProdutoRecebido** — um produto novo entrou no catálogo operável. *Quando:*
importação/cadastro. *Produz:* Catálogo. *Consome:* Decision. *Impacto:* Produto.
*Ex:* "12 chinelos importados". *NÃO é:* um pedido de publicação.

**ProdutoAtualizado** — dados de um produto mudaram. *Impacto:* Produto/Anúncio.
*NÃO é:* a republicação — só que a verdade do produto mudou.

**ProdutoDadosIncompletos** — falta ao produto algo essencial para ser vendido
(ex.: medida, EAN, foto). *Quando:* ao detectar lacuna. *Produz:* Catálogo/IA.
*Consome:* Decision. *Impacto:* Produto. *NÃO é:* a correção — só o fato da lacuna.

**ProdutoTornou-seApto** — um produto passou a ter tudo o que precisa para ser
publicado. *Impacto:* Produto. *NÃO é:* a publicação.

**ProdutoDescontinuado** — um produto deixou de ser vendável. *Impacto:*
Produto/Anúncio. *NÃO é:* o encerramento do anúncio (consequência possível, não o
fato).

### C. Publicação (Anúncio)

**AnúncioPublicado** — um anúncio passou a existir/ficar ativo no canal. *Produz:*
Publicação. *Consome:* Operação/Decision. *Impacto:* Anúncio/Cliente. *Ex:* "SKU-123
no ar". *NÃO é:* garantia de venda.

**AnúncioFalhouAoPublicar** — uma tentativa de publicação não teve sucesso.
*Produz:* Publicação. *Consome:* Decision. *Impacto:* Anúncio. *Ex:* "faltou dado
obrigatório". *NÃO é:* a Action que falhou — é o **fato** do desfecho.

**AnúncioPausado** — um anúncio ativo foi pausado (por estoque, política, etc.).
*Impacto:* Anúncio/Cliente. *NÃO é:* a causa — apenas que ficou pausado.

**AnúncioReativado** — um anúncio pausado voltou a ficar ativo. *Impacto:* Anúncio.

**AnúncioReprovado** — o canal sinalizou/rejeitou um anúncio por política. *Produz:*
Integrações. *Impacto:* Anúncio/Canal. *NÃO é:* uma falha de publicação — é uma
reprovação de conteúdo/política.

**AnúncioDivergiuDoProduto** — o anúncio deixou de refletir a verdade do produto
(preço/estoque/atributo defasado). *Produz:* Publicação/Integrações. *Impacto:*
Anúncio. *NÃO é:* a correção.

**AnúncioEncerrado** — um anúncio foi encerrado no canal. *Impacto:* Anúncio.

### D. Canal & Conexão

**CanalConectado** — a conexão de um cliente com um canal foi estabelecida.
*Produz:* Integrações. *Impacto:* Canal/Operação. *NÃO é:* o início da operação
(família A).

**CanalExpirou** — a autorização/conexão perdeu a validade. *Impacto:*
Canal/Operação (bloqueia tudo daquele cliente). *Ex:* "OAuth expirou". *NÃO é:* uma
decisão de reconectar — só o fato.

**CanalReconectado** — a conexão foi restabelecida. *Impacto:* Canal/Operação.

**CanalRejeitouOperação** — o canal recusou uma operação por permissão/política.
*Produz:* Integrações. *Impacto:* Canal. *NÃO é:* uma falha técnica genérica — é uma
recusa do canal.

### E. Estoque

**EstoqueEsgotou** — um item chegou a zero. *Produz:* ERP/Canal. *Consome:*
Decision. *Impacto:* Produto/Anúncio. *NÃO é:* a pausa do anúncio (consequência
possível).

**EstoqueReposto** — a disponibilidade voltou. *Impacto:* Produto/Anúncio.

**EstoqueDivergiu** — o estoque difere entre a fonte da verdade (ERP) e o canal.
*Impacto:* Anúncio. *NÃO é:* qual dos dois está certo — só que divergem.

### F. Preço

**PreçoMudou** — o preço de um item mudou na fonte. *Produz:* ERP. *Impacto:*
Produto/Anúncio. *NÃO é:* a atualização no canal.

**PreçoDivergiu** — o preço difere entre ERP e canal. *Impacto:* Anúncio. *NÃO é:* um
julgamento de qual é o correto.

**PreçoForaDaFaixaDefinida** — o preço cruzou uma faixa previamente definida.
*Produz:* IA/Sistema. *Impacto:* Produto/Anúncio. *NÃO é:* a definição da faixa (isso
é política — ver §9); o **fato** é o cruzamento, dada uma faixa.

### G. Sistema & Plataforma

**IntegraçãoIndisponível** — a capacidade de observar/agir sobre um canal ficou
indisponível. *Produz:* Sistema. *Impacto:* Canal/Global. *NÃO é:* um canal expirado
(um é técnico do lado da plataforma; o outro é autorização do canal).

**IntegraçãoRestabelecida** — a capacidade voltou. *Impacto:* Canal/Global.

**ProcessamentoAtrasado** — um processamento operacional ficou para trás do
esperado. *Impacto:* Operação/Global. *NÃO é:* uma falha — é um atraso.

### H. Observação (Assistida / Humana)

**OportunidadeDetectada** — a IA **observou** uma oportunidade (lacuna de catálogo,
anúncio com baixo desempenho). *Produz:* IA. *Consome:* Decision. *Impacto:*
Produto/Anúncio/Operação. *NÃO é:* uma sugestão de ação — é o **fato observado**; a
recomendação seria uma Decision.

**AnomaliaDetectada** — a IA observou algo fora do padrão. *Impacto:* variável. *NÃO
é:* um diagnóstico definitivo nem uma ação.

**QualidadeDeConteúdoAbaixoDoEsperado** — a IA observou conteúdo (título/descrição/
foto) abaixo de um padrão definido. *Impacto:* Anúncio/Produto. *NÃO é:* a
reescrita.

**ProblemaRelatadoPeloOperador** — um humano **registrou um fato** observado por
ele. *Produz:* Operador. *Consome:* Decision. *Impacto:* variável. *NÃO é:* uma
ordem — é um fato reportado.

---

## 5. Severidade

Severidade é um **conceito de domínio**: exprime **quão grave é o fato em si**,
independentemente do que se decidirá fazer.

- **Informativo** — fato sem gravidade; registra que algo ocorreu (ex.:
  AnúncioPublicado).
- **Baixo** — fato menor, tolerável por ora (ex.: PreçoDivergiu por centavos).
- **Médio** — merece atenção em prazo normal (ex.: ProdutoDadosIncompletos).
- **Alto** — exige atenção próxima (ex.: AnúncioPausado num item que vende).
- **Crítico** — compromete a operação (ex.: CanalExpirou, IntegraçãoIndisponível).

**Severidade não é prioridade.** Severidade é uma **propriedade do fato** (quão
grave é a realidade). **Prioridade** é uma propriedade de uma **Mission** (qual
trabalho fazer primeiro), decidida por uma **Decision**. Um Signal **Crítico** pode
ser **Descartado** (nenhuma Mission) se o julgamento assim concluir; um Signal
**Baixo** pode gerar uma Mission urgente. A severidade **informa** o julgamento; não
o determina.

---

## 6. Impacto

Impacto exprime o **alcance** do fato — **o que/quem é afetado** — e é modelado
**separadamente** da severidade.

- **Produto** — afeta um item do catálogo.
- **Anúncio** — afeta um anúncio específico.
- **Cliente** — afeta a operação de um cliente.
- **Canal** — afeta um canal (todos os clientes nele, ou a conexão de um).
- **Operação** — afeta a operação de um cliente num canal.
- **Global** — afeta a plataforma inteira.

**Por que impacto e severidade são conceitos diferentes.** Severidade mede
**gravidade**; impacto mede **abrangência**. São eixos independentes: um fato pode
ser de **baixa severidade e impacto global** (um aviso informativo que atinge todos),
ou de **severidade crítica e impacto de um único produto** (um item importante
impublicável). Separá-los evita confundir "quão ruim" com "quão amplo" — distinção
essencial para o julgamento correto.

---

## 7. Regras de geração

1. **Um fato gera exatamente um Signal.** Um acontecimento do mundo corresponde a um
   Signal.
2. **O mesmo fato não gera Signals diferentes.** Cada tipo de fato tem **um** Signal
   canônico; o mesmo acontecimento não se multiplica em tipos distintos.
3. **Signals nunca são editados.** São imutáveis; a evolução da realidade é sempre um
   **novo** Signal.
4. **Signals podem ser ignorados.** Um Signal pode não originar nenhuma Decision.
5. **Signals podem originar múltiplas Decisions.** Um mesmo fato pode ser pesado por
   mais de um julgamento (por operadores/contextos diferentes).
6. **Todo Signal registra quando a realidade mudou** e **sobre qual Alvo** (por
   identidade), sem conter a verdade daquele Alvo.
7. **Signals não têm ordem de execução** — são fatos, não fila de trabalho; ordenar o
   que fazer é papel da Decision/Mission.

---

## 8. Anti-modelos

Nunca deve acontecer:

- **Signal publicando anúncio** (ou executando qualquer trabalho).
- **Signal alterando estado** de Operação/Mission/Action.
- **Signal executando Action** ou disparando execução.
- **Signal como comando** ("publique X") — um Signal nunca é imperativo.
- **Signal contendo regra de negócio** (ex.: decidir "então pause") — julgamento é da
  Decision.
- **Signal conhecendo Missões, Decisions ou a IA.**
- **Signal conhecendo módulos técnicos** (marketplace, banco, integração, broker).
- **Signal carregando a verdade de outro domínio** (dados completos de produto/
  anúncio) em vez de referenciar por Alvo.
- **Signal editado para refletir resolução** — resolução é um novo Signal.
- **Signal derivado de uma Decision** — fatos vêm da realidade, não de julgamentos.
- **Severidade codificando prioridade** — são conceitos distintos.

---

## 9. Questões deferidas

> Pertencem aos próximos documentos.

- **Política de priorização** — como severidade/impacto influenciam a Prioridade de
  uma Mission.
- **IA** — como o Assistente transforma Signals em Decisions propostas.
- **Eventos técnicos** — a forma de propagar Signals (mensageria, contratos).
- **Persistência** — como Signals são armazenados.
- **Retenção** — por quanto tempo Signals vivem e quando arquivam.
- **UX** — como Signals aparecem ao operador.
- **Deduplicação/correlação** — como o mesmo fato observado duas vezes se reconcilia
  em um Signal.
- **Definição de faixas/limiares** — as políticas por trás de fatos como
  "PreçoForaDaFaixaDefinida" e "QualidadeAbaixoDoEsperado".
- **Versionamento da taxonomia** — como novos tipos de Signal entram ao longo do
  tempo.
- **Expiração/obsolescência** — quando um fato deixa de ser relevante.

---

## Critério de longevidade

Esta taxonomia deve permanecer válida ainda que se adicionem marketplaces, se criem
integrações, se substitua a IA, se reescreva o backend ou mude a arquitetura física.
Os Signals representam **fatos permanentes do negócio** ("um anúncio foi pausado",
"faltou estoque", "o canal expirou") — não formatos técnicos. Se um item deste
catálogo só fizer sentido por causa de uma tecnologia específica, ele **não é** um
Signal de negócio e não pertence aqui.
