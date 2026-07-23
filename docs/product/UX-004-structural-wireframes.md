# UX-004 — Structural Wireframes

> A estrutura mínima que materializa a Constituição: **6 telas + 1
> primeiro-plano universal**. Nada nasceu de gosto; Vitrine e Decolagem foram
> DESTRUÍDAS como telas (são roupas da Missão).

## O conjunto mínimo

**Moldura persistente** (áreas + Lente quando multi-loja; sem badges) ·
**1 Hoje** (Estado + Fila; absorveu dashboard, notificações e onboarding) ·
**2 Missão** (primeiro-plano universal, polimórfico: F2 perguntas · F3
vitrine · F4 decolagem · F6 demanda — uma tela, sete roupas) · **3
Catálogo→Produto** (duas profundidades) · **4 Anúncios** (presenças no ar) ·
**5 Pulso** (a profundidade do Estado) · **6 Zion** (3 vistas: Conversa ·
Combinados+Regras · Diário).

## Estruturas (ASCII)

```
MOLDURA  [Lente ▾]                    Hoje·Catálogo·Anúncios·Pulso·Zion

HOJE
┌────────────────────────────────────────────────────────────┐
│ ESTADO  "Sua loja está saudável. 291 no ar. Lucro R$ 612." │
│ EXPECTATIVA "o catálogo costuma chegar dia 5"              │
├────────────────────────────────────────────────────────────┤
│ FILA "Hoje preciso de você em 3 coisas"                    │
│ ┌ MISSÃO 1: chamada + por-que-agora + tempo ┐  → 1º plano  │
│ │ MISSÃO 2 (resumida) │ MISSÃO 3 (resumida) │              │
│ vazio-saudável: "Nada precisa de você agora." + expectativa│
└────────────────────────────────────────────────────────────┘

PRIMEIRO-PLANO · MISSÃO (sobre qualquer tela; uma por vez)
┌────────────────────────────────────────────────────────────┐
│ CHAMADA "O catálogo chegou — 340 produtos"    [agora não]  │
│ PREPARO "Cuidei de 312. Sobraram 28 → 15 perguntas."       │
│ DECISÃO (corpo polimórfico — UMA decisão por vez)          │
│ DESFECHO "Feito — 93 no ar. Vigio as vendas."   por quê? → │
│ RASTRO (silencioso → Diário)                               │
└────────────────────────────────────────────────────────────┘

CATÁLOGO→PRODUTO: lista com etiquetas âmbar → detalhe: O QUE
SABEMOS (quem disse → toque) · LACUNAS com destino [responder
→ Missão] · FAMÍLIA · EVIDÊNCIA · histórico discreto

ANÚNCIOS: por canal/estado; como o Comprador vê; estado em
palavras ("pausado — por quê? →")     PULSO: A FRASE + fatos
por canal (SEM nota/score); anomalia → missão no Hoje, nunca
alarme aqui

ZION: [Conversa] fio + respostas de 1 toque · [Combinados &
Regras] evidência+escopo+[desligar] · [Diário] linha do tempo,
erros com o MESMO destaque, [desfazer]
```

## Estados, fluxos e hierarquia

Estados por tela definidos (vazio=onboarding-por-missões; exceção sem
vermelho-pânico; missões expiram declarando-se). **Todos os fluxos F1–F7 têm a
mesma trajetória:** `(evento invisível) → Fila → Primeiro-plano → Desfecho →
Diário` — F1 não toca tela; F7 nasce na vista Conversa. Hierarquia: 1º a
frase de Estado · 2º a 1ª missão · 3º o resto em palavras · consultas nunca
disputam. **Zero navegação exigida para trabalhar.**

## Validação e testes

Cada tela cita PX/UX/DOM/VOC/UI (registrado no documento-fonte da conversa).
**Apple:** mínimo atingido — remover o primeiro-plano destruiria o foco
um-por-vez. **Novo funcionário:** wireframes + contratos UI-001 + VOC-
interface bastam; liberdades restantes = as 3 molduradas (UX-003) + a camada
visual (cadeia `system/`).

**Respostas:** nenhuma tela criou conceito · 11/11 objetos representados ·
nenhuma decisão estética · dentro da Constituição, **esta é a estrutura**.
