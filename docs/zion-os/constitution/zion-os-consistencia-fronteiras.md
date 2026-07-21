# Zion OS — Modelo de Consistência e Fronteiras de Integração (v1)

> **Natureza.** Este documento fecha a **arquitetura conceitual** do Zion OS. Define
> como os domínios convivem preservando autonomia, consistência e responsabilidade.
> Não há banco, API, mensageria, microserviço, infraestrutura ou implementação aqui
> — de propósito. Pertence ao **Zion OS inteiro**, não apenas ao Operation Center.
>
> **Subordinação e âmbito.** Não altera nem contradiz os documentos aprovados; os
> **contém** numa moldura maior. A partir daqui, **qualquer** decisão futura de
> tecnologia, APIs, eventos físicos, persistência ou distribuição deve **respeitar
> esta fundação**.
>
> **Princípio central.** Cada verdade de negócio possui **exatamente um dono**. Todos
> os demais domínios apenas **observam, referenciam ou reagem**. **Nunca** existem
> duas fontes autoritativas para o mesmo conceito.

---

## 1. Objetivo

Fronteiras existem para que cada domínio possa **evoluir, decidir e ser correto por
si**. Sem fronteiras, uma mudança em um lugar quebra outro; com fronteiras claras,
cada domínio responde por uma parte do negócio e o resto apenas precisa **saber** o
que aconteceu.

- **Autonomia reduz acoplamento.** Se um domínio é o único dono de sua verdade e só
  comunica **fatos**, os outros não precisam conhecer suas entranhas. Trocar o
  interior de um domínio não obriga a mexer nos demais.
- **Integração não é compartilhamento de responsabilidade.** Integrar é **trocar
  fatos**, não **co-possuir** verdade. Dois domínios podem cooperar intensamente sem
  que nenhum invada a responsabilidade do outro.
- **Este documento pertence ao Zion OS inteiro.** É a constituição da convivência
  entre domínios — Catálogo, Publicação, Integrações, Operation Center, Clientes &
  Acesso — e da capacidade transversal de IA. Nenhum poderá violá-la.

---

## 2. Princípios

1. **Uma verdade possui um único dono.** Nunca dois donos para o mesmo conceito.
2. **Leitura não implica propriedade.** Observar uma verdade não confere direito de
   alterá-la nem de reafirmá-la.
3. **Integração nunca transfere responsabilidade.** Um fato atravessa domínios; a
   propriedade fica onde nasceu.
4. **Nenhum domínio modifica diretamente outro domínio.** Mudança em uma verdade só
   ocorre pela mão do seu dono.
5. **Domínios comunicam fatos.** Não comandos, não ordens, não intenções — fatos
   consumados.
6. **Estados pertencem ao domínio de origem.** A verdade "agora" de um conceito é do
   seu dono.
7. **Eventos propagam conhecimento, nunca autoridade.** Saber que algo aconteceu não
   dá poder sobre quem o fez.
8. **Referência por identidade, nunca cópia de verdade.** Um domínio aponta para o
   que é de outro; não guarda a verdade alheia como se fosse sua.
9. **Cada domínio é correto por si.** Sua consistência não depende de outro domínio
   estar reagindo.
10. **Fontes externas de verdade são respeitadas, não possuídas.** Onde a verdade
    nasce fora do Zion (marketplace, ERP), os domínios **deferem** a ela.
11. **Consistência nasce de reconciliação de fatos, não de estado compartilhado.**

---

## 3. Mapa dos Domínios

Cada domínio abaixo tem missão, responsabilidade exclusiva, a verdade que representa
e o que **nunca** deve possuir. Só negócio — nada de componentes técnicos.

### Catálogo
- **Missão:** manter a verdade do que o cliente vende, apta a ser operada.
- **Responsabilidade exclusiva:** o **Produto** (identidade, atributos,
  completude para venda).
- **Verdade que representa:** "o que existe no catálogo do cliente e em que
  condição".
- **Nunca deve possuir:** anúncios, canais, prioridades, execução em marketplace.

### Publicação
- **Missão:** transformar Produto em presença de venda e mantê-la fiel.
- **Responsabilidade exclusiva:** o **Anúncio** (a presença pretendida no canal) e a
  **execução** de publicar/atualizar/corrigir.
- **Verdade que representa:** "como o Produto se manifesta como anúncio, do lado do
  Zion".
- **Nunca deve possuir:** a verdade do Produto, a conexão do canal, a decisão de
  prioridade, a operação.

