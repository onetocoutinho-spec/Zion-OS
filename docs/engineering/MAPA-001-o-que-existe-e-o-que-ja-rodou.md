# Mapa — o que existe × o que já rodou

```
Pergunta:  "conseguimos deixar ela 100% funcional?" — 04/08/2026
Resposta:  a pergunta não tinha como ser respondida, e este documento é o porquê
Método:    LEITURA de código, relatórios e incidentes. Nenhuma telemetria.
Base:      master 9d1ee78 + PR #197
```

> Este mapa é a melhor aproximação possível **hoje**, e ele existe para deixar
> de ser necessário. Cada linha aqui foi inferida lendo comentários datados e
> relatórios — não medida. A migração 054 é o que substitui isto por dado.

---

## 1 · Por que este documento existe

Duas perguntas do dono, no mesmo dia:

> *"eu realmente tenho que ficar tirando print do que realmente não funciona?"*
>
> *"será que conseguimos deixar ela 100% funcional ainda hoje?"*

A segunda não tinha resposta, e a razão não é falta de esforço: **não existe, em
lugar nenhum, a lista do que o sistema faz nem o registro do que já funcionou.**
Não se declara 100% de um sistema que não conta nada — só se acha.

Este mapa monta essa lista à mão, uma vez, para tornar a pergunta respondível.

---

## 2 · O que conta como evidência

O projeto tem um hábito bom que torna isto possível: **medições reais viram
comentário datado no código.** `Medido em 02/08/2026 na conta dela: 993x1200`.
São 28 dessas no repositório, e cada uma é a prova de que aquele caminho falou
com o mundo real ao menos uma vez.

| grau | o que significa |
|---|---|
| **RODOU** | há número/data de uma execução real contra a conta da Chinelaria |
| **RODOU (versão antiga)** | rodou, mas o código foi reescrito depois e a nova versão não |
| **DEPLOYADO** | está no ar, com teste passando, sem nenhuma execução real conhecida |
| **SEM EVIDÊNCIA** | nada encontrado — pode ter rodado e não ter deixado rastro |

A última linha é o ponto de tudo: **"sem evidência" não é "não funciona".** É
"não sabemos", e é a categoria que a 054 elimina.

---

## 3 · A distinção que muda tudo

> **"A capacidade já rodou" e "o código que está no ar já rodou" são coisas
> diferentes — e a segunda é a que importa.**

O caso que ensina isso está inteiro no repositório:

- Em **01/08**, a publicação do Papete Modare **criou dois anúncios reais no
  Mercado Livre** (`MLB4980127845` e `MLB4980078561`). A publicação funciona:
  há dois MLBs no mundo para provar.
- O Zion gravou **só o primeiro**. O segundo ficou órfão, e a importação da
  noite o trouxe de volta como produto duplicado.
- O conserto (`irmaosDaFamilia`, uma linha por MLB) foi escrito em **02/08** —
  e **nunca rodou**.

Então "publicar funciona" é verdade e é inútil: o que está no ar hoje é código
que nunca publicou nada. Toda correção não exercida carrega esse risco, porque
a confiança vem de uma versão que não existe mais.

É o mesmo formato do quinto caminho da capa: quatro caminhos consertados, um
quinto intacto, e a prova de que "a regra está certa" não cobria "alguém a usa".

---

## 4 · As fontes existentes se contradizem

E esta é a prova de que a lista precisava existir. Dois documentos, **commitados
no mesmo dia (02/08)**:

| documento | o que afirma |
|---|---|
| `INC-009` | *"o caminho de publicação **não é exercido desde 20/07**"* |
| `irmaosDaFamilia.ts` | *"**Observado em 2026-08-01**: a publicação do Papete Modare criou dois anúncios"* |

Os dois não podem estar certos. Ninguém percebeu, e não por descuido: para
perceber seria preciso ler os dois no mesmo dia e lembrar de comparar. É
exatamente o trabalho que uma lista faz e uma pessoa não faz.

---

## 5 · Leitura do Mercado Livre — a área mais provada

| capacidade | grau | evidência |
|---|---|---|
| importar anúncios | **RODOU** | 781 anúncios da conta, 01/08 · export do ERP com 561 |
| diagnóstico de infrações | **RODOU** | 1.060 infrações declaradas pelo ML, 03/08 |
| diagnóstico de item / guias | **RODOU** | 129 em `waiting_for_patch`, 03/08 |
| estado no marketplace | **RODOU** | 51 `paused_by_seller`, 03/08 · 155 de 781, 01/08 |
| quadrar capa (leitura do `max_size`) | **RODOU** | 341 capas fora do padrão, 02/08 |
| vendas | **RODOU** | medido 03/08 |
| custos do ML | **SEM EVIDÊNCIA** | — |

Esta é a metade do sistema que se pode afirmar que funciona, e ela é a razão de
o retrato da loja existir.

---

## 6 · Escrita no Mercado Livre — onde mora o risco

