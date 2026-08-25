"use client";

// O cabeamento de um filtro de tela com a URL. A regra está em ./filtroNaUrl.ts.
//
// Uso — no lugar de `const [status, setStatus] = useState("Todos")`:
//
//   const [status, setStatus] = useFiltroNaUrl("status", "Todos", OPCOES);
//
// A assinatura é a do `useState` de propósito: as telas trocam uma linha e os
// `<FilterSelect onChange={setStatus}>` continuam iguais.
//
// `router.replace` e não `push`: trocar um filtro não é "ir para outra página",
// e cada clique num select criando entrada no histórico faria o Voltar do
// navegador percorrer todos os filtros antes de sair da tela — a régua
// ("Preserve navigation history properly") trata isso como defeito High.
//
// `useSearchParams` faz a árvore até o <Suspense> mais próximo ser renderizada
// no cliente. O boundary é o `loading.tsx` da rota (src/app/loading.tsx) — o
// mesmo esqueleto da troca de rota — e é por isso que este hook não precisa
// do seu próprio <Suspense> em cada tela.

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { lerFiltro, queryComFiltro } from "./filtroNaUrl";

export function useFiltroNaUrl(
  chave: string,
  padrao: string,
  opcoes?: readonly string[]
): [string, (valor: string) => void] {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const valor = lerFiltro(params, chave, padrao, opcoes);

  const definir = useCallback(
    (novo: string) => {
      // `window.location.search` e não `params`: se dois filtros mudarem no
      // mesmo tick, o segundo precisa ver o que o primeiro acabou de gravar.
      const query = queryComFiltro(window.location.search, chave, novo, padrao);
      router.replace(`${pathname}${query}`, { scroll: false });
    },
    [chave, padrao, pathname, router]
  );

  return [valor, definir];
}
