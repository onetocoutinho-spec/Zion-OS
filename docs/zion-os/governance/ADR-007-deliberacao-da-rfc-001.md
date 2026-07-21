# ADR-007 — Deliberação da RFC-001 (Ciclo de Vida da Publication)

- **Órgão deliberante:** Conselho de Arquitetura do Zion OS
- **Origem:** RFC-001 — Ciclo de Vida da Publication (aberta a partir do Blueprint 002)
- **Estado:** **APROVADO**
- **Efeito:** encerra a RFC-001 e autoriza as alterações normativas listadas na §7

---

## 1. Objetivo

Este ADR existe porque a arquitetura do Zion OS encontra-se, neste momento, **em
estado de inconsistência comprovada**. A RFC-001 demonstrou — de forma reproduzível e
independente de tecnologia — que duas regras aprovadas colidem quando aplicadas
simultaneamente a um ciclo comercial ordinário.

**A decisão tornou-se inevitável** por três razões. Primeira: a Constituição determina
que estados impossíveis sejam irrepresentáveis e que transições inválidas nunca
existam; hoje, um caso rotineiro obriga a representar um impossível. Segunda: a
implementação do módulo Publication está **bloqueada** — não se constrói uma máquina de
estados sem caminho válido. Terceira, e mais grave: sem decisão, cada implementação
escolheria **silenciosamente** qual regra violar, produzindo exatamente a deriva que
toda esta arquitetura existe para impedir.

**Papel deste documento na Governança.** Conforme a Governança Arquitetural, o ADR é o
**único artefato que autoriza alteração de documento normativo**, e altera **apenas o
que nomeia explicitamente**. Este ADR encerra o fluxo *Problema → Blueprint → RFC →
Deliberação → ADR* e abre as etapas de atualização e revalidação.

---

## 2. Contexto

*A contradição está provada pela RFC-001 e não é reaberta aqui.* Resumo estritamente
factual:

**A identidade da Publication.** A Arquitetura do Módulo Publication estabelece que a
identidade do agregado é dada pela **combinação do produto referenciado e do canal
pretendido**. Como toda a plataforma colabora por referência de identidade, essa
unicidade é estrutural.

**A terminalidade.** O estado **Encerrada** é terminal. A Constituição determina que de
um estado terminal **não parte transição**, e que **o tempo só anda para frente**.

**O retorno do estoque.** Reposto o item, o negócio deseja o produto novamente presente
**no mesmo canal** — mesmo produto, mesmo canal.

**O impasse lógico.** Reaproveitar a Publication encerrada violaria a terminalidade;
instanciar outra para o mesmo par violaria a unicidade de identidade. **Não há terceiro
caminho** nas regras vigentes. A RFC-001 examinou e refutou quatro interpretações
alternativas.

---

## 3. Alternativas Avaliadas

> Avaliadas **exatamente** as seis famílias registradas na RFC-001. Nenhuma alternativa
> nova foi criada.

### Família A — Alterar a identidade da Publication

**Descrição.** A identidade do agregado deixa de ser a combinação produto+canal. O par
passa a ser o **sujeito** referenciado pela intenção, e a Publication passa a possuir
identidade própria — admitindo intenções sucessivas sobre o mesmo sujeito ao longo do
tempo.
**Benefícios.** Dissolve o impasse na sua raiz; preserva integralmente a terminalidade;
não exige conceito novo; alinha a Publication ao comportamento dos demais agregados da
plataforma.
**Limitações.** Exige uma invariante adicional que impeça duas intenções vigentes
simultâneas sobre o mesmo sujeito.
**Impacto arquitetural.** Restrito ao módulo Publication.
**Impacto sobre o domínio.** Nenhuma verdade muda de natureza; a intenção continua sendo
o que era.
**Impacto sobre os módulos.** Apenas Publication. Operation Center e Integration
continuam referenciando a intenção por identidade, indiferentes à sua composição.
**Impacto sobre o Glossário.** **Nenhum.** As definições de *Publication* e *Identidade*
permanecem literalmente verdadeiras.
**Impacto sobre o Modelo de Consistência.** Nenhum. Nenhum ownership se move.
**Impacto sobre a Máquina de Estados.** **Nenhum.** Terminalidade e sentido do tempo
permanecem intactos.
**Impacto sobre Blueprints existentes.** Blueprint 001 permanece válido; Blueprint 002
deixa de travar.
**Impacto sobre futuras implementações.** Reduz surpresa: a Publication passa a se
comportar como os demais agregados.
**Compatibilidade com a Constituição.** Total. Nenhum documento constitucional é tocado.
**Compatibilidade com a Linguagem Ubíqua.** Total — nenhum termo criado, alterado ou
aposentado.
**Compatibilidade com Ownership.** Total.
**Compatibilidade com Event-Driven.** Total — os fatos publicados permanecem os mesmos.
**Compatibilidade com DDD.** Alta — restaura a distinção entre a **identidade de um
agregado** e o **assunto sobre o qual ele versa**.
**Raio de alteração.** **Mínimo: um documento, uma regra, uma invariante adicional.**

