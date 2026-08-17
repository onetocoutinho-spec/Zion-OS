"use client";

/**
 * A conferência da FOTO — e o julgamento acontece ANTES de subir.
 *
 * ===========================================================================
 * POR QUE MEDIR NO NAVEGADOR
 * ===========================================================================
 *
 * 127 anúncios desta lojista estão travados por capa pequena, e o remédio que o
 * próprio Mercado Livre deu é foto quadrada com pelo menos 1200 de lado.
 *
 * Uma foto que não atende NÃO destrava nada. Subir primeiro e descobrir depois
 * gastaria a viagem dela ao fabricante, o upload, e a espera — para o anúncio
 * continuar exatamente onde estava.
 *
 * O navegador sabe a dimensão antes de qualquer byte subir. Então ele diz.
 *
 * ===========================================================================
 * A REGRA É DO DOMÍNIO, NÃO DESTA TELA
 * ===========================================================================
 *
 * `lerMaxSize` é a mesma função que julga as capas que o ML informou — ela lê
 * `"1200x1200"` e decide quadrada/grande o suficiente. Aqui a medida vem do
 * navegador em vez do ML, e é escrita no mesmo formato de propósito: uma
 * segunda regra de tamanho divergiria da primeira no primeiro ajuste.
 */

import { useEffect, useState } from "react";
import { lerMaxSize, LADO_MINIMO_DA_CAPA } from "@/modules/integration/domain/capaForaDoPadrao";

// UMA IMPLEMENTAÇÃO SÓ. A medida nasceu aqui, para o cartão que confere a foto
// no chat; desde 11/08/2026 o upload do portal também mede, para gravar a
// dimensão (migração 059). Duas cópias divergiriam no dia em que uma ganhasse
// tratamento de EXIF ou de HEIC e a outra não.
export { medirFoto } from "@/lib/imagens/medirArquivo";
import type { FotoMedida } from "@/lib/imagens/medirArquivo";
export type { FotoMedida };