| capacidade | grau | o que falta |
|---|---|---|
| publicar | **RODOU (versão antiga)** | 2 MLBs reais em 01/08; o conserto dos irmãos nunca rodou |
| irmãos da família | **DEPLOYADO** | zero execuções — nasceu do defeito acima |
| encerrar anúncio | **SEM EVIDÊNCIA** | — |
| quadrar capa (escrita) | **SEM EVIDÊNCIA** | a leitura rodou; trocar a capa no ML, não consta |
| pausar/reativar pela tela | **SEM EVIDÊNCIA** | `estadoDoAnuncioML` só grava o confirmado — nunca visto confirmar |
| **`reativar_anuncio` (chat)** | **DEPLOYADO** | *"nunca falou com o Mercado Livre"* — handoff §4 |
| publicação Zaxy · auto-cadastro | **DEPLOYADO** | zero execuções reais |

**Nenhuma escrita no ML tem evidência de ter funcionado com o código atual.** A
única que comprovadamente escreveu foi a publicação, numa versão que foi
substituída — e foi substituída justamente porque escreveu errado.

O runbook `validacao-reativar-pelo-chat.md` cobre o primeiro caso: seis fases,
a tela como grupo de controle, duas leituras independentes. Exige sessão da
lojista. **O caso que decide não é o sucesso** — é o ML responder `under_review`
e o modelo dizer que *pediu*, não que está no ar.

---

## 7 · O chat

As 17 ferramentas, por efeito declarado em `ferramentasDoAssistente.ts`:

| efeito | quantas | grau |
|---|---|---|
| `le` | 10 | **RODOU** — medido 03/08 na conta real |
| `propoe` | 5 | **RODOU** — INC-003/004/005/008 são incidentes de uso real |
| `rascunha` | 1 | **SEM EVIDÊNCIA** |
| `executa` | 1 (`reativar_anuncio`) | **DEPLOYADO** — nunca falou com o ML |

Os incidentes são, por si, prova de execução: só se descobre que *"o agente
narra fato sem consultar"* (INC-003) porque alguém conversou com ele de verdade.

**A trava de infração nunca disparou** — e o handoff é explícito em que ela
**não deve** ser testada de propósito, porque `PI_FAKES` ameaça a conta.

---

## 8 · Catálogo, imagem e esteira

| capacidade | grau | evidência |
|---|---|---|
| subir foto | **RODOU** | testado pela lojista em 04/08 — 6 fotos, uma capa só |
| melhorar capa (Estúdio IA) | **RODOU** | 04/08, resultado usável |
| gerar infográfico | **RODOU, e o resultado reprova** | saiu genérico — conserto é D2/D3, não frase |
| registrar foto por URL (`AbaImagens`) | **DEPLOYADO** | consertada hoje; nunca exercida depois |
| trocar capa / promover a capa | **DEPLOYADO** | idem |
| importar produtos (CSV) | **RODOU** | 73 produtos, 01/08 |
| importar custos | **RODOU** | 1.806 produtos — e o incidente que ensinou o upsert |
| peso em lote | **RODOU** | INC-002 nasceu daqui |
| esteira / worker de otimização | **SEM EVIDÊNCIA** | 791 anúncios contados como "otimizados" (03/08) é *contagem*, não execução |
| observabilidade (054) | **NÃO APLICADA** | escrita hoje; a tabela não existe em produção |

⚠️ **Infográfico não deve ser publicado como está.** Texto em imagem é afirmação
ao comprador, e afirmação é onde o ML pune esta conta (110 `DOMAIN`).

---

## 9 · O placar

Contado por **linha das tabelas acima** — 28 linhas, 27 capacidades distintas
(`reativar_anuncio` aparece duas vezes, em §6 e §7, e é descontado aqui). As
17 ferramentas do chat entram como **2 linhas** (`le` e `propoe`), não como 15:
inflar o denominador com o que é barato de provar tornaria o placar mais bonito
e menos verdadeiro.

| grau | capacidades |
|---|---|
| **RODOU** (código atual) | 14 |
| **RODOU (versão antiga)** | 1 |
| **DEPLOYADO**, nunca exercido | 5 |
| **SEM EVIDÊNCIA** | 6 |
| **não aplicada** (054) | 1 |

O que este placar diz, e é a resposta honesta à pergunta de origem:

**A leitura do mundo está provada. A escrita no mundo, não.** O sistema sabe
enxergar a loja — 781 anúncios, 1.060 infrações, 341 capas — e não há um único
caminho de escrita no Mercado Livre com evidência de ter funcionado com o código
que está no ar hoje.

Isso não é um sistema pela metade. É um sistema cuja metade arriscada nunca foi
exercida, e que até hoje não tinha como saber disso.

---

## 10 · O que fazer com este documento

1. **Aplicar a 054.** Enquanto ela não estiver no ar, a coluna "grau" continua
   sendo inferência minha, e este documento envelhece no dia em que for escrito.
2. **Validar `reativar_anuncio`** pelo runbook. É a maior linha de risco: no ar,
   com efeito no mundo, e nunca exercida.
3. **Não confiar em "já funcionou"** sem perguntar *em qual versão*. A §3 é a
   regra geral, não uma curiosidade sobre o Papete.
4. **Depois da 054, este mapa ganha a coluna que hoje falta** — o que de fato
   falhou, dito pelo sistema, em vez de deduzido por leitura.

E o teste que decide se hoje valeu:

> **Na próxima vez que algo quebrar, você descobre sem tirar print?**