### Família B — Alterar o ciclo de vida da Publication

**Descrição.** Tornar o ciclo não-linear: retirar a terminalidade de Encerrada, ou
acrescentar um estado de interrupção reversível.
**Benefícios.** Endereça diretamente o caso comercial mais frequente (interrupção
temporária).
**Limitações.** **Não resolve a contradição.** Se Encerrada deixa de ser terminal, a
Publication perde a capacidade de terminar definitivamente. Se um estado novo é
acrescentado mantendo Encerrada terminal, o impasse **persiste** para o caso legítimo de
encerramento seguido de retorno.
**Impacto arquitetural.** Módulo Publication e sua máquina de estados.
**Impacto sobre o domínio.** Introduz um novo momento de vida da intenção.
**Impacto sobre os módulos.** Publication; possivelmente Operation Center, que passaria a
observar um estado novo.
**Impacto sobre o Glossário.** **Provável** — um estado novo tende a exigir termo novo.
**Impacto sobre o Modelo de Consistência.** Nenhum.
**Impacto sobre a Máquina de Estados.** Direto, no módulo; conceitual, quanto ao que
"terminal" significa.
**Impacto sobre Blueprints existentes.** Ambos exigiriam reexecução.
**Impacto sobre futuras implementações.** Mais estados a compreender e manter.
**Compatibilidade com a Constituição.** Parcial — a variante que remove a terminalidade
enfraquece uma garantia constitucional que funciona corretamente em todo o resto.
**Compatibilidade com a Linguagem Ubíqua.** Exige ampliação da linguagem.
**Compatibilidade com Ownership.** Total.
**Compatibilidade com Event-Driven.** Novos estados tendem a produzir novos fatos.
**Compatibilidade com DDD.** Média — resolve sintoma, não causa.
**Raio de alteração.** **Médio: um módulo, uma máquina de estados, provável termo novo,
dois Blueprints.**

### Família C — Alterar o conceito de terminalidade

**Descrição.** Revisitar, no plano constitucional, o que "final" significa para
agregados cujo sujeito persiste.
**Benefícios.** Trataria a questão na sua camada mais abstrata.
**Limitações.** Ataca uma regra que **não é a origem do defeito** e que funciona
corretamente em todos os demais agregados da plataforma.
**Impacto arquitetural.** **Constitucional** — atinge toda a plataforma.
**Impacto sobre o domínio.** Enfraquece a noção de desfecho em Decision, Mission, Action
e Communication.
**Impacto sobre os módulos.** **Todos**, presentes e futuros.
**Impacto sobre o Glossário.** Direto — *Estado*, *Transição* e *Terminalidade*.
**Impacto sobre o Modelo de Consistência.** Indireto, porém amplo.
**Impacto sobre a Máquina de Estados.** **Máximo.**
**Impacto sobre Blueprints existentes.** Ambos exigiriam reexecução integral.
**Impacto sobre futuras implementações.** Reintroduz o risco de estados-zumbi que a
terminalidade eliminou.
**Compatibilidade com a Constituição.** **Baixa** — altera a Constituição para corrigir
um defeito de módulo.
**Compatibilidade com a Linguagem Ubíqua.** Exige redefinição de termos centrais.
**Compatibilidade com Ownership.** Neutra.
**Compatibilidade com Event-Driven.** Reduz a confiabilidade da correspondência
evento↔transição.
**Compatibilidade com DDD.** Baixa.
**Raio de alteração.** **Máximo: Constituição, Glossário, todos os módulos, todos os
Blueprints.**

