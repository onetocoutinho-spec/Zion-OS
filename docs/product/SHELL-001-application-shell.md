# SHELL-001 — Zion Application Shell

> A estrutura permanente onde toda a Zion vive — materialização de UX-004 +
> UI-001 + SYS-001. Não desenha telas; desenha o frame que as contém. Zero
> conceitos novos.

## 1 · Anatomia — três camadas e uma âncora

```
┌─ CAMADA 0 · MOLDURA (persistente — nunca desaparece) ──────────────┐
│   Lente (só multi-loja)         Áreas: Hoje·Catálogo·Anúncios·      │
│                                 Pulso·Zion                          │
├─ CAMADA 1 · PALCO (a área ativa — sempre uma, ocupa o corpo) ──────┤
│        uma por vez — troca sem recarregar o frame                  │
├─ CAMADA 2 · PRIMEIRO-PLANO MISSÃO (efêmero — sobre o palco) ───────┤
│   entra por cima; escurece o palco atrás (que permanece); uma      │
│   missão por vez; devolve ao exato ponto de partida                │
└────────────────────────────────────────────────────────────────────┘
 CAMADA Z · CONVERSA — a voz: só ALCANÇA a Camada 0 pelos 4 Motivos
```

| Região | Natureza | Some? | Só quando… |
|---|---|---|---|
| Moldura (áreas+Lente) | persistente (aplicação) | nunca | Lente: só 2+ lojas |
| Palco | espaço persistente / conteúdo efêmero | não | conteúdo troca com a área |
| Primeiro-plano Missão | efêmero (contexto) | **sim** | há decisão em curso |
| State Line | persistente | não | (âncora de paz) |
| Marca da Conversa | persistente-silenciosa | não | destaca-se só nos 4 Motivos |

**Regra-mãe:** a Moldura é imóvel; o Palco troca de conteúdo; a Missão sobrepõe
e devolve. Nada mais se move.

## 2 · O Frame — o que existe e o que NÃO existe

**Header?** não como barra de ferramentas — uma faixa-âncora mínima (Lente +
acesso às áreas). **Sidebar?** não fixa — as 5 áreas numa tira de troca.
**Navigation?** existe continuidade, não navegação (trocar área = trocar
conteúdo do Palco; entrar na missão = sobrepor). **Overlay?** exatamente um
tipo: o Primeiro-plano Missão (nenhum outro modal). **Mission Layer?** sim, a
Camada 2. **Background?** superfície neutra sem função. **Safe Area?** sim,
sagrada (o respiro é estrutural). **Nunca no frame:** badges, contadores,
sinos, indicadores permanentes, avatar-com-notificações.

## 3 · Persistência

**Aplicação (persistente):** Moldura · existência do Palco · Marca da Conversa
· Safe Area. **Contexto (efêmero):** conteúdo do Palco · Primeiro-plano Missão
· estado de escavação. **Âncora (única ponte):** a State Line. Recarregar
preserva Moldura+State Line; perde a escavação; fecha a missão (retomável pela
Fila).

## 4 · A Missão — entra, decide, devolve

```
A · palco Hoje, fila visível
 → toca a Missão (ou uma consulta oferece "responder")
B · PRIMEIRO-PLANO sobe   [Chamada·Preparo·Decisão(uma)·Desfecho]
    o palco de origem permanece ATRÁS, escurecido mas intacto
 → ato (um toque) OU "agora não"
C · PRIMEIRO-PLANO desce
    • devolve ao EXATO ponto de partida (mesmo palco, mesma rolagem)
    • desfecho pode ENCADEAR (próxima missão sobe direto — F1→F4 flui)
    • "agora não" → volta à Fila sem culpa; palco reaparece igual
```

Invariantes: uma missão por vez · o palco de origem nunca é destruído · a
missão pode nascer sobre QUALQUER palco (e devolve ali mesmo).

## 5 · As seis áreas — dois eixos ortogonais

```
HORIZONTAL — as 5 áreas (troca lateral, mesma profundidade)
  Hoje ←→ Catálogo ←→ Anúncios ←→ Pulso ←→ Zion
    │  VERTICAL — só a Missão desce/sobe
    ▼  Primeiro-plano Missão (sobrepõe qualquer área)
```

Horizontal = continuidade, não hierarquia (cômodos lado a lado). Vertical = a
única profundidade (só a Missão tem "dentro"; consultas escavam no próprio
palco). Hoje é o repouso. Não é navegação tradicional: sem URL-como-lugar, sem
"voltar" empilhado, sem submenus.

## 6 · Dispositivos — um produto, quatro densidades

Não muda a estrutura; muda onde a Moldura se ancora e quanta consulta cabe.
**Desktop/UltraWide:** Palco centrado, Safe Area lateral ampla — UltraWide
CRESCE a Safe Area, **nunca uma 2ª coluna de conteúdo**. **Tablet:** Palco
largura cheia. **Mobile:** State Line primeiro, áreas na tira inferior
(polegar; nunca hambúrguer-que-esconde), Missão cobre a tela inteira.
Três leis: nunca 2ª coluna de conteúdo · a Missão sempre respira · a ordem
cognitiva é idêntica (âncora→área→missão); só a disposição física da tira
muda (delegada ao visual).

## 7 · Diagramas do Shell

```
Troca de área (Moldura imóvel):
  [moldura ═══►] [Hoje] ──► [moldura ═══►](desliza)──► [moldura ═══►][Catálogo]

Missão (sobrepõe e devolve):
  Palco X ──► [▓ MISSÃO ▓ / palco X atrás intacto] ──► Palco X (mesma posição)

Conversa (só 4 Motivos):
  normal: Marca silenciosa  |  4 Motivos: a Zion fala → depois volta ao silêncio
```

## 8 · Estados do Shell

S0 primeiro acesso (3 missões-onboarding) · S1 repouso saudável · S2 trabalho
(missão sobre Hoje) · S3 consulta (área não-Hoje, escavável) · S4 consulta que
vira trabalho (missão sobre a consulta) · S5 encadeamento · S6 atenção (4
Motivos) · S7 espera (frase-com-prazo, sem spinner) · S8 multi-loja (Lente) ·
S9 exceção sem ansiedade (missão urgente no topo, tom encurtado, sem
cor-pânico). Transições legais: S1↔S2, S1↔S3, S3↔S4, S2/S4→S5, qualquer→S6/S7→
volta. Não existe transição para 2º painel, modal genérico ou tela de config.

## Contrato do Shell

**Fixo:** três camadas · 5 áreas+Missão · Moldura imóvel · Palco único ·
Missão sobrepõe-e-devolve-ao-ponto-exato · uma decisão por vez · nunca 2ª
coluna · nenhum modal além da Missão · zero badges · State Line como âncora ·
ordem cognitiva idêntica em todo dispositivo. **Delegado ao visual
(`system/002→004`):** disposição física da tira de áreas · proporção da Safe
Area · transições · densidade das consultas.