### Integrações
- **Missão:** ser a fronteira do Zion com o mundo externo (marketplaces, ERP).
- **Responsabilidade exclusiva:** a **Conexão com o marketplace** (autorização,
  saúde da conexão) e a **comunicação** com sistemas externos.
- **Verdade que representa:** "o estado da ponte entre o Zion e cada sistema
  externo".
- **Nunca deve possuir:** Produto, Anúncio, prioridade, operação; nem a verdade que
  vive **dentro** do marketplace/ERP.

### Operation Center
- **Missão:** governar a atenção da operação — decidir o que merece ser feito e
  coordenar que seja feito.
- **Responsabilidade exclusiva:** **Operação, Signal, Decision, Mission, Action,
  Result**, **Saúde Operacional** e **Indicadores**.
- **Verdade que representa:** "o estado da operação e do trabalho sobre ela".
- **Nunca deve possuir:** Produto, Anúncio, Conexão, nem a execução técnica de nada.

### Clientes & Acesso
- **Missão:** saber quem são os clientes e quem pode operar o quê. *(Introduzido com
  justificativa: toda verdade acima é sobre um cliente e sob autorização; alguém
  precisa ser o dono único dessas duas verdades, hoje difusas.)*
- **Responsabilidade exclusiva:** a **Identidade do Cliente/Conta** e a
  **Autorização** (quem opera quem).
- **Verdade que representa:** "quem existe e quem pode agir".
- **Nunca deve possuir:** Produto, Anúncio, operação, conexão.

### IA (capacidade transversal — **não** é domínio de negócio)
- Atravessa todos os domínios, **não possui nenhum**. Conhece, interpreta, explica,
  recomenda. Não tem verdade própria. (Detalhado na Arquitetura da IA.)

### Fontes externas de verdade (fora do Zion)
- **Marketplace** — dono da verdade **viva** do anúncio (estado real no ar, políticas
  do canal) e da conta.
- **ERP do cliente** — dono da verdade de **estoque e preço** na origem.
- O Zion **defere** a essas fontes: observa-as e mantém **visões reconciliadas**,
  nunca as sobrescreve. *(Vendas/Pedidos, cuja verdade também nasce no marketplace, é
  reconhecido como domínio futuro — ver §11.)*

---

## 4. Donos da Verdade

Cada conceito importante tem **um** proprietário:

- **Produto** → **Catálogo.** É a verdade do que se vende; precisa de um único lugar
  íntegro.
- **Anúncio (pretendido)** → **Publicação.** A presença que o Zion quer manter é
  intenção do Zion.
- **Estado vivo do anúncio no canal** → **Marketplace (externo).** Quem manda no que
  está de fato no ar é o canal; Publicação mantém uma **visão reconciliada**.
- **Conexão com marketplace** → **Integrações.** A ponte é responsabilidade de quem a
  mantém.
- **Conta no marketplace** → **Marketplace (externo).**
- **Estoque e Preço (origem)** → **ERP (externo).** O Zion observa; não é dono.
- **Operação** → **Operation Center.** O estado de operar é do OC.
- **Signal, Decision, Mission, Action, Result** → **Operation Center.** São o laço do
  domínio dele.
- **Saúde Operacional** → **Operation Center** (derivada; ninguém a "seta").
- **Indicadores** → **Operation Center** (derivados da operação).
- **Identidade do Cliente** e **Autorização** → **Clientes & Acesso.**

Por que exclusividade: se dois domínios pudessem afirmar a mesma verdade, haveria
**duas realidades** para o mesmo fato — e o sistema deixaria de ter uma resposta
única para "o que é verdade agora". A propriedade única é o que torna cada resposta
**inequívoca**.

---

## 5. Fronteiras

Para cada domínio, pela ótica do negócio: o que **conhece**, **observa**, **publica**,
**consome**, **nunca modifica**, **nunca deve conhecer**.

### Catálogo
- **Conhece:** seus Produtos. **Observa:** fatos do ERP (estoque/preço) que afetam a
  aptidão do produto. **Publica:** fatos de Produto (recebido, atualizado, apto,
  incompleto, descontinuado). **Consome:** identidade do Cliente. **Nunca modifica:**
  Anúncio, Conexão, Operação. **Nunca deve conhecer:** prioridade, missões, mecânica
  do marketplace.

### Publicação
- **Conhece:** seus Anúncios (pretendidos) e a visão reconciliada do que está no ar.
  **Observa:** fatos de Produto e respostas do canal (via Integrações). **Publica:**
  fatos de Anúncio (publicado, falhou, pausado, reativado, divergiu, encerrado).
  **Consome:** Produto (referência), conexão (estado). **Nunca modifica:** Produto,
  Conexão, Operação. **Nunca deve conhecer:** prioridade, missões, autorização.

