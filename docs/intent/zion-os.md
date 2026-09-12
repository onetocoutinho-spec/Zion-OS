# Zion OS — o que é e onde queremos chegar

> Intenção confirmada em 2026-08-25, extraída em entrevista com o dono do projeto.
> Este documento diz **o que** e **por quê**. Não é especificação nem plano.

## O que é

Zion OS é um software de operação de vendas em marketplace, vendido a quem opera loja.

A **agência Zion Company não existe mais**. A Zion é empresa de software e o Zion OS é o
produto. O que antes era o sistema interno de uma agência passa a ser vendido — inclusive
a agências que concorriam com a Zion.

## Quem usa

Dois formatos de conta:

- **Conta de loja** — a equipe da própria lojista opera uma loja.
- **Conta de agência** — a equipe de uma agência opera uma carteira de várias lojas.

O que o `README.md` ainda chama de "painel da equipe" é o embrião da conta de agência,
não uma tela interna da Zion.

## Por que agora

O método que vivia na cabeça dos operadores da Zion já virou código: prontidão da loja,
saúde do catálogo, fila de correção, cota da esteira. Sem agência atrás, ou o sistema
julga sozinho ou ninguém julga.

## Onde queremos chegar

**Uma loja nova assina, importa a base e publica — sem ninguém da Zion em nenhum passo.**

Esse é o marco. Número de contas e MRR são consequência dele, não a meta.

### O que "operar sozinha" significa

O sistema **faz** — importação, imagem, descrição, atributos, publicação — e a equipe da
lojista só **aprova**. Quem sai do caminho crítico é a Zion, não a lojista.

## O que trava hoje

Seis coisas seguram o marco. Cinco são da mesma natureza; a sexta não é.

| # | Trava | Natureza |
|---|---|---|
| 1 | Não há por onde assinar, cobrar e provisionar uma conta | porta de entrada inexistente |
| 2 | A publicação no ML passa por revisão humana do payload (dry-run) | humano no caminho crítico |
| 3 | A importação da base exige mão no mapeamento de ERP | humano no caminho crítico |
| 4 | Geração de imagens | humano no caminho crítico |
| 5 | Geração de descrições | humano no caminho crítico |
| 6 | Preenchimento de atributos de item | **pesquisa em concorrentes** |

A trava 6 é de natureza diferente das outras cinco: hoje alguém vai olhar o que os
concorrentes preencheram naquela categoria do Mercado Livre. Não sai de um prompt melhor;
sai de buscar dado no marketplace. Deve ser escopada separada.

## Limite

Existe **uma única conta pagante**, herdada da época de agência. Ela é a receita e o único
campo de teste ao mesmo tempo.

## Fora de escopo

- A Zion **não** volta a operar loja de cliente para gerar caixa.
- A conta de agência **não** é o primeiro marco — vem depois que uma loja sozinha funcionar.
- Número de contas e MRR **não** são meta desta definição.