export function ConferirFoto({
  arquivo,
  medida,
  produto,
  cores = [],
  ocupado,
  onCancelar,
  onConfirmar,
}: {
  arquivo: File;
  medida: FotoMedida;
  /** O produto de destino. `null` = ninguém aberto, e aí não há para onde subir. */
  produto: { id: string; nome: string } | null;
  /**
   * As cores DESTE produto, vindas das variantes. Vazia = produto sem grade de
   * cor, e aí a pergunta não aparece: perguntar cor de quem não tem é ruído.
   */
  cores?: readonly string[];
  ocupado?: boolean;
  onCancelar: () => void;
  onConfirmar: (comoCapa: boolean, cor: string | null) => void;
}) {
  const [comoCapa, setComoCapa] = useState(true);
  // COMEÇA VAZIO, de propósito. Pré-selecionar a primeira cor faria a foto do
  // preto ser gravada como amarela sempre que ela não reparasse no campo — e
  // uma cor errada é pior que nenhuma, porque `null` pelo menos impede o uso.
  const [cor, setCor] = useState("");

  // A URL do preview é um objeto na memória. Sem revogar, cada foto largada
  // deixa um blob preso até a aba fechar.
  useEffect(() => () => URL.revokeObjectURL(medida.url), [medida.url]);

  const c = lerMaxSize(`${medida.largura}x${medida.altura}`);
  const serve = !!c && c.quadrada && c.grandeOSuficiente;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={medida.url}
          alt={`Prévia de ${arquivo.name}`}
          className="h-24 w-24 rounded object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-white/80">{arquivo.name}</p>
          <p className="mt-1 text-sm">
            <span className={serve ? "text-emerald-300" : "text-amber-300"}>
              {medida.largura} × {medida.altura}
            </span>
          </p>

          {/* O VEREDICTO ANTES DO UPLOAD. É o ponto desta tela.
              ATENUADO EM 17/08/2026, contra medição. A frase era "Serve de capa"
              — uma promessa. Quatro dias depois de quatro anúncios da Papete
              Moleca Bege ficarem com capa 1200×1200, o Mercado Livre SEGUIA
              cobrando "a foto de capa não cumpre os requisitos". Somado aos 189
              anúncios já medidos com capa quadrada de 1200 e cobrados, cujo
              texto fala em "produto completo, centralizado": quadrada e 1200 é
              o MÍNIMO dele, não o suficiente. Prometer que serve era vender um
              resultado que não está na nossa mão. */}
          {serve ? (
            <>
              <p className="mt-1 text-xs text-emerald-300/80">
                Atende o mínimo do Mercado Livre: quadrada, {LADO_MINIMO_DA_CAPA} de lado.
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Isso não garante que ele aceite — ele também exige o produto inteiro e
                centralizado na foto, e isso só o olho dele julga.
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-amber-300">
              {c && !c.quadrada
                ? "Esta foto não é quadrada. "
                : ""}
              {c && !c.grandeOSuficiente
                ? `O lado menor tem ${Math.min(medida.largura, medida.altura)}px e o Mercado Livre exige ${LADO_MINIMO_DA_CAPA}. `
                : ""}
              Subir assim não destrava o anúncio — ele continua como está.
            </p>
          )}
        </div>
      </div>

      {produto ? (
        <>
          <p className="mt-3 text-sm text-white/70">
            Vai para <strong className="text-white/90">{produto.nome}</strong>.
          </p>
          <label className="mt-2 flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={comoCapa}
              onChange={(e) => setComoCapa(e.target.checked)}
              disabled={ocupado}
            />
            Usar como capa
          </label>

          {/* O AVISO VEM ANTES DO CLIQUE.
              Marcar esta caixa escreve nos anúncios que estão NO AR: quem
              abrir o anúncio passa a ver esta foto. Contar isso depois de
              feito é a mesma coisa que não contar — e foi o que este
              repositório fez em "Título trocado" e no botão que dizia "não
              grava". Se ela não escolher a cor, o texto abaixo (na pergunta
              da cor) já avisa que o Mercado Livre fica de fora. */}
          {comoCapa && (
            <p className="mt-1.5 pl-6 text-xs leading-relaxed text-zinc-400">
              Troco a capa aqui <strong className="text-white/80">e nos seus anúncios desta cor
              no Mercado Livre</strong> — quem abrir o anúncio passa a ver esta foto. Depois eu
              digo quais anúncios mudaram.
            </p>
          )}

          {/* A COR. Só aparece quando o produto tem grade de cor.
              Cada anúncio dela é de uma cor — sem esta resposta a foto entra
              sem saber a que anúncio serve, e usá-la na cor errada troca uma
              infração de foto por "o anúncio não corresponde ao produto". */}
          {cores.length > 0 && (
            <label className="mt-3 block text-sm text-white/70">
              De qual cor é esta foto?
              <select
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                disabled={ocupado}
                className="mt-1 block w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white disabled:opacity-50"
              >
                <option value="">Não sei dizer</option>
                {cores.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {!cor && (
                <span className="mt-1 block text-xs text-amber-300/80">
                  Sem a cor eu guardo a foto, mas não posso usá-la em anúncio nenhum —
                  cada anúncio seu é de uma cor.
                </span>
              )}
            </label>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => onConfirmar(comoCapa, cor.trim() || null)}
              disabled={ocupado}
              className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/15 disabled:opacity-50"
            >
              {ocupado ? "Enviando…" : serve ? "Enviar foto" : "Enviar mesmo assim"}
            </button>
            <button
              type="button"
              onClick={onCancelar}
              disabled={ocupado}
              className="rounded-md px-3 py-1.5 text-sm text-white/60 hover:text-white disabled:opacity-50"
            >
              Descartar
            </button>
          </div>
          {/* ENVIAR MESMO ASSIM CONTINUA SENDO DELA. Uma foto abaixo do padrão
              pode ser útil como secundária, e o software não decide isso — só
              garante que ela leu o número antes. */}
        </>
      ) : (
        <p className="mt-3 text-sm text-amber-300">
          Não sei de qual produto é esta foto. Abra o produto e mande de novo, ou me diga o nome
          dele — mandar para o produto errado troca a foto de quem estava certo.
        </p>
      )}
    </div>
  );
}
