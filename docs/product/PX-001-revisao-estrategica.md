# PX-001 — Revisão Estratégica: Recentrar o Zion OS no Produto

> 2026-07-23 · A revisão que recolocou o produto no centro. Fontes: Manifesto
> Arquitetural, constituição do Operation Center, Roadmap canônico (Obsidian),
> memória do pivot self-service.

## 1. A visão original, reconstruída

**O que o Zion OS é** (Manifesto): *"Não um painel, não um conjunto de telas,
não um integrador — mas a camada que governa a operação de e-commerce...
transformar o caos em um fluxo disciplinado, priorizado e explicável."*

**O produto:** pegar o catálogo bagunçado de um lojista e transformá-lo em
anúncios vencedores, publicados e saudáveis nos marketplaces — com a IA fazendo
o trabalho pesado e o humano só aprovando.

**A experiência sonhada** (constituição do Operation Center, escrita ANTES do
motor): *"transformar 26 telas em um fluxo priorizado, guiado e assistido por
IA"*; *"agentes crus expostos = problema; IA única e invisível embutida nas
missões"*. O dia de uso: abre → saúde em uma frase → fila de missões priorizada
→ a IA guia → o humano confirma → resultado vira indicador. **Sinal → Missão →
Execução assistida → Resultado.** E o pivot: o próprio lojista operando
sozinho, com UX autoexplicativa.

**A visão de IA:** Zion Intake (catálogo → Produto Mestre, idempotente) +
Workforce A0–A12 ("nunca inventar dado", trava A10) + Estúdio IA, com o
aprendizado contínuo (AIL) como camada **lateral e invisível** (ARQ-003: "a
linguagem interna da AIL não vaza para os Contextos").

## 2. Onde perdemos o foco

| Momento | O que aconteceu |
|---|---|
| Até o PR-006 | ✅ no rumo: loops de aprendizado invisíveis dentro da operação real |
| PR-007 → AR-001 | o programa virou **para dentro** (5 ciclos sobre o próprio motor); o lojista sumiu do loop |
| E4.0 / E5.6 | **a inversão**: Pattern Browser e DI Center no menu principal, com vocabulário interno — violando a 002 §11 e o próprio OC |
| E5.x | Runtime como fim em si (11 itens sobre 1 decisão real) enquanto E3/Intake/missões congelavam |
| "Cara de ERP" | navegação por substantivos (entidades+CRUDs) em vez de missões — o OC nunca saiu da constituição |

**Diagnóstico:** construímos um cérebro auditável de primeira linha e o
penduramos num corpo de ERP — quando o sonho documentado era um corpo de fila
de missões com IA invisível.

## 3. O que preservar — a Decision Intelligence no lugar certo

Nada se joga fora; muda o endereço. Journal/Detector/Engine/Outcomes/Evolution
seguem intocados e invisíveis. `MemoriaContextual` é o único rosto correto
(silenciosa, contextual) — modelo para tudo. Pattern Browser / DI Center viram
**ferramentas do mantenedor** (admin). Knowledge/Delegation são o mecanismo da
autonomia progressiva — o cliente jamais verá esses nomes; verá *"posso cuidar
disso sozinho daqui pra frente?"*.

## 4. O verdadeiro programa de produto (jornada, não módulos)

| Etapa | O cliente vive | Já existe por baixo |
|---|---|---|
| X1 Onboarding em minutos | conectar → importar → operação viva | OAuth ✅, importação ✅ |
| X2 Cadastro Inteligente | o Zion diz O QUE FALTA como missões | Intake + pendências + E3.2.1 |
| X3 Anúncios Vencedores | esteira invisível, revisão pronta | A0–A12 ✅, Estúdio ✅, A10 ✅ |
| X4 Publicar sem medo | massa, idempotente, retry seguro | **E3.1.1 — tranca nº 1** |
| X5 Saúde & Lucro | anúncios doentes viram missões; lucro real | Vendas ✅ + custos + sinais→missões |
| X6 Automação Progressiva | "deixar o Zion cuidar disso" | toda a DI, esperando invisibilidade |

**Espinha dorsal:** a fila de missões (o OC saindo da constituição para a tela).

## 5. Visão de longo prazo

> **O Zion OS é a plataforma de IA que opera marketplaces: o lojista entrega o
> catálogo e aprova decisões; o Zion faz o resto — cada vez mais sozinho,
> sempre explicável, sempre com volta.**
