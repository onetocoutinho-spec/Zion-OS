# 04 — App do Mercado Livre para Staging

Objetivo: **não** usar o app ML de produção em staging. Opção preferencial: **um aplicativo ML separado para staging**.

## Preferencial — App ML separado (teste)
1. No DevCenter do Mercado Livre, crie um **novo aplicativo** (separado do de produção).
2. **Redirect URI:** configure o de staging, exatamente igual ao que estará em `ML_REDIRECT_URI`:
   `https://<preview-ou-staging-host>/cliente/conectar-ml`
3. Pegue o **Client ID** e **Client Secret** do app de staging → viram `ML_CLIENT_ID` / `ML_CLIENT_SECRET` (staging). **Nunca** use o client_secret de produção.
4. Conecte **apenas uma conta de teste** (ou uma conta real autorizada exclusivamente para teste).

## Se o ML não permitir facilmente 2 apps / múltiplas Redirect URIs
- Verifique se o app permite **múltiplas Redirect URIs**. Se permitir, você pode (com cautela) adicionar a URI de staging — mas o **client_secret continua sendo o mesmo**, o que quebra o isolamento. **Preferível** manter apps separados.
- Se não for possível separar, documente o risco e trate como conta/app **controlado** de teste.

## Não existe sandbox completo — cuidado
O Mercado Livre **não** oferece um sandbox 100% isolado para todos os fluxos. Se precisar usar uma **conta real controlada**:
- Use **apenas um produto de teste** claramente identificado.
- Mantenha a publicação **pausada** ou claramente marcada como teste.
- **Não** altere nenhum anúncio comercial real.
- **Não** importe/publique anúncios reais sem autorização explícita.

## O que validar (sem mudar o modelo de publicação)
- OAuth conecta a conta de teste (o cliente autoriza; o `refresh_token` é salvo **no servidor**, no Supabase de staging).
- O callback (`/api/ml/conectar`) salva o canal **no servidor** e devolve ao navegador apenas dados públicos.
- Dry-run (`go:false`) monta o payload sem publicar.
- Publicação controlada (se autorizada) usa **um item de teste**.

> **Não** implemente User Products aqui. O objetivo é só confirmar que os fluxos existentes continuam funcionando com o token fora do navegador.