### Família D — Separar intenção de presença de outra forma

**Descrição.** Distinguir o desejo duradouro de estar presente de cada episódio de
realização desse desejo.
**Benefícios.** Modelagem conceitualmente rica; expressa naturalmente a ciclicidade.
**Limitações.** Introduz **conceito novo** e reestrutura o agregado — para um problema
que não exige nenhum dos dois.
**Impacto arquitetural.** Reestruturação do módulo Publication.
**Impacto sobre o domínio.** Um conceito adicional a compreender.
**Impacto sobre os módulos.** Publication diretamente; Operation Center e Integration
possivelmente, por mudança no que se referencia.
**Impacto sobre o Glossário.** **Certo** — ao menos um termo novo, com risco de colidir
com *Presença*, já definida.
**Impacto sobre o Modelo de Consistência.** Exigiria demonstrar que a nova divisão não
fragmenta o ownership da intenção.
**Impacto sobre a Máquina de Estados.** Duas trajetórias a modelar em vez de uma.
**Impacto sobre Blueprints existentes.** Ambos exigiriam reexecução; o 001 descreve o
ciclo hoje unificado.
**Impacto sobre futuras implementações.** Maior superfície conceitual permanente.
**Compatibilidade com a Constituição.** Total em princípio.
**Compatibilidade com a Linguagem Ubíqua.** Exige ampliação e cuidado com colisão
semântica.
**Compatibilidade com Ownership.** Requer verificação adicional.
**Compatibilidade com Event-Driven.** Provável multiplicação de fatos.
**Compatibilidade com DDD.** Alta em elegância; baixa em economia.
**Raio de alteração.** **Alto: módulo reestruturado, termo novo, dois Blueprints.**

### Família E — Reposicionar onde o ciclo vive

**Descrição.** A ciclicidade passaria a ser expressa por um conceito de outro módulo, em
vez do estado da Publication.
**Benefícios.** Reaproveitaria a recorrência já modelada no Operation Center.
**Limitações.** **A intenção é verdade da Publication.** Deslocar seu ciclo de vida
retiraria dela parte daquilo que ela possui.
**Impacto arquitetural.** Redistribuição de responsabilidade entre módulos.
**Impacto sobre o domínio.** A intenção deixaria de ser plenamente governada por seu
dono.
**Impacto sobre os módulos.** Publication e Operation Center.
**Impacto sobre o Glossário.** Provável.
**Impacto sobre o Modelo de Consistência.** **Direto e adverso** — risco de verdade com
dono dividido.
**Impacto sobre a Máquina de Estados.** Indireto.
**Impacto sobre Blueprints existentes.** Ambos exigiriam reexecução.
**Impacto sobre futuras implementações.** Fronteira entre módulos menos nítida.
**Compatibilidade com a Constituição.** **Baixa** — tensiona a lei fundamental de que
cada verdade tem um único dono.
**Compatibilidade com a Linguagem Ubíqua.** Provável ampliação.
**Compatibilidade com Ownership.** **Adversa.**
**Compatibilidade com Event-Driven.** Neutra.
**Compatibilidade com DDD.** Baixa — dilui a fronteira de contexto.
**Raio de alteração.** **Alto, e na direção mais perigosa: o ownership.**

### Família F — Aceitar explicitamente a limitação

**Descrição.** Declarar que uma intenção encerrada é definitiva e que a retomada é caso
distinto.
**Benefícios.** Raio de alteração aparentemente nulo.
**Limitações.** **Não resolve a contradição** — apenas a nomeia. Declarada a
definitividade, o retorno ao mesmo canal continua sem caminho válido: a colisão entre
identidade e terminalidade permanece exatamente onde está.
**Impacto arquitetural.** Nenhum — e é justamente o problema.
**Impacto sobre o domínio.** **Adverso:** subordina o negócio à arquitetura, num ciclo
que é rotina e não exceção.
**Impacto sobre os módulos.** Publication permanece bloqueado.
**Impacto sobre o Glossário.** Nenhum.
**Impacto sobre o Modelo de Consistência.** Nenhum.
**Impacto sobre a Máquina de Estados.** Nenhum.
**Impacto sobre Blueprints existentes.** Blueprint 002 permaneceria travado na Etapa 11.
**Impacto sobre futuras implementações.** Cada equipe resolveria o caso à sua maneira —
**deriva garantida**.
**Compatibilidade com a Constituição.** **Baixa** — mantém representável um estado
impossível e contraria "a tecnologia serve ao domínio".
**Compatibilidade com a Linguagem Ubíqua.** Neutra.
**Compatibilidade com Ownership.** Neutra.
**Compatibilidade com Event-Driven.** Neutra.
**Compatibilidade com DDD.** Baixa.
**Raio de alteração.** **Nulo — porque nada é resolvido.**

