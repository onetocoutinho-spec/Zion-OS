# PLANO-002 — O que construir, depois do que 03/08 derrubou

```
Data:      2026-08-03
Substitui: PLANO-001 nas partes marcadas
Base:      781 anúncios lidos, 6 infrações descobertas, 1 abordagem falsificada
```

O PLANO-001 foi escrito com uma suposição minha no meio. Este corrige, e separa
o que é software do que não é.

---

## O que 03/08 mudou

### FALSIFICADO — o conserto automático de foto

Eu tinha classificado 341 capas como "software resolve: completar as laterais
com fundo branco". **Errado por dois motivos independentes:**

1. O Mercado Livre **apara** a faixa branca no upload. Medido: enviamos
   1200×1200, ele guardou 1062×1200.
2. A regra dele, lida no painel, é *"tamanho mínimo, **posição e proporção do
   produto na foto**"* — o produto tem que **ocupar** o quadro. A faixa branca
   deixa o produto **menor**, piorando o critério cobrado.

A premissa "o ML quer quadrada" era minha. Ele nunca disse isso.

**As 341 capas saem de "software" e vão para "fotógrafo".** O que o Zion faz
bem aqui é medir e priorizar por estoque parado.

### NOVO — infrações, a categoria que não existia no plano

31/07: o ML cancelou **6 anúncios por infração de propriedade intelectual**,
detecção automática, sem motivo revelado. A lojista descobriu abrindo o painel.
**O Zion não sabia que existiam.**

É a única categoria que ameaça a **conta**, não o anúncio. E eu quase mandei
republicar um deles, o que teria sido reincidência.

### ENTREGUE hoje

Leitura completa da conta · estado no marketplace (migração 050) · pausar e
reativar · busca e agrupamento por produto · tela de Pendências ordenada por
dano · medida de tamanho em pares (DES-004) · irmãos da publicação de família ·
detector de aba desatualizada · trava de infração na publicação.

---

## A — Proteção da conta

> A única categoria em que o erro custa a loja inteira, não a venda do dia.

### A1 — Ler as infrações de verdade

Hoje a trava usa `sub_status: forbidden`, que é o sinal **provado** — foi por
ele que as 6 apareceram. Mas ele só enxerga anúncio que **ainda está** no
catálogo importado. Infração de anúncio já apagado da conta é invisível.

O ML tem tela de infrações no painel. **Eu não tenho a rota verificada**, e
chutar endpoint me custou uma tarde em 02/08. Precisa ser descoberta, não
adivinhada.

### A2 — Persistir a infração

`sub_status` **não é gravado**. Toda a análise de infração depende de rodar
"Conferir agora" e some quando a tela recarrega. Uma infração precisa
sobreviver a um F5.

Custo: uma coluna. **É DDL, e exige autorização.**

### A3 — Exercitar a trava

Ela existe e **nunca disparou**. Só dispara quando alguém publicar um produto
com infração aberta — e ninguém deve fazer isso de propósito para testar.

---

## B — O catálogo saber o que sabe

### B1 — Gravar o `sub_status`

Mesmo problema do A2, mais amplo: os 150 `waiting_for_patch`, os 60
`out_of_stock`, os 21 pausados por ela — tudo isso é medido e descartado. Sem
gravar, nenhuma tela consegue mostrar "o que mudou desde ontem".

### B2 — `health` e `catalog_listing` vieram VAZIOS

Foram pedidos e o ML não devolveu nada. Pode ser restrição da conta ou da API.
**Não sabemos**, e a tela hoje mostra silêncio — que é indistinguível de zero.

O conserto da tela é pequeno. Descobrir **por que** vieram vazios é outra coisa.

### B3 — A descrição de verdade

O `descriptions` da API de itens é legado e devolve vazio mesmo quando existe
texto. O `781 sem descrição` que apareceu na tela **não vale**. O texto está em
`/items/{id}/description`.

### B4 — `nota_diagnostico` deveria aceitar NULL

Hoje é `integer NOT NULL default 0`, então "não avaliado" e "tirou zero" são o
mesmo valor. Resolvi com uma marca no JSONB, que é remendo honesto — o certo é
a coluna aceitar ausência. **DDL.**

---

## C — Fotos, reclassificadas

### C1 — DES-003: a foto por cor

**Continua sendo a única coisa de foto que software resolve.** É a causa de *"o
título e/ou as fotos não correspondem ao produto"* — o Papete Zaxy, 33
unidades. A associação foto↔cor nunca existiu.

Desenhado, não implementado. Precisa de aprovação para **quatro** tipos de
imagem, não três.

### C2 — Guardar o original, não a redução

O Zion guarda a variante de 500px do CDN. Se o Estúdio IA ou uma republicação
usar o que está guardado, sobe imagem degradada — e degradada é o que o ML pune.

### C3 — O bucket vazio

As fotos no banco são URLs do CDN do ML, apontando para anúncios que estão
sendo encerrados. O bucket próprio existe e está vazio. Anúncio morto, URL
morta.

### C4 — `imagens_produto` sem índice único

Sem restrição em `(produto_id, tipo_imagem)`, uma segunda "Principal" entra
calada. Pré-requisito de qualquer lote de imagem. **DDL.**

### C5 — Limpar as cópias que meu lote criou

Os anúncios em que rodei o ajuste ganharam 1 ou 2 fotos duplicadas no fim da
lista. Estão atrás da capa e não atrapalham a vitrine. Não é código: é remoção
manual.

---

## D — Publicação, construída e nunca provada

| o quê | falta |
|---|---|
| Publicação Zaxy (DES-004) | uma publicação real |
| Irmãos da família | uma publicação de família |
| Trava de infração | nunca disparou |
| Auto-cadastro | nunca validado em produção |

Cada um tem portão verde e **zero execuções reais**. Portão verde não prova que
o app funciona — foi a lição de 01/08, e se repetiu hoje com o ajuste de capa.

---

## E — A tela

### E1 — Pendências deveria agrupar por produto

Hoje lista variação por variação. O painel do próprio ML agrupa por anúncio-pai
e mostra *"em 19 variações"* — e é mais legível. Já fiz isso em Meus Anúncios;
falta em Pendências.

### E2 — Silêncio ≠ zero, ainda

Saúde e catálogo só aparecem quando o número é maior que zero. "Não veio" e "é
zero" ficam idênticos. Defeito meu, aberto.

---

## F — A parede

**Billing: zero linhas.** Nenhum item acima muda isso.

---

## O que NÃO construir

- **Qualquer conserto automático de foto de capa.** Falsificado hoje, por dois
  motivos independentes. Tentar outro branco para escapar da aparagem seria mais
  um palpite sobre uma regra que nunca li.
- **Republicação de produto com infração aberta.** A trava já recusa; nenhum
  caminho novo deve contorná-la.
- **Endpoint adivinhado.** Duas vezes em dois dias isso custou horas.

---

## A lição que vale mais que a lista

Hoje eu construí, testei com 19 testes, provei em produção e **desliguei** o
ajuste de capa — tudo em poucas horas.

O que evitou o estrago maior não foi a bateria de testes: foi a lojista
reconferir e mandar o print. Os testes validavam a mecânica de uma **premissa
errada**, e testar bem o que se supôs errado não salva ninguém.

Três vezes seguidas no mesmo recurso eu afirmei sucesso verificando o passo
seguinte em vez do resultado: o `PUT` voltou 200 → a capa trocou → o tamanho
ficou. Só o terceiro era o resultado.

**Antes de construir qualquer item desta lista: qual é o resultado observável, e
como ele é medido depois?** Se a resposta for "o código respondeu sem erro", não
é medição.
