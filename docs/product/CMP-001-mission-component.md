# CMP-001 — Mission Component Specification

> A especificação definitiva do componente Mission — implementável em React,
> Flutter, SwiftUI ou Compose sem decisão arquitetônica. Derivado de
> Constitution · UX-004 · UI-001 · SYS-001 · SHELL-001 · SHELL-002. Onde a
> Constituição não decide, a lacuna é declarada.

## 1 · Identidade

**Responsabilidade única:** conduzir UMA decisão humana, do chamado ao
desfecho. `[UI-001 §Missão · PX-005]` **Propósito:** a forma universal como
todo trabalho chega ao humano (CONST L8). **Posição:** `Shell → MissionLayer →
Mission` — filha única e efêmera da Layer persistente. **Queue:** unidirecional
e indireta (Queue emite "abrir" → o **Shell** instancia; a Mission nunca
conhece a Queue). **DecisionBody:** a única parte polimórfica.

## 2 · Anatomia (ordem fixa, constitucional)

```
Mission ├ MissionCall ├ MissionPreparo ├ DecisionBody(polimórfico) └ MissionOutcome(+por quê?)
```

Call (o quê + por-que-agora + tempo + "agora não") · Preparo (o que a Zion já
fez — nunca some) · DecisionBody (o irredutível) · Outcome (desfecho + "por
quê? →", só após o ato). "Why" não é 5ª parte — é atributo do Outcome (L11).

## 3 · Contrato

**Entradas (do Shell):** identidade · chamada · preparo · tipo+dados de
decisão ∈ {Ask,Review,Launch,Demand} · palco-de-origem (opaco). **Pré:** ≤1
Mission viva; preparo completo. **Eventos emitidos (ao Shell):**
ato(resultado) · dispensada · encadear(próxima) · explicar. **Invariantes:**
uma decisão visível · anatomia nunca reordena · palco preservado e devolvido ·
sem scroll que esconda a decisão. **Pós:** desmonta e devolve ao ponto exato
(ou sobe a encadeada).

## 4 · Estados

Preparing · Active · Answered · Deferred · Chained · Completed. **Cancelled
NÃO existe** (há Deferred "agora não" + expiração honesta pela Fila — inventar
Cancelled violaria "nunca criar estados").

## 5 · Fluxo de vida

```
NASCIMENTO(Shell instancia) → PREPARAÇÃO(frase honesta, sem spinner) →
ENTRADA(sobe à Layer; palco atrás intacto) → DECISÃO(uma) →
  ├ ato → RESPOSTA → Outcome → [encadeia: próxima sobe direto | encerra: devolve ao palco]
  └ "agora não" → Deferred → devolve ao palco igual
```

## 6 · Dispositivos (comportamento idêntico; só apresentação varia)

Desktop/UltraWide: centralizada, largura contida (nunca 100% do ultrawide —
respira). Tablet: cobre o palco com respiro. Mobile: tela inteira (a decisão é
o mundo). Ordem cognitiva e "uma por vez" idênticas.

## 7 · Comunicação (ilha)

Contexto desce só do Shell; eventos sobem só ao Shell. **Nunca** conversa
direto com Queue, Área, Catálogo, outra Mission ou objeto-folha.

## 8 · Decision Body (a única parte polimórfica)

Contrato comum: recebe dados · apresenta UMA decisão · emite ato · sem scroll
escondendo · nunca duas decisões. **AskBody** (F2: fato pedido) · **ReviewBody**
(F3: StorefrontPreview → aprovar/ajustar/devolver) · **LaunchBody** (F4:
ProgressNarrative + "3 primeiro" → continuar) · **DemandBody** (F6: rascunho →
aprovar/editar). Só estes quatro (UX-004); um quinto é emenda, não
implementação.

## 9 · Performance

Nada da Mission permanece montado (é efêmera); a Layer permanece. Nunca
recriado: o palco-de-origem (preserva a rolagem → devolução exata). Memoizável:
Call e Preparo (imutáveis). Preserva estado enquanto viva: o rascunho em
edição. Nunca entre vidas: nada — retomada nasce do zero pela Fila.

## 10 · Acessibilidade (derivada)

Ordem de leitura = ordem cognitiva. Foco inicial = a Decisão; "agora não"
sempre alcançável. Três atalhos existem por lei (ato · "agora não" · "por
quê?"); os bindings são visuais/plataforma. "por quê?" é conteúdo lido, não
tooltip. Redução de movimento respeitada (SYS-001 P4). Contraste herdado dos
tokens A11y.

## 11 · Anti-padrões

Duas missões simultâneas · DecisionBody fora da Mission · Mission conhecendo
Queue/Catálogo/Área · estado duplicado · scroll que esconde a decisão · mais de
uma decisão visível · perda de continuidade · modal "tem certeza?" · inventar
Cancelled. (Cada um cita sua violação constitucional.)

## 12 · Critério de aceite

Toda parte rastreia a um documento · a Mission só fala com o Shell (grep por
import de Área/Queue = falha) · filha única da Layer · abrir 2ª missão é no-op ·
escavar→abrir→dispensar preserva a rolagem · encadeamento não pisca o palco ·
estados observáveis ⊆ os 6 · análise estática sem dependências proibidas.

## Veredito

> **A Mission está completamente especificada.** Lacunas declaradas
> (não-bloqueantes, todas visuais/plataforma — já delegadas a `system/002→004`):
> bindings de teclado, proporções/curvas de subida, token de contraste. Nenhuma
> lacuna arquitetural.