### Integrações
- **Conhece:** as Conexões e o estado da ponte com cada externo. **Observa:** o mundo
  externo (marketplace/ERP). **Publica:** fatos de Canal (conectado, expirou,
  reconectado, rejeitou) e as respostas externas. **Consome:** identidade do Cliente.
  **Nunca modifica:** Produto, Anúncio, Operação. **Nunca deve conhecer:** prioridade,
  missões, o significado operacional dos fatos que transporta.

### Operation Center
- **Conhece:** Operação, Signal, Decision, Mission, Action, Result, Saúde,
  Indicadores. **Observa:** fatos de Catálogo, Publicação, Integrações, ERP.
  **Publica:** fatos do seu laço (decisão comprometida, missão concluída, ação
  solicitada, resultado…). **Consome:** referências a Produto/Anúncio/Canal (por
  identidade) e autorização. **Nunca modifica:** Produto, Anúncio, Conexão, nem a
  verdade externa. **Nunca deve conhecer:** a mecânica interna de publicar ou de falar
  com o marketplace.

### Clientes & Acesso
- **Conhece:** clientes e autorizações. **Observa:** pouco — é fonte, não observador.
  **Publica:** fatos de cliente/acesso (cliente habilitado, acesso concedido/revogado).
  **Consome:** nada essencial dos demais. **Nunca modifica:** qualquer verdade
  operacional. **Nunca deve conhecer:** produto, anúncio, operação em detalhe.

### IA
- **Conhece e observa** tudo o que os domínios expõem como fato. **Não publica
  verdade** (pode produzir **fatos de observação**, nunca verdades de domínio).
  **Nunca modifica** estado de domínio algum. **Nunca deve conhecer** a si mesma como
  dona de nada.

---

## 6. Modelo de Consistência

Em linguagem de domínio — sem banco, replicação ou protocolo:

- **Verdade local.** Cada domínio guarda **a sua** verdade e responde por ela. É o
  único que pode afirmá-la ou mudá-la.
- **Referência por identidade.** Quando um domínio precisa falar de algo de outro, ele
  guarda apenas uma **referência** (uma identidade), não uma cópia da verdade alheia.
  A Missão aponta para um Produto; não o contém.
- **Observação.** Um domínio fica sabendo de fatos de outro **observando** o que ele
  publica — sem tocar em seu estado.
- **Propagação de fatos.** O conhecimento viaja como fatos consumados; cada domínio
  que observa **atualiza o seu entendimento**, não a verdade do outro.
- **Atualização de contexto.** Ao receber um novo fato, um domínio **refresca a visão
  referenciada** que mantém — mantendo seu contexto vivo sem virar dono do que
  referencia.
- **Reconciliação.** Quando uma **visão reconciliada** (ex.: o que Publicação acha
  que está no ar) diverge da **fonte de verdade** (o marketplace), o dono da visão
  **re-observa a fonte** e realinha. A fonte de registro sempre vence a cópia.
- **Consistência eventual.** O sistema **não** exige que todos os domínios concordem a
  cada instante. À medida que os fatos se propagam, cada domínio **converge** para uma
  visão coerente. A verdade é única em cada dono; a **concordância entre domínios** se
  dá ao longo do tempo, não instantaneamente.

O ponto essencial: **consistência não é estado compartilhado; é fatos que fluem e
visões que convergem.** Ninguém segura um pedaço da verdade do outro; cada um mantém a
sua e se atualiza observando.

---

## 7. Transferência de Responsabilidade

Um fato atravessa os domínios **sem** que a propriedade atravesse junto. Exemplo
conceitual:

- **O Produto muda** (na origem, o ERP; ou por edição no Zion).
- **Catálogo registra** — atualiza a verdade do Produto, que é **sua**.
- **Publicação observa** — atualiza sua visão do Produto e pode formar a intenção de
  refletir a mudança no anúncio. A verdade do Produto **continua** do Catálogo.
- **Integrações executam** — comunicam a mudança ao marketplace. A verdade do Anúncio
  pretendido **continua** da Publicação; a conexão **continua** das Integrações.
- **O marketplace responde** — a verdade **viva** do anúncio é dele; o Zion recebe a
  resposta como fato.
- **Operation Center observa** — o desfecho vira um **Signal**; se merecer, uma
  Operação/trabalho nasce. A verdade do Produto/Anúncio/Canal **nunca** virou do OC.