---

## 4. Matriz Comparativa

| Critério | A — Identidade | B — Ciclo de vida | C — Terminalidade | D — Separar intenção | E — Reposicionar | F — Aceitar |
|---|---|---|---|---|---|---|
| **Resolve a contradição** | **Sim, integralmente** | Parcial | Sim | Sim | Sim | **Não** |
| Preservação do domínio | Total | Boa | Fraca | Boa | Fraca | Adversa |
| Simplicidade | **Máxima** | Média | Baixa | Baixa | Baixa | — |
| Consistência | Total | Parcial | Reduzida | Boa | Reduzida | Nula |
| Ownership | **Intacto** | Intacto | Neutro | A verificar | **Adverso** | Intacto |
| Explicabilidade | Alta | Alta | Baixa | Média | Baixa | Baixa |
| Estabilidade | **Máxima** | Média | **Mínima** | Média | Baixa | Aparente |
| Evolução futura | Boa | Boa | Arriscada | Boa | Arriscada | Bloqueada |
| Compat. retroativa | **Total** | Parcial | Baixa | Parcial | Parcial | Total |
| Impacto documental | **1 documento** | 2–3 | **Todos** | 2–3 | 2–3 | 0 |
| Impacto na linguagem | **Nenhum** | Provável | **Direto** | **Certo** | Provável | Nenhum |
| Impacto em Blueprints | **001 intacto** | Ambos | Ambos | Ambos | Ambos | 002 travado |
| Impacto em implementações | **Mínimo** | Médio | Máximo | Alto | Alto | Indefinido |
| **Raio de alteração** | **Mínimo** | Médio | **Máximo** | Alto | Alto | Nulo/ineficaz |

A matriz evidencia dois grupos: alternativas que **resolvem sem abalar** (apenas A) e
alternativas que **resolvem abalando** (C, D, E) ou **não resolvem** (B parcialmente, F
integralmente).

---

## 5. Processo Deliberativo

O Conselho eliminou as alternativas na ordem em que se enfraqueceram.

**F foi eliminada primeiro, por não resolver.** Um ADR de deliberação existe para
devolver a arquitetura à consistência. F apenas rebatiza o impasse: com a intenção
encerrada declarada definitiva, o retorno ao mesmo canal continua sem caminho válido.
Além disso, F enfraquece a lei do Manifesto de que **a tecnologia serve ao domínio** — o
ciclo esgotar↔repor é rotina comercial, não caso excepcional. *Princípio enfraquecido:
serviço ao domínio. Impacto: Publication permanece bloqueado e cada equipe improvisa.*

**C foi eliminada em seguida, por desproporção.** Alterar a terminalidade é intervir na
Constituição para corrigir um defeito que nasce em um módulo. A terminalidade **não é a
origem do problema**: ela funciona corretamente em Decision, Mission, Action e
Communication, onde impede estados-zumbi e reescrita do passado. Sacrificá-la
contaminaria toda a plataforma. *Princípio enfraquecido: precedência constitucional e
estabilidade. Impacto: raio máximo.*

**E foi eliminada por tocar o que é intocável.** A intenção de publicação é **verdade da
Publication**. Deslocar seu ciclo de vida para outro módulo dividiria o governo dessa
verdade entre dois donos — a violação mais profunda que a Constituição admite reconhecer.
*Princípio enfraquecido: cada verdade tem exatamente um dono. Impacto: fronteira
diluída.*

