# INC-006 — O cartão de uma proposta expirada continua oferecendo o botão

```
Status:      LIMITAÇÃO CONHECIDA — documentada, NÃO corrigida
Detectado:   2026-07-31, CICLO B, ao tratar a proposta observacional da Fase 5B
Severidade:  UX. Sem risco de dado: o servidor recusa antes de qualquer escrita
Classe:      servidor seguro, interface enganosa
```

## O fato

A proposta `903c1830-6cb3-488b-962f-c1edb018a60a` nasceu às 00:53 e venceu às
01:23. Doze horas depois continuava `pendente`, e o cartão na tela continuava
mostrando **"Aplicar a 3 variações"**.

## O servidor está correto

A ordem em `app/api/assistente/proposta/route.ts` foi reconstituída e é esta:

```
exigirAutenticado          636   tenant vem da SESSÃO
buscarProposta             660   a proposta vem do BANCO
lerEstadoAtual             661   leitura
podeExecutar               662   existência → tenant → status → EXPIRAÇÃO → precondições
  └─ !pode                 669   RETORNA 409. Nada abaixo executa.
       registrarAcao             recusa auditada, afetados 0
       marcarProposta            `expirada`
reservarParaExecucao       708   ← nunca alcançado
gravar                     728   ← nunca alcançado
```

E em `propostaPersistida.ts`, a expiração (190) é checada **antes** das
precondições (193). Uma proposta vencida é recusada sem ler o mundo e sem
reservar.

> **Expirar não é executar.** O caminho de escrita não é alcançável.

Um detalhe que vale registrar: clicar num cartão expirado **não é inócuo**. Ele
transiciona a proposta de `pendente` para `expirada` e grava uma linha em
`copilot_acoes` com `resultado: "recusada"`. É auditoria, não mutação
operacional — mas é uma alteração, e por isso o cartão real não foi clicado
para produzir esta evidência.

## A interface não sabe

| pergunta | resposta |
|---|---|
| o wire carrega `expiraEm`? | **não** |
| `RespostaDaConversa` declara? | **não** |
| `ChatDaOperacao` guarda? | **não** |
| `estadoDoCartao` conhece tempo? | **não** — só `concluido` (quando há desfecho) e `pendente` |
| a UI calcula expiração? | **não** |

Ela descobre **no clique**, pela recusa do servidor. Aí o cartão vira
`concluido` com a frase *"Essa proposta passou da validade. Peça de novo para eu
recalcular com os dados de agora."* — correta e acionável — e o botão some.

## Por que NÃO foi corrigido neste ciclo

A janela é estreita: a proposta **não sobrevive ao recarregamento**
(`paraGuardar` a exclui de propósito), então o cartão vencido só existe numa aba
deixada aberta por mais de 30 minutos.

E a correção mínima **não é mínima**. Precisaria de:

- `expiraEm` no wire (rota + tipo + parse);
- o turno guardando o campo;
- e um estado novo em **cinco** máquinas de cartão — lote, proposta, cadastro,
  título e preço —, cada uma com seu `estadoDo*`.

Isso é mexer na superfície de confirmação, a mais sensível do produto, para
ganhar a supressão de um clique que já termina com recusa segura e mensagem
correta. O risco da mudança é maior que o do defeito.

**Se for corrigido**, o desenho preferido está desenhado: relógio do cliente
serve para **UX**, nunca como barreira — o servidor continua sendo a autoridade,
e a resposta `409 { motivo: "expirada" }` continua tendo que ser tratada, porque
o relógio do navegador pode estar errado. Sem cancelamento automático, sem
status novo, sem efeito colateral ao detectar.

## Escopo

Vale para **qualquer** proposta do Copilot, não só a de peso: os cinco cartões
têm o mesmo comportamento.

## O que isto NÃO diz

Não diz que a proposta `903c1830…` foi resolvida. Expirar não é executar,
cancelar nem decidir — ela continua `pendente`, aguardando decisão do operador.