O princípio por trás: **em cada salto, o que cruza é conhecimento, não autoridade.**
Cada domínio faz **a sua parte, dentro da sua fronteira**, e passa adiante um **fato**.
Nenhum estende a mão para dentro do outro. A responsabilidade fica parada; só o
**saber** se move.

---

## 8. Relação com o Operation Center

O Operation Center **coordena**, não executa nem possui. Concretamente, o OC:

- **Nunca executa integrações** — quem fala com o mundo externo é Integrações.
- **Nunca altera Produto** — a verdade do Produto é do Catálogo.
- **Nunca altera Anúncio** — a verdade do Anúncio é da Publicação.
- **Nunca controla o marketplace** — o canal é externo; a ponte é de Integrações.
- **Nunca é dono de conexões** — conexão é de Integrações.
- **Coordena a operação usando fatos produzidos pelos demais domínios** — observa
  Produto/Anúncio/Canal/ERP como fatos, julga (Decision), compromete trabalho
  (Mission) e **solicita** passos (Action) que os donos executam.

O OC é o **maestro**: rege o conjunto, mas não toca os instrumentos dos outros.

---

## 9. Relação com a IA

A IA **atravessa todos os domínios sem possuir nenhum**. Ela:

- **Conhece** os fatos que os domínios expõem.
- **Interpreta** o que eles significam para a operação.
- **Explica** prioridades, consequências e recomendações.
- **Recomenda** julgamentos e caminhos, sempre justificados.
- **Nunca se torna dona da verdade** — não afirma verdade de domínio algum.
- **Nunca substitui um domínio** — não vira Catálogo, Publicação, Integrações nem OC.
- **Nunca rompe fronteiras** — passa pelos mesmos portões e respeita as mesmas
  propriedades que qualquer ator.

A IA é uma **lente e um copiloto** sobre a arquitetura, jamais um domínio-sombra por
cima dela.

---

## 10. Anti-modelos

Erros arquiteturais que nunca devem acontecer:

- **Catálogo publicando anúncios** (assumindo verdade da Publicação).
- **Publicação alterando Produto** (invadindo o Catálogo).
- **Integrações decidindo prioridades** (invadindo o Operation Center).
- **Operation Center chamando o marketplace** (invadindo Integrações).
- **IA criando domínio próprio** (virando um "segundo sistema" com verdade própria).
- **Duplicação da verdade** — dois donos para o mesmo conceito.
- **Leitura confundida com propriedade** — observar e passar a reafirmar/alterar.
- **Eventos como mecanismo de controle** — usar fatos para comandar outro domínio.
- **Um domínio modificando o estado de outro** diretamente.
- **Cópia tratada como fonte de verdade** — uma visão referenciada usada como
  autoritativa.
- **Sobrescrever a fonte externa** — um domínio do Zion reescrevendo a verdade do
  marketplace/ERP.
- **Correção de um domínio dependendo da reação de outro** — acoplamento pela porta
  dos fundos.
- **Responsabilidade transferida via integração** — mudar quem é dono por conveniência
  de fluxo.

---

## 11. Questões deferidas

> Pertencem a documentos futuros e à infraestrutura.

- **APIs** e contratos técnicos entre domínios.
- **Mensageria** e transporte de fatos.
- **Persistência** de cada verdade local.
- **Observabilidade técnica** e rastreamento entre domínios.
- **Versionamento** de contratos e fatos.
- **Escalabilidade** e **distribuição física**.
- **Mecanismo de reconciliação** (a técnica do realinhamento com a fonte).
- **Segurança e mecanismo de autorização** (o *conteúdo* é de Clientes & Acesso; o
  *mecanismo* é futuro).
- **Domínio de Vendas/Pedidos** (verdade nascida no marketplace) — reconhecido, ainda
  não modelado.

---

## Critério de longevidade e fechamento

Este documento deve permanecer correto ainda que toda a tecnologia seja substituída, o
Zion deixe de usar microserviços, novos marketplaces e módulos surjam, ou a IA seja
trocada por completo. Ele representa **apenas a arquitetura conceitual** do Zion OS.

Com ele, a **arquitetura conceitual do Zion OS está fechada**: missão, domínio,
estados, sinais, priorização, IA, eventos e — agora — fronteiras e consistência entre
todos os domínios. Toda decisão futura de tecnologia, infraestrutura, APIs, eventos
físicos, persistência ou implementação **deve respeitar esta fundação**. Se algum dia
uma verdade tiver dois donos, uma leitura virar propriedade, ou um evento virar
comando, não é a arquitetura que amadureceu — é esta constituição que foi rompida.