**D foi eliminada por economia, não por mérito.** É a alternativa conceitualmente mais
rica, e o Conselho reconhece sua elegância. Mas ela introduz **conceito novo**,
reestrutura o agregado e pressiona o Glossário — inclusive com risco de colisão com
*Presença*, já definida — para resolver um problema que **não exige nenhuma dessas
coisas**. A Governança determina que, resolvendo-se igualmente, vence o menor raio.
*Princípio enfraquecido: simplicidade e estabilidade da linguagem. Impacto: superfície
conceitual permanente maior.*

**B foi eliminada por resolver o sintoma, não a causa.** A RFC-001 já havia registrado
que a ausência de um conceito de interrupção reversível é **lacuna adjacente**, não a
contradição. B endereça o caso frequente e deixa o impasse intacto no caso legítimo de
encerramento seguido de retorno — a menos que se remova a terminalidade, e aí B recai em
C. *Princípio enfraquecido: consistência (resolução parcial). Impacto: dois Blueprints
reexecutados para uma correção incompleta.*

**Permaneceu A — e, ao examiná-la, o Conselho encontrou um argumento constitucional que
torna a escolha inevitável.**

O Glossário define **Identidade** como *"aquilo que distingue uma coisa ao longo de toda
a sua existência"*. Uma intenção que se encerrou e outra que se inicia depois são **duas
existências distintas** — e a definição vigente já as trata como coisas diferentes. Ao
fixar a identidade da Publication como produto+canal, a Arquitetura do Módulo confundiu
**a identidade da intenção** com **o sujeito sobre o qual a intenção versa**. Produto e
canal não são o que a intenção *é*; são aquilo de que ela *trata*.

A confirmação vem da comparação interna: nenhum outro agregado da plataforma é
identificado pelo seu assunto. Uma Mission não é identificada pelo seu Alvo, e por isso
uma nova Mission sobre o mesmo alvo é perfeitamente legítima. A Publication era a
**única anomalia** — e é essa anomalia, e não a terminalidade, que produz o impasse.

Corrigi-la não é inovar: é **restaurar a coerência que o restante da arquitetura já
possui**.

---

## 6. Decisão Oficial

> **O Conselho decide pela Família A — Alterar a identidade da Publication.**
>
> A identidade do agregado Publication **deixa de ser** a combinação produto+canal. O
> produto referenciado e o canal pretendido passam a ser o **sujeito** da intenção,
> referenciados por identidade. A Publication passa a possuir **identidade própria**,
> admitindo intenções sucessivas sobre o mesmo sujeito ao longo do tempo.
>
> **Invariante adicionada:** existe, **no máximo, uma Publication não-terminal (vigente)
> por par produto+canal**. A unicidade que a arquitetura pretendia proteger é preservada
> — mas **no plano da vigência**, não no da existência histórica.

**Por que resolve completamente a contradição.** Encerrada permanece terminal; nenhuma
transição parte dela. O retorno do produto ao mesmo canal passa a ser expresso por uma
**nova intenção** sobre o mesmo sujeito — caminho válido, sem colisão de identidade. Os
dois caminhos antes impossíveis deixam de ser necessários.

**Por que preserva a Constituição.** Nenhum documento constitucional é alterado. A
terminalidade permanece intacta; "o tempo só anda para frente" é honrado — uma nova
intenção avança, não reescreve. Cada verdade continua com um único dono.

**Por que minimiza alterações.** Um único documento normativo é afetado; uma regra é
substituída; uma invariante é acrescentada. Nenhum conceito novo, nenhum termo novo,
nenhuma máquina de estados alterada.

**Por que protege a Linguagem Ubíqua.** Nenhuma definição do Glossário muda. Ao
contrário: a decisão **aplica** a definição vigente de *Identidade* com mais fidelidade
do que a regra que substitui.

**Por que mantém a coerência do domínio.** A intenção continua sendo exatamente o que
era; o que muda é apenas o reconhecimento de que ela é **uma coisa**, e não **um par**.

---

## 7. Alterações Normativas

**Publication — Arquitetura do Módulo.**
*O que será alterado:* na Organização do Domínio, a regra de que a identidade do
agregado é dada pela combinação produto+canal; e o acréscimo da invariante de vigência
única por par produto+canal.
*Motivo:* é a regra que, combinada com a terminalidade, produz o impasse; e a invariante
preserva a unicidade que aquela regra pretendia garantir.
*O que permanece inalterado:* todo o restante do documento — objetivo, responsabilidades,
entidades internas (Listing versionado, Solicitação, Histórico), objetos de valor,
**todos os estados e sua terminalidade**, as demais invariantes, serviços de domínio,
policies, colaboração interna, relação com outros módulos, capacidades transversais e
anti-modelos.

