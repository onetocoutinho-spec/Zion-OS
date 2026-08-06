# PLANO-004 — O painel da lojista

```
Data:      2026-08-06
Decisão:   o painel vem ANTES de publicar em escala (dono, 06/08)
Base:      as telas medidas no código e vistas com os dados reais da conta
Continua:  PLANO-003 (a ordem dele muda: este trabalho entra antes do item C)
```

O dono, olhando o portal: *"está feio e não muito funcional"*. São duas queixas
diferentes, e cada uma tem **uma** causa — não cinco.

---

## O que está medido

| tela | cartões de número no topo |
|---|---|
| **Hoje** | **8** |
| Vendas | 8 |
| Auditoria | 7 |
| Precificação | 4 |

Na Precificação, com 50 de 80 produtos sem custo, **~250 células mostram "—"** —
mais de um terço da grade vazio. Na de Produtos, **80 linhas × 3 botões = 240
botões** na tela ao mesmo tempo.

---

## Por que está FEIO

> **Nada tem peso diferente de nada.**

Oito cartões idênticos na tela inicial. Na Precificação, "Risco 17" e
"Prejuízo 0" têm a mesma borda, o mesmo fundo e o mesmo tamanho — um é
emergência, o outro é boa notícia. Toda linha repete os mesmos três botões.
Todo cartão tem a mesma moldura.

Quando tudo grita igual, nada é ouvido. O olho lê isso como "confuso", e
"confuso" é o que "feio" costuma significar num painel de dados. **Não é falta
de cor bonita — é falta de hierarquia.**

## Por que está POUCO FUNCIONAL

> **A tela mostra o inventário, não a decisão.**

Produtos lista 80 igualmente. Precificação lista 80 com metade em branco.
Nenhuma diz *comece por estes três*.

E o trabalho é oferecido POR LINHA quando a causa é COMUM: **50 produtos sem
custo não são 50 problemas, são uma importação.** Oferecer 50 botões para um
problema é o desenho errado, não a quantidade errada.

---

## A regra, e ela já foi provada

A faixa construída em 06/08 na tela de Anúncios é a prova de conceito: pega
1.060 infrações e diz **uma frase** — *"95% do que ele apontou é fotos — 438
anúncios"*. Isso muda o que a lojista faz. As 1.060 não mudavam.

> **Toda tela do portal responde a pergunta dela em UMA frase, no topo, antes
> de qualquer controle ou lista.**

| tela | a pergunta (UX-010) | a frase que falta |
|---|---|---|
| **Hoje** | O que importa agora? | *"3 coisas te custam dinheiro hoje"* |
| **Catálogo** | O que sabemos dos produtos? | *"50 dos 80 não têm custo. Sem isso não sei sua margem."* |
| **Precificação** | — | *"17 produtos vendem abaixo do seu piso"* |
| **Anúncios** | Como dizemos e prometemos? | ✅ já tem |

---

## O plano

### A — "Hoje" responde a pergunta dela

Os 8 cartões viram **uma frase e no máximo três fatos**, ordenados por dinheiro
parado. "Relatórios" sai: é contagem de tela, não fato da loja.

A decisão de *o que entra e em que ordem* vai para um módulo puro com teste
(`oQueImportaAgora`), pelo mesmo motivo de `diagnosticarVitrine`: é onde está o
julgamento, e é a parte que dá para provar sem abrir o navegador.

**Quatro regras que o módulo congela:**

1. **Ordena por dinheiro parado, não por contagem.** 135 anúncios fora do ar com
   598 unidades vêm antes de 50 produtos sem custo.
2. **Agrupa pela CAUSA, não pelo item.** 50 sem custo é UM fato.
3. **Só entra o que tem para onde ir.** Fato sem tela de destino é reclamação.
4. **Teto de três.** Uma lista de oito é a tela de hoje com outro nome.

### B — Hierarquia nas outras telas

Um elemento primário por tela, o resto subordinado. Onde há quatro cartões
iguais, o que exige ação ganha peso e os outros viram texto.

### C — Vocabulário — FEITO (06/08)

