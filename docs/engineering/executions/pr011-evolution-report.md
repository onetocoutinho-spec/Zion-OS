# Evolution Report — PR-011 · Authority Discovery

> Capítulo III — Decision Intelligence · descoberta pura (zero código alterado)
> Pergunta do ciclo: **como a autoridade circula dentro da Zion?**

## As quatro fontes de autoridade (todas evidenciadas)

1. **Consentimento do cliente** — OAuth ML: o cliente autoriza no site do
   marketplace; o token é custodiado só no servidor (`canaisMarketplace.ts`).
2. **Papel institucional** — `perfis(papel, ativo, cliente_id)` + RLS
   deny-by-default (016), concedido pelo mantenedor.
3. **Regra externa** — o ML dita escopo, expiração e vetos; ninguém na Zion
   concede nem revoga.
4. **Governança congelada** — Freeze/ADR; migrações só pelo mantenedor (3
   artefatos). O próprio programa opera sob autoridade limitada.

## O ciclo de autoridade — quase completo

```
CONCEDER → ESCOPAR → EXERCER → RENOVAR → AUDITAR → REVOGAR
  vivo       vivo      vivo      vivo    PARCIAL     vivo
 (OAuth,   (tenant+  (servidor (rotação  humano    ativo=false
  papel,    RLS+      com o     do       assina;   → refresh_token = null
  clique)   escopo)   token)    token)   sistema   (revogação DESTRUTIVA —
                                         NÃO)      apaga a credencial)
```

O elo ausente é **Responder** (accountability): quando o sistema erra exercendo
autoridade emprestada, o veto persiste (PR-006) mas nenhum registro diz que foi o
sistema quem agiu.

## Descobertas centrais

- **Toda autoridade do sistema é emprestada, escopada e revogável** — token do
  cliente, clique do humano, regra externa. Nenhuma nativa.
- **O OAuth é um protocolo completo de transferência de autoridade já
  implementado** — modelo de referência para qualquer delegação futura.
- **A revogação é destrutiva e não desfaz o passado**: desconectar apaga a
  credencial e deixa os `mlItemId` intactos — retira-se autoridade *futura*,
  nunca as decisões já tomadas.
- **As Decisions do Journal são todas anônimas na prática**: o campo `autor`
  existe desde a migração 022 e **nenhum produtor o preenche** (`autor: "" `).
- **A resposta para "o sistema não assina" já foi desenhada nesta plataforma**:
  a fundação adormecida (E5.1) modela `Autor{tipo, id, agenteCodigo, confianca}`
  com `autor_tipo`/`agente_codigo` persistidos
  (`produto-mestre-db-mapper.ts`). O projeto dorme; a lacuna tem planta pronta.

## Pontos onde o humano é indispensável (evidência, não tradição)

Aprovação final (risco+julgamento+duplo gatilho — e a importação **pula a trava**
com razão: fato consumado) · consentimento OAuth (restrição do ambiente,
intransferível) · migrações/segredos (regra do programa) · preço/curadoria
(domínio contínuo — a contagem não converge, PR-007).

## Reflection (registro)

**Uma organização delega decisões ou autoridade para decidir?** Delega
**autoridade**. O cliente que conecta o ML não aprova cada chamada — concede um
grant escopado dentro do qual milhares de decisões futuras acontecem. A prova
definitiva é a revogação: se delegasse decisões, revogar as desfaria; como delega
autoridade, revogar apenas fecha a torneira — e o código sabe disso
(`ativo=false` apaga o token, as publicações ficam).

**Para continuar responsável por decisões que não executa, a organização precisa
preservar:** o grant (quem concedeu, com que escopo — o Canal preserva) · a
revogabilidade (implementada, destrutiva) · o feedback fechado (só a Publicação)
· **a assinatura** (quem agiu em seu nome — a única peça ausente, cujo projeto já
existe, adormecido). A equação da responsabilidade tem três termos resolvidos e
um em aberto — e o em aberto chama-se `autor`.