**RFC-001.**
*O que será alterado:* estado, de *Aberta* para *Aceita* e, após a atualização, para
*Arquivada*, com referência a este ADR.
*Motivo:* encerramento formal previsto na Governança.
*O que permanece inalterado:* todo o seu conteúdo — a evidência é preservada
integralmente.

**Nenhum outro documento é alterado por este ADR.** Constituição, Organização, Glossário,
Operation Center, Integration e Blueprints permanecem exatamente como estão.

---

## 8. Impacto Arquitetural

- **Algum módulo muda?** Apenas **Publication**, e apenas na regra de identidade.
- **Algum agregado muda?** A **Publication** — na forma como é identificada, não no que
  é.
- **Alguma entidade muda?** **Não.**
- **Algum Value Object muda?** **Não.**
- **Alguma identidade muda?** **Sim** — exclusivamente a da Publication.
- **Alguma máquina de estados muda?** **Não.** Estados e terminalidade permanecem.
- **Alguma Policy muda?** **Não.**
- **Algum contrato de eventos muda?** **Não.** Os fatos publicados são os mesmos.
- **Algum bounded context muda?** **Não.**
- **Alguma fronteira muda?** **Não.**
- **Algum ownership muda?** **Não.**
- **Alguma definição do Glossário muda?** **Não.**
- **Alguma definição deixa de existir?** **Não.**
- **Algum conceito novo será necessário?** **Não.**

---

## 9. Compatibilidade

- **Manifesto** — compatível. Honra "a tecnologia serve ao domínio": a arquitetura passa
  a acomodar um ciclo comercial rotineiro.
- **Especificação Arquitetural** — compatível; não tocada.
- **Modelo de Domínio** — compatível. Exige que agregados tenham identidade, sem
  determinar sua composição.
- **Máquina de Estados** — **plenamente preservada**; a terminalidade permanece
  inviolada.
- **Modelo de Consistência e Fronteiras** — compatível; nenhum ownership se move.
- **Contrato de Eventos** — compatível; nenhum fato novo, nenhum fato alterado.
- **Arquitetura do Sistema** — compatível; dependências e colaborações inalteradas.
- **Arquitetura dos Módulos** — compatível; a anatomia permanece.
- **Publication** — **revisão pontual**, conforme §7, por conter a regra em conflito.
- **Operation Center** — compatível; referencia a intenção por identidade, indiferente à
  sua composição.
- **Integration** — compatível; jamais conheceu a identidade da intenção.
- **Glossário** — compatível; **nenhuma alteração**. A decisão aplica a definição
  vigente de *Identidade*.
- **Governança Arquitetural** — plenamente observada: evidência (Blueprint), registro
  (RFC), deliberação, ADR, atualização e revalidação.

---

## 10. Plano de Atualização

1. **Aprovação deste ADR.** A partir dela, e somente dela, as alterações da §7 ficam
   autorizadas.
2. **Encerramento da RFC-001.** Marcada como *Aceita*, referenciando este ADR;
   posteriormente *Arquivada*. Seu conteúdo é preservado.
3. **Atualização do documento Publication — Arquitetura do Módulo.** Aplicação **exata**
   do que a §7 autoriza; nada além.
4. **Verificação do Glossário.** Confirmação formal de que **nenhuma definição precisa
   mudar** — etapa de verificação, não de alteração.
5. **Verificação da Máquina de Estados.** Confirmação formal de que **nenhum estado e
   nenhuma regra de terminalidade foram afetados**.
6. **Registro da referência normativa.** O documento alterado passa a indicar o ADR que
   autorizou sua alteração.
7. **Reexecução dos Blueprints** (§11).
8. **Validação arquitetural final.** Declaração de que a arquitetura voltou ao estado
   consistente.

As etapas 4 e 5 são **verificações deliberadas**: em uma decisão cujo mérito é o raio
mínimo, confirmar formalmente o que **não** mudou é parte da prova.

---

## 11. Revalidação Obrigatória