"Score IA", "No ar, sem otimização", "veredito A10" são palavras do sistema. As
dela: vende / não vende, dá lucro / dá prejuízo, está no ar / está parado.

**O que mudou.** A escolha do dono foi **"nota do anúncio"**.

| Onde | Antes | Agora |
|---|---|---|
| Produtos, Anúncios, Auditoria | coluna `Score` / `Score IA` | `Nota` |
| Produtos, filtro | `Score` · `Alto/Médio/Baixo` · `Sem score` | `Nota do anúncio` · `Alta/Média/Baixa` · `Sem nota` |
| Ajuda, FAQ | "O que é o Score?" | "O que é a nota do anúncio?" |
| Otimizar, aviso falado | "aprovado no A10" | "aprovado pela IA" |
| Anúncios e Otimizar | "Veredito da IA: aprovado" | "Aprovado pela IA · nota 87/100" |

**O que NÃO mudou, de propósito.** "Otimizar" é o verbo central do produto — é o
que ela vem fazer aqui. "Rascunho" é português comum. Trocar palavra que ela já
entende só para parecer mais simples é ruído. E os NOMES DE DADO ficam:
`scoreQualidade`, `vereditoA10`, `toneScore`. O A10 é o nosso critério, e
critério é coisa nossa — ele pertence ao dado, não à tela.

**A contradição de 03/08 ainda estava viva num segundo lugar.** `Otimizar`
mostrava dois selos com metades do mesmo fato — `Nota 0/100` e
`Veredito: aprovado`, com o valor cru em minúscula. Num anúncio importado, onde
`nota_diagnostico` é zero por ausência de medição, os dois juntos formavam
exatamente a frase impossível que `notaExibivel` existe para impedir. Agora é um
selo só, com `explicarVeredito` — a mesma função que a lista já usava, a uma
importação de distância e nunca chamada ali.

**A troca quebrou o filtro, e a sentinela pegou.** As faixas estavam escritas à
mão em DOIS lugares distantes: as opções do seletor no topo do arquivo e a
classificação lá dentro do `filter`. Renomeei uma e não a outra — "Alta (70+)"
passou a ser comparada com "Alto (70+)", nenhum produto casava, e a tela ficava
vazia sem dizer por quê. Agora há uma função `faixaDaNota` com retorno tipado
como `(typeof SCORES)[number]`: se as duas divergirem de novo, quem reclama é o
compilador. Medido na tela depois do conserto: 2 + 31 + 39 + 8 = 80 produtos, a
partição exata da base.

**A sentinela.** `src/app/cliente/palavrasDela.test.ts` varre o texto visível de
`/cliente` nas três formas em que ele aparece (literal, `prop="texto"`, texto
solto no JSX) e reprova "Score", "A10" e "Veredito". Ela tem os dois testes que
este repositório aprendeu a exigir: um que prova que a varredura leu telas, e um
que prova que ela ENXERGA o defeito — a primeira versão do recorte JSX só aceitava
`>texto<` e passava por cima de `<Pill>Veredito: {x}</Pill>`, que é justamente a
forma do defeito que motivou o item.

### D — Ação em lote no lugar de botão por linha

A única regra que a base de UX confirmou: *"editar um por um é tedioso — use
seleção múltipla; evite ações repetidas por linha"*. Os 240 botões viram uma
barra de ação sobre a seleção.

---

## O que NÃO está decidido

**Trocar a linguagem visual** — paleta, tipografia, grid. Hierarquia e
vocabulário se resolvem com o que já existe; mudar o visual é decisão do dono, e
aí a Fase 5 volta à mesa: `src/design/` está ligado ao app desde 06/08 e nunca
foi usado para desenhar nada.

---

## O risco deste plano, dito uma vez

Em 06/08 a verificação com sessão real achou **três defeitos de tela** e **onze
links mortos** que o portão verde não pegava. Este plano é todo de tela.

**Construir sem ver custa caro aqui**, e a sessão do painel caiu. Cada item
deste plano tem a lógica em módulo puro justamente para que a parte julgável
seja provada — mas a pintura precisa de olho.
