# Correção A-01 — distinguir carregamento de perfil de negação de acesso

> Escopo: **somente** A-01. Não altera migrações/RLS, nem a integração ML, nem outros itens do diagnóstico. Branch `fix/staging-stabilization` (a partir de `1e1c3e4`).

## Causa raiz
O `AuthGate` colapsava três desfechos distintos num único estado `perfil = null`:
1. `meuPerfil()` retornando `null` (genuinamente **sem perfil** ou **inativo**);
2. `meuPerfil()` **lançando** (erro de rede/banco);
3. o **timeout de 8s** rejeitando a `Promise.race`.

Todos caíam em `catch → setPerfil(null) → "Acesso não liberado"`. Ou seja, **uma falha de rede ou uma conexão lenta era exibida como ausência de permissão**. Além disso: `meuPerfil` confundia *sem sessão* × *sem perfil* × *inativo* (todos `null`, mesma tela); `getSession` e `onAuthStateChange` chamavam o resolver sem proteção contra corrida/desmontagem; o timeout (8s) era curto demais.

## Comportamento anterior
- Rede lenta/instável (perfil demora > 8s) → **"Acesso não liberado"** para usuário válido.
- Erro transitório de banco/rede → **"Acesso não liberado"**.
- Perfil inativo e perfil inexistente → **mesma** mensagem.
- Sem estado de "erro temporário" nem retry real (o botão fazia `window.reload`).

## Comportamento novo (máquina de estados explícita)
Estados (em `src/lib/auth/estadoAuth.ts`, função pura `decidirEstadoAuth`):

| Estado | Quando | Tela |
|--------|--------|------|
| `restaurando_sessao` | sessão ainda sendo restaurada | loading |
| `sem_sessao` | não autenticado / sessão expirada | **login** |
| `carregando_perfil` | autenticado, perfil carregando | loading |
| `autorizado` | perfil ok e ativo | app (RoteadorPapel) |
| `sem_perfil` | consulta OK, perfil inexistente | "Acesso não liberado" + sair |
| `perfil_inativo` | consulta OK, `ativo=false` | **"Acesso desativado"** + sair |
| `erro_perfil` | rede/timeout/erro interno | **erro temporário** + "Tentar novamente" + sair |

Regra central: **erro/timeout → `erro_perfil`, nunca `sem_perfil`**. "Acesso não liberado" só aparece quando a sessão está presente **e** a consulta ao perfil **terminou com sucesso** e o perfil não existe.

Robustez adicionada:
- **Timeout 8s → 12s** (entre 10 e 15).
- **Latest-wins** (`cargaIdRef`) + **guarda de desmontagem** (`montadoRef`): respostas obsoletas ou após unmount são ignoradas; sem requisições concorrentes "vencedoras".
- **Sessão expirada** durante a carga → volta ao **login** (não "sem acesso"), sem loop.
- **Retry** ("Tentar novamente") re-executa a carga (volta a `carregando_perfil`), não recarrega a página.
- **Logs**: apenas `console.error("[auth] falha ao carregar o perfil (rede/tempo).")` — **sem** token, refresh_token, sessão, objeto do usuário, headers ou variáveis de ambiente.

## Arquivos alterados
| Arquivo | Papel |
|---------|-------|
| `src/lib/auth/estadoAuth.ts` (novo) | Tipos + `decidirEstadoAuth` (pura, testável). |
| `src/lib/auth/estadoAuth.test.ts` (novo) | 10 testes da decisão de estado. |
| `src/lib/services/perfil.ts` | Novo `carregarPerfil()` → `{sem_sessao\|sem_perfil\|inativo\|ok}`; **lança** em erro real. `meuPerfil` inalterado (usado pelo ClientPortalShell). |
| `src/components/auth/AuthGate.tsx` | Máquina de estados (sessão × perfil); telas `TelaAcessoDesativado` e `TelaErroPerfil`; timeout 12s; latest-wins + unmount guard. |

> `AppShell` **não** foi alterado (não participa do carregamento de perfil).

## Cenários testados (unitário — `node --test`, 10/10)
1. sessão restaurando → loading · 2. sem sessão → login · 3. sessão + perfil carregando → loading · 4. perfil ok → autorizado · 5. sem perfil → acesso não liberado · 6. inativo → acesso desativado · 7. erro de rede → erro temporário · 8. timeout → erro temporário (não "sem acesso") · 9. retry → volta a loading · 10. sessão expirada → login.

Validações: `tsc --noEmit` exit 0 · `node --test` 33/33 · `npm run lint` 0 erros (49 warnings pré-existentes) · `npm run build` exit 0.

## Roteiro de validação manual no Preview (staging)
Executar no Vercel Preview (Supabase Staging), **nunca** em produção:
1. **Login normal da agência** → cai no Painel da Agência (`/`), sem "Acesso não liberado".
2. **Login normal do Cliente A** → Portal do Cliente, só dados de A.
3. **Login normal do Cliente B** → Portal do Cliente, só dados de B.
4. **Conexão lenta** (DevTools → Network → throttling "Slow 3G"): ao logar, aparece **loading** (não "Acesso não liberado"); dentro de 12s carrega normal.
5. **Falha na requisição de perfil** (DevTools → bloquear/`Offline` a chamada de `perfis`, ou desligar a rede): aparece a tela **de erro temporário** ("Não foi possível carregar seu perfil agora…"), **não** "Acesso não liberado".
6. **"Tentar novamente"** (restaurando a rede) → volta ao loading e entra normalmente.
7. **Logout após erro** → volta ao login, sem loop.
8. **Usuário sem perfil** (auth sem linha em `perfis`) → **"Acesso não liberado"**.
9. **Perfil inativo** (`ativo=false`) → **"Acesso desativado"** (mensagem específica).

## Riscos remanescentes
- A proteção continua **client-side** para a experiência; o corte real de dados é o **RLS/016** (inalterado) — A-03 (P3) segue aberto.
- O timeout de 12s é uma heurística; redes muito ruins ainda mostram o erro temporário (com retry) — comportamento desejado.
- Não cobre testes de componente (React) — apenas a lógica pura; teste de UI fica para quando houver framework (P3 do diagnóstico).
- Fluxos do Mercado Livre (Etapa 1) permanecem pendentes — fora do escopo de A-01.
