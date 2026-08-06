// A raiz.
//
// ===========================================================================
// POR QUE ESTA PÁGINA NÃO DESENHA NADA
// ===========================================================================
//
// Aqui morava o painel da agência: clientes ativos, produtos em cadastro,
// anúncios em otimização, tarefas atrasadas, relatórios pendentes, faturamento
// previsto. Sete leituras, e SEIS eram de tabelas que existiam para a Zion
// operar o marketplace no lugar da lojista — `onboardings`, `tarefas`,
// `relatorios`, `financeiro`, `anuncios`, `produtos`.
//
// A Zion deixou de ser agência (PLANO-003). Essas telas saíram e o dashboard
// perdeu o assunto: sobrariam dois números sobre uma conta só. A tela de vocês
// — ver-como-a-lojista-vê mais saúde — é o item G do plano, e nasce quando
// houver o que mostrar. Inventá-la agora seria uma tela falsa, que é o que
// `docs/agency-panel-separation/07` proíbe.
//
// ===========================================================================
// POR QUE NÃO HÁ `redirect()` AQUI
// ===========================================================================
//
// Foi a primeira tentativa, e **não funciona**. Medido no log do servidor:
// `GET / 200`, sempre — nunca um 307. O `AuthGate` é um Client Component no
// layout raiz, e quando ele decide mostrar o login os filhos não chegam a ser
// avaliados; a página com o `redirect` fica atrás dessa porta.
//
// Quem manda a equipe daqui para `/clientes` é `decidirRota` — a mesma função
// pura que decide todas as outras rotas por papel, e que tem teste.
//
// A rota continua existindo por um motivo: é o endereço que todo mundo tem
// salvo. Sem ela, `/` cairia no `not-found`, e quem não está logado veria uma
// tela de "não existe" em vez do login.

export default function Raiz() {
  return null;
}
