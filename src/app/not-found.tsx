// Endereço que não existe.
//
// O caso real não é alguém digitando errado: é um link antigo. Uma tela que foi
// renomeada, um atalho salvo no navegador, um link colado num grupo meses atrás.
// Sem este arquivo, tudo isso cai na página preta do Next, em inglês, sem
// nenhuma saída — e quem chegou por um link não sabe nem de onde veio.
//
// Server Component: não há estado nem interação, só dois caminhos de volta.

import Link from "next/link";
import { Compass } from "lucide-react";

export default function NaoEncontrado() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0e0e16] p-6 text-center">
        <Compass size={22} className="mx-auto text-violet-400" />
        <p className="mt-3 text-sm font-medium text-zinc-100">Esta página não existe.</p>
        <p className="mt-1.5 text-sm text-zinc-400">
          O endereço pode ter mudado de nome. Os dois caminhos abaixo levam a um
          lugar que existe.
        </p>

        {/* DOIS links e não um, porque há dois tipos de gente chegando aqui e
            mandar a lojista para o painel da equipe seria pior que o 404. */}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href="/cliente"
            className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 [@media(pointer:coarse)]:min-h-11"
          >
            Ir para a minha loja
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-white/20 hover:text-white [@media(pointer:coarse)]:min-h-11"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}
