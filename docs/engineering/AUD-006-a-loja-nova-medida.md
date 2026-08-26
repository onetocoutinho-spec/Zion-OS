# AUD-006 — A loja nova, medida

```
Data:      2026-08-25 (parcial)
Ambiente:  preview da branch feat/portal-da-lojista
Host:      zion-os-git-feat-portal-da-lojista-zion-company.vercel.app
Commit:    650916b — confirmado por /api/versao, igual ao HEAD local
Banco:     fivlziuvxvhpuibrjwlq (STAGING) — confirmado no bundle do navegador
```

O T1 do [plano](../../tasks/plan.md): percorrer o caminho da loja nova, passo a
passo, marcando onde alguém da Zion ainda é necessário.

**Este documento está PARCIAL.** O que segue está dividido em duas partes, e a
divisão não é de conveniência: é do que pode ser medido sem criar conta,
autorizar OAuth e publicar anúncio.

---

## Parte 1 — medido em 25/08

Quatro coisas, todas por leitura, nenhuma escreveu nada.

| O que | Resultado |
|---|---|
| O preview serve o código de hoje | ✅ `/api/versao` devolve `650916b`, idêntico ao HEAD |
| Contra qual banco ele fala | ✅ **staging**. O bundle do navegador só traz o ref `fivlziuvxvhpuibrjwlq`; o de produção (`ouynursknlgtmewcdjzr`) não aparece em nenhum dos 18 scripts |
| A porta de entrada existe | ✅ a tela de login traz **"Ainda não tenho conta — criar a minha loja"**, e o clique troca o formulário para "Criar minha conta" |
| O app sobe limpo | ✅ zero erro no console |

A segunda linha é a que mais importa. Ela é a diferença entre medir e estragar:
se o preview estivesse apontado para produção, o percurso escreveria uma loja de
teste na conta que paga. Está apontado para o staging que foi reconstruído em
25/08 — 58 migrações, esquema com md5 idêntico ao de produção
([11](../staging-setup/11-ONDE-O-STAGING-PAROU.md)).

---

## Parte 2 — o percurso, que ainda não foi feito

Nenhuma das linhas abaixo foi medida. Elas exigem ações que não se delegam a um
assistente: criar conta com senha, autorizar o OAuth de uma conta de marketplace
e publicar anúncio.

| # | Passo | Resultado | O que exige |
|---|---|---|---|
| 1 | assinar | **parou aqui** — ver abaixo | criar conta (e-mail + senha) |
| 2 | provisionar | — | depende de 1 |
| 3 | importar base | — | **uma planilha de ERP real** — não o modelo gerado, que passa por construção |
| 4 | imagens | — | `OPENAI_API_KEY`/`GEMINI_API_KEY` no escopo Preview da Vercel |
| 5 | descrições | — | idem |
| 6 | atributos | — | idem |
| 7 | publicar | — | OAuth na conta do ML **de teste ou controlada** — nunca a da lojista |
| 8 | acompanhar | — | depende de 7 |

### Passo 1 — parou na confirmação de e-mail (26/08)

A conta foi criada. O `signUp` funcionou e o app disse a coisa certa na hora:
*"Conta criada. Confirme o e-mail que enviamos para entrar."*

O que parou foi a volta. Tentando entrar antes de confirmar, a tela mostrou:

```
Não foi possível entrar: Email not confirmed
```

Em inglês, sem instrução e sem saída. `AuthGate` traduzia apenas
`Invalid login credentials`; todo o resto caía no `${error.message}` cru.

**E não era hipótese.** Medido na base de PRODUÇÃO no mesmo dia: um cadastro
parado exatamente nesse ponto havia **27 dias** — nunca entrou, nunca virou
perfil, e ninguém percebeu. (O e-mail começa com `zio`, então provavelmente é
teste interno e não cliente perdido. O mecanismo é o mesmo para os dois.)

O e-mail de confirmação some no spam, ou o serviço embutido do Supabase segura
pelo limite, e a pessoa fica olhando uma frase em inglês.

**Consertado no mesmo dia:** a mensagem virou português com instrução, e ganhou
um botão de **reenviar a confirmação** ao lado. Frase sem botão continuaria
sendo parede, só que traduzida. O reenvio responde igual com e sem conta — um
reenvio que dissesse "esse e-mail não tem conta" viraria verificador de cadastro
para quem quisesse descobrir quem usa o produto.

**Destravado no staging para o percurso seguir:** a confirmação pendente foi
marcada direto em `auth.users`, escopada ao único usuário pendente (9 usuários,
0 pendentes depois). Isso é conserto de AMBIENTE, não comportamento de produto —
em produção a confirmação continua exigida, e é ela que o botão de reenvio
atende.

> **Fica em aberto:** se o e-mail de confirmação chega de forma confiável. O
> serviço embutido do Supabase é limitado e cai em spam; um SMTP próprio é a
> diferença entre "a loja assina sozinha" e "a loja assina e espera".

### O que anotar em cada passo

Uma linha por passo, com uma de duas marcas: **passou sozinho** ou **parou aqui,
por isto** — e neste segundo caso, a **mensagem exata** que a tela mostrou. É a
mensagem literal que diz se o produto explica o problema ou empurra a pessoa
para um suporte que não existe mais.

### As guardas que continuam valendo

- **A conta do ML.** Staging isola o banco, não o marketplace. O app é outro,
  mas a conta que autoriza pode ser a mesma da lojista — e aí um anúncio de
  teste vai para a loja que vende. O ML não tem sandbox completo.
- **Sem conta de teste, o passo 7 para no dry-run** (`go:false`): o payload
  montado sem enviar. A medição continua válida e registra *"medido até o
  payload, não até o ar"*.
- **A chave de IA.** Se `OPENAI_API_KEY` não estiver no escopo Preview da
  Vercel, os passos 4 a 6 param por falta de configuração — e isso é resultado
  de ambiente, não do produto. Vale distinguir na anotação.

---

## O que o CHECKPOINT 1 decide

A pergunta é uma só: **a loja chega ao fim sozinha?**

- **Chega** → a Fase 4 (cobrança) está liberada.
- **Não chega** → o que parou vira a próxima tarefa, e cobrança continua
  adiada. Abrir a porta antes de a casa se sustentar gasta a primeira impressão
  de uma conta nova, que não se repõe.