**Blueprint 002 — Estoque Indisponível e Anúncio Ativo.** *Por quê:* originou a
contradição. *Deverá validar:* que a Etapa 11 (retorno do estoque) percorre até o fim,
com o produto voltando a estar presente no mesmo canal por meio de **nova intenção**
sobre o mesmo sujeito. *O que não poderá mais acontecer:* travamento por ausência de
caminho válido; e **jamais** duas intenções vigentes sobre o mesmo par produto+canal.

**Blueprint 001 — Publicação Idempotente.** *Por quê:* depende do documento alterado;
regressão arquitetural é obrigatória. *Deverá validar:* que as doze etapas permanecem
íntegras e que a idempotência de intenção continua garantida. *O que não poderá mais
acontecer:* qualquer divergência em relação ao resultado originalmente validado.

**Novo Blueprint recomendado — Ciclo de Reativação.** Um caso dedicado ao percurso
completo *presente → encerrada → nova intenção → presente novamente*, para validar a
invariante de vigência única sob sucessão e verificar a rastreabilidade histórica entre
intenções sucessivas sobre o mesmo sujeito.

---

## 12. Consequências

**Ganhos obtidos.** A contradição é eliminada na raiz. A Publication passa a se comportar
como os demais agregados, reduzindo surpresa. A terminalidade — garantia valiosa em toda
a plataforma — sai **intacta**. A linguagem sai **intocada**. O bloqueio de implementação
do módulo Publication é removido.

**Trade-offs aceitos.** A unicidade passa a ser garantida **por vigência**, não por
existência: sobre um mesmo par produto+canal poderá haver várias intenções ao longo do
tempo. Isso exige que a invariante de vigência única seja protegida com o mesmo rigor de
qualquer outra. Em troca, ganha-se **história**: a sucessão de intenções torna-se
auditável.

**Limitações remanescentes.** Esta decisão resolve **a contradição**, e apenas ela. A
ausência de um conceito de **interrupção reversível** — registrada pela RFC-001 como
lacuna adjacente — **permanece em aberto**. Se o negócio demonstrar necessidade de
expressar suspensão temporária como estado próprio, o caminho é uma nova RFC, com
evidências próprias. O Conselho **deliberadamente não a resolve aqui**, em obediência ao
princípio do menor raio.

**Riscos assumidos.** O principal é a proliferação de intenções históricas sobre um mesmo
sujeito ao longo de anos, com efeito sobre leitura e auditoria. É risco conhecido,
sem impacto sobre consistência, e monitorável pelo Blueprint de Reativação recomendado.

**Por que a arquitetura fica mais robusta.** Porque uma anomalia foi removida em vez de
compensada. A Publication era o único agregado identificado pelo seu assunto; a decisão
elimina essa exceção. Arquiteturas envelhecem bem quando suas partes se comportam de
forma previsivelmente semelhante — e esta decisão aumenta essa semelhança **reduzindo**,
e não aumentando, a quantidade de regras.

---

## 13. Estado da Governança

- **ADR-007:** **APROVADO.**
- **RFC-001:** **ENCERRADA** — *Aceita*, resolvida por este ADR; a ser *Arquivada* após a
  atualização.
- **Arquitetura:** volta a ser **consistente** após a execução do plano da §10.
- **Interpretação oficial registrada:** *a identidade da Publication é própria; produto e
  canal são o sujeito da intenção; existe no máximo uma Publication vigente por par
  produto+canal; a terminalidade permanece inviolada.*
- **Alcance:** **todos os documentos futuros deverão respeitar esta decisão.** Qualquer
  interpretação divergente exigirá nova RFC e novo ADR.
- **Achados remanescentes do Blueprint 002** — a ausência de observador designado para a
  percepção de disponibilidade e a cardinalidade Decision→Mission — **permanecem
  abertos** e **não são resolvidos por este ADR**.

---

**Registro final.** A Governança Arquitetural cumpriu seu papel: uma contradição real foi
encontrada por um teste, provada por uma RFC, deliberada por este Conselho e resolvida
com o menor raio de alteração possível — **um documento, uma regra, uma invariante** —
sem que a Constituição, a linguagem ou qualquer fronteira fossem tocadas. A arquitetura
evoluiu sem derivar.
